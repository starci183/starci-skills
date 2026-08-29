import { validatorFor, runValidatorCli } from '../../validation.mjs';

const exactSet = (left, right) => JSON.stringify([...new Set(left)].sort()) === JSON.stringify([...new Set(right)].sort());
const duplicateKeys = (items) => items.length !== new Set(items.map(({ projectKey }) => projectKey)).size;

const semantic = (value) => {
  const errors = [];
  const { authority, observedState } = value.context;
  const desired = value.input.desiredState;
  if (authority.planSha256 !== desired.planSha256) errors.push('/input/desiredState/planSha256: must equal approved plan hash');
  if (!exactSet(authority.allowedEffects, desired.effects)) errors.push('/context/authority/allowedEffects: must equal desired effect classes');
  if (duplicateKeys(desired.projects)) errors.push('/input/desiredState/projects: projectKey must be unique');
  if (duplicateKeys(observedState.projects)) errors.push('/context/observedState/projects: projectKey must be unique');
  const desiredKeys = new Set(desired.projects.map(({ projectKey }) => projectKey));
  for (const project of observedState.projects) if (!desiredKeys.has(project.projectKey)) errors.push(`/context/observedState/projects: undeclared project ${project.projectKey}`);
  return errors;
};

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), semantic);
if (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <input.json>');
