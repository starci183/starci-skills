import { validatorFor, runValidatorCli } from '../../validation.mjs';
export const validateInput=validatorFor(new URL('./input.schema.json',import.meta.url),(v)=>v.facts.includes('frontend-fidelity-passed')?[]:['$.facts: frontend-fidelity-passed is required']);
if(process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput,'node validate-input.mjs <artifact.json>');
