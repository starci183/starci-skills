import { validatorFor, runValidatorCli } from '../../validation.mjs';
export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { outcome, result, gaps } = value.output;
  if (outcome === 'directions-ready') {
    if (result === null) errors.push('directions-ready requires a rendered result');
    else {
      if (!result.artifactRefs.includes(result.comparisonArtifactRef)) errors.push('comparisonArtifactRef must be registered in artifactRefs');
      if (new Set(result.directions.map((item) => item.id)).size !== result.directions.length) errors.push('direction ids must be unique');
      if (new Set(result.directions.map((item) => item.visualPanelRef)).size !== result.directions.length) errors.push('visual panel refs must be unique');
    }
    if (gaps.length !== 0) errors.push('directions-ready cannot retain gaps');
  }
  if (outcome === 'blocked' && (result !== null || gaps.length === 0)) errors.push('blocked UI direction requires null result and exact gaps');
  return errors;
});
if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
