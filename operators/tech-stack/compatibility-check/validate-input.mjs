import { validatorFor, runValidatorCli } from '../../validation.mjs';

const semantic = (value) => value.context.stackModel.contentSha256 === value.input.expectedModelSha256
  ? []
  : ['/input/expectedModelSha256: authorized hash differs from context.stackModel.contentSha256'];

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), semantic);

if (process.argv[1]?.endsWith('validate-input.mjs')) {
  await runValidatorCli(validateInput, 'node validate-input.mjs <input.json>');
}
