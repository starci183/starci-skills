import { validatorFor, runValidatorCli } from '../../validation.mjs';
const directionSemantic=(input)=>{
  const errors=[];
  const validClassifications={none:['not-applicable'],dominant:['dominant'],alternatives:['ambiguous','comparison-requested']}[input.directionMode];
  if(!validClassifications.includes(input.directionEvidence.classification)) errors.push('directionEvidence.classification must justify directionMode');
  if(input.uxUiChangeLevel==='refine'&&input.directionMode!=='none') errors.push('refine requires directionMode none');
  if(input.uxUiChangeLevel!=='refine'&&input.directionMode==='none') errors.push('reconstruct/new requires dominant or alternatives directionMode');
  return errors;
};
export const validateInput=validatorFor(new URL('./input.schema.json',import.meta.url),(value)=>directionSemantic(value.input));
if(process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput,'node validate-input.mjs <input.json>');
