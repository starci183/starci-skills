import { validatorFor, runValidatorCli } from '../../operators/validation.mjs';
import { loadScopePolicy } from '../../runtime/scope-policy.mjs';
import { validatePublicSkillReceipt } from '../receipt-consumption.mjs';
import { isRouteIssuedTransitionReceipt, routeIssuedTransitionFor } from '../../runtime/route-transition.mjs';
import { assertProgress } from '../../runtime/trace.mjs';
import { isValidatedDirectionChoiceResume } from '../route-machine.mjs';
import { directionAuthorityContextErrors, directionContractErrors } from '../../operators/fe/direction-authority.mjs';

const scopePolicy=loadScopePolicy();
const changeLevelKey='frontend.ux-ui.change-level';
const ownerCeilingKey='frontend.layout.owner-ceiling';
const hasFinalRoute=(receipt,{skillId,operatorId,outcome,target})=>{
  const transition=routeIssuedTransitionFor(receipt);
  return receipt?.skillId===skillId&&receipt?.operatorId===operatorId&&
    receipt?.trace?.actualOutput?.output?.outcome===outcome&&
    isRouteIssuedTransitionReceipt(transition)&&transition.skillId===skillId&&
    transition.operatorId===operatorId&&transition.missionId===receipt.missionId&&
    transition.trace?.transitionRule?.outcome===outcome&&transition.trace?.transitionRule?.target===target;
};
export const validateInput=validatorFor(new URL('./input.schema.json',import.meta.url),(value)=>{
  const errors=[];
  for (const [index, record] of value.auditScoreHistory.entries()) {
    const expectedRound=index+1;
    if (record.round!==expectedRound) errors.push(`auditScoreHistory[${index}].round must be ${expectedRound}`);
    const previous=value.auditScoreHistory[index-1];
    const expectedDelta=previous ? record.score-previous.score : null;
    if (record.delta!==expectedDelta) errors.push(`auditScoreHistory[${index}].delta must equal score movement from the previous round`);
    if (record.typedVerdict!=='PASS'&&record.score>8) errors.push(`auditScoreHistory[${index}].score cannot exceed 8 without PASS`);
    if (record.typedVerdict==='PASS'&&record.score<9) errors.push(`auditScoreHistory[${index}].score must be at least 9 for PASS`);
  }
  const matches=value.scope.dimensions.filter((dimension)=>dimension.key===changeLevelKey);
  if(matches.length!==1) errors.push(`scope requires exactly one ${changeLevelKey} dimension`);
  else if(!scopePolicy.registeredDimensions[changeLevelKey].includes(matches[0].value)) {
    errors.push(`${changeLevelKey} must be refine, reconstruct, or new`);
  } else if(value.uxUiChangeLevel!==matches[0].value) errors.push(`uxUiChangeLevel must equal the frozen ${changeLevelKey} dimension`);
  errors.push(...directionContractErrors(value));
  errors.push(...directionAuthorityContextErrors(value.directionEvidence,{authorityRefs:value.authorityRefs,label:'skill input'}));
  const ceilingMatches=value.scope.dimensions.filter((dimension)=>dimension.key===ownerCeilingKey);
  if(ceilingMatches.length!==1) errors.push(`scope requires exactly one ${ownerCeilingKey} dimension`);
  else if(!scopePolicy.registeredDimensions[ownerCeilingKey].includes(ceilingMatches[0].value)) {
    errors.push(`${ownerCeilingKey} must be surface-only, surface-and-nested-layouts, or ancestor-layouts-authorized`);
  }
  const ceiling=value.layoutOwnerCeiling;
  if(ceiling){
    const ceilingValue=ceilingMatches[0]?.value;
    const mutableOwners=[ceiling.targetOwnerRef,...ceiling.directInteractionOwnerRefs,...ceiling.mutableNestedLayoutRefs,...ceiling.mutableAncestorLayoutRefs];
    const allOwners=[...mutableOwners,...ceiling.immutableAncestorLayoutRefs];
    if(new Set(allOwners).size!==allOwners.length) errors.push('layoutOwnerCeiling owner sets must be disjoint');
    if(!value.scope.targetRefs.includes(ceiling.targetOwnerRef)) errors.push('layoutOwnerCeiling targetOwnerRef must be a scope targetRef');
    for(const ownerRef of [...ceiling.directInteractionOwnerRefs,...ceiling.mutableNestedLayoutRefs,...ceiling.mutableAncestorLayoutRefs]) {
      if(!value.scope.inclusionRefs.includes(ownerRef)) errors.push(`mutable feature owner ${ownerRef} must be a scope inclusionRef`);
    }
    for(const ownerRef of ceiling.immutableAncestorLayoutRefs) {
      if(!value.scope.exclusionRefs.includes(ownerRef)) errors.push(`immutable ancestor owner ${ownerRef} must be a scope exclusionRef`);
    }
    if(ceilingValue==='surface-only'&&(ceiling.mutableNestedLayoutRefs.length>0||ceiling.mutableAncestorLayoutRefs.length>0)) errors.push('surface-only forbids mutable layout owners');
    if(ceilingValue==='surface-and-nested-layouts'&&ceiling.mutableAncestorLayoutRefs.length>0) errors.push('surface-and-nested-layouts forbids mutable ancestor layouts');
    for(const file of value.exactFiles) {
      if(!mutableOwners.includes(file.ownerRef)) errors.push(`exact file ${file.path} is owned above the mutable layout ceiling`);
    }
  }
  if(value.returnReceipt===null){
    if(value.receiptType!=='NONE') errors.push('receiptType must be NONE when returnReceipt is null');
    if(value.resume!==null) errors.push('resume requires one canonical returnReceipt');
  }else{
    if(value.receiptType!==value.returnReceipt.type) errors.push('receiptType must match the canonical returnReceipt type');
    const expectedSkillId=value.resume?.fromSkillId==='user-choice'?'starci-fe-process':value.resume?.fromSkillId??null;
    const expectedParentType=value.resume?.fromSkillId==='user-choice'?'WAIT':'CALL';
    errors.push(...validatePublicSkillReceipt(value.returnReceipt,{allowedTypes:['RETURN','RESUME'],expectedMissionId:value.runId,expectedSkillId,expectedParentId:value.resume?.expectedCallReceiptRef??null,expectedParentType,consume:false}));
    try{assertProgress([...value.progressHistory,value.returnReceipt.progressFingerprint])}catch(error){errors.push(error.message)}
    if(value.resume===null) errors.push('returnReceipt requires matching resume metadata');
    else {
      if(value.resume.receiptRef!==value.returnReceipt.receiptId) errors.push('resume receiptRef does not identify returnReceipt');
      if(value.resume.expectedCallReceiptRef!==value.returnReceipt.parentId) errors.push('resume expectedCallReceiptRef does not identify the exact peer CALL parent');
      if(value.resume.missionRef!==value.runId) errors.push('resume missionRef must equal the active runId');
      if(value.resume.resumeState!==value.returnReceipt.trace?.resumeState) errors.push('resume state does not match returnReceipt trace');
      const allowedResumeStates=new Set(['request-compile','apply','reapply','capture-preflight','recapture-preflight','direction-choice','quality-return','uat-return']);
      if(!allowedResumeStates.has(value.resume.resumeState)) errors.push('resume state must identify an exact state in the v7.6 frontend machine');
      if(value.resume.fromSkillId==='starci-quality-assure'&&value.resume.resumeState!=='quality-return') errors.push('quality RETURN must resume at quality-return');
      if(value.resume.fromSkillId==='starci-uat-verify'&&!['uat-return','reapply'].includes(value.resume.resumeState)) errors.push('UAT RETURN must resume at uat-return or reapply with counterevidence');
      if(value.resume.fromSkillId==='starci-business-process'&&value.resume.resumeState!=='request-compile') errors.push('business RETURN must resume at request-compile');
      if(value.resume.fromSkillId==='starci-backend-process'&&!['request-compile','apply','reapply','capture-preflight','recapture-preflight'].includes(value.resume.resumeState)) errors.push('backend RETURN must resume at its exact compile, apply, or preflight state');
      if(value.resume.fromSkillId==='user-choice') {
        const choice=value.resume.directionChoice;
        const resolution=value.returnReceipt.trace?.actualOutput;
        if(value.resume.resumeState!=='direction-choice'||value.returnReceipt.type!=='RESUME'||!isValidatedDirectionChoiceResume(value.returnReceipt)) errors.push('user choice requires a registry-validated direction-choice RESUME');
        if(!choice) errors.push('direction-choice resume requires the selected or rejected direction product');
        if(choice?.decision==='approve'&&(choice.selectedDirectionId===null||choice.reason!==null)) errors.push('approved direction choice requires selectedDirectionId and no rejection reason');
        if(choice?.decision==='reject'&&(choice.selectedDirectionId!==null||choice.reason===null)) errors.push('rejected direction choice requires one reason and no selected direction');
        if(choice&&(resolution?.decision!==choice.decision||resolution?.selectedDirectionId!==(choice.selectedDirectionId??undefined)||resolution?.reason!==(choice.reason??undefined)||resolution?.generatedDirectionReceiptRef!==choice.generatedDirectionReceiptRef||resolution?.comparisonArtifactRef!==choice.comparisonArtifactRef)) errors.push('public direction choice differs from the registry-validated RESUME resolution');
      } else if(value.resume.directionChoice!==null) errors.push('directionChoice is only valid for the user-choice resume');
      if(value.resume.fromSkillId==='starci-quality-assure') {
        if(!hasFinalRoute(value.returnReceipt,{skillId:'starci-quality-assure',operatorId:'quality/delivery-proof',outcome:'pass',target:'complete'})) errors.push('quality-return requires the exact route-issued quality/delivery-proof PASS transition');
        const latestPass=[...value.auditScoreHistory].reverse().find(({typedVerdict})=>typedVerdict==='PASS');
        const proofInput=value.returnReceipt.trace?.input?.input;
        const proofOutput=value.returnReceipt.trace?.actualOutput?.output;
        if(proofInput?.debtPolicy!=='forbidden') errors.push('frontend quality-return requires verification-only debtPolicy forbidden');
        if(!latestPass||proofInput?.sourceFingerprint!==latestPass.sourceFingerprint) errors.push('Quality PASS source must equal the latest blind visual PASS source');
        if(!latestPass||!proofOutput?.evidenceRefs?.includes(latestPass.evidenceFingerprint)) errors.push('Quality PASS evidence must include the latest blind visual packet fingerprint');
        if(!proofOutput?.evidenceRefs?.some((ref)=>(/(^|[\\/])audit\.md$/).test(ref))) errors.push('Quality PASS evidence must include the latest owner audit artifact');
      }
      if(value.resume.fromSkillId==='starci-uat-verify'&&value.resume.resumeState==='uat-return') {
        if(!hasFinalRoute(value.returnReceipt,{skillId:'starci-uat-verify',operatorId:'test/uat-result-publish',outcome:'passed',target:'complete'})) errors.push('uat-return requires the exact route-issued test/uat-result-publish PASS transition');
      }
      if(value.resume.fromSkillId==='starci-uat-verify'&&value.resume.resumeState==='reapply') {
        const validRoute=hasFinalRoute(value.returnReceipt,{skillId:'starci-uat-verify',operatorId:'test/uat-result-publish',outcome:'frontend-counterevidence',target:'counterevidence-handoff'});
        const counterevidence=value.returnReceipt.trace?.actualOutput?.output?.result?.counterevidence;
        const latestPass=[...value.auditScoreHistory].reverse().find(({typedVerdict})=>typedVerdict==='PASS');
        if(!validRoute) errors.push('UAT reapply requires the exact route-issued frontend-counterevidence transition');
        if(!counterevidence||counterevidence.ownerSkillId!=='starci-fe-process'||counterevidence.resumeState!=='reapply') errors.push('UAT reapply requires typed FE-owned counterevidence');
        if(!latestPass||counterevidence?.sourceFingerprint!==latestPass.sourceFingerprint) errors.push('UAT counterevidence source must equal the latest blind visual PASS source');
      }
    }
    if(errors.length===0) errors.push(...validatePublicSkillReceipt(value.returnReceipt,{allowedTypes:['RETURN','RESUME'],expectedMissionId:value.runId,expectedSkillId,expectedParentId:value.resume?.expectedCallReceiptRef??null,expectedParentType}));
  }
  return errors;
});
if(process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput,'node validate-input.mjs <input.json>');
