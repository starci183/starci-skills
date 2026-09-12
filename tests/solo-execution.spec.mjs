import test from 'node:test';
import assert from 'node:assert/strict';
import {isSoloHost, runSoloWorkflow, soloExecutionLimits, validateSoloReceipt} from '../execution/solo.mjs';

function workflow(overrides = {}) {
  return {
    id: 'synthetic-solo',
    operations: [
      {id: 'inspect', operation: 'business.decide', dependsOn: [], gate: {id: 'inspection-complete'}},
      {id: 'implement', operation: 'backend.implement', dependsOn: ['inspect'], gate: {id: 'checks-pass'}},
      {id: 'deliver', operation: 'review.verify', dependsOn: ['implement'], gate: {id: 'delivery-complete'}},
    ],
    ...overrides,
  };
}

function adapters({run, gate, openAgent} = {}) {
  const calls = {session: [], open: [], run: [], gate: [], close: []};
  return {
    calls,
    value: {
      session: {
        async current(request) {
          calls.session.push(structuredClone(request));
          return request.requiredSession ?? {id: 'current-chat', kind: 'chat-session'};
        },
      },
      operation: {
        async openAgent(request) {
          calls.open.push(structuredClone(request));
          return openAgent ? openAgent(request, calls) : request.requiredAgent ?? {
            id: `isolated-${request.operation.id}`,
            kind: 'isolated-background-agent',
            isolated: true,
            operationId: request.operation.id,
          };
        },
        async run(request) {
          calls.run.push(structuredClone(request));
          return run ? run(request, calls) : {status: 'completed', output: {operation: request.operation.id}};
        },
        async evaluateGate(request) {
          calls.gate.push(structuredClone(request));
          return gate ? gate(request, calls) : {status: 'passed', observation: `${request.operation.id} passed`};
        },
        async closeAgent(request) {
          calls.close.push(structuredClone(request));
        },
      },
    },
  };
}

test('Codex, Claude and Orca host solo workflows while Qwen remains an operation provider', async () => {
  assert.equal(isSoloHost('codex'), true);
  assert.equal(isSoloHost('claude'), true);
  assert.equal(isSoloHost('orca'), true);
  assert.equal(isSoloHost('qwen'), false);
  assert.equal(soloExecutionLimits.maxConcurrentOperationAgents, 3);
  const injected = adapters();
  const orcaReceipt = await runSoloWorkflow({host: 'orca', workflow: workflow(), adapters: injected.value});
  assert.equal(orcaReceipt.status, 'completed');
  await assert.rejects(() => runSoloWorkflow({host: 'qwen', workflow: workflow(), adapters: injected.value}), /codex, claude or orca/);
  assert.equal(injected.calls.session.length, 1);
});

test('each dependency operation gets exactly one isolated background agent and normalized handoff envelopes', async () => {
  const injected = adapters();
  const receipt = await runSoloWorkflow({host: 'codex', workflow: workflow(), adapters: injected.value});
  assert.equal(receipt.schema, 'starci/solo-execution-receipt@2');
  assert.equal(receipt.status, 'completed');
  assert.equal(receipt.session.id, 'current-chat');
  assert.deepEqual(injected.calls.open.map(call => call.operation.id), ['inspect', 'implement', 'deliver']);
  assert.deepEqual(injected.calls.open.map(call => call.mode), ['create', 'create', 'create']);
  assert.equal(new Set(injected.calls.open.map(call => call.operation.id)).size, 3);
  assert.equal(injected.calls.close.length, 3);
  assert.equal(injected.calls.run[1].input.schema, 'starci/operation-input@1');
  assert.equal(injected.calls.run[1].input.dependencyOutputs[0].operationId, 'inspect');
  assert.equal(injected.calls.run[1].input.dependencyOutputs[0].output.schema, 'starci/operation-output@1');
  assert.deepEqual(receipt.operations.map(operation => [operation.state, operation.gate.state]), [
    ['completed', 'passed'], ['completed', 'passed'], ['completed', 'passed'],
  ]);
  assert.equal(validateSoloReceipt({host: 'codex', workflow: workflow(), receipt}), true);
});

test('up to three distinct dependency-safe op agents run in one wave without sharding an operation', async () => {
  let active = 0, peak = 0;
  const injected = adapters({
    run: async request => {
      active += 1;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active -= 1;
      return {status: 'completed', output: request.operation.id};
    },
  });
  const independent = workflow({
    operations: ['one', 'two', 'three', 'four'].map(id => ({id, operation: 'task.execute', dependsOn: [], gate: {id: `${id}-pass`}})),
  });
  const receipt = await runSoloWorkflow({host: 'claude', workflow: independent, adapters: injected.value});
  assert.equal(receipt.status, 'completed');
  assert.equal(peak, 3);
  assert.deepEqual(injected.calls.open.slice(0, 3).map(call => call.operation.id), ['one', 'two', 'three']);
  assert.equal(injected.calls.open[3].operation.id, 'four');
});

test('one operation cannot fan out to several isolated agents and larger orchestration routes to Orca', async () => {
  for (const candidate of [
    workflow({maxConcurrentOperationAgents: 4}),
    workflow({operations: [{id: 'backend', operation: 'backend.implement', agents: 3, gate: {id: 'pass'}}]}),
    workflow({execution: {childWorktrees: true}}),
  ]) {
    const injected = adapters();
    const receipt = await runSoloWorkflow({host: 'codex', workflow: candidate, adapters: injected.value});
    assert.equal(receipt.status, 'requiresOrca');
    assert.match(receipt.requiresOrca.rule, /one isolated background agent per operation/);
    assert.equal(injected.calls.session.length, 0);
    assert.equal(injected.calls.open.length, 0);
  }
});

test('a paused op resumes the same isolated agent and completed ops never rerun', async () => {
  let paused = false;
  const first = adapters({
    run: ({operation}) => {
      if (operation.id === 'implement' && !paused) {
        paused = true;
        return {status: 'paused', resumeCursor: {step: 4}};
      }
      return {status: 'completed', output: operation.id};
    },
  });
  const partial = await runSoloWorkflow({host: 'claude', workflow: workflow(), adapters: first.value});
  assert.equal(partial.status, 'paused');
  assert.equal(partial.operations.find(row => row.id === 'implement').agent.id, 'isolated-implement');

  const resumed = adapters();
  const receipt = await runSoloWorkflow({host: 'claude', workflow: workflow(), adapters: resumed.value, receipt: partial});
  assert.equal(receipt.status, 'completed');
  assert.deepEqual(resumed.calls.run.map(call => call.operation.id), ['implement', 'deliver']);
  assert.equal(resumed.calls.open[0].mode, 'resume');
  assert.equal(resumed.calls.open[0].requiredAgent.id, 'isolated-implement');
  assert.deepEqual(resumed.calls.run[0].resumeCursor, {step: 4});

  const terminal = adapters();
  const sameReceipt = await runSoloWorkflow({host: 'claude', workflow: workflow(), adapters: terminal.value, receipt});
  assert.deepEqual(sameReceipt, receipt);
  assert.equal(terminal.calls.session.length, 0);
});

test('a failed operation blocks only its dependent branch while an unrelated op can finish', async () => {
  const injected = adapters({
    gate: ({operation}) => operation.id === 'bad'
      ? {status: 'failed', reason: 'failed check'}
      : {status: 'passed'},
  });
  const branched = workflow({
    operations: [
      {id: 'bad', operation: 'backend.implement', dependsOn: [], gate: {id: 'bad-pass'}},
      {id: 'dependent', operation: 'review.verify', dependsOn: ['bad'], gate: {id: 'dependent-pass'}},
      {id: 'unrelated', operation: 'content.generate', dependsOn: [], gate: {id: 'unrelated-pass'}},
    ],
  });
  const receipt = await runSoloWorkflow({host: 'codex', workflow: branched, adapters: injected.value});
  assert.equal(receipt.status, 'failed');
  assert.equal(receipt.operations.find(row => row.id === 'bad').state, 'failed');
  assert.equal(receipt.operations.find(row => row.id === 'dependent').state, 'blocked');
  assert.equal(receipt.operations.find(row => row.id === 'unrelated').state, 'completed');
});

test('a failed solo operation records the same effectState vocabulary as an Orca attempt', async () => {
  const stalled = adapters({run: ({operation}) => operation.id === 'inspect'
    ? {status: 'failed', reason: 'agent stalled before any write', effectState: 'none'}
    : {status: 'completed'}});
  const clean = await runSoloWorkflow({host: 'claude', workflow: workflow(), adapters: stalled.value});
  const inspect = clean.operations.find(row => row.id === 'inspect');
  assert.equal(inspect.state, 'failed');
  assert.equal(inspect.effectState, 'none');
  assert.equal(inspect.retryable, true);
  const opaque = adapters({run: ({operation}) => operation.id === 'inspect' ? {status: 'failed', reason: 'crashed mid-write'} : {status: 'completed'}});
  const dirty = await runSoloWorkflow({host: 'claude', workflow: workflow(), adapters: opaque.value});
  assert.equal(dirty.operations.find(row => row.id === 'inspect').effectState, 'unknown');
  assert.equal(dirty.operations.find(row => row.id === 'inspect').retryable, false);
  const noAgent = adapters({openAgent: () => {throw new Error('provider unavailable');}});
  const unopened = await runSoloWorkflow({host: 'claude', workflow: workflow(), adapters: noAgent.value});
  assert.equal(unopened.operations.find(row => row.id === 'inspect').effectState, 'none');
  assert.equal(unopened.operations.find(row => row.id === 'inspect').retryable, true);
});

test('invalid graphs, changed receipts, unsafe agent reuse and session drift fail closed', async () => {
  const injected = adapters();
  await assert.rejects(() => runSoloWorkflow({
    host: 'codex',
    workflow: workflow({operations: [{id: 'one', dependsOn: ['missing'], gate: {id: 'pass'}}]}),
    adapters: injected.value,
  }), /unknown operation/);
  await assert.rejects(() => runSoloWorkflow({
    host: 'codex', workflow: workflow({operations: [{id: 'one'}]}), adapters: injected.value,
  }), /explicit gate/);

  const receipt = await runSoloWorkflow({host: 'codex', workflow: workflow(), adapters: adapters().value});
  await assert.rejects(() => runSoloWorkflow({
    host: 'codex',
    workflow: workflow({operations: [...workflow().operations, {id: 'changed', gate: {id: 'changed-pass'}}]}),
    adapters: injected.value,
    receipt,
  }), /definition changed/);

  const duplicate = adapters({openAgent: request => ({
    id: 'same-agent', kind: 'isolated-background-agent', isolated: true, operationId: request.operation.id,
  })});
  const duplicateReceipt = await runSoloWorkflow({host: 'codex', workflow: workflow(), adapters: duplicate.value});
  assert.equal(duplicateReceipt.status, 'failed');
  assert.match(duplicateReceipt.operations.find(row => row.id === 'implement').failure, /cannot own both/);

  const partialAdapters = adapters({run: ({operation}) => operation.id === 'inspect'
    ? {status: 'paused', resumeCursor: {at: 1}}
    : {status: 'completed'}});
  const partial = await runSoloWorkflow({host: 'codex', workflow: workflow(), adapters: partialAdapters.value});
  const drifted = adapters();
  drifted.value.session.current = async () => ({id: 'other-chat', kind: 'chat-session'});
  await assert.rejects(() => runSoloWorkflow({host: 'codex', workflow: workflow(), adapters: drifted.value, receipt: partial}), /receipt chat session/);
});
