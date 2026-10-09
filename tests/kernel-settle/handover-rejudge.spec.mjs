// A reported job the settler handed to the Kernel under an older runtime revision is judged again by the settler, once per revision.
// The state is the one the live Nivo ledger held on 2026-10-09 (architecture.decide reported done 34 hours earlier, handed over as
// check-not-reverifiable because its `starci work graph validate` check was classed foreign, its admitted tree lost and put back).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { openLedger, ledgerFileFor, openIncident } from '../../engine/db/ledger.mjs';
import { releaseEndedGates, pendingRejudgeOf, HOLDS_SETTLED_REASON, HOLDS_SETTLED_EVENT } from '../../scripts/kernel/gate-holds-ended.mjs';
import { planJob, jobFacts, jobSettings } from '../../scripts/reconciler/controllers/job.mjs';
import { attemptFacts } from '../../scripts/reconciler/debug-digest-ledger.mjs';
import { classifyCheck, reconcileJobSettle, EVENTS } from '../../scripts/kernel/settle/job-settle.mjs';
import { PLACEMENT_REBOUND } from '../../scripts/machine/placement-rebound.mjs';
import { currentRuntimeRev } from '../../scripts/kernel/runtime-rev.mjs';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';

const settings = jobSettings({ allocation: {} });
const NOW = Date.now() + 5_000;
const LIVE_REV = 'b'.repeat(40);
const sha = (text, n) => crypto.createHash('sha256').update(text).digest('hex').slice(0, n);
const GRAPH_CHECK = 'starci work graph validate --repo work/nivo-monorepo --workflow wf-nivo-auth --version 1';

/** One workflow, one op job reported done, one handover event; `handover` is the payload of the needs-kernel event. */
function reportedFixture(handover, outcome = 'done') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-rejudge-'));
  const file = path.join(dir, 'runtime.sqlite');
  const ledger = openLedger({ file });
  ledger.db.prepare("INSERT INTO workflows(workflow_id,trace_id,phase,created_at,updated_at) VALUES('wf-x',?,'running',?,?)").run(sha('wf-x', 32), NOW, NOW);
  ledger.db.prepare("INSERT INTO work_units(workflow_id,unit_id,op_id,subject_key,goal_revision,state,current_job_id,tries,created_at,updated_at) VALUES('wf-x','op-a','architecture.decide','op-a',0,'queued','op-a',1,?,?)").run(NOW, NOW);
  ledger.db.prepare("INSERT INTO jobs(job_id,workflow_id,unit_id,op_id,try_no,generation,kind,payload_json,status,worker_id,created_at,updated_at) VALUES('op-a','wf-x','op-a','architecture.decide',1,0,'op','{}','leased','term_1',?,?)").run(NOW, NOW);
  const { lastInsertRowid: attemptId } = ledger.db.prepare(`INSERT INTO op_attempts(workflow_id,job_id,unit_id,op_id,try_no,dispatch_seq,dispatch_id,span_id,dispatched_at,started_at,worktree_path)
    VALUES('wf-x','op-a','op-a','architecture.decide',1,1,'ctx_1',?,?,?,?)`).run(sha('span', 16), NOW, NOW, path.join(dir, 'lost-tree'));
  ledger.db.prepare("INSERT INTO contracts(attempt_id,workflow_id,job_id,markdown,created_at) VALUES(?,'wf-x','op-a','m',?)").run(attemptId, NOW);
  ledger.db.prepare("INSERT INTO reports(workflow_id,attempt_id,dispatch_id,job_id,outcome,report_json,created_at) VALUES('wf-x',?,'ctx_1','op-a',?,?,?)")
    .run(attemptId, outcome, JSON.stringify({ head: 'abc', checks: [{ name: 'work-graph-validate', command: GRAPH_CHECK, exitCode: 0 }] }), NOW - 60_000);
  for (const next of ['running', 'reported']) ledger.db.prepare('UPDATE jobs SET status=? WHERE job_id=?').run(next, 'op-a');
  const event = (kind, payload, entityType = 'job', entityId = 'op-a') => ledger.transaction(() => ledger.appendEvent({ workflowId: 'wf-x', entityType, entityId, attemptId, kind, payload }));
  if (handover) event(EVENTS.needsKernel, { dispatchId: 'ctx_1', ...handover });
  ledger.close();
  const opened = [];
  const read = () => { const handle = new DatabaseSync(file, { readOnly: true }); opened.push(handle); return handle; };
  return { dir, file, attemptId, read, close: () => { for (const handle of opened) { try { handle.close(); } catch { /* closed */ } } fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }); } };
}

const stepOf = (fx, over = {}) => planJob(jobFacts(fx.read(), 'op-a', { now: NOW, settings, runtimeRev: LIVE_REV, ...over }), { settings }).step;

test('`starci work graph validate|show|diff` is a check the settler re-runs; propose is not', () => {
  const root = path.resolve('.');
  const check = classifyCheck({ name: 'work-graph-validate', command: GRAPH_CHECK, exitCode: 0 }, { skillRoot: root });
  assert.equal(check.kind, 'runtime');
  assert.equal(check.rel, 'scripts/work/work-graph.mjs');
  assert.deepEqual(check.argv.slice(0, 3), ['validate', '--repo', 'work/nivo-monorepo']);
  for (const action of ['show', 'diff']) assert.equal(classifyCheck({ command: `starci work graph ${action} --repo r --workflow w` }, { skillRoot: root }).kind, 'runtime');
  assert.equal(classifyCheck({ command: 'starci work graph propose --repo r --job j --file f --reason why' }, { skillRoot: root }).kind, 'foreign');
});

test('a handover recorded before revisions were named, or under another revision, is judged again by the settler', (t) => {
  for (const handover of [{ reason: 'check-not-reverifiable', detail: ['work-graph-validate:not-a-runtime-check'] }, { reason: 'check-not-reverifiable', runtimeRev: 'a'.repeat(40) }]) {
    const fx = reportedFixture(handover);
    t.after(fx.close);
    const step = stepOf(fx);
    assert.equal(step.kind, 'settle', JSON.stringify(step));
    assert.equal(step.rejudge, true);
  }
});

test('a handover recorded under the live revision stays the Kernel decision; an unreadable revision judges nothing again', (t) => {
  const fx = reportedFixture({ reason: 'check-not-reverifiable', runtimeRev: LIVE_REV });
  t.after(fx.close);
  assert.equal(stepOf(fx).kind, 'settle-nongreen');
  assert.equal(stepOf(fx, { runtimeRev: null }).kind, 'settle-nongreen');
});

test('only a done report is judged again: a blocked report handed over stays the Kernel decision', (t) => {
  const fx = reportedFixture({ reason: 'outcome-blocked' }, 'blocked');
  t.after(fx.close);
  assert.equal(stepOf(fx).kind, 'settle-nongreen');
});

test('the digest reads an attempt through its placement-rebound: a tree put back at another path is not lost', (t) => {
  const fx = reportedFixture({ reason: 'check-not-reverifiable' });
  t.after(fx.close);
  const lost = path.join(fx.dir, 'lost-tree'), standing = path.join(fx.dir, 'standing-tree');
  fs.mkdirSync(standing);
  assert.equal(attemptFacts(fx.read(), 'wf-x')[0].treeExists, false, 'the admitted path is gone');
  const writable = openLedger({ file: fx.file });
  writable.transaction(() => writable.appendEvent({ workflowId: 'wf-x', entityType: 'attempt', entityId: String(fx.attemptId), attemptId: fx.attemptId, kind: PLACEMENT_REBOUND,
    payload: { jobId: 'op-a', attemptId: fx.attemptId, from: [lost], to: standing, arm: 'rebind', reason: 'tree-reattached' } }));
  writable.close();
  assert.equal(attemptFacts(fx.read(), 'wf-x')[0].treeExists, true, 'the rebound tree stands for the admitted one');
});

test('the settler records its handover with the revision it judged under, once per revision', async (t) => withLedger(t, async ({ repoRoot, ledger }) => {
  seedWorkflow(ledger, { id: 'wf-y', goal: { revision: 1, markdown: '# y' }, jobs: [{ jobId: 'op-y', opId: 'architecture.decide', status: 'reported', payload: { opId: 'architecture.decide', owned_paths: [] } }] });
  const attemptId = ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get('op-y').attempt_id;
  const dispatchId = ledger.db.prepare('SELECT dispatch_id FROM op_attempts WHERE attempt_id=?').get(attemptId).dispatch_id;
  ledger.db.prepare("INSERT INTO contracts(attempt_id,workflow_id,job_id,markdown,created_at) VALUES(?,'wf-y','op-y','m',?)").run(attemptId, Date.now());
  ledger.db.prepare("INSERT INTO reports(workflow_id,attempt_id,dispatch_id,job_id,outcome,report_json,created_at) VALUES('wf-y',?,?,'op-y','done',?,?)")
    .run(attemptId, dispatchId, JSON.stringify({ head: 'abc', checks: [{ name: 'c', command: 'echo x', exitCode: 0 }] }), Date.now() - 60_000);
  // A handover of an older settler: the same reason, no revision.
  ledger.transaction(() => ledger.appendEvent({ workflowId: 'wf-y', entityType: 'job', entityId: 'op-y', attemptId, kind: EVENTS.needsKernel, payload: { dispatchId, reason: 'check-not-reverifiable' } }));
  ledger.close();
  const verify = async () => ({ green: false, reason: 'check-not-reverifiable', detail: ['c:not-a-runtime-check'] });
  const pass = () => reconcileJobSettle({ repo: repoRoot, jobId: 'op-y', verify, locks: false, api: () => ({ ok: true }) });
  const handovers = () => {
    const reader = new DatabaseSync(ledgerFileFor(repoRoot), { readOnly: true });
    try { return reader.prepare("SELECT payload_json FROM events WHERE kind=? AND entity_id='op-y' ORDER BY seq").all(EVENTS.needsKernel).map((row) => JSON.parse(row.payload_json)); } finally { reader.close(); }
  };
  const first = await pass();
  assert.equal(first.errors.length, 0, JSON.stringify(first.errors));
  assert.equal(first.kernel[0].recorded, true, 'the older handover does not stand for this revision');
  assert.equal(handovers().at(-1).runtimeRev, currentRuntimeRev());
  const second = await pass();
  assert.equal(second.kernel[0].recorded, false, 'the same reason under the same revision is recorded once');
  assert.equal(handovers().length, 2);
}));

test('the settle that ends the last job a supervisor-gate holds closes the gate', async (t) => withLedger(t, ({ ledger }) => {
  const OP = 'architecture.decide';
  seedWorkflow(ledger, { id: 'wf-g', goal: { revision: 1, markdown: '# g' }, jobs: [{ jobId: 'op-held', opId: OP, status: 'succeeded', payload: { opId: OP, owned_paths: [] } }] });
  const gate = (id, holds) => {
    openIncident(ledger.db, { incidentId: id, workflowId: 'wf-g', kind: 'supervisor-gate', opId: OP, detail: 'settle refused', lastProgress: '[supervisor-gate] settle refused' });
    ledger.transaction(() => ledger.appendEvent({ workflowId: 'wf-g', entityType: 'incident', entityId: id, kind: 'incident-raised', payload: { kind: 'supervisor-gate', detail: 'settle refused', opId: OP, holds } }));
  };
  gate('inc-wild', ['*']);
  gate('inc-job', ['op-held']);
  gate('inc-other', ['op-not-in-this-ledger']);
  const closed = ledger.transaction(() => releaseEndedGates(ledger.db, 'wf-g'));
  assert.deepEqual(closed, ['inc-job'], 'only the gate whose held job is settled closes');
  const row = ledger.db.prepare("SELECT status, resolved_reason FROM incidents WHERE incident_id='inc-job'").get();
  assert.deepEqual([row.status, row.resolved_reason], ['resolved', HOLDS_SETTLED_REASON]);
  assert.equal(ledger.db.prepare("SELECT count(*) n FROM events WHERE entity_id='inc-job' AND kind=?").get(HOLDS_SETTLED_EVENT).n, 1, 'the incident says why it closed');
  assert.equal(ledger.db.prepare("SELECT status FROM incidents WHERE incident_id='inc-wild'").get().status, 'open');
  seedWorkflow(ledger, { id: 'wf-g', jobs: [{ jobId: 'op-retry', opId: OP, status: 'queued', tryNo: 1, payload: { opId: OP, owned_paths: [] } }] });
  gate('inc-retry', ['op-held', OP]);
  assert.deepEqual(ledger.transaction(() => releaseEndedGates(ledger.db, 'wf-g')), [], 'a queued job of the held op keeps the gate');
}));

/** The Nivo state of 2026-10-09: architecture.decide reported done, handed over by an older runtime, held by an open supervisor-gate. */
function gatedWorld(ledger, { jobId = 'op-gated', opId = 'architecture.decide' } = {}) {
  seedWorkflow(ledger, { id: 'wf-n', goal: { revision: 1, markdown: '# n' }, jobs: [{ jobId, opId, status: 'reported', payload: { opId, owned_paths: [] } }] });
  const { attempt_id: attemptId, dispatch_id: dispatchId } = ledger.db.prepare('SELECT attempt_id, dispatch_id FROM op_attempts WHERE job_id=?').get(jobId);
  ledger.db.prepare("INSERT INTO contracts(attempt_id,workflow_id,job_id,markdown,created_at) VALUES(?,'wf-n',?,'m',?)").run(attemptId, jobId, Date.now());
  ledger.db.prepare("INSERT INTO reports(workflow_id,attempt_id,dispatch_id,job_id,outcome,report_json,created_at) VALUES('wf-n',?,?,?,'done',?,?)")
    .run(attemptId, dispatchId, jobId, JSON.stringify({ head: 'abc', checks: [{ name: 'c', command: 'echo x', exitCode: 0 }] }), Date.now() - 60_000);
  openIncident(ledger.db, { incidentId: 'inc-gate', workflowId: 'wf-n', kind: 'supervisor-gate', opId, detail: 'settle refused op-gate-tool-failed: owned slice cannot be bound', lastProgress: '[supervisor-gate] settle refused' });
  ledger.transaction(() => {
    ledger.appendEvent({ workflowId: 'wf-n', entityType: 'incident', entityId: 'inc-gate', kind: 'incident-raised', payload: { kind: 'supervisor-gate', opId, holds: [jobId] } });
    ledger.appendEvent({ workflowId: 'wf-n', entityType: 'job', entityId: jobId, attemptId, kind: EVENTS.needsKernel, payload: { dispatchId, reason: 'settle-refused', code: 'op-gate-tool-failed', outcome: 'done', op: opId } });
  });
  return { dispatchId };
}

const incidentRow = (ledger) => ledger.db.prepare("SELECT status, resolved_reason FROM incidents WHERE incident_id='inc-gate'").get();
const incidentEvents = (ledger, kind) => ledger.db.prepare("SELECT payload_json FROM events WHERE entity_id='inc-gate' AND kind=?").all(kind).map((row) => JSON.parse(row.payload_json));

test('a green judgment under a new revision settles the job and resolves the gate it was held by, as the runtime with the revision as proof', async (t) => withLedger(t, async ({ repoRoot, ledger, ledgerFile }) => {
  gatedWorld(ledger);
  ledger.close();
  const settle = (args) => {
    if (args[0] !== 'settle') return { ok: true };
    const writer = openLedger({ file: ledgerFile });
    try { writer.db.prepare("UPDATE jobs SET status='succeeded' WHERE job_id='op-gated'").run(); } finally { writer.close(); }
    return { ok: true, value: { status: 'succeeded' } };
  };
  const out = await reconcileJobSettle({ repo: repoRoot, jobId: 'op-gated', verify: async () => ({ green: true, via: 'declared' }), locks: false, api: settle });
  assert.equal(out.errors.length, 0, JSON.stringify(out.errors));
  assert.equal(out.settled.length, 1);
  const reader = openLedger({ file: ledgerFile });
  const [proof] = incidentEvents(reader, 'gate-holds-settled');
  const row = incidentRow(reader);
  reader.close();
  assert.deepEqual([row.status, row.resolved_reason], ['resolved', 'fixed']);
  assert.equal(proof.by, 'runtime');
  assert.equal(proof.resolution, 'fixed');
  assert.equal(proof.proof.runtimeRev, currentRuntimeRev(), 'the revision that judged is the proof');
}));

test('a red judgment leaves the gate open and puts the evidence on it, once per revision and reason', async (t) => withLedger(t, async ({ repoRoot, ledger, ledgerFile }) => {
  gatedWorld(ledger);
  ledger.close();
  const verify = async () => ({ green: false, reason: 'settle-refused', code: 'op-gate-tool-failed', detail: ['op-gate-tool-failed'] });
  for (let pass = 0; pass < 2; pass += 1) await reconcileJobSettle({ repo: repoRoot, jobId: 'op-gated', verify, locks: false, api: () => ({ ok: true }) });
  const reader = openLedger({ file: ledgerFile });
  const status = incidentRow(reader).status;
  const noted = incidentEvents(reader, 'gate-rejudged');
  reader.close();
  assert.equal(status, 'open');
  assert.equal(noted.length, 1);
  assert.deepEqual([noted[0].jobId, noted[0].reason, noted[0].runtimeRev], ['op-gated', 'settle-refused', currentRuntimeRev()]);
}));

test('a workaround that would dispatch a finished leg again waits for the runtime judgment of its done report under the live revision (Nivo sdi-3c462f95)', async (t) => withLedger(t, async ({ ledger }) => {
  gatedWorld(ledger);
  const gate = { incidentId: 'inc-gate', holds: ['op-gated'], opId: 'architecture.decide' };
  assert.deepEqual(pendingRejudgeOf(ledger.db, 'wf-n', gate, { runtimeRev: 'f'.repeat(40) }), ['op-gated'], 'judged under an older revision: pending');
  assert.deepEqual(pendingRejudgeOf(ledger.db, 'wf-n', gate, { runtimeRev: null }), [], 'no live revision known: nothing to wait for');
  ledger.transaction(() => ledger.appendEvent({ workflowId: 'wf-n', entityType: 'job', entityId: 'op-gated', kind: EVENTS.needsKernel,
    payload: { dispatchId: ledger.db.prepare('SELECT dispatch_id FROM op_attempts WHERE job_id=?').get('op-gated').dispatch_id, reason: 'settle-refused', runtimeRev: 'f'.repeat(40) } }));
  assert.deepEqual(pendingRejudgeOf(ledger.db, 'wf-n', gate, { runtimeRev: 'f'.repeat(40) }), [], 'judged under the live revision and handed back red: the workaround may be answered');
}));
