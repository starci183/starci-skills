import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { inspectLedger, ledgerFileFor, openLedger, TEST_REGISTRY_ENV } from '../engine/ledger-db.mjs';
import { retainLedgerDb, sweepLedgers } from '../scripts/lib/hk-ledger.mjs';
import { seedWorkflow, withLedger } from './_ledger-fixture.mjs';
import { FAKE_ORCA } from './helpers/fake-orca.mjs';

// hk-ledger.mjs under test: the retention path (state_snapshots compaction +
// wal_checkpoint(TRUNCATE) + incremental_vacuum) revived behind the liveness
// fence — a ledger is swept only when every workflow in it is finished or
// archived, no kernel seat is held and no job is unsettled.

const ROOT = path.resolve(import.meta.dirname, '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'api.mjs');
const json = (v) => JSON.stringify(v ?? null);
const out = (r) => { try { return JSON.parse(r.stdout); } catch { return null; } };
const walSize = (file) => { try { return fs.statSync(`${file}-wal`).size; } catch { return 0; } };

const insertSnapshot = (db, checkpointId, workflowId, generation, goalIdentity, body, at = Date.now()) =>
  db.prepare('INSERT INTO state_snapshots(checkpoint_id,workflow_id,generation,goal_identity,state_json,created_at) VALUES(?,?,?,?,?,?)')
    .run(checkpointId, workflowId, generation, goalIdentity, body, at);
const snapshotCount = (db) => db.prepare('SELECT count(*) n FROM state_snapshots').get().n;

test('sweep retains a finished-workflow ledger: superseded snapshots go, the WAL folds back, history stays', (t) => {
  withLedger(t, ({ ledger, ledgerFile }) => {
    const wf = 'wf-hk-done';
    seedWorkflow(ledger, { id: wf, generation: 1, goal: { revision: 0 },
      events: [{ kind: 'goal-approved' }, { kind: 'workflow-finished' }],
      jobs: [{ jobId: `kernel-${wf}`, kind: 'kernel', status: 'succeeded' }, { jobId: 'job-1', status: 'succeeded' }] });
    const db = ledger.db;
    db.prepare("UPDATE workflows SET phase='finished' WHERE workflow_id=?").run(wf);
    insertSnapshot(db, 'bind:g1', wf, 1, 'goal-1', '{"state":1}');
    insertSnapshot(db, 'save:1', wf, 1, 'goal-1', '{"a":1}');
    insertSnapshot(db, 'save:2', wf, 1, 'goal-1', '{"a":2}');
    insertSnapshot(db, 'save:3', wf, 1, 'goal-1', '{"a":3}');
    insertSnapshot(db, 'old:gen0', wf, 0, 'goal-1', '{"old":true}');
    const before = {
      events: db.prepare('SELECT count(*) n FROM events WHERE workflow_id=?').get(wf).n,
      jobs: db.prepare('SELECT count(*) n FROM jobs WHERE workflow_id=?').get(wf).n,
      goals: db.prepare('SELECT count(*) n FROM goals WHERE workflow_id=?').get(wf).n,
      snapshots: snapshotCount(db),
    };
    assert.equal(before.snapshots, 5, 'fixture must seed the rows retention exists to drop');

    const result = sweepLedgers({ apply: true, files: [ledgerFile], allocation: {} });
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.equal(result.deleted, 3, 'two superseded save: checkpoints and the dropped-generation row');
    assert.equal(result.retained.length, 1);
    assert.equal(result.retained[0].checkpoint.ok, true, 'wal_checkpoint(TRUNCATE) must not report busy');
    assert.ok(walSize(ledgerFile) === 0, `the -wal is truncated to zero, got ${walSize(ledgerFile)}`);

    const after = {
      snapshots: snapshotCount(db),
      keptBody: db.prepare("SELECT count(*) n FROM state_snapshots WHERE state_json<>''").get().n,
      events: db.prepare('SELECT count(*) n FROM events WHERE workflow_id=?').get(wf).n,
      jobs: db.prepare('SELECT count(*) n FROM jobs WHERE workflow_id=?').get(wf).n,
      goals: db.prepare('SELECT count(*) n FROM goals WHERE workflow_id=?').get(wf).n,
      saveRows: db.prepare("SELECT count(*) n FROM state_snapshots WHERE checkpoint_id LIKE 'save:%'").get().n,
    };
    assert.equal(after.snapshots, 2, 'newest save: row + the bound checkpoint survive');
    assert.equal(after.saveRows, 1);
    assert.equal(after.keptBody, 1, 'one state body is kept, the rest are cleared before removal');
    assert.deepEqual([after.events, after.jobs, after.goals], [before.events, before.jobs, before.goals],
      'finish ≠ erase: events, jobs and goals history is never retention');
  });
});

test('sweep never touches a ledger a live kernel can still hold', (t) => {
  withLedger(t, ({ ledger, ledgerFile }) => {
    const wf = 'wf-hk-live';
    seedWorkflow(ledger, { id: wf, generation: 1,
      jobs: [{ jobId: `kernel-${wf}`, kind: 'kernel', status: 'running' }],
      signals: [{ scope: 'kernel', key: wf, token: 'tok-live', value: { terminal: 'term-live' } }] });
    const db = ledger.db;
    db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id=?").run(wf);
    insertSnapshot(db, 'save:1', wf, 1, 'goal-1', '{"a":1}');
    const sweep = () => sweepLedgers({ apply: true, files: [ledgerFile], allocation: {} });

    let result = sweep();
    assert.equal(result.retained.length, 0);
    assert.equal(result.skipped[0].reason, 'workflows-live', 'a running workflow keeps the ledger live');
    assert.equal(snapshotCount(db), 1, 'a skipped ledger loses nothing');

    db.prepare("UPDATE workflows SET phase='finished' WHERE workflow_id=?").run(wf);
    result = sweep();
    assert.equal(result.retained.length, 0);
    assert.equal(result.skipped[0].reason, 'kernel-signal-held',
      'a finished workflow whose kernel seat was never released is still live to the sweep');
    assert.equal(snapshotCount(db), 1);

    db.prepare("DELETE FROM signals WHERE scope='kernel' AND key=?").run(wf);
    result = sweep();
    assert.equal(result.retained.length, 0);
    assert.equal(result.skipped[0].reason, 'unsettled-jobs', 'a kernel job still running binds the ledger');
    assert.equal(snapshotCount(db), 1);

    db.prepare("UPDATE jobs SET status='succeeded' WHERE job_id=?").run(`kernel-${wf}`);
    result = sweep();
    assert.equal(result.skipped.length, 0, JSON.stringify(result.skipped));
    assert.equal(result.retained.length, 1, 'the moment nothing live binds it, the ledger is retained');
  });
});

test('a declared housekeeping.ledgerRetentionMs leaves a just-finished ledger to settle', (t) => {
  withLedger(t, ({ ledger, ledgerFile }) => {
    const wf = 'wf-hk-window';
    seedWorkflow(ledger, { id: wf, generation: 1, jobs: [{ jobId: 'job-1', status: 'succeeded' }] });
    const db = ledger.db;
    db.prepare("UPDATE workflows SET phase='finished',updated_at=? WHERE workflow_id=?").run(Date.now(), wf);
    const allocation = { housekeeping: { ledgerRetentionMs: 60000 } };

    const fresh = sweepLedgers({ apply: true, files: [ledgerFile], allocation });
    assert.equal(fresh.retained.length, 0);
    assert.equal(fresh.skipped[0].reason, 'recently-finished');

    db.prepare('UPDATE workflows SET updated_at=? WHERE workflow_id=?').run(Date.now() - 120000, wf);
    const old = sweepLedgers({ apply: true, files: [ledgerFile], allocation });
    assert.equal(old.retained.length, 1, 'past the window the same ledger is retained');
  });
});

test('sweep with no files enumerates the ledgers the machine registry knows', (t) => {
  withLedger(t, ({ ledger, ledgerFile, machine, machineFile }) => {
    const wf = 'wf-hk-registered';
    seedWorkflow(ledger, { id: wf, generation: 1, jobs: [{ jobId: 'job-1', status: 'succeeded' }] });
    ledger.db.prepare("UPDATE workflows SET phase='finished' WHERE workflow_id=?").run(wf);
    machine.registerLedger({ file: ledgerFile, ledgerId: ledger.ledgerId });
    machine.registerLedger({ file: path.join(path.dirname(ledgerFile), 'gone.sqlite'), ledgerId: 'ledger-missing' });

    const result = sweepLedgers({ apply: true, env: { ...process.env, [TEST_REGISTRY_ENV]: machineFile }, allocation: {} });
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.deepEqual(result.retained.map((row) => row.path), [path.resolve(ledgerFile)]);
    assert.deepEqual(result.skipped.map((row) => row.reason), ['ledger-file-missing']);
  });
});

test('api finish runs the retention path on its own ledger as the finish commits', (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-hk-finish-'));
  const fakeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-hk-finish-orca-'));
  t.after(() => { for (const dir of [repo, fakeRoot]) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }); });
  const wf = 'wf-hk-finish';
  const stub = path.join(fakeRoot, 'fake-orca.mjs');
  fs.writeFileSync(stub, FAKE_ORCA);
  const env = { ...process.env, STARCI_ORCA_COMMAND: process.execPath, STARCI_ORCA_ARGS: JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG: path.join(fakeRoot, 'calls.jsonl'), STARCI_FAKE_ORCA_STATE: path.join(fakeRoot, 'state.json'),
    LOCALAPPDATA: path.join(fakeRoot, 'localappdata') };
  const ledgerFile = ledgerFileFor(repo);
  const ledger = openLedger({ file: ledgerFile });
  try {
    const at = Date.now();
    ledger.ensureWorkflow({ workflowId: wf, title: 'hk finish' });
    ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
      .run(wf, 0, 'hkgoal', '# goal', json({ derivedFrom: 'hk' }), at);
    ledger.db.prepare("INSERT INTO inbox(workflow_id,kind,key,payload_json,status,created_at) VALUES(?,?,?,?,'pending',?)")
      .run(wf, 'goal', wf, json({ prompt: 'hk' }), at);
    ledger.enqueueJob({ jobId: `kernel-${wf}`, workflowId: wf, kind: 'kernel', role: 'kernel',
      payload: { hierarchy: { runtime: { host: 'orca', agent: 'codex', model: 'gpt-6-sol', terminalHandle: 'term-hk-kernel' } } } });
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='term-hk-kernel' WHERE job_id=?").run(`kernel-${wf}`);
    ledger.db.prepare("INSERT INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES('kernel',?,NULL,?,?,?,NULL)")
      .run(wf, 'token-hk', json({ terminal: 'term-hk-kernel' }), at);
    // Finish needs the owner's handover approval (tests/handover.spec.mjs owns that gate).
    ledger.appendEvent({ workflowId: wf, entityType: 'job', entityId: 'job-hk-handover', kind: 'handover-approved',
      payload: { jobId: 'job-hk-handover', dispatchId: 'ask-hk', answeredBy: 'owner' } });
    for (const id of ['save:1', 'save:2', 'save:3']) insertSnapshot(ledger.db, id, wf, 1, 'hkgoal', '{"body":1}', at);
  } finally { ledger.close(); }

  const r = spawnSync(process.execPath, [API, 'finish', '--repo', repo, '--workflow', wf, '--json'],
    { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000, env });
  assert.equal(r.status, 0, r.stderr || r.error?.message);
  const body = out(r);
  assert.equal(body?.phase, 'finished');
  assert.equal(body?.retention?.retained, true, `finish must retain its own ledger once the seat is released: ${r.stdout}`);
  assert.equal(body.retention.deleted, 2, 'the two superseded save: checkpoints drop inside finish');
  assert.equal(body.retention.checkpoint.ok, true, 'the WAL folds back and truncates at finish');

  const after = inspectLedger({ file: ledgerFile });
  try {
    assert.equal(after.db.prepare('SELECT count(*) n FROM state_snapshots').get().n, 1, 'only the newest save: checkpoint survives');
    assert.equal(after.db.prepare('SELECT count(*) n FROM goals WHERE workflow_id=?').get(wf).n, 1, 'the goal record is never retention');
  } finally { after.close(); }
  assert.equal(walSize(ledgerFile), 0, 'the -wal is zero after finish, not merely checkpointed');
});

test('retainLedgerDb re-checks liveness under the write lock and refuses a live ledger outright', (t) => {
  withLedger(t, ({ ledger }) => {
    const wf = 'wf-hk-direct';
    seedWorkflow(ledger, { id: wf, generation: 1,
      jobs: [{ jobId: `kernel-${wf}`, kind: 'kernel', status: 'running' }],
      signals: [{ scope: 'kernel', key: wf, token: 'tok', value: { terminal: 'term-x' } }] });
    ledger.db.prepare("UPDATE workflows SET phase='finished' WHERE workflow_id=?").run(wf);
    insertSnapshot(ledger.db, 'save:1', wf, 1, 'g', '{"a":1}');
    const result = retainLedgerDb(ledger.db);
    assert.equal(result.retained, false);
    assert.equal(result.reason, 'kernel-signal-held');
    assert.equal(snapshotCount(ledger.db), 1, 'a refused retain writes nothing');
  });
});
