import { validatorFor, runValidatorCli } from '../../validation.mjs';
export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => value?.payload?.decision === 'frozen' && (!value.payload.produced.codingScopeRef || value.payload.produced.targets.length === 0) ? ['$.payload.produced: frozen requires scope ref and targets'] : []);
if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
