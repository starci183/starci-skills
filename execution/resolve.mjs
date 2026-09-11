import {validateWorkflowRequest} from './contracts.mjs';

const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const clone = value => structuredClone(value);

function canonicalEnvironment(registry, environment) {
  return registry.aliases?.[environment] ?? environment;
}

function validateRegistry(registry) {
  if (!plain(registry) || registry.schema !== 'starci/profile-registry@3') throw Error('Profile registry starci/profile-registry@3 is required');
  if (!plain(registry.targets) || !plain(registry.operators) || !plain(registry.fallback)) throw Error('Profile registry targets, operators and fallback are required');
  const solo = registry.executionModes?.solo, orchestrated = registry.executionModes?.orchestrated;
  if (solo?.controlPlane !== 'current-chat-session'
    || solo?.operationAgent !== 'inline-background-agent'
    || solo?.maxConcurrentOperationAgents !== 3
    || solo?.isolation !== 'isolated-per-operation'
    || solo?.fanOutWithinOperation !== 'forbidden'
    || orchestrated?.controlPlane !== 'orca'
    || orchestrated?.workflowWrapperAgent !== 'persistent-native-manager-agent-in-child-worktree'
    || orchestrated?.operationAgent !== 'workflow-inline-subagent'
    || orchestrated?.maxConcurrentOperationAgents !== 3
    || orchestrated?.worktree !== 'isolated-child-per-workflow-attempt'
    || orchestrated?.isolation !== 'isolated-per-operation'
    || orchestrated?.fanOutWithinOperation !== 'forbidden') {
    throw Error('Profile registry execution modes must keep workflow-child worktrees, per-operation subagent isolation and the Codex/Claude versus Orca host boundaries');
  }
  if (registry.agentArchitecture?.isolationBoundary !== 'operation'
    || registry.agentArchitecture?.operationMapping !== 'one-operation-instance-one-agent'
    || registry.agentArchitecture?.concreteAgentBinding !== 'provider-profile-model') {
    throw Error('Profile registry must preserve the five-layer operation-agent architecture');
  }
  if (!Array.isArray(registry.fallback.allowedReasons) || registry.fallback.requiredEffectState !== 'none') throw Error('Profile registry fallback policy is invalid');
}

/** Resolve the exact operator chain while validating every target against its declared environment. */
export function flattenOperationCandidates({operation, registry}) {
  validateRegistry(registry);
  const operationName = typeof operation === 'string' ? operation : operation?.operation;
  if (!text(operationName)) throw Error('Operation name is required');
  const route = registry.operators[operationName];
  if (!plain(route) || !Array.isArray(route.environments) || !route.environments.length) throw Error(`Unknown operation route: ${operationName}`);
  if (!Array.isArray(route.chain) || !route.chain.length) throw Error(`Operation route needs an exact target chain: ${operationName}`);
  const seenEnvironments = new Set(), seenTargets = new Set(), declaredTargets = new Map();
  for (const [environmentPriority, group] of route.environments.entries()) {
    if (!plain(group) || !text(group.environment) || !Array.isArray(group.profiles) || !group.profiles.length) throw Error(`Invalid environment chain for operation ${operationName}`);
    const environment = canonicalEnvironment(registry, group.environment);
    if (seenEnvironments.has(environment)) throw Error(`Duplicate environment in operation route: ${environment}`);
    seenEnvironments.add(environment);
    for (const [profilePriority, target] of group.profiles.entries()) {
      if (!text(target) || seenTargets.has(target)) throw Error(`Duplicate or invalid target in operation route: ${target}`);
      seenTargets.add(target);
      const configured = registry.targets[target];
      if (!plain(configured)) throw Error(`Unknown execution target: ${target}`);
      const targetEnvironment = canonicalEnvironment(registry, configured.runtime);
      if (targetEnvironment !== environment) throw Error(`Execution target ${target} does not belong to environment ${environment}`);
      if (!text(configured.profile) || !(configured.requestedModel === null || text(configured.requestedModel))) throw Error(`Execution target ${target} has invalid profile or requestedModel`);
      declaredTargets.set(target, {environmentPriority, profilePriority, environment, configured});
    }
  }
  if (route.chain.length !== declaredTargets.size || new Set(route.chain).size !== route.chain.length) throw Error(`Operation route chain must contain every declared target exactly once: ${operationName}`);
  return route.chain.map((target, priority) => {
    const declared = declaredTargets.get(target);
    if (!declared) throw Error(`Operation route chain contains an undeclared target: ${target}`);
    const {environmentPriority, profilePriority, environment, configured} = declared;
    return {
      priority,
      environmentPriority,
      profilePriority,
      target,
      environment,
      runtime: environment,
      profile: configured.profile,
      requestedModel: configured.requestedModel,
      orcaLaunch: clone(configured.orcaLaunch)
    };
  });
}

function inventoryByEnvironment(inventory, registry) {
  if (!Array.isArray(inventory)) throw Error('Observed environment inventory must be an array');
  const result = new Map();
  for (const item of inventory) {
    const value = typeof item === 'string' ? {environment: item, status: 'ready'} : item;
    if (!plain(value) || !text(value.environment ?? value.runtime)) throw Error('Environment observation requires environment');
    const environment = canonicalEnvironment(registry, value.environment ?? value.runtime);
    if (result.has(environment)) throw Error(`Duplicate environment observation: ${environment}`);
    if (!['ready', 'unavailable', 'unknown'].includes(value.status)) throw Error(`Invalid environment observation status: ${value.status}`);
    if (value.profiles !== undefined && !Array.isArray(value.profiles)) throw Error(`Environment observation profiles must be an array: ${environment}`);
    result.set(environment, {...clone(value), environment});
  }
  return result;
}

function profileObservation(environmentObservation, candidate) {
  if (!environmentObservation || environmentObservation.status !== 'ready') return null;
  if (environmentObservation.profiles === undefined) return {profile: candidate.profile, status: 'ready', observedModel: environmentObservation.observedModel ?? null};
  const match = environmentObservation.profiles.find(value => typeof value === 'string'
    ? value === candidate.profile || value === candidate.target
    : value?.profile === candidate.profile || value?.target === candidate.target);
  if (match === undefined) return null;
  return typeof match === 'string' ? {profile: candidate.profile, status: 'ready', observedModel: environmentObservation.observedModel ?? null} : match;
}

function attemptsByTarget(attempts, candidates, fallback) {
  if (!Array.isArray(attempts)) throw Error('Execution attempts must be an array');
  const known = new Set(candidates.map(candidate => candidate.target)), result = new Map();
  for (const attempt of attempts) {
    if (!plain(attempt) || !text(attempt.target) || result.has(attempt.target) || !known.has(attempt.target)) throw Error('Execution attempt must identify one unique candidate target');
    if (attempt.effectState !== fallback.requiredEffectState) throw Error(`Unsafe fallback for ${attempt.target}: effectState must be none`);
    if (!fallback.allowedReasons.includes(attempt.reason)) throw Error(`Fallback reason requires reconciliation for ${attempt.target}: ${attempt.reason}`);
    result.set(attempt.target, clone(attempt));
  }
  return result;
}

/** Resolve one workflow operation without dispatching or mutating supplied evidence. */
export function resolveOperation({workflowRequest, operationId, registry, inventory, attempts = []}) {
  validateWorkflowRequest(workflowRequest);
  validateRegistry(registry);
  if (!text(operationId)) throw Error('operationId is required');
  const operation = workflowRequest.spec.operations.find(value => value.id === operationId);
  if (!operation) throw Error(`Workflow operation not found: ${operationId}`);
  let candidates = flattenOperationCandidates({operation, registry});
  if (workflowRequest.spec.mode === 'solo' && workflowRequest.spec.soloHost !== 'orca') {
    const soloHost = canonicalEnvironment(registry, workflowRequest.spec.soloHost);
    candidates = candidates.filter(candidate => candidate.environment === soloHost);
    if (!candidates.length) {
      const role = (registry.reasoningOps ?? []).includes(operation.operation) ? 'reasoning' : 'working';
      const profile = registry.defaults?.[soloHost]?.[role];
      const match = Object.entries(registry.targets).find(([, target]) => canonicalEnvironment(registry, target.runtime) === soloHost && target.profile === profile);
      if (match) {
        const [target, configured] = match;
        candidates = [{priority:0,environmentPriority:0,profilePriority:0,target,environment:soloHost,runtime:soloHost,profile:configured.profile,requestedModel:configured.requestedModel,orcaLaunch:clone(configured.orcaLaunch)}];
      }
    }
  }
  if (!candidates.length) throw Error(`No execution candidates for operation ${operationId} in requested mode`);
  const observed = inventoryByEnvironment(inventory, registry);
  const attempted = attemptsByTarget(attempts, candidates, registry.fallback);
  const observations = candidates.map(candidate => {
    const environmentObservation = observed.get(candidate.environment);
    const profile = profileObservation(environmentObservation, candidate);
    const attempt = attempted.get(candidate.target);
    const ready = !attempt && environmentObservation?.status === 'ready' && profile?.status === 'ready';
    return {
      ...candidate,
      status: attempt ? 'failed' : ready ? 'ready' : 'unavailable',
      requestedModel: candidate.requestedModel,
      observedModel: profile?.observedModel ?? null,
      reason: ready ? null : attempt?.reason ?? (environmentObservation?.status === 'unknown' ? 'unavailable' : environmentObservation?.reason ?? profile?.reason ?? 'unavailable'),
      observation: environmentObservation ? clone(environmentObservation) : null
    };
  });
  const selectedObservation = observations.find(value => value.status === 'ready') ?? null;
  const selected = selectedObservation ? {
    priority: selectedObservation.priority,
    environmentPriority: selectedObservation.environmentPriority,
    profilePriority: selectedObservation.profilePriority,
    target: selectedObservation.target,
    environment: selectedObservation.environment,
    runtime: selectedObservation.runtime,
    profile: selectedObservation.profile,
    requestedModel: selectedObservation.requestedModel,
    observedModel: selectedObservation.observedModel,
    orcaLaunch: clone(selectedObservation.orcaLaunch)
  } : null;
  return {
    schema: 'starci/operation-execution-resolution@1',
    workflowId: workflowRequest.metadata.workflowId,
    operationId,
    operation: operation.operation,
    selected,
    observations,
    exhausted: selected === null
  };
}

export const resolveOperationExecution = resolveOperation;
