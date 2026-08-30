import { validatorFor, runValidatorCli } from '../../validation.mjs';
import { layoutCompilationSemantic } from '../strict-ui-validation.mjs';
export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), layoutCompilationSemantic);
if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
