import { validatorFor, runValidatorCli } from '../../validation.mjs';
import fs from 'node:fs';
import path from 'node:path';
export const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(value)=>{
  const errors=[];
  const { outcome, aiExecution, result, gaps, evidenceRefs, handoff }=value.output;
  if(outcome==='generated'){
    if(aiExecution===null) errors.push('generated direction set requires one fresh Sol execution');
    if(result===null) errors.push('generated direction set requires a result');
    else {
      if(result.directions.length!==result.directionCount) errors.push('directionCount must equal rendered directions');
      if(!evidenceRefs.includes(result.compiledRequestRef)) errors.push('generated direction evidence must include compiledRequestRef');
      if(result.mode==='dominant'&&result.directionCount!==1) errors.push('dominant mode requires exactly one rendered direction');
      if(result.mode==='alternatives'&&(result.directionCount<3||result.directionCount>4)) errors.push('alternatives mode requires three or four rendered directions');
      if(result.requiresChoice!==(result.mode==='alternatives')) errors.push('requiresChoice must be false for dominant mode and true for alternatives mode');
      if(result.mode==='dominant'&&result.materialDifferences.length!==0) errors.push('dominant mode does not emit comparison differences');
      if(result.mode==='alternatives'&&result.materialDifferences.length<3) errors.push('alternatives mode requires at least three material differences');
      if(!result.artifactRefs.includes(result.comparisonArtifactRef)) errors.push('comparisonArtifactRef must be registered in artifactRefs');
      for(const direction of result.directions) if(!result.artifactRefs.includes(direction.visualPanelRef)) errors.push(`rendered direction ref ${direction.visualPanelRef} must be registered in artifactRefs`);
      if(/^[a-z][a-z0-9+.-]*:\/\//i.test(result.comparisonArtifactRef)) errors.push('comparisonArtifactRef must be a local inspectable HTML artifact, not a remote URI');
      const artifactPath=path.resolve(process.cwd(),result.comparisonArtifactRef);
      const relativeArtifact=path.relative(process.cwd(),artifactPath);
      if(path.isAbsolute(result.comparisonArtifactRef)||relativeArtifact.startsWith('..')||path.isAbsolute(relativeArtifact)) errors.push('comparisonArtifactRef must stay inside the execution workspace');
      let comparisonHtml='';
      if(!errors.some((error)=>error.includes('execution workspace'))){
        if(!fs.existsSync(artifactPath)||!fs.statSync(artifactPath).isFile()) errors.push('comparisonArtifactRef must point to an existing inspectable HTML file');
        else {
          comparisonHtml=fs.readFileSync(artifactPath,'utf8');
          if(!/<(?:!doctype\s+html|html)[\s>]/i.test(comparisonHtml)) errors.push('comparisonArtifactRef must contain an inspectable HTML document');
        }
      }
      if(new Set(result.directions.map((item)=>item.id)).size!==result.directions.length) errors.push('direction ids must be unique');
      if(new Set(result.directions.map((item)=>item.visualPanelRef)).size!==result.directions.length) errors.push('visual panel refs must be unique');
      const candidateRefs=result.grammarFilterRecords.map((item)=>item.candidateRef);
      if(new Set(candidateRefs).size!==candidateRefs.length) errors.push('Grammar filter candidate refs must be unique');
      const accepted=new Map(result.grammarFilterRecords.filter((item)=>item.decision==='accepted').map((item)=>[item.candidateRef,item]));
      if(accepted.size!==result.directions.length) errors.push('accepted Grammar candidate count must equal rendered direction count');
      for(const direction of result.directions){
        const record=accepted.get(direction.id);
        if(!record) errors.push(`rendered direction ${direction.id} did not pass the Grammar filter`);
        else if(record.manifestRef!==direction.grammarDecisionManifestRef) errors.push(`rendered direction ${direction.id} must bind its accepted Grammar manifest`);
        for(const ref of [direction.visualPanelRef,direction.wideStateRef,direction.compactStateRef,direction.materialStateRef]) if(comparisonHtml&&!comparisonHtml.includes(ref)) errors.push(`visualize HTML is missing rendered ref ${ref}`);
      }
      for(const record of result.grammarFilterRecords.filter((item)=>item.decision==='rejected')) if(result.directions.some((direction)=>direction.id===record.candidateRef)) errors.push(`rejected candidate ${record.candidateRef} cannot be rendered or ranked`);
    }
    if(gaps.length!==0) errors.push('generated direction set cannot retain gaps');
    if(evidenceRefs.length===0) errors.push('generated direction set requires exact evidence');
    if(handoff!==null) errors.push('generated direction set cannot emit a handoff');
  }
  if(outcome==='blocked'){
    if(result!==null||gaps.length===0) errors.push('blocked direction generation requires null result and exact gaps');
    if(evidenceRefs.length===0) errors.push('blocked direction generation requires exact evidence');
    if(handoff!==null) errors.push('blocked direction generation cannot emit a handoff');
  }
  return errors;
});
if(process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput,'node validate-output.mjs <output.json>');
