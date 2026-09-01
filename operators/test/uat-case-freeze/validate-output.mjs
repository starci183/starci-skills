import { validatorFor,runValidatorCli } from '../../validation.mjs';
export const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(value)=>{
  const {outcome,result,gaps,evidenceRefs}=value.output;
  const errors=[];
  if(outcome==='frozen'){
    if(!result||result.artifactRefs.length===0) errors.push('frozen UAT cases require a concrete nonempty artifact result');
    if(evidenceRefs.length===0) errors.push('frozen UAT cases require nonempty evidence');
    if(gaps.length!==0) errors.push('frozen UAT cases cannot retain gaps');
  }else{
    if(result!==null) errors.push('blocked UAT cases cannot publish a success result');
    if(gaps.length===0) errors.push('blocked UAT cases require exact gaps');
  }
  return errors;
});if(process.argv[1]?.endsWith('validate-output.mjs'))await runValidatorCli(validateOutput,'node validate-output.mjs <output.json>');
