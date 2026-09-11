import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseYaml, stringifyYaml} from '../core/yaml.mjs';
import {
  createSharedConflictEscalation,
  inspectWorkflowExecution,
  planWorkflowExecution,
} from '../execution/api.mjs';
import {main} from '../cli/main.mjs';

const root = path.resolve(import.meta.dirname, '..');
const registry = () => parseYaml(fs.readFileSync(path.join(root, 'profiles/registry.yaml'), 'utf8'));
const request = (mode = 'solo') => ({
  apiVersion: 'starci.workflow/v1',
  kind: 'WorkflowRequest',
  metadata: {workflowId: 'agentos-backend', project: 'nivo'},
  spec: {
    mode,
    ...(mode === 'solo' ? {soloHost: 'codex'} : {controlPlane: 'orca'}),
    source: {repository: 'nivo-backend', baseRef: 'main'},
    operations: [
      {id: 'architecture', operation: 'architecture.decide', dependsOn: [], gate: 'sds-accepted', capabilities: ['read']},
      {id: 'backend', operation: 'backend.implement', dependsOn: ['architecture'], gate: 'backend-green', capabilities: ['read', 'write']},
    ],
  },
});

test('execution planner keeps Codex solo and Orca orchestration boundaries explicit', () => {
  const solo = planWorkflowExecution({request: request(), registry: registry(), inventory: ['codex', 'claude', 'qwen']});
  assert.equal(solo.host, 'codex');
  assert.equal(solo.controlPlane, null);
  assert.equal(solo.executionBoundary, 'current-host-session-with-isolated-background-operation-agents');
  assert.equal(solo.operationMapping, 'one-operation-instance-one-agent');
  assert.equal(solo.maxConcurrentOperationAgents, 3);
  assert.ok(solo.resolutions.every(row => row.selected.environment === 'codex'));
  const orches = planWorkflowExecution({request: request('orchestrated'), registry: registry(), inventory: ['codex', 'claude', 'qwen']});
  assert.equal(orches.host, null);
  assert.equal(orches.controlPlane, 'orca');
  assert.equal(orches.executionBoundary, 'orca-parent-with-child-workflow-worktrees-and-isolated-operation-subagents');
  assert.equal(orches.operationMapping, 'one-operation-instance-one-agent');
  assert.equal(orches.maxConcurrentOperationAgents, 3);
});

test('receipt inspection is effect-free and respects dependency completion', () => {
  const planned = planWorkflowExecution({request: request(), registry: registry(), inventory: ['codex']});
  let inspected = inspectWorkflowExecution({request: request(), receipt: planned.receipt});
  assert.equal(inspected.nextOperationId, 'architecture');
  const completed = structuredClone(planned.receipt);
  completed.operations[0].status = 'completed';
  inspected = inspectWorkflowExecution({request: request(), receipt: completed});
  assert.equal(inspected.nextOperationId, 'backend');
  assert.equal(inspected.executed, false);
});

test('conflict escalation binds the active Orca task and dispatch without launching a worker', () => {
  const plan = {
    schema: 'starci/orca-execution-plan@1',
    operations: {backend: {attempts: [{taskId: 'task-1', dispatchId: 'dispatch-1', status: 'dispatched'}]}},
  };
  const event = createSharedConflictEscalation({plan, operationId: 'backend', taskId: 'task-1', dispatchId: 'dispatch-1', files: ['packages/contracts/agentos.ts']});
  assert.equal(event.requiredDecision, 'create-conflict-owner');
  assert.equal(event.executed, false);
  assert.throws(() => createSharedConflictEscalation({...event, plan, dispatchId: 'wrong'}), /active Orca Dispatch/);
});

test('execution CLI creates, resolves, plans and inspects without invoking Orca', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-execution-cli-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  const requestFile = path.join(dir, 'request.yaml');
  fs.writeFileSync(requestFile, stringifyYaml(request()));
  const invoke = async args => {
    let stdout = '', stderr = '';
    const status = await main(args, {out: value => {stdout += value;}, err: value => {stderr += value;}});
    return {status, stdout, stderr};
  };
  const created = await invoke(['execution', 'create', requestFile]);
  assert.equal(created.status, 0, created.stderr);
  const map = await invoke(['execution', 'map']);
  assert.equal(map.status, 0, map.stderr);
  assert.deepEqual(JSON.parse(map.stdout).modes.solo.hosts, ['codex', 'claude', 'orca']);
  assert.equal(JSON.parse(map.stdout).modes.solo.maxConcurrentOperationAgents, 3);
  assert.equal(JSON.parse(map.stdout).modes.solo.operationAgent, 'isolated-background-agent');
  assert.equal(JSON.parse(map.stdout).modes.orchestrated.controlPlane, 'orca');
  assert.equal(JSON.parse(map.stdout).approvals.schema, 'starci/approval-policy@1');
  assert.deepEqual(JSON.parse(map.stdout).secondaryRoutes['backend.implement'].calls.map(call => call.op), ['architecture.decide']);
  assert.deepEqual(JSON.parse(map.stdout).secondaryRoutes['interface.implement'].calls.map(call => call.op), ['architecture.decide','backend.implement']);
  const receiptFile = path.join(dir, 'receipt.yaml');
  fs.writeFileSync(receiptFile, stringifyYaml(JSON.parse(created.stdout)));
  const planned = await invoke(['execution', 'plan', requestFile, 'codex,claude,qwen']);
  assert.equal(planned.status, 0, planned.stderr);
  assert.equal(JSON.parse(planned.stdout).host, 'codex');
  const resolved = await invoke(['execution', 'resolve', requestFile, 'backend', 'codex,claude,qwen']);
  assert.equal(resolved.status, 0, resolved.stderr);
  assert.equal(JSON.parse(resolved.stdout).selected.environment, 'codex');
  for (const action of ['show', 'resume']) {
    const result = await invoke(['execution', action, requestFile, receiptFile]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).executed, false);
  }
});
