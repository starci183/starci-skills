import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROLES, CHILDREN, SMOKE_SCHEMA, noopAgent, noopSpec, runSmoke, runStage, markResult, resolveState, stateParentOf,
  ownedFileOf, ownedTextOf, feAppOf, worktreeParamsOf, mainManifest, manifestDiff } from '../../scripts/kernel/launch-smoke.mjs';
import { checkRepository } from '../../scripts/hfs/check.mjs';
import { startAgent } from '../../scripts/agent/lib.mjs';
import { startWorkerAgent } from '../../scripts/agent/start-worker.mjs';
import { launchCriticWorker } from '../../scripts/work/draw-critic.mjs';
import { gitResult } from '../../scripts/api/git/lib.mjs';

// The pre-workflow launch smoke (scripts/kernel/launch-smoke.mjs, starci/launch-smoke@2) drives the runtime's own
// launchers - startAgent (Supervisor, Kernel, the api dispatch shape of an Op), agent/start-worker.mjs startWorkerAgent ([Worker])
// and draw-critic.mjs launchCriticWorker (the critic on its criticWorkspace placement) - against a fake Orca at the
// wrapper level: Runs, worker-start --spec (it files the Task), worker-show (depth and creator Dispatch, the way Orca
// reports them), worker-read, worker-stop, worker-release, task-update, and worktree list. Each fake agent does
// what its no-op spec says: a parent runs its stage (starting its children from its own terminal), every agent marks its
// result line (an op writes its owned file in the workflow worktree) and sends worker_done. Nothing reaches a host.
//
// The workflow worktree runtime (parts A and B of contract change workflow-worktree: scripts/kernel/workflow-worktree.mjs
// and scripts/kernel/workflow-checkpoint.mjs) is stubbed HERE, over real git in a temp directory: the scratch app is a git
// repository on main with a node_modules directory; Orca's new-child worktree is a clone on wf/<id>; a checkpoint is a
// commit of the op's owned file; preserve-and-reset is a snapshot commit on preserved/<id>/<op> and a hard reset to the
// last checkpoint; the finish fast-forwards the app's main from the branch and removes the clone.

const titleRole = (title) => Object.entries(ROLES).find(([, r]) => r.title === title)?.[0] ?? (String(title).startsWith('[Critic]') ? 'critic' : null);
const SPEC_DIR = path.dirname(fileURLToPath(import.meta.url));

function git(dir, ...args) {
  const r = spawnSync('git', ['-C', dir, '-c', 'user.name=smoke', '-c', 'user.email=smoke@example.invalid', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

/** A scratch app: hfs.json with one fe application (web), be/ and fe/ sources on main, an ignored node_modules with one package. */
function scratchApp(tmp) {
  const app = path.join(tmp, 'app');
  for (const [rel, text] of [['be/src/main.ts', 'export const be = 1;\n'], ['fe/apps/web/page.tsx', 'export const fe = 1;\n'], ['.gitignore', 'node_modules/\n'], ['hfs.json', `${JSON.stringify({ hfs: 2, kind: 'app', sides: { fe: { apps: [{ name: 'web', kind: 'next' }] } } })}\n`], ['node_modules/left-pad/index.js', 'module.exports = 1;\n']]) {
    fs.mkdirSync(path.dirname(path.join(app, rel)), { recursive: true });
    fs.writeFileSync(path.join(app, rel), text);
  }
  git(tmp, 'init', '-q', '-b', 'main', app);
  git(app, 'config', 'core.autocrlf', 'false');
  git(app, 'add', '-A');
  git(app, 'commit', '-q', '-m', 'scratch app');
  return app;
}

/** The parts A and B stubs (the contract's interfaces), over the scratch app. */
function fakeWorkflowRuntime(tmp, { sameSideConcurrent = false, finishTouchesMain = false, finishRefuses = null, unlisted = false } = {}) {
  const rows = new Map();
  const listed = new Map();
  const calls = [];
  const rec = (name, fn) => (...args) => { calls.push([name, args[1] ?? args[0]]); return fn(...args); };
  const sideOf = (r) => {
    const sides = new Set((r?.owned_paths ?? []).map((p) => (p.startsWith('be/') ? 'be' : p.startsWith('fe/') ? 'fe' : null)));
    if (sides.has(null) || !sides.size) return null;
    return sides.size > 1 ? 'both' : [...sides][0];
  };
  const workflow = {
    spec: rec('workflowWorktreeSpec', ({ workflowId, appRepo }) => ({ name: `wf-${workflowId}`, baseBranch: 'main',
      args: ['worktree', 'create', '--repo', `path:${appRepo}`, '--name', `wf-${workflowId}`, '--base-branch', 'main', '--setup', 'run', '--no-parent'] })),
    // Orca's `worktree create` before the Kernel starts: a clone of the app on Orca's branch wf-<id>, listed by
    // `orca worktree list` (unless the case says Orca never lists it), then the registry row.
    ensure: rec('ensureWorkflowWorktree', (ctx, { workflowId, appRepo }) => {
      const name = `wf-${workflowId}`;
      const p = path.join(tmp, 'orca-worktrees', name);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      git(tmp, 'clone', '-q', appRepo, p);
      git(p, 'checkout', '-q', '-b', name);
      const id = `app::${p.replaceAll('\\', '/')}`;
      if (!unlisted) listed.set(id, { id, path: p.replaceAll('\\', '/'), branch: name, displayName: name });
      const row = { workflowId, orcaWorktreeId: id, path: p.replaceAll('\\', '/'), branch: name, checkpoint: null, releasePending: false };
      rows.set(workflowId, row);
      return { ok: true, created: true, record: { ...row } };
    }),
    of: rec('workflowWorktreeOf', (ctx, workflowId) => rows.get(workflowId) ?? null),
    opArgs: rec('opWorktreeArgs', (ctx, { workflowId }) => ['--worktree', rows.get(workflowId).path]),
    sideOf: rec('sideOf', sideOf),
    canDispatchConcurrently: rec('canDispatchConcurrently', (running, next) => {
      const n = sideOf(next);
      if (n === 'both' || n === null) return running.length === 0;
      return running.every((r) => { const s = sideOf(r); return s !== 'both' && (sameSideConcurrent || s !== n); });
    }),
    release: rec('releaseWorkflowWorktree', (ctx, workflowId) => {
      const row = rows.get(workflowId);
      fs.rmSync(row.path, { recursive: true, force: true });
      listed.delete(row.orcaWorktreeId);
      rows.delete(workflowId);
      return { ok: true };
    }),
    checkpointOp: rec('checkpointOp', (ctx, { workflowId, opId }) => {
      const row = rows.get(workflowId);
      git(row.path, 'add', '--', ownedFileOf(opId, workflowId, 'web'));
      git(row.path, 'commit', '-q', '-m', `checkpoint ${opId}`);
      row.checkpoint = git(row.path, 'rev-parse', 'HEAD');
      return { sha: row.checkpoint };
    }),
    gateBaseOf: rec('gateBaseOf', (ctx, workflowId) => {
      const row = rows.get(workflowId);
      return row.checkpoint ?? git(row.path, 'merge-base', 'HEAD', 'origin/main');
    }),
    preserveAndReset: rec('preserveAndReset', (ctx, { workflowId, opId }) => {
      const row = rows.get(workflowId);
      git(row.path, 'add', '-A');
      const tree = git(row.path, 'write-tree');
      const snapshot = git(row.path, 'commit-tree', tree, '-p', 'HEAD', '-m', `preserved ${opId}`);
      const preservedRef = `refs/heads/preserved/${workflowId}/${opId}`;
      git(row.path, 'update-ref', preservedRef, snapshot);
      git(row.path, 'reset', '-q', '--hard', row.checkpoint);
      return { preservedRef, resetTo: row.checkpoint };
    }),
    finish: rec('finishWorkflow', (ctx, { workflowId }) => {
      if (finishRefuses) return { ok: false, steps: [{ step: 'gate', ok: false, code: finishRefuses }], refusal: { step: 'gate', code: finishRefuses, detail: 'the whole branch has new findings' } };
      const row = rows.get(workflowId);
      const app = path.join(tmp, 'app');
      git(app, 'fetch', '-q', row.path, row.branch);
      git(app, 'merge', '-q', '--ff-only', 'FETCH_HEAD');
      if (finishTouchesMain) fs.writeFileSync(path.join(app, 'be/src/main.ts'), 'export const be = 2;\n');
      // The finish never removes the worktree: it is release-pending until the host-side controller removes it.
      row.releasePending = true;
      return { ok: true, steps: ['gate', 'merge-guard', 'review-verify', 'rebase', 'fast-forward', 'push', 'release-pending'].map((step) => ({ step, ok: true })) };
    }),
  };
  return { workflow, calls, rows, listed };
}

function fakeOrca(t, { refuse = null, silent = null, releaseUnknownOnce = null, unlisted = false, controllerStuck = false, runtime = {} } = {}) {
  const calls = [];
  const tasks = new Map();
  const workers = new Map();
  const byTerminal = new Map();
  const pending = [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-launch-smoke-spec-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const app = scratchApp(tmp);
  const wfr = fakeWorkflowRuntime(tmp, { ...runtime, unlisted });
  let runs = 0;
  const rec = (name, fn) => (args = {}) => { calls.push([name, args]); return fn(args); };
  const placements = new Map();
  const wrappers = {
    runShow: rec('run-show', () => ({ ok: false })),
    runCreate: rec('run-create', ({ from }) => { runs += 1; return { ok: true, runId: `run_${runs}`, from }; }),
    trust: rec('trust', () => ({ status: 'already', paths: [] })),
    workerStart: rec('worker-start', ({ spec, displayName, run, from, worktree, agent, model }) => {
      const role = titleRole(displayName);
      const task = `task_${role}`;
      tasks.set(task, { role, run, spec, from });
      if (role === refuse) return { ok: false, outcome: 'failed', effectState: 'none', dispatchId: null, errorCode: 'selector_not_found', error: `selector_not_found: path:${worktree}` };
      const placed = worktree;
      const creator = byTerminal.get(from) ?? null;
      const w = { id: `ctx_${role}`, role, task, terminal: `term_${role}`, agent, model, depth: creator ? creator.depth + 1 : 1,
        creatorDispatchId: creator?.id ?? null, status: 'dispatched', state: 'ready', worktree: placed, spec };
      workers.set(w.id, w);
      byTerminal.set(w.terminal, w);
      pending.push(w);
      return { ok: true, outcome: 'ok', effectState: 'committed', dispatchId: w.id, taskId: task, agentTerminalHandle: w.terminal, state: 'ready' };
    }),
    terminalRename: rec('terminal-rename', () => ({ ok: true })),
    workerShow: rec('worker-show', ({ dispatch }) => {
      const w = workers.get(dispatch);
      return w ? { ok: true, state: w.state, effective: { agent: w.agent, model: w.model },
        dispatch: { id: w.id, status: w.status, depth: w.depth, creatorDispatchId: w.creatorDispatchId, taskId: w.task } } : { ok: false, state: null };
    }),
    workerRead: rec('worker-read', ({ dispatch }) => ({ ok: workers.has(dispatch), source: 'transcript', rows: [{ text: 'done' }] })),
    workerStop: rec('worker-stop', ({ dispatch }) => { const w = workers.get(dispatch); w.status = 'failed'; w.state = 'stopped'; return { ok: true }; }),
    workerRelease: rec('worker-release', ({ dispatch }) => {
      const w = workers.get(dispatch);
      if (w.role === releaseUnknownOnce && !w.releaseTried) { w.releaseTried = true; return { ok: false, outcome: 'unknown', state: 'release_unknown', result: { lastError: 'the stop outcome could not be verified' } }; }
      w.released = true;
      return { ok: true };
    }),
    taskUpdate: rec('task-update', ({ id, status }) => ({ ok: true, taskId: id, status })),
    worktreeList: rec('worktree-list', () => ({ ok: true, worktrees: [...wfr.listed.values()] })),
  };
  const io = { runShow: wrappers.runShow, runCreate: wrappers.runCreate,
    spawn: { trust: wrappers.trust, start: wrappers.workerStart, rename: wrappers.terminalRename,
      show: wrappers.workerShow, stop: wrappers.workerStop, release: wrappers.workerRelease } };
  const launches = [];
  const client = {
    startAgent: (opts) => {
      launches.push(opts);
      return startAgent({ ...opts, io });
    },
    startWorkerAgent: (opts) => startWorkerAgent({ ...opts, start: client.startAgent }),
    // The placement is a temp directory here; tests/work/draw-critic-worker-start.spec.mjs proves the real worktree placement.
    // Orca registers the placement (an id and a branch); its removal needs both, as removeOrcaWorktree does, or the worktree stays listed.
    criticWorkspace: rec('critic-workspace', () => {
      const dir = fs.mkdtempSync(path.join(tmp, 'starci-draw-critic-'));
      const orcaId = `wt_critic_${placements.size + 1}`;
      placements.set(orcaId, { dir, branch: `draw-critic-${placements.size + 1}` });
      return { ok: true, dir, repoRoot: tmp, orcaId, branch: placements.get(orcaId).branch };
    }),
    removeCriticWorkspace: rec('critic-workspace-remove', ({ dir, orcaId, branch }) => {
      const placed = placements.get(orcaId);
      if (!placed || placed.dir !== dir || placed.branch !== branch) return { ok: false, error: 'removal needs the placement orcaId and branch' };
      placements.delete(orcaId);
      fs.rmSync(dir, { recursive: true, force: true });
      return { ok: true };
    }),
    launchCriticWorker: (opts) => launchCriticWorker({ ...opts, orca: { ...wrappers } }),
    workerShow: wrappers.workerShow, workerRead: wrappers.workerRead, workerStop: wrappers.workerStop,
    workerRelease: wrappers.workerRelease, taskUpdate: wrappers.taskUpdate, worktreeList: wrappers.worktreeList,
    ctx: { fake: true },
    workflow: wfr.workflow,
    git: (args, dir) => gitResult(args, { dir }),
  };
  // The fake agents: each does what its no-op spec says, on the smoke's next poll.
  const tick = async () => {
    while (pending.length) {
      const w = pending.shift();
      if (w.role === silent) continue;
      const role = /--as (\w+)/.exec(w.spec)[1];
      const env = { ORCA_TERMINAL_HANDLE: w.terminal };
      const { state } = await resolveState({ role, env, parent: stateParentOf(tmp), waitMs: 0 });
      const stage = / stage --as /.test(w.spec)
        ? await runStage({ role, state, orca: client, env, waitMs: 0, sleep: async () => {} })
        : markResult({ role, state });
      w.status = stage.ok ? 'completed' : 'failed';
    }
    // The host-side controller: a release-pending worktree whose terminals are all released is removed.
    for (const row of [...wfr.rows.values()]) {
      if (row.releasePending && !controllerStuck && [...workers.values()].every((w) => w.released)) wfr.workflow.release({ controller: true }, row.workflowId);
    }
  };
  return { client, calls, workers, tmp, app, wfr, launches, placements, tick, names: () => calls.map((c) => c[0]) };
}

const clock = (fake) => { let now = 0; return { now: () => now, sleep: async (ms) => { now += ms; await fake.tick(); } }; };
const noop = { provider: 'codex', model: 'gpt-6-luna', effort: 'low' };
const smoke = (fake, extra = {}) => runSmoke({ entry: 'term_entry', orca: fake.client, appRepo: fake.app, noop, stateRoot: fake.tmp, root: fake.tmp,
  pollMs: 1000, timeoutMs: 60000, workflowId: 'smoke-t', ...clock(fake), ...extra });

test('every nesting path starts through the runtime launchers at the depth Orca reports, and every agent is released', async (t) => {
  const fake = fakeOrca(t);
  const r = await smoke(fake);
  assert.equal(r.schema, SMOKE_SCHEMA);
  assert.equal(r.ok, true, JSON.stringify(r, null, 2));
  assert.deepEqual(r.paths['supervisor-worker'], { status: 'ok', depths: { supervisor: 1, worker: 2 } });
  assert.deepEqual(r.paths['op-critic'], { status: 'ok', depths: { kernel: 1, op: 2, critic: 3 } });
  assert.deepEqual(r.paths['workflow-worktree'], { status: 'ok', depths: { kernel: 1, op: 2, opFe: 2, opFail: 2 } });
  const starts = fake.calls.filter((c) => c[0] === 'worker-start').map((c) => c[1]);
  assert.equal(starts.length, 7, 'one worker-start per agent');
  for (const s of starts) assert.deepEqual([s.agent, s.model, s.effort], ['codex', 'gpt-6-luna', 'low'], 'every no-op agent runs the cheapest model');
  const startOf = (role) => starts.find((s) => fake.workers.get(`ctx_${role}`).task === `task_${titleRole(s.displayName)}`);
  assert.equal(startOf('supervisor').from, 'term_entry');
  assert.equal(startOf('kernel').from, 'term_entry');
  assert.equal(startOf('worker').from, 'term_supervisor', 'the [Worker] is started from the Supervisor terminal, in its Run');
  for (const op of ['op', 'opFe', 'opFail']) assert.equal(startOf(op).from, 'term_kernel', `${op} is started from the Kernel terminal (worker-start --spec --run --from)`);
  assert.equal(startOf('critic').from, 'term_op', 'the critic is started from the Op terminal');
  const runFroms = fake.calls.filter((c) => c[0] === 'run-create').map((c) => c[1].from).sort();
  assert.deepEqual(runFroms, ['term_entry', 'term_entry', 'term_kernel', 'term_kernel', 'term_kernel', 'term_op', 'term_supervisor'], 'each parent creates and coordinates the Run of its child');
  assert.equal(fake.calls.some(([n]) => n === 'task-create' || n === 'dispatch-show'), false, 'worker-start --spec files every Task: no task-create, no dispatch-show');
  assert.equal(starts.some((s) => s.parent || s.task), false, 'no start names a --parent or an existing Task');
  for (const s of starts) assert.ok(s.request?.run, 'every start carries its ledger identity (calls.yaml replay: request)');
  assert.equal(startOf('critic').worktree, r.agents.critic.workspace.replaceAll('/', path.sep), 'the critic is placed on draw-critic criticWorkspace');
  assert.equal(r.agents.critic.creatorDispatchId, 'ctx_op');
  for (const role of Object.keys(ROLES)) {
    assert.match(r.agents[role].result, new RegExp(`^${role} ok `), `${role} wrote its result line`);
    assert.equal(r.agents[role].workerDone, true);
    assert.equal(r.agents[role].read.ok, true);
  }
  const names = fake.names();
  const releases = fake.calls.filter((c) => c[0] === 'worker-release').map((c) => c[1].dispatch);
  assert.deepEqual(releases, ['ctx_critic', 'ctx_op', 'ctx_opFe', 'ctx_opFail', 'ctx_worker', 'ctx_kernel', 'ctx_supervisor'], 'released deepest first');
  assert.ok(names.lastIndexOf('worker-read') < names.indexOf('worker-release'), 'every worker is read before any release');
  assert.equal(names.includes('worker-stop'), false, 'a worker that sent worker_done is not stopped');
  assert.equal(names.includes('task-update'), false, 'worker_done settled every Task, the failed op included');
  assert.deepEqual(r.cleanup.find((c) => c.role === 'critic'), { role: 'critic', dispatchId: 'ctx_critic', stopped: null, released: true, taskClosed: 'by-worker_done', workspaceRemoved: true });
  assert.deepEqual(fs.readdirSync(fake.tmp).filter((n) => n.startsWith('starci-draw-critic-')), [], 'the critic placement is removed');
  assert.equal(fake.placements.size, 0, 'the critic worktree is no longer registered: the smoke passed its orcaId and branch to the removal');
  assert.deepEqual(fs.readdirSync(stateParentOf(fake.tmp)), [], 'the state directory is removed');
});

test('Orca creates the workflow worktree before the Kernel starts in it; the be and fe ops run in parallel in it, never in a worktree of their own', async (t) => {
  const fake = fakeOrca(t);
  const r = await smoke(fake);
  assert.equal(r.ok, true, JSON.stringify(r.paths, null, 2));
  const kernel = fake.launches.find((l) => l.title === ROLES.kernel.title);
  const order = fake.wfr.calls.map((c) => c[0]);
  assert.ok(order.indexOf('ensureWorkflowWorktree') >= 0 && fake.calls.findIndex((c) => c[0] === 'worker-start') >= 0, 'the worktree is created, then agents start');
  assert.equal(kernel.worktree.replaceAll('\\', '/'), r.workflow.path, 'the Kernel starts with --worktree <the existing workflow worktree>');
  assert.equal(r.workflow.branch, 'wf-smoke-t', "the workflow branch is the registry's (Orca's wf-<id>)");
  const wf = r.workflow;
  assert.equal(wf.listed, true, 'the workflow worktree appears in orca worktree list');
  assert.equal(wf.registered, true);
  assert.match(wf.path, /orca-worktrees\/wf-smoke-t$/);
  const starts = fake.calls.filter((c) => c[0] === 'worker-start').map((c) => c[1]);
  for (const op of ['op', 'opFe', 'opFail']) {
    assert.equal(starts.find((s) => titleRole(s.displayName) === op).worktree.replaceAll('\\', '/'), wf.path, `${op} starts with --worktree <the workflow worktree>`);
  }
  assert.equal(wf.parallel, true, 'the be op and the fe op were started together');
  const stage = fake.calls.filter((c) => c[0] === 'worker-start').map((c) => `task_${titleRole(c[1].displayName)}`);
  assert.ok(stage.indexOf('task_opFe') < stage.indexOf('task_opFail'), 'the failing be op starts only after the first be op settled');
  assert.deepEqual([wf.concurrency.sides.op, wf.concurrency.sides.opFe], ['be', 'fe']);
  assert.equal(wf.concurrency.beBeside, false, 'same side: serial');
  assert.equal(wf.concurrency.feBeside, true, 'across sides: parallel');
});

test('each green op is a checkpoint gated against the previous one; the failing op is preserved and the worktree reset to the last checkpoint', async (t) => {
  const fake = fakeOrca(t);
  const r = await smoke(fake);
  const wf = r.workflow;
  assert.equal(r.paths['workflow-worktree'].status, 'ok', JSON.stringify(r.paths['workflow-worktree']));
  assert.equal(wf.gateBases.op.before, wf.baseHead, "the first op's gate base is the merge-base with main");
  assert.equal(wf.gateBases.op.after, wf.checkpoints.op);
  assert.equal(wf.gateBases.opFe.before, wf.checkpoints.op, "the second op's gate base is the previous checkpoint");
  assert.equal(wf.gateBases.opFe.after, wf.checkpoints.opFe);
  assert.deepEqual(wf.reset, { preservedRef: 'refs/heads/preserved/smoke-t/opFail', resetTo: wf.checkpoints.opFe, lastCheckpoint: wf.checkpoints.opFe,
    head: wf.checkpoints.opFe, clean: true, fileGone: true, preservedHasFile: true });
  assert.equal(r.agents.opFail.status, 'failed', 'the failing op reported failed');
  const order = fake.wfr.calls.map((c) => c[0]);
  assert.ok(order.indexOf('preserveAndReset') < order.indexOf('finishWorkflow'), 'the reset happens before the finish');
});

test('the finish merges to main and leaves the worktree release-pending; the controller removes it; main is byte-identical but for the two green files', async (t) => {
  const fake = fakeOrca(t);
  const before = fs.readFileSync(path.join(fake.app, 'be/src/main.ts'));
  const r = await smoke(fake);
  const wf = r.workflow;
  assert.equal(wf.finish.ok, true);
  assert.deepEqual(wf.main.added, [ownedFileOf('op', 'smoke-t', 'web'), ownedFileOf('opFe', 'smoke-t', 'web')].sort());
  assert.deepEqual([wf.main.changed, wf.main.removed, wf.main.nodeModulesSame, wf.main.addedBytesOk, wf.main.ancestor], [[], [], true, true, true]);
  assert.deepEqual(fs.readFileSync(path.join(fake.app, 'be/src/main.ts')), before);
  assert.equal(fs.readFileSync(path.join(fake.app, ownedFileOf('opFe', 'smoke-t', 'web')), 'utf8'), ownedTextOf('opFe', 'smoke-t'));
  assert.equal(fs.existsSync(path.join(fake.app, ownedFileOf('opFail', 'smoke-t', 'web'))), false, "the failed op's file never reaches main");
  assert.equal(wf.releasePending, true, 'the finish leaves the worktree release-pending');
  assert.deepEqual(wf.removed, { listed: false, pathExists: false, branchGone: true, registry: null }, 'the host-side controller removed it');
  const order = fake.wfr.calls.map((c) => c[0]);
  assert.ok(order.indexOf('finishWorkflow') < order.indexOf('releaseWorkflowWorktree'), 'removed by the controller after the finish');
  assert.equal(r.workflow.released, undefined, 'the smoke itself released nothing');
  const names = fake.names();
  assert.ok(names.lastIndexOf('worker-release') < fake.calls.findLastIndex((c) => c[0] === 'worktree-list'), 'every agent is released before the finish removes the worktree');
});

test("the smoke's no-op files sit in slots a real app owns: the hfs repository check over the todo example finds nothing new", (t) => {
  // The finish gate lints the whole branch; a file in an invented folder (HFS_SLOT_UNDECLARED) would refuse the finish and
  // hide a real finish failure. Measured on a copy of examples/todo-app (its tracked files, never a node_modules), with the
  // repository check hfs lint runs (scripts/hfs/check.mjs checkRepository; the preset and formatter passes need an
  // installed app and are not this question).
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-launch-smoke-slots-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const source = path.join(SPEC_DIR, '..', '..', 'examples', 'todo-app');
  const app = path.join(tmp, 'todo-app');
  for (const rel of git(source, 'ls-files', '-z', '.').split('\0').filter(Boolean)) {
    fs.mkdirSync(path.dirname(path.join(app, rel)), { recursive: true });
    fs.copyFileSync(path.join(source, rel), path.join(app, rel));
  }
  git(tmp, 'init', '-q', '-b', 'main', app);
  git(app, 'config', 'core.autocrlf', 'false');
  git(app, 'add', '-A');
  git(app, 'commit', '-q', '-m', 'todo example');
  const codes = () => checkRepository({ repoRoot: app, fast: true }).findings.map((f) => `${f.code} ${f.path}`).sort();
  const base = codes();
  const feApp = feAppOf(app);
  assert.equal(feApp, 'web');
  const files = ['op', 'opFe', 'opFail'].map((role) => [ownedFileOf(role, 'smoke-t', feApp), ownedTextOf(role, 'smoke-t')]);
  for (const [rel, text] of files) { fs.mkdirSync(path.dirname(path.join(app, rel)), { recursive: true }); fs.writeFileSync(path.join(app, rel), text); }
  git(app, 'add', '-A');
  assert.deepEqual(codes(), base, 'no finding on the smoke files');
  const invented = 'be/.launch-smoke/smoke-t/op.txt';
  fs.mkdirSync(path.dirname(path.join(app, invented)), { recursive: true });
  fs.writeFileSync(path.join(app, invented), 'x\n');
  git(app, 'add', '-A');
  assert.ok(codes().includes(`HFS_SLOT_UNDECLARED ${invented}`), 'the check does refuse an invented folder');
});

test('a release-pending worktree the host-side controller never removes fails the path; the smoke releases it itself', async (t) => {
  const fake = fakeOrca(t, { controllerStuck: true });
  const r = await smoke(fake, { releaseTimeoutMs: 5000 });
  assert.equal(r.workflow.finish.ok, true);
  assert.equal(r.workflow.releasePending, true);
  assert.match(r.paths['workflow-worktree'].problems.join('\n'), /host-side controller did not remove the workflow worktree/);
  assert.deepEqual(r.workflow.released, { ok: true }, 'given back through releaseWorkflowWorktree');
  assert.equal(fake.wfr.listed.size, 0);
});

test('a finish that changes another file on main fails the workflow path with the exact file', async (t) => {
  const fake = fakeOrca(t, { runtime: { finishTouchesMain: true } });
  const r = await smoke(fake);
  assert.equal(r.ok, false);
  assert.equal(r.paths['op-critic'].status, 'ok');
  assert.match(r.paths['workflow-worktree'].problems.join('\n'), /main is not intact: changed \["be\/src\/main.ts"\]/);
});

test('a dispatcher that runs two be ops together fails the workflow path (same side must be serial)', async (t) => {
  const fake = fakeOrca(t, { runtime: { sameSideConcurrent: true } });
  const r = await smoke(fake);
  assert.equal(r.paths['workflow-worktree'].status, 'failed');
  assert.match(r.paths['workflow-worktree'].problems.join('\n'), /admits a be op beside a running be op/);
});

test('a refused finish leaves main untouched and the worktree is released through releaseWorkflowWorktree', async (t) => {
  const fake = fakeOrca(t, { runtime: { finishRefuses: 'workflow-finish-gate-red' } });
  const head = git(fake.app, 'rev-parse', 'HEAD');
  const r = await smoke(fake);
  assert.equal(r.paths['workflow-worktree'].status, 'failed');
  assert.match(r.paths['workflow-worktree'].problems.join('\n'), /finishWorkflow: gate workflow-finish-gate-red: the whole branch has new findings/);
  assert.equal(git(fake.app, 'rev-parse', 'HEAD'), head, 'main did not move');
  assert.deepEqual(r.workflow.main.added, []);
  assert.deepEqual(r.workflow.released, { ok: true });
  assert.equal(fake.wfr.listed.size, 0, 'the worktree is gone from orca worktree list');
});

test('a workflow worktree Orca never lists fails the workflow path', async (t) => {
  const fake = fakeOrca(t, { unlisted: true });
  const r = await smoke(fake);
  assert.equal(r.ok, false);
  assert.match(r.paths['workflow-worktree'].problems.join('\n'), /never appeared in orca worktree list/);
  assert.equal(r.paths['supervisor-worker'].status, 'ok');
});

test('a refused critic placement fails the be op, so the op-critic and workflow paths; the supervisor path stays ok and every started agent is released', async (t) => {
  const fake = fakeOrca(t, { refuse: 'critic' });
  const r = await smoke(fake);
  assert.equal(r.ok, false);
  assert.equal(r.paths['supervisor-worker'].status, 'ok');
  assert.equal(r.paths['op-critic'].status, 'failed');
  assert.match(r.paths['op-critic'].problems.join('\n'), /critic: not started .*selector_not_found/);
  assert.equal(r.agents.op.depth, 2, 'the Op still reached depth 2');
  assert.equal(r.paths['workflow-worktree'].status, 'failed');
  assert.match(r.paths['workflow-worktree'].problems.join('\n'), /op: no checkpoint/);
  assert.equal(r.agents.opFail.launched, false, 'a be op that failed blocks the next be op');
  assert.deepEqual(r.cleanup.map((c) => c.role), ['critic', 'op', 'opFe', 'worker', 'kernel', 'supervisor']);
  assert.equal(r.cleanup.find((c) => c.role === 'critic').workspaceRemoved, true, 'the placement of a refused critic is removed');
  assert.ok(r.cleanup.filter((c) => c.dispatchId).every((c) => c.released));
});

test('a worker that never reports worker_done times the smoke out; it is stopped, released and its Task closed by its coordinator', async (t) => {
  const fake = fakeOrca(t, { silent: 'worker' });
  const r = await smoke(fake, { timeoutMs: 10000 });
  assert.equal(r.ok, false);
  assert.match(r.error, /timed out after 10000ms/);
  assert.match(r.paths['supervisor-worker'].problems.join('\n'), /worker: no worker_done/);
  const stop = fake.calls.filter((c) => c[0] === 'worker-stop').map((c) => c[1].dispatch);
  assert.deepEqual(stop, ['ctx_worker'], 'only the unsettled worker is stopped');
  const closed = fake.calls.find((c) => c[0] === 'task-update')[1];
  assert.deepEqual([closed.id, closed.status, closed.from], ['task_worker', 'failed', 'term_supervisor']);
  assert.equal(r.cleanup.find((c) => c.role === 'worker').released, true);
});

test('with no entry terminal or no app repository the smoke starts nothing', async (t) => {
  const fake = fakeOrca(t);
  const r = await smoke(fake, { entry: null });
  assert.equal(r.ok, false);
  assert.match(r.error, /no entry terminal/);
  const r2 = await smoke(fake, { appRepo: null });
  assert.match(r2.error, /no app repository: pass --app-repo/);
  assert.deepEqual(fake.calls, []);
});

test('a stage refuses to start a child from a terminal that is not the one launched for its role', async (t) => {
  const fake = fakeOrca(t);
  const state = fs.mkdtempSync(path.join(fake.tmp, 'starci-launch-smoke-'));
  fs.writeFileSync(path.join(state, 'plan.json'), JSON.stringify({ noop }));
  fs.mkdirSync(path.join(state, 'agents'));
  fs.writeFileSync(path.join(state, 'agents', 'kernel.json'), JSON.stringify({ role: 'kernel', terminal: 'term_kernel', dispatchId: 'ctx_kernel' }));
  const r = await runStage({ role: 'kernel', state, orca: fake.client, env: { ORCA_TERMINAL_HANDLE: 'term_other' }, sleep: async () => {} });
  assert.equal(r.ok, false);
  assert.match(r.error, /term_other is not the terminal term_kernel/);
  assert.equal(fake.names().includes('worker-start'), false);
});

test('the no-op agent is the cheapest priced model a runtimes.yaml pool pins, with that tier effort', () => {
  const runtimes = { runtimes: {
    a: { provider: 'claude', models: { easy: 'big', hard: 'big' } },
    b: { provider: 'codex', models: { easy: 'small', hard: 'mid' }, effort: { easy: 'low', hard: 'high' } },
    c: { provider: 'devin', models: { medium: 'unpriced' } } } };
  const prices = { models: { big: { input: 4, output: 20 }, mid: { input: 2, output: 10 }, small: { input: 0.1, output: 0.5 }, unpriced: { input: null, output: null } } };
  assert.deepEqual(noopAgent({ runtimes, prices }), { provider: 'codex', model: 'small', effort: 'low', pool: 'b', tier: 'easy', usdPerMTok: 0.6 });
  assert.match(noopAgent({ runtimes: { runtimes: { c: runtimes.runtimes.c } }, prices }).error, /no runtimes.yaml pool pins a priced model/);
  const live = noopAgent();
  assert.ok(live.provider && live.model, 'the shipped runtimes.yaml has a priced no-op model');
});

test('a parent spec runs its stage then worker_done; a leaf spec marks its line then worker_done', () => {
  const parent = noopSpec({ role: 'op', script: 'D:/r/scripts/kernel/launch-smoke.mjs' });
  assert.match(parent, /node "D:\/r\/scripts\/kernel\/launch-smoke.mjs" stage --as op$/m, 'the command names only the role: nothing random to mistype');
  assert.match(parent, /timeout of at least 300 seconds/);
  assert.deepEqual(CHILDREN, { supervisor: ['worker'], kernel: ['op', 'opFe'], op: ['critic'] }, 'the smoke itself starts opFail, never a stage');
  for (const role of ['critic', 'opFe', 'opFail']) {
    const leaf = noopSpec({ role, script: 'D:/r/scripts/kernel/launch-smoke.mjs' });
    assert.match(leaf, new RegExp(` mark --as ${role}$`, 'm'));
    assert.doesNotMatch(leaf, / stage /);
  }
  for (const s of [parent, noopSpec({ role: 'critic' })]) {
    assert.match(s, /report worker_done exactly once/);
    assert.match(s, /never quit or exit it/, 'an agent that quits itself leaves its release unknown (live run 2)');
  }
});

test('worker-start worktree arguments map to the launcher options; main manifests diff by bytes', (t) => {
  assert.deepEqual(worktreeParamsOf(['--worktree', 'D:/wt']), { worktree: 'D:/wt' });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-launch-smoke-manifest-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const app = scratchApp(tmp);
  const g = (args, dir) => gitResult(args, { dir });
  const before = mainManifest({ appRoot: app, git: g });
  assert.equal(before.ok, true);
  assert.deepEqual(before.nodeModules, ['left-pad']);
  assert.equal(Object.keys(before.files).includes('node_modules/left-pad/index.js'), false, 'only tracked files are compared');
  fs.writeFileSync(path.join(app, 'fe/apps/web/page.tsx'), 'export const fe = 2;\n');
  fs.rmSync(path.join(app, 'node_modules'), { recursive: true });
  const after = mainManifest({ appRoot: app, git: g });
  assert.deepEqual(manifestDiff(before, after), { added: [], changed: ['fe/apps/web/page.tsx'], removed: [], nodeModulesSame: false });
});

test('the live client loads every runtime launcher, wrapper and workflow-worktree function the smoke calls (no call is made)', async () => {
    const { defaultClient } = await import('../../scripts/kernel/launch-smoke.mjs');
    const client = await defaultClient();
    for (const k of ['startAgent', 'startWorkerAgent', 'criticWorkspace', 'removeCriticWorkspace', 'launchCriticWorker', 'workerShow', 'workerRead', 'workerStop', 'workerRelease', 'taskUpdate', 'worktreeList', 'git']) {
      assert.equal(typeof client[k], 'function', k);
    }
    for (const k of ['spec', 'ensure', 'of', 'opArgs', 'sideOf', 'canDispatchConcurrently', 'release', 'checkpointOp', 'gateBaseOf', 'preserveAndReset', 'finish']) {
      assert.equal(typeof client.workflow[k], 'function', `workflow.${k}`);
    }
  });

test('an agent finds its smoke run by its own terminal; without a handle only an unambiguous run is taken', async (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-launch-smoke-resolve-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const parent = stateParentOf(tmp);
  const run = (name, terminal, marked = false) => {
    const d = path.join(parent, name);
    fs.mkdirSync(path.join(d, 'agents'), { recursive: true });
    fs.writeFileSync(path.join(d, 'plan.json'), JSON.stringify({ noop }));
    fs.writeFileSync(path.join(d, 'agents', 'kernel.json'), JSON.stringify({ role: 'kernel', terminal }));
    if (marked) markResult({ role: 'kernel', state: d });
    return d;
  };
  const a = run('run-a', 'term_a', true);
  const b = run('run-b', 'term_b');
  const opts = { role: 'kernel', parent, waitMs: 0 };
  assert.equal((await resolveState({ ...opts, env: { ORCA_TERMINAL_HANDLE: 'term_a' } })).state, a);
  assert.equal((await resolveState({ ...opts, env: { ORCA_TERMINAL_HANDLE: 'term_b' } })).state, b);
  assert.match((await resolveState({ ...opts, env: { ORCA_TERMINAL_HANDLE: 'term_x' } })).error, /launched kernel into terminal term_x/);
  assert.equal((await resolveState({ ...opts, env: {} })).state, b, 'no handle: the one run whose kernel is not yet marked');
  run('run-c', 'term_c');
  assert.match((await resolveState({ ...opts, env: {} })).error, /2 smoke runs launched kernel/);
});

test('a release_unknown is retried once under a fresh request; a second refusal fails the path with the release state', async (t) => {
  const fake = fakeOrca(t, { releaseUnknownOnce: 'supervisor' });
  const r = await smoke(fake);
  assert.equal(r.ok, true, JSON.stringify(r.paths));
  assert.deepEqual(fake.calls.filter((c) => c[0] === 'worker-release' && c[1].dispatch === 'ctx_supervisor').length, 2);
  assert.equal(r.cleanup.find((c) => c.role === 'supervisor').releaseRetried, true);
  const stuck = fakeOrca(t);
  stuck.client.workerRelease = (a) => (a.dispatch === 'ctx_supervisor' ? { ok: false, state: 'release_unknown', result: { lastError: 'not verified' } } : { ok: true });
  const r2 = await smoke(stuck);
  assert.equal(r2.paths['supervisor-worker'].status, 'failed');
  assert.match(r2.paths['supervisor-worker'].problems.join(), /supervisor: not released/);
  assert.deepEqual([r2.cleanup.find((c) => c.role === 'supervisor').releaseState, r2.cleanup.find((c) => c.role === 'supervisor').releaseError], ['release_unknown', 'not verified']);
});

test('the Kernel stage holds until the driver releases it, so opFail starts under a live Kernel; the hold is bounded', async (t) => {
  const { holdStage, releaseStageHold } = await import('../../scripts/kernel/launch-smoke-hold.mjs');
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-hold-'));
  t.after(() => fs.rmSync(state, { recursive: true, force: true }));
  let ticks = 0;
  const sleep = async () => { ticks += 1; if (ticks === 3) releaseStageHold(state, 'kernel'); };
  assert.equal(await holdStage({ state, role: 'kernel', holdMs: 60000, sleep }), true, 'released by the driver');
  assert.equal(ticks, 3, 'it waited until the release, no longer');
  const other = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-hold-'));
  t.after(() => fs.rmSync(other, { recursive: true, force: true }));
  let clock = 0;
  assert.equal(await holdStage({ state: other, role: 'kernel', holdMs: 5000, sleep: async () => { clock += 1000; }, now: () => clock }), false, 'never released: bounded by holdMs');
  assert.equal(await holdStage({ state: other, role: 'kernel', holdMs: 0, sleep }), false, 'holdMs 0 waits for nothing');
});

test('the be op payload is prettier-clean, so the finish gate (HFS_FORMAT) never reds on the smoke\'s own file', async () => {
  const prettier = await import('prettier');
  for (const role of ['op', 'opFail']) {
    const text = ownedTextOf(role, 'smoke-abcdef12');
    const file = ownedFileOf(role, 'smoke-abcdef12', 'web');
    assert.equal(await prettier.format(text, { filepath: file }), text, `${role}'s payload is already what prettier writes`);
    assert.equal(JSON.parse(text).role, role);
  }
});
