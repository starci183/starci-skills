import { validatorFor, runValidatorCli } from '../../validation.mjs';
export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { outcome, result, gaps } = value.output;
  if (outcome === 'recovered' && (result === null || gaps.length)) errors.push('recovered session requires an authenticated lease and no gaps');
  if (outcome === 'blocked' && (result !== null || gaps.length === 0)) errors.push('blocked session recovery requires null result and exact gaps');
  return errors;
});
if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
