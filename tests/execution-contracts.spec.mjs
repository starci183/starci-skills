import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import {parseYaml} from '../core/yaml.mjs';
import {
  createWorkflowReceipt,
  recordOperationReceipt,
  validateExecutionRequest,
  validateWorkflowRequest
} from '../execution/contracts.mjs';

const workflow = () => ({
  apiVersion: 'starci.workflow/v1',
  kind: 'WorkflowRequest',
  metadata: {workflowId: 'workflow-1', project: 'academy'},
  spec: {
    mode: 'orchestrated',
    controlPlane: 'orca',
    source: {repository: 'starci-academy-backend', baseRef: 'main'},
    operations: [
      {id: 'design', operation: 'architecture.decide', dependsOn: [], gate: 'approved-goal', capabilities: ['read']},
      {id: 'implement', operation: 'backend.implement', dependsOn: ['design'], gate: 'design-done', capabilities: ['read', 'write']}
    ]
  }
});

test('execution request and receipt schemas compile in strict draft-2020 mode', () => {
  const ajv = new Ajv2020({strict: true});
  for (const name of ['execution-request.schema.yaml', 'execution-receipt.schema.yaml', 'profile-registry-v3.schema.yaml']) {
    assert.doesNotThrow(() => ajv.compile(parseYaml(fs.readFileSync(new URL(`../schemas/${name}`, import.meta.url), 'utf8'))));
  }
});

test('profile registry fixes only the operation isolation boundary and keeps five logical layers', () => {
  const ajv = new Ajv2020({strict: true});
  const schema = parseYaml(fs.readFileSync(new URL('../schemas/profile-registry-v3.schema.yaml', import.meta.url), 'utf8'));
  const registry = parseYaml(fs.readFileSync(new URL('../profiles/registry.yaml', import.meta.url), 'utf8'));
  const validate = ajv.compile(schema);
  assert.equal(validate(registry), true, JSON.stringify(validate.errors));
  assert.equal(registry.agentArchitecture.isolationBoundary, 'operation');
  assert.equal(registry.executionModes.solo.maxConcurrentOperationAgents, 3);
});

test('WorkflowRequest is closed, ordered and has host-specific mode constraints', () => {
  const request = workflow();
  assert.equal(validateWorkflowRequest(request), true);
  const solo = workflow();
  solo.spec = {...solo.spec, mode: 'solo', soloHost: 'codex'};
  delete solo.spec.controlPlane;
  assert.equal(validateWorkflowRequest(solo), true);
  solo.spec.soloHost = 'orca';
  assert.equal(validateWorkflowRequest(solo), true);
  solo.spec.soloHost = 'qwen';
  assert.throws(() => validateWorkflowRequest(solo), /soloHost must be codex, claude or orca/);
  const wrongPlane = workflow();
  wrongPlane.spec.controlPlane = 'custom';
  assert.throws(() => validateWorkflowRequest(wrongPlane), /requires controlPlane orca/);
});

test('WorkflowRequest rejects missing dependencies, cycles and dependency order drift', () => {
  const missing = workflow();
  missing.spec.operations[1].dependsOn = ['unknown'];
  assert.throws(() => validateWorkflowRequest(missing), /missing dependency unknown/);
  const cycle = workflow();
  cycle.spec.operations[0].dependsOn = ['implement'];
  assert.throws(() => validateWorkflowRequest(cycle), /dependency cycle/);
  const outOfOrder = workflow();
  outOfOrder.spec.operations.reverse();
  assert.throws(() => validateWorkflowRequest(outOfOrder), /must follow dependency/);
});

test('ExecutionRequest keeps requested model explicit and validates its source binding', () => {
  const request = {
    apiVersion: 'starci.execution/v1',
    kind: 'ExecutionRequest',
    metadata: {workflowId: 'workflow-1', operationId: 'design', requestId: 'request-1'},
    spec: {
      operation: 'architecture.decide', environment: 'claude', profile: 'fable', requestedModel: null,
      source: {repository: 'starci-academy-backend', baseRef: 'main'}, gate: 'approved-goal', capabilities: ['read']
    }
  };
  assert.equal(validateExecutionRequest(request), true);
  request.spec.requestedModel = '';
  assert.throws(() => validateExecutionRequest(request), /requestedModel/);
});

test('workflow receipts preserve operation order and requested/observed models independently', () => {
  const request = workflow(), receipt = createWorkflowReceipt(request);
  assert.deepEqual(receipt.operations.map(value => value.operationId), ['design', 'implement']);
  const recorded = recordOperationReceipt(receipt, {
    operationId: 'design', operation: 'architecture.decide', status: 'completed',
    environment: 'codex', profile: 'gpt-5.6-sol-reviewer', requestedModel: 'gpt-5.6-sol', observedModel: 'gpt-5.7', observations: []
  });
  assert.equal(recorded.operations[0].requestedModel, 'gpt-5.6-sol');
  assert.equal(recorded.operations[0].observedModel, 'gpt-5.7');
  assert.equal(recorded.status, 'running');
  assert.equal(receipt.operations[0].status, 'pending');
});
