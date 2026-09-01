import { validatorFor, runValidatorCli } from '../../validation.mjs';
import { directionAuthorityContextErrors, directionContractErrors } from '../direction-authority.mjs';
const directionSemantic=({context,input})=>{
  const errors=[];
  for(const ref of input.directionEvidence.evidenceRefs) if(!context.evidenceRefs.includes(ref)) errors.push(`direction evidence ${ref} must be present in context.evidenceRefs`);
  errors.push(...directionContractErrors(input));
  errors.push(...directionAuthorityContextErrors(input.directionEvidence,{authorityRefs:context.authorityRefs,evidenceRefs:context.evidenceRefs}));
  return errors;
};
export const validateInput=validatorFor(new URL('./input.schema.json',import.meta.url),(value)=>directionSemantic(value));
if(process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput,'node validate-input.mjs <input.json>');
