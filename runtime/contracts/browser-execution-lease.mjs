import { validatorFor } from '../../operators/validation.mjs';
import { LEGACY_ACADEMY_ENDPOINTS } from './endpoint-authority.mjs';
import { createRuntimeOwnerValidator } from './runtime-owner.mjs';

export function browserExecutionLeaseBindingErrors(lease, {
  runtimeOwner = null,
  sourceRoot,
  expectedMissionRef = null,
  expectedAccountRef = null,
  now = () => Date.now(),
} = {}) {
  const errors = [];
  if (Object.hasOwn(lease, 'expiresAt')) {
    const validDateTime = typeof lease.expiresAt === 'string'
      && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(lease.expiresAt)
      && !Number.isNaN(Date.parse(lease.expiresAt));
    if (!validDateTime) errors.push('$.expiresAt: must be a valid RFC 3339 date-time');
    else {
      const currentInstant = typeof now === 'function' ? now() : now;
      if (!Number.isFinite(currentInstant)) errors.push('$.expiresAt: validator clock must be a finite epoch instant');
      else if (Date.parse(lease.expiresAt) <= currentInstant) errors.push('$.expiresAt: authenticated lease is expired');
    }
  }
  if (expectedMissionRef !== null && lease.missionRef !== expectedMissionRef) errors.push('$.missionRef: differs from the trusted UAT mission');
  if (expectedAccountRef !== null && lease.accountRef !== expectedAccountRef) errors.push('$.accountRef: differs from the frozen UAT account');
  if (!runtimeOwner) {
    if (lease.runtimeBinding) errors.push('$.runtimeBinding: canonical runtime owner is required for a project-bound lease');
    if (lease.origin !== LEGACY_ACADEMY_ENDPOINTS.frontend) errors.push('$.origin: an ownerless legacy lease may use only the StarCi Academy frontend');
    return errors;
  }

  const ownerValidation = createRuntimeOwnerValidator({ sourceRoot })(runtimeOwner);
  if (!ownerValidation.valid) return ownerValidation.errors.map((error) => `$.runtimeOwner: ${error}`);
  if (runtimeOwner.status !== 'ready') errors.push('$.runtimeOwner.status: authenticated Browser work requires a ready runtime owner');
  if (lease.runtimeGeneration !== runtimeOwner.generation) errors.push('$.runtimeGeneration: differs from the canonical runtime owner generation');
  if (lease.origin !== runtimeOwner.endpoints.frontend) errors.push('$.origin: differs from the canonical runtime owner frontend');

  const boundToNonLegacyFrontend = runtimeOwner.endpoints.frontend !== LEGACY_ACADEMY_ENDPOINTS.frontend;
  if (boundToNonLegacyFrontend && !lease.runtimeBinding) errors.push('$.runtimeBinding: required for a non-default project runtime');
  if (lease.runtimeBinding) {
    if (!runtimeOwner.endpointBinding) {
      errors.push('$.runtimeBinding: cannot bind to a legacy owner without endpoint authority');
    } else {
      if (lease.runtimeBinding.project !== runtimeOwner.endpointBinding.project) errors.push('$.runtimeBinding.project: differs from the canonical runtime owner project');
      if (lease.runtimeBinding.application !== runtimeOwner.endpointBinding.application) errors.push('$.runtimeBinding.application: differs from the canonical runtime owner application');
      if (lease.runtimeBinding.ownerThreadId !== runtimeOwner.ownerThreadId) errors.push('$.runtimeBinding.ownerThreadId: differs from the canonical runtime owner');
      if (lease.runtimeBinding.endpointAuthorityFingerprint !== runtimeOwner.endpointBinding.authorityFingerprint) errors.push('$.runtimeBinding.endpointAuthorityFingerprint: differs from the canonical runtime owner endpoint authority');
    }
  }
  return errors;
}

export function createBrowserExecutionLeaseValidator({ runtimeOwner = null, sourceRoot, now } = {}) {
  return validatorFor(new URL('./browser-execution-lease.schema.json', import.meta.url), (lease) => browserExecutionLeaseBindingErrors(lease, { runtimeOwner, sourceRoot, now }));
}

export const validateBrowserExecutionLease = createBrowserExecutionLeaseValidator();
