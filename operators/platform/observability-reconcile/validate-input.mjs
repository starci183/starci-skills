import { validatorFor, runValidatorCli } from '../../validation.mjs';

const exactSet = (left, right) => JSON.stringify([...new Set(left)].sort()) === JSON.stringify([...new Set(right)].sort());

const semantic = (value) => {
  const errors = [];
  const { authority, credentialCapability, observedState } = value.context;
  const desired = value.input.desiredState;
  if (authority.planSha256 !== desired.planSha256) errors.push('/input/desiredState/planSha256: must equal approved plan hash');
  if (!exactSet(authority.allowedEffects, desired.effects)) errors.push('/context/authority/allowedEffects: must equal desired effect classes');
  if (credentialCapability.destinationRef !== desired.remoteWriteDestinationRef) errors.push('/context/credentialCapability/destinationRef: must equal desired remote-write destination');
  const desiredResources = new Set([...desired.scrapeTargets, ...desired.dashboardRefs, desired.remoteWriteDestinationRef]);
  for (const ref of observedState.resourceRefs) if (!desiredResources.has(ref)) errors.push(`/context/observedState/resourceRefs: undeclared resource ${ref}`);
  for (const ref of authority.writableResourceRefs) if (!desiredResources.has(ref)) errors.push(`/context/authority/writableResourceRefs: undeclared resource ${ref}`);
  return errors;
};

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), semantic);
if (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <input.json>');
