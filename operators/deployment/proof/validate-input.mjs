import { validatorFor, runValidatorCli } from '../../validation.mjs';

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), (value) => {
  const refs = [...value.context.contextRefs, ...value.context.sourceRefs];
  return refs.length === 0 ? ['at least one exact context or source reference is required'] : [];
});

if (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <artifact.json>');
