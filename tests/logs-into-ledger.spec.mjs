import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { LEDGER_BUSY_TIMEOUT_MS, beginImmediate, connectionFacts, ledgerFileFor, openLedger, openLedgerReader } from '../engine/ledger-db.mjs';
import { appendLog, legacyLogsPending, openLogs, prepareLogRow, readLogs, syncLogs } from '../scripts/kernel/typed-logs.mjs';
import { LOG_FLUSH_MS, logWriterFor } from '../scripts/kernel/log-writer.mjs';
import { migrateLogs, retiredFileOf } from '../scripts/work/migrate-logs-into-ledger.mjs';
import { purgeWorkflow } from '../scripts/work/purge-workflow.mjs';
import { readZip } from '../scripts/lib/zip-archive.mjs';
import { runScenario } from '../scripts/checks/ledger-throughput.mjs';

// The typed logs merged into the ledger (owner ruling 2026-09-27): one RDBMS per product repo, a buffered log writer,
// the retired logs.sqlite migrated by a landed CLI, deletes only by the owner-approved workflow purge.
const ROOT = path.resolve(import.meta.dirname, '..');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const repoOf = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-logs-ledger-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }));
  return dir;
};
const seed = (repo, workflows = ['wf-a', 'wf-b'], { phase = null } = {}) => {
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  try {
    for (const workflowId of workflows) { ledger.ensureWorkflow({ workflowId }); if (phase) ledger.db.prepare('UPDATE workflows SET phase=? WHERE workflow_id=?').run(phase, workflowId); }
  } finally { ledger.close(); }
};
const row = (workflowId, i, extra = {}) => prepareLogRow({ workflowId, jobId: `op-x-${workflowId}`, actor: 'op', kind: 'narration', msg: `m${i}`, data: { markdown: `${i}` }, ...extra }).row;
const count = (file, sql = 'SELECT count(*) n FROM logs', ...args) => { const db = new DatabaseSync(file, { readOnly: true }); try { return Number(db.prepare(sql).get(...args).n); } finally { db.close(); } };

// The retired per-repo file, in the schema scripts/kernel/typed-logs.mjs created before 2026-09-27.
const LEGACY_DDL = `CREATE TABLE logs(seq INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, workflow_id TEXT NOT NULL, job_id TEXT,
  actor TEXT NOT NULL CHECK(actor IN ('kernel','op','runtime','check','land')), node_id TEXT, level TEXT NOT NULL CHECK(level IN ('info','warn','error')),
  kind TEXT NOT NULL, msg TEXT NOT NULL, data_json TEXT, refs_json TEXT, src TEXT UNIQUE);
CREATE TABLE log_cursors(name TEXT PRIMARY KEY, value INTEGER NOT NULL); CREATE TABLE log_meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TRIGGER logs_append_only_delete BEFORE DELETE ON logs BEGIN SELECT RAISE(ABORT, 'logs are append-only'); END;`;
function legacyFile(repo, rows) {
  const file = path.join(repo, '.starciwork', 'logs.sqlite');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  try {
    db.exec(`PRAGMA journal_mode=WAL; ${LEGACY_DDL}`);
    const ins = db.prepare('INSERT INTO logs(at,workflow_id,job_id,actor,node_id,level,kind,msg,data_json,refs_json,src) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
    for (const r of rows) ins.run(r.at ?? 1, r.workflowId, r.jobId ?? null, r.actor ?? 'runtime', null, 'info', r.kind ?? 'narration', r.msg ?? 'm', '{}', '[]', r.src ?? null);
    db.prepare('INSERT INTO log_cursors(name,value) VALUES(?,?)').run('events:legacy', 42);
  } finally { db.close(); }
  return file;
}

test('pragmas: every ledger open runs WAL, synchronous=NORMAL, busy_timeout >= 15000, temp_store=MEMORY; readers get the same timeout', (t) => {
  const repo = repoOf(t);
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  try {
    const facts = connectionFacts(ledger.db);
    assert.deepEqual([facts.journalMode, facts.synchronous, facts.tempStore], ['wal', 1, 2]);
    assert.ok(facts.busyTimeoutMs >= 15000 && facts.cacheSize === -16000 && facts.walAutocheckpoint > 0);
    // beginImmediate restores the busy_timeout it lowers for its spin.
    beginImmediate(ledger.db); ledger.db.exec('COMMIT');
    assert.equal(connectionFacts(ledger.db).busyTimeoutMs, LEDGER_BUSY_TIMEOUT_MS);
    assert.match(ledger.db.prepare('EXPLAIN QUERY PLAN SELECT digest FROM events WHERE workflow_id=? AND seq<? ORDER BY seq DESC LIMIT 1').all('w', 9).map((r) => r.detail).join(), /events_workflow_seq/);
  } finally { ledger.close(); }
  const reader = openLedgerReader(ledgerFileFor(repo));
  try { assert.ok(connectionFacts(reader).busyTimeoutMs >= 15000); assert.throws(() => reader.exec("INSERT INTO meta(key,value) VALUES('x','y')"), /readonly/i); } finally { reader.close(); }
});

test('schema: logs is a ledger table referencing its workflow, append-only except the purge hook', (t) => {
  const repo = repoOf(t);
  seed(repo);
  const logs = openLogs(repo);
  try { appendLog(logs, row('wf-a', 1)); appendLog(logs, row('wf-b', 2)); } finally { logs.close(); }
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  try {
    const db = ledger.db;
    assert.throws(() => db.prepare("UPDATE logs SET msg='x'").run(), /append-only/);
    assert.throws(() => db.prepare("DELETE FROM logs WHERE workflow_id='wf-a'").run(), /only the owner-approved workflow purge/);
    assert.throws(() => db.prepare("INSERT INTO logs(at,workflow_id,actor,level,kind,msg) VALUES(1,'wf-none','kernel','info','decision','x')").run(), /FOREIGN KEY/);
    // 'deleting' needs the approval and a verified archive (the table CHECK), so the guard cannot be opened bare.
    assert.throws(() => db.prepare("INSERT INTO workflow_purges(workflow_id,state,created_at) VALUES('wf-a','deleting',1)").run(), /CHECK/);
    db.prepare("INSERT INTO workflow_purges(workflow_id,state,approved_by,approval_ref,archive_path,archive_sha256,verified_at,created_at) VALUES('wf-a','deleting','owner','ask-1','D:/a.zip','ab',1,1)").run();
    assert.equal(db.prepare("DELETE FROM logs WHERE workflow_id='wf-a'").run().changes, 1, 'the purge path deletes its own workflow');
    assert.throws(() => db.prepare("DELETE FROM logs WHERE workflow_id='wf-b'").run(), /only the owner-approved workflow purge/, 'never another workflow');
  } finally { ledger.close(); }
});

test('buffered writer: queued rows flush on the timer or at 200 rows; write() is durable on return; never inside a ledger transaction', async (t) => {
  const repo = repoOf(t);
  seed(repo);
  const file = ledgerFileFor(repo);
  const logs = openLogs(repo);
  try {
  logs.writer.enqueue([row('wf-a', 1), row('wf-a', 2)]);
  assert.equal(count(file), 0, 'queued, not yet written');
  await sleep(LOG_FLUSH_MS + 200);
  assert.equal(count(file), 2, 'the timer flushed within flushMs');
  logs.writer.enqueue(Array.from({ length: 200 }, (_, i) => row('wf-b', i)));
  assert.equal(count(file), 202, '200 queued rows flush at once');
  const flushesBefore = logs.writer.stats.flushes;
  const r = logs.writer.write([row('wf-a', 900)]);
  assert.equal(r.inserted, 1);
  assert.equal(count(file), 203, 'write() committed before it returned');
  assert.equal(logs.writer.stats.flushes, flushesBefore + 1, 'one short transaction');
  // Inside this process's own ledger transaction the writer defers instead of waiting on the lock its thread holds.
  const ledger = openLedger({ file });
  try {
    const inner = ledger.transaction(() => logs.writer.write([row('wf-a', 901)]));
    assert.equal(inner.deferred, true);
  } finally { ledger.close(); }
  await sleep(LOG_FLUSH_MS + 200);
  assert.equal(count(file), 204, 'the deferred row landed on the next tick');
  } finally { logs.close(); }
});

test('buffered writer: rows a process queued are flushed on exit', (t) => {
  const repo = repoOf(t);
  seed(repo);
  const script = `import { openLogs } from ${JSON.stringify(new URL('../scripts/kernel/typed-logs.mjs', import.meta.url).href)};
    import { prepareLogRow } from ${JSON.stringify(new URL('../scripts/kernel/typed-logs.mjs', import.meta.url).href)};
    const logs = openLogs(${JSON.stringify(repo)});
    logs.writer.enqueue([1,2,3].map((i) => prepareLogRow({ workflowId: 'wf-a', actor: 'kernel', kind: 'decision', msg: 'q' + i, data: { markdown: 'x' } }).row));
    process.exit(0);`;
  const r = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '-e', script], { encoding: 'utf8', windowsHide: true, timeout: 60000 });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(count(ledgerFileFor(repo)), 3);
});

test('the ui server writes only the logs tables: the writer connection refuses every other write; ui handles are read-only', (t) => {
  const repo = repoOf(t);
  seed(repo);
  const writer = logWriterFor(ledgerFileFor(repo)).retain();
  try {
    assert.throws(() => writer.db.prepare("INSERT INTO events(event_id,workflow_id,generation,entity_type,entity_id,kind,created_at) VALUES('e','wf-a',0,'x','y','k',1)").run(), /not authorized/);
    assert.throws(() => writer.db.prepare("UPDATE workflows SET title='x'").run(), /not authorized/);
    assert.throws(() => writer.db.prepare('DELETE FROM log_cursors').run(), /not authorized/);
    assert.throws(() => writer.db.exec('CREATE TABLE x(a)'), /not authorized/);
    writer.db.prepare("INSERT INTO log_cursors(name,value) VALUES('c',1)").run();
  } finally { writer.release(); }
  // Source law: no ui module opens the ledger read-write; every raw sqlite open is read-only.
  for (const name of fs.readdirSync(path.join(ROOT, 'ui')).filter((n) => n.endsWith('.mjs'))) {
    const src = fs.readFileSync(path.join(ROOT, 'ui', name), 'utf8');
    const imports = [...src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'\.\.\/engine\/ledger-db\.mjs'/g)].flatMap((m) => m[1].split(',').map((s) => s.trim()));
    for (const banned of ['openLedger', 'openMachine', 'openLedgerConnection']) assert.ok(!imports.includes(banned), `ui/${name} imports ${banned}`);
    for (const m of src.matchAll(/new DatabaseSync\(([^;]*)\)/g)) assert.match(m[1], /readOnly:\s*true/, `ui/${name}: ${m[0]}`);
    assert.doesNotMatch(src, /\blogWriterFor\(/, `ui/${name} writes logs only through typed-logs.mjs openLogs`);
  }
});

test('ui readProjectLogs: its sync changes the logs tables and nothing else', async (t) => {
  const repo = repoOf(t);
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  const wf = 'wf-ui-writes';
  try {
    ledger.ensureWorkflow({ workflowId: wf });
    ledger.enqueueJob({ jobId: 'op-a-1', workflowId: wf, opId: 'a', kind: 'op' });
    ledger.appendEvent({ workflowId: wf, entityType: 'job', entityId: 'op-a-1', kind: 'op-dispatched', payload: { op: 'a', model: 'codex' } });
  } finally { ledger.close(); }
  const snapshot = () => { const db = openLedgerReader(ledgerFileFor(repo)); try { return Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map((r) => [r.name, db.prepare(`SELECT count(*) n FROM ${r.name}`).get().n])); } finally { db.close(); } };
  const before = snapshot();
  const { readProjectLogs, closeProjectLogs } = await import('../ui/typed-logs.mjs');
  let page;
  try { page = readProjectLogs({ id: 'p', repo }, { workflowId: wf, jobIds: null, kinds: null, after: 0, limit: 100 }); } finally { closeProjectLogs(); }
  assert.deepEqual(page.rows.map((r) => r.kind), ['dispatch']);
  const after = snapshot();
  const changed = Object.keys(after).filter((k) => after[k] !== before[k]).sort();
  assert.deepEqual(changed, ['log_cursors', 'logs']);
});

test('migration: logs.sqlite copied by src (idempotent), seq kept, cursors moved, counts verified, file retired; sync waits until then', (t) => {
  const repo = repoOf(t);
  legacyFile(repo, [{ workflowId: 'wf-a', src: 'ev:l:1' }, { workflowId: 'wf-a', src: 'jl:abc' }, { workflowId: 'wf-a' }, { workflowId: 'wf-b', src: 'ev:l:2' }]);
  seed(repo, ['wf-a', 'wf-b']);
  // The ledger opened after the file appeared: its new logs table starts past the old newest seq (4).
  assert.equal(legacyLogsPending(repo), true);
  const logs = openLogs(repo);
  let early;
  try {
    early = appendLog(logs, { workflowId: 'wf-b', actor: 'kernel', kind: 'decision', msg: 'during the move', data: { markdown: 'x' } });
    const ledger = openLedgerReader(ledgerFileFor(repo));
    try { assert.equal(syncLogs(logs, ledger, { repo }).deferred, 'legacy-logs-pending', 'derivation waits for the migration'); } finally { ledger.close(); }
  } finally { logs.close(); }
  assert.ok(early.seq > 4, 'a row written before the migration never takes an old seq');

  const dry = migrateLogs({ repo });
  assert.deepEqual([dry.dryRun, dry.wouldCopy, dry.alreadyPresent, dry.orphans.length], [true, 4, 0, 0]);
  assert.equal(count(ledgerFileFor(repo)), 1, 'a dry run writes nothing');
  assert.throws(() => migrateLogs({ repo, apply: true }), /backup-dir/);

  const backupDir = path.join(repo, 'backup');
  const applied = migrateLogs({ repo, apply: true, backupDir, date: '20260927' });
  assert.equal(applied.ok, true, applied.reason);
  assert.deepEqual([applied.copied.inserted, applied.copied.keptSeq, applied.copied.duplicate], [4, 4, 0]);
  assert.deepEqual(applied.verify.workflows.map((w) => [w.workflowId, w.legacy, w.inLedger]), [['wf-a', 3, 3], ['wf-b', 1, 1]]);
  assert.deepEqual(applied.backups.map((b) => [path.basename(b.backup), b.integrity]), [[`${path.basename(repo)}.runtime.sqlite`, 'ok'], [`${path.basename(repo)}.logs.sqlite`, 'ok']]);
  assert.equal(applied.retired, retiredFileOf(repo, '20260927'));
  assert.ok(fs.existsSync(applied.retired) && !legacyLogsPending(repo), 'renamed, never deleted');
  const file = ledgerFileFor(repo);
  assert.equal(count(file), 5);
  assert.equal(count(file, "SELECT count(*) n FROM logs WHERE src='legacy:3'"), 1, 'a row without src gets legacy:<seq>');
  assert.equal(count(file, "SELECT value n FROM log_cursors WHERE name='events:legacy'"), 42);
  { const db = new DatabaseSync(file, { readOnly: true }); try { assert.deepEqual(db.prepare('SELECT seq FROM logs ORDER BY seq').all().map((r) => r.seq).slice(0, 4), [1, 2, 3, 4], 'old rows keep their seq'); } finally { db.close(); } }

  // Idempotent: nothing left to do; and a restored file (a retire that failed) copies nothing twice.
  assert.equal(migrateLogs({ repo, apply: true, backupDir: path.join(repo, 'backup2') }).nothing, true);
  fs.copyFileSync(applied.retired, path.join(repo, '.starciwork', 'logs.sqlite'));
  assert.equal(legacyLogsPending(repo), false, 'a file that reappears after the recorded move never holds the sync back');
  const again = migrateLogs({ repo, apply: true, backupDir: path.join(repo, 'backup3'), date: '20260927' });
  assert.deepEqual([again.copied.inserted, again.copied.duplicate, again.verify.ok], [0, 4, true]);
  assert.equal(again.retired, `${retiredFileOf(repo, '20260927')}-2`, 'a second retire the same day never overwrites the first');
  assert.equal(count(file), 5);
});

test('migration: rows of a workflow the ledger does not hold are orphans - never copied, and the file is not retired', (t) => {
  const repo = repoOf(t);
  seed(repo, ['wf-a']);
  legacyFile(repo, [{ workflowId: 'wf-a', src: 'x1' }, { workflowId: 'wf-gone', src: 'x2' }]);
  const out = migrateLogs({ repo, apply: true, backupDir: path.join(repo, 'b') });
  assert.equal(out.ok, false);
  assert.deepEqual(out.orphans, [{ workflowId: 'wf-gone', rows: 1 }]);
  assert.equal(out.retired, null);
  assert.ok(legacyLogsPending(repo));
});

test('purge: refused unless finished and approved; archives to a verified ZIP, then deletes the workflow as a unit', (t) => {
  const repo = repoOf(t);
  seed(repo, ['wf-done', 'wf-live']);
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  try {
    ledger.db.prepare("UPDATE workflows SET phase='finished' WHERE workflow_id='wf-done'").run();
    ledger.enqueueJob({ jobId: 'op-d-1', workflowId: 'wf-done', opId: 'd', kind: 'op' });
    ledger.db.prepare("UPDATE jobs SET status='succeeded' WHERE job_id='op-d-1'").run();
    ledger.appendEvent({ workflowId: 'wf-done', entityType: 'job', entityId: 'op-d-1', kind: 'op-settled', payload: { verdict: 'pass' } });
    ledger.db.prepare('INSERT INTO job_artifacts(workflow_id,job_id,kind,path,sha256,bytes,created_at) VALUES(?,?,?,?,?,?,?)').run('wf-done', 'op-d-1', 'report', '.starciwork/kernel-evidence/wf-done/jobs/op-d-1/report.json', 'x', 2, 1);
  } finally { ledger.close(); }
  const evidence = path.join(repo, '.starciwork', 'kernel-evidence', 'wf-done', 'jobs', 'op-d-1');
  fs.mkdirSync(evidence, { recursive: true });
  fs.writeFileSync(path.join(evidence, 'report.json'), '{}');
  const logs = openLogs(repo);
  try { appendLog(logs, row('wf-done', 1)); appendLog(logs, row('wf-live', 2)); } finally { logs.close(); }
  const archiveRoot = path.join(repo, 'archive');
  assert.deepEqual(purgeWorkflow({ repo, workflowId: 'wf-live', archiveRoot }).blockers, ['phase is unset, not finished or archived']);
  assert.throws(() => purgeWorkflow({ repo, workflowId: 'wf-done', apply: true, archiveRoot }), /approved-by/);
  const out = purgeWorkflow({ repo, workflowId: 'wf-done', apply: true, approvedBy: 'owner', approvalRef: 'ask-purge-1', archiveRoot, date: '20260927' });
  assert.equal(out.ok, true);
  assert.equal(out.purge.state, 'purged');
  assert.ok(out.purge.verified_at && out.purge.archive_sha256 && out.purge.events_head);
  const entries = new Map(readZip(out.purge.archive_path).map((e) => [e.name, e]));
  const manifest = JSON.parse(entries.get('manifest.json').data);
  assert.equal(manifest.eventsHead, out.purge.events_head);
  assert.ok(entries.has('files/.starciwork/kernel-evidence/wf-done/jobs/op-d-1/report.json'));
  assert.equal(entries.get('ledger/logs.ndjson').data.toString().trim().split('\n').length, 1);
  const file = ledgerFileFor(repo);
  assert.equal(count(file, "SELECT count(*) n FROM logs WHERE workflow_id='wf-done'"), 0);
  assert.equal(count(file, "SELECT count(*) n FROM workflows WHERE workflow_id='wf-done'"), 0);
  assert.equal(count(file, "SELECT count(*) n FROM logs WHERE workflow_id='wf-live'"), 1, 'another workflow is untouched');
  assert.ok(!fs.existsSync(path.join(repo, '.starciwork', 'kernel-evidence', 'wf-done')));
  assert.equal(purgeWorkflow({ repo, workflowId: 'wf-done', apply: true, approvedBy: 'owner', approvalRef: 'ask-purge-1', archiveRoot }).already, true);
});

test('throughput smoke: writers log through the buffered writer without a single SQLITE_BUSY', async (t) => {
  const dir = repoOf(t);
  for (const scenario of ['after', 'nolog']) {
    const r = await runScenario(scenario, { writers: 4, seconds: 1, burst: 5, interval: 50, dir });
    assert.deepEqual(r.failedWriters, []);
    assert.equal(r.busy + r.logBusy, 0, `${scenario}: no SQLITE_BUSY`);
    assert.ok(r.ledgerWrites > 0 && r.p95 != null);
    assert.equal(r.storedLogs, r.logRows, `${scenario}: every logged row is stored`);
  }
});

test('readLogs through the writer connection returns the migrated and the new rows in seq order', (t) => {
  const repo = repoOf(t);
  seed(repo, ['wf-a']);
  const logs = openLogs(repo);
  try {
    for (let i = 0; i < 3; i++) appendLog(logs, row('wf-a', i));
    assert.deepEqual(readLogs(logs, { workflowId: 'wf-a' }).rows.map((r) => r.msg), ['m0', 'm1', 'm2']);
  } finally { logs.close(); }
});
