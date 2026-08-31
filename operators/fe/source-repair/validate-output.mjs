import { validatorFor, runValidatorCli } from '../../validation.mjs';
const semantic=(value)=>{
  const errors=[];
  const {outcome,result,gaps,handoff}=value.output;
  if(outcome==='authorization-required'){
    if(result!==null) errors.push('$.output.result: authorization-required must not claim a completed repair');
    if(gaps.length===0) errors.push('$.output.gaps: authorization-required needs the exact owner and file boundary gap');
    if(handoff!==null) errors.push('$.output.handoff: authorization is routed by the parent mutation choice, not a cross-domain handoff');
  }
  return errors;
};
export const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),semantic);
if(process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput,'node validate-output.mjs <output.json>');
