import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseYaml} from '../core/yaml.mjs';
import {flattenOperationCandidates, resolveOperationExecution} from '../execution/resolve.mjs';

const registry = parseYaml(fs.readFileSync(new URL('../profiles/registry.yaml', import.meta.url), 'utf8'));
const request = (operation = 'interface.implement') => ({
  apiVersion: 'starci.workflow/v1', kind: 'WorkflowRequest',
  metadata: {workflowId: 'workflow-1', project: 'academy'},
  spec: {
    mode: 'orchestrated', controlPlane: 'orca', source: {repository: 'academy', baseRef: 'main'},
    operations: [{id: 'work', operation, dependsOn: [], gate: 'approved', capabilities: ['write']}]
  }
});

test('resolver preserves each exact operator chain and its environment metadata', () => {
  const candidates = flattenOperationCandidates({operation: 'interface.implement', registry});
  assert.deepEqual(candidates.map(value => value.target), [
    'qwen-qwen3.8-flash-worker', 'claude-opus', 'codex-gpt-5.6-sol'
  ]);
  assert.deepEqual(candidates.map(value => [value.environmentPriority, value.profilePriority]), [[0, 0], [1, 0], [2, 0]]);
  const backend = flattenOperationCandidates({operation: 'backend.implement', registry});
  assert.deepEqual(backend.map(value => value.target), [
    'qwen-qwen3.8-flash-worker', 'claude-opus', 'codex-gpt-5.6-sol'
  ]);
  const review = flattenOperationCandidates({operation: 'review.verify', registry});
  assert.deepEqual(review.map(value => value.target), [
    'qwen-qwen3.8-flash-reviewer', 'claude-fable-5.1', 'codex-gpt-5.6-sol-reviewer'
  ]);
  const reasoning = flattenOperationCandidates({operation: 'architecture.decide', registry});
  assert.deepEqual(reasoning.map(value => value.target), ['claude-fable-5.1', 'codex-gpt-6-astra']);
});

test('automatic Orca chains accept return-preamble command terminals and reject any other terminal form', () => {
  const candidates = flattenOperationCandidates({operation: 'backend.implement', registry});
  assert.equal(candidates[0].orcaLaunch.kind, 'command-terminal');
  assert.equal(candidates[0].orcaLaunch.dispatch, 'return-preamble-and-send');
  const invalid = structuredClone(registry);
  invalid.targets['qwen-qwen3.8-flash-reviewer'].orcaLaunch = {kind: 'command-terminal', command: 'qwen', dispatch: 'inject'};
  assert.throws(() => flattenOperationCandidates({operation:'review.verify',registry:invalid}), /managed agent or a return-preamble command terminal/);
});

test('resolver selects deterministically and preserves unavailable observations', () => {
  const result = resolveOperationExecution({
    workflowRequest: request('backend.implement'), operationId: 'work', registry,
    inventory: [
      {environment: 'qwen', status: 'ready', profiles: [
        {profile: 'qwen3.8-flash-worker', status: 'unavailable', reason: 'quota-exhausted'}
      ]},
      {environment: 'codex', status: 'ready', profiles: [
        {profile: 'gpt-5.6-sol', status: 'ready', observedModel: 'gpt-5.6-sol'}
      ]}
    ]
  });
  assert.equal(result.selected.target, 'codex-gpt-5.6-sol');
  assert.equal(result.selected.requestedModel, 'gpt-5.6-sol');
  assert.equal(result.selected.observedModel, 'gpt-5.6-sol');
  assert.equal(result.observations.find(value => value.target === 'codex-gpt-5.6-sol').reason, null);
  assert.equal(result.observations[0].status, 'unavailable');
  assert.equal(result.observations[0].observation.environment, 'qwen');
  assert.equal(result.observations[1].target, 'claude-opus');
  assert.equal(result.observations[1].status, 'unavailable');
  assert.equal(result.observations[1].observation, null);
  assert.equal(result.observations.length, 3);
});

test('unknown observations are unavailable and unsafe fallback never advances the chain', () => {
  const unknown = resolveOperationExecution({workflowRequest: request('backend.implement'), operationId: 'work', registry, inventory: [{environment: 'codex', status: 'unknown'}]});
  assert.equal(unknown.observations[0].status, 'unavailable');
  assert.equal(unknown.selected, null);
  assert.throws(() => resolveOperationExecution({
    workflowRequest: request(), operationId: 'work', registry, inventory: ['qwen', 'codex'],
    attempts: [{target: 'qwen-qwen3.8-flash-worker', reason: 'rate-limited', effectState: 'unknown'}]
  }), /effectState must be none/);
  assert.throws(() => resolveOperationExecution({
    workflowRequest: request(), operationId: 'work', registry, inventory: ['qwen', 'codex'],
    attempts: [{target: 'qwen-qwen3.8-flash-worker', reason: 'permission-denied', effectState: 'none'}]
  }), /requires reconciliation/);
});

test('Codex and Claude solo stay host-local while Orca solo may resolve provider chains', () => {
  const solo = request('backend.implement');
  solo.spec.mode = 'solo'; solo.spec.soloHost = 'claude'; delete solo.spec.controlPlane;
  const result = resolveOperationExecution({workflowRequest: solo, operationId: 'work', registry, inventory: ['qwen', 'codex', 'claude']});
  assert.equal(result.selected.environment, 'claude');
  assert.equal(result.observations.length, 1);
  solo.spec.soloHost = 'orca';
  const orca = resolveOperationExecution({workflowRequest: solo, operationId: 'work', registry, inventory: ['qwen', 'codex', 'claude']});
  assert.equal(orca.selected.environment, 'qwen');
  assert.equal(orca.observations.length, 3);
});
