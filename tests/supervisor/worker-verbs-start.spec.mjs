// worker-verbs-start.spec.mjs - admission and call-file seams of the lead-facing worker start verb.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { workerStartVerb } from '../../scripts/supervisor/worker-verbs-start.mjs';

const current = path.join(process.cwd(), 'lane-current');
const target = path.join(process.cwd(), 'lane-target');
const registry = () => ({
  runtimes: ['codex', 'claude', 'devin', 'cursor'],
  models: {
    'gpt-6-luna': { provider: 'codex' },
    'gpt-6.1-sol': { provider: 'codex' },
    'claude-opus-5-5': { provider: 'claude' },
  },
  pools: {
    'codex-agent': { provider: 'codex', maxParallel: 2, defaultModel: 'gpt-6-luna', models: { hard: 'gpt-6.1-sol' } },
    'claude-agent': { provider: 'claude', maxParallel: 1, defaultModel: 'claude-opus-5-5' },
    'devin-agent': { provider: 'devin', maxParallel: 2, defaultModel: 'swe-2-max' },
  },
  targets: { 'cursor-agent': { runtime: 'cursor', defaultModel: 'auto' }, 'claude-agent': { runtime: 'claude' } },
});
const runtimes = (r) => ({ runtimes: r.pools });
const ps = (agents = []) => ({ ok: true, worktrees: [
  { id: `repo::${current}`, repoId: 'repo', path: current, agents: [] },
  { id: `repo::${target}`, repoId: 'repo', path: target, agents },
] });
const ctx = (overrides = {}) => ({ cwd: current, env: { ORCA_TERMINAL_HANDLE: 'term_lead' }, args: {
  agent: 'codex', worktree: target, spec: 'Read briefs/worker.md completely', 'task-title': 'worker verbs', ...overrides,
} });
const deps = (overrides = {}) => {
  const r = registry();
  return { registry: r, runtimes: runtimes(r), worktreePs: () => ps(),
    workerStart: () => ({ ok: true, dispatchId: 'ctx_1', agentTerminalHandle: 'term_1', taskId: 'task_1', runId: 'run_1' }), ...overrides };
};

test('worker start validates then calls worker-start with the bound terminal and registered path', async () => {
  let call;
  const result = await workerStartVerb(ctx(), deps({ workerStart: (input) => {
    call = input;
    return { ok: true, dispatchId: 'ctx_1', agentTerminalHandle: 'term_1', taskId: 'task_1', runId: 'run_1' };
  } }));
  assert.equal(result.code, 0);
  assert.deepEqual({ agent: call.agent, model: call.model, worktree: call.worktree, from: call.from, title: call.taskTitle },
    { agent: 'codex', model: 'gpt-6-luna', worktree: `path:${target}`, from: 'term_lead', title: 'worker verbs' });
  assert.deepEqual([result.data.dispatchId, result.data.terminalHandle], ['ctx_1', 'term_1']);
});

test('worker start reads @file content through its injectable file seam', async () => {
  let spec;
  const result = await workerStartVerb(ctx({ spec: '@brief.md' }), deps({
    exists: () => true,
    readFile: () => 'Full brief\nwith steps',
    workerStart: (input) => { spec = input.spec; return { ok: true, dispatchId: 'ctx_2', agentTerminalHandle: 'term_2' }; },
  }));
  assert.equal(result.code, 0);
  assert.equal(spec, 'Full brief\nwith steps');
});

test('worker start refuses invalid agents, models, Devin models and unavailable declared agents', async () => {
  assert.equal((await workerStartVerb(ctx({ agent: 'other' }), deps())).code, 2);
  assert.match((await workerStartVerb(ctx({ model: 'gpt-unknown' }), deps())).text, /not registered/);
  assert.match((await workerStartVerb(ctx({ agent: 'devin', model: 'swe-2-max' }), deps())).text, /does not take --model/);
  const r = registry(); r.targets['claude-agent'].available = false;
  const unavailable = await workerStartVerb(ctx({ agent: 'claude' }), deps({ registry: r, runtimes: runtimes(r) }));
  assert.match(unavailable.text, /marked unavailable/);
});

test('worker start refuses an unregistered or other-repository worktree', async () => {
  const missing = await workerStartVerb(ctx({ worktree: path.join(process.cwd(), 'missing') }), deps());
  assert.match(missing.text, /not registered/);
  const other = deps({ worktreePs: () => ({ ok: true, worktrees: [
    { repoId: 'repo', path: current, agents: [] }, { repoId: 'other', path: target, agents: [] },
  ] }) });
  assert.match((await workerStartVerb(ctx(), other)).text, /not registered/);
});

test('worker start validates brief-shaped specs and explains consumer_fenced', async () => {
  assert.match((await workerStartVerb(ctx({ spec: 'write the code' }), deps())).text, /point to a brief file/);
  assert.match((await workerStartVerb(ctx({ spec: 'Read brief.md\nthen work' }), deps())).text, /one line/);
  const fenced = await workerStartVerb(ctx(), deps({ workerStart: () => ({ ok: false, errorCode: 'consumer_fenced' }) }));
  assert.equal(fenced.code, 2);
  assert.match(fenced.text, /run-create in this same terminal/);
});
