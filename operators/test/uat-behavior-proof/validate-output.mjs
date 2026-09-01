import { validatorFor,runValidatorCli } from '../../validation.mjs';
export const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(value)=>{
  const {outcome,result,gaps,evidenceRefs}=value.output;
  const errors=[];
  if(outcome==='passed'){
    if(!result||result.artifactRefs.length===0) errors.push('passed UAT behavior proof requires a concrete nonempty artifact result');
    if(evidenceRefs.length===0) errors.push('passed UAT behavior proof requires nonempty evidence');
    if(gaps.length!==0) errors.push('passed UAT behavior proof cannot retain gaps');
  }else{
    if(result!==null) errors.push('failed or blocked UAT behavior proof cannot publish a success result');
    if(gaps.length===0) errors.push('failed or blocked UAT behavior proof requires exact gaps');
  }
  return errors;
});if(process.argv[1]?.endsWith('validate-output.mjs'))await runValidatorCli(validateOutput,'node validate-output.mjs <output.json>');
