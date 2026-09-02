import { validatorFor, runValidatorCli } from './validation.mjs';

/**
 * The three service kinds are branches of one job, not three operators. Each branch publishes its
 * own closed effect set, its own required proof set, and the exact capability it needs. An effect
 * or a check filed under the wrong kind is how a Sonar gate assignment acquires the appearance of
 * being an approved tunnel change, so the mismatch is invalid input rather than a warning.
 */
export const KIND_EFFECTS = {
  observability: ['update-config', 'restart-service', 'upsert-dashboard', 'update-remote-write'],
  sonar: ['create-project', 'assign-profile', 'assign-gate', 'enforce-setting'],
  tunnel: ['create-tunnel', 'update-tunnel-route', 'upsert-proxied-dns'],
};

export const KIND_CHECKS = {
  observability: [
    'service-health',
    'target-boundary',
    'label-boundary',
    'remote-write-delivery',
    'sample-ordering',
    'retry-backoff',
    'sensitive-data-filter',
  ],
  sonar: [
    'service-available',
    'project-exists',
    'source-revision',
    'profile-assigned',
    'gate-assigned',
    'enforcement-active',
  ],
  tunnel: ['dns-target', 'tunnel-route', 'tls', 'public-https'],
};

export const KIND_CAPABILITIES = {
  observability: ['metrics:remote-write'],
  sonar: ['sonar:project-admin'],
  tunnel: ['tunnel:write', 'dns:write'],
};

export const KIND_KNOWLEDGE = {
  observability: 'platform.observability',
  sonar: 'platform.sonar',
  tunnel: 'platform.tunnel',
};

/**
 * A credential is resolved for use, never written down. Fingerprints and commit heads are legitimate
 * long hex, so they are scrubbed before the unbroken-run heuristic runs.
 */
export function looksLikeSecret(value) {
  const scrubbed = value.replaceAll(/sha256:[0-9a-f]{64}/g, '').replaceAll(/\b[0-9a-f]{40}\b/g, '');
  if (/(?:token|secret|password|api[_-]?key|bearer|authorization)\s*[:=]\s*\S/i.test(scrubbed)) return true;
  return /[A-Za-z0-9+=]{32,}/.test(scrubbed);
}

export function forEachString(value, visit, at = '$') {
  if (typeof value === 'string') return visit(value, at);
  if (Array.isArray(value)) {
    value.forEach((item, index) => forEachString(item, visit, `${at}[${index}]`));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) forEachString(child, visit, `${at}.${key}`);
  }
}

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { context, input } = value;
  const { knowledge, authority, capabilities, inventory, sourceRefs } = context;
  const { project, service, desiredState, portClaims, scope, resume } = input;
  const kind = service.kind;

  const knowledgeIds = knowledge.records.map((record) => record.knowledgeId);
  if (new Set(knowledgeIds).size !== knowledgeIds.length) {
    errors.push('knowledge.records must bind each platform record at most once');
  }
  if (!knowledgeIds.includes(KIND_KNOWLEDGE[kind])) {
    errors.push(`the ${kind} branch requires the ${KIND_KNOWLEDGE[kind]} knowledge record`);
  }

  const allowedForKind = new Set(KIND_EFFECTS[kind]);
  for (const effect of authority.allowedEffects) {
    if (!allowedForKind.has(effect)) {
      errors.push(`approved effect ${effect} does not belong to the ${kind} service kind`);
    }
  }
  const allowed = new Set(authority.allowedEffects);
  if (new Set(desiredState.effects).size !== desiredState.effects.length) {
    errors.push('desiredState.effects must not repeat an effect');
  }
  for (const effect of desiredState.effects) {
    if (!allowedForKind.has(effect)) {
      errors.push(`requested effect ${effect} does not belong to the ${kind} service kind`);
    } else if (!allowed.has(effect)) {
      errors.push(`requested effect ${effect} is outside the approved effect set`);
    }
  }

  if (desiredState.planSha256 !== authority.planSha256) {
    errors.push('desiredState.planSha256 must equal the approved authority.planSha256');
  }

  // The required proof set is the whole set the kind publishes. A caller cannot ask for a
  // narrower proof, because a green dashboard alone never proved delivery, ordering, or redaction.
  const requiredChecks = KIND_CHECKS[kind];
  const requested = new Set(desiredState.requiredCheckNames);
  if (requested.size !== desiredState.requiredCheckNames.length) {
    errors.push('desiredState.requiredCheckNames must not repeat a check');
  }
  for (const name of requiredChecks) {
    if (!requested.has(name)) errors.push(`the ${kind} branch must require the ${name} check`);
  }
  for (const name of requested) {
    if (!requiredChecks.includes(name)) {
      errors.push(`check ${name} does not belong to the ${kind} service kind`);
    }
  }

  const held = capabilities.map((item) => item.capability);
  if (new Set(held).size !== held.length) errors.push('context.capabilities must not repeat a capability');
  for (const item of capabilities) {
    if (!KIND_CAPABILITIES[kind].includes(item.capability)) {
      errors.push(`capability ${item.capability} is not used by the ${kind} branch`);
    }
  }
  for (const capability of KIND_CAPABILITIES[kind]) {
    if (!held.includes(capability)) errors.push(`the ${kind} branch requires the ${capability} capability`);
  }

  // A shared service is inventoried before it is changed. A resource absent from the bound
  // inventory, or belonging to another kind, is out of this operator's ownership entirely.
  const inventoried = new Map(inventory.resources.map((item) => [item.resourceRef, item]));
  if (inventoried.size !== inventory.resources.length) {
    errors.push('inventory.resources must not list a resource twice');
  }
  if (!inventoried.has(service.serviceRef)) {
    errors.push(`service ${service.serviceRef} was not inventoried before the operation`);
  }
  for (const ref of desiredState.resourceRefs) {
    const resource = inventoried.get(ref);
    if (!resource) errors.push(`desired resource ${ref} is absent from the bound inventory`);
    else if (resource.kind !== kind) {
      errors.push(`resource ${ref} belongs to the ${resource.kind} branch and is outside this ${kind} operation`);
    }
  }

  const mutable = new Set(scope.mutableResourceRefs);
  const observed = new Set(scope.observationOnlyResourceRefs);
  if (!mutable.has(service.serviceRef)) errors.push('service.serviceRef must be inside mutableResourceRefs');
  for (const ref of mutable) {
    if (observed.has(ref)) errors.push(`resource ${ref} cannot be both mutable and observation-only`);
  }
  for (const ref of desiredState.resourceRefs) {
    if (!mutable.has(ref)) errors.push(`desired resource ${ref} lies outside the mutable ceiling`);
  }

  const claimedPorts = portClaims.map((claim) => claim.port);
  if (new Set(claimedPorts).size !== claimedPorts.length) {
    errors.push('portClaims must not claim the same port twice');
  }
  for (const claim of portClaims) {
    if (!desiredState.resourceRefs.includes(claim.resourceRef)) {
      errors.push(`port ${claim.port} is claimed for ${claim.resourceRef}, which this operation does not own`);
    }
  }
  const holders = inventory.portHolders.map((item) => item.port);
  if (new Set(holders).size !== holders.length) {
    errors.push('inventory.portHolders must not list the same port twice');
  }

  const routedSource = sourceRefs.find((item) => item.ref === project.workspaceSourceRef);
  if (!routedSource) errors.push('context.sourceRefs must include input.project.workspaceSourceRef');
  else if (routedSource.sourceHead !== project.sourceHead) {
    errors.push('workspace source context must bind input.project.sourceHead');
  }

  if (resume !== null && resume.addedContextRefs.length === 0) {
    errors.push('resume must add at least one authority, inventory, desired-state, or scope reference');
  }

  if (/(^|[\\/])\.\.([\\/]|$)/.test(project.artifactRootRef)) {
    errors.push('artifactRootRef cannot contain path traversal');
  }

  forEachString(value, (text, at) => {
    if (looksLikeSecret(text)) errors.push(`${at}: a credential value cannot enter the operator contract`);
  });

  return errors;
});

if (process.argv[1]?.endsWith('validate-input.mjs')) {
  await runValidatorCli(validateInput, 'node validate-input.mjs <input.json>');
}
