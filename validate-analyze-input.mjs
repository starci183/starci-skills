import { validatorFor, runValidatorCli } from './operators/validation.mjs';

export const validateAnalyzeInput = validatorFor(new URL('./analyze-input.schema.json', import.meta.url));

if (process.argv[1]?.endsWith('validate-analyze-input.mjs')) {
  await runValidatorCli(validateAnalyzeInput, 'node validate-analyze-input.mjs <selection.json>');
}
