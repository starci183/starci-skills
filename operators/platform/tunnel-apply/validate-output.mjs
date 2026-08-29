import { validatorFor, runValidatorCli } from '../../validation.mjs';

const requiredChecks = ['dns-target', 'public-https', 'tls', 'tunnel-route'];
const semantic = (value) => {
  const { outcome, receiptRef, checks, reason } = value.output;
  const names = checks.map(({ name }) => name).sort();
  const complete = JSON.stringify(names) === JSON.stringify(requiredChecks);
  const passed = checks.every(({ status }) => status === 'passed');
  return [
    ...(!complete ? ['/output/checks: exact four postcondition checks are required'] : []),
    ...(outcome === 'proved' && receiptRef === null ? ['/output/receiptRef: proved requires a fresh receipt'] : []),
    ...(outcome === 'proved' && !passed ? ['/output/checks: proved requires every postcondition to pass'] : []),
    ...(outcome === 'proved' && reason !== null ? ['/output/reason: proved cannot carry a failure reason'] : []),
    ...(outcome === 'blocked' && receiptRef !== null ? ['/output/receiptRef: blocked cannot claim convergence proof'] : []),
    ...(outcome === 'blocked' && reason === null ? ['/output/reason: blocked requires one bounded reason'] : [])
  ];
};

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), semantic);
if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
