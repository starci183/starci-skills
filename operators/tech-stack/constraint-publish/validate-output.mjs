import { validatorFor, runValidatorCli } from '../../validation.mjs';

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const output = value.output;
  const issues = [];
  if (output.outcome === 'published') {
    if (!output.techStackHeadRef || !output.techStackHeadSha256) issues.push('published requires the immutable head reference and hash');
    if (output.evidenceRefs.length === 0) issues.push('published requires write and verification evidence');
    if (output.reason !== null) issues.push('published reason must be null');
  }
  if (output.outcome === 'blocked') {
    if (output.techStackHeadRef !== null || output.techStackHeadSha256 !== null) issues.push('blocked cannot claim a published head');
    if (!output.reason) issues.push('blocked requires a reason');
  }
  return issues;
});

if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
