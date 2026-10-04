import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureWorkflowHost, installWorkflowTree, workflowStartAuthority } from '../../scripts/kernel/workflow-startup.mjs';

const accepted = () => ({ workflow: { workflow_id: 'wf-approved', goal_identity: 'goal-a', phase: 'queued' },
  goal: { approved_by: 'owner', goal_identity: 'goal-a', revision: 0, markdown: 'Implement the accepted login scope.', json: '{}' } });
const caller = { agent: 'codex', model: 'gpt-6.1-sol', effort: 'high' };

test('unapproved, incomplete, stale and inactive goals cause no host or maintenance effect', async () => {
  const cases = [null, { ...accepted(), goal: { ...accepted().goal, approved_by: null } },
    { ...accepted(), goal: { ...accepted().goal, approved_by: 'supervisor' } },
    { ...accepted(), goal: { ...accepted().goal, markdown: '' } },
    { ...accepted(), goal: { ...accepted().goal, goal_identity: 'stale' } },
    { ...accepted(), goal: { ...accepted().goal, json: '{"provisional":true}' } },
    ...['awaiting-approval', 'stopped', 'paused', 'finished', 'archived'].map((phase) => ({ ...accepted(), workflow: { ...accepted().workflow, phase } }))];
  for (const input of cases) {
    const effects = [];
    const result = await ensureWorkflowHost(input ?? {}, { loadConfig: () => { effects.push('config'); return { debug: true }; },
      ensureHost: async () => { effects.push('host'); return { ok: true }; }, ensureDebug: async () => { effects.push('debug'); return { ok: true, ready: true }; } });
    assert.equal(result.ok, false);
    assert.deepEqual(effects, []);
  }
});

test('accepted plan records authority without config, host or native worker effects', async () => {
  const result = await ensureWorkflowHost({ ...accepted(), plan: true }, { loadConfig: () => { throw Error('plan must not load config'); } });
  assert.equal(result.ok, true);
  assert.equal(result.ready, false);
  assert.equal(result.planned, true);
  assert.equal(workflowStartAuthority(accepted()).goalRevision, 0);
});

test('accepted startup ensures nonrecursive host before exact declared caller maintenance', async () => {
  const calls = [], env = { fixture: 'owner' };
  const result = await ensureWorkflowHost({ ...accepted(), caller, env }, { config: { debug: true },
    ensureHost: async (input) => { calls.push(['host', input]); return { ok: true, leader: 'engine-a' }; },
    ensureDebug: async (input) => { calls.push(['debug', input]); return { ok: true, ready: true, dispatch: 'debug-a' }; } });
  assert.equal(result.ready, true);
  assert.deepEqual(calls.map(([name]) => name), ['host', 'debug']);
  assert.equal(calls[0][1].workflowSeats, false);
  assert.deepEqual(calls[1][1], { caller, env, plan: false });
  assert.equal(result.maintenance.dispatch, 'debug-a');
});

test('debug false never starts maintenance; red host never reaches maintenance', async () => {
  let starts = 0;
  const deps = { config: { debug: false }, ensureHost: async () => ({ ok: true }), ensureDebug: async () => { starts++; } };
  assert.equal((await ensureWorkflowHost(accepted(), deps)).ready, true);
  assert.equal(starts, 0);
  deps.config.debug = true;
  deps.ensureHost = async () => ({ ok: false, items: [{ id: 'harness-tunnel', status: 'red' }] });
  const red = await ensureWorkflowHost(accepted(), deps);
  assert.equal(red.ready, false);
  assert.equal(red.host.items[0].id, 'harness-tunnel');
  assert.equal(starts, 0);
});

test('unknown or throwing native maintenance leaves startup not ready with actual effects retained', async () => {
  for (const ensureDebug of [async () => ({ ok: false, ready: false, effectState: 'unknown', dispatch: 'unsettled-a' }),
    async () => { throw Error('native outcome unavailable'); }]) {
    const result = await ensureWorkflowHost({ ...accepted(), caller }, { config: { debug: true }, ensureHost: async () => ({ ok: true }), ensureDebug });
    assert.equal(result.ok, false);
    assert.equal(result.ready, false);
    assert.equal(result.maintenance.effectState, 'unknown');
  }
});

test('workflow install uses the native npmCi owner in the exact tree with the shared lock role', async () => {
  const record = { path: '/owned/workflow', orcaWorktreeId: 'tree-a' }, env = { fixture: 'machine' }, calls = [];
  const result = await installWorkflowTree({ record, env }, { npmCi: async (ctx) => { calls.push(ctx); return { code: 0, data: { schema: 'starci/npm-ci@1', ok: true, cwd: ctx.cwd, ms: 42 } }; } });
  assert.deepEqual(calls, [{ cwd: record.path, role: 'coordinator', env, args: {} }]);
  assert.equal(result.installed, true);
  assert.equal(result.receipt.ms, 42);
});

test('failed native installation retains the exact owned tree identity and never reports installed', async () => {
  const record = { path: '/owned/workflow', orcaWorktreeId: 'tree-a' };
  const result = await installWorkflowTree({ record }, { npmCi: async () => ({ code: 1, text: 'registry unavailable', data: { ok: false, cwd: record.path } }) });
  assert.equal(result.ok, false);
  assert.equal(result.installed, false);
  assert.equal(result.path, record.path);
  assert.equal(record.orcaWorktreeId, 'tree-a');
  assert.match(result.error, /registry unavailable/);
  const threw = await installWorkflowTree({ record }, { npmCi: async () => { throw Error('install receipt unreadable'); } });
  assert.equal(threw.ok, false);
  assert.equal(threw.installed, false);
  assert.equal(threw.path, record.path);
  assert.equal(threw.receipt, null);
  assert.match(threw.error, /receipt unreadable/);
});
