import { validatorFor, runValidatorCli } from '../../operators/validation.mjs';

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const issues = [];
  if (value.result !== value.finalState || value.finalState !== value.state.terminalState) issues.push('terminal result mismatch');
  if (value.result === 'complete' && value.state.status !== 'completed') issues.push('complete result requires completed status');
  if (value.result === 'complete' && (value.artifactRefs.length === 0 || value.evidenceRefs.length === 0)) issues.push('complete result requires artifacts and evidence');
  if (value.result === 'blocked' && value.state.status !== 'blocked') issues.push('blocked result requires blocked status');
  return issues;
});
if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
