import { validatorFor, runValidatorCli } from '../../validation.mjs';

const semantic = (value) => {
  const { outcome, receiptRef, checks, reason } = value.output;
  const passed = checks.every(({ status }) => status === 'passed');
  const requiredKinds = ['enforcement-active', 'gate-assigned', 'profile-assigned', 'project-exists', 'service-available', 'source-revision'];
  const actualKinds = new Set(checks.map(({ kind }) => kind));
  const completeKinds = requiredKinds.every((kind) => actualKinds.has(kind));
  return [
    ...(!completeKinds ? ['/output/checks: every required Sonar postcondition kind must be proved'] : []),
    ...(outcome === 'proved' && receiptRef === null ? ['/output/receiptRef: proved requires a fresh receipt'] : []),
    ...(outcome === 'proved' && !passed ? ['/output/checks: proved cannot contain failed checks'] : []),
    ...(outcome === 'proved' && reason !== null ? ['/output/reason: proved cannot carry a failure reason'] : []),
    ...(outcome === 'blocked' && receiptRef !== null ? ['/output/receiptRef: blocked cannot claim convergence proof'] : []),
    ...(outcome === 'blocked' && reason === null ? ['/output/reason: blocked requires one bounded reason'] : [])
  ];
};

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), semantic);
if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
