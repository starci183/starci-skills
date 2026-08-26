import { validatorFor, runValidatorCli } from '../../validation.mjs';

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), (value) =>
  ['ux-flow-modeled', 'business-authority-fresh']
    .filter((fact) => !value.facts.includes(fact))
    .map((fact) => `$.facts: ${fact} is required`)
);

if (process.argv[1]?.endsWith('validate-input.mjs')) {
  await runValidatorCli(validateInput, 'node validate-input.mjs <artifact.json>');
}
