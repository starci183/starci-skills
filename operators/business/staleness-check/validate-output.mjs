import { validatorFor, runValidatorCli } from '../../validation.mjs';

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { decision, state, produced } = value.payload;
  const expected = {
    fresh: ['completed', 'business-staleness-fresh', 'business.freshness', 'ready'],
    'initialize-required': ['replan', 'business-staleness-initialize-required', 'business.evidence', 'ready'],
    blocked: ['blocked', 'business-staleness-blocked', 'business.freshness', 'blocked']
  }[decision];
  if (!expected || state.status !== expected[0] || state.code !== expected[1] || state.emits.stage !== expected[2] || state.emits.status !== expected[3] || value.stage !== expected[2] || value.status !== expected[3]) errors.push('$.payload.state: decision, state and route must match');
  if (decision === 'fresh' && (!produced.freshnessReceiptRef || produced.reason !== 'current' || produced.businessRevision === null)) errors.push('$.payload.produced: fresh requires current reason, business revision and receipt');
  if (decision !== 'fresh' && produced.freshnessReceiptRef !== null) errors.push('$.payload.produced.freshnessReceiptRef: non-fresh must be null');
  if (decision === 'initialize-required' && !['missing', 'unapproved', 'invalid', 'source-advanced', 'route-drift'].includes(produced.reason)) errors.push('$.payload.produced.reason: initialize-required needs a refresh reason');
  if (decision === 'blocked' && produced.reason !== 'refresh-limit') errors.push('$.payload.produced.reason: blocked means refresh limit reached');
  return errors;
});

if (process.argv[1]?.endsWith('validate-output.mjs')) {
  await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
}
