import { validatorFor, runValidatorCli } from '../../validation.mjs';

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const issues = [];
  const { output } = value;
  const expected = { published: 'published-checkpoint', resumed: 'resumed-checkpoint', blocked: 'none' }[output.outcome];
  if (output.resultKind !== expected) issues.push('outcome and resultKind must agree');
  if (output.outcome === 'blocked') {
    if (output.checkpointTag !== null || output.sourcePushRefs.length || output.resumeCapability !== null || output.resumePoint !== null || output.receiptRef !== null) issues.push('blocked cannot claim a checkpoint result');
    if (output.reason === null) issues.push('blocked requires a reason');
  } else {
    if (output.checkpointTag === null || output.resumeCapability === null || output.resumePoint === null || output.receiptRef === null) issues.push('successful handoff requires complete checkpoint identity and receipt');
    if (output.reason !== null) issues.push('successful handoff cannot include a blocker reason');
  }
  return issues;
});

if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
