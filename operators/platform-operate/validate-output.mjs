import { validatorFor, runValidatorCli } from './validation.mjs';

const KIND_EFFECTS = {
  observability: ['update-config', 'restart-service', 'upsert-dashboard', 'update-remote-write'],
  sonar: ['create-project', 'assign-profile', 'assign-gate', 'enforce-setting'],
  tunnel: ['create-tunnel', 'update-tunnel-route', 'upsert-proxied-dns'],
};

const KIND_CHECKS = {
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

/**
 * The receipt is the durable record of the operation, and it is read by people. A capability handle
 * or a secret-shaped token inside it is a credential that has been persisted, which is exactly what
 * resolving a credential for use is supposed to avoid.
 */
function credentialLeak(value) {
  if (value.startsWith('capability://')) return true;
  const scrubbed = value.replaceAll(/sha256:[0-9a-f]{64}/g, '').replaceAll(/\b[0-9a-f]{40}\b/g, '');
  if (/(?:token|secret|password|api[_-]?key|bearer|authorization)\s*[:=]\s*\S/i.test(scrubbed)) return true;
  return /[A-Za-z0-9+=]{32,}/.test(scrubbed);
}

function forEachString(value, visit, at = '$') {
  if (typeof value === 'string') return visit(value, at);
  if (Array.isArray(value)) {
    value.forEach((item, index) => forEachString(item, visit, `${at}[${index}]`));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) forEachString(child, visit, `${at}.${key}`);
  }
}

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { outcome, receipt, artifactRefs } = value.output;
  const { status, binding, operation, findings, failure, resume } = receipt;
  const kind = binding.serviceKind;

  if (outcome !== status) errors.push('output.outcome must equal receipt.status');

  if (outcome === 'operated') {
    if (operation === null) errors.push('an operated receipt requires an operation');
    if (failure !== null) errors.push('an operated receipt cannot carry a failure');
    if (resume !== null) errors.push('an operated receipt cannot carry a resume');
  } else {
    if (operation !== null) errors.push('a blocked receipt cannot carry an operation');
    if (failure === null) errors.push('a blocked receipt requires one typed failure');
    else if (failure.retryable && resume === null) errors.push('a retryable failure requires a resume');
    else if (!failure.retryable && resume !== null) errors.push('a non-retryable failure cannot carry a resume');
  }

  // A port already in use is a coordination finding, never permission to reclaim it. The finding
  // must name the port and the process that holds it, and it can only end in a blocked receipt.
  const portHolderRefs = new Set();
  for (const finding of findings) {
    if (finding.code !== 'PORT_COORDINATION_REQUIRED') continue;
    if (finding.port === null) errors.push('a port coordination finding must name the port');
    if (finding.holderRef === null) {
      errors.push('a port coordination finding must name the process that already holds the port');
    } else {
      portHolderRefs.add(finding.holderRef);
    }
    if (outcome === 'operated') {
      errors.push('a port coordination finding cannot end in an operated outcome');
    } else if (failure !== null && failure.code !== 'PORT_CONFLICT') {
      errors.push('a port coordination finding requires the PORT_CONFLICT failure');
    }
  }

  if (operation !== null) {
    const inventoried = new Set(operation.inventoriedResourceRefs);
    for (const holder of operation.observedPortHolders) portHolderRefs.add(holder.holderRef);
    const appliedEffects = operation.appliedEffects;
    const applied = new Set(appliedEffects);
    if (applied.size !== appliedEffects.length) errors.push('appliedEffects must not repeat an effect');
    if (!artifactRefs.includes(operation.receiptArtifactRef)) {
      errors.push('artifactRefs must register the operation receipt artifact');
    }

    const mutatedEffects = new Set();
    for (const mutation of operation.mutations) {
      if (!KIND_EFFECTS[kind].includes(mutation.effect)) {
        errors.push(`effect ${mutation.effect} does not belong to the ${kind} service kind`);
      }
      if (!applied.has(mutation.effect)) {
        errors.push(`mutation effect ${mutation.effect} is absent from appliedEffects`);
      }
      mutatedEffects.add(mutation.effect);
      if (!inventoried.has(mutation.resourceRef)) {
        errors.push(`resource ${mutation.resourceRef} was mutated without being inventoried first`);
      }
      if (portHolderRefs.has(mutation.resourceRef)) {
        errors.push(`resource ${mutation.resourceRef} holds a claimed port and must never be mutated to free it`);
      }
    }
    for (const effect of applied) {
      if (!mutatedEffects.has(effect)) errors.push(`applied effect ${effect} records no mutation`);
    }

    if (operation.convergence === 'already-converged' && operation.mutations.length > 0) {
      errors.push('an already-converged operation cannot report a mutation');
    }
    if (operation.convergence === 'converged' && operation.mutations.length === 0) {
      errors.push('a converged operation must report the mutation that converged it');
    }

    const checkKeys = new Set();
    const proved = new Set();
    for (const check of operation.checks) {
      if (!KIND_CHECKS[kind].includes(check.name)) {
        errors.push(`check ${check.name} does not belong to the ${kind} service kind`);
      }
      const key = `${check.name}|${check.resourceRef}`;
      if (checkKeys.has(key)) errors.push(`check ${check.name} is recorded twice for ${check.resourceRef}`);
      checkKeys.add(key);
      if (!inventoried.has(check.resourceRef)) {
        errors.push(`check ${check.name} names uninventoried resource ${check.resourceRef}`);
      }
      if (check.status === 'passed') proved.add(check.name);
      else if (outcome === 'operated') {
        errors.push(`check ${check.name} failed, so the operation cannot be reported as operated`);
      }
    }
    if (outcome === 'operated') {
      for (const name of KIND_CHECKS[kind]) {
        if (!proved.has(name)) errors.push(`the ${kind} branch cannot be proved without the ${name} check`);
      }
    }

    for (const finding of findings) {
      if (!inventoried.has(finding.resourceRef)) {
        errors.push(`finding on ${finding.resourceRef} names an uninventoried resource`);
      }
    }
  }

  forEachString(value, (text, at) => {
    if (credentialLeak(text)) errors.push(`${at}: a credential must never be recorded in the receipt`);
  });

  return errors;
});

if (process.argv[1]?.endsWith('validate-output.mjs')) {
  await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
}
