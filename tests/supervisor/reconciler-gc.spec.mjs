// reconciler-gc.spec.mjs — the reconciler GC controller (scripts/reconciler/controllers/gc.mjs) and gc.mjs's new
// collectors (leases, lanelogs) and host lock. Pure: every host seam is injected; nothing touches Orca, git, the
// ledgers or the lanes root.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createGcController, parseKey, ROUTES } from '../../scripts/reconciler/controllers/gc.mjs';
import { classifyLeases, planLaneLogs, collectLaneLogs, runGc, COLLECTORS } from '../../scripts/supervisor/gc.mjs';

import { fakeCtx } from '../../scripts/reconciler/testing.mjs';
const T = 2_000_000_000_000;
const REPO = 'D:/Repositories/todo-app-be';

/** A ctx per the reconciler contract (lane A testing.mjs fakeCtx shape), recording every actuator call. */
function ctxOf(mode, extra = {}) {
  const calls = { run: [], api: [], log: [], decisions: [], clocks: [] };
  const ctx = fakeCtx({
    mode, now: () => T, ledgers: [{ ledgerId: 'todo-app-be', repo: REPO, file: `${REPO}/.starci/ledger.sqlite` }, { ledgerId: 'supervisor', repo: null, file: null }],
    read: () => null, status: () => null,
    api: async (...a) => { calls.api.push(a); return mode === 'active' ? { ok: true } : { ok: true, shadow: true }; },
    run: async (...a) => { calls.run.push(a); return mode === 'active' ? { ok: true } : { ok: true, shadow: true }; },
    clock: (...a) => calls.clocks.push(['clock', ...a]), clear: (...a) => calls.clocks.push(['clear', ...a]),
    openDecision: async (di) => { calls.decisions.push(di); return { ok: true }; },
    log: (kind, msg, data) => calls.log.push({ kind, msg, data }), owns: () => mode === 'active', ...extra,
  });
  return { ctx, calls };
}

const view = ({ status = 'succeeded', updatedAt = T - 5 * 60_000, leases = [] } = {}) => ({
  repo: REPO, workflows: [{ workflowId: 'wf-1', name: 'Nivo · One', ended: false, kernelHandle: 'term_k' }],
  jobs: [{ jobId: 'op-1', workflowId: 'wf-1', kind: 'op', status, handles: ['term_op'], updatedAt },
    { jobId: 'kernel-wf-1', workflowId: 'wf-1', kind: 'kernel', status: 'running', handles: ['term_k'], updatedAt: T - 3_600_000 }],
  leases,
});
const listed = { ok: true, terminals: [{ handle: 'term_op', title: '[Op] code.refactor · Nivo · One', connected: true, worktreePath: REPO },
  { handle: 'term_k', title: '[Kernel] Nivo · One', connected: true, worktreePath: REPO }], visualLayouts: [] };

function controller(extra = {}) {
  const lessons = [];
  const c = createGcController({ ledgerView: () => extra.view ?? view(), list: async () => listed, read: async () => () => ({ ok: true, screen: '' }),
    workers: async () => ({ ok: true, workers: [] }), lesson: async (a) => { lessons.push(a); return a; }, ...extra.deps });
  return { c, lessons };
}

test('routes: the six entity events key one entity each; land-failed and a lane land key nothing', () => {
  assert.equal(ROUTES['op-settled']({ kind: 'op-settled', ledgerId: 'todo-app-be', entityType: 'job', entityId: 'op-1' }), 'gc:job:todo-app-be:op-1');
  assert.equal(ROUTES['worker-released-on-report']({ ledgerId: 'todo-app-be', entityType: 'job', entityId: 'op-1' }), 'gc:job:todo-app-be:op-1');
  assert.equal(ROUTES['workflow-finished']({ ledgerId: 'todo-app-be', workflowId: 'wf-1' }), 'gc:workflow:todo-app-be:wf-1');
  assert.equal(ROUTES['kernel-stale-cleared']({ ledgerId: 'todo-app-be', workflowId: 'wf-1' }), 'gc:workflow:todo-app-be:wf-1');
  assert.equal(ROUTES['land-passed']({ kind: 'land-passed', ledgerId: 'supervisor', payload: { jobId: 'fix-a-123456' } }), 'gc:land:fix-a-123456');
  assert.equal(ROUTES['land-passed']({ kind: 'land-passed', ledgerId: 'supervisor', payload: { jobId: null, lane: 'lane/x' } }), null);
  for (const k of ['op-settled', 'worker-released', 'kernel-stale-cleared', 'land-succeeded', 'workflow-finished', 'workflow-archived']) assert.equal(typeof ROUTES[k], 'function', k);
  assert.deepEqual(parseKey('gc:job:todo-app-be:op-code.refactor-1'), { type: 'job', ledgerId: 'todo-app-be', id: 'op-code.refactor-1' });
  assert.deepEqual(parseKey('gc:sweep'), { type: 'sweep' });
});

test('op-settled with its [Op] terminal still live: a verified close and a leftover lesson (active)', async () => {
  const { c, lessons } = controller();
  const { ctx, calls } = ctxOf('active');
  const r = await c.reconcile('gc:job:todo-app-be:op-1', ctx);
  assert.equal(r.closes.length, 1);
  assert.equal(calls.run.length, 1);
  const [cmd, args] = calls.run[0];
  assert.equal(cmd, 'node');
  assert.deepEqual(args.slice(0, 3), ['scripts/machine/close-verify.mjs', '--terminal', 'term_op']);
  assert.ok(args.includes('--tree'), 'the close counts only when the process tree is gone');
  assert.equal(lessons.length, 1);
  assert.equal(lessons[0].klass, 'op-worker');
  assert.ok(!calls.run.some(([, a]) => a.includes('term_k')), 'the live Kernel seat is never closed');
});

test('op-settled in shadow: the close goes through the gate as a would, no lesson', async () => {
  const { c, lessons } = controller();
  const { ctx, calls } = ctxOf('shadow');
  await c.reconcile('gc:job:todo-app-be:op-1', ctx);
  assert.equal(calls.run.length, 1, 'the engine gate records it as reconciler.would');
  assert.equal(lessons.length, 0);
});

test('an event inside the grace window waits for the owner step; a live job is left alone', async () => {
  const { ctx, calls } = ctxOf('active');
  const young = controller({ view: view({ updatedAt: T - 5_000 }) }).c;
  // MB-14: a wait, not a failure: requeued for the rest of the grace window plus a margin, never a full grace.
  const waited = await young.reconcile('gc:job:todo-app-be:op-1', ctx);
  assert.equal(waited.waiting, true);
  assert.equal(waited.requeueAfterMs, 60_000 - 5_000 + 5_000);
  const live = controller({ view: view({ status: 'running' }) }).c;
  assert.match((await live.reconcile('gc:job:todo-app-be:op-1', ctx)).skipped, /running/);
  assert.equal(calls.run.length, 0);
});

test('a settled job still holding a lease: reported and a runtime-defect DI, never deleted', async () => {
  const leases = [{ resourceKey: 'path:src/a.ts', jobId: 'op-1', workflowId: 'wf-1', acquiredAt: T - 600_000, expiresAt: T + 60_000, jobStatus: 'succeeded', jobUpdatedAt: T - 300_000, phase: 'build' }];
  const { c } = controller({ view: view({ leases }) });
  const { ctx, calls } = ctxOf('shadow');
  const r = await c.reconcile('gc:job:todo-app-be:op-1', ctx);
  assert.equal(r.leases, 1);
  assert.equal(calls.decisions.length, 1);
  assert.equal(calls.decisions[0].kind, 'runtime-defect');
  assert.equal(calls.decisions[0].decider, 'supervisor');
  assert.match(calls.decisions[0].summary, /LEASE_LEAK/);
  assert.equal(calls.decisions[0].idempotencyKey, 'lease-leak:todo-app-be:op-1');
});

/** runGc seams: one settled op worker to collect, no lanes, no temp, no tasks. `closes` counts real closes. */
function gcDeps(closes) {
  return { list: () => listed, read: () => ({ ok: true, screen: '' }), procs: async () => [], table: () => [], sup: () => ({ seat: null, jobs: [], leases: [] }),
    ledgers: () => [view()], git: () => ({ ok: true, stdout: '' }), landBusy: async () => false, sweepTmp: async () => ({ ok: true, skipped: [], deleted: [] }),
    taskUpdate: () => ({ ok: true }), fsx: { list: () => [], move: () => { throw Error('no move in a spec'); }, remove: () => { throw Error('no remove'); } },
    readState: () => ({ seen: {} }), freemem: () => 0, close: (h) => { closes.push(h); return { ok: true, proof: 'gone' }; }, kill: () => true, reap: () => ({ checked: false }),
    workers: () => ({ ok: true, workers: [] }), activeWorkers: () => [] };
}

/** The sweep seam (the controller runs gc.mjs as a child): the same runGc, in process, on the spec's fakes. */
const sweepWith = (gcd, { plan = {}, apply: applyDeps = {} } = {}) => async ({ apply, holder = null }) => runGc({ apply, now: T,
  deps: apply ? { ...gcd, ...applyDeps, holder } : { ...gcd, writeState: () => {}, log: () => {}, lesson: () => null, ...plan } });

test('the sweep in shadow: zero closes, the would-rows name what a live sweep would collect', async () => {
  const closes = [];
  const { c } = controller({ deps: { sweep: sweepWith(gcDeps(closes)), settings: { sweepMs: 1_800_000 } } });
  const { ctx, calls } = ctxOf('shadow');
  const r = await c.reconcile('gc:sweep', ctx);
  assert.equal(r.shadow, true);
  assert.equal(closes.length, 0, 'a shadow sweep closes nothing');
  assert.deepEqual(calls.run.map(([, a]) => a[0]), ['scripts/supervisor/gc.mjs']);
  const would = calls.log.find((l) => l.kind === 'reconciler.would' && l.data.action === 'gc-sweep');
  assert.ok(would, 'one would-row for the sweep');
  assert.ok(would.data.items.some((i) => i.target === 'term_op' && i.class === 'op-worker'));
  assert.ok(!would.data.items.some((i) => i.target === 'term_k'));
  // Not due again until sweepMs has passed.
  assert.match((await c.reconcile('gc:sweep', ctx)).skipped, /not due/);
});

test('the sweep in active applies under the host lock and records the supervisor-gc event', async () => {
  const closes = [], recorded = [];
  const { c } = controller({ deps: { sweep: sweepWith(gcDeps(closes), { apply: { lock: () => ({ ok: true, release() {} }), settleMs: 0, log: () => {}, writeState: () => {}, lesson: () => null } }),
    recordSweep: async (rep) => recorded.push(rep) } });
  const { ctx } = ctxOf('active');
  const r = await c.reconcile('gc:sweep', ctx);
  assert.deepEqual(closes, ['term_op']);
  assert.equal(recorded.length, 1);
  assert.equal(r.counts.agents, 1);
});

test('housekeeping: daily, and at once when the host reads lowDisk', async () => {
  let low = false;
  const { c } = controller({ deps: { hostResources: async () => ({ lowDisk: low, lowRam: false, freeDiskGb: 5 }) } });
  let now = T;
  const { ctx, calls } = ctxOf('shadow', { now: () => now });
  await c.reconcile('gc:housekeeping', ctx);
  assert.deepEqual(calls.run.at(-1)[1], ['scripts/housekeeping/housekeeping.mjs', '--apply']);
  now += 2 * 3_600_000;
  assert.match((await c.reconcile('gc:housekeeping', ctx)).skipped, /not due/);
  low = true;
  await c.reconcile('gc:housekeeping', ctx);
  assert.equal(calls.run.length, 2, 'lowDisk runs it before the 24 h');
});

test('leases collector: live seats and young settles kept; settled, gone and ended-workflow leases reported', () => {
  const rows = [
    { resourceKey: 'path:a', jobId: 'kernel-wf', workflowId: 'wf', jobStatus: 'running', jobUpdatedAt: T - 9e6, phase: 'build' },
    { resourceKey: 'path:b', jobId: 'op-young', workflowId: 'wf', jobStatus: 'succeeded', jobUpdatedAt: T - 30_000, phase: 'build' },
    { resourceKey: 'path:c', jobId: 'op-old', workflowId: 'wf', jobStatus: 'failed', jobUpdatedAt: T - 300_000, phase: 'build' },
    { resourceKey: 'path:d', jobId: 'op-gone', workflowId: 'wf', jobStatus: null, acquiredAt: T - 300_000 },
    { resourceKey: 'path:e', jobId: 'op-r', workflowId: 'wf-end', jobStatus: 'reported', jobUpdatedAt: T - 9e6, phase: 'finished', workflowUpdatedAt: T - 300_000 },
    { resourceKey: 'path:f', jobId: 'op-q', workflowId: 'wf', jobStatus: 'queued', jobUpdatedAt: T - 9e6, phase: 'build' },
  ];
  const leaks = classifyLeases({ rows, now: T, minAgeMs: 60_000 }).map((l) => l.resourceKey);
  assert.deepEqual(leaks, ['path:c', 'path:d', 'path:e']);
});

test('leases through runGc apply: report-only items and one lesson, nothing deleted', async () => {
  const lessons = [];
  const leases = [{ resourceKey: 'path:c', jobId: 'op-old', workflowId: 'wf-1', jobStatus: 'succeeded', jobUpdatedAt: T - 300_000, phase: 'build' }];
  const rep = await runGc({ apply: true, only: ['leases'], now: T, deps: { sup: () => ({ seat: null, jobs: [], leases: [] }), ledgers: () => [{ ...view(), leases }],
    readState: () => ({ seen: {} }), writeState: () => {}, log: () => {}, lesson: (a) => lessons.push(a), freemem: () => 0 } });
  const item = rep.items.find((i) => i.class === 'lease');
  assert.equal(item.verdict, 'refuse');
  assert.equal(item.reportOnly, true);
  assert.equal(rep.counts.leases, 1);
  assert.equal(lessons.length, 1);
  assert.equal(lessons[0].klass, 'lease');
});

test('lane logs: young files, directories and other names kept; old logs archived; archived past 14 days deleted', () => {
  const day = 86_400_000;
  const top = [
    { name: 'rc-engine.log', isFile: true, mtimeMs: T - 2 * 3_600_000 },
    { name: 'land1.json', isFile: true, mtimeMs: T - 2 * day },
    { name: 'npmci.err', isFile: true, mtimeMs: T - 3 * day },
    { name: 'rc-gc-resource', isFile: false, mtimeMs: T - 9 * day },
    { name: 'notes.txt', isFile: true, mtimeMs: T - 9 * day },
  ];
  const archived = [{ name: 'old.log', isFile: true, mtimeMs: T - 15 * day }, { name: 'recent.log', isFile: true, mtimeMs: T - 3 * day }];
  const plan = planLaneLogs({ top, archived, now: T });
  assert.deepEqual(plan.move, ['land1.json', 'npmci.err']);
  assert.deepEqual(plan.purge, ['old.log']);
  const moved = [], removed = [];
  const r = collectLaneLogs({ apply: true, now: T, env: { STARCI_LANES_ROOT: 'D:/lanes-spec' }, settings: { archiveRoot: 'D:/archive-spec', laneLogMinAgeMs: day, laneLogRetentionMs: 14 * day },
    fsx: { list: (d) => (/archive-spec/.test(d) ? archived : top), move: (a, b) => moved.push([path.basename(a), b]), remove: (f) => removed.push(path.basename(f)) } });
  assert.deepEqual(moved.map(([n]) => n), ['land1.json', 'npmci.err']);
  assert.ok(moved.every(([, to]) => to.includes(path.join('archive-spec', 'lane-logs'))));
  assert.deepEqual(removed, ['old.log']);
  assert.equal(r.errors.length, 0);
});

test('host lock: a busy gc lock touches nothing; both new collectors are default on', async () => {
  const closes = [];
  const rep = await runGc({ apply: true, now: T, deps: { ...gcDeps(closes), lock: () => ({ ok: false, holder: { holder: 'gc.mjs', pid: 1 } }) } });
  assert.equal(rep.ok, false);
  assert.equal(rep.busy, true);
  assert.equal(closes.length, 0);
  assert.ok(COLLECTORS.includes('leases') && COLLECTORS.includes('lanelogs'));
});

/** An Orca worker-list row of an active worker whose worktree is `dir`. */
const activeIn = (dispatchId, dir) => ({ dispatchId, runId: 'run_lane', terminalState: 'active', workerState: 'active', agentTerminalHandle: `term_${dispatchId}`,
  resource: { terminalHandle: `term_${dispatchId}`, worktreeId: `repo-1::${dir.replace(/\\/g, '/')}` }, projection: { liveness: { verdict: 'live' } } });

test('lane worktrees: never collected while an active Orca worker works in them or git moved in the last 60 min', async (t) => {
  const { collectLanes, laneOwnerOf, gcSettings } = await import('../../scripts/supervisor/gc.mjs');
  const fs = await import('node:fs');
  const os = await import('node:os');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-gc-lanes-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const lanes = path.join(root, 'lanes');
  const mk = (n) => { const d = path.join(lanes, n); fs.mkdirSync(d, { recursive: true }); return d; };
  const dirs = { owned: mk('slim-api'), cwd: mk('slim-ui'), fresh: mk('slim-db'), idle: mk('slim-docs') };
  const now = Date.now() + 3 * 3_600_000;
  const lastGit = { 'lane/slim-db': now - 40 * 60_000 };
  const porcelain = [`worktree ${root}\nHEAD aaa\nbranch refs/heads/main\n`, ...Object.values(dirs).map((d) => `worktree ${d}\nHEAD bbb\nbranch refs/heads/lane/${path.basename(d)}\n`)].join('\n');
  const git = (args) => {
    if (args[0] === 'worktree') return { ok: true, stdout: args[1] === 'list' ? porcelain : '' };
    if (args[0] === 'status' || args[0] === 'cherry') return { ok: true, stdout: '' };
    if (args[0] === 'reflog') { const b = args.at(-1).replace(/^refs\/heads\//, ''); const at = lastGit[b] ?? now - 2 * 3_600_000; return { ok: true, stdout: `bbbbbbb ${b}@{${Math.floor(at / 1000)}}` }; }
    if (args[0] === 'rev-parse' || args[0] === 'merge-base') return { ok: true, stdout: 'bbb' };
    return { ok: true, stdout: '' };
  };
  const workers = [activeIn('ctx_api', dirs.owned), activeIn('ctx_ui', path.join(dirs.cwd, 'src')),
    { ...activeIn('ctx_docs_done', dirs.idle), terminalState: 'released', workerState: 'succeeded' }];
  const settings = { ...gcSettings({}), laneGraceMs: 1_800_000 };
  const run = (rows) => collectLanes({ apply: false, env: { STARCI_LANES_ROOT: lanes }, now, settings, sup: { jobs: [] }, root, git, workers: rows });
  const by = Object.fromEntries(run(workers).items.map((i) => [path.basename(i.target), i]));
  assert.equal(by['slim-api'].verdict, 'keep'); assert.match(by['slim-api'].reason, /owner is alive: active worker ctx_api/);
  assert.equal(by['slim-ui'].verdict, 'keep'); assert.match(by['slim-ui'].reason, /ctx_ui .*works in it/);
  assert.equal(by['slim-db'].verdict, 'keep'); assert.match(by['slim-db'].reason, /40m ago/);
  assert.equal(by['slim-docs'].verdict, 'collect', 'merged, clean, idle > 60 min, no live owner (a released worker owns nothing)');
  const down = Object.fromEntries(run(null).items.map((i) => [path.basename(i.target), i]));
  assert.equal(down['slim-docs'].verdict, 'keep', 'Orca down: an owner cannot be ruled out');
  assert.equal(laneOwnerOf({ lanePath: path.join(lanes, 'slim'), branch: 'lane/slim', workers }), null, 'a worker in slim-api does not own lane slim');
  // Former false positive: a tab titled "[Worker] slim-docs" with no Orca worker behind it no longer owns the lane.
  assert.equal(laneOwnerOf({ lanePath: dirs.idle, branch: 'lane/slim-docs', workers: [] }), null);
  assert.equal(gcSettings({}).laneIdleMs, 3_600_000);
});

test('housekeeping sweepLanes applies the same live-owner rule as gc.mjs (scripts/machine/lane-owner.mjs)', async (t) => {
  const { sweepLanes } = await import('../../scripts/housekeeping/hk-lanes.mjs');
  const gc = await import('../../scripts/supervisor/gc.mjs');
  const lo = await import('../../scripts/machine/lane-owner.mjs');
  assert.equal(gc.laneOwnerOf, lo.laneOwnerOf, 'one shared function');
  const fs = await import('node:fs');
  const os = await import('node:os');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-hk-owner-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const lanes = path.join(root, 'lanes');
  const dir = path.join(lanes, 'slim-api'); fs.mkdirSync(dir, { recursive: true });
  const now = Date.now() + 30 * 3_600_000;
  const porcelain = `worktree ${root}\nHEAD aaaaaaa\nbranch refs/heads/main\n\nworktree ${dir}\nHEAD bbbbbbb\nbranch refs/heads/lane/slim-api\n`;
  const git = (args) => {
    if (args[0] === 'worktree') return { ok: true, stdout: args[1] === 'list' ? porcelain : '' };
    if (args[0] === 'reflog') return { ok: true, stdout: `bbbbbbb x@{${Math.floor((now - 26 * 3_600_000) / 1000)}}` };
    if (args[0] === 'rev-parse' || args[0] === 'merge-base') return { ok: true, stdout: 'bbbbbbb' };
    return { ok: true, stdout: '' };
  };
  const allocation = { housekeeping: { lanesRoot: lanes, laneGraceMs: 86_400_000 } };
  const run = (owners) => sweepLanes({ apply: false, now, env: {}, allocation, root, git, owners });
  const owned = run({ workers: [activeIn('ctx_api', dir)], sup: { jobs: [] } });
  assert.deepEqual(owned.wouldRemove, []);
  assert.equal(owned.skipped.find((x) => x.path === dir)?.reason, 'live-owner');
  const down = run({ workers: null, sup: { jobs: [] } });
  assert.equal(down.skipped.find((x) => x.path === dir)?.reason, 'live-owner', 'Orca down: nothing removed');
  const free = run({ workers: [], sup: { jobs: [] } });
  assert.deepEqual(free.wouldRemove.map((x) => x.path), [dir]);
});

/** An Orca worker-list row (the receipt shape of orchestration worker-list). */
const workerRow = (dispatchId, { run = 'run_a', terminalState = 'reclaimable', liveness = 'exited', next = 'release', handle = `term_${dispatchId}` } = {}) => ({
  dispatchId, runId: run, workerState: 'succeeded', terminalState, agentTerminalHandle: handle,
  resource: { terminalHandle: handle, worktreeId: `repo-1::${REPO}` },
  projection: { liveness: { verdict: liveness }, nextAction: next === 'release'
    ? { kind: 'release', argv: ['orca', 'orchestration', 'worker-release', '--dispatch', dispatchId, '--json'] } : { kind: next, argv: [] } },
});
const ranView = () => ({ ...view(), jobs: view().jobs.map((j) => ({ ...j, task: { taskId: `task-${j.jobId}`, runId: 'run_a', closed: true } })) });

test('agents collector: Orca\'s reclaimable workers are released per nextAction, Run by Run; unverifiable and release_unknown are reported, never touched', async () => {
  const rows = [workerRow('ctx_ok'), workerRow('ctx_unv', { liveness: 'unverifiable' }), workerRow('ctx_unk', { terminalState: 'release_unknown' }),
    workerRow('ctx_other', { next: 'stop' }), workerRow('ctx_live', { terminalState: 'active', liveness: 'live', next: 'none' }), workerRow('ctx_foreign', { run: 'run_owner' })];
  const asked = [], released = [];
  const deps = { ...gcDeps([]), ledgers: () => [ranView()], writeState: () => null, log: () => {}, lesson: () => null, settleMs: 0,
    workers: (run) => { asked.push(run); return { ok: true, workers: rows.filter((r) => r.runId === run) }; },
    release: ({ dispatch }) => { released.push(dispatch); return { ok: true, state: 'released' }; } };
  const plan = await runGc({ apply: false, only: ['agents'], now: T, deps });
  assert.deepEqual(asked, ['run_a'], 'only the Runs the runtime owns, each named with --run');
  assert.deepEqual(released, [], 'a dry run releases nothing');
  const items = Object.fromEntries(plan.items.filter((i) => i.class === 'worker').map((i) => [i.target, i]));
  assert.deepEqual(Object.keys(items).sort(), ['ctx_ok', 'ctx_other', 'ctx_unk', 'ctx_unv']);
  assert.equal(items.ctx_ok.verdict, 'collect');
  for (const id of ['ctx_unv', 'ctx_unk', 'ctx_other']) assert.deepEqual([id, items[id].verdict, items[id].code], [id, 'refuse', 'WORKER_RELEASE_REFUSED']);
  const live = await runGc({ apply: true, only: ['agents'], now: T, deps });
  assert.deepEqual(released, ['ctx_ok']);
  assert.equal(live.counts.agents, 2, 'one release and one close of the settled op terminal no worker row covers');
  assert.ok(!live.items.some((i) => i.target === 'term_ctx_ok' && i.action === 'close-terminal'), 'a worker Orca accounts for is never closed by tab');
});

test('agents collector: a Run whose worker-list fails touches none of its workers (WORKER_LIST_UNAVAILABLE); a failed release is WORKER_RELEASE_FAILED', async () => {
  const deps = { ...gcDeps([]), ledgers: () => [ranView()], writeState: () => null, log: () => {}, lesson: () => null, settleMs: 0, workers: () => ({ ok: false, error: 'runtime_unavailable' }), release: () => { throw Error('never'); } };
  const down = await runGc({ apply: true, only: ['agents'], now: T, deps });
  assert.equal(down.ok, false);
  assert.match(down.errors.join('\n'), /WORKER_LIST_UNAVAILABLE: worker-list --run run_a/);
  const failing = await runGc({ apply: true, only: ['agents'], now: T,
    deps: { ...deps, workers: () => ({ ok: true, workers: [workerRow('ctx_ok')] }), release: () => ({ ok: false, outcome: 'release_unknown', error: 'exit 1' }) } });
  assert.equal(failing.items.find((i) => i.target === 'ctx_ok').code, 'WORKER_RELEASE_FAILED');
  assert.match(failing.errors.join('\n'), /WORKER_RELEASE_FAILED: worker-release --dispatch ctx_ok/);
});

test('op-settled whose worker Orca holds reclaimable: released through worker-release, never closed by tab', async () => {
  const { c, lessons } = controller({ view: ranView(), deps: { workers: async (run) => ({ ok: true, workers: run === 'run_a' ? [workerRow('ctx_op', { handle: 'term_op' })] : [] }) } });
  const { ctx, calls } = ctxOf('active');
  const r = await c.reconcile('gc:job:todo-app-be:op-1', ctx);
  assert.deepEqual(calls.run.map(([, a]) => a.slice(0, 3)), [['scripts/api/orca/worker-release.mjs', '--dispatch', 'ctx_op']]);
  assert.equal(r.closes.length, 1);
  assert.equal(lessons[0].klass, 'worker');
  const unv = controller({ view: ranView(), deps: { workers: async () => ({ ok: true, workers: [workerRow('ctx_op', { handle: 'term_op', liveness: 'unverifiable' })] }) } }).c;
  const { ctx: ctx2, calls: calls2 } = ctxOf('active');
  await unv.reconcile('gc:job:todo-app-be:op-1', ctx2);
  assert.equal(calls2.run.length, 0, 'unverifiable: neither released nor closed by tab (Orca accounts for it)');
});

test('unverifiable workers are never released: the sweep raises ONE owner incident listing each handle, Run and age', async () => {
  const settledView = () => ({ ...ranView(), jobs: ranView().jobs.map((j) => (j.jobId === 'op-1' ? { ...j, handles: ['term_op'], updatedAt: T - 3 * 3_600_000 } : j)) });
  const rows = [workerRow('ctx_a', { handle: 'term_op', liveness: 'unverifiable' }), workerRow('ctx_b', { liveness: 'unverifiable' }), workerRow('ctx_ok')];
  const released = [];
  const gcd = { ...gcDeps([]), ledgers: () => [settledView()], settleMs: 0, writeState: () => null, log: () => {}, lesson: () => null,
    workers: () => ({ ok: true, workers: rows }), release: ({ dispatch }) => { released.push(dispatch); return { ok: true }; } };
  const { c } = controller({ deps: { sweep: sweepWith(gcd), recordSweep: async () => {}, recordRun: async () => 1, settings: { sweepMs: 1_800_000 } } });
  const { ctx, calls } = ctxOf('active');
  await c.reconcile('gc:sweep', ctx);
  assert.deepEqual(released, ['ctx_ok'], 'only the verifiable worker is released');
  const owner = calls.decisions.filter((d) => d.idempotencyKey === 'gc-unverifiable-workers');
  assert.equal(owner.length, 1, 'one incident for all of them');
  assert.equal(owner[0].decider, 'owner');
  assert.match(owner[0].summary, /2 settled worker\(s\).*term_op \(Run run_a, 3h\).*term_ctx_b \(Run run_a, age unknown\)/);
  assert.deepEqual(owner[0].evidence.map((e) => e.ref), ['worker:ctx_a', 'worker:ctx_b']);
  const quiet = controller({ deps: { sweep: sweepWith({ ...gcd, workers: () => ({ ok: true, workers: [workerRow('ctx_ok')] }) }), recordSweep: async () => {}, recordRun: async () => 1, settings: { sweepMs: 1_800_000 } } }).c;
  const { ctx: ctx2, calls: calls2 } = ctxOf('active');
  await quiet.reconcile('gc:sweep', ctx2);
  assert.ok(!calls2.decisions.some((d) => d.idempotencyKey === 'gc-unverifiable-workers'), 'no unverifiable worker, no incident');
});
