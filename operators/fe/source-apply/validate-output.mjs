import { validatorFor, runValidatorCli } from '../../validation.mjs';
import crypto from 'node:crypto';
const fingerprint=(value)=>`sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
export const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(value)=>{
  const errors=[];
  const { outcome, result, gaps, evidenceRefs, handoff }=value.output;
  if(outcome==='applied'){
    if(result===null) errors.push('applied source change requires a structured result');
    if((result?.artifactRefs.length??0)===0) errors.push('applied source change requires mutation artifacts');
    const boundaryByPath=new Map((result?.sourceBoundary??[]).map((entry)=>[entry.path,entry]));
    if(result&&boundaryByPath.size!==result.sourceBoundary.length) errors.push('applied source change sourceBoundary paths must be unique');
    if(result&&result.sourceBoundaryFingerprint!==fingerprint(result.sourceBoundary)) errors.push('applied source change sourceBoundaryFingerprint must hash the exact ordered sourceBoundary');
    if(result?.directionMode==='none'&&result.directionBinding!==null) errors.push('applied refine mutation requires null directionBinding');
    if(result?.directionMode!=='none'&&result?.directionBinding===null) errors.push('applied generated direction requires an exact directionBinding');
    if(result?.directionBinding&&result.directionBinding.mode!==result.directionMode) errors.push('applied directionBinding mode must equal directionMode');
    if(result&&!evidenceRefs.includes(result.compiledRequestRef)) errors.push('applied evidenceRefs must include compiledRequestRef');
    if(result?.directionBinding&&!evidenceRefs.includes(result.directionBinding.directionGenerateReturnReceiptRef)) errors.push('applied evidenceRefs must include direction-generate RETURN receipt');
    if(result?.directionBinding&&!evidenceRefs.includes(result.directionBinding.selectedDirectionRef)) errors.push('applied evidenceRefs must include selectedDirectionRef');
    if(result&&(!evidenceRefs.includes(result.grammarBinding.packageRef)||!evidenceRefs.includes(result.grammarBinding.manifestRef))) errors.push('applied evidenceRefs must include compiled Grammar package and manifest identities');
    if(result&&result.productFamilyEvidence.grammarBindingRef!==result.grammarBinding.bindingRef) errors.push('applied product-family evidence must bind the exact compiled Grammar binding');
    if(result) for(const ref of [result.grammarBinding.auditPlanRef,result.iconographyManifest.manifestRef,result.mediaManifest.manifestRef,...result.productFamilyEvidence.benchmarkRasterRefs]) if(!evidenceRefs.includes(ref)) errors.push(`applied evidenceRefs must include ${ref}`);
    if(result&&result.proofMatrixFingerprint!==fingerprint(result.proofMatrix)) errors.push('applied proofMatrixFingerprint must hash the exact proofMatrix');
    if(result&&result.aggregateAfterFingerprint!==fingerprint(result.effectRecords.map(({path,afterSha256})=>({path,afterSha256})))) errors.push('aggregateAfterFingerprint must hash exact ordered effect paths and after hashes');
    const effectPaths=result?.effectRecords.map(({path})=>path)??[];
    if(new Set(effectPaths).size!==effectPaths.length) errors.push('applied source change effect paths must be unique');
    if(result&&(result.artifactRefs.length!==effectPaths.length||result.artifactRefs.some((path,index)=>path!==effectPaths[index]))) errors.push('applied source change artifactRefs must equal effect record paths in order');
    for(const effect of result?.effectRecords??[]){
      const boundary=boundaryByPath.get(effect.path);
      if(!boundary) errors.push(`mutation effect ${effect.path} falls outside the repeated frozen source boundary`);
      else if(boundary.beforeSha256!==effect.beforeSha256) errors.push(`mutation effect ${effect.path} beforeSha256 differs from the frozen boundary`);
      if(effect.effect==='created'&&(effect.beforeSha256!==null||effect.afterSha256===null)) errors.push(`created effect ${effect.path} requires null before and hashed after state`);
      if(effect.effect==='updated'&&(effect.beforeSha256===null||effect.afterSha256===null||effect.beforeSha256===effect.afterSha256)) errors.push(`updated effect ${effect.path} requires distinct hashed before and after states`);
      if(effect.effect==='deleted'&&(effect.beforeSha256===null||effect.afterSha256!==null)) errors.push(`deleted effect ${effect.path} requires hashed before and null after state`);
    }
    if(gaps.length!==0) errors.push('applied source change cannot retain gaps');
    if(evidenceRefs.length===0) errors.push('applied source change requires exact mutation evidence');
    if(handoff!==null) errors.push('applied source change cannot emit a handoff');
  }
  if(outcome==='backend-required'){
    if(result!==null) errors.push('backend-required source application requires a null result');
    if(gaps.length===0) errors.push('backend-required source application requires exact gaps');
    if(evidenceRefs.length===0) errors.push('backend-required source application requires exact evidence');
    if(handoff?.skillId!=='starci-backend-process') errors.push('backend-required source application requires a backend handoff');
    if(!['apply','reapply'].includes(handoff?.resumeState)) errors.push('backend-required source application must resume apply or reapply');
  }
  if(outcome==='blocked'){
    if(result!==null) errors.push('blocked source application requires a null result');
    if(gaps.length===0) errors.push('blocked source application requires exact gaps');
    if(evidenceRefs.length===0) errors.push('blocked source application requires exact evidence');
    if(handoff!==null) errors.push('blocked source application cannot emit a handoff');
  }
  return errors;
});
if(process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput,'node validate-output.mjs <output.json>');
