import { validatorFor, runValidatorCli } from '../../validation.mjs';
import { inspectUatArtifact } from '../uat-artifact.mjs';
export const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(value)=>{
  const {outcome,canonicalRef,contentFingerprint,evidenceRefs,gaps}=value.output;
  const errors=[];
  if(outcome==='frozen'){
    if(typeof canonicalRef!=='string') errors.push('frozen UAT snapshot requires a canonical artifact ref');
    const artifact=inspectUatArtifact(canonicalRef,'snapshot');
    errors.push(...artifact.errors);
    if(contentFingerprint!==artifact.contentFingerprint) errors.push('frozen UAT snapshot contentFingerprint must hash the exact canonical artifact');
    if(evidenceRefs.length===0) errors.push('frozen UAT snapshot requires nonempty evidence');
    if(gaps.length!==0) errors.push('frozen UAT snapshot cannot retain gaps');
  }else{
    if(canonicalRef!==null) errors.push('blocked UAT snapshot cannot publish a canonical ref');
    if(contentFingerprint!==null) errors.push('blocked UAT snapshot cannot publish a content fingerprint');
    if(gaps.length===0) errors.push('blocked UAT snapshot requires exact gaps');
  }
  return errors;
});
if(process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput,'node validate-output.mjs <output.json>');
