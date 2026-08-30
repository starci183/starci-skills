import { validatorFor, runValidatorCli } from '../../validation.mjs';
export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), (value) => {
  const roles = value.input.semanticRoles.map((item) => item.roleRef);
  return new Set(roles).size === roles.length ? [] : ['semantic icon roleRefs must be unique'];
});
if (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <input.json>');
