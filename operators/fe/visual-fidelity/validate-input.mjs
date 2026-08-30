import { validatorFor, runValidatorCli } from '../../validation.mjs';
import { visualFidelityInputSemantic } from '../strict-ui-validation.mjs';
export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), visualFidelityInputSemantic);
if (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <input.json>');
