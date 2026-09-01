import { validatorFor, runValidatorCli } from '../../operators/validation.mjs';
export const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(value)=>{
  const errors=[];
  if(value.outcome==='complete'){
    if(value.verdict!=='PASS') errors.push('verdict must be PASS for complete UAT');
    if(value.handoff!==null) errors.push('complete UAT cannot carry a handoff');
    if(value.artifactRefs.length===0) errors.push('complete UAT requires its canonical result artifact');
  } else if(value.outcome==='handoff'){
    if(value.verdict!=='FAIL') errors.push('frontend counterevidence handoff requires verdict FAIL');
    if(value.handoff?.skillId!=='starci-fe-process'||value.handoff?.resumeSkillId!=='starci-uat-verify'||value.handoff?.resumeState!=='reapply'||value.handoff?.missionRef!==value.missionRef) errors.push('UAT handoff must carry exact frontend reapply continuation');
    if(value.artifactRefs.length===0) errors.push('frontend counterevidence handoff requires its canonical finding artifact');
  } else {
    if(!['FAIL','BLOCKED'].includes(value.verdict)) errors.push('blocked UAT cannot claim PASS');
    if(value.handoff!==null) errors.push('blocked UAT cannot carry a handoff');
  }
  return errors;
});
if(process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput,'node validate-output.mjs <output.json>');
