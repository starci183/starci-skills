import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateConfig } from '../../engine/config.mjs';
import { orcaSettings, ORCA_DEFAULTS } from '../../engine/orca-config.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { dispatchDepthOf, launchDepth, depthVerdict, compareMeasuredDepth, isOrcaDepthRefusal, WORKER_DEPTH_EXCEEDED, dispatchOfTerminal } from '../../scripts/lib/worker-depth.mjs';
import { spawnAgent, startAgent } from '../../scripts/agent/lib.mjs';
import { depthPreflight, entryDispatchOf } from '../../scripts/agent/depth-preflight.mjs';
import { probeWorkerDepth } from '../../scripts/agent/depth-probe.mjs';
import { guardsRoot } from '../../scripts/guards/guards-root.mjs';
import { depthItems } from '../../scripts/reconciler/depth-items.mjs';
import { DEFAULT_RUBRIC, runCritic } from '../../scripts/work/draw-critic.mjs';
import { fakeCriticOrca } from '../helpers/fake-critic-orca.mjs';
import { spawnSync } from 'node:child_process';
import { FAKE_ORCA } from '../helpers/fake-orca.mjs';
import { openLedger, inspectLedger, ledgerFileFor } from '../../engine/db/ledger.mjs';
import { seedWorkflow } from '../helpers/ledger-fixture.mjs';

// Contract change worker-depth-limit: Orca refuses a worker nested past its depth setting (nested_worker_depth_exceeded)
// and exposes no read of it. config.yaml orca.maxWorkerDepth declares it (default 4, the owner's Orca setting); the
// runtime refuses a deeper launch before worker-start (worker-depth-exceeded), and start --check compares it with a
// probe. Every Orca call here goes to a fake client.
const ROOT = path.resolve(import.meta.dirname, '..', '..');

test('orca.maxWorkerDepth: default 4, an explicit integer wins, anything else is refused', () => {
  assert.deepEqual(orcaSettings({}), { maxWorkerDepth: 4, source: 'default' });
  assert.equal(ORCA_DEFAULTS.maxWorkerDepth, 4);
  assert.deepEqual(orcaSettings({ orca: null }), { maxWorkerDepth: 4, source: 'default' });
  assert.deepEqual(orcaSettings({ orca: { maxWorkerDepth: null } }), { maxWorkerDepth: 4, source: 'default' });
  assert.deepEqual(orcaSettings({ orca: { maxWorkerDepth: 3 } }), { maxWorkerDepth: 3, source: 'orca' });
  for (const bad of [{ maxWorkerDepth: 0 }, { maxWorkerDepth: 17 }, { maxWorkerDepth: 2.5 }, { maxWorkerDepth: '4' }, { depth: 4 }, []])
    assert.throws(() => orcaSettings({ orca: bad }), /Invalid config\.yaml: orca/, JSON.stringify(bad));
  // The shipped example config carries the block and validates as a whole.
  const example = parseYaml(fs.readFileSync(path.join(ROOT, 'config.example.yaml'), 'utf8'));
  assert.equal(example.orca.maxWorkerDepth, 4);
  assert.equal(validateConfig(example).orca.maxWorkerDepth, 4);
  assert.throws(() => validateConfig({ ...example, orca: { maxWorkerDepth: -1 } }), /orca\.maxWorkerDepth/);
});

test('depth arithmetic: chat-rooted launches are depth 1, a nested one its parent + 1, past the limit a typed refusal', () => {
  assert.equal(dispatchDepthOf({ dispatch: { depth: 3 } }), 3);
  assert.equal(dispatchDepthOf({ result: { dispatch: { depth: '2' } } }), 2);
  assert.equal(dispatchDepthOf({ ok: false }), null);
  assert.equal(launchDepth({}), 1);
  assert.equal(launchDepth({ parentDispatch: 'd', parentDepth: 3 }), 4);
  assert.equal(launchDepth({ parentDispatch: 'd', parentDepth: null }), null, 'an unread parent proves nothing');
  assert.equal(depthVerdict({ depth: 4, maxDepth: 4 }), null);
  assert.equal(depthVerdict({ depth: null, maxDepth: 4 }), null);
  const v = depthVerdict({ depth: 5, maxDepth: 4 });
  assert.equal(v.code, WORKER_DEPTH_EXCEEDED);
  assert.match(v.error, /depth 5, deeper than orca\.maxWorkerDepth 4/);
  assert.equal(isOrcaDepthRefusal({ errorCode: 'nested_worker_depth_exceeded' }), true);
  assert.equal(isOrcaDepthRefusal({ errorCode: 'agent_unavailable' }), false);
  assert.equal(compareMeasuredDepth({ configured: 4, measured: 4 }).status, 'match');
  assert.match(compareMeasuredDepth({ configured: 4, measured: 3 }).detail, /refused depth 4 \(its limit is 3\)/);
  assert.equal(compareMeasuredDepth({ configured: 4, measured: null }).status, 'unmeasured');
});

// A spawnAgent io whose parent Dispatch reads `parentDepth`; every call is recorded.
const fakeSpawnIo = (parentDepth, calls = []) => {
  const rec = (name, fn) => (a = {}) => { calls.push(name); return fn(a); };
  return { calls, io: {
    trust: rec('trust', () => ({ status: 'ok', paths: [] })),
    start: rec('worker-start', () => ({ ok: true, outcome: 'ok', dispatchId: 'ctx_child', taskId: 'task_1', agentTerminalHandle: 'term_child' })),
    rename: rec('terminal-rename', () => ({ ok: true })),
    show: rec('worker-show', ({ dispatch }) => dispatch === 'ctx_parent'
      ? (parentDepth == null ? { ok: false, error: 'host unavailable' } : { ok: true, dispatch: { depth: parentDepth } })
      : { ok: true, state: 'ready', dispatch: { depth: (parentDepth ?? 0) + 1 }, effective: { agent: 'claude', model: 'claude-opus-4-7' } }),
    stop: rec('worker-stop', () => ({ ok: true })),
    release: rec('worker-release', () => ({ ok: true })),
  } };
};
const launch = (io, extra = {}) => spawnAgent({ provider: 'claude', model: 'claude-opus-4-7', worktree: ROOT, title: '[Op] depth', spec: 'judge', run: 'run_1', request: { job: 'depth' },
  parentDispatch: 'ctx_parent', io, ...extra });

test('spawnAgent refuses a worker nested past orca.maxWorkerDepth before anything is trusted or started', () => {
  const { io, calls } = fakeSpawnIo(4);
  const r = launch(io, { maxDepth: 4 });
  assert.equal(r.ok, false);
  assert.equal(r.step, 'depth');
  assert.equal(r.errorCode, 'worker-depth-exceeded');
  assert.equal(r.effectState, 'none');
  assert.deepEqual([r.depth, r.maxDepth, r.parentDispatch], [5, 4, 'ctx_parent']);
  assert.deepEqual(calls, ['worker-show'], 'only the parent was read: no trust, no worker-start');
});

test('spawnAgent starts a worker within the limit and records its attested depth; an unreadable parent proves nothing', () => {
  const within = fakeSpawnIo(3);
  const ok = launch(within.io, { maxDepth: 4 });
  assert.equal(ok.ok, true, ok.error);
  assert.deepEqual([ok.depth, ok.maxDepth], [4, 4]);
  assert.ok(within.calls.includes('worker-start'));
  const unread = fakeSpawnIo(null);
  const passed = launch(unread.io, { maxDepth: 1 });
  assert.equal(passed.ok, true, 'Orca stays the authority when the parent depth cannot be read');
  // No parent: a chat-rooted launch is depth 1, refused only by a limit below it (never valid config, a direct maxDepth).
  assert.equal(depthPreflight({ maxDepth: 1 }).refusal, null);
  assert.equal(depthPreflight({ maxDepth: 0 }).refusal.depth, 1);
});

test('startAgent refuses before its Run and Task exist, so a refused launch leaves nothing in Orca', () => {
  const calls = [];
  const { io } = fakeSpawnIo(4, calls);
  const rec = (name) => () => { calls.push(name); return { ok: true, runId: 'run_x', taskId: 'task_x' }; };
  const r = startAgent({ provider: 'claude', model: 'claude-opus-4-7', worktree: ROOT, title: '[Critic] depth', prompt: 'judge', objective: 'depth', request: { critic: 'depth' },
    parentDispatch: 'ctx_parent', maxDepth: 4, io: { runShow: rec('run-show'), runCreate: rec('run-create'), spawn: io } });
  assert.equal(r.step, 'depth');
  assert.equal(r.errorCode, 'worker-depth-exceeded');
  assert.deepEqual(calls, ['worker-show']);
});

test('the draw critic nests under its op: an op already at the deepest depth gets a typed launch-failed, no worker started', async (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-depth-critic-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const png = path.join(tmp, 'd.png');
  fs.writeFileSync(png, Buffer.from('89504e470d0a1a0a', 'hex'));
  const html = path.join(tmp, 'screen.html');
  fs.writeFileSync(html, '<html></html>');
  const orca = fakeCriticOrca();
  const show = orca.workerShow;
  // The op's Dispatch sits at the ceiling of any valid orca.maxWorkerDepth, so its critic is always one too deep.
  orca.workerShow = (a) => (a?.dispatch === 'ctx_op' ? (orca.calls.push(['worker-show', a]), { ok: true, dispatch: { depth: 16 } }) : show(a));
  const critique = await runCritic({ images: [{ path: png, label: 'd' }], html, rubric: DEFAULT_RUBRIC,
    critic: { provider: 'claude', model: 'claude-opus-4-7', timeoutMs: 1000 }, orca, placement: { tmpRoot: tmp }, parentDispatch: 'ctx_op', entry: 'term_op' });
  assert.equal(critique.outcome, 'launch-failed');
  assert.match(critique.error, /\(depth worker-depth-exceeded\)/);
  for (const name of ['run-create', 'task-create', 'worker-start']) assert.equal(orca.names().includes(name), false, `${name} never ran`);
});

test('the depth probe nests no-op workers until Orca refuses for depth, then releases every one deepest first', async () => {
  const starts = [];
  const cleanup = [];
  const start = (opts) => {
    const depth = starts.length + 1;
    starts.push({ from: opts.entry, maxDepth: opts.maxDepth });
    if (depth === 5) return { ok: false, step: 'worker-start', error: 'refused', errorCode: 'nested_worker_depth_exceeded', effectState: 'none' };
    return { ok: true, depth, dispatchId: `ctx_${depth}`, terminal: `term_${depth}` };
  };
  const out = await probeWorkerDepth({ entry: 'term_chat', worktree: ROOT, start,
    stop: ({ dispatch }) => { cleanup.push(`stop ${dispatch}`); return { ok: true }; },
    release: ({ dispatch }) => { cleanup.push(`release ${dispatch}`); return { ok: true }; } });
  assert.deepEqual({ ok: out.ok, measured: out.measured, refusedAt: out.refusedAt, depths: out.depths }, { ok: true, measured: 4, refusedAt: 5, depths: [1, 2, 3, 4] });
  assert.deepEqual(starts.map((s) => s.from), ['term_chat', 'term_1', 'term_2', 'term_3', 'term_4'], 'each level is coordinated by the one above it');
  assert.ok(starts.every((s) => s.maxDepth > 16), 'the runtime preflight never refuses the probe');
  assert.deepEqual(cleanup, ['stop ctx_4', 'release ctx_4', 'stop ctx_3', 'release ctx_3', 'stop ctx_2', 'release ctx_2', 'stop ctx_1', 'release ctx_1']);
  assert.ok(out.released.every((w) => w.released));
  // A start that fails for another reason is unmeasured, and what started is still released.
  const other = await probeWorkerDepth({ worktree: ROOT, start: (o) => (o.entry ? { ok: false, step: 'worker-start', error: 'agent_unavailable' } : { ok: true, dispatchId: 'ctx_a', terminal: 'term_a' }),
    stop: () => ({ ok: true }), release: () => ({ ok: true }) });
  assert.deepEqual([other.ok, other.measured, other.released.length], [false, null, 1]);
  assert.match(other.error, /depth 2: worker-start agent_unavailable/);
});

test('start --check: the orca-depth row reports the config, and with STARCI_ORCA_LIVE=1 compares it with the probe', async () => {
  const config = { orca: { maxWorkerDepth: 4 } };
  const [plain] = await depthItems({ env: {}, config, orcaOk: true, probe: () => { throw new Error('never probed without opt-in'); } });
  assert.equal(plain.status, 'green');
  assert.match(plain.detail, /orca\.maxWorkerDepth 4 \(orca\); it must equal the Orca app's worker depth setting; not measured/);
  const live = { STARCI_ORCA_LIVE: '1' };
  const probe = (measured, released = true) => async () => ({ ok: measured != null, measured, depths: [1, 2, 3], released: [{ dispatchId: 'ctx_1', released }], error: measured == null ? 'boom' : null });
  assert.equal((await depthItems({ env: live, config, orcaOk: true, probe: probe(4) }))[0].status, 'green');
  const mismatch = (await depthItems({ env: live, config, orcaOk: true, probe: probe(3) }))[0];
  assert.equal(mismatch.status, 'red');
  assert.match(mismatch.fix, /orca\.maxWorkerDepth: 3/);
  assert.equal((await depthItems({ env: live, config, orcaOk: true, probe: probe(null) }))[0].status, 'warn');
  assert.equal((await depthItems({ env: live, config, orcaOk: false, probe: probe(4) }))[0].status, 'warn');
  const leaked = (await depthItems({ env: live, config, orcaOk: true, probe: probe(4, false) }))[0];
  assert.equal(leaked.status, 'red');
  assert.match(leaked.detail, /could not release ctx_1/);
  assert.equal((await depthItems({ env: {}, config: { orca: { maxWorkerDepth: 99 } } }))[0].status, 'red');
});

test('starci kernel dispatch refuses an op whose Kernel already sits at orca.maxWorkerDepth, before its Task exists, and spends no try', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-depth-dispatch-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  // starci kernel dispatch prepares the op's job scratch under the temp root (op-prompt JOB_SCRATCH_ROOT).
  if (process.env.STARCI_TEST_TEMP_DIR) t.after(() => fs.rmSync(path.join(process.env.STARCI_TEST_TEMP_DIR, 'starci-job-scratch'), { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const repo = path.join(root, 'repo');
  fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
  const ownerRoot = path.join(root, 'owner');
  fs.mkdirSync(ownerRoot);
  fs.writeFileSync(path.join(ownerRoot, 'config.yaml'), 'language: vi\neffort: medium\nkernel: {agent: codex, model: gpt-6-sol, effort: high}\n');
  const fake = path.join(root, 'fake-orca.mjs');
  const state = path.join(root, 'orca-state.json');
  const log = path.join(root, 'calls.jsonl');
  fs.writeFileSync(state, JSON.stringify({ sends: 0, counter: 0, terminals: {}, commands: [] }));
  fs.writeFileSync(fake, FAKE_ORCA.replaceAll("'dispatch-fake-1'", "(state.dispatchSeq=(state.dispatchSeq??0)+1,'dispatch-fake-'+state.dispatchSeq)"));
  const env = { ...process.env, STARCI_ORCA_COMMAND: process.execPath, STARCI_ORCA_ARGS: JSON.stringify([fake]), STARCI_FAKE_ORCA_STATE: state,
    STARCI_FAKE_ORCA_LOG: log, STARCI_FAKE_ORCA_UNIQUE_TERMINALS: '1', STARCI_OWNER_ROOT: ownerRoot, STARCI_TEST_MACHINE_FILE: path.join(root, 'machine.sqlite'),
    STARCI_SLEEP_SCALE: '0.02', ORCA_TERMINAL_HANDLE: '' };
  const run = (rel, ...args) => spawnSync(process.execPath, [path.join(ROOT, ...rel), ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000, env });
  const defined = run(['scripts', 'goal', 'define-goal.mjs'], '--repo', repo, '--text', 'depth limited workflow', '--json');
  assert.equal(defined.status, 0, defined.stderr);
  const workflowId = JSON.parse(defined.stdout).workflowId;
  const started = run(['scripts', 'kernel', 'start-workflow.mjs'], '--repo', repo, '--goal', workflowId, '--json');
  assert.equal(started.status, 0, started.stderr);
  const kernelDispatch = JSON.parse(started.stdout).dispatch;
  const handle = JSON.parse(started.stdout).terminal;
  t.after(() => { for (const f of [path.join(guardsRoot(ROOT), 'terminals', `${handle}.json`), path.join(guardsRoot(ROOT), 'jobs', `kernel-${workflowId}.json`)]) fs.rmSync(f, { force: true }); });
  // Orca reports the Kernel at depth 4, the default orca.maxWorkerDepth: its op would be depth 5.
  const s = JSON.parse(fs.readFileSync(state, 'utf8'));
  fs.writeFileSync(state, JSON.stringify({ ...s, dispatchDepths: { [kernelDispatch]: 4 } }));
  fs.mkdirSync(path.join(repo, 'docs', 'a'), { recursive: true });
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  try { seedWorkflow(ledger, { id: workflowId, jobs: [{ jobId: 'job-deep', opId: 'code.refactor', payload: { opId: 'code.refactor', owned_paths: ['docs/a/'], model: 'claude-agent' } }] }); }
  finally { ledger.close(); }
  const callsBefore = fs.readFileSync(log, 'utf8').trim().split('\n').length;
  const d = run(['scripts', 'kernel', 'cli.mjs'], 'dispatch', '--repo', repo, '--job', 'job-deep', '--model', 'claude-agent', '--spawn', '--json');
  assert.equal(d.status, 1, d.stdout);
  const out = JSON.parse(d.stdout);
  assert.equal(out.rejected, 'dispatch-rejected');
  assert.equal(out.managed.step, 'depth');
  assert.equal(out.managed.code, 'worker-depth-exceeded');
  const after = fs.readFileSync(log, 'utf8').trim().split('\n').slice(callsBefore).map((l) => JSON.parse(l).argv.slice(0, 2).join(' '));
  for (const verb of ['orchestration task-create', 'orchestration worker-start']) assert.equal(after.includes(verb), false, `${verb} never ran`);
  const reader = inspectLedger({ file: ledgerFileFor(repo) });
  try { assert.equal(reader.db.prepare('SELECT status FROM jobs WHERE job_id=?').get('job-deep').status, 'ready', 'no try spent: the job is ready again'); }
  finally { reader.close(); }
});

test('a launching terminal that is itself a worker maps to its Dispatch through worker-list; a chat or shell maps to none', () => {
  const rows = [{ dispatchId: 'ctx_sup', resource: { terminalHandle: 'term_sup' }, terminalState: 'active' },
    { dispatchId: 'ctx_old', agentTerminalHandle: 'term_old', terminalState: 'active' }];
  assert.equal(dispatchOfTerminal(rows, 'term_sup'), 'ctx_sup');
  assert.equal(dispatchOfTerminal(rows, 'term_old'), 'ctx_old');
  assert.equal(dispatchOfTerminal(rows, 'term_chat'), null);
  assert.equal(dispatchOfTerminal(rows, null), null);
  assert.equal(entryDispatchOf('term_sup', { list: () => ({ ok: true, workers: rows }) }), 'ctx_sup');
  assert.equal(entryDispatchOf('term_sup', { list: () => ({ ok: false, error: 'host unavailable' }) }), null, 'a failed listing proves nothing');
  assert.equal(entryDispatchOf('term_sup', { list: () => { throw new Error('boom'); } }), null);
  assert.equal(entryDispatchOf(null, { list: () => { throw new Error('never listed'); } }), null);
  // startAgent with no parent named reads the entry's Dispatch: a worker already at the limit cannot start another.
  const calls = [];
  const { io } = fakeSpawnIo(4, calls);
  const rec = (name, out) => () => { calls.push(name); return out; };
  const refused = startAgent({ provider: 'claude', model: 'claude-opus-4-7', worktree: ROOT, title: '[Kernel] depth', prompt: 'x', objective: 'depth', request: { kernel: 'depth' },
    entry: 'term_parent', maxDepth: 4, io: { runShow: rec('run-show', { ok: false }), runCreate: rec('run-create', { ok: true, runId: 'r' }),
      workerList: rec('worker-list', { ok: true, workers: [{ dispatchId: 'ctx_parent', resource: { terminalHandle: 'term_parent' } }] }), spawn: io } });
  assert.equal(refused.step, 'depth');
  assert.deepEqual([refused.depth, refused.parentDispatch], [5, 'ctx_parent']);
  assert.deepEqual(calls, ['worker-list', 'worker-show']);
});

test('start-workflow from a worker terminal at the depth limit refuses the Kernel before worker-start', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-depth-kernel-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const repo = path.join(root, 'repo');
  fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
  const ownerRoot = path.join(root, 'owner');
  fs.mkdirSync(ownerRoot);
  fs.writeFileSync(path.join(ownerRoot, 'config.yaml'), 'language: vi\neffort: medium\nkernel: {agent: codex, model: gpt-6-sol, effort: high}\n');
  const fake = path.join(root, 'fake-orca.mjs');
  const state = path.join(root, 'orca-state.json');
  const log = path.join(root, 'calls.jsonl');
  // The launching terminal term_sup is an active worker (the Supervisor's seat) that Orca reports at depth 4.
  fs.writeFileSync(state, JSON.stringify({ sends: 0, counter: 0, terminals: {}, commands: [],
    workerRows: [{ dispatchId: 'ctx_sup', runId: 'run_sup', terminalState: 'active', resource: { terminalHandle: 'term_sup' } }], dispatchDepths: { ctx_sup: 4 } }));
  fs.writeFileSync(fake, FAKE_ORCA);
  const env = { ...process.env, STARCI_ORCA_COMMAND: process.execPath, STARCI_ORCA_ARGS: JSON.stringify([fake]), STARCI_FAKE_ORCA_STATE: state,
    STARCI_FAKE_ORCA_LOG: log, STARCI_FAKE_ORCA_UNIQUE_TERMINALS: '1', STARCI_OWNER_ROOT: ownerRoot, STARCI_TEST_MACHINE_FILE: path.join(root, 'machine.sqlite'),
    STARCI_SLEEP_SCALE: '0.02', ORCA_TERMINAL_HANDLE: 'term_sup' };
  const run = (rel, ...args) => spawnSync(process.execPath, [path.join(ROOT, ...rel), ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000, env });
  const defined = run(['scripts', 'goal', 'define-goal.mjs'], '--repo', repo, '--text', 'kernel from a deep worker', '--json');
  assert.equal(defined.status, 0, defined.stderr);
  const workflowId = JSON.parse(defined.stdout).workflowId;
  t.after(() => fs.rmSync(path.join(guardsRoot(ROOT), 'jobs', `kernel-${workflowId}.json`), { force: true }));
  const started = run(['scripts', 'kernel', 'start-workflow.mjs'], '--repo', repo, '--goal', workflowId, '--json');
  assert.equal(started.status, 1, started.stdout);
  const failure = JSON.parse(started.stderr.trim().split(/\r?\n/).filter((l) => l.startsWith('{')).pop());
  assert.equal(failure.step, 'depth');
  assert.equal(failure.errorCode, 'worker-depth-exceeded');
  const verbs = fs.readFileSync(log, 'utf8').trim().split(/\r?\n/).map((l) => JSON.parse(l).argv.slice(0, 2).join(' '));
  assert.ok(verbs.includes('orchestration worker-list'));
  for (const verb of ['orchestration run-create', 'orchestration task-create', 'orchestration worker-start']) assert.equal(verbs.includes(verb), false, `${verb} never ran`);
});
