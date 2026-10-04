import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parseYaml } from '../../engine/yaml.mjs';
import { main } from '../../scripts/cli/main.mjs';
import { workflowCaller } from '../../scripts/agent/caller-context.mjs';
import { ensureWorkflowHost } from '../../scripts/kernel/workflow-startup.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const read = relative => parseYaml(fs.readFileSync(path.join(root, relative), 'utf8'));
const global = read('modules/cli/commands/_global.yaml');
const catalog = {
  schema: 'starci/cli-catalog@1',
  global: global.flags,
  commands: global.commands,
  groups: Object.fromEntries([['workflow', 'start'], ['reconciler', 'up']].map(([group, verb]) => [group, {
    ...read(`modules/cli/commands/${group}/_group.yaml`),
    verbs: { [verb]: read(`modules/cli/commands/${group}/${verb}.yaml`) },
  }])),
};

const capture = (runScript = () => 0, env = {}) => {
  const output = { stdout: '', stderr: '' };
  return {
    catalog, runtimeRoot: root, cwd: root, env, runScript, output,
    stdout: text => { output.stdout += text; },
    stderr: text => { output.stderr += text; },
  };
};

test('workflow caller fields reach the native owner separately from the Kernel override', () => {
  let invoked;
  const io = capture((script, args, options) => { invoked = { script, args, options }; return 0; });
  const flags = ['--repo', 'project-owner', '--goal', 'wf-approved', '--agent', 'claude',
    '--caller-agent', 'codex', '--caller-model', 'gpt-6.1-sol', '--caller-effort', 'high'];
  assert.equal(main(['workflow', 'start', ...flags, '--json'], io), 0);
  assert.equal(invoked.script, path.join(root, 'scripts', 'kernel', 'start-workflow.mjs'));
  assert.deepEqual(invoked.args, [...flags, '--json']);
  assert.equal(invoked.options.env, io.env);
  assert.equal(invoked.options.cwd, root);
});

test('reconciler check forwards explicit caller context to its owner without replacing check mode', () => {
  let invoked;
  const io = capture((script, args) => { invoked = { script, args }; return 0; });
  const flags = ['--check', '--caller-agent', 'claude', '--caller-model', 'claude-sonnet-5-5',
    '--caller-effort', 'medium', '--wait', '3'];
  assert.equal(main(['reconciler', 'up', ...flags, '--json'], io), 0);
  assert.equal(invoked.script, path.join(root, 'scripts', 'reconciler', 'start.mjs'));
  assert.deepEqual(invoked.args, [...flags, '--json']);
});

test('no declared caller leaves the native argument list unfilled despite ambient model labels', () => {
  let invoked;
  const env = { CLAUDE_MODEL: 'claude-opus-5-5', DEVIN_MODEL: 'swe-2-max', STARCI_AGENT: 'codex', STARCI_MODEL: 'gpt-6.1-sol' };
  const io = capture((script, args) => { invoked = { script, args }; return 0; }, env);
  assert.equal(main(['workflow', 'start', '--plan', '--agent', 'claude'], io), 0);
  assert.deepEqual(invoked.args, ['--plan', '--agent', 'claude']);
});

test('caller flag validation refuses malformed ingress before any native owner runs', () => {
  for (const tail of [
    ['--caller-agent', 'unknown-agent'],
    ['--caller-agent'],
    ['--caller-agent', 'codex', '--caller-agent', 'claude'],
    ['--caller-model', '--caller-effort', 'high'],
  ]) {
    let calls = 0;
    const io = capture(() => { calls += 1; return 0; });
    assert.equal(main(['workflow', 'start', ...tail], io), 2, tail.join(' '));
    assert.equal(calls, 0);
    assert.ok(io.output.stderr);
  }
});

test('caller equals forms survive catalog dispatch and native failures remain failures', () => {
  for (const code of [1, 75]) {
    let invoked;
    const io = capture((script, args) => { invoked = { script, args }; return code; });
    const flags = ['--caller-agent=codex', '--caller-model=gpt-6.1-sol', '--caller-effort=high'];
    assert.equal(main(['workflow', 'start', ...flags], io), code);
    assert.deepEqual(invoked.args, flags);
    assert.equal(io.output.stdout, '');
  }
});

test('shared caller parsing resolves split and equals forms without Kernel or ambient inference', () => {
  const expected = { agent: 'codex', model: 'gpt-6.1-sol', effort: 'high' };
  for (const argv of [
    ['--caller-agent', 'codex', '--caller-model', 'gpt-6.1-sol', '--caller-effort', 'high'],
    ['--caller-agent=codex', '--caller-model=gpt-6.1-sol', '--caller-effort=high'],
  ]) assert.deepEqual(workflowCaller(['--agent', 'claude', ...argv]), expected);
  assert.deepEqual(workflowCaller(['--agent', 'claude', '--model', 'claude-opus-5-5']),
    { agent: null, model: null, effort: null });
  assert.deepEqual(workflowCaller(['--caller-agent', 'devin']),
    { agent: 'devin', model: null, effort: null });
  assert.throws(() => workflowCaller(['--caller-agent', '--caller-model', 'gpt-6.1-sol']));
});

test('catalog dispatch keeps passthrough caller flags outside declared caller context', () => {
  const declared = ['--caller-agent', 'codex', '--caller-model', 'gpt-6.1-sol', '--caller-effort', 'high'];
  for (const suffixAgent of ['claude', 'unknown-agent']) {
    const suffix = ['--caller-agent', suffixAgent, '--caller-model', 'unvalidated-model', '--caller-effort', 'unvalidated-effort'];
    for (const prefix of [declared, []]) {
      let invoked;
      const io = capture((script, args) => {
        invoked = { args, caller: workflowCaller(args) };
        return 0;
      });
      const flags = [...prefix, '--', ...suffix];
      assert.equal(main(['workflow', 'start', ...flags], io), 0);
      assert.deepEqual(invoked.args, flags);
      assert.deepEqual(invoked.caller, prefix.length
        ? { agent: 'codex', model: 'gpt-6.1-sol', effort: 'high' }
        : { agent: null, model: null, effort: null });
    }
  }
});

const approved = () => ({
  workflow: { workflow_id: 'wf-caller-context', phase: 'queued', goal_identity: 'goal-caller-context', archived_at: null },
  goal: { approved_by: 'owner', revision: 1, goal_identity: 'goal-caller-context',
    markdown: 'Implement the scoped owner-approved local goal.', json: '{}' },
});

test('workflow plan proves the scoped goal without reading config or activating host and maintenance', async () => {
  const denied = () => { throw new Error('a plan must not activate a dependency'); };
  const result = await ensureWorkflowHost({ ...approved(), plan: true, env: {} },
    { loadConfig: denied, ensureHost: denied, ensureDebug: denied });
  assert.equal(result.ok, true);
  assert.equal(result.planned, true);
  assert.equal(result.ready, false);
});

test('unapproved, provisional, mismatched or closed goals refuse before config and startup effects', async () => {
  const bad = [
    { workflow: approved().workflow, goal: null },
    { ...approved(), goal: { ...approved().goal, approved_by: 'agent' } },
    { ...approved(), goal: { ...approved().goal, json: '{"provisional":true}' } },
    { ...approved(), goal: { ...approved().goal, goal_identity: 'different-goal' } },
    { ...approved(), goal: { ...approved().goal, markdown: ' ' } },
    { ...approved(), workflow: { ...approved().workflow, phase: 'finished' } },
    { ...approved(), workflow: { ...approved().workflow, archived_at: 1 } },
  ];
  for (const input of bad) {
    let effects = 0;
    const denied = () => { effects += 1; throw new Error('refused goal activated startup'); };
    const result = await ensureWorkflowHost({ ...input, env: {} },
      { loadConfig: denied, ensureHost: denied, ensureDebug: denied });
    assert.equal(result.ok, false);
    assert.equal(result.ready, false);
    assert.equal(effects, 0);
  }
});

test('approved debug startup passes the exact declared caller after host readiness without changing pins', async () => {
  const caller = workflowCaller(['--caller-agent=codex', '--caller-model=gpt-6.1-sol', '--caller-effort=high']);
  const env = {};
  const config = { debug: true, kernel: { agent: 'claude', model: 'claude-sonnet-5-5' },
    supervisor: { kernel: { agent: 'claude', model: 'claude-opus-5-5' } } };
  const before = structuredClone(config);
  const order = [];
  const hostReceipt = { ok: true, publicHarness: 'ready' };
  const debugReceipt = { ok: true, ready: true, action: 'booted', terminal: 'owned-debug-terminal' };
  const result = await ensureWorkflowHost({ ...approved(), caller, env }, {
    config,
    ensureHost: async request => {
      order.push('host');
      assert.equal(request.env, env);
      assert.equal(request.workflowSeats, false);
      return hostReceipt;
    },
    ensureDebug: async request => {
      order.push('debug');
      assert.equal(request.caller, caller);
      assert.equal(request.env, env);
      assert.equal(request.plan, false);
      return debugReceipt;
    },
  });
  assert.deepEqual(order, ['host', 'debug']);
  assert.equal(result.ok, true);
  assert.equal(result.ready, true);
  assert.equal(result.host, hostReceipt);
  assert.equal(result.maintenance, debugReceipt);
  assert.deepEqual(config, before);
});

test('false or absent debug lets an approved workflow proceed without caller metadata or maintenance calls', async () => {
  for (const config of [{ debug: false }, {}]) {
    let hostCalls = 0;
    let debugCalls = 0;
    const result = await ensureWorkflowHost({ ...approved(), caller: null, env: {} }, {
      config,
      ensureHost: async () => { hostCalls += 1; return { ok: true }; },
      ensureDebug: async () => { debugCalls += 1; throw new Error('disabled maintenance ran'); },
    });
    assert.equal(result.ok, true);
    assert.equal(result.ready, true);
    assert.equal(result.maintenance.action, 'disabled');
    assert.equal(hostCalls, 1);
    assert.equal(debugCalls, 0);
  }
});

test('host red blocks maintenance and preserves its actual readiness refusal', async () => {
  const host = { ok: false, items: [{ id: 'harness-public', status: 'red', reason: 'HTTP 503' }] };
  let debugCalls = 0;
  const result = await ensureWorkflowHost({ ...approved(), caller: { agent: 'codex', model: 'gpt-6.1-sol' }, env: {} }, {
    config: { debug: true }, ensureHost: async () => host,
    ensureDebug: async () => { debugCalls += 1; throw new Error('host red activated debug'); },
  });
  assert.equal(result.ok, false);
  assert.equal(result.ready, false);
  assert.equal(result.reason, 'workflow-host-not-ready');
  assert.equal(result.host, host);
  assert.equal(debugCalls, 0);
});

test('an uncertain, conflicting or merely starting maintenance receipt does not authorize Kernel startup', async () => {
  for (const maintenance of [
    { ok: true, ready: false, action: 'starting' },
    { ok: false, ready: false, action: 'route-conflict', effectState: 'none' },
    { ok: false, ready: false, action: 'launch-failed', effectState: 'unknown' },
  ]) {
    const result = await ensureWorkflowHost({ ...approved(), caller: { agent: 'codex', model: 'gpt-6.1-sol' }, env: {} }, {
      config: { debug: true }, ensureHost: async () => ({ ok: true }), ensureDebug: async () => maintenance,
    });
    assert.equal(result.ok, false);
    assert.equal(result.ready, false);
    assert.equal(result.reason, 'workflow-debug-not-ready');
    assert.equal(result.maintenance, maintenance);
  }
});
