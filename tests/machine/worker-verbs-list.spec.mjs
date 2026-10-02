// worker-verbs-list.spec.mjs - worker row projection and floor-check replacement aggregation.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { workerListVerb, workingByLane, worktreesWithWorkingAgents } from '../../scripts/machine/worker-verbs-list.mjs';

const a = path.join(process.cwd(), 'lane-a');
const b = path.join(process.cwd(), 'lane-b');
const worktrees = [
  { worktreeId: `repo::${a}`, repoId: 'repo', path: a, agents: [
    { state: 'working', agentType: 'codex' }, { state: 'working', agentType: 'codex' }, { state: 'idle', agentType: 'claude' },
  ] },
  { worktreeId: `repo::${b}`, repoId: 'repo', path: b, agents: [
    { state: 'working', agentType: 'claude' }, { state: 'working', agentType: 'devin' },
  ] },
];

test('workingByLane copies the worktree-ps grouping shape and counts only working agents', () => {
  assert.deepEqual(workingByLane(worktrees), [
    { worktree: a, byAgent: { codex: 2 } },
    { worktree: b, byAgent: { claude: 1, devin: 1 } },
  ]);
});

test('normalized worktree-ps rows recover working agent types through terminal-list', async () => {
  const calls = [];
  const result = await worktreesWithWorkingAgents([{ repoId: 'repo', path: a }], ({ worktree }) => {
    calls.push(worktree);
    return { ok: true, terminals: [
      { connected: true, agentIdentity: 'codex' }, { connected: false, agentIdentity: 'claude' }, { connected: true, agentIdentity: null },
    ] };
  });
  assert.deepEqual(calls, [`path:${a}`]);
  assert.deepEqual(result.worktrees[0].agents, [{ state: 'working', agentType: 'codex' }]);
});

test('worker list --by-lane returns lane counts and the host total', async () => {
  const result = await workerListVerb({ cwd: process.cwd(), args: { 'by-lane': true } }, { worktreePs: () => ({ ok: true, worktrees }) });
  assert.equal(result.code, 0);
  assert.deepEqual(result.data, { schema: 'starci/worker-list@1', ok: true, lanes: [
    { worktree: a, byAgent: { codex: 2 } }, { worktree: b, byAgent: { claude: 1, devin: 1 } },
  ], total: 4 });
  assert.match(result.text, /host total 4/);
});

test('worker list keeps the host total when a lane is filtered', async () => {
  const result = await workerListVerb({ cwd: process.cwd(), args: { 'by-lane': true, worktree: a } }, { worktreePs: () => ({ ok: true, worktrees }) });
  assert.equal(result.data.lanes.length, 1);
  assert.equal(result.data.total, 4);
});

test('worker list projects the default fields and forwards run plus active filters', async () => {
  let call;
  const rows = [{
    dispatchId: 'ctx_1', workerState: 'succeeded', terminalState: 'reclaimable',
    resource: { worktreeId: `repo::${a}` }, start_options: JSON.stringify({ agent: 'codex', taskTitle: 'write verbs' }),
    projection: { liveness: { verdict: 'exited' } },
  }];
  const result = await workerListVerb({ cwd: process.cwd(), args: { run: 'run_1', active: true, worktree: a } }, {
    workerListAll: (input) => { call = input; return { ok: true, workers: rows }; },
  });
  assert.deepEqual(call, { run: 'run_1', terminalState: 'active' });
  assert.deepEqual(result.data.workers[0], { dispatchId: 'ctx_1', state: 'succeeded', agent: 'codex', taskTitle: 'write verbs',
    liveness: 'exited', terminalState: 'reclaimable', worktree: a });
});
