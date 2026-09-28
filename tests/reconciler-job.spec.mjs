// The reconciler's Job controller (lane rc-job): planner, shadow gate, DIs, lane H refusals, the [Worker] sweep.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import job, { planJob, planWorkflow, parseKey, jobFacts, jobSettings, enqueueArgvOf, settleDecision, drySweep, dryLedger, listKeysOf, SETTLER_SCRIPT } from '../scripts/reconciler/controllers/job.mjs';
import { fakeCtx } from '../scripts/reconciler/testing.mjs';
import { openLedger } from '../engine/ledger-db.mjs';
import { EVENTS } from '../scripts/reconcile/job-settle.mjs';

const settings = jobSettings({ allocation: {} });
const NOW = Date.now() + 5_000;

/** A product ledger with one workflow and one op job; returns {file, dir, db (read-only), add(sql, ...args), event(kind, payload)}. */
function fixture({ status = 'running', payload = {}, report = null, handover = null, updatedAgoMs = 0, events = [] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-job-'));
  const file = path.join(dir, 'runtime.sqlite');
  const ledger = openLedger({ file });
  const at = NOW - updatedAgoMs;
  ledger.db.prepare("INSERT INTO workflows(workflow_id,created_at,updated_at,phase) VALUES('wf-x',?,?,'running')").run(NOW, NOW);
  ledger.db.prepare("INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,payload_json,status,worker_id,created_at,updated_at) VALUES('op-a','wf-x','code.refactor',1,0,'op',?,?,'term_1',?,?)")
    .run(JSON.stringify({ owned_paths: ['nivo-fe/src/a'], params: { canonFamilies: 'all' }, cut: { id: 'c', ordinal: 2, total: 5 }, ...payload }), status, at, at);
  if (report) {
    ledger.db.prepare("INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,created_at) VALUES('wf-x','code.refactor',1,'ctx_1','m',?)").run(NOW);
    ledger.db.prepare("INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,outcome,report_json,created_at) VALUES('wf-x','ctx_1','code.refactor',1,?,?,?)")
      .run(report.outcome ?? 'done', JSON.stringify({ head: 'abc123', checks: [] }), NOW - (report.agoMs ?? 60_000));
  }
  const ev = (kind, p, ago = 0) => ledger.transaction(() => ledger.appendEvent({ workflowId: 'wf-x', entityType: 'job', entityId: 'op-a', kind, payload: p }));
  if (handover) ev(EVENTS.needsKernel, { dispatchId: 'ctx_1', reason: handover.reason, ...(handover.code ? { code: handover.code } : {}) });
  for (const e of events) ev(e.kind, e.payload);
  ledger.close();
  const db = new DatabaseSync(file, { readOnly: true });
  return { dir, file, db, close: () => { try { db.close(); } catch { /* closed */ } } };
}
const ledgers = (fx) => [{ ledgerId: 'nivo-backend', repo: 'D:/Repositories/nivo-backend', file: fx.file }];
const ctxFor = (fx, over = {}) => fakeCtx({ controller: 'job', now: () => NOW, ledgers: ledgers(fx), dbs: { 'nivo-backend': fx.db }, ...over });

test('keys parse and route', () => {
  assert.deepEqual(parseKey('job:nivo-backend:op-a'), { type: 'job', ledgerId: 'nivo-backend', id: 'op-a' });
  assert.deepEqual(parseKey('wf:nivo-backend:wf-x'), { type: 'wf', ledgerId: 'nivo-backend', id: 'wf-x' });
  assert.equal(parseKey('workers:supervisor').type, 'workers');
  assert.equal(parseKey('nonsense'), null);
  assert.deepEqual(job.routes['op-reported']({ ledgerId: 'n', entityType: 'job', entityId: 'op-a', workflowId: 'wf-x' }), ['job:n:op-a', 'wf:n:wf-x']);
  assert.equal(job.routes['worker-*']({ ledgerId: 'supervisor', entityType: 'job', entityId: 'sup-1' }), 'workers:supervisor');
  assert.equal(job.routes['product-wf-overlap']({ ledgerId: 'n', seq: 42 }), 'overlap:n:42');
  assert.deepEqual(job.concerns, ['job.settle', 'job.worker', 'job.dispatch', 'job.consume-check', 'job.close-verify']);
});

test('a green done report -> exactly one settler run for the job (a would-row in shadow, nothing spawned)', async () => {
  const fx = fixture({ report: { outcome: 'done' } });
  try {
    const ctx = ctxFor(fx);
    const r = await job.reconcile('job:nivo-backend:op-a', ctx);
    assert.equal(r.action, 'settle'); assert.equal(r.shadow, true);
    assert.equal(ctx.calls.run.length, 1);
    assert.deepEqual(ctx.calls.run[0].args, [SETTLER_SCRIPT, '--repo', 'D:/Repositories/nivo-backend', '--job', 'op-a', '--json']);
    assert.equal(ctx.calls.api.length, 0);
    assert.ok(ctx.calls.clock.some((c) => c.state === 'SETTLE_OVERDUE' && c.entity === 'job:nivo-backend:op-a'));
  } finally { fx.close(); }
});

test('a red report handed to the Kernel -> one settle-nongreen DI, the same key on a second pass', async () => {
  const fx = fixture({ report: { outcome: 'done' }, handover: { reason: 'cut-postcondition-red' } });
  try {
    const ctx = ctxFor(fx);
    await job.reconcile('job:nivo-backend:op-a', ctx);
    await job.reconcile('job:nivo-backend:op-a', ctx);
    assert.equal(ctx.calls.decisions.length, 2);
    assert.equal(new Set(ctx.calls.decisions.map((d) => d.idempotencyKey)).size, 1, 'one idempotency key per report: the DI verb dedupes');
    const di = ctx.calls.decisions[0];
    assert.equal(di.kind, 'settle-nongreen'); assert.equal(di.idempotencyKey, 'settle-nongreen:op-a:ctx_1'); assert.equal(di.decider, 'kernel');
    assert.ok(di.dueAt > NOW);
    assert.equal(ctx.calls.run.length, 0, 'never settles a handed-over report itself');
  } finally { fx.close(); }
});

test('a dead worker -> api reconcile --dead-worker --settle-failed; a held one -> --release-worker', async () => {
  const fx = fixture({ report: null });
  try {
    const dead = ctxFor(fx, { status: () => ({ frontier: { deadWorkerJobs: ['op-a'] } }) });
    await job.reconcile('job:nivo-backend:op-a', dead);
    assert.deepEqual(dead.calls.api.map((c) => [c.verb, ...c.argv]), [['reconcile', '--job', 'op-a', '--dead-worker', '--settle-failed']]);
    const held = ctxFor(fx, { status: () => ({ frontier: { heldWorkerJobs: ['op-a'] } }) });
    await job.reconcile('job:nivo-backend:op-a', held);
    assert.deepEqual(held.calls.api.map((c) => [c.verb, ...c.argv]), [['reconcile', '--job', 'op-a', '--release-worker']]);
  } finally { fx.close(); }
});

test('active but not owning the concern -> nothing acts', async () => {
  const fx = fixture({ report: { outcome: 'done' } });
  try {
    const ctx = ctxFor(fx, { mode: 'active', owns: () => false });
    const r = await job.reconcile('job:nivo-backend:op-a', ctx);
    assert.equal(r.action, 'not-owned'); assert.equal(ctx.calls.run.length, 0);
  } finally { fx.close(); }
});

test('a settled job with a live terminal -> the settler closes it; in active a leftover lesson is recorded', async () => {
  const fx = fixture({ status: 'succeeded', updatedAgoMs: 60_000 });
  try {
    const ctx = ctxFor(fx);
    const r = await job.reconcile('job:nivo-backend:op-a', ctx);
    assert.equal(r.action, 'close-verify');
    assert.deepEqual(ctx.calls.run[0].args.slice(0, 1), [SETTLER_SCRIPT]);
    assert.ok(ctx.calls.clock.some((c) => c.state === 'WORKER_RELEASE_LEAK'));
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-job-home-'));
    const active = ctxFor(fx, { mode: 'active', env: { ...process.env, STARCI_SUPERVISOR_HOME: home, LOCALAPPDATA: home },
      runResult: () => ({ ok: true, value: { ok: true, results: [{ released: [{ jobId: 'op-a', state: 'released', closedNow: true }] }] } }) });
    const a = await job.reconcile('job:nivo-backend:op-a', active);
    assert.equal(a.closedNow, 1);
  } finally { fx.close(); }
});

test('worktree-removed: the clock runs while the folder exists, the reap retries until the event, a gone folder counts', async () => {
  const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-job-wt-'));
  const live = fixture({ status: 'succeeded', updatedAgoMs: 10_000, payload: { productWorktree: { op: { path: wt } }, terminalClosed: { verified: { ok: true } } },
    events: [{ kind: EVENTS.released, payload: { proof: 'x' } }, { kind: 'job-worktree-remove-failed', payload: { reason: 'remove-failed' } }] });
  try {
    const ctx = ctxFor(live);
    const r = await job.reconcile('job:nivo-backend:op-a', ctx);
    assert.equal(r.action, 'worktree-reap', 'a failed removal is retried');
    assert.deepEqual(ctx.calls.run[0].args.slice(0, 2), ['scripts/kernel/product-worktree.mjs', 'reap']);
    assert.ok(ctx.calls.clock.some((c) => c.state === 'WORKTREE_REMOVE_OVERDUE' && c.slaMs === 60_000));
  } finally { live.close(); fs.rmSync(wt, { recursive: true, force: true }); }
  // The folder went later (op-code.refactor-b966ced588): removed, the clock clears, the reap still writes the event.
  const gone = fixture({ status: 'succeeded', updatedAgoMs: 2 * 3_600_000, payload: { productWorktree: { op: { path: wt } }, terminalClosed: { verified: { ok: true } } },
    events: [{ kind: EVENTS.released, payload: {} }, { kind: 'job-worktree-remove-failed', payload: {} }] });
  try {
    const ctx = ctxFor(gone);
    assert.ok(listKeysOf(gone.db, 'nivo-backend', { now: NOW, settings }).includes('job:nivo-backend:op-a'), 'listed past the settled window while the event is owed');
    const r = await job.reconcile('job:nivo-backend:op-a', ctx);
    assert.equal(r.action, 'worktree-reap');
    assert.ok(!ctx.calls.clock.some((c) => c.state === 'WORKTREE_REMOVE_OVERDUE'));
    assert.ok(ctx.calls.clear.some((c) => c.state === 'WORKTREE_REMOVE_OVERDUE'));
  } finally { gone.close(); }
  const done = fixture({ status: 'succeeded', updatedAgoMs: 2 * 3_600_000, payload: { productWorktree: { op: { path: wt } } },
    events: [{ kind: EVENTS.released, payload: {} }, { kind: 'job-worktree-removed', payload: {} }] });
  try {
    const ctx = ctxFor(done);
    assert.ok(!listKeysOf(done.db, 'nivo-backend', { now: NOW, settings }).includes('job:nivo-backend:op-a'));
    assert.ok(listKeysOf(done.db, 'nivo-backend', { now: NOW, settings, openClockJobs: ['op-a'] }).includes('job:nivo-backend:op-a'), 'an open clock lists the job');
    const r = await job.reconcile('job:nivo-backend:op-a', ctx);
    assert.equal(r.action, 'idle');
    for (const state of ['WORKTREE_REMOVE_OVERDUE', 'WORKER_RELEASE_LEAK', 'WORKER_STALLED']) assert.ok(ctx.calls.clear.some((c) => c.state === state), state);
  } finally { done.close(); }
});

test('product-integrate-red -> a continuation enqueued from the refused head; the cap hands it to the Kernel', async () => {
  const fx = fixture({ report: { outcome: 'done' }, handover: { reason: 'settle-refused', code: 'product-integrate-red' },
    events: [{ kind: 'product-integrate-refused', payload: { reason: 'product-integrate-red', continuation: { base: 'wf/x', resumeFrom: 'def456' } } }] });
  try {
    const ctx = ctxFor(fx);
    const r = await job.reconcile('job:nivo-backend:op-a', ctx);
    assert.equal(r.action, 'continuation');
    const call = ctx.calls.api[0];
    assert.equal(call.verb, 'enqueue');
    const argv = call.argv;
    assert.equal(argv[argv.indexOf('--retry-of') + 1], 'op-a');
    assert.equal(JSON.parse(argv[argv.indexOf('--params') + 1]).resumeFrom, 'def456');
    assert.equal(argv[argv.indexOf('--cut-ordinal') + 1], '2');
    assert.equal(ctx.calls.decisions.length, 0);
    const f = jobFacts(fx.db, 'op-a', { now: NOW, settings });
    const capped = planJob({ ...f, continuations: settings.continuationCap }, { settings });
    assert.equal(capped.step.kind, 'settle-nongreen');
    assert.equal(planJob({ ...f, successor: 'op-b' }, { settings }).step.kind, 'settle-nongreen', 'an enqueued continuation is not enqueued again');
  } finally { fx.close(); }
});

test('deps-unit-required -> the deps unit is enqueued with the manifest files under the repository prefix', () => {
  const f = { jobId: 'op-a', workflowId: 'wf-x', op: 'code.refactor', payload: { owned_paths: ['nivo-fe/src/a'], params: { canonFamilies: 'all' } } };
  const argv = enqueueArgvOf(f, { kind: 'deps-unit', files: ['package.json', 'package-lock.json'] });
  assert.equal(argv[argv.indexOf('--paths') + 1], 'nivo-fe/package.json,nivo-fe/package-lock.json');
  assert.equal(JSON.parse(argv[argv.indexOf('--params') + 1]).depsUnit, true);
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

test('a product-wf-overlap event -> a cross-workflow DI for the Supervisor', async () => {
  const fx = fixture({ events: [{ kind: 'product-wf-overlap', payload: { branch: 'wf/x', files: ['src/a.ts'], main: 'm1' } }] });
  try {
    const seq = fx.db.prepare("SELECT seq FROM events WHERE kind='product-wf-overlap'").get().seq;
    const ctx = ctxFor(fx);
    await job.reconcile(`overlap:nivo-backend:${seq}`, ctx);
    const di = ctx.calls.decisions[0];
    assert.equal(di.kind, 'product-wf-overlap'); assert.equal(di.decider, 'supervisor'); assert.equal(di.idempotencyKey, 'product-wf-overlap:wf-x:m1');
  } finally { fx.close(); }
});

test('the [Worker] sweep in shadow writes nothing', () => {
  const would = [];
  const d = drySweep({ verdict: () => ({ verdict: 'dead' }), screen: () => null, exitedRow: () => false }, would);
  assert.equal(d.close('t').ok, false); d.quit('t'); d.closeExited('t');
  const l = dryLedger({}, would); l.transaction(() => { throw new Error('never runs'); });
  assert.deepEqual(would.map((w) => w.act), ['close', 'quit', 'close-exited', 'ledger-write']);
});

test('list: open jobs, recently settled ones and their workflows', () => {
  const fx = fixture({ report: { outcome: 'done' } });
  try {
    assert.deepEqual(listKeysOf(fx.db, 'nivo-backend', { now: NOW, settings }).sort(), ['job:nivo-backend:op-a', 'wf:nivo-backend:wf-x']);
    const di = settleDecision(jobFacts(fx.db, 'op-a', { now: NOW, settings }), 'nivo-backend', { now: NOW, settings });
    assert.equal(di.schema, 'starci/decision-item@1');
  } finally { fx.close(); }
});
