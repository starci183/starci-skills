import { validatorFor, runValidatorCli } from '../../operators/validation.mjs';
import { loadScopePolicy } from '../../runtime/scope-policy.mjs';
import { validatePublicSkillReceipt } from '../receipt-consumption.mjs';
import { isRouteIssuedTransitionReceipt, routeIssuedTransitionFor } from '../../runtime/route-transition.mjs';

const scopePolicy=loadScopePolicy();
const changeLevelKey='frontend.ux-ui.change-level';
const ownerCeilingKey='frontend.layout.owner-ceiling';
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
  }
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
    errors.push(...validatePublicSkillReceipt(value.returnReceipt,{allowedTypes:['RETURN','RESUME'],expectedMissionId:value.runId,expectedSkillId,consume:false}));
    if(value.resume===null) errors.push('returnReceipt requires matching resume metadata');
    else {
      if(value.resume.receiptRef!==value.returnReceipt.receiptId) errors.push('resume receiptRef does not identify returnReceipt');
      if(value.resume.missionRef!==value.runId) errors.push('resume missionRef must equal the active runId');
      if(value.resume.resumeState!==value.returnReceipt.trace?.resumeState) errors.push('resume state does not match returnReceipt trace');
      if(value.resume.resumeState==='uat-return') {
        const transition=routeIssuedTransitionFor(value.returnReceipt);
        if(!isRouteIssuedTransitionReceipt(transition)||transition.skillId!=='starci-uat-verify'||transition.missionId!==value.runId||transition.trace?.transitionRule?.target!=='complete') errors.push('uat-return requires UAT canonical route-issued final transition evidence');
      }
    }
    if(errors.length===0) errors.push(...validatePublicSkillReceipt(value.returnReceipt,{allowedTypes:['RETURN','RESUME'],expectedMissionId:value.runId,expectedSkillId}));
  }
  return errors;
});
if(process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput,'node validate-input.mjs <input.json>');
