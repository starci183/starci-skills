import { validatorFor, runValidatorCli } from '../../validation.mjs';
export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { outcome, result, gaps } = value.output;
  if (outcome === 'recovered' && (result === null || gaps.length)) errors.push('recovered session requires an authenticated lease and no gaps');
  if (outcome === 'blocked' && (result !== null || gaps.length === 0)) errors.push('blocked session recovery requires null result and exact gaps');
  if (result?.executionMode === 'consumer-materialized' && (result.materializationStatus !== 'materialized' || !result.consumerTabRef || result.evidenceBrokerRef !== null)) errors.push('consumer-materialized recovery requires a discovered consumer tab and no broker ref');
  if (result?.executionMode === 'broker-executed' && (!['failed', 'not-applicable'].includes(result.materializationStatus) || result.consumerTabRef !== null || !result.evidenceBrokerRef)) errors.push('broker-executed recovery requires a broker ref and no claimed consumer tab');
  return errors;
});
if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
