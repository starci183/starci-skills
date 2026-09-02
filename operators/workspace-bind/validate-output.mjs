import { validatorFor, runValidatorCli } from './validation.mjs';

/**
 * A failure belongs to whoever can actually supply the delta. Letting a route or runtime failure
 * be filed against the caller is how a workspace defect gets returned to the wrong owner and comes
 * back unchanged on the next attempt.
 */
const OWNING_DOMAIN = {
  INVALID_INPUT: 'caller',
  NO_PROGRESS: 'caller',
  ROUTE_UNDECLARED: 'workspace',
  ROUTE_UNHYDRATED: 'workspace',
  ROUTE_MISMATCH: 'workspace',
  BRANCH_POLICY_VIOLATION: 'workspace',
  IDENTITY_UNVERIFIED: 'identity',
  CHECKOUT_DIRTY: 'source',
  SOURCE_DRIFT: 'source',
  ENDPOINT_AUTHORITY_STALE: 'runtime',
  RUNTIME_NOT_READY: 'runtime',
};

/** Only an origin-only localhost URL is an endpoint. 127.0.0.1, a host, or a path is not. */
const LOCAL_ORIGIN = /^http:\/\/localhost:([1-9][0-9]{0,4})$/;

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { outcome, receipt, artifactRefs } = value.output;
  const { status, binding, route, findings, failure, resume } = receipt;

  if (outcome !== status) errors.push('output.outcome must equal receipt.status');

  if (outcome === 'bound') {
    if (route === null) errors.push('a bound receipt requires a route');
    if (failure !== null) errors.push('a bound receipt cannot carry a failure');
    if (resume !== null) errors.push('a bound receipt cannot carry a resume');
  } else {
    if (route !== null) errors.push('a blocked receipt cannot carry a route');
    if (failure === null) errors.push('a blocked receipt requires one typed failure');
    else if (failure.retryable && resume === null) errors.push('a retryable failure requires a resume');
    else if (!failure.retryable && resume !== null) errors.push('a non-retryable failure cannot carry a resume');
  }

  if (failure !== null) {
    const expected = OWNING_DOMAIN[failure.code];
    if (expected !== undefined && failure.owningDomain !== expected) {
      errors.push(`${failure.code} is owned by ${expected}, not ${failure.owningDomain}`);
    }
  }

  const findingKeys = new Set();
  for (const finding of findings) {
    const key = `${finding.code}|${finding.subject}`;
    if (findingKeys.has(key)) errors.push(`finding ${finding.code} repeats subject ${finding.subject}`);
    findingKeys.add(key);
    if (route === null && (finding.code === 'ROUTE_HYDRATED_FROM_PORTABLE' || finding.code === 'RUNTIME_CONSUMED_NOT_OWNED')) {
      errors.push(`a blocked receipt cannot record ${finding.code}`);
    }
  }

  if (route !== null) {
    const { checkout, gitPolicy, mutationReadiness, runtime } = route;

    if (checkout.sourceHead !== binding.sourceHead) {
      errors.push('the receipt binding and the routed checkout must name the same source head');
    }
    if (checkout.repositoryKind === 'source' && checkout.directory !== null) {
      errors.push('a source checkout must report a null directory');
    }
    if (checkout.repositoryKind === 'sibling' && checkout.directory === null) {
      errors.push('a sibling checkout must report its relative directory');
    }

    // Mutation is ready only on the declared mutation branch. Reporting readiness anywhere else
    // is how a task branch acquires permission it was never routed.
    if (mutationReadiness === 'ready' && checkout.branch !== gitPolicy.mutationBranch) {
      errors.push(`mutation is ready only on ${gitPolicy.mutationBranch}, not on ${checkout.branch}`);
    }
    if (gitPolicy.worktreeBranches === 'forbidden') {
      if (checkout.branch !== gitPolicy.mutationBranch) {
        errors.push('a forbidden worktree policy cannot bind a route on another branch');
      }
      if (!findingKeys.has(`WORKTREE_BRANCH_FORBIDDEN|${gitPolicy.mutationBranch}`)) {
        errors.push('a forbidden worktree policy must be recorded on the bound route');
      }
    }

    // The portable-to-hydrated resolution is the whole authority of this receipt, so it is stated
    // rather than assumed.
    if (!findingKeys.has(`ROUTE_HYDRATED_FROM_PORTABLE|${binding.hydratedRouteRef}`)) {
      errors.push('a bound route must record the hydrated route it resolved from');
    }

    if (!artifactRefs.includes(route.routeArtifactRef)) {
      errors.push('artifactRefs must register the route receipt artifact');
    }

    if (route.provenanceHeadRef !== null && !findingKeys.has(`PROVENANCE_HEAD_BOUND|${route.provenanceHeadRef}`)) {
      errors.push('a bound provenance head must be recorded');
    }

    if (runtime !== null) {
      // A consumer may run only against a ready owner generation. A port that merely listens,
      // a starting owner, or a degraded one is evidence to report, not a runtime to use.
      if (runtime.status !== 'ready') {
        errors.push(`a route cannot bind a ${runtime.status} runtime owner for consumption`);
      }
      if (!findingKeys.has(`RUNTIME_CONSUMED_NOT_OWNED|${runtime.ownerTaskId}`)) {
        errors.push('a consumed runtime must record that the caller does not own it');
      }
      if (runtime.endpointBinding.project !== binding.projectId) {
        errors.push('the endpoint binding belongs to another project than the bound route');
      }

      const services = Object.values(runtime.endpointBinding.services);
      if (new Set(services).size !== services.length) {
        errors.push('endpoint binding service keys must be distinct');
      }

      const ports = [];
      for (const [role, endpoint] of Object.entries(runtime.endpoints)) {
        const match = LOCAL_ORIGIN.exec(endpoint);
        if (match === null) {
          errors.push(`the ${role} endpoint ${endpoint} is not an origin-only localhost projection`);
          continue;
        }
        const port = Number(match[1]);
        if (port > 65535) errors.push(`the ${role} endpoint port exceeds 65535`);
        ports.push(port);
      }
      if (new Set(ports).size !== ports.length) {
        errors.push('the frontend, api, and identity endpoints must resolve to distinct ports');
      }
    }
  }

  return errors;
});

if (process.argv[1]?.endsWith('validate-output.mjs')) {
  await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
}
