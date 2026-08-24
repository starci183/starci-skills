import { validatorFor, runValidatorCli } from '../../validation.mjs';

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const errors = [];
  const ref = value?.payload?.produced?.freshnessReceiptRef;
  if (value?.payload?.decision === 'fresh' && !ref) errors.push('$.payload.produced.freshnessReceiptRef: fresh requires a receipt');
  if (value?.payload?.decision !== 'fresh' && ref !== null) errors.push('$.payload.produced.freshnessReceiptRef: non-fresh must be null');
  return errors;
});

if (process.argv[1]?.endsWith('validate-output.mjs')) {
  await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
}
