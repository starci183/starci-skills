import { validatorFor, runValidatorCli } from '../../validation.mjs';

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), (value) => {
  const expected = value.context.stackModelSha256;
  return value.context.compatibility.modelSha256 === expected && value.context.approval.modelSha256 === expected
    ? []
    : ['model, compatibility, and approval hashes must be identical'];
});

if (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <artifact.json>');
