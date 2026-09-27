import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ledgerFileFor, openLedger } from '../engine/ledger-db.mjs';
import {
  LOG_TRUNCATED, appendLog, fitData, ingestSidecar, insertLogRows, logsFileFor, openLogs, prepareLogRow, readLogs,
  redactData, redactPath, redactText, rowsOfEvent, sidecarFileOf, syncDerivedLogs, validateLogData,
} from '../scripts/kernel/typed-logs.mjs';
import { SECRET_PATTERNS } from '../scripts/supervisor/push-mains.mjs';
import { SECRET_PATTERNS as SHARED } from '../scripts/lib/secret-patterns.mjs';
import { artifactHoldOf } from '../scripts/lib/artifact-hold.mjs';

// Typed logs (scripts/kernel/typed-logs.mjs): rows in <repo>/.starciwork/logs.sqlite, validated per kind, redacted
// at write, capped per job, append-only; sidecar ingest and event derivation are idempotent.
const ROOT = path.resolve(import.meta.dirname, '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'api.mjs');
// Every handle a test opens closes before its temp tree is removed (Windows holds an open sqlite file).
const scopes = new WeakMap();
const repoDir = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-typed-logs-'));
  const closers = [];
  scopes.set(t, closers);
  t.after(() => { for (const close of closers.reverse()) { try { close(); } catch { /* closed */ } } fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }); });
  return dir;
};
const track = (t, handle) => { scopes.get(t).push(() => handle.close()); return handle; };
const logsOf = (t, repo) => track(t, openLogs(repo));
const WF = 'wf-typed-logs-spec';

test('storage: logs.sqlite is created in WAL with its schema, and rows are append-only', (t) => {
  const repo = repoDir(t);
  const logs = logsOf(t, repo);
  assert.equal(logs.file, logsFileFor(repo));
  assert.equal(String(logs.db.prepare('PRAGMA journal_mode').get().journal_mode).toLowerCase(), 'wal');
  const r = appendLog(logs, { workflowId: WF, jobId: 'op-a-1', actor: 'op', kind: 'step.start', msg: 'Bắt đầu', data: { name: 'build' } });
  assert.equal(r.ok, true);
  assert.ok(r.seq > 0);
  assert.throws(() => logs.db.prepare('UPDATE logs SET msg=? WHERE seq=?').run('x', r.seq), /append-only/);
  assert.throws(() => logs.db.prepare('DELETE FROM logs').run(), /append-only/);
  const page = readLogs(logs, { workflowId: WF, jobIds: ['op-a-1'] });
  assert.equal(page.rows.length, 1);
  assert.deepEqual(page.rows[0].data, { name: 'build' });
  assert.equal(page.rows[0].level, 'info');
  logs.close();
  const again = openLogs(repo);
  assert.equal(Number(again.db.prepare('SELECT count(*) n FROM logs').get().n), 1);
  again.close();
});

test('validation: kind and data shape are checked; levels default from the data', () => {
  assert.deepEqual(validateLogData('cmd.run', { cmd: 'npm test', exit: 1 }), []);
  assert.match(validateLogData('cmd.run', { cmd: 'npm test' }).join(), /data\.exit is required/);
  assert.match(validateLogData('cmd.run', { cmd: 'npm test', exit: '1' }).join(), /data\.exit must be int/);
  assert.match(validateLogData('nope', {}).join(), /not a log kind/);
  assert.match(validateLogData('test.result', { suite: 'u', passed: 1, failed: 1, failures: ['x'] }).join(), /failures/);
  const base = { workflowId: WF, actor: 'op', msg: 'm' };
  assert.equal(prepareLogRow({ ...base, kind: 'cmd.run', data: { cmd: 'x', exit: 2 } }).row.level, 'warn');
  assert.equal(prepareLogRow({ ...base, kind: 'check.result', data: { name: 'lint', pass: false } }).row.level, 'error');
  assert.equal(prepareLogRow({ ...base, kind: 'test.result', data: { suite: 'unit', passed: 3, failed: 0 } }).row.level, 'info');
  assert.equal(prepareLogRow({ ...base, kind: 'bogus' }).code, 'log-kind-unknown');
  assert.equal(prepareLogRow({ ...base, actor: 'someone', kind: 'narration', data: { markdown: 'x' } }).code, 'log-actor-unknown');
  assert.equal(prepareLogRow({ ...base, msg: '  ', kind: 'narration', data: { markdown: 'x' } }).code, 'log-msg-missing');
  const big = { markdown: 'x'.repeat(9000) };
  assert.equal(prepareLogRow({ ...base, kind: 'narration', data: big }, { clip: false }).code, 'log-data-too-large');
  const clipped = prepareLogRow({ ...base, kind: 'narration', data: big }, { clip: true }).row;
  assert.equal(clipped.data._clipped, true);
  assert.ok(Buffer.byteLength(JSON.stringify(clipped.data)) <= 4096);
  assert.equal(fitData({ a: 1 }, 100).clipped, false);
});

test('redaction reuses the push secret-scan patterns, blanks OTPs and secret-named keys, keeps keys', () => {
  assert.equal(SECRET_PATTERNS, SHARED, 'push-mains re-exports the one shared list');
  const gh = `ghp_${'a'.repeat(36)}`;
  assert.equal(redactText(`pushed with ${gh} ok`), 'pushed with [redacted:github-token] ok');
  assert.equal(redactText('password: "Sup3rSecretValue99"'), 'password: "[redacted]"');
  assert.equal(redactText('password: "fixture-password-123"'), 'password: "[redacted]"', 'a log redacts even a stand-in the push scan would let through');
  assert.equal(redactText('mã OTP: 482913'), 'mã OTP: [redacted]');
  assert.equal(redactText('otp=123456 and code'), 'otp=[redacted] and code');
  assert.equal(redactText('Authorization: Bearer abcdefghijklmnop'), 'Authorization: Bearer [redacted]');
  assert.equal(redactText('GET /cb?code=xyz123&state=1'), 'GET /cb?code=[redacted]&state=1');
  assert.deepEqual(redactData({ password: 'hunter2hunter2', accessToken: 'abc', tokenCount: 3, nested: { apiKey: 'k1' }, cmd: `git push ${gh}` }),
    { password: '[redacted]', accessToken: '[redacted]', tokenCount: 3, nested: { apiKey: '[redacted]' }, cmd: 'git push [redacted:github-token]' });
  assert.equal(redactPath('D:/repo/.env.local'), '[redacted:env-file]');
  assert.equal(redactPath('D:/repo/.env.example'), 'D:/repo/.env.example');
  const row = prepareLogRow({ workflowId: WF, actor: 'op', kind: 'cmd.run', msg: `login ${gh}`, data: { cmd: 'curl', exit: 0, otp: '123456' }, refs: 'a.log,.secrets/key.txt' }).row;
  assert.equal(row.msg, 'login [redacted:github-token]');
  assert.equal(row.data.otp, '[redacted]');
  assert.deepEqual(row.refs, ['a.log', '[redacted:secrets-dir]']);
});

test('per-job cap: a job stops at the cap with one log.truncated row; derived rows are never capped', (t) => {
  const repo = repoDir(t);
  const logs = logsOf(t, repo);
  const rows = Array.from({ length: 6 }, (_, i) => prepareLogRow({ workflowId: WF, jobId: 'op-cap-1', actor: 'op', kind: 'narration', msg: `m${i}`, data: { markdown: `${i}` } }).row);
  const r = insertLogRows(logs, rows, { perJobCap: 3 });
  assert.deepEqual([r.inserted, r.dropped], [3, 3]);
  const derived = prepareLogRow({ workflowId: WF, jobId: 'op-cap-1', actor: 'runtime', kind: 'settle', msg: 's', data: { verdict: 'pass' }, src: 'ev:l:9' }).row;
  assert.equal(insertLogRows(logs, [derived], { perJobCap: 3 }).inserted, 1);
  const more = insertLogRows(logs, [prepareLogRow({ workflowId: WF, jobId: 'op-cap-1', actor: 'op', kind: 'narration', msg: 'late', data: { markdown: 'x' } }).row], { perJobCap: 3 });
  assert.equal(more.dropped, 1);
  const kinds = readLogs(logs, { workflowId: WF, jobIds: ['op-cap-1'] }).rows.map((row) => row.kind);
  assert.deepEqual(kinds.filter((k) => k === LOG_TRUNCATED).length, 1);
  assert.equal(kinds.filter((k) => k === 'narration').length, 3);
  assert.ok(kinds.includes('settle'));
});

test('sidecar ingest: new lines only, idempotent on re-read, invalid lines counted and never stored', (t) => {
  const repo = repoDir(t);
  const logs = logsOf(t, repo);
  const file = sidecarFileOf(repo, WF, 'op-side-1');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const line = (o) => `${JSON.stringify(o)}\n`;
  fs.writeFileSync(file, line({ kind: 'step.start', msg: 'Build', data: { name: 'build' }, at: 1000 }) + line({ kind: 'cmd.run', msg: 'tsc', data: { cmd: 'tsc', exit: 0 } }) + 'not json\n'
    + line({ kind: 'cmd.run', msg: 'missing exit', data: { cmd: 'x' } }));
  const first = ingestSidecar(logs, { repo, workflowId: WF, jobId: 'op-side-1' });
  assert.deepEqual([first.read, first.inserted, first.invalid], [4, 2, 2]);
  assert.equal(ingestSidecar(logs, { repo, workflowId: WF, jobId: 'op-side-1' }).inserted, 0, 'the cursor holds');
  fs.appendFileSync(file, line({ kind: 'step.end', msg: 'Build xong', data: { name: 'build', durationMs: 1200 } }) + '{"kind":"narration","msg":"half');
  const second = ingestSidecar(logs, { repo, workflowId: WF, jobId: 'op-side-1' });
  assert.deepEqual([second.read, second.inserted], [1, 1], 'a partial last line waits for its newline');
  // A rewritten file (the cursor past its end) is re-read from the start: the line hashes keep it idempotent.
  fs.writeFileSync(file, line({ kind: 'step.start', msg: 'Build', data: { name: 'build' }, at: 1000 }));
  assert.equal(ingestSidecar(logs, { repo, workflowId: WF, jobId: 'op-side-1' }).inserted, 0);
  const rows = readLogs(logs, { workflowId: WF, jobIds: ['op-side-1'] }).rows;
  assert.deepEqual(rows.map((r) => [r.kind, r.actor]), [['step.start', 'op'], ['cmd.run', 'op'], ['step.end', 'op']]);
  assert.equal(rows[0].at, 1000);
});

test('event-derived rows: dispatch, checks, settle with land, incident, drop - pure mapping', () => {
  const ev = (seq, kind, entityId, payload, entityType = 'job') => ({ seq, kind, entity_type: entityType, entity_id: entityId, workflow_id: WF, created_at: 5000 + seq, payload_json: JSON.stringify(payload) });
  const ctx = {
    ledgerKey: 'k',
    jobOf: () => ({ op_id: 'backend.implement', attempt: 2, result_json: JSON.stringify({ landed: { head: 'a'.repeat(40), repo: 'D:/r/nivo-backend', repos: [{ paths: ['src/a.ts'] }] } }) }),
    checksOf: () => [{ name: 'lint', command: 'npm run lint', exitCode: 0, evidence: 'ok' }, { name: 'unit', command: 'npm test', exitCode: 1, evidence: '2 failed' }],
  };
  const [dispatch] = rowsOfEvent(ev(1, 'op-dispatched', 'op-x-1', { op: 'backend.implement', model: 'codex-agent', modelId: 'gpt', dispatch: 'ctx_1' }), ctx);
  assert.equal(dispatch.kind, 'dispatch');
  assert.equal(dispatch.src, 'ev:k:1');
  assert.equal(dispatch.data.attempt, 2);
  const checks = rowsOfEvent(ev(2, 'checks-recorded', 'op-x-1', { op: 'backend.implement', attempt: 2 }), ctx);
  assert.deepEqual(checks.map((c) => [c.kind, c.actor, c.data.pass, c.src]), [['check.result', 'check', true, 'ev:k:2:0'], ['check.result', 'check', false, 'ev:k:2:1'],
    ['cmd.run', 'check', undefined, 'ev:k:2:cmd:0'], ['cmd.run', 'check', undefined, 'ev:k:2:cmd:1']], 'each recorded check command is also a runtime cmd.run row');
  const settled = rowsOfEvent(ev(3, 'op-settled', 'op-x-1', { verdict: 'pass', status: 'succeeded', checkEvidence: { observed: 2, passed: 1, failed: 1 } }), ctx);
  assert.deepEqual(settled.map((r) => [r.kind, r.actor]), [['settle', 'runtime'], ['land', 'land']]);
  assert.deepEqual(settled[1].refs, [`commit:${'a'.repeat(40)}`]);
  const failed = rowsOfEvent(ev(4, 'op-settled', 'op-x-1', { verdict: 'fail', status: 'failed' }), ctx);
  assert.deepEqual(failed.map((r) => r.kind), ['settle'], 'a failed settle lands nothing');
  const [incident] = rowsOfEvent(ev(5, 'incident-raised', 'inc-1', { kind: 'shared-blocker', detail: 'typecheck red', holds: ['op-x-1', 'backend.implement'] }, 'incident'), ctx);
  assert.deepEqual([incident.kind, incident.jobId, incident.data.state], ['incident', 'op-x-1', 'raised']);
  const [rejected] = rowsOfEvent(ev(6, 'dispatch-rejected', 'op-x-1', { op: 'business.decide', step: 'worker-start', error: '{"failedStage": "agent_readiness", "lastError": "timeout"}' }), ctx);
  assert.deepEqual([rejected.kind, rejected.data.code, rejected.data.message], ['error', 'dispatch-rejected', 'agent_readiness: timeout']);
  assert.deepEqual(rowsOfEvent(ev(7, 'op-observed', 'op-x-1', {}), ctx), []);
  for (const row of [dispatch, ...checks, ...settled, incident, rejected]) assert.equal(prepareLogRow(row).error, undefined, `${row.kind} is a valid row`);
});

test('syncDerivedLogs derives from a real ledger once: a second sync stores nothing', (t) => {
  const repo = repoDir(t);
  const ledger = track(t, openLedger({ file: ledgerFileFor(repo) }));
  ledger.ensureWorkflow({ workflowId: WF });
  ledger.enqueueJob({ jobId: 'op-backend.implement-1', workflowId: WF, opId: 'backend.implement', attempt: 1, kind: 'op' });
  ledger.appendEvent({ workflowId: WF, entityType: 'job', entityId: 'op-backend.implement-1', kind: 'op-dispatched', payload: { op: 'backend.implement', model: 'claude-agent' } });
  ledger.db.prepare('INSERT INTO checks(workflow_id,op_id,attempt,checks_json,created_at) VALUES(?,?,?,?,?)').run(WF, 'backend.implement', 1, JSON.stringify({ checks: [{ name: 'unit', command: 'npm test', exitCode: 0, evidence: 'green' }] }), 1);
  ledger.appendEvent({ workflowId: WF, entityType: 'job', entityId: 'op-backend.implement-1', kind: 'checks-recorded', payload: { op: 'backend.implement', attempt: 1 } });
  ledger.appendEvent({ workflowId: WF, entityType: 'job', entityId: 'op-backend.implement-1', kind: 'op-settled', payload: { verdict: 'pass', status: 'succeeded' } });
  const logs = logsOf(t, repo);
  const first = syncDerivedLogs(logs, ledger.db);
  assert.equal(first.inserted, 4, 'dispatch, check.result, its cmd.run, settle');
  assert.equal(syncDerivedLogs(logs, ledger.db).inserted, 0);
  ledger.appendEvent({ workflowId: WF, entityType: 'job', entityId: 'op-backend.implement-1', kind: 'job-dropped', payload: { reason: 'superseded' } });
  assert.equal(syncDerivedLogs(logs, ledger.db).inserted, 1);
  assert.deepEqual(readLogs(logs, { workflowId: WF }).rows.map((r) => r.kind), ['dispatch', 'check.result', 'cmd.run', 'settle', 'job.drop']);
});

test('api log: a kernel logs a typed row without a ledger write; an op logs only its own job', (t) => {
  const repo = repoDir(t);
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  ledger.ensureWorkflow({ workflowId: WF });
  ledger.enqueueJob({ jobId: 'op-a-1', workflowId: WF, opId: 'a', kind: 'op' });
  ledger.enqueueJob({ jobId: 'op-b-1', workflowId: WF, opId: 'b', kind: 'op' });
  const eventsBefore = Number(ledger.db.prepare('SELECT count(*) n FROM events').get().n);
  ledger.close();
  const env = { ...process.env, STARCI_ROLE: '', STARCI_OP_JOB: '', ORCA_TERMINAL_HANDLE: '' };
  const api = (args, extra = {}) => spawnSync(process.execPath, [API, ...args, '--repo', repo, '--json'], { encoding: 'utf8', windowsHide: true, env: { ...env, ...extra }, timeout: 60000 });
  const ok = api(['log', '--workflow', WF, '--kind', 'decision', '--msg', 'Chọn codex', '--data', '{"markdown":"devin **hết quota**"}']);
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(JSON.parse(ok.stdout).actor, 'kernel');
  const bad = api(['log', '--workflow', WF, '--kind', 'cmd.run', '--msg', 'x', '--data', '{"cmd":"x"}']);
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /log-data-invalid/);
  const own = api(['log', '--workflow', WF, '--job', 'op-a-1', '--kind', 'file.edit', '--msg', 'Sửa a.ts', '--data', '{"path":"src/a.ts","added":3,"removed":1}'], { STARCI_ROLE: 'op', STARCI_OP_JOB: 'op-a-1' });
  assert.equal(own.status, 0, own.stderr);
  assert.equal(JSON.parse(own.stdout).actor, 'op');
  const other = api(['log', '--workflow', WF, '--job', 'op-b-1', '--kind', 'narration', '--msg', 'x', '--data', '{"markdown":"x"}'], { STARCI_ROLE: 'op', STARCI_OP_JOB: 'op-a-1' });
  assert.notEqual(other.status, 0);
  assert.match(other.stderr, /log-identity-mismatch/);
  const read = api(['logs', '--workflow', WF]);
  assert.equal(read.status, 0, read.stderr);
  assert.deepEqual(JSON.parse(read.stdout).rows.map((r) => [r.kind, r.actor]), [['decision', 'kernel'], ['file.edit', 'op']]);
  const after = openLedger({ file: ledgerFileFor(repo) });
  // The refused op caller leaves its op-caller-refused receipt; the rows themselves wrote nothing to the ledger.
  assert.equal(Number(after.db.prepare("SELECT count(*) n FROM events WHERE kind<>'op-caller-refused'").get().n), eventsBefore);
  after.close();
});

test('housekeeping never removes logs.sqlite (artifact-hold)', (t) => {
  const repo = repoDir(t);
  const logs = openLogs(repo); logs.close();
  const ledger = path.join(repo, '.starciwork', 'runtime.sqlite');
  const hold = artifactHoldOf(path.join(repo, '.starciwork'), { repos: [{ repo, ledger }] });
  assert.ok(hold);
  assert.deepEqual(hold.paths, ['.starciwork/logs.sqlite']);
  assert.equal(artifactHoldOf(path.join(repo, 'src'), { repos: [{ repo, ledger }] }), null);
});
