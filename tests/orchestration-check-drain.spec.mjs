// The orchestration drain (scripts/kernel/api-lib/messages.mjs drainWorkflowMessages, map REPLACE #7): every Run of a
// workflow is read through Orca's consuming check naming the Kernel terminal, every message of a Delivery is written into
// the ledger in ONE transaction, and the Delivery is acknowledged only after that commit. A replayed Delivery writes
// nothing twice. worker_done rows are settlement's hand-off (workerDoneOf). The check is a fake of the orch-check
// wrapper: nothing reaches a host.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openLedger, ledgerFileFor, ensureWorkflow, changeWorkflowPhase, insertGoal, createUnit, enqueueJob, setJobStatus, updateJob } from '../engine/ledger-db.mjs';
import { drainWorkflowMessages, workerDoneOf, workerQuestionsOf, ORCHESTRATION_DELIVERY } from '../scripts/kernel/api-lib/messages.mjs';

const WF = 'wf-drain', JOB = 'job-drain', KERNEL = 'term-kernel', RUN = 'run-wf', DISPATCH = 'ctx_op';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-check-drain-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const repo = path.join(root, 'repo');
  fs.mkdirSync(repo, { recursive: true });
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  t.after(() => ledger.close());
  const at = Date.now();
  ledger.transaction((db) => {
    ensureWorkflow(db, { workflowId: WF, phase: 'queued', title: 'drain', by: 'test-fixture', reason: 'seed', at });
    insertGoal(db, { workflowId: WF, revision: 1, goalIdentity: `goal-${WF}`, markdown: '# goal', goal: {}, createdAt: at });
    changeWorkflowPhase(db, { workflowId: WF, to: 'running', by: 'test-fixture', reason: 'seed', at });
    enqueueJob(db, { jobId: `kernel-${WF}`, workflowId: WF, kind: 'kernel', role: 'kernel', payload: { orca: { runId: RUN } }, createdAt: at });
    for (const to of ['ready', 'leased']) setJobStatus(db, { jobId: `kernel-${WF}`, to, reason: 'seed', at });
    setJobStatus(db, { jobId: `kernel-${WF}`, to: 'running', reason: 'seed', at, workerId: KERNEL });
    createUnit(db, { workflowId: WF, unitId: `unit-${JOB}`, opId: 'code.refactor', subjectKey: `unit-${JOB}`, goalRevision: 1, createdAt: at });
    enqueueJob(db, { jobId: JOB, workflowId: WF, unitId: `unit-${JOB}`, opId: 'code.refactor', kind: 'op', payload: { opId: 'code.refactor' }, createdAt: at });
    for (const to of ['ready', 'leased']) setJobStatus(db, { jobId: JOB, to, reason: 'seed', at });
    setJobStatus(db, { jobId: JOB, to: 'running', reason: 'seed', at, workerId: 'term-op' });
    updateJob(db, { jobId: JOB, payload: { opId: 'code.refactor', managed: { runId: RUN, dispatchId: DISPATCH, agentTerminalHandle: 'term-op' } }, at });
  });
  return ledger;
}

const msg = (id, type, extra = {}) => ({ id, run_id: RUN, from_handle: `dispatch:${DISPATCH}`, to_handle: `run:${RUN}`, type,
  subject: type, body: `${type} ${id}`, thread_id: null, payload: JSON.stringify({ dispatchId: DISPATCH, taskId: 'task_op', ...extra }), created_at: '2026-10-01T00:00:00Z' });

/** A fake orch-check: `batches` are the Deliveries in order; one replays until acked. `trace` records calls and commits. */
function fakeCheck(batches, trace, { fenceFor = null, ackFails = false } = {}) {
  let i = 0;
  return ({ run, terminal, ack = null }) => {
    trace.push(['check', run, terminal, ack]);
    if (fenceFor && terminal === fenceFor.terminal && run === fenceFor.run) return { ok: false, messages: [], fenced: true, errorCode: 'consumer_fenced', error: 'consumer_fenced' };
    if (ack) { if (ackFails) return { ok: false, messages: [], errorCode: 'runtime_unavailable', error: 'host down' }; if (`d${i}` === ack) i += 1; }
    const batch = batches[i];
    return batch ? { ok: true, deliveryId: `d${i}`, messages: batch } : { ok: true, deliveryId: null, messages: [] };
  };
}
const traced = (ledger, trace) => {
  const tx = ledger.transaction;
  return Object.assign(Object.create(ledger), { db: ledger.db, appendEvent: ledger.appendEvent.bind(ledger),
    transaction: (fn) => { const out = tx(fn); trace.push(['commit']); return out; } });
};

test('each Delivery is written in one transaction and acknowledged only after the commit', (t) => {
  const ledger = fixture(t), trace = [];
  const check = fakeCheck([[msg('m1', 'question'), msg('m2', 'heartbeat'), msg('m3', 'status')], [msg('m4', 'worker_done', { outcome: 'succeeded', reportPath: 'r.json' })]], trace);
  const out = drainWorkflowMessages(traced(ledger, trace), WF, { check });
  assert.equal(out.ok, true, out.error);
  assert.deepEqual(trace.slice(0, 5), [['check', RUN, KERNEL, null], ['commit'], ['check', RUN, KERNEL, 'd0'], ['commit'], ['check', RUN, KERNEL, 'd1']],
    'check, commit, then ack; the ack call answers the next Delivery');
  assert.deepEqual([out.deliveries, out.questions, out.messages, out.heartbeats], [2, 1, 2, 1]);
  assert.deepEqual(workerQuestionsOf(ledger.db, WF).pending.map((q) => [q.messageId, q.jobId]), [['m1', JOB]]);
  assert.equal(ledger.db.prepare('SELECT count(*) n FROM events WHERE kind=?').get(ORCHESTRATION_DELIVERY).n, 2);
});

test('a Delivery replayed after a lost ack writes nothing twice', (t) => {
  const ledger = fixture(t), trace = [];
  const batch = [msg('m1', 'question'), msg('m2', 'worker_done', { outcome: 'failed' })];
  const first = drainWorkflowMessages(ledger, WF, { check: fakeCheck([batch], trace, { ackFails: true }) });
  assert.equal(first.ok, false, 'the failed ack is reported');
  const again = drainWorkflowMessages(ledger, WF, { check: fakeCheck([batch], trace) });
  assert.equal(again.ok, true, again.error);
  assert.deepEqual([again.deliveries, again.questions, again.messages], [1, 0, 0], 'the replay is recognised by message id');
  assert.equal(ledger.db.prepare("SELECT count(*) n FROM inbox WHERE kind='worker-question'").get().n, 1);
  assert.equal(workerDoneOf(ledger.db, WF).length, 1);
});

test('worker_done is handed to settlement with its job, outcome and report path', (t) => {
  const ledger = fixture(t), trace = [];
  drainWorkflowMessages(ledger, WF, { check: fakeCheck([[msg('m9', 'worker_done', { outcome: 'succeeded', reportPath: 'D:/w/report.json' })]], trace) });
  assert.deepEqual(workerDoneOf(ledger.db, WF).map(({ messageId, jobId, dispatchId, outcome, reportPath }) => ({ messageId, jobId, dispatchId, outcome, reportPath })),
    [{ messageId: 'm9', jobId: JOB, dispatchId: DISPATCH, outcome: 'succeeded', reportPath: 'D:/w/report.json' }]);
});

test("a consumer_fenced Kernel Run is re-bound once and checked again; another Run is never re-bound", (t) => {
  const ledger = fixture(t), trace = [], rebinds = [];
  let bound = false;
  const base = fakeCheck([[msg('m1', 'question')]], trace);
  const check = (a) => (!bound && a.run === RUN ? (trace.push(['check', a.run, a.terminal, a.ack ?? null]), { ok: false, messages: [], fenced: true, errorCode: 'consumer_fenced', error: 'consumer_fenced' }) : base(a));
  const out = drainWorkflowMessages(ledger, WF, { check, rebind: (runId) => { rebinds.push(runId); bound = true; return { ok: true }; } });
  assert.equal(out.ok, true, out.error);
  assert.deepEqual(rebinds, [RUN]);
  assert.equal(out.questions, 1);

  // A Run of the workflow that is not the Kernel's (an older one) is reported, never taken over.
  ledger.transaction((db) => updateJob(db, { jobId: JOB, payload: { opId: 'code.refactor', managed: { runId: 'run-other', dispatchId: DISPATCH } }, at: Date.now() }));
  const others = [];
  const fenced = drainWorkflowMessages(ledger, WF, { check: fakeCheck([], [], { fenceFor: { run: 'run-other', terminal: KERNEL } }), rebind: (runId) => { others.push(runId); return { ok: true }; } });
  assert.deepEqual(others, []);
  assert.equal(fenced.ok, false);
  assert.deepEqual(fenced.errors.map((e) => [e.runId, e.code]), [['run-other', 'orchestration-consumer-fenced']]);
});

test('an unmatched question is closed by the drain; a matched one stays pending', (t) => {
  const ledger = fixture(t), trace = [];
  const stray = { ...msg('m-stray', 'question'), from_handle: 'term-unknown', payload: JSON.stringify({}) };
  drainWorkflowMessages(ledger, WF, { check: fakeCheck([[msg('m1', 'question'), stray]], trace) });
  const states = Object.fromEntries(workerQuestionsOf(ledger.db, WF).questions.map((q) => [q.messageId, q.state]));
  assert.deepEqual(states, { m1: 'pending', 'm-stray': 'answered' }, 'the unmatched question was closed done');
  assert.equal(JSON.parse(ledger.db.prepare("SELECT disposition_json FROM inbox WHERE key='m-stray'").get().disposition_json).reason, 'unmatched');
});
