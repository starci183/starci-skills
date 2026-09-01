import { validatorFor, runValidatorCli } from '../../validation.mjs';
import crypto from 'node:crypto';
import { REQUIRED_PROBE_CATEGORIES, REQUIRED_PROBE_PHASES, REQUIRED_VIEWPORTS } from '../strict-ui-validation.mjs';
const fingerprint=(value)=>`sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
const compiledProjection=(result)=>({objective:result.objective,targetRef:result.targetRef,uxUiChangeLevel:result.uxUiChangeLevel,directionMode:result.directionMode,directionEvidence:result.directionEvidence,behaviorContractRef:result.behaviorContractRef,behaviorContractFingerprint:result.behaviorContractFingerprint,grammarBinding:result.grammarBinding,proofMatrix:result.proofMatrix,proofMatrixFingerprint:result.proofMatrixFingerprint,constraints:result.constraints,negativeBoundary:result.negativeBoundary,acceptanceCriteria:result.acceptanceCriteria,sourceBoundary:result.sourceBoundary,sourceBoundaryFingerprint:result.sourceBoundaryFingerprint});
const exact=(left,right)=>left.length===right.length&&left.every((item,index)=>item===right[index]);
export const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(value)=>{
  const errors=[];
  const { outcome, result, gaps, evidenceRefs, handoff, repair }=value.output;
  if(outcome==='compiled'){
    if(result===null) errors.push('compiled request requires a structured result');
    if((result?.artifactRefs.length??0)===0) errors.push('compiled request requires at least one compiled artifact');
    if((result?.constraints.length??0)===0) errors.push('compiled request requires closed constraints');
    if((result?.negativeBoundary.length??0)===0) errors.push('compiled request requires an explicit negative mutation boundary');
    if((result?.acceptanceCriteria.length??0)===0) errors.push('compiled request requires acceptance criteria');
    if((result?.sourceBoundary.length??0)===0) errors.push('compiled request requires an exact direct-owner source boundary');
    if(result&&result.compiledRequestFingerprint!==fingerprint(compiledProjection(result))) errors.push('compiledRequestFingerprint must hash the exact author-once compiled projection');
    if(result&&result.proofMatrixFingerprint!==fingerprint(result.proofMatrix)) errors.push('proofMatrixFingerprint must hash the exact proofMatrix');
    if(result&&!result.artifactRefs.includes(result.compiledRequestRef)) errors.push('compiled request artifactRefs must include compiledRequestRef');
    if(result&&!result.artifactRefs.includes(result.behaviorContractRef)) errors.push('compiled request artifactRefs must include behaviorContractRef');
    if(result&&!evidenceRefs.includes(result.grammarBinding.packageRef)) errors.push('compiled request evidenceRefs must include Grammar package identity');
    if(result&&!evidenceRefs.includes(result.grammarBinding.manifestRef)) errors.push('compiled request evidenceRefs must include Grammar manifest identity');
    if(result){
      const stateRefs=result.proofMatrix.states.map(({stateRef})=>stateRef);
      if(new Set(stateRefs).size!==stateRefs.length) errors.push('proofMatrix state refs must be unique');
      if(!exact(result.proofMatrix.viewports,REQUIRED_VIEWPORTS)) errors.push('proofMatrix viewports must be ordered wide, intermediate, compact');
      const expectedProbeRefs=REQUIRED_PROBE_CATEGORIES.flatMap((category)=>REQUIRED_PROBE_PHASES[category].map((phase)=>`probe-${category}-${phase}`));
      if(!exact(result.proofMatrix.probeRefs,expectedProbeRefs)) errors.push('proofMatrix probes must follow the exact canonical 22-probe order');
      const hero=result.proofMatrix.states.find(({stateRef})=>stateRef===result.proofMatrix.populatedHeroStateRef);
      if(!hero||hero.lifecycle!=='happy-case'||hero.populated!==true||hero.coreTaskVisible!==true) errors.push('proofMatrix populated hero must be a happy-case state with the core task visible');
      const expectedCells=result.proofMatrix.states.flatMap(({stateRef})=>REQUIRED_VIEWPORTS.map((viewport)=>`${stateRef}::${viewport}`));
      const actualCells=result.proofMatrix.cells.map(({stateRef,viewport})=>`${stateRef}::${viewport}`);
      if(!exact(actualCells,expectedCells)) errors.push('proofMatrix cells must cover every state and viewport exactly once in canonical order');
      if(new Set(result.proofMatrix.cells.map(({cellRef})=>cellRef)).size!==result.proofMatrix.cells.length) errors.push('proofMatrix cell refs must be unique');
    }
    const validClassifications={none:['not-applicable'],dominant:['dominant'],alternatives:['ambiguous','comparison-requested']}[result?.directionMode];
    if(result&&!validClassifications.includes(result.directionEvidence.classification)) errors.push('compiled request directionEvidence must justify directionMode');
    if(result?.uxUiChangeLevel==='refine'&&result.directionMode!=='none') errors.push('compiled refine requires directionMode none');
    if(result&&result.uxUiChangeLevel!=='refine'&&result.directionMode==='none') errors.push('compiled reconstruct/new requires dominant or alternatives directionMode');
    if(result&&new Set(result.sourceBoundary.map(({path})=>path)).size!==result.sourceBoundary.length) errors.push('compiled request sourceBoundary paths must be unique');
    if(result&&result.sourceBoundaryFingerprint!==fingerprint(result.sourceBoundary)) errors.push('compiled request sourceBoundaryFingerprint must hash the exact ordered sourceBoundary');
    if(gaps.length!==0) errors.push('compiled request cannot retain gaps');
    if(evidenceRefs.length===0) errors.push('compiled request requires exact evidence');
    if(handoff!==null) errors.push('compiled request cannot emit a cross-domain handoff');
    if(repair!==null) errors.push('compiled request cannot retain Grammar repair metadata');
  }
  if(outcome==='blocked'){
    if(result!==null) errors.push('blocked request compilation requires a null result');
    if(gaps.length===0) errors.push('blocked request compilation requires exact gaps');
    if(handoff!==null) errors.push('blocked request compilation cannot emit a handoff');
    if(repair!==null) errors.push('blocked request compilation cannot emit repair metadata');
    if(evidenceRefs.length===0) errors.push('blocked request compilation requires exact evidence');
  }
  if(outcome==='business-required'||outcome==='backend-required'){
    const skillId=outcome==='business-required'?'starci-business-process':'starci-backend-process';
    if(result!==null) errors.push(`${outcome} request compilation requires a null result`);
    if(gaps.length===0) errors.push(`${outcome} request compilation requires exact gaps`);
    if(evidenceRefs.length===0) errors.push(`${outcome} request compilation requires exact evidence`);
    if(handoff?.skillId!==skillId) errors.push(`${outcome} request compilation requires a ${skillId} handoff`);
    if(handoff?.resumeState!=='request-compile') errors.push(`${outcome} request compilation must resume request-compile`);
    if(repair!==null) errors.push(`${outcome} request compilation cannot emit local repair metadata`);
  }
  if(outcome==='grammar-required'){
    if(result!==null) errors.push('grammar-required request compilation requires a null result');
    if(gaps.length===0) errors.push('grammar-required request compilation requires exact gaps');
    if(evidenceRefs.length===0) errors.push('grammar-required request compilation requires exact evidence');
    if(handoff!==null) errors.push('grammar-required request compilation cannot emit a cross-domain handoff');
    if(repair===null) errors.push('grammar-required request compilation requires exact Grammar-owner repair metadata');
  }
  return errors;
});
if(process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput,'node validate-output.mjs <output.json>');
