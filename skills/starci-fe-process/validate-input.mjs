import { validatorFor, runValidatorCli } from '../../operators/validation.mjs';
import { loadScopePolicy } from '../../runtime/scope-policy.mjs';
import { validatePublicSkillReceipt } from '../receipt-consumption.mjs';
import { isRouteIssuedTransitionReceipt, routeIssuedTransitionFor } from '../../runtime/route-transition.mjs';

const scopePolicy=loadScopePolicy();
const changeLevelKey='frontend.ux-ui.change-level';
export const validateInput=validatorFor(new URL('./input.schema.json',import.meta.url),(value)=>{
  const errors=[];
  const matches=value.scope.dimensions.filter((dimension)=>dimension.key===changeLevelKey);
  if(matches.length!==1) errors.push(`scope requires exactly one ${changeLevelKey} dimension`);
  else if(!scopePolicy.registeredDimensions[changeLevelKey].includes(matches[0].value)) {
    errors.push(`${changeLevelKey} must be refine, reconstruct, or new`);
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
