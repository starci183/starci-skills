import { validatorFor, runValidatorCli } from '../../validation.mjs';
export const validateInput=validatorFor(new URL('./input.schema.json',import.meta.url),(v)=>v.facts.includes('candidate-frozen')?[]:['$.facts: candidate-frozen is required']);
if(process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput,'node validate-input.mjs <artifact.json>');
