import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROLES, SMOKE_SCHEMA, noopAgent, noopSpec, runSmoke, runStage, markResult, resolveState, stateParentOf } from '../scripts/kernel/launch-smoke.mjs';
import { startAgent } from '../scripts/agent/lib.mjs';
import { startWorkerAgent } from '../scripts/supervisor/workers.mjs';
import { launchCriticWorker } from '../scripts/work/draw-critic.mjs';

// The pre-workflow launch smoke (scripts/kernel/launch-smoke.mjs, starci/launch-smoke@1) drives the runtime's own
// launchers - startAgent (Supervisor, Kernel, the api dispatch shape of an Op), workers.mjs startWorkerAgent ([Worker])
// and draw-critic.mjs launchCriticWorker (the critic on its criticWorkspace placement) - against a fake Orca at the
// wrapper level: Runs, Tasks, worker-start, dispatch-show, worker-show (depth and creator Dispatch, the way Orca
// reports them), worker-read, worker-stop, worker-release, task-update and the inbox. Each fake agent does what its
// no-op spec says: a parent runs its stage (starting its child from its own terminal), every agent marks its result
// line and sends worker_done. Nothing reaches a host.

const titleRole = (title) => Object.entries(ROLES).find(([, r]) => r.title === title)?.[0] ?? (String(title).startsWith('[Critic]') ? 'critic' : null);

function fakeOrca(t, { refuse = null, silent = null } = {}) {
  const calls = [];
  const tasks = new Map();
  const workers = new Map();
  const byTerminal = new Map();
  const messages = [];
  const pending = [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-launch-smoke-spec-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  let runs = 0;
  const rec = (name, fn) => (args = {}) => { calls.push([name, args]); return fn(args); };
  const wrappers = {
    runShow: rec('run-show', () => ({ ok: false })),
    runCreate: rec('run-create', ({ from }) => { runs += 1; return { ok: true, runId: `run_${runs}`, from }; }),
    taskCreate: rec('task-create', ({ run, displayName, spec, from }) => {
      const taskId = `task_${titleRole(displayName)}`;
      tasks.set(taskId, { role: titleRole(displayName), run, spec, from });
      return { ok: true, taskId };
    }),
    trust: rec('trust', () => ({ status: 'already', paths: [] })),
    workerStart: rec('worker-start', ({ task, from, worktree, agent, model }) => {
      const { role, spec } = tasks.get(task);
      if (role === refuse) return { ok: false, outcome: 'failed', effectState: 'none', dispatchId: null, errorCode: 'selector_not_found', error: `selector_not_found: path:${worktree}` };
      const creator = byTerminal.get(from) ?? null;
      const w = { id: `ctx_${role}`, role, task, terminal: `term_${role}`, agent, model, depth: creator ? creator.depth + 1 : 1,
        creatorDispatchId: creator?.id ?? null, status: 'dispatched', state: 'ready', worktree, spec };
      workers.set(w.id, w);
      byTerminal.set(w.terminal, w);
      pending.push(w);
      return { ok: true, outcome: 'ok', effectState: 'committed', dispatchId: w.id, state: 'ready' };
    }),
    dispatchShow: rec('dispatch-show', ({ task }) => ({ ok: true, assigneeHandle: `term_${tasks.get(task).role}` })),
    terminalRename: rec('terminal-rename', () => ({ ok: true })),
    workerShow: rec('worker-show', ({ dispatch }) => {
      const w = workers.get(dispatch);
      return w ? { ok: true, state: w.state, effective: { agent: w.agent, model: w.model },
        dispatch: { id: w.id, status: w.status, depth: w.depth, creatorDispatchId: w.creatorDispatchId, taskId: w.task } } : { ok: false, state: null };
    }),
    workerRead: rec('worker-read', ({ dispatch }) => ({ ok: workers.has(dispatch), source: 'transcript', rows: [{ text: 'done' }] })),
    workerStop: rec('worker-stop', ({ dispatch }) => { const w = workers.get(dispatch); w.status = 'failed'; w.state = 'stopped'; return { ok: true }; }),
    workerRelease: rec('worker-release', ({ dispatch }) => { workers.get(dispatch).released = true; return { ok: true }; }),
    taskUpdate: rec('task-update', ({ id, status }) => ({ ok: true, taskId: id, status })),
    inbox: rec('inbox', () => ({ ok: true, messages: [...messages] })),
  };
  const io = { runShow: wrappers.runShow, runCreate: wrappers.runCreate, taskCreate: wrappers.taskCreate,
    spawn: { trust: wrappers.trust, start: wrappers.workerStart, assignee: wrappers.dispatchShow, rename: wrappers.terminalRename,
      show: wrappers.workerShow, stop: wrappers.workerStop, release: wrappers.workerRelease } };
  const client = {
    startAgent: (opts) => startAgent({ ...opts, io }),
    startWorkerAgent: (opts) => startWorkerAgent({ ...opts, start: client.startAgent }),
    // The placement is a temp directory here; tests/draw-critic-worker-start.spec.mjs proves the real worktree placement.
    criticWorkspace: rec('critic-workspace', () => ({ ok: true, dir: fs.mkdtempSync(path.join(tmp, 'starci-draw-critic-')), repoRoot: tmp })),
    removeCriticWorkspace: rec('critic-workspace-remove', ({ dir }) => { fs.rmSync(dir, { recursive: true, force: true }); return { ok: true }; }),
    launchCriticWorker: (opts) => launchCriticWorker({ ...opts, orca: { ...wrappers } }),
    workerShow: wrappers.workerShow, workerRead: wrappers.workerRead, workerStop: wrappers.workerStop,
    workerRelease: wrappers.workerRelease, taskUpdate: wrappers.taskUpdate, inbox: wrappers.inbox,
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
        ? await runStage({ role, state, orca: client, env, sleep: async () => {} })
        : markResult({ role, state });
      w.status = stage.ok ? 'completed' : 'failed';
      messages.unshift({ id: `m_${w.role}`, type: 'worker_done', from_handle: w.terminal, payload: JSON.stringify({ dispatchId: w.id, taskId: w.task }) });
    }
  };
  return { client, calls, workers, tmp, tick, names: () => calls.map((c) => c[0]) };
}

const clock = (fake) => { let now = 0; return { now: () => now, sleep: async (ms) => { now += ms; await fake.tick(); } }; };
const noop = { provider: 'codex', model: 'gpt-6-luna', effort: 'low' };
const smoke = (fake, extra = {}) => runSmoke({ entry: 'term_entry', orca: fake.client, noop, stateRoot: fake.tmp, root: fake.tmp, pollMs: 1000, timeoutMs: 60000, ...clock(fake), ...extra });

test('both nesting paths start through the runtime launchers at the depth Orca reports, and every agent is released', async (t) => {
  const fake = fakeOrca(t);
  const r = await smoke(fake);
  assert.equal(r.schema, SMOKE_SCHEMA);
  assert.equal(r.ok, true, JSON.stringify(r, null, 2));
  assert.deepEqual(r.paths['supervisor-worker'], { status: 'ok', depths: { supervisor: 1, worker: 2 } });
  assert.deepEqual(r.paths['op-critic'], { status: 'ok', depths: { kernel: 1, op: 2, critic: 3 } });
  const starts = fake.calls.filter((c) => c[0] === 'worker-start').map((c) => c[1]);
  assert.equal(starts.length, 5, 'one worker-start per agent');
  for (const s of starts) assert.deepEqual([s.agent, s.model, s.effort], ['codex', 'gpt-6-luna', 'low'], 'every no-op agent runs the cheapest model');
  const startOf = (role) => starts.find((s) => fake.workers.get(`ctx_${role}`).task === s.task);
  assert.equal(startOf('supervisor').from, 'term_entry');
  assert.equal(startOf('kernel').from, 'term_entry');
  assert.equal(startOf('worker').from, 'term_supervisor', 'the [Worker] is started from the Supervisor terminal, in its Run');
  assert.equal(startOf('op').from, 'term_kernel', 'the Op is started from the Kernel terminal (worker-start --task --run --from)');
  assert.equal(startOf('critic').from, 'term_op', 'the critic is started from the Op terminal');
  const runFroms = fake.calls.filter((c) => c[0] === 'run-create').map((c) => c[1].from).sort();
  assert.deepEqual(runFroms, ['term_entry', 'term_entry', 'term_kernel', 'term_op', 'term_supervisor'], 'each parent creates and coordinates the Run of its child');
  assert.equal(fake.calls.some(([n, a]) => n === 'task-create' && a.parent), false, 'no Task names a --parent');
  assert.equal(startOf('critic').worktree, r.agents.critic.workspace.replaceAll('/', path.sep), 'the critic is placed on draw-critic criticWorkspace');
  assert.equal(r.agents.critic.creatorDispatchId, 'ctx_op');
  for (const role of Object.keys(ROLES)) {
    assert.match(r.agents[role].result, new RegExp(`^${role} ok `), `${role} wrote its result line`);
    assert.equal(r.agents[role].workerDone, true);
    assert.equal(r.agents[role].read.ok, true);
  }
  const names = fake.names();
  const releases = fake.calls.filter((c) => c[0] === 'worker-release').map((c) => c[1].dispatch);
  assert.deepEqual(releases, ['ctx_critic', 'ctx_op', 'ctx_worker', 'ctx_kernel', 'ctx_supervisor'], 'released deepest first');
  assert.ok(names.lastIndexOf('worker-read') < names.indexOf('worker-release'), 'every worker is read before any release');
  assert.equal(names.includes('worker-stop'), false, 'a worker that sent worker_done is not stopped');
  assert.equal(names.includes('task-update'), false, 'worker_done settled every Task');
  assert.deepEqual(r.cleanup.find((c) => c.role === 'critic'), { role: 'critic', dispatchId: 'ctx_critic', stopped: null, released: true, taskClosed: 'by-worker_done', workspaceRemoved: true });
  assert.deepEqual(fs.readdirSync(fake.tmp).filter((n) => n.startsWith('starci-draw-critic-')), [], 'the critic placement is removed');
  assert.deepEqual(fs.readdirSync(stateParentOf(fake.tmp)), [], 'the state directory is removed');
});

test('a refused critic placement fails the op-critic path only; every started agent is still released', async (t) => {
  const fake = fakeOrca(t, { refuse: 'critic' });
  const r = await smoke(fake);
  assert.equal(r.ok, false);
  assert.equal(r.paths['supervisor-worker'].status, 'ok');
  assert.equal(r.paths['op-critic'].status, 'failed');
  assert.match(r.paths['op-critic'].problems.join('\n'), /critic: not started .*selector_not_found/);
  assert.equal(r.agents.op.depth, 2, 'the Op still reached depth 2');
  assert.deepEqual(r.cleanup.map((c) => c.role), ['critic', 'op', 'worker', 'kernel', 'supervisor']);
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

test('with no entry terminal the smoke starts nothing', async (t) => {
  const fake = fakeOrca(t);
  const r = await smoke(fake, { entry: null });
  assert.equal(r.ok, false);
  assert.match(r.error, /no entry terminal/);
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
  const leaf = noopSpec({ role: 'critic', script: 'D:/r/scripts/kernel/launch-smoke.mjs' });
  assert.match(leaf, / mark --as critic$/m);
  for (const s of [parent, leaf]) assert.match(s, /report worker_done exactly once/);
  assert.doesNotMatch(leaf, / stage /);
});

test('the live client loads every runtime launcher and wrapper the smoke calls (no call is made)', async () => {
  const { defaultClient } = await import('../scripts/kernel/launch-smoke.mjs');
  const client = await defaultClient();
  for (const k of ['startAgent', 'startWorkerAgent', 'criticWorkspace', 'removeCriticWorkspace', 'launchCriticWorker', 'workerShow', 'workerRead', 'workerStop', 'workerRelease', 'taskUpdate', 'inbox']) {
    assert.equal(typeof client[k], 'function', k);
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
