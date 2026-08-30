import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validatorFor } from './validation.mjs';
import { validateInput as validateBusiness } from '../skills/starci-business-process/validate-input.mjs';
import { validateInput as validateBackend } from '../skills/starci-backend-process/validate-input.mjs';
import { validateOutput as validateBackendOutput } from '../skills/starci-backend-process/validate-output.mjs';
import { validateInput as validateDiagnose } from '../skills/starci-workflow-diagnose/validate-input.mjs';
import { createReceipt } from '../runtime/trace.mjs';

const backendMachine=JSON.parse(readFileSync(new URL('../skills/starci-backend-process/machine.json',import.meta.url)));
const nextState=(machine,stateId,event,input)=>{
 const edge=machine.states[stateId].on.find(({when})=>{
  const values=when.outputEquals??when.inputEquals??{};
  const root=when.outputEquals?event.output??event:input;
  return Object.entries(values).every(([path,expected])=>path.split('.').reduce((value,key)=>value?.[key],root)===expected);
 });
 return edge?.target;
};
const receiptValidator=validatorFor(new URL('../runtime/receipt.schema.json',import.meta.url));
let receiptSequence=0;
const receipt=(type,id,parentId,skillId='starci-backend-process',overrides={})=>createReceipt(type,{
 receiptId:`receipt:${id}-${++receiptSequence}`,type,missionId:'mission-1',skillId,operatorId:null,parentId,childId:overrides.childId??'child-1',payloadRef:overrides.payloadRef??'artifact:backend-proof',sourceHeads:overrides.sourceHeads??['git:abc1234'],resumeState:overrides.resumeState??'implement',actualOutput:overrides.actualOutput??null,
},{debug:true,now:()=>`2026-08-29T00:00:${String(receiptSequence).padStart(2,'0')}.000Z`});
const chain=()=>{const call=receipt('CALL','call',null);const ret=receipt('RETURN','return',call.receiptId);const resume=receipt('RESUME','resume',ret.receiptId);return {call,ret,resume};};
function input(skillId,intentMode,resumeTarget=null,receiptValue=null,history=[],write=false){
 const prereqs={implement:['approved-backend-contract:1','frozen-source-boundary:1','business-head:1','architecture-realization:1'],publish:['approved-business-model:1'],diagnose:['frozen-workflow-evidence:1','expected-binding:1']}[intentMode==='resume'?resumeTarget:intentMode]??[];
 const scope={status:'frozen',unit:'feature',targetRefs:['target:1'],inclusionRefs:[],exclusionRefs:[],writeRoots:write?['src/modules']:[],externalMutation:write,approvalRef:write?'receipt:approval':null,completionProofRefs:['proof:mission'],dimensions:[],ambiguityRefs:[]};
 return {schemaVersion:7,runId:'run-1',project:'starci',selection:{analyzerVersion:2,skillId,confidence:'exact',interactionPolicy:'ask-only-when-stuck',activeInputRefs:['request:1'],passiveContextRefs:[]},requestRef:'request:1',artifactRefs:[],evidenceRefs:['evidence:1'],scope,options:{intentMode,resumeTarget,prerequisiteRefs:prereqs,receipt:receiptValue,receiptHistory:history}};
}

test('canonical runtime receipt validates and executable RESUME re-enters prerequisites',()=>{
 const {call,ret,resume}=chain();
 for(const r of [call,ret,resume])assert.deepEqual(receiptValidator(r),{valid:true,errors:[]});
 const value=input('starci-backend-process','resume','implement',resume,[call,ret],true);
 assert.deepEqual(validateBackend(value),{valid:true,errors:[]});
 assert.equal(nextState(backendMachine,'select-intent',{},value),'resume-select');
 assert.equal(nextState(backendMachine,'resume-select',{},value),'bind-implement');
});

test('RETURN chain binds parent child payload and source heads',()=>{
 const call=receipt('CALL','mismatch-call',null);
 const ret=receipt('RETURN','mismatch-return',call.receiptId,'starci-backend-process',{payloadRef:'artifact:other'});
 const resume=receipt('RESUME','mismatch-resume',ret.receiptId);
 const result=validateBackend(input('starci-backend-process','resume','implement',resume,[call,ret],true));
 assert.match(result.errors.join('\n'),/payloadRef binding mismatch/);
 const childReturn=receipt('RETURN','child-return',call.receiptId,'starci-backend-process',{childId:'child-2'});
 const childResume=receipt('RESUME','child-resume',childReturn.receiptId);
 assert.match(validateBackend(input('starci-backend-process','resume','implement',childResume,[call,childReturn],true)).errors.join('\n'),/child mismatch/);
});

test('mutation intent requires approval and bounded roots while read-only intents reject them',()=>{
 const missing=input('starci-backend-process','implement',null,null,[],false);
 assert.match(validateBackend(missing).errors.join('\n'),/mutation intent requires/);
 const business=input('starci-business-process','publish',null,null,[],true);
 business.scope.writeRoots=['src'];
 assert.match(validateBusiness(business).errors.join('\n'),/flat .worktrees\/businesses/);
 business.scope.writeRoots=['.worktrees/businesses/profile'];
 assert.deepEqual(validateBusiness(business),{valid:true,errors:[]});
});

test('workflow diagnosis is immutable',()=>{
 const value=input('starci-workflow-diagnose','diagnose');
 assert.deepEqual(validateDiagnose(value),{valid:true,errors:[]});
 value.scope.writeRoots=['src']; value.scope.externalMutation=true; value.scope.approvalRef='receipt:approval';
 assert.match(validateDiagnose(value).errors.join('\n'),/read-only/);
});

test('direct implementation cannot skip prerequisites',()=>{
 const value=input('starci-backend-process','implement',null,null,[],true);
 value.options.prerequisiteRefs=['approved-backend-contract:1'];
 assert.match(validateBackend(value).errors.join('\n'),/frozen-source-boundary|business-head|architecture-realization/);
});

test('three unchanged runtime fingerprints are no-progress',()=>{
 const history=['one','two','three'].map((id)=>receipt('CALL',`stalled-${id}`,null,'starci-backend-process',{actualOutput:{status:'unchanged'}}));
 assert.match(validateBackend(input('starci-backend-process','implement',null,null,history,true)).errors.join('\n'),/no-progress/);
});

test('handoff and completion require canonical typed CALL and RETURN receipts',()=>{
 const call=receipt('CALL','out-call',null);
 const base={schemaVersion:7,runId:'run-1',skillId:'starci-backend-process',result:'handoff',finalState:'peer-call',state:{status:'handoff',code:'backend-peer-call',retryable:false,terminalState:'peer-call'},handoffReceipt:call,receiptRefs:[call.receiptId],findings:[],cleanup:{scratchRefs:[],retention:'until-skill-terminal',purgeAt:'skill-terminal'}};
 assert.deepEqual(validateBackendOutput(base),{valid:true,errors:[]});
 const ret=receipt('RETURN','out-return',call.receiptId);
 const complete={...base,result:'complete',finalState:'complete',state:{status:'completed',code:'backend-complete',retryable:false,terminalState:'complete'},handoffReceipt:ret};
 assert.deepEqual(validateBackendOutput(complete),{valid:true,errors:[]});
 const invalidComplete={...complete,handoffReceipt:call};
 assert.match(validateBackendOutput(invalidComplete).errors.join('\n'),/RETURN/);
});

test('selection requires analyzer v2 and ask-only-when-stuck',()=>{
 const value=input('starci-backend-process','implement',null,null,[],true);
 assert.deepEqual(validateBackend(value),{valid:true,errors:[]});
 value.selection.analyzerVersion=1;
 assert.match(validateBackend(value).errors.join('\n'),/expected 2/);
 value.selection.analyzerVersion=2;
 value.selection.interactionPolicy='always-ask';
 assert.match(validateBackend(value).errors.join('\n'),/ask-only-when-stuck/);
});
