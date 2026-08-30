import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateCompletionCounterevidence } from './completion-counterevidence.mjs';
import { createReceipt } from './trace.mjs';
import { nextState, routeIssuedTransitionFor, validatedOperatorReturn } from '../skills/route-machine.mjs';
import { validateOutput as validateSemanticOutput } from '../operators/fe/semantic-audit/validate-output.mjs';
import { validateOutput as validateBackendProofOutput } from '../operators/be/delivery-proof/validate-output.mjs';
import fs from 'node:fs';

let sequence=0;
const causal=()=>({priorVerdict:'PASS',failedAssumption:'The prior review treated visible spacing as acceptable.',missingProof:'No terminal-scroll raster was inspected.',cause:'The capture packet omitted the failing boundary state.',counterevidenceRef:'feedback://one'});
const evidence=async(withProof=false, proofSkill='starci-fe-process', proofOperator='fe/semantic-audit')=>{
  sequence+=1;
  const missionId=`mission://counterevidence-${sequence}`;
  const skillId='starci-fe-process';
  const errorReceipt=createReceipt('ERROR',{receiptId:`receipt:counter-error-${sequence}`,missionId,skillId,error:{claim:'prior PASS contradicted'}},{debug:true,now:()=>`2026-08-30T00:0${sequence}:00.000Z`});
  const resumeReceipt=createReceipt('RESUME',{receiptId:`receipt:counter-resume-${sequence}`,missionId,skillId,parentId:errorReceipt.receiptId,resumeState:{from:'capture'}},{debug:true,now:()=>`2026-08-30T00:0${sequence}:01.000Z`});
  if(!withProof)return {missionId,skillId,errorReceipt,resumeReceipt,priorFailureRecord:causal()};
  const executionRef=`execution://${sequence.toString(16).padStart(64,'0')}`;
  const semanticInput={schemaVersion:7,operatorId:'fe/semantic-audit',context:{authorityRefs:['authority://proof'],evidenceRefs:['render://proof'],uiKnowledgeId:'fe.ui'},input:{targetRef:'surface://proof',constraints:[]}};
  const semanticOutput={schemaVersion:7,operatorId:'fe/semantic-audit',output:{outcome:'passed',result:{summary:'Latest evidence passed.',artifactRefs:['artifact://proof'],checks:[{checkRef:'check://proof',subjectRef:'surface://proof',verdict:'passed',observation:'The affected evidence is now coherent.',authorityRef:'authority://proof',evidenceRef:'render://proof'}]},gaps:[],evidenceRefs:['render://proof'],handoff:null}};
  const backendInput={schemaVersion:7,operatorId:'be/delivery-proof',context:{contextRefs:['context://proof'],sourceRefs:['source://proof']},input:{project:'starci',objectiveRef:'objective://proof',sourceFingerprint:`sha256:${'a'.repeat(64)}`}};
  const backendOutput={schemaVersion:7,operatorId:'be/delivery-proof',output:{outcome:'ready',resultRef:'artifact://backend-proof',evidenceRefs:['render://proof'],findings:[],reason:null}};
  const inputDocument=proofOperator==='be/delivery-proof'?backendInput:semanticInput;
  const outputDocument=proofOperator==='be/delivery-proof'?backendOutput:semanticOutput;
  const validateOutput=proofOperator==='be/delivery-proof'?validateBackendProofOutput:validateSemanticOutput;
  const outcome=outputDocument.output.outcome;
  const common={missionId,skillId:proofSkill,operatorId:proofOperator,context:{invocationRef:`invocation://counter-proof-${sequence}`,executionRef},input:inputDocument,expectedOutput:{outcome},actualOutput:outputDocument,evidenceRefs:['render://proof'],transitionRule:{outcome,target:'complete'},...(proofOperator==='fe/semantic-audit'?{aiActivity:{kind:'review',model:'gpt-5.6-sol',count:1,executionRef,principalFingerprint:`sha256:${'b'.repeat(64)}`,contextFingerprint:`sha256:${'c'.repeat(64)}`,isolation:'fresh',forkTurns:'none'}}:{})};
  const callReceipt=createReceipt('CALL',{...common,receiptId:`receipt:counter-call-${sequence}`,parentId:resumeReceipt.receiptId},{debug:true,now:()=>`2026-08-30T00:0${sequence}:02.000Z`});
  const returnReceipt=createReceipt('RETURN',{...common,receiptId:`receipt:counter-return-${sequence}`,parentId:callReceipt.receiptId},{debug:true,now:()=>`2026-08-30T00:0${sequence}:03.000Z`});
  const routeEnvelope=await validatedOperatorReturn({machineId:proofSkill,stateId:'proof',operatorId:proofOperator,input:inputDocument,outputDocument,validateOutput,returnReceipt});
  const proofMachine={id:proofSkill,states:{proof:{kind:'operator',ref:proofOperator,on:[{when:{outputEquals:{outcome}},target:'complete'}]},complete:{kind:'terminal',result:'complete'}}};
  assert.equal(nextState(proofMachine,'proof',routeEnvelope,inputDocument,routeEnvelope.invocationRef,missionId),'complete');
  const transitionReceipt=routeIssuedTransitionFor(returnReceipt);
  return {missionId,skillId,errorReceipt,resumeReceipt,proofLifecycle:{callReceipt,returnReceipt,transitionReceipt},affectedEvidenceRefs:['render://proof'],priorFailureRecord:causal()};
};

test('post-completion feedback requires causal ERROR to RESUME evidence before reopening',async()=>{
  assert.throws(()=>evaluateCompletionCounterevidence({priorTerminal:true,finding:'unverified'}),/exact owning skill/);
  const result=evaluateCompletionCounterevidence({priorTerminal:true,finding:'unverified',...await evidence()});
  assert.equal(result.verdict,'reopened'); assert.equal(result.nextState,'capture'); assert.equal(result.canClose,false);
});

test('a confirmed reusable gap requires the smallest authority update',async()=>{
  const result=evaluateCompletionCounterevidence({priorTerminal:true,finding:'confirmed',reusableGap:true,authorityUpdated:false,proofRerun:false,...await evidence()});
  assert.equal(result.nextState,'finding-classify'); assert.equal(result.authorityUpdateRequired,true);
});

test('confirmed or disproved feedback cannot close without a fresh canonical proof transition',async()=>{
  assert.equal(evaluateCompletionCounterevidence({priorTerminal:true,finding:'confirmed',reusableGap:false,proofRerun:false,...await evidence()}).nextState,'repair');
  const missingLifecycle=await evidence();
  assert.throws(()=>evaluateCompletionCounterevidence({priorTerminal:true,finding:'confirmed',reusableGap:false,proofRerun:true,...missingLifecycle}),/canonical CALL→RETURN→TRANSITION proof lifecycle/);
  const reproved=await evidence(true);
  const result=evaluateCompletionCounterevidence({priorTerminal:true,finding:'confirmed',reusableGap:true,authorityUpdated:true,proofRerun:true,...reproved});
  assert.equal(result.canClose,true); assert.equal(result.nextState,'complete');
  assert.throws(()=>evaluateCompletionCounterevidence({priorTerminal:true,finding:'confirmed',reusableGap:true,authorityUpdated:true,proofRerun:true,...reproved}),/already consumed/);
});

test('a backend proof lifecycle cannot close reopened FE counterevidence',async()=>{
  const backendOwned=await evidence(true,'starci-backend-process');
  assert.throws(()=>evaluateCompletionCounterevidence({priorTerminal:true,finding:'confirmed',reusableGap:false,proofRerun:true,...backendOwned}),/owning skill/);
  const relabeledBackend=await evidence(true,'starci-fe-process','be/delivery-proof');
  assert.throws(()=>evaluateCompletionCounterevidence({priorTerminal:true,finding:'confirmed',reusableGap:false,proofRerun:true,...relabeledBackend}),/not declared by the owning Skill/);
});

test('the FE terminal router reopens only from the canonical same-mission counterevidence envelope',async()=>{
  const proof=await evidence();
  const envelope=evaluateCompletionCounterevidence({priorTerminal:true,finding:'unverified',...proof});
  const machine=JSON.parse(fs.readFileSync(new URL('../skills/starci-fe-process/machine.json',import.meta.url),'utf8'));
  assert.equal(nextState(machine,'complete',envelope,{},null,proof.missionId),'capture');
  assert.throws(()=>nextState(machine,'complete',{...envelope}, {},null,proof.missionId),/canonical same-mission same-skill counterevidence/);
});
