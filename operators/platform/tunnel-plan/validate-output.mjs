import { validatorFor, runValidatorCli } from '../../validation.mjs';

const semantic = (value) => {
  const { outcome, planRef, planSha256, effects, conflicts } = value.output;
  const hasPlan = planRef !== null && planSha256 !== null;
  return [
    ...(outcome === 'ready' && !hasPlan ? ['/output: ready requires an exact plan reference and hash'] : []),
    ...(outcome === 'ready' && conflicts.length ? ['/output/conflicts: ready cannot hide conflicts'] : []),
    ...(outcome === 'blocked' && (planRef !== null || planSha256 !== null) ? ['/output: blocked cannot expose an applicable plan'] : []),
    ...(outcome === 'blocked' && effects.length ? ['/output/effects: blocked cannot authorize effects'] : []),
    ...(outcome === 'blocked' && conflicts.length === 0 ? ['/output/conflicts: blocked requires evidence-backed conflict detail'] : [])
  ];
};

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), semantic);

if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
