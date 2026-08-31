import { validatorFor, runValidatorCli } from '../../validation.mjs';
export const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(value)=>{
  const errors=[];
  const { outcome, result, gaps }=value.output;
  if(outcome==='generated'){
    if(result===null) errors.push('generated direction set requires a result');
    else {
      if(result.directions.length!==result.directionCount) errors.push('directionCount must equal rendered directions');
      if(!result.artifactRefs.includes(result.comparisonArtifactRef)) errors.push('comparisonArtifactRef must be registered in artifactRefs');
      if(new Set(result.directions.map((item)=>item.id)).size!==result.directions.length) errors.push('direction ids must be unique');
      if(new Set(result.directions.map((item)=>item.visualPanelRef)).size!==result.directions.length) errors.push('visual panel refs must be unique');
      const accepted=new Map(result.grammarFilterRecords.filter((item)=>item.decision==='accepted').map((item)=>[item.candidateRef,item]));
      if(accepted.size<3) errors.push('at least three Grammar-valid candidates are required before rendering');
      for(const direction of result.directions){
        const record=accepted.get(direction.id);
        if(!record) errors.push(`rendered direction ${direction.id} did not pass the Grammar filter`);
        else if(record.manifestRef!==direction.grammarDecisionManifestRef) errors.push(`rendered direction ${direction.id} must bind its accepted Grammar manifest`);
      }
      for(const record of result.grammarFilterRecords.filter((item)=>item.decision==='rejected')) if(result.directions.some((direction)=>direction.id===record.candidateRef)) errors.push(`rejected candidate ${record.candidateRef} cannot be rendered or ranked`);
    }
    if(gaps.length!==0) errors.push('generated direction set cannot retain gaps');
  }
  if(outcome==='blocked'&&(result!==null||gaps.length===0)) errors.push('blocked direction generation requires null result and exact gaps');
  return errors;
});
if(process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput,'node validate-output.mjs <output.json>');
