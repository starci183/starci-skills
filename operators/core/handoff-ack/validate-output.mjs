import { validatorFor, runValidatorCli } from '../../validation.mjs';

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const output = value.output;
  const issues = [];
  if (output.outcome === 'accepted') {
    if (!output.ackRef || output.purgeRefs.length === 0) issues.push('accepted requires acknowledgement and purge refs');
    if (output.evidenceRefs.length === 0) issues.push('accepted requires comparison evidence');
    if (output.reason !== null) issues.push('accepted reason must be null');
  }
  if (output.outcome !== 'accepted') {
    if (output.ackRef !== null || output.purgeRefs.length) issues.push('non-accepted output cannot authorize purge');
    if (!output.reason) issues.push('rejected or blocked requires a reason');
  }
  return issues;
});

if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
