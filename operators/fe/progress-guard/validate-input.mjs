import { validatorFor,runValidatorCli } from '../../validation.mjs';
const semantic=(value)=>value.context.history.includes(value.input.candidateFingerprint)?['/input/candidateFingerprint: repeated progress fingerprint']:[];
export const validateInput=validatorFor(new URL('./input.schema.json',import.meta.url),semantic);if(process.argv[1]?.endsWith('validate-input.mjs'))await runValidatorCli(validateInput,'node validate-input.mjs <input.json>');
