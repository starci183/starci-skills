import { validatorFor,runValidatorCli } from '../../validation.mjs';
export const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(value)=>{
  const errors=[];
  if(value.output.outcome==='progress'){
    if(value.output.result===null) errors.push('$.output.result: progressing receipt requires a concrete result');
    if(value.output.gaps.length!==0) errors.push('$.output.gaps: progressing receipt cannot carry cycle gaps');
  }
  if(value.output.outcome==='cycle'){
    if(value.output.result!==null) errors.push('$.output.result: no-progress cycle cannot produce a result');
    if(value.output.gaps.length===0) errors.push('$.output.gaps: no-progress cycle requires an exact gap');
  }
  return errors;
});if(process.argv[1]?.endsWith('validate-output.mjs'))await runValidatorCli(validateOutput,'node validate-output.mjs <output.json>');
