import { validatorFor, runValidatorCli } from '../../operators/validation.mjs';
import { validatePublicSkillReceipt } from '../receipt-consumption.mjs';
export const validateInput=validatorFor(new URL('./input.schema.json',import.meta.url),(value)=>{
 const errors=[];
 if(value.returnReceipt===null){
  if(value.receiptType!=='NONE')errors.push('receiptType must be NONE when returnReceipt is null');
  if(value.resume!==null)errors.push('resume requires one canonical returnReceipt');
 }else{
  if(value.receiptType!==value.returnReceipt.type)errors.push('receiptType must match the canonical returnReceipt type');
  errors.push(...validatePublicSkillReceipt(value.returnReceipt,{allowedTypes:['RETURN','RESUME'],expectedMissionId:value.runId,expectedSkillId:value.resume?.skillId??null,consume:false}));
  if(value.resume===null)errors.push('returnReceipt requires matching resume metadata');
  else {
   if(value.resume.receiptRef!==value.returnReceipt.receiptId)errors.push('resume receiptRef does not identify returnReceipt');
   if(value.resume.missionRef!==value.runId)errors.push('resume missionRef must equal the active runId');
  }
  if(errors.length===0)errors.push(...validatePublicSkillReceipt(value.returnReceipt,{allowedTypes:['RETURN','RESUME'],expectedMissionId:value.runId,expectedSkillId:value.resume.skillId}));
 }
 return errors;
});
if(process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput,'node validate-input.mjs <input.json>');
