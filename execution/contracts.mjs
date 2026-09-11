const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const clone = value => structuredClone(value);

function exact(value, fields, at) {
  if (!plain(value)) throw Error(`${at} must be an object`);
  for (const field of fields) if (!Object.hasOwn(value, field)) throw Error(`${at}.${field} is required`);
  for (const field of Object.keys(value)) if (!fields.includes(field)) throw Error(`${at}.${field} is not supported`);
}

function strings(value, at) {
  if (!Array.isArray(value) || value.some(item => !text(item))) throw Error(`${at} must be an array of non-empty strings`);
  if (new Set(value).size !== value.length) throw Error(`${at} must not contain duplicates`);
}

function source(value, at) {
  exact(value, ['repository', 'baseRef'], at);
  if (!text(value.repository) || !text(value.baseRef)) throw Error(`${at} requires repository and baseRef`);
}

function validateOperations(operations) {
  if (!Array.isArray(operations) || !operations.length) throw Error('WorkflowRequest.spec.operations must be a non-empty ordered array');
  const ids = new Map();
  for (const [index, operation] of operations.entries()) {
    const at = `WorkflowRequest.spec.operations[${index}]`;
    exact(operation, ['id', 'operation', 'dependsOn', 'gate', 'capabilities'], at);
    if (!text(operation.id) || !text(operation.operation) || !text(operation.gate)) throw Error(`${at} requires id, operation and gate`);
    if (ids.has(operation.id)) throw Error(`WorkflowRequest operation id is duplicated: ${operation.id}`);
    ids.set(operation.id, index);
    strings(operation.dependsOn, `${at}.dependsOn`);
    strings(operation.capabilities, `${at}.capabilities`);
    if (operation.dependsOn.includes(operation.id)) throw Error(`WorkflowRequest operation ${operation.id} cannot depend on itself`);
  }
  for (const operation of operations) {
    for (const dependency of operation.dependsOn) {
      if (!ids.has(dependency)) throw Error(`WorkflowRequest operation ${operation.id} has missing dependency ${dependency}`);
    }
  }
  const visiting = new Set(), visited = new Set();
  const visit = id => {
    if (visiting.has(id)) throw Error(`WorkflowRequest operation dependency cycle includes ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of operations[ids.get(id)].dependsOn) visit(dependency);
    visiting.delete(id); visited.add(id);
  };
  for (const operation of operations) visit(operation.id);
  for (const operation of operations) {
    for (const dependency of operation.dependsOn) {
      if (ids.get(dependency) >= ids.get(operation.id)) throw Error(`WorkflowRequest operation ${operation.id} must follow dependency ${dependency}`);
    }
  }
}

/** Validate the closed shared workflow envelope. Validation never mutates the request. */
export function validateWorkflowRequest(request) {
  exact(request, ['apiVersion', 'kind', 'metadata', 'spec'], 'WorkflowRequest');
  if (request.apiVersion !== 'starci.workflow/v1' || request.kind !== 'WorkflowRequest') throw Error('Expected starci.workflow/v1 WorkflowRequest');
  exact(request.metadata, ['workflowId', 'project'], 'WorkflowRequest.metadata');
  if (!text(request.metadata.workflowId) || !text(request.metadata.project)) throw Error('WorkflowRequest.metadata requires workflowId and project');
  if (!plain(request.spec)) throw Error('WorkflowRequest.spec must be an object');
  const common = ['mode', 'source', 'operations'];
  if (request.spec.mode === 'solo') {
    exact(request.spec, [...common, 'soloHost'], 'WorkflowRequest.spec');
    if (!['codex', 'claude'].includes(request.spec.soloHost)) throw Error('WorkflowRequest.spec.soloHost must be codex or claude');
  } else if (request.spec.mode === 'orchestrated') {
    exact(request.spec, [...common, 'controlPlane'], 'WorkflowRequest.spec');
    if (request.spec.controlPlane !== 'orca') throw Error('Orchestrated WorkflowRequest requires controlPlane orca');
  } else {
    throw Error('WorkflowRequest.spec.mode must be solo or orchestrated');
  }
  source(request.spec.source, 'WorkflowRequest.spec.source');
  validateOperations(request.spec.operations);
  return true;
}

/** Validate one provider-bound request derived from a WorkflowRequest operation. */
export function validateExecutionRequest(request) {
  exact(request, ['apiVersion', 'kind', 'metadata', 'spec'], 'ExecutionRequest');
  if (request.apiVersion !== 'starci.execution/v1' || request.kind !== 'ExecutionRequest') throw Error('Expected starci.execution/v1 ExecutionRequest');
  exact(request.metadata, ['workflowId', 'operationId', 'requestId'], 'ExecutionRequest.metadata');
  if (![request.metadata.workflowId, request.metadata.operationId, request.metadata.requestId].every(text)) throw Error('ExecutionRequest.metadata requires workflowId, operationId and requestId');
  exact(request.spec, ['operation', 'environment', 'profile', 'requestedModel', 'source', 'gate', 'capabilities'], 'ExecutionRequest.spec');
  if (![request.spec.operation, request.spec.environment, request.spec.profile, request.spec.gate].every(text)) throw Error('ExecutionRequest.spec requires operation, environment, profile and gate');
  if (!(request.spec.requestedModel === null || text(request.spec.requestedModel))) throw Error('ExecutionRequest.spec.requestedModel must be a non-empty string or null');
  source(request.spec.source, 'ExecutionRequest.spec.source');
  strings(request.spec.capabilities, 'ExecutionRequest.spec.capabilities');
  return true;
}

function pendingReceipt(operation) {
  return {
    operationId: operation.id,
    operation: operation.operation,
    status: 'pending',
    environment: null,
    profile: null,
    requestedModel: null,
    observedModel: null,
    observations: []
  };
}

/** Create an ordered receipt skeleton without retaining a mutable request reference. */
export function createWorkflowReceipt(request) {
  validateWorkflowRequest(request);
  return {
    apiVersion: 'starci.execution/v1',
    kind: 'WorkflowReceipt',
    metadata: clone(request.metadata),
    status: 'pending',
    operations: request.spec.operations.map(pendingReceipt)
  };
}

function validateOperationReceipt(receipt) {
  exact(receipt, ['operationId', 'operation', 'status', 'environment', 'profile', 'requestedModel', 'observedModel', 'observations'], 'OperationReceipt');
  if (!text(receipt.operationId) || !text(receipt.operation)) throw Error('OperationReceipt requires operationId and operation');
  if (!['selected', 'unavailable', 'completed', 'failed', 'blocked'].includes(receipt.status)) throw Error('OperationReceipt.status is unsupported');
  for (const key of ['environment', 'profile', 'requestedModel', 'observedModel']) if (!(receipt[key] === null || text(receipt[key]))) throw Error(`OperationReceipt.${key} must be a non-empty string or null`);
  if (!Array.isArray(receipt.observations)) throw Error('OperationReceipt.observations must be an array');
  for (const [index, observation] of receipt.observations.entries()) {
    const at = `OperationReceipt.observations[${index}]`;
    if (!plain(observation) || ![observation.environment, observation.profile].every(text)) throw Error(`${at} requires environment and profile`);
    if (!['ready', 'unavailable', 'failed'].includes(observation.status)) throw Error(`${at}.status is unsupported`);
    for (const key of ['requestedModel', 'observedModel']) if (!(observation[key] === null || text(observation[key]))) throw Error(`${at}.${key} must be a non-empty string or null`);
  }
}

/** Replace one ordered operation row and derive aggregate status; inputs remain immutable. */
export function recordOperationReceipt(workflowReceipt, operationReceipt) {
  if (!plain(workflowReceipt) || workflowReceipt.apiVersion !== 'starci.execution/v1' || workflowReceipt.kind !== 'WorkflowReceipt' || !Array.isArray(workflowReceipt.operations)) throw Error('Valid WorkflowReceipt is required');
  validateOperationReceipt(operationReceipt);
  const index = workflowReceipt.operations.findIndex(row => row.operationId === operationReceipt.operationId);
  if (index < 0) throw Error(`OperationReceipt does not belong to workflow: ${operationReceipt.operationId}`);
  if (workflowReceipt.operations[index].operation !== operationReceipt.operation) throw Error(`OperationReceipt operation mismatch for ${operationReceipt.operationId}`);
  const next = clone(workflowReceipt);
  next.operations[index] = clone(operationReceipt);
  const statuses = next.operations.map(row => row.status);
  next.status = statuses.includes('failed') ? 'failed'
    : statuses.includes('blocked') ? 'blocked'
      : statuses.every(status => status === 'completed') ? 'completed'
        : statuses.every(status => status === 'pending') ? 'pending' : 'running';
  return next;
}
