import { validatorFor, runValidatorCli } from '../../validation.mjs';
export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { outcome, result, gaps } = value.output;
  if (outcome === 'generated') {
    if (result === null) errors.push('generated dominant direction requires a result');
    else if (!result.artifactRefs.includes(result.visualizeArtifactRef)) errors.push('visualizeArtifactRef must be registered in artifactRefs');
    if (gaps.length) errors.push('generated dominant direction cannot retain gaps');
  }
  if (outcome === 'blocked' && (result !== null || gaps.length === 0)) errors.push('blocked dominant direction requires null result and exact gaps');
  return errors;
});
if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
