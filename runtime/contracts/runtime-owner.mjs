import { validatorFor } from '../../operators/validation.mjs';
import { LEGACY_ACADEMY_ENDPOINTS, resolveProjectEndpointBinding } from './endpoint-authority.mjs';

const sameEndpoints = (left, right) => ['frontend', 'api', 'identity'].every((key) => left?.[key] === right[key]);
const isDateTime = (value) => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  && !Number.isNaN(Date.parse(value));

export function runtimeOwnerBindingErrors(owner, { sourceRoot } = {}) {
  if (!isDateTime(owner.updatedAt)) return ['$.updatedAt: must be a valid RFC 3339 date-time'];
  if (!owner.endpointBinding) {
    return sameEndpoints(owner.endpoints, LEGACY_ACADEMY_ENDPOINTS)
      ? []
      : ['$.endpoints: an owner without endpointBinding may use only the StarCi Academy defaults'];
  }
  try {
    const projection = resolveProjectEndpointBinding(owner.endpointBinding, { sourceRoot });
    return sameEndpoints(owner.endpoints, projection.endpoints)
      ? []
      : ['$.endpoints: values differ from the bound workspace route/metadata projection'];
  } catch (error) {
    return [`$.endpointBinding: ${error.message}`];
  }
}

export function createRuntimeOwnerValidator({ sourceRoot } = {}) {
  return validatorFor(new URL('../../templates/runtime/owner.schema.json', import.meta.url), (owner) => runtimeOwnerBindingErrors(owner, { sourceRoot }));
}

export const validateRuntimeOwner = createRuntimeOwnerValidator();
