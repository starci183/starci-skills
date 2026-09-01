import { validatorFor,runValidatorCli } from '../../validation.mjs';
export const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(value)=>{
  const {outcome,result,gaps,evidenceRefs}=value.output;
  const errors=[];
  if(outcome==='passed'){
    if(result===null||result.counterevidence!==null) errors.push('$.output.result: passed UAT requires a result without counterevidence');
    if(gaps.length!==0) errors.push('$.output.gaps: passed UAT cannot carry gaps');
  } else if(outcome==='frontend-counterevidence'){
    const counterevidence=result?.counterevidence;
    if(!counterevidence) errors.push('$.output.result.counterevidence: frontend-counterevidence requires the typed fresh finding');
    if(gaps.length===0) errors.push('$.output.gaps: frontend-counterevidence requires an exact gap');
    if(counterevidence&&!result.artifactRefs.includes(counterevidence.findingRef)) errors.push('$.output.result.artifactRefs: must include counterevidence findingRef');
    if(counterevidence&&!counterevidence.evidenceRefs.includes(counterevidence.findingRef)) errors.push('$.output.result.counterevidence.evidenceRefs: must include findingRef');
    if(counterevidence?.evidenceRefs.some((ref)=>!evidenceRefs.includes(ref))) errors.push('$.output.evidenceRefs: must include every counterevidence evidence ref');
  } else {
    if(result!==null) errors.push('$.output.result: failed or blocked UAT cannot publish a result');
    if(gaps.length===0) errors.push('$.output.gaps: failed or blocked UAT requires exact gaps');
  }
  return errors;
});if(process.argv[1]?.endsWith('validate-output.mjs'))await runValidatorCli(validateOutput,'node validate-output.mjs <output.json>');
