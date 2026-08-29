import { validatorFor, runValidatorCli } from '../../validation.mjs';

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const output = value.output;
  const issues = [];
  if (output.outcome === 'emitted') {
    if (!output.handoffRef || !output.handoffSha256) issues.push('emitted requires handoff reference and hash');
    if (output.retainedArtifactRefs.length === 0) issues.push('emitted requires retained artifacts');
    if (output.evidenceRefs.length === 0) issues.push('emitted requires evidence');
    if (output.reason !== null) issues.push('emitted reason must be null');
  }
  if (output.outcome === 'blocked') {
    if (output.handoffRef !== null || output.handoffSha256 !== null || output.retainedArtifactRefs.length) issues.push('blocked cannot claim a handoff or retention set');
    if (!output.reason) issues.push('blocked requires a reason');
  }
  return issues;
});

if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
