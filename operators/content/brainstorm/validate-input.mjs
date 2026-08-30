import { validatorFor, runValidatorCli } from '../../validation.mjs';
export const validateInput=validatorFor(new URL('./input.schema.json',import.meta.url),(v)=>[...v.context.contextRefs,...v.context.sourceRefs].length?[]:['teacher brainstorm requires exact context or source evidence']);
if(process.argv[1]?.endsWith('validate-input.mjs'))await runValidatorCli(validateInput,'node validate-input.mjs <artifact.json>');
