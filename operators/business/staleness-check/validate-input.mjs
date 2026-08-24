import { validatorFor, runValidatorCli } from '../../validation.mjs';

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { provided, loads } = value.payload;
  const business = loads.businessMetadata;
  if (provided.refreshAttempt > provided.maxRefreshAttempts) errors.push('$.payload.provided.refreshAttempt: exceeds maxRefreshAttempts');
  if (!business.exists) {
    if (business.status !== 'missing') errors.push('$.payload.loads.businessMetadata.status: nonexistent authority must be missing');
    for (const key of ['headRef', 'revision', 'contentSha256', 'baselineCommit']) if (business[key] !== null) errors.push(`$.payload.loads.businessMetadata.${key}: nonexistent authority must be null`);
  } else {
    if (business.status === 'missing' || business.headRef === null) errors.push('$.payload.loads.businessMetadata: existing authority requires status and headRef');
    if (business.status === 'approved' && ['revision', 'contentSha256', 'baselineCommit'].some((key) => business[key] === null)) errors.push('$.payload.loads.businessMetadata: approved authority requires complete revision metadata');
  }
  return errors;
});

if (process.argv[1]?.endsWith('validate-input.mjs')) {
  await runValidatorCli(validateInput, 'node validate-input.mjs <artifact.json>');
}
