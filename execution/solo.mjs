import {
  createHash,
} from 'node:crypto';

const RECEIPT_SCHEMA = 'starci/solo-execution-receipt@1';
const SOLO_HOSTS = new Set(['codex', 'claude']);
const OPERATION_STATES = new Set([
  'pending',
  'running',
  'paused',
  'gating',
  'completed',
  'failed',
  'blocked',
]);
const GATE_STATES = new Set([
  'pending',
  'evaluating',
  'passed',
  'failed',
  'skipped',
  'blocked',
]);

function requireThat(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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

function publicOperation(operation) {
  const value = clone(operation);
  delete value.declarationIndex;
  return value;
}

function definitionFor(workflow, orderedOperations) {
  const workflowDefinition = clone(workflow);
  delete workflowDefinition.operations;
  return {
    workflow: workflowDefinition,
    operations: orderedOperations.map(publicOperation),
  };
}

function canonical(value) {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

function normalizeOperations(workflow) {
  requireThat(isPlainObject(workflow) && isText(workflow.id), 'A solo workflow id is required');
  requireThat(Array.isArray(workflow.operations) && workflow.operations.length > 0, 'A solo workflow needs operations');
  if (workflow.worktree !== undefined) {
    requireThat(isPlainObject(workflow.worktree) && isText(workflow.worktree.id), 'A required solo worktree needs an id');
  }

  const byId = new Map();
  workflow.operations.forEach((source, index) => {
    requireThat(isPlainObject(source) && isText(source.id), 'Every solo operation needs an id');
    requireThat(!byId.has(source.id), `Duplicate solo operation: ${source.id}`);
    requireThat(isPlainObject(source.gate) && isText(source.gate.id), `Operation ${source.id} needs an explicit gate`);
    const dependsOn = source.dependsOn ?? [];
    requireThat(Array.isArray(dependsOn) && dependsOn.every(isText), `Operation ${source.id} has invalid dependencies`);
    requireThat(new Set(dependsOn).size === dependsOn.length && !dependsOn.includes(source.id), `Operation ${source.id} has duplicate or self dependencies`);
    byId.set(source.id, {
      ...clone(source),
      dependsOn: [...dependsOn],
      declarationIndex: index,
    });
  });

  for (const operation of byId.values()) {
    for (const dependency of operation.dependsOn) {
      requireThat(byId.has(dependency), `Operation ${operation.id} depends on unknown operation ${dependency}`);
    }
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
      for (const dependencies of remaining.values()) {
        dependencies.delete(operation.id);
      }
    }
  }
  return ordered;
}

function orchestrationReason(workflow, operations) {
  const candidates = [workflow, workflow.execution, ...operations];
  for (const candidate of candidates) {
    if (!isPlainObject(candidate)) {
      continue;
    }
    if ([candidate.nativeOrchestration, candidate.subagents, candidate.team].some((value) => value === true || isText(value) || (Array.isArray(value) && value.length > 0) || isPlainObject(value))) {
      return 'native-agent-or-team-orchestration';
    }
    if (candidate.parallel === true || candidate.requiresParallel === true || candidate.mode === 'parallel') {
      return 'parallel-execution';
    }
    const writers = candidate.writers ?? candidate.writeOwners;
    if (Array.isArray(writers) && new Set(writers).size > 1) {
      return 'multiple-writers';
    }
    if (candidate.requiresMultipleWriters === true) {
      return 'multiple-writers';
    }
  }
  return null;
}

function newOperationState(operation) {
  return {
    id: operation.id,
    dependsOn: [...operation.dependsOn],
    state: 'pending',
    attempts: 0,
    gate: {
      id: operation.gate.id,
      state: 'pending',
    },
  };
}

function newReceipt({host, definition, orderedOperations}) {
  return {
    schema: RECEIPT_SCHEMA,
    host,
    workflowId: definition.workflow.id,
    definitionDigest: digest(definition),
    status: 'pending',
    worktree: null,
    currentOperation: null,
    resumeCursor: null,
    operations: orderedOperations.map(newOperationState),
  };
}

function assertReceipt(receipt, {host, definition, orderedOperations}) {
  requireThat(isPlainObject(receipt) && receipt.schema === RECEIPT_SCHEMA, 'Invalid solo execution receipt');
  requireThat(receipt.host === host && receipt.workflowId === definition.workflow.id, 'Solo receipt host or workflow changed');
  requireThat(receipt.definitionDigest === digest(definition), 'Solo workflow definition changed since the receipt');
  requireThat(['pending', 'paused', 'failed', 'blocked', 'completed', 'requiresOrca'].includes(receipt.status), 'Invalid solo receipt status');
  requireThat(Array.isArray(receipt.operations) && receipt.operations.length === orderedOperations.length, 'Solo receipt operation set changed');

  receipt.operations.forEach((state, index) => {
    const operation = orderedOperations[index];
    requireThat(
      isPlainObject(state)
        && state.id === operation.id
        && OPERATION_STATES.has(state.state)
        && Number.isInteger(state.attempts)
        && state.attempts >= 0,
      `Invalid receipt state for operation ${operation.id}`,
    );
    requireThat(
      isPlainObject(state.gate)
        && state.gate.id === operation.gate.id
        && GATE_STATES.has(state.gate.state),
      `Invalid receipt gate for operation ${operation.id}`,
    );
  });

  const completed = receipt.operations.filter((operation) => operation.state === 'completed');
  for (const operation of completed) {
    requireThat(operation.gate.state === 'passed', `Completed operation ${operation.id} lacks a passed gate`);
    requireThat(operation.dependsOn.every((id) => receipt.operations.find((candidate) => candidate.id === id)?.state === 'completed'), `Completed operation ${operation.id} has incomplete dependencies`);
  }
  requireThat(!receipt.operations.some((operation) => ['running', 'gating'].includes(operation.state)), 'A solo receipt must be a stable checkpoint');
  requireThat(receipt.currentOperation === null || receipt.operations.some((operation) => operation.id === receipt.currentOperation), 'Receipt current operation is unknown');
  if (receipt.resumeCursor !== null) {
    requireThat(isText(receipt.currentOperation), 'A resume cursor requires a current operation');
  }
  if (receipt.status === 'paused') {
    requireThat(receipt.operations.filter((operation) => operation.state === 'paused').length === 1, 'A paused receipt needs exactly one paused operation');
    requireThat(receipt.operations.find((operation) => operation.id === receipt.currentOperation)?.state === 'paused' && receipt.resumeCursor !== null, 'Paused receipt cursor and current operation disagree');
  }
  if (receipt.status === 'completed') {
    requireThat(receipt.operations.every((operation) => operation.state === 'completed') && receipt.currentOperation === null && receipt.resumeCursor === null, 'Completed receipt contains unfinished operations');
  }
}

function assertAdapters(adapters) {
  requireThat(isPlainObject(adapters), 'Solo adapters are required');
  requireThat(isPlainObject(adapters.worktree) && typeof adapters.worktree.enter === 'function', 'A worktree entry adapter is required');
  requireThat(isPlainObject(adapters.operation) && typeof adapters.operation.run === 'function', 'An operation runner adapter is required');
  requireThat(typeof adapters.operation.evaluateGate === 'function', 'An operation gate adapter is required');
}

async function enterWorktree({host, workflow, receipt, adapter}) {
  const requiredWorktree = receipt.worktree ?? workflow.worktree ?? null;
  const mode = requiredWorktree === null ? 'create' : 'require';
  const worktree = await adapter.enter({
    host,
    workflowId: workflow.id,
    mode,
    requiredWorktree: clone(requiredWorktree),
  });
  requireThat(isPlainObject(worktree) && isText(worktree.id) && worktree.isolated === true, 'Solo workflow entry requires one isolated worktree');
  if (requiredWorktree !== null) {
    requireThat(worktree.id === requiredWorktree.id, 'Solo resume must re-enter the receipt worktree');
  }
  return clone(worktree);
}

function failure(error) {
  return error instanceof Error && isText(error.message) ? error.message : 'Unknown adapter failure';
}

function blockLaterOperations(receipt, failedIndex, reason) {
  receipt.operations.slice(failedIndex + 1).forEach((operation) => {
    if (operation.state === 'pending') {
      operation.state = 'blocked';
      operation.blockedBy = receipt.operations[failedIndex].id;
      operation.blockedReason = reason;
      operation.gate.state = 'blocked';
    }
  });
}

function requiresOrcaReceipt({host, definition, orderedOperations, reason, receipt}) {
  const next = receipt === undefined ? newReceipt({host, definition, orderedOperations}) : clone(receipt);
  next.status = 'requiresOrca';
  next.requiresOrca = {
    reason,
    rule: 'Solo hosts cannot use native subagents, teams, parallel execution, or multiple writers',
  };
  next.currentOperation = null;
  next.resumeCursor = null;
  return next;
}

/**
 * Execute one workflow serially inside one adapter-provided isolated worktree.
 *
 * The returned receipt is the only resume input. Completed operations are verified and
 * skipped; a paused operation alone receives its opaque resume cursor on the next call.
 */
export async function runSoloWorkflow({host, workflow, adapters, receipt}) {
  requireThat(SOLO_HOSTS.has(host), 'Solo host must be codex or claude');
  const orderedOperations = normalizeOperations(workflow);
  const definition = definitionFor(workflow, orderedOperations);
  if (receipt !== undefined) {
    assertReceipt(receipt, {host, definition, orderedOperations});
  }

  const orchestration = orchestrationReason(workflow, orderedOperations);
  if (orchestration !== null) {
    return requiresOrcaReceipt({host, definition, orderedOperations, reason: orchestration, receipt});
  }

  assertAdapters(adapters);
  const next = receipt === undefined ? newReceipt({host, definition, orderedOperations}) : clone(receipt);
  if (['blocked', 'failed', 'completed'].includes(next.status)) {
    return next;
  }
  next.worktree = await enterWorktree({host, workflow, receipt: next, adapter: adapters.worktree});
  next.status = 'running';

  for (let index = 0; index < orderedOperations.length; index += 1) {
    const operation = orderedOperations[index];
    const state = next.operations[index];
    if (state.state === 'completed') {
      continue;
    }
    if (['failed', 'blocked'].includes(state.state)) {
      next.status = 'blocked';
      next.currentOperation = state.id;
      next.resumeCursor = null;
      return next;
    }
    requireThat(operation.dependsOn.every((id) => next.operations.find((candidate) => candidate.id === id)?.state === 'completed'), `Operation ${operation.id} reached execution before its dependencies`);

    const resumeCursor = state.state === 'paused' ? next.resumeCursor : null;
    state.state = 'running';
    state.attempts += 1;
    next.currentOperation = operation.id;
    next.resumeCursor = resumeCursor;

    let result;
    try {
      result = await adapters.operation.run({
        host,
        workflowId: workflow.id,
        worktree: clone(next.worktree),
        operation: publicOperation(operation),
        resumeCursor: clone(resumeCursor),
      });
    } catch (error) {
      result = {status: 'failed', reason: failure(error)};
    }
    requireThat(isPlainObject(result) && ['completed', 'paused', 'failed'].includes(result.status), `Operation ${operation.id} returned an invalid result`);

    if (result.status === 'paused') {
      requireThat(result.resumeCursor !== undefined && result.resumeCursor !== null, `Paused operation ${operation.id} needs a resume cursor`);
      state.state = 'paused';
      state.gate.state = 'pending';
      next.status = 'paused';
      next.resumeCursor = clone(result.resumeCursor);
      return next;
    }
    if (result.status === 'failed') {
      state.state = 'failed';
      state.failure = isText(result.reason) ? result.reason : 'Operation failed';
      state.gate.state = 'skipped';
      next.status = 'failed';
      next.resumeCursor = null;
      blockLaterOperations(next, index, 'earlier-operation-failed');
      return next;
    }

    state.state = 'gating';
    state.result = clone(result.output ?? null);
    state.gate.state = 'evaluating';
    let gateResult;
    try {
      gateResult = await adapters.operation.evaluateGate({
        host,
        workflowId: workflow.id,
        worktree: clone(next.worktree),
        operation: publicOperation(operation),
        result: clone(result),
      });
    } catch (error) {
      gateResult = {status: 'failed', reason: failure(error)};
    }
    requireThat(isPlainObject(gateResult) && ['passed', 'failed'].includes(gateResult.status), `Gate ${operation.gate.id} returned an invalid result`);
    state.gate = {
      id: operation.gate.id,
      state: gateResult.status,
      observation: clone(gateResult.observation ?? null),
    };
    if (gateResult.status === 'failed') {
      state.state = 'failed';
      state.failure = isText(gateResult.reason) ? gateResult.reason : 'Operation gate failed';
      next.status = 'blocked';
      next.resumeCursor = null;
      blockLaterOperations(next, index, 'earlier-gate-failed');
      return next;
    }
    state.state = 'completed';
    next.resumeCursor = null;
  }

  next.status = 'completed';
  next.currentOperation = null;
  next.resumeCursor = null;
  return next;
}

/** Return whether a host may own the constrained solo path. */
export function isSoloHost(host) {
  return SOLO_HOSTS.has(host);
}

/** Validate a receipt against the current workflow definition without executing adapters. */
export function validateSoloReceipt({host, workflow, receipt}) {
  requireThat(SOLO_HOSTS.has(host), 'Solo host must be codex or claude');
  const orderedOperations = normalizeOperations(workflow);
  assertReceipt(receipt, {
    host,
    definition: definitionFor(workflow, orderedOperations),
    orderedOperations,
  });
  return true;
}
