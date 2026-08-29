import { validatorFor, runValidatorCli } from '../../validation.mjs';

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const output = value.output;
  const issues = [];
  if (output.outcome === 'ready') {
    if (!output.stackModelRef || !output.stackModelSha256) issues.push('ready requires the model reference and hash');
    if (output.evidenceRefs.length === 0) issues.push('ready requires exact evidence');
    if (output.contradictions.some((item) => item.severity === 'critical')) issues.push('ready cannot retain a critical contradiction');
    if (output.reason !== null) issues.push('ready reason must be null');
  }
  if (output.outcome === 'revise') {
    if (output.contradictions.length === 0 || !output.reason) issues.push('revise requires contradictions and a bounded reason');
  }
  if (output.outcome === 'blocked') {
    if (output.stackModelRef !== null || output.stackModelSha256 !== null) issues.push('blocked cannot claim a model');
    if (!output.reason) issues.push('blocked requires a reason');
  }
  return issues;
});

if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
