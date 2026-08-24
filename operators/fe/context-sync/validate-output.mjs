import { validatorFor, runValidatorCli } from '../../validation.mjs';

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const produced = value?.payload?.produced;
  if (value?.payload?.decision === 'reused' && produced?.durableWrites?.length) return ['$.payload.produced.durableWrites: reused must not write'];
  if (value?.payload?.decision !== 'blocked' && (!produced?.codingContextGenerationRef || !produced?.snapshotSha256 || !produced?.indexGenerationRef)) return ['$.payload.produced: ready requires canonical and index generation identities'];
  return [];
});

if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
