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

test('resolver flattens environment order before each environment-local profile chain', () => {
  const candidates = flattenOperationCandidates({operation: 'interface.implement', registry});
  assert.deepEqual(candidates.map(value => value.target), [
    'qwen-qwen3.8-flash-worker', 'qwen-qwen3.8-max-worker', 'codex-gpt-5.6-sol', 'claude-opus'
  ]);
  assert.deepEqual(candidates.map(value => [value.environmentPriority, value.profilePriority]), [[0, 0], [0, 1], [1, 0], [2, 0]]);
});

test('resolver selects deterministically and preserves unavailable observations', () => {
  const result = resolveOperationExecution({
    workflowRequest: request(), operationId: 'work', registry,
    inventory: [
      {environment: 'qwen', status: 'ready', profiles: [
        {profile: 'qwen3.8-flash-worker', status: 'unavailable', reason: 'quota-exhausted'},
        {profile: 'qwen3.8-max-worker', status: 'ready', observedModel: 'qwen3.8-max-202609'}
      ]},
      {environment: 'codex', status: 'unavailable', reason: 'not-installed'}
    ]
  });
  assert.equal(result.selected.target, 'qwen-qwen3.8-max-worker');
  assert.equal(result.selected.requestedModel, 'qwen3.8-max');
  assert.equal(result.selected.observedModel, 'qwen3.8-max-202609');
  assert.equal(result.observations[1].reason, null);
  assert.equal(result.observations[0].status, 'unavailable');
  assert.equal(result.observations[0].observation.environment, 'qwen');
  assert.equal(result.observations.find(value => value.environment === 'claude').observation, null);
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

test('solo resolution cannot escape the approved codex or claude host', () => {
  const solo = request('backend.implement');
  solo.spec.mode = 'solo'; solo.spec.soloHost = 'claude'; delete solo.spec.controlPlane;
  const result = resolveOperationExecution({workflowRequest: solo, operationId: 'work', registry, inventory: ['qwen', 'codex', 'claude']});
  assert.equal(result.selected.environment, 'claude');
  assert.equal(result.observations.length, 1);
});
