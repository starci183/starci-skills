import { validatorFor, runValidatorCli } from '../../validation.mjs';

const sameIdentity = (left, right) => ['provider', 'conversationId', 'project', 'role']
  .every((key) => left[key] === right[key]);

const semantic = (value) => {
  const errors = [];
  const { identity, authorizedScope } = value.input;
  if (identity.project !== authorizedScope.project || identity.role !== authorizedScope.role) {
    errors.push('/input/authorizedScope: must bind the requested project and role exactly');
  }
  value.context.candidateHeads.forEach((head, index) => {
    if (!sameIdentity(head.identity, identity)) errors.push(`/context/candidateHeads/${index}/identity: candidate exceeds the requested identity`);
  });
  return errors;
};

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), semantic);

if (process.argv[1]?.endsWith('validate-input.mjs')) {
  await runValidatorCli(validateInput, 'node validate-input.mjs <input.json>');
}
