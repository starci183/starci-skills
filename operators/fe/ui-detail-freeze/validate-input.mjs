import { validatorFor, runValidatorCli } from '../../validation.mjs';
export const validateInput=validatorFor(new URL('./input.schema.json',import.meta.url),(v)=>['ui-direction-approved','ux-flow-approved'].filter((f)=>!v.facts.includes(f)).map((f)=>`$.facts: ${f} is required`));
if(process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput,'node validate-input.mjs <artifact.json>');
