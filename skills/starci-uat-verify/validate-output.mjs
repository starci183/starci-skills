import { validatorFor, runValidatorCli } from '../../operators/validation.mjs';
import { inspectUatArtifact } from '../../operators/test/uat-artifact.mjs';
export const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(value)=>{
  const errors=[];
  if(value.outcome==='complete'){
    if(value.verdict!=='PASS') errors.push('verdict must be PASS for complete UAT');
    if(value.handoff!==null) errors.push('complete UAT cannot carry a handoff');
    if(value.artifactRefs.length===0) errors.push('complete UAT requires its canonical result artifact');
    if(typeof value.canonicalResultRef!=='string'||typeof value.canonicalResultFingerprint!=='string') errors.push('complete UAT requires the exact canonical result ref and fingerprint');
  } else if(value.outcome==='handoff'){
    if(value.verdict!=='FAIL') errors.push('frontend counterevidence handoff requires verdict FAIL');
    if(value.handoff?.skillId!=='starci-fe-process'||value.handoff?.resumeSkillId!=='starci-uat-verify'||value.handoff?.resumeState!=='reapply'||value.handoff?.missionRef!==value.missionRef) errors.push('UAT handoff must carry exact frontend reapply continuation');
    if(value.artifactRefs.length===0) errors.push('frontend counterevidence handoff requires its canonical finding artifact');
    if(typeof value.canonicalResultRef!=='string'||typeof value.canonicalResultFingerprint!=='string') errors.push('frontend counterevidence handoff requires the canonical failed result ref and fingerprint');
  } else {
    if(!['FAIL','BLOCKED'].includes(value.verdict)) errors.push('blocked UAT cannot claim PASS');
    if(value.handoff!==null) errors.push('blocked UAT cannot carry a handoff');
    if(value.verdict==='FAIL'&&(typeof value.canonicalResultRef!=='string'||typeof value.canonicalResultFingerprint!=='string')) errors.push('failed UAT requires the canonical failed result ref and fingerprint');
    if(value.verdict==='BLOCKED'&&(value.canonicalResultRef!==null||value.canonicalResultFingerprint!==null)) errors.push('blocked publication cannot claim a canonical result');
  }
  if(value.canonicalResultRef!==null){
    if(!value.artifactRefs.includes(value.canonicalResultRef)) errors.push('artifactRefs must include canonicalResultRef');
    const artifact=inspectUatArtifact(value.canonicalResultRef,'result');
    errors.push(...artifact.errors);
    if(value.canonicalResultFingerprint!==artifact.contentFingerprint) errors.push('canonicalResultFingerprint must hash the exact canonical result artifact');
    const expectedArtifactOutcome=value.verdict==='PASS'?'passed':'failed';
    if(artifact.document?.outcome!==expectedArtifactOutcome) errors.push('canonical result outcome must equal the public UAT verdict');
  }
  return errors;
});
if(process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput,'node validate-output.mjs <output.json>');
