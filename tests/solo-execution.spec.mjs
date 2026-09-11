import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isSoloHost,
  runSoloWorkflow,
  validateSoloReceipt,
} from '../execution/solo.mjs';

function workflow(overrides = {}) {
  return {
    id: 'synthetic-solo',
    operations: [
      {id: 'inspect', dependsOn: [], gate: {id: 'inspection-complete'}},
      {id: 'implement', dependsOn: ['inspect'], gate: {id: 'checks-pass'}},
      {id: 'deliver', dependsOn: ['implement'], gate: {id: 'delivery-complete'}},
    ],
    ...overrides,
  };
}

function adapters({run, gate} = {}) {
  const calls = {
    worktree: [],
    run: [],
    gate: [],
  };
  return {
    calls,
    value: {
      worktree: {
        async enter(request) {
          calls.worktree.push(structuredClone(request));
          return request.requiredWorktree ?? {id: 'isolated-worktree', isolated: true, created: true};
        },
      },
      operation: {
        async run(request) {
          calls.run.push(structuredClone(request));
          return run ? run(request, calls) : {status: 'completed', output: {operation: request.operation.id}};
        },
        async evaluateGate(request) {
          calls.gate.push(structuredClone(request));
          return gate ? gate(request, calls) : {status: 'passed', observation: `${request.operation.id} passed`};
        },
      },
    },
  };
}

test('only codex and claude can enter the solo host', async () => {
  assert.equal(isSoloHost('codex'), true);
  assert.equal(isSoloHost('claude'), true);
  assert.equal(isSoloHost('gemini'), false);
  const injected = adapters();
  await assert.rejects(() => runSoloWorkflow({host: 'gemini', workflow: workflow(), adapters: injected.value}), /codex or claude/);
  assert.equal(injected.calls.worktree.length, 0);
});

test('one isolated worktree is created at entry and dependency operations run with explicit passing gates', async () => {
  const injected = adapters();
  const receipt = await runSoloWorkflow({host: 'codex', workflow: workflow(), adapters: injected.value});
  assert.equal(receipt.status, 'completed');
  assert.equal(receipt.currentOperation, null);
  assert.equal(receipt.resumeCursor, null);
  assert.equal(injected.calls.worktree.length, 1);
  assert.equal(injected.calls.worktree[0].mode, 'create');
  assert.deepEqual(injected.calls.run.map((call) => call.operation.id), ['inspect', 'implement', 'deliver']);
  assert.deepEqual(injected.calls.gate.map((call) => call.operation.id), ['inspect', 'implement', 'deliver']);
  assert.deepEqual(receipt.operations.map((operation) => [operation.state, operation.gate.state]), [
    ['completed', 'passed'],
    ['completed', 'passed'],
    ['completed', 'passed'],
  ]);
  assert.equal(validateSoloReceipt({host: 'codex', workflow: workflow(), receipt}), true);
});

test('dependency ordering is topological and stable rather than blindly following declaration order', async () => {
  const injected = adapters();
  const unordered = workflow({
    operations: [
      {id: 'deliver', dependsOn: ['implement'], gate: {id: 'delivery-complete'}},
      {id: 'inspect', dependsOn: [], gate: {id: 'inspection-complete'}},
      {id: 'implement', dependsOn: ['inspect'], gate: {id: 'checks-pass'}},
    ],
  });
  await runSoloWorkflow({host: 'claude', workflow: unordered, adapters: injected.value});
  assert.deepEqual(injected.calls.run.map((call) => call.operation.id), ['inspect', 'implement', 'deliver']);
});

test('a failed gate blocks every later operation', async () => {
  const injected = adapters({
    gate: ({operation}) => operation.id === 'implement'
      ? {status: 'failed', reason: 'focused checks failed', observation: 'one failing assertion'}
      : {status: 'passed'},
  });
  const receipt = await runSoloWorkflow({host: 'codex', workflow: workflow(), adapters: injected.value});
  assert.equal(receipt.status, 'blocked');
  assert.equal(receipt.currentOperation, 'implement');
  assert.deepEqual(injected.calls.run.map((call) => call.operation.id), ['inspect', 'implement']);
  assert.deepEqual(receipt.operations.map((operation) => [operation.state, operation.gate.state]), [
    ['completed', 'passed'],
    ['failed', 'failed'],
    ['blocked', 'blocked'],
  ]);
  assert.equal(receipt.operations[2].blockedBy, 'implement');
});

test('resume requires the receipt worktree, passes the cursor, and never reruns completed operations', async () => {
  let paused = false;
  const first = adapters({
    run: ({operation}) => {
      if (operation.id === 'implement' && !paused) {
        paused = true;
        return {status: 'paused', resumeCursor: {step: 4, token: 'opaque'}};
      }
      return {status: 'completed', output: operation.id};
    },
  });
  const partial = await runSoloWorkflow({host: 'claude', workflow: workflow(), adapters: first.value});
  assert.equal(partial.status, 'paused');
  assert.equal(partial.currentOperation, 'implement');
  assert.deepEqual(partial.resumeCursor, {step: 4, token: 'opaque'});
  assert.deepEqual(first.calls.run.map((call) => call.operation.id), ['inspect', 'implement']);

  const resumed = adapters();
  const receipt = await runSoloWorkflow({host: 'claude', workflow: workflow(), adapters: resumed.value, receipt: partial});
  assert.equal(receipt.status, 'completed');
  assert.equal(resumed.calls.worktree[0].mode, 'require');
  assert.equal(resumed.calls.worktree[0].requiredWorktree.id, 'isolated-worktree');
  assert.deepEqual(resumed.calls.run.map((call) => call.operation.id), ['implement', 'deliver']);
  assert.deepEqual(resumed.calls.run[0].resumeCursor, {step: 4, token: 'opaque'});
  assert.equal(receipt.operations[0].attempts, 1);
  assert.equal(receipt.operations[1].attempts, 2);

  const terminal = adapters();
  const sameReceipt = await runSoloWorkflow({host: 'claude', workflow: workflow(), adapters: terminal.value, receipt});
  assert.deepEqual(sameReceipt, receipt);
  assert.equal(terminal.calls.worktree.length, 0);
  assert.equal(terminal.calls.run.length, 0);
});

test('parallel, multi-writer, and native agent needs return requiresOrca without entering a worktree', async () => {
  for (const declaration of [
    {parallel: true},
    {writers: ['backend', 'frontend']},
    {execution: {nativeOrchestration: true}},
    {operations: [{id: 'one', gate: {id: 'one-pass'}, team: true}]},
  ]) {
    const injected = adapters();
    const receipt = await runSoloWorkflow({host: 'codex', workflow: workflow(declaration), adapters: injected.value});
    assert.equal(receipt.status, 'requiresOrca');
    assert.equal(typeof receipt.requiresOrca.reason, 'string');
    assert.equal(injected.calls.worktree.length, 0);
    assert.equal(injected.calls.run.length, 0);
  }
});

test('invalid graph, missing gate, changed receipt definition, and non-isolated entry fail closed', async () => {
  const injected = adapters();
  await assert.rejects(() => runSoloWorkflow({
    host: 'codex',
    workflow: workflow({operations: [{id: 'one', dependsOn: ['missing'], gate: {id: 'pass'}}]}),
    adapters: injected.value,
  }), /unknown operation/);
  await assert.rejects(() => runSoloWorkflow({
    host: 'codex',
    workflow: workflow({operations: [{id: 'one'}]}),
    adapters: injected.value,
  }), /explicit gate/);

  const receipt = await runSoloWorkflow({host: 'codex', workflow: workflow(), adapters: adapters().value});
  await assert.rejects(() => runSoloWorkflow({
    host: 'codex',
    workflow: workflow({operations: [...workflow().operations, {id: 'changed', gate: {id: 'changed-pass'}}]}),
    adapters: injected.value,
    receipt,
  }), /definition changed/);
  const forged = structuredClone(receipt);
  forged.operations[0].gate.state = 'pending';
  await assert.rejects(() => runSoloWorkflow({
    host: 'codex',
    workflow: workflow(),
    adapters: injected.value,
    receipt: forged,
  }), /lacks a passed gate/);

  const unsafe = adapters();
  unsafe.value.worktree.enter = async () => ({id: 'main-checkout', isolated: false});
  await assert.rejects(() => runSoloWorkflow({host: 'codex', workflow: workflow(), adapters: unsafe.value}), /isolated worktree/);
});
