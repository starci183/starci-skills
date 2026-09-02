import { validatorFor, runValidatorCli } from './validation.mjs';

const CANONICAL_ACCOUNT_FRAGMENT = /^\.worktrees\/uat\/([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9-]*)\/snapshot\.json#account$/;

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { context, input } = value;
  const { backendSource, admission, runtime } = context;
  const { project, feature, flow, sourceHead, identity, lease, fixture, cases, resume } = input;

  // The canonical pair lives under the routed backend Source. A snapshot frozen against a head the
  // Source no longer carries would freeze intent about code nobody is running.
  if (backendSource.sourceHead !== sourceHead) {
    errors.push('context.backendSource.sourceHead must equal input.sourceHead');
  }

  // Authentication is auto-provisioned by the control plane. An authenticated identity with no lease
  // is exactly the shape that would otherwise be repaired by asking the user to sign in.
  if (identity.identityKind === 'account') {
    if (lease === null) {
      errors.push('an authenticated identity requires a Control-Panel Browser lease; provisioning unavailability is BLOCKED, never a sign-in request');
    } else {
      if (lease.accountRef !== identity.accountRef) errors.push('lease.accountRef must equal the frozen account record');
      if (lease.principalFingerprint !== identity.principalFingerprint) {
        errors.push('lease.principalFingerprint must equal the account principal; a foreign principal is not this run');
      }
      if (lease.fixtureNamespace !== identity.fixtureNamespace) {
        errors.push('lease.fixtureNamespace must equal the account fixture namespace');
      }
      if (lease.missionRef !== input.missionId) errors.push('lease.missionRef must equal input.missionId');
      if (lease.runtimeGeneration !== runtime.generation) {
        errors.push('lease.runtimeGeneration must equal the ready runtime owner generation');
      }
      if (lease.origin !== runtime.frontendOrigin) {
        errors.push('lease.origin must equal the ready runtime owner frontend origin');
      }

      const fragment = CANONICAL_ACCOUNT_FRAGMENT.exec(lease.accountRecordRef);
      if (!fragment) errors.push('lease.accountRecordRef must address the canonical snapshot account fragment');
      else if (fragment[1] !== feature || fragment[2] !== flow) {
        errors.push('lease.accountRecordRef names a different feature/flow than this invocation');
      }

      const kinds = new Set(lease.provisioningEvidenceRefs.map((ref) => ref.slice(0, ref.indexOf('://'))));
      if (!kinds.has('keycloak-user')) errors.push('lease provisioning evidence must include the Keycloak record');
      if (!kinds.has('database-user')) errors.push('lease provisioning evidence must include the application-database record');

      if (lease.executionMode === 'consumer-materialized') {
        if (lease.materializationStatus !== 'materialized' || lease.consumerTabRef === null) {
          errors.push('a consumer-materialized lease requires a discovered tab proven in this pass');
        }
        if (lease.evidenceBrokerRef !== null) errors.push('a consumer-materialized lease cannot also name a broker');
      } else {
        if (lease.materializationStatus === 'materialized') {
          errors.push('a broker-executed lease cannot claim consumer materialization');
        }
        if (lease.consumerTabRef !== null) errors.push('a broker-executed lease cannot name a consumer tab');
        if (lease.evidenceBrokerRef === null) errors.push('a broker-executed lease must name its evidence broker');
      }

      const admitted = Math.max(Date.parse(admission.blindVisualPassedAt), Date.parse(admission.qualityPassedAt));
      if (Date.parse(lease.expiresAt) <= admitted) {
        errors.push('the lease expires before the admitted blind visual and quality PASS, so it cannot carry this run');
      }
    }
  } else if (lease !== null) {
    errors.push('an anonymous flow records no account and therefore holds no authenticated lease');
  }

  if (identity.fixtureNamespace !== fixture.namespace) {
    errors.push('input.fixture.namespace must equal the identity fixture namespace');
  }
  if (fixture.cleanupSelector.namespace !== fixture.namespace) {
    errors.push('the cleanup selector must name the exact run fixture namespace');
  }

  const ids = cases.map((item) => item.caseId);
  if (new Set(ids).size !== ids.length) errors.push('input.cases repeats a case identifier');

  // Sequential execution is declared before any product action, so the frozen order is a complete
  // 1..n sequence rather than a set of hints.
  const orders = cases.map((item) => item.order).sort((left, right) => left - right);
  orders.forEach((order, index) => {
    if (order !== index + 1) errors.push('input.cases must declare a contiguous execution order starting at 1');
  });

  for (const item of cases) {
    if (item.actorKind === 'authenticated' && identity.identityKind !== 'account') {
      errors.push(`case ${item.caseId} needs an authenticated actor but the run identity is anonymous`);
    }
    if (item.actorKind === 'anonymous' && identity.identityKind !== 'anonymous') {
      errors.push(`case ${item.caseId} declares anonymous entry but the run freezes an account identity`);
    }
  }

  if (resume !== null && resume.addedContextRefs.length === 0) {
    errors.push('resume must add at least one admission, lease, evidence, or case reference');
  }

  if (/(^|[\\/])\.\.([\\/]|$)/.test(project.artifactRootRef)) {
    errors.push('artifactRootRef cannot contain path traversal');
  }

  return errors;
});

if (process.argv[1]?.endsWith('validate-input.mjs')) {
  await runValidatorCli(validateInput, 'node validate-input.mjs <input.json>');
}
