import { validatorFor,runValidatorCli } from '../../validation.mjs';
import { expectedUatResultRef, inspectUatArtifact } from '../uat-artifact.mjs';
export const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(value)=>{
  const {outcome,canonicalRef,contentFingerprint,result,gaps,evidenceRefs}=value.output;
  const errors=[];
  if(outcome!=='blocked'){
    const artifact=inspectUatArtifact(canonicalRef,'result');
    errors.push(...artifact.errors);
    if(contentFingerprint!==artifact.contentFingerprint) errors.push('$.output.contentFingerprint: must hash the exact canonical result artifact');
    const snapshotRef=canonicalRef?.replace(/\/result\.json$/,'/snapshot.json');
    const snapshot=inspectUatArtifact(snapshotRef,'snapshot');
    errors.push(...snapshot.errors);
    if(artifact.document?.snapshotFingerprint!==snapshot.contentFingerprint) errors.push('canonical result snapshotFingerprint must hash the exact sibling snapshot');
    const expectedOutcome=outcome==='passed'?'passed':'failed';
    if(artifact.document?.outcome!==expectedOutcome) errors.push('canonical result outcome must equal the typed publication outcome');
    if(JSON.stringify(artifact.document?.evidenceRefs)!==JSON.stringify(evidenceRefs)) errors.push('canonical result evidenceRefs must equal the exact publication evidence sequence');
    if(expectedUatResultRef(snapshotRef)!==canonicalRef) errors.push('canonical result must be the exact sibling of its snapshot');
    if(result&&!result.artifactRefs.includes(canonicalRef)) errors.push('$.output.result.artifactRefs: must include canonicalRef');
  } else {
    if(canonicalRef!==null) errors.push('$.output.canonicalRef: blocked publication cannot publish a canonical result');
    if(contentFingerprint!==null) errors.push('$.output.contentFingerprint: blocked publication cannot publish a content fingerprint');
  }
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
