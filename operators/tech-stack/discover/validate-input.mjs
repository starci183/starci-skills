import { validatorFor, runValidatorCli } from '../../validation.mjs';

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), (value) => {
  const refs = [...value.context.manifestRefs, ...value.context.configurationRefs, ...value.context.deploymentRefs];
  return refs.length === 0 ? ['at least one exact source-evidence reference is required'] : [];
});

if (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <artifact.json>');
