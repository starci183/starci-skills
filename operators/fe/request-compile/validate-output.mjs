import { validatorFor, runValidatorCli } from '../../validation.mjs';
import crypto from 'node:crypto';
import { REQUIRED_PROBE_CATEGORIES, REQUIRED_PROBE_PHASES, REQUIRED_VIEWPORTS } from '../strict-ui-validation.mjs';
import { directionContractErrors } from '../direction-authority.mjs';
const fingerprint=(value)=>`sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
const compiledProjection=(result)=>({objective:result.objective,targetRef:result.targetRef,uxUiChangeLevel:result.uxUiChangeLevel,directionMode:result.directionMode,directionEvidence:result.directionEvidence,behaviorContractRef:result.behaviorContractRef,behaviorContractFingerprint:result.behaviorContractFingerprint,grammarBinding:result.grammarBinding,iconographyManifest:result.iconographyManifest,mediaManifest:result.mediaManifest,productFamilyEvidence:result.productFamilyEvidence,proofMatrix:result.proofMatrix,proofMatrixFingerprint:result.proofMatrixFingerprint,constraints:result.constraints,negativeBoundary:result.negativeBoundary,acceptanceCriteria:result.acceptanceCriteria,sourceBoundary:result.sourceBoundary,sourceBoundaryFingerprint:result.sourceBoundaryFingerprint});
const iconographyProjection=(manifest)=>({manifestRef:manifest.manifestRef,mode:manifest.mode,visualFamilyRef:manifest.visualFamilyRef,decisions:manifest.decisions});
const mediaProjection=(manifest)=>({manifestRef:manifest.manifestRef,mode:manifest.mode,assetRef:manifest.assetRef,artifactRefs:manifest.artifactRefs,provenanceRefs:manifest.provenanceRefs,responsiveTreatmentRef:manifest.responsiveTreatmentRef,altIntentRef:manifest.altIntentRef,fallbackRef:manifest.fallbackRef});
const auditPlanProjection=(result)=>({auditPlanRef:result.grammarBinding.auditPlanRef,manifestRef:result.grammarBinding.manifestRef,decisionManifestFingerprint:result.grammarBinding.decisionManifestFingerprint,compositionOwners:result.grammarBinding.compositionOwners,proofMatrixFingerprint:result.proofMatrixFingerprint,iconographyManifestFingerprint:result.iconographyManifest.manifestFingerprint,mediaManifestFingerprint:result.mediaManifest.manifestFingerprint});
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
      if(result.grammarBinding.auditPlanFingerprint!==fingerprint(auditPlanProjection(result))) errors.push('Grammar auditPlanFingerprint must bind decisions, owners, manifests, and proof matrix');
      const ownerRefs=result.grammarBinding.compositionOwners.map(({ownerRef})=>ownerRef);
      if(new Set(ownerRefs).size!==ownerRefs.length) errors.push('Grammar compositionOwners must bind each owner once');
      for(const owner of result.grammarBinding.compositionOwners){
        if(owner.ownerLayer==='grammar'&&(!owner.authorityRef.startsWith('grammar://')||!owner.patternRef.startsWith('pattern://'))) errors.push(`${owner.ownerRef} Grammar owner has mismatched authority`);
        if(owner.ownerLayer==='application-block'&&(!owner.authorityRef.startsWith('application://')||!owner.patternRef.startsWith('block://'))) errors.push(`${owner.ownerRef} application block has mismatched authority`);
        if(owner.ownerLayer==='application-composite'&&(!owner.authorityRef.startsWith('application://')||!owner.patternRef.startsWith('composite://'))) errors.push(`${owner.ownerRef} application composite has mismatched authority`);
      }
      if(result.iconographyManifest.manifestFingerprint!==fingerprint(iconographyProjection(result.iconographyManifest))) errors.push('iconography manifest fingerprint must bind the exact provenance manifest');
      if(result.iconographyManifest.mode==='none'&&(result.iconographyManifest.visualFamilyRef!==null||result.iconographyManifest.decisions.length!==0)) errors.push('none iconography cannot carry a family or glyph decisions');
      if(result.iconographyManifest.mode==='resolved'&&(result.iconographyManifest.visualFamilyRef===null||result.iconographyManifest.decisions.length===0)) errors.push('resolved iconography requires one family and decisions');
      const iconRoles=result.iconographyManifest.decisions.map(({roleRef})=>roleRef);
      if(new Set(iconRoles).size!==iconRoles.length) errors.push('iconography manifest must resolve each semantic role once');
      for(const decision of result.iconographyManifest.decisions){
        if(decision.source==='heroicons'&&(!decision.glyphRef.startsWith('heroicons://')||decision.customReason!==null)) errors.push(`${decision.roleRef} must bind an upstream Heroicon without a custom reason`);
        if(decision.source==='custom-svg'&&(!decision.glyphRef.startsWith('icon-brief://')||decision.customReason===null)) errors.push(`${decision.roleRef} custom SVG requires a frozen brief and reason`);
      }
      if(result.mediaManifest.manifestFingerprint!==fingerprint(mediaProjection(result.mediaManifest))) errors.push('media manifest fingerprint must bind the exact provenance manifest');
      if(result.mediaManifest.mode==='none'&&(result.mediaManifest.assetRef!==null||result.mediaManifest.artifactRefs.length!==0||result.mediaManifest.provenanceRefs.length!==0||result.mediaManifest.responsiveTreatmentRef!==null||result.mediaManifest.altIntentRef!==null||result.mediaManifest.fallbackRef!==null)) errors.push('none media mode cannot carry asset or presentation bindings');
      if(result.mediaManifest.mode!=='none'&&(result.mediaManifest.assetRef===null||result.mediaManifest.provenanceRefs.length===0||result.mediaManifest.responsiveTreatmentRef===null||result.mediaManifest.altIntentRef===null||result.mediaManifest.fallbackRef===null)) errors.push(`${result.mediaManifest.mode} media requires asset, provenance, responsive, alt, and fallback bindings`);
      if(result.mediaManifest.mode==='generate'&&(result.mediaManifest.artifactRefs.length===0||!/^asset:\/\/sha256-[0-9a-f]{64}\.(png|jpg|jpeg|webp)$/.test(result.mediaManifest.assetRef??''))) errors.push('generated media requires a content-addressed raster artifact');
      if(result.productFamilyEvidence.grammarBindingRef!==result.grammarBinding.bindingRef) errors.push('product-family evidence must bind the exact Grammar binding');
      if(!result.productFamilyEvidence.packagedContractRefs.includes(result.grammarBinding.packageRef)) errors.push('product-family evidence must include the selected Grammar package');
      for(const ref of [result.grammarBinding.auditPlanRef,result.iconographyManifest.manifestRef,result.mediaManifest.manifestRef,...result.productFamilyEvidence.benchmarkRasterRefs]) if(!evidenceRefs.includes(ref)) errors.push(`compiled request evidenceRefs must include ${ref}`);
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
    if(result) errors.push(...directionContractErrors(result));
    if(result) for(const ref of result.directionEvidence.evidenceRefs) if(!evidenceRefs.includes(ref)) errors.push(`compiled request evidenceRefs must include direction evidence ${ref}`);
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
