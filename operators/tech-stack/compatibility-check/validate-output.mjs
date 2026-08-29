import { validatorFor, runValidatorCli } from '../../validation.mjs';

const semantic = (value) => {
  const { outcome, receiptRef, checks, contradictions } = value.output;
  const incomplete = checks.some((check) => check.status !== 'passed');
  const critical = contradictions.some((item) => item.severity === 'critical');
  const completed = receiptRef !== null;
  const valid = {
    compatible: completed && !incomplete && !critical,
    revise: completed && (incomplete || contradictions.length > 0),
    blocked: !completed
  }[outcome];
  return valid ? [] : [`/output: fields do not prove ${outcome}`];
};

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), semantic);

if (process.argv[1]?.endsWith('validate-output.mjs')) {
  await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
}
