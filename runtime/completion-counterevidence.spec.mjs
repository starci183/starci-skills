import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalMachine, nextState } from '../skills/route-machine.mjs';
import { recordRouteIssuedTransition } from './route-transition.mjs';
import { evaluateCompletionCounterevidence } from './completion-counterevidence.mjs';
import { createReceipt, fingerprint } from './trace.mjs';

let runSequence=0;
let clockSequence=0;
const now=()=>new Date(Date.UTC(2026,8,1,0,0,clockSequence++)).toISOString();
const causal=()=>({
  priorVerdict:'PASS',
  failedAssumption:'The prior review treated visible spacing as acceptable.',
  missingProof:'No terminal-scroll raster was inspected.',
  cause:'The capture packet omitted the failing boundary state.',
  counterevidenceRef:'feedback://one',
});

function proofLifecycle({missionId,skillId,operatorId,outcome,target,parentId,input,output,aiActivity=null,label}){
  const suffix=`${runSequence}-${label}`;
  const executionRef=aiActivity?.executionRef??`execution://${fingerprint(`execution:${suffix}`).slice(7)}`;
  const context={invocationRef:`invocation://counter-${suffix}`,executionRef};
  const common={missionId,skillId,operatorId,context,input,expectedOutput:{outcome},actualOutput:output,evidenceRefs:output.output.evidenceRefs??[],sourceHeads:['git:counter-proof'],...(aiActivity?{aiActivity}:{})};
  const callReceipt=createReceipt('CALL',{...common,receiptId:`receipt:counter-${suffix}-call`,parentId},{debug:true,writeDebug:()=>{},now});
  const returnReceipt=createReceipt('RETURN',{...common,receiptId:`receipt:counter-${suffix}-return`,parentId:callReceipt.receiptId},{debug:true,writeDebug:()=>{},now});
  const transitionReceipt=createReceipt('TRANSITION',{...common,receiptId:`receipt:counter-${suffix}-transition`,parentId:returnReceipt.receiptId,transitionRule:{outcome,target}},{debug:true,writeDebug:()=>{},now});
  recordRouteIssuedTransition(returnReceipt,transitionReceipt);
  return {callReceipt,returnReceipt,transitionReceipt};
}

function evidence({withProof=false,wrongVisualSkill=null,wrongVisualOperator=null}={}){
  runSequence+=1;
  const missionId=`mission://counterevidence-${runSequence}`;
  const skillId='starci-fe-process';
  const errorReceipt=createReceipt('ERROR',{receiptId:`receipt:counter-${runSequence}-error`,missionId,skillId,error:{claim:'prior PASS contradicted'}},{debug:true,writeDebug:()=>{},now});
  const resumeReceipt=createReceipt('RESUME',{receiptId:`receipt:counter-${runSequence}-resume`,missionId,skillId,parentId:errorReceipt.receiptId,resumeState:{from:'capture-preflight'}},{debug:true,writeDebug:()=>{},now});
  const base={missionId,skillId,errorReceipt,resumeReceipt,affectedEvidenceRefs:['evidence://affected-ui'],priorFailureRecord:causal()};
  if(!withProof)return base;

  const sourceFingerprint=`sha256:${String(runSequence).padStart(64,'0')}`;
  const packetFingerprint=fingerprint({missionId,sourceFingerprint,round:1});
  const auditRef=`.artifacts/counter-${runSequence}/audit.md`;
  const visualSkill=wrongVisualSkill??'starci-fe-process';
  const visualOperator=wrongVisualOperator??'fe/visual-fidelity';
  const visualInput={schemaVersion:7,operatorId:visualOperator,input:{blindReviewPacket:{capturedSourceFingerprint:sourceFingerprint}}};
  const visualOutput={schemaVersion:7,operatorId:visualOperator,output:{outcome:'passed',result:{packetFingerprint,artifactRefs:[auditRef,'evidence://affected-ui']},evidenceRefs:[packetFingerprint,auditRef,'evidence://affected-ui']}};
  const aiActivity=visualOperator==='fe/visual-fidelity'?{kind:'review',model:'gpt-5.6-sol',count:1,executionRef:`execution://${fingerprint(`review:${runSequence}`).slice(7)}`,principalFingerprint:`sha256:${'d'.repeat(64)}`,contextFingerprint:`sha256:${'e'.repeat(64)}`,isolation:'fresh',forkTurns:'none'}:null;
  const visual=proofLifecycle({missionId,skillId:visualSkill,operatorId:visualOperator,outcome:'passed',target:'quality-handoff',parentId:resumeReceipt.receiptId,input:visualInput,output:visualOutput,aiActivity,label:'visual'});
  if(wrongVisualSkill||wrongVisualOperator)return {...base,proofChain:{visual}};

  const chainEvidence=[packetFingerprint,auditRef,'evidence://affected-ui'];
  const qualityInput={schemaVersion:7,operatorId:'quality/delivery-proof',input:{sourceFingerprint}};
  const qualityOutput={schemaVersion:7,operatorId:'quality/delivery-proof',output:{outcome:'pass',evidenceRefs:chainEvidence}};
  const quality=proofLifecycle({missionId,skillId:'starci-quality-assure',operatorId:'quality/delivery-proof',outcome:'pass',target:'complete',parentId:visual.transitionReceipt.receiptId,input:qualityInput,output:qualityOutput,label:'quality'});

  const uatInput={schemaVersion:7,operatorId:'test/uat-result-publish',context:{sourceFingerprint}};
  const uatOutput={schemaVersion:7,operatorId:'test/uat-result-publish',output:{outcome:'passed',evidenceRefs:chainEvidence}};
  const uat=proofLifecycle({missionId,skillId:'starci-uat-verify',operatorId:'test/uat-result-publish',outcome:'passed',target:'complete',parentId:quality.transitionReceipt.receiptId,input:uatInput,output:uatOutput,label:'uat'});
  return {...base,proofChain:{visual,quality,uat}};
}

test('post-completion feedback requires causal ERROR to RESUME evidence before reopening',()=>{
  assert.throws(()=>evaluateCompletionCounterevidence({priorTerminal:true,finding:'unverified'}),/exact owning skill/);
  const result=evaluateCompletionCounterevidence({priorTerminal:true,finding:'unverified',...evidence()});
  assert.equal(result.verdict,'reopened');
  assert.equal(result.nextState,'capture-preflight');
  assert.equal(result.canClose,false);
});

test('a confirmed reusable gap requires the smallest authority update',()=>{
  const result=evaluateCompletionCounterevidence({priorTerminal:true,finding:'confirmed',reusableGap:true,authorityUpdated:false,proofRerun:false,...evidence()});
  assert.equal(result.nextState,'request-compile');
  assert.equal(result.authorityUpdateRequired,true);
});

test('visual-only reproof cannot close, while a fresh FE to Quality to UAT chain can close once',()=>{
  assert.equal(evaluateCompletionCounterevidence({priorTerminal:true,finding:'confirmed',reusableGap:false,proofRerun:false,...evidence()}).nextState,'reapply');
  const missingChain=evidence();
  assert.throws(()=>evaluateCompletionCounterevidence({priorTerminal:true,finding:'confirmed',reusableGap:false,proofRerun:true,...missingChain}),/canonical visual CALL→RETURN→TRANSITION lifecycle/);
  const visualOnly=evidence({withProof:true});
  delete visualOnly.proofChain.quality;
  delete visualOnly.proofChain.uat;
  assert.throws(()=>evaluateCompletionCounterevidence({priorTerminal:true,finding:'confirmed',reusableGap:false,proofRerun:true,...visualOnly}),/canonical quality CALL→RETURN→TRANSITION lifecycle/);
  const reproved=evidence({withProof:true});
  const result=evaluateCompletionCounterevidence({priorTerminal:true,finding:'confirmed',reusableGap:true,authorityUpdated:true,proofRerun:true,...reproved});
  assert.equal(result.canClose,true);
  assert.equal(result.nextState,'complete');
  assert.throws(()=>evaluateCompletionCounterevidence({priorTerminal:true,finding:'confirmed',reusableGap:true,authorityUpdated:true,proofRerun:true,...reproved}),/already consumed/);
});

test('a backend or relabeled backend proof cannot close reopened FE counterevidence',()=>{
  const backendOwned=evidence({withProof:true,wrongVisualSkill:'starci-backend-process',wrongVisualOperator:'be/delivery-proof'});
  assert.throws(()=>evaluateCompletionCounterevidence({priorTerminal:true,finding:'confirmed',reusableGap:false,proofRerun:true,...backendOwned}),/visual closure lifecycle identity mismatch/);
  const relabeledBackend=evidence({withProof:true,wrongVisualOperator:'be/delivery-proof'});
  assert.throws(()=>evaluateCompletionCounterevidence({priorTerminal:true,finding:'confirmed',reusableGap:false,proofRerun:true,...relabeledBackend}),/visual closure lifecycle identity mismatch/);
});

test('the FE terminal router reopens only from the canonical same-mission counterevidence envelope',()=>{
  const proof=evidence();
  const envelope=evaluateCompletionCounterevidence({priorTerminal:true,finding:'unverified',...proof});
  const machine=canonicalMachine('starci-fe-process');
  assert.equal(nextState(machine,'complete',envelope,{},null,proof.missionId),'capture-preflight');
  assert.throws(()=>nextState(machine,'complete',{...envelope},{},null,proof.missionId),/canonical same-mission same-skill counterevidence/);
});
