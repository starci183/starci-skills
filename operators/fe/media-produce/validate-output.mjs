import { validatorFor, runValidatorCli } from '../../validation.mjs';
export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const { outcome, result, gaps } = value.output;
  const errors = [];
  if (outcome === 'ready') {
    if (result === null) errors.push('ready media production requires a result');
    else if (result.mode === 'none') {
      if (result.assetRef !== null || result.artifactRefs.length !== 0 || result.provenanceRefs.length !== 0) errors.push('none media mode cannot produce an asset');
    } else {
      if (result.assetRef === null || result.responsiveTreatmentRef === null || result.altIntentRef === null || result.fallbackRef === null) errors.push(`${result.mode} media requires asset, responsive, alt, and fallback bindings`);
      if (result.mode === 'generate' && (result.artifactRefs.length === 0 || result.provenanceRefs.length === 0 || !result.assetRef?.match(/^asset:\/\/sha256-[0-9a-f]{64}\.(png|jpg|jpeg|webp)$/))) errors.push('generated media requires a content-addressed raster and generation provenance');
    }
    if (gaps.length !== 0) errors.push('ready media production cannot retain gaps');
  }
  if (outcome === 'blocked' && (result !== null || gaps.length === 0)) errors.push('blocked media production requires null result and exact gaps');
  return errors;
});
if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
