// A worker death in a host-wide terminal wipe is the environment's, even when it is the first death the
// sweep reconciles (scripts/kernel/host-event.mjs hostEventAround, scripts/kernel/lineage-route.mjs).
//
// Live defect (host free RAM 8-9%, ram-throttle heavy-paused):
// Orca dropped every terminal at once. The first dead worker reconciled, a devin code.refactor
// (gone terminal_handle_stale, a dirty tree), settled failed-no-report
// before its three sibling workers (dead-worker-requeued, all terminal_handle_stale),
// the module-studio Kernel (cleared terminal_handle_stale) and the collab and fe-canon Kernels
// (cleared 'terminal disconnected') reached the ledger. hostWideDisconnectOf saw no
// proof, the attempt spent a business retry and its retry was routed off devin for a death that said
// nothing of devin. A wedged worker (its own turn stuck on a
// no-output command, terminal alive) stays the worker's failure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { hostEventAround, hostWideDisconnectOf, hostDeadWorker } from '../../scripts/kernel/host-event.mjs';
import { attemptCauseOf } from '../../scripts/kernel/lineage-route.mjs';

const MIN = 60_000, SEC = 1000;
const SETTLE = Date.parse('2026-09-28T04:19:33Z');
const FE = 'wf-app-fe-canon-x';
const STALE = 'terminal_handle_stale';

const ledger = (t) => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE events(seq INTEGER PRIMARY KEY AUTOINCREMENT, workflow_id TEXT, entity_type TEXT, entity_id TEXT,
    kind TEXT, payload_json TEXT, created_at INTEGER)`);
  t.after(() => db.close());
  return db;
};
const event = (db, workflow, kind, payload, at, entity = null) => db.prepare(
  'INSERT INTO events(workflow_id, entity_type, entity_id, kind, payload_json, created_at) VALUES(?,?,?,?,?,?)')
  .run(workflow, entity ? 'job' : null, entity, kind, JSON.stringify(payload), at);
const kernelCleared = (db, workflow, at, reason) => event(db, workflow, 'kernel-stale-cleared', { reason }, at);
const workerRequeued = (db, workflow, at, worker) => event(db, workflow, 'dead-worker-requeued', { worker }, at);
const settledNoReport = (worker, at = SETTLE) => ({
  job_id: 'op-code.refactor-b7f1b77a67', workflow_id: FE, op_id: 'code.refactor', attempt: 9, status: 'failed',
  created_at: at - 9 * MIN, updated_at: at + SEC,
  payload_json: JSON.stringify({ model: 'devin-agent' }),
  result_json: JSON.stringify({ verdict: 'fail', reason: 'failed-no-report', effectState: 'partial', attemptConsumed: true, worker, at }),
});
// The wipe as the ledger recorded it; the dying worker's own row carries no error code.
const seedWipe = (db) => {
  event(db, FE, 'worker-failed-no-report', { liveness: 'gone', terminal: 'term_c757' }, SETTLE, 'op-code.refactor-b7f1b77a67');
  kernelCleared(db, 'wf-app-module-studio-x', SETTLE + 6 * SEC, STALE);
  workerRequeued(db, FE, SETTLE + 6 * SEC, { terminal: 'term_50fb', liveness: 'gone', errorCode: STALE });
  workerRequeued(db, FE, SETTLE + 9 * SEC, { terminal: 'term_e6bc', liveness: 'gone', errorCode: STALE });
  workerRequeued(db, FE, SETTLE + 13 * SEC, { terminal: 'term_f46b', liveness: 'gone', errorCode: STALE });
  kernelCleared(db, 'wf-app-collab-group-chat-x', Date.parse('2026-09-28T04:34:56Z'), 'terminal disconnected');
  kernelCleared(db, FE, Date.parse('2026-09-28T04:35:31Z'), 'terminal disconnected');
};

test('the first worker reconciled in a host wipe reads as the environment once the proof lands after it', (t) => {
  const db = ledger(t);
  seedWipe(db);
  const worker = { terminal: 'term_c757', liveness: 'gone', errorCode: STALE };
  assert.equal(hostWideDisconnectOf(db, SETTLE, { repos: [] }), null, 'at its settle no other death was in the ledger (the live miss)');
  assert.deepEqual(hostEventAround(db, SETTLE, { repos: [] })?.sort(),
    ['wf-app-collab-group-chat-x', FE, 'wf-app-module-studio-x'].sort());
  const cause = attemptCauseOf(db, settledNoReport(worker));
  assert.equal(cause.attributable, false, cause.detail);
  assert.equal(cause.cause, 'host-terminal-wipe-hindsight');
});

test('dead worker terminals are host evidence at settle time, one count per workflow', (t) => {
  const db = ledger(t);
  const at = Date.parse('2026-09-28T04:20:00Z');
  workerRequeued(db, FE, at - 3 * MIN, { liveness: 'gone', errorCode: STALE });
  workerRequeued(db, FE, at - 2 * MIN, { liveness: 'gone', errorCode: STALE });
  kernelCleared(db, 'wf-app-module-studio-x', at - 2 * MIN, STALE);
  assert.equal(hostWideDisconnectOf(db, at, { repos: [] }), null, 'four terminals of two workflows are not yet host-wide');
  event(db, 'wf-app-auth-x', 'worker-failed-no-report', { liveness: 'disconnected' }, at - MIN, 'op-x');
  assert.deepEqual(hostWideDisconnectOf(db, at, { repos: [] })?.sort(), [FE, 'wf-app-auth-x', 'wf-app-module-studio-x'].sort());
});

test('deaths no single window around the settle holds stay the pool\'s', (t) => {
  const db = ledger(t);
  kernelCleared(db, 'wf-a', SETTLE - 15 * MIN, STALE);
  kernelCleared(db, 'wf-b', SETTLE + 15 * MIN, 'terminal disconnected');
  kernelCleared(db, 'wf-c', SETTLE + 18 * MIN, 'terminal disconnected');
  kernelCleared(db, 'wf-d', SETTLE + MIN, 'kernel quiet 45m');
  assert.equal(hostEventAround(db, SETTLE, { repos: [] }), null, 'wf-a and wf-b..c are 30+ minutes apart');
  const cause = attemptCauseOf(db, settledNoReport({ liveness: 'gone', errorCode: STALE }));
  assert.equal(cause.cause, 'no-report');
  assert.equal(cause.attributable, true);
});

test('a wedged worker in a host event is still its own failure; a gone worker without a stale handle proves nothing', (t) => {
  const db = ledger(t);
  seedWipe(db);
  assert.equal(hostDeadWorker({ liveness: 'wedged' }), false);
  assert.equal(hostDeadWorker({ liveness: 'gone' }), false);
  assert.equal(hostDeadWorker({ liveness: 'gone', errorCode: STALE }), true);
  assert.equal(hostDeadWorker({ liveness: 'disconnected' }), true);
  const wedged = attemptCauseOf(db, settledNoReport({ terminal: 'term_9774', liveness: 'wedged' }));
  assert.equal(wedged.cause, 'no-report');
  assert.equal(wedged.attributable, true);
  const lone = ledger(t);
  event(lone, FE, 'worker-failed-no-report', { liveness: 'gone' }, SETTLE, 'op-a');
  event(lone, 'wf-b', 'worker-failed-no-report', { liveness: 'gone' }, SETTLE, 'op-b');
  event(lone, 'wf-c', 'dead-worker-requeued', { worker: { liveness: 'gone' } }, SETTLE, 'op-c');
  assert.equal(hostEventAround(lone, SETTLE, { repos: [] }), null);
});
