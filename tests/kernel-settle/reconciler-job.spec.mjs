// The reconciler's Job controller (lane rc-job): planner, shadow gate, DIs, lane H refusals, the [Worker] sweep.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import job, { planJob, planWorkflow, parseKey, jobFacts, jobSettings, settleDecision, drySweep, dryLedger, workerSweepDeps, listKeysOf, SETTLER_SCRIPT } from '../../scripts/reconciler/controllers/job.mjs';
import { fakeCtx, tempState } from '../../scripts/reconciler/testing.mjs';
import { sweepWorkers } from '../../scripts/supervisor/supervisor-watchdog.mjs';
import { createJob, jobOf } from '../../scripts/supervisor/workers.mjs';
import { openLedger } from '../../engine/db/ledger.mjs';
import { EVENTS } from '../../scripts/kernel/settle/job-settle.mjs';

const settings = jobSettings({ allocation: {} });
const NOW = Date.now() + 5_000;

/** A product ledger with one workflow and one op job; returns {file, dir, db (read-only), add(sql, ...args), event(kind, payload)}. */
function fixture({ status = 'running', payload = {}, report = null, handover = null, updatedAgoMs = 0, events = [] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-job-'));
  const file = path.join(dir, 'runtime.sqlite');
  const ledger = openLedger({ file });
  const at = NOW - updatedAgoMs;
  const sha = (s, n) => crypto.createHash('sha256').update(s).digest('hex').slice(0, n);
  // The current schema (engine/db/schema/runtime.sql): workflows need a trace_id, an op job
  // needs its work unit (jobs_enqueue_guard), and a dispatch row goes in only while the job is 'leased'
  // under a 'running' workflow (op_attempts_dispatch_guard) - then the job walks job_transitions to `status`.
  const needsAttempt = report != null || !['queued', 'ready', 'cancelled'].includes(status);
  ledger.db.prepare("INSERT INTO workflows(workflow_id,trace_id,phase,created_at,updated_at) VALUES('wf-x',?,'running',?,?)").run(sha('wf-x', 32), NOW, NOW);
  ledger.db.prepare("INSERT INTO work_units(workflow_id,unit_id,op_id,subject_key,goal_revision,state,current_job_id,tries,created_at,updated_at) VALUES('wf-x','op-a','code.refactor','op-a',0,'queued','op-a',1,?,?)").run(at, at);
  ledger.db.prepare("INSERT INTO jobs(job_id,workflow_id,unit_id,op_id,try_no,generation,kind,payload_json,status,worker_id,created_at,updated_at) VALUES('op-a','wf-x','op-a','code.refactor',1,0,'op',?,?,'term_1',?,?)")
    .run(JSON.stringify({ owned_paths: ['shop-fe/src/a'], params: { canonFamilies: 'all' }, cut: { id: 'c', ordinal: 2, total: 5 }, ...payload }), needsAttempt ? 'leased' : status, at, at);
  if (needsAttempt) {
    const settled = ['succeeded', 'failed'].includes(status) ? at : null;
    const { lastInsertRowid: attemptId } = ledger.db.prepare(`INSERT INTO op_attempts(workflow_id,job_id,unit_id,op_id,try_no,dispatch_seq,dispatch_id,span_id,
      dispatched_at,started_at,settled_at,end_state) VALUES('wf-x','op-a','op-a','code.refactor',1,1,'ctx_1',?,?,?,?,?)`)
      .run(sha('span:op-a', 16), at, at, settled, settled ? 'settled' : null);
    if (report) {
      ledger.db.prepare("INSERT INTO contracts(attempt_id,workflow_id,job_id,markdown,created_at) VALUES(?,'wf-x','op-a','m',?)").run(attemptId, NOW);
      ledger.db.prepare("INSERT INTO reports(workflow_id,attempt_id,dispatch_id,job_id,outcome,report_json,created_at) VALUES('wf-x',?,'ctx_1','op-a',?,?,?)")
        .run(attemptId, report.outcome ?? 'done', JSON.stringify({ head: 'abc123', checks: [] }), NOW - (report.agoMs ?? 60_000));
    }
    const walk = { leased: [], running: ['running'], answering: ['running', 'answering'], reported: ['running', 'reported'],
      deciding: ['running', 'reported', 'deciding'], succeeded: ['running', 'reported', 'succeeded'],
      failed: ['running', 'failed'], effect_unknown: ['running', 'effect_unknown'] }[status] ?? [];
    for (const next of walk) ledger.db.prepare("UPDATE jobs SET status=? WHERE job_id='op-a'").run(next);
  }
  const ev = (kind, p, ago = 0) => ledger.transaction(() => ledger.appendEvent({ workflowId: 'wf-x', entityType: 'job', entityId: 'op-a', kind, payload: p }));
  if (handover) ev(EVENTS.needsKernel, { dispatchId: 'ctx_1', reason: handover.reason, ...(handover.code ? { code: handover.code } : {}) });
  for (const e of events) ev(e.kind, e.payload);
  ledger.close();
  const db = new DatabaseSync(file, { readOnly: true });
  return { dir, file, db, close: () => { try { db.close(); } catch { /* closed */ } fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }); } };
}
const ledgers = (fx) => [{ ledgerId: 'shop-be', repo: 'shop-be', file: fx.file }];
const ctxFor = (fx, over = {}) => fakeCtx({ controller: 'job', now: () => NOW, ledgers: ledgers(fx), dbs: { 'shop-be': fx.db }, ...over });

test('keys parse and route', () => {
  assert.deepEqual(parseKey('job:shop-be:op-a'), { type: 'job', ledgerId: 'shop-be', id: 'op-a' });
  assert.deepEqual(parseKey('wf:shop-be:wf-x'), { type: 'wf', ledgerId: 'shop-be', id: 'wf-x' });
  assert.equal(parseKey('workers:supervisor').type, 'workers');
  assert.equal(parseKey('nonsense'), null);
  assert.deepEqual(job.routes['op-reported']({ ledgerId: 'n', entityType: 'job', entityId: 'op-a', workflowId: 'wf-x' }), ['job:n:op-a', 'wf:n:wf-x']);
  assert.deepEqual(job.routes['worker-*']({ ledgerId: 'supervisor', entityType: 'job', entityId: 'sup-1' }), ['workers:supervisor']);
  assert.equal(parseKey('overlap:n:42'), null, 'no workflow branch, no overlap key');
  assert.deepEqual(job.concerns, ['job.settle', 'job.worker', 'job.dispatch', 'job.consume-check', 'job.close-verify']);
});

test('a green done report -> exactly one settler run for the job (a would-row in shadow, nothing spawned)', async () => {
  const fx = fixture({ report: { outcome: 'done' } });
  try {
    const ctx = ctxFor(fx);
    const r = await job.reconcile('job:shop-be:op-a', ctx);
    assert.equal(r.action, 'settle'); assert.equal(r.shadow, true);
    assert.equal(ctx.calls.run.length, 1);
    assert.deepEqual(ctx.calls.run[0].args, [SETTLER_SCRIPT, '--repo', 'shop-be', '--job', 'op-a', '--json']);
    assert.equal(ctx.calls.api.length, 0);
    assert.ok(ctx.calls.clock.some((c) => c.state === 'SETTLE_OVERDUE' && c.entity === 'job:shop-be:op-a'));
  } finally { fx.close(); }
});

test('a red report handed to the Kernel -> one settle-nongreen DI, the same key on a second pass', async () => {
  const fx = fixture({ report: { outcome: 'done' }, handover: { reason: 'cut-postcondition-red' } });
  try {
    const ctx = ctxFor(fx);
    await job.reconcile('job:shop-be:op-a', ctx);
    await job.reconcile('job:shop-be:op-a', ctx);
    assert.equal(ctx.calls.decisions.length, 2);
    assert.equal(new Set(ctx.calls.decisions.map((d) => d.idempotencyKey)).size, 1, 'one idempotency key per report: the DI verb dedupes');
    const di = ctx.calls.decisions[0];
    assert.equal(di.kind, 'settle-nongreen'); assert.equal(di.idempotencyKey, 'settle-nongreen:op-a:ctx_1'); assert.equal(di.decider, 'kernel');
    assert.ok(di.dueAt > NOW);
    assert.equal(ctx.calls.run.length, 0, 'never settles a handed-over report itself');
  } finally { fx.close(); }
});

test('a dead worker -> starci kernel reconcile --dead-worker --settle-failed; a held one -> --release-worker', async () => {
  const fx = fixture({ report: null });
  try {
    const dead = ctxFor(fx, { status: () => ({ frontier: { deadWorkerJobs: ['op-a'] } }) });
    await job.reconcile('job:shop-be:op-a', dead);
    assert.deepEqual(dead.calls.api.map((c) => [c.verb, ...c.argv]), [['reconcile', '--job', 'op-a', '--dead-worker', '--settle-failed']]);
    const held = ctxFor(fx, { status: () => ({ frontier: { heldWorkerJobs: ['op-a'] } }) });
    await job.reconcile('job:shop-be:op-a', held);
    assert.deepEqual(held.calls.api.map((c) => [c.verb, ...c.argv]), [['reconcile', '--job', 'op-a', '--release-worker']]);
  } finally { fx.close(); }
});

test('active but not owning the concern -> nothing acts', async () => {
  const fx = fixture({ report: { outcome: 'done' } });
  try {
    const ctx = ctxFor(fx, { mode: 'active', owns: () => false });
    const r = await job.reconcile('job:shop-be:op-a', ctx);
    assert.equal(r.action, 'not-owned'); assert.equal(ctx.calls.run.length, 0);
  } finally { fx.close(); }
});

test('a settled job with a live terminal -> the settler closes it; in active a leftover lesson is recorded', async () => {
  const fx = fixture({ status: 'succeeded', updatedAgoMs: 60_000 });
  try {
    const ctx = ctxFor(fx);
    const r = await job.reconcile('job:shop-be:op-a', ctx);
    assert.equal(r.action, 'close-verify');
    assert.deepEqual(ctx.calls.run[0].args.slice(0, 1), [SETTLER_SCRIPT]);
    assert.ok(ctx.calls.clock.some((c) => c.state === 'WORKER_RELEASE_LEAK'));
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-job-home-'));
    const active = ctxFor(fx, { mode: 'active', env: { ...process.env, STARCI_LOCAL_ROOT: home },
      runResult: () => ({ ok: true, value: { ok: true, results: [{ released: [{ jobId: 'op-a', state: 'released', closedNow: true }] }] } }) });
    try {
      const a = await job.reconcile('job:shop-be:op-a', active);
      assert.equal(a.closedNow, 1);
    } finally { fs.rmSync(home, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }); }
  } finally { fx.close(); }
});

test('a handed-over settle refusal goes to the Kernel as settle-nongreen: no op lands into main, so no land continuation exists', async () => {
  const fx = fixture({ report: { outcome: 'done' }, handover: { reason: 'settle-refused', code: 'op-gate-new-findings' } });
  try {
    const ctx = ctxFor(fx);
    const r = await job.reconcile('job:shop-be:op-a', ctx);
    assert.equal(r.action, 'settle-nongreen');
    assert.equal(ctx.calls.api.filter((c) => c.verb === 'enqueue').length, 0, 'nothing is enqueued for a settle refusal');
  } finally { fx.close(); }
});

test('the workflow pass: dispatch-ready when below allowedParallel, at most once per window; broken imports hold it', async () => {
  assert.equal(planWorkflow({ progress: { running: 2, allowedParallel: 4, queuedReady: 3 } }, { now: NOW, settings }).step.kind, 'dispatch-ready');
  assert.equal(planWorkflow({ progress: { running: 4, allowedParallel: 4, queuedReady: 3 } }, { now: NOW, settings }).step, null);
  assert.equal(planWorkflow({ progress: { running: 1, allowedParallel: 4, queuedReady: 1 } }, { now: NOW, lastDispatchAt: NOW - 10_000, settings }).step, null);
  const status = { progress: { running: 1, allowedParallel: 4, queuedReady: 2, readyJobs: ['op-q'] } };
  const ctx = fakeCtx({ controller: 'job', now: () => NOW, status: { 'n:wf-1': status } });
  await job.reconcile('wf:n:wf-1', ctx);
  await job.reconcile('wf:n:wf-1', ctx);
  assert.deepEqual(ctx.calls.api.map((c) => [c.verb, ...c.argv]), [['dispatch-ready', '--workflow', 'wf-1']]);
  const held = fakeCtx({ controller: 'job', now: () => NOW, status: { 'n:wf-2': { ...status, importsBroken: { count: 3, files: 2, blocksNextWave: true, sample: [] } } } });
  const r = await job.reconcile('wf:n:wf-2', held);
  assert.equal(r.action, 'dispatch-held'); assert.equal(held.calls.api.length, 0);
  assert.equal(held.calls.decisions[0].kind, 'repoint-needed');
});

test('the [Worker] sweep in shadow writes nothing', () => {
  const would = [];
  const d = drySweep({ show: () => ({ ok: true, state: 'ready' }) }, would);
  assert.equal(d.show('ctx_a').ok, true, 'worker-show stays a real read');
  d.stop('ctx_a'); d.release('ctx_a');
  const l = dryLedger({}, would); l.transaction(() => { throw new Error('never runs'); });
  assert.deepEqual(would.map((w) => w.act), ['stop', 'release', 'ledger-write']);
});

test('the live sweep seams answer worker-show/-stop/-release: drySweep drives sweepWorkers and closes a reported job on the would-ledger only', async (t) => {
  const fx = tempState();
  t.after(() => fx.close());
  const { job: j } = createJob(fx.m, { cluster: 'sweep-shadow', files: ['scripts/s.mjs'] });
  fx.m.startSupAttempt({ jobId: j.job_id, agent: 'claude', terminalHandle: 'term_sr' });
  fx.m.setSupJobStatus(j.job_id, 'reported', { payload: { ...j.payload, dispatch: 'ctx_sr' } });
  // The real host seam object carries exactly the seams the sweep calls: worker-show/-stop/-release plus the leftover close.
  const deps = await workerSweepDeps();
  assert.deepEqual(Object.keys(deps).sort(), ['closeLeftover', 'release', 'show', 'stop']);
  const would = [];
  const out = sweepWorkers(dryLedger(fx.m, would), drySweep({ ...deps, show: () => ({ ok: true, state: 'ready' }) }, would));
  assert.deepEqual(out.closed.map((c) => c.jobId), [j.job_id]);
  assert.deepEqual(would.map((w) => w.act), ['stop', 'release', 'ledger-write']);
  const fresh = jobOf(fx.m, j.job_id);
  assert.equal(fresh.status, 'reported');
  assert.equal(fresh.payload.terminalClosed ?? null, null, 'a shadow sweep never marks the live row');
});

test('list: open jobs, recently settled ones and their workflows', () => {
  const fx = fixture({ report: { outcome: 'done' } });
  try {
    assert.deepEqual(listKeysOf(fx.db, 'shop-be', { now: NOW, settings }).sort(), ['job:shop-be:op-a', 'wf:shop-be:wf-x']);
    const di = settleDecision(jobFacts(fx.db, 'op-a', { now: NOW, settings }), 'shop-be', { now: NOW, settings });
    assert.equal(di.schema, 'starci/decision-item@1');
  } finally { fx.close(); }
});

test('a worker question the policy table marks owner-only opens its Decision Item for the owner, any other for the Kernel', async () => {
  const fx = fixture({ status: 'answering' });
  try {
    const questions = [{ jobId: 'op-a', questionId: 'q1', text: 'Which API key should I use for the payment provider?' }, { jobId: 'op-a', questionId: 'q2', text: 'Should the helper live in lib or util?' }];
    const ctx = ctxFor(fx, { status: () => ({ phase: 'running', workerQuestions: questions, frontier: {} }) });
    const r = await job.reconcile('job:shop-be:op-a', ctx);
    assert.equal(r.action, 'questions');
    const byKey = Object.fromEntries(ctx.calls.decisions.map((di) => [di.idempotencyKey, di]));
    assert.equal(byKey['worker-question:op-a:q1'].decider, 'owner');
    assert.equal(byKey['worker-question:op-a:q1'].escalateTo, 'owner');
    assert.equal(byKey['worker-question:op-a:q2'].decider, 'kernel');
    assert.equal(byKey['worker-question:op-a:q2'].escalateTo, 'supervisor');
  } finally { fx.close(); }
});

test('reported-unsettled: a job that filed its report sits in status reported, and the planner settles it, times it and keys it', async () => {
  const fx = fixture({ status: 'reported', report: { outcome: 'done', agoMs: 10 * 60_000 } });
  try {
    assert.equal(jobFacts(fx.db, 'op-a', { now: NOW, settings }).status, 'reported');
    assert.ok(listKeysOf(fx.db, 'shop-be', { now: NOW, settings }).includes('job:shop-be:op-a'), 'the resync lists a reported job');
    const plan = planJob(jobFacts(fx.db, 'op-a', { now: NOW, settings }), { settings });
    assert.equal(plan.step.kind, 'settle');
    assert.ok(plan.clocks.some((c) => c.state === 'SETTLE_OVERDUE'), 'the reported-unsettled bound runs');
    const ctx = ctxFor(fx);
    const r = await job.reconcile('job:shop-be:op-a', ctx);
    assert.equal(r.action, 'settle');
    assert.deepEqual(ctx.calls.run[0].args, [SETTLER_SCRIPT, '--repo', 'shop-be', '--job', 'op-a', '--json']);
    assert.ok(ctx.calls.clock.some((c) => c.state === 'SETTLE_OVERDUE' && c.entity === 'job:shop-be:op-a'));
  } finally { fx.close(); }
});

test('a reported job whose report the settler handed to the Kernel opens one settle-nongreen item, never a second settle', async () => {
  const fx = fixture({ status: 'reported', report: { outcome: 'done' }, handover: { reason: 'settle-refused', code: 'op-gate-tool-failed' } });
  try {
    const ctx = ctxFor(fx);
    const r = await job.reconcile('job:shop-be:op-a', ctx);
    assert.equal(r.action, 'settle-nongreen');
    assert.equal(ctx.calls.run.length, 0);
    assert.equal(ctx.calls.decisions[0].kind, 'settle-nongreen');
  } finally { fx.close(); }
});

test('the filed report is a route of the Job controller', () => {
  assert.deepEqual(job.routes['report-filed']({ ledgerId: 'n', entityType: 'job', entityId: 'op-a', workflowId: 'wf-x' }), ['job:n:op-a', 'wf:n:wf-x']);
});
