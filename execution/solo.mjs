import {createHash} from 'node:crypto';

const RECEIPT_SCHEMA = 'starci/solo-execution-receipt@2';
const INPUT_SCHEMA = 'starci/operation-input@1';
const OUTPUT_SCHEMA = 'starci/operation-output@1';
const SOLO_HOSTS = new Set(['codex', 'claude']);
const MAX_INLINE_OPERATION_AGENTS = 3;
const OPERATION_STATES = new Set(['pending', 'running', 'paused', 'gating', 'completed', 'failed', 'blocked']);
const GATE_STATES = new Set(['pending', 'evaluating', 'passed', 'failed', 'skipped', 'blocked']);

function requireThat(condition, message) {
  if (!condition) throw new Error(message);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function clone(value) {
  return structuredClone(value);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (isPlainObject(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

function publicOperation(operation) {
  const value = clone(operation);
  delete value.declarationIndex;
  return value;
}

function definitionFor(workflow, orderedOperations) {
  const workflowDefinition = clone(workflow);
  delete workflowDefinition.operations;
  return {workflow: workflowDefinition, operations: orderedOperations.map(publicOperation)};
}

function concurrencyFor(workflow) {
  const requested = workflow.maxConcurrentOperationAgents ?? MAX_INLINE_OPERATION_AGENTS;
  requireThat(Number.isInteger(requested) && requested > 0, 'Solo maxConcurrentOperationAgents must be a positive integer');
  return requested;
}

function normalizeOperations(workflow) {
  requireThat(isPlainObject(workflow) && isText(workflow.id), 'A solo workflow id is required');
  requireThat(Array.isArray(workflow.operations) && workflow.operations.length > 0, 'A solo workflow needs operations');
  if (workflow.session !== undefined) requireThat(isPlainObject(workflow.session) && isText(workflow.session.id), 'A required solo chat session needs an id');

  const byId = new Map();
  workflow.operations.forEach((source, index) => {
    requireThat(isPlainObject(source) && isText(source.id), 'Every solo operation needs an id');
    requireThat(!byId.has(source.id), `Duplicate solo operation: ${source.id}`);
    requireThat(isPlainObject(source.gate) && isText(source.gate.id), `Operation ${source.id} needs an explicit gate`);
    const dependsOn = source.dependsOn ?? [];
    requireThat(Array.isArray(dependsOn) && dependsOn.every(isText), `Operation ${source.id} has invalid dependencies`);
    requireThat(new Set(dependsOn).size === dependsOn.length && !dependsOn.includes(source.id), `Operation ${source.id} has duplicate or self dependencies`);
    byId.set(source.id, {...clone(source), dependsOn: [...dependsOn], declarationIndex: index});
  });

  for (const operation of byId.values()) {
    for (const dependency of operation.dependsOn) requireThat(byId.has(dependency), `Operation ${operation.id} depends on unknown operation ${dependency}`);
  }

  const remaining = new Map([...byId].map(([id, operation]) => [id, new Set(operation.dependsOn)]));
  const ordered = [];
  while (remaining.size > 0) {
    const ready = [...remaining]
      .filter(([, dependencies]) => dependencies.size === 0)
      .map(([id]) => byId.get(id))
      .sort((left, right) => left.declarationIndex - right.declarationIndex);
    requireThat(ready.length > 0, 'Solo operation dependencies contain a cycle');
    for (const operation of ready) {
      ordered.push(operation);
      remaining.delete(operation.id);
      for (const dependencies of remaining.values()) dependencies.delete(operation.id);
    }
  }
  return ordered;
}

function requiresOrcaReason(workflow, operations) {
  if (concurrencyFor(workflow) > MAX_INLINE_OPERATION_AGENTS) return 'more-than-three-concurrent-operation-agents';
  for (const candidate of [workflow, workflow.execution]) {
    if (!isPlainObject(candidate)) continue;
    if (candidate.requiresOrca === true || candidate.childWorktrees === true || candidate.crossWorktreeIntegration === true || candidate.dynamicWorkers === true || candidate.crossProviderOrchestration === true) return 'orca-control-plane-required';
  }
  for (const operation of operations) {
    const declaredAgents = operation.agents ?? operation.workers ?? operation.shards;
    const agentCount = Array.isArray(declaredAgents) ? declaredAgents.length : Number.isInteger(declaredAgents) ? declaredAgents : operation.agentCount;
    if (operation.fanOut === true || operation.team === true || (Number.isInteger(agentCount) && agentCount > 1)) return `intra-operation-fan-out:${operation.id}`;
  }
  return null;
}

function newOperationState(operation) {
  return {
    id: operation.id,
    dependsOn: [...operation.dependsOn],
    state: 'pending',
    attempts: 0,
    agent: null,
    inputDigest: null,
    output: null,
    resumeCursor: null,
    gate: {id: operation.gate.id, state: 'pending'},
  };
}

function newReceipt({host, definition, orderedOperations, maxConcurrentOperationAgents}) {
  return {
    schema: RECEIPT_SCHEMA,
    host,
    workflowId: definition.workflow.id,
    definitionDigest: digest(definition),
    status: 'pending',
    session: null,
    maxConcurrentOperationAgents,
    activeOperations: [],
    operations: orderedOperations.map(newOperationState),
  };
}

function validateAgent(agent, operationId) {
  requireThat(isPlainObject(agent)
    && isText(agent.id)
    && agent.kind === 'inline-background-agent'
    && agent.isolated === true
    && agent.operationId === operationId,
  `Operation ${operationId} requires one isolated inline background agent`);
}

function assertReceipt(receipt, {host, definition, orderedOperations, maxConcurrentOperationAgents}) {
  requireThat(isPlainObject(receipt) && receipt.schema === RECEIPT_SCHEMA, 'Invalid solo execution receipt');
  requireThat(receipt.host === host && receipt.workflowId === definition.workflow.id, 'Solo receipt host or workflow changed');
  requireThat(receipt.definitionDigest === digest(definition), 'Solo workflow definition changed since the receipt');
  requireThat(receipt.maxConcurrentOperationAgents === maxConcurrentOperationAgents, 'Solo operation-agent concurrency changed since the receipt');
  requireThat(['pending', 'paused', 'failed', 'blocked', 'completed', 'requiresOrca'].includes(receipt.status), 'Invalid solo receipt status');
  requireThat(Array.isArray(receipt.activeOperations) && receipt.activeOperations.every(isText), 'Solo receipt activeOperations must be an array');
  requireThat(Array.isArray(receipt.operations) && receipt.operations.length === orderedOperations.length, 'Solo receipt operation set changed');

  const agentIds = new Set();
  receipt.operations.forEach((state, index) => {
    const operation = orderedOperations[index];
    requireThat(isPlainObject(state)
      && state.id === operation.id
      && OPERATION_STATES.has(state.state)
      && Number.isInteger(state.attempts)
      && state.attempts >= 0,
    `Invalid receipt state for operation ${operation.id}`);
    requireThat(isPlainObject(state.gate) && state.gate.id === operation.gate.id && GATE_STATES.has(state.gate.state), `Invalid receipt gate for operation ${operation.id}`);
    requireThat(state.resumeCursor === null || state.state === 'paused', `Only paused operation ${operation.id} may retain a resume cursor`);
    if (state.agent !== null) {
      validateAgent(state.agent, operation.id);
      requireThat(!agentIds.has(state.agent.id), `Inline agent ${state.agent.id} is reused across operations`);
      agentIds.add(state.agent.id);
    }
    if (state.state === 'completed') {
      requireThat(state.gate.state === 'passed', `Completed operation ${operation.id} lacks a passed gate`);
      requireThat(state.output?.schema === OUTPUT_SCHEMA && state.output.operationId === operation.id, `Completed operation ${operation.id} lacks a normalized output envelope`);
      requireThat(operation.dependsOn.every(id => receipt.operations.find(candidate => candidate.id === id)?.state === 'completed'), `Completed operation ${operation.id} has incomplete dependencies`);
    }
  });
  requireThat(!receipt.operations.some(operation => ['running', 'gating'].includes(operation.state)), 'A solo receipt must be a stable checkpoint');
  if (receipt.status === 'paused') requireThat(receipt.operations.some(operation => operation.state === 'paused'), 'A paused receipt needs at least one paused operation');
  if (receipt.status === 'completed') requireThat(receipt.operations.every(operation => operation.state === 'completed') && receipt.activeOperations.length === 0, 'Completed receipt contains unfinished operations');
}

function assertAdapters(adapters) {
  requireThat(isPlainObject(adapters), 'Solo adapters are required');
  requireThat(isPlainObject(adapters.session) && typeof adapters.session.current === 'function', 'A current chat-session adapter is required');
  requireThat(isPlainObject(adapters.operation) && typeof adapters.operation.openAgent === 'function', 'An inline operation-agent opener is required');
  requireThat(typeof adapters.operation.run === 'function', 'An operation runner adapter is required');
  requireThat(typeof adapters.operation.evaluateGate === 'function', 'An operation gate adapter is required');
  requireThat(typeof adapters.operation.closeAgent === 'function', 'An inline operation-agent closer is required');
}

async function currentSession({host, workflow, receipt, adapter}) {
  const requiredSession = receipt.session ?? workflow.session ?? null;
  const session = await adapter.current({host, workflowId: workflow.id, requiredSession: clone(requiredSession)});
  requireThat(isPlainObject(session) && isText(session.id) && session.kind === 'chat-session', 'Solo execution requires the current Codex or Claude chat session');
  if (requiredSession !== null) requireThat(session.id === requiredSession.id, 'Solo resume must re-enter the receipt chat session');
  return clone(session);
}

function failure(error) {
  return error instanceof Error && isText(error.message) ? error.message : 'Unknown adapter failure';
}

function dependencyOutputs(receipt, operation) {
  return operation.dependsOn.map(operationId => {
    const state = receipt.operations.find(candidate => candidate.id === operationId);
    requireThat(state?.state === 'completed' && state.output?.schema === OUTPUT_SCHEMA, `Operation ${operation.id} is missing normalized dependency output ${operationId}`);
    return {operationId, output: clone(state.output)};
  });
}

function operationInput({workflow, operation, receipt}) {
  return {
    schema: INPUT_SCHEMA,
    workflowId: workflow.id,
    operationId: operation.id,
    operation: operation.operation ?? operation.id,
    source: clone(workflow.source ?? null),
    goal: clone(operation.goal ?? operation.spec ?? null),
    scope: clone(operation.scope ?? null),
    capabilities: clone(operation.capabilities ?? []),
    dependencyOutputs: dependencyOutputs(receipt, operation),
    outputContract: clone(operation.outputContract ?? null),
    agentBinding: clone(operation.selection ?? null),
  };
}

function normalizedOutput({workflow, operation, agent, result}) {
  return {
    schema: OUTPUT_SCHEMA,
    workflowId: workflow.id,
    operationId: operation.id,
    operation: operation.operation ?? operation.id,
    agentId: agent.id,
    payload: clone(result.output ?? null),
  };
}

async function closeAgent(adapters, request) {
  try {
    await adapters.operation.closeAgent(request);
    return null;
  } catch (error) {
    return failure(error);
  }
}

async function executeOperation({host, workflow, operation, state, receipt, adapters}) {
  const input = operationInput({workflow, operation, receipt});
  const inputDigest = digest(input);
  if (state.inputDigest !== null) requireThat(state.inputDigest === inputDigest, `Operation ${operation.id} input changed while resuming`);
  state.inputDigest = inputDigest;
  const resumed = state.state === 'paused';
  const requiredAgent = resumed ? state.agent : null;
  const resumeCursor = resumed ? clone(state.resumeCursor) : null;
  state.state = 'running';
  state.attempts += 1;
  state.resumeCursor = null;

  let agent;
  try {
    agent = await adapters.operation.openAgent({
      host,
      session: clone(receipt.session),
      workflowId: workflow.id,
      operation: publicOperation(operation),
      input: clone(input),
      mode: resumed ? 'resume' : 'create',
      requiredAgent: clone(requiredAgent),
    });
    validateAgent(agent, operation.id);
    if (requiredAgent !== null) requireThat(agent.id === requiredAgent.id, `Operation ${operation.id} must resume the same inline agent`);
    const duplicate = receipt.operations.find(candidate => candidate.id !== operation.id && candidate.agent?.id === agent.id);
    requireThat(!duplicate, `Inline agent ${agent.id} cannot own both ${duplicate?.id} and ${operation.id}`);
    state.agent = clone(agent);
  } catch (error) {
    state.state = 'failed';
    state.failure = failure(error);
    state.gate.state = 'skipped';
    return;
  }

  let result;
  try {
    result = await adapters.operation.run({
      host,
      session: clone(receipt.session),
      agent: clone(agent),
      workflowId: workflow.id,
      operation: publicOperation(operation),
      input: clone(input),
      resumeCursor,
    });
  } catch (error) {
    result = {status: 'failed', reason: failure(error)};
  }
  requireThat(isPlainObject(result) && ['completed', 'paused', 'failed'].includes(result.status), `Operation ${operation.id} returned an invalid result`);

  if (result.status === 'paused') {
    requireThat(result.resumeCursor !== undefined && result.resumeCursor !== null, `Paused operation ${operation.id} needs a resume cursor`);
    state.state = 'paused';
    state.resumeCursor = clone(result.resumeCursor);
    state.gate.state = 'pending';
    return;
  }

  if (result.status === 'failed') {
    state.state = 'failed';
    state.failure = isText(result.reason) ? result.reason : 'Operation failed';
    state.gate.state = 'skipped';
    const closeFailure = await closeAgent(adapters, {host, session: clone(receipt.session), agent: clone(agent), operationId: operation.id, outcome: 'failed'});
    if (closeFailure) state.failure = `${state.failure}; close failed: ${closeFailure}`;
    return;
  }

  state.state = 'gating';
  const output = normalizedOutput({workflow, operation, agent, result});
  state.gate.state = 'evaluating';
  let gateResult;
  try {
    gateResult = await adapters.operation.evaluateGate({
      host,
      session: clone(receipt.session),
      agent: clone(agent),
      workflowId: workflow.id,
      operation: publicOperation(operation),
      input: clone(input),
      output: clone(output),
      result: clone(result),
    });
  } catch (error) {
    gateResult = {status: 'failed', reason: failure(error)};
  }
  requireThat(isPlainObject(gateResult) && ['passed', 'failed'].includes(gateResult.status), `Gate ${operation.gate.id} returned an invalid result`);
  state.gate = {id: operation.gate.id, state: gateResult.status, observation: clone(gateResult.observation ?? null)};
  if (gateResult.status === 'failed') {
    state.state = 'failed';
    state.failure = isText(gateResult.reason) ? gateResult.reason : 'Operation gate failed';
  } else {
    state.state = 'completed';
    state.output = output;
  }
  const closeFailure = await closeAgent(adapters, {host, session: clone(receipt.session), agent: clone(agent), operationId: operation.id, outcome: state.state});
  if (closeFailure) {
    state.state = 'failed';
    state.failure = `Inline operation agent could not close cleanly: ${closeFailure}`;
    state.output = null;
  }
}

function refreshBlocked(receipt) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const operation of receipt.operations) {
      if (operation.state !== 'pending') continue;
      const failed = operation.dependsOn.find(id => ['failed', 'blocked'].includes(receipt.operations.find(candidate => candidate.id === id)?.state));
      if (failed) {
        operation.state = 'blocked';
        operation.blockedBy = failed;
        operation.blockedReason = 'dependency-failed';
        operation.gate.state = 'blocked';
        changed = true;
      }
    }
  }
}

function readyOperations(receipt, orderedOperations) {
  return orderedOperations.filter(operation => {
    const state = receipt.operations.find(candidate => candidate.id === operation.id);
    return ['pending', 'paused'].includes(state.state)
      && operation.dependsOn.every(id => receipt.operations.find(candidate => candidate.id === id)?.state === 'completed');
  });
}

function requiresOrcaReceipt({host, definition, orderedOperations, reason, receipt, maxConcurrentOperationAgents}) {
  const next = receipt === undefined ? newReceipt({host, definition, orderedOperations, maxConcurrentOperationAgents}) : clone(receipt);
  next.status = 'requiresOrca';
  next.requiresOrca = {
    reason,
    rule: 'Solo hosts allow one isolated inline background agent per operation and at most three operation agents; intra-operation fan-out and child-worktree orchestration require Orca',
  };
  next.activeOperations = [];
  return next;
}

/** Execute a fixed workflow in the current Codex or Claude chat session. */
export async function runSoloWorkflow({host, workflow, adapters, receipt}) {
  requireThat(SOLO_HOSTS.has(host), 'Solo host must be codex or claude');
  const orderedOperations = normalizeOperations(workflow);
  const definition = definitionFor(workflow, orderedOperations);
  const maxConcurrentOperationAgents = concurrencyFor(workflow);
  if (receipt !== undefined) assertReceipt(receipt, {host, definition, orderedOperations, maxConcurrentOperationAgents});

  const reason = requiresOrcaReason(workflow, orderedOperations);
  if (reason !== null) return requiresOrcaReceipt({host, definition, orderedOperations, reason, receipt, maxConcurrentOperationAgents});

  assertAdapters(adapters);
  const next = receipt === undefined ? newReceipt({host, definition, orderedOperations, maxConcurrentOperationAgents}) : clone(receipt);
  if (['blocked', 'failed', 'completed', 'requiresOrca'].includes(next.status)) return next;
  next.session = await currentSession({host, workflow, receipt: next, adapter: adapters.session});

  while (true) {
    refreshBlocked(next);
    const ready = readyOperations(next, orderedOperations).slice(0, maxConcurrentOperationAgents);
    if (!ready.length) break;
    next.status = 'running';
    next.activeOperations = ready.map(operation => operation.id);
    await Promise.all(ready.map(operation => executeOperation({
      host,
      workflow,
      operation,
      state: next.operations.find(candidate => candidate.id === operation.id),
      receipt: next,
      adapters,
    })));
    next.activeOperations = [];
    refreshBlocked(next);
    if (next.operations.some(operation => operation.state === 'paused')) {
      next.status = 'paused';
      return next;
    }
  }

  next.activeOperations = [];
  if (next.operations.every(operation => operation.state === 'completed')) next.status = 'completed';
  else if (next.operations.some(operation => operation.state === 'failed')) next.status = 'failed';
  else next.status = 'blocked';
  return next;
}

export function isSoloHost(host) {
  return SOLO_HOSTS.has(host);
}

export function validateSoloReceipt({host, workflow, receipt}) {
  requireThat(SOLO_HOSTS.has(host), 'Solo host must be codex or claude');
  const orderedOperations = normalizeOperations(workflow);
  assertReceipt(receipt, {
    host,
    definition: definitionFor(workflow, orderedOperations),
    orderedOperations,
    maxConcurrentOperationAgents: concurrencyFor(workflow),
  });
  return true;
}

export const soloExecutionLimits = Object.freeze({maxConcurrentOperationAgents: MAX_INLINE_OPERATION_AGENTS});
