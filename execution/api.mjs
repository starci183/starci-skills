import {
  createWorkflowReceipt,
  recordOperationReceipt,
  validateWorkflowRequest,
} from './contracts.mjs';
import {resolveOperationExecution} from './resolve.mjs';

const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const clone = value => structuredClone(value);

function operationReceipt(operation, resolution) {
  const selected = resolution.selected;
  return {
    operationId: operation.id,
    operation: operation.operation,
    status: selected ? 'selected' : 'unavailable',
    environment: selected?.environment ?? null,
    profile: selected?.profile ?? null,
    requestedModel: selected?.requestedModel ?? null,
    observedModel: selected?.observedModel ?? null,
    observations: resolution.observations.map(observation => ({
      environment: observation.environment,
      profile: observation.profile,
      status: observation.status,
      requestedModel: observation.requestedModel,
      observedModel: observation.observedModel,
      reason: observation.reason,
      target: observation.target,
    })),
  };
}

/** Resolve every operation without launching an agent or mutating a repository. */
export function planWorkflowExecution({request, registry, inventory, attemptsByOperation = {}}) {
  validateWorkflowRequest(request);
  if (!Array.isArray(inventory)) throw Error('Observed environment inventory must be an array');
  if (!plain(attemptsByOperation)) throw Error('attemptsByOperation must be an object');
  let receipt = createWorkflowReceipt(request);
  const resolutions = [];
  for (const operation of request.spec.operations) {
    const resolution = resolveOperationExecution({
      workflowRequest: request,
      operationId: operation.id,
      registry,
      inventory,
      attempts: attemptsByOperation[operation.id] ?? [],
    });
    resolutions.push(resolution);
    receipt = recordOperationReceipt(receipt, operationReceipt(operation, resolution));
  }
  return {
    schema: 'starci/workflow-execution-plan@1',
    mode: request.spec.mode,
    host: request.spec.mode === 'solo' ? request.spec.soloHost : null,
    controlPlane: request.spec.mode === 'orchestrated' ? 'orca' : null,
    executionBoundary: request.spec.mode === 'solo'
      ? 'one-agent-one-isolated-worktree-step-by-step'
      : 'orca-supervised-multi-agent',
    receipt,
    resolutions,
  };
}

function validateReceiptShape(request, receipt) {
  if (!plain(receipt) || receipt.apiVersion !== 'starci.execution/v1' || receipt.kind !== 'WorkflowReceipt') throw Error('WorkflowReceipt is required');
  if (receipt.metadata?.workflowId !== request.metadata.workflowId || receipt.metadata?.project !== request.metadata.project) throw Error('WorkflowReceipt does not belong to this workflow');
  if (!Array.isArray(receipt.operations) || receipt.operations.length !== request.spec.operations.length) throw Error('WorkflowReceipt operation set changed');
  for (const [index, operation] of request.spec.operations.entries()) {
    const row = receipt.operations[index];
    if (row?.operationId !== operation.id || row?.operation !== operation.operation) throw Error(`WorkflowReceipt operation order changed at ${operation.id}`);
  }
}

/** Inspect a stable receipt and identify the next dependency-safe operation. No work is resumed. */
export function inspectWorkflowExecution({request, receipt}) {
  validateWorkflowRequest(request);
  validateReceiptShape(request, receipt);
  const byId = new Map(receipt.operations.map(row => [row.operationId, row]));
  const next = request.spec.operations.find(operation => {
    const row = byId.get(operation.id);
    return row.status !== 'completed' && operation.dependsOn.every(id => byId.get(id)?.status === 'completed');
  }) ?? null;
  const blockers = request.spec.operations
    .filter(operation => byId.get(operation.id)?.status !== 'completed')
    .map(operation => ({
      operationId: operation.id,
      waitingOn: operation.dependsOn.filter(id => byId.get(id)?.status !== 'completed'),
    }))
    .filter(item => item.waitingOn.length);
  return {
    schema: 'starci/workflow-execution-inspection@1',
    workflowId: request.metadata.workflowId,
    status: receipt.status,
    mode: request.spec.mode,
    host: request.spec.mode === 'solo' ? request.spec.soloHost : null,
    controlPlane: request.spec.mode === 'orchestrated' ? 'orca' : null,
    nextOperationId: next?.id ?? null,
    blockers,
    executed: false,
  };
}

/** Build the exact shared-change escalation that an Orca coordinator must decide. */
export function createSharedConflictEscalation({plan, operationId, taskId, dispatchId, files}) {
  if (!plain(plan) || plan.schema !== 'starci/orca-execution-plan@1') throw Error('Orca execution plan is required');
  if (![operationId, taskId, dispatchId].every(text)) throw Error('operationId, taskId and dispatchId are required');
  const operation = plan.operations?.[operationId];
  if (!plain(operation)) throw Error(`Unknown Orca operation: ${operationId}`);
  const attempt = operation.attempts?.at(-1);
  if (attempt?.taskId !== taskId || attempt?.dispatchId !== dispatchId || attempt.status !== 'dispatched') throw Error('Escalation does not belong to the active Orca Dispatch');
  if (!Array.isArray(files) || !files.length || files.some(file => !text(file) || file.includes('\\') || file.startsWith('/') || /^[A-Za-z]:/.test(file) || file.split('/').some(part => !part || part === '.' || part === '..'))) throw Error('Escalation requires safe repository-relative files');
  return {
    type: 'escalation',
    reason: 'out-of-scope-shared-change',
    operationId,
    taskId,
    dispatchId,
    files: [...new Set(files)],
    requiredDecision: 'create-conflict-owner',
    executed: false,
  };
}
