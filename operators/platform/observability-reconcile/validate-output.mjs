import { validatorFor, runValidatorCli } from '../../validation.mjs';

const requiredChecks = ['label-boundary', 'remote-write-delivery', 'retry-backoff', 'sample-ordering', 'sensitive-data-filter', 'service-health', 'target-boundary'];
const semantic = (value) => {
  const { outcome, receiptRef, checks, reason } = value.output;
  const names = checks.map(({ name }) => name).sort();
  const complete = JSON.stringify(names) === JSON.stringify(requiredChecks);
  const passed = checks.every(({ status }) => status === 'passed');
  return [
    ...(!complete ? ['/output/checks: exact seven observability postconditions are required'] : []),
    ...(outcome === 'proved' && receiptRef === null ? ['/output/receiptRef: proved requires a fresh receipt'] : []),
    ...(outcome === 'proved' && !passed ? ['/output/checks: proved cannot contain failed checks'] : []),
    ...(outcome === 'proved' && reason !== null ? ['/output/reason: proved cannot carry a failure reason'] : []),
    ...(outcome === 'blocked' && receiptRef !== null ? ['/output/receiptRef: blocked cannot claim convergence proof'] : []),
    ...(outcome === 'blocked' && reason === null ? ['/output/reason: blocked requires one bounded reason'] : [])
  ];
};

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), semantic);
if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
