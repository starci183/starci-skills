import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileLegacyCoordinatorLease,resetReviewEpoch,settleSkippedGenerationLeases} from '../kernel/kernel.mjs';

test('generation retry supersedes only unanswered derived review questions and clears stale review counters',()=>{
  const events=[],store={appendEvent:event=>events.push(event)},accepted={id:'accepted-review',kind:'review.verify',status:'done',reports:[{outcome:'done'}]};
  const repair={id:'repair-25',origin:'repair',status:'paused',waitingFor:'ask-15',reports:[],contractBytes:0,reviewGeneration:3};
  const ask={id:'ask-15',origin:'ask',status:'ready',reports:[],question:{from:'repair-25',prepared:true}};
  const state={engine:{generation:3},ledger:[{id:'component',status:'implemented'}],verifyRounds:{component:4},verifyFindings:{component:['old finding']},verifyEscalations:{component:{count:1}},ops:[accepted,repair,ask],
    needUser:[{op:'ask-15',kind:'decision'},{op:'unrelated',kind:'decision'}],provisional:[{op:'ask-15'},{op:'other'}]};
  assert.deepEqual(resetReviewEpoch(store,state),[{repair:'repair-25',ask:'ask-15'}]);
  assert.equal(repair.refusal,'superseded');assert.equal(ask.refusal,'superseded');assert.equal(accepted.status,'done');assert.deepEqual(accepted.reports,[{outcome:'done'}]);
  assert.deepEqual(state.verifyRounds,{});assert.deepEqual(state.verifyFindings,{});assert.deepEqual(state.verifyEscalations,{});
  assert.deepEqual(state.reviewEpochs[0].findings,{component:['old finding']});
  assert.deepEqual(state.needUser,[{op:'unrelated',kind:'decision'}]);assert.deepEqual(state.provisional,[{op:'other'}]);
});

test('answered owner decisions and launched repairs survive a review epoch change',()=>{
  const store={appendEvent(){}},repair={id:'repair',origin:'repair',status:'paused',waitingFor:'ask',reports:[],contractBytes:100,reviewGeneration:2};
  const ask={id:'ask',origin:'ask',status:'done',reports:[{outcome:'done'}],question:{from:'repair'}};
  const state={engine:{generation:3},verifyRounds:{x:3},verifyFindings:{x:['old']},verifyEscalations:{},ops:[repair,ask]};
  assert.deepEqual(resetReviewEpoch(store,state),[]);assert.equal(repair.refusal,undefined);assert.equal(ask.status,'done');
});

for(const [field,value] of [['answer',{choice:'1'}],['ownerAnswer',{receiptId:'owner-receipt'}],['ownerContinuationReceipt','owner-receipt']])
  test(`a ready derived question carrying ${field} is never superseded`,()=>{
    const repair={id:'repair',origin:'repair',status:'paused',waitingFor:'ask',reports:[],reviewGeneration:3};
    const ask={id:'ask',origin:'ask',status:'ready',reports:[],question:{from:'repair',prepared:true},[field]:value};
    const state={engine:{generation:3},ledger:[{id:'component',status:'implemented'}],ops:[repair,ask],verifyRounds:{component:3},verifyFindings:{component:['old']},verifyEscalations:{}};
    assert.deepEqual(resetReviewEpoch({appendEvent(){}},state),[]);assert.equal(ask.status,'ready');assert.equal(repair.status,'paused');
  });

test('a pending derived question with an actual owner answer and continuation receipt is preserved',()=>{
  const repair={id:'repair',origin:'repair',status:'paused',waitingFor:'ask',reports:[],reviewGeneration:3,ownerContinuationReceipts:['owner-receipt']};
  const ask={id:'ask',origin:'ask',status:'pending',reports:[],question:{from:'repair',prepared:true},answer:{choice:'2'},ownerContinuationReceipt:'owner-receipt'};
  const state={engine:{generation:3},ledger:[],ops:[repair,ask],verifyRounds:{},verifyFindings:{},verifyEscalations:{}};
  assert.deepEqual(resetReviewEpoch({appendEvent(){}},state),[]);assert.equal(ask.status,'pending');assert.equal(repair.status,'paused');
});

test('accepted group review history stays active while the retired epoch is archived',()=>{
  const state={engine:{generation:4},ledger:[{id:'accepted',status:'verified'}],ops:[],verifyRounds:{accepted:2},verifyFindings:{accepted:['historical accepted review']},verifyEscalations:{accepted:{count:1}}};
  resetReviewEpoch({appendEvent(){}},state);assert.deepEqual(state.verifyRounds,{accepted:2});assert.deepEqual(state.verifyFindings,{accepted:['historical accepted review']});
  assert.deepEqual(state.reviewEpochs[0].rounds,{accepted:2});
});

test('generation retry cannot skip a blocked operation whose durable writer lease is unsettled',()=>{
  const lease={jobId:'job',leaseToken:'token'},state={engine:{journalFile:'journal'},ops:[{id:'blocked',status:'blocked',v6Lease:lease,v6WorkerSettled:false}]};
  assert.throws(()=>settleSkippedGenerationLeases(state,{settle:()=>{throw Error('must not settle')}}),/unsettled durable lease/);
  state.ops[0].v6WorkerSettled=true;assert.deepEqual(settleSkippedGenerationLeases(state,{settle:()=>{throw Error('retryable settled operation is handled by the normal retry loop')}}),[]);
  assert.equal(state.ops[0].v6Lease,lease);
});

test('legacy coordinator reconciliation requires sealed pre-task control flow and a live mismatch',()=>{
  const message='Operation can be launched only by the exact Workflow Monitor bound as nested Run coordinator',events=[],lease={jobId:'job',leaseToken:'token',workflowId:'wf',opId:'verify',generation:3},baseOp={id:'verify',status:'blocked',refusal:'effect-unknown',v6Lease:lease,launch:{task:null,dispatch:null,stopReason:message}},state={id:'wf',run:'run',from:'old',worktree:'D:/repo',engine:{generation:3,journalFile:'journal',runtimePin:{root:'D:/pin',digest:'a'.repeat(64)}},ops:[]};
  const source=Buffer.from('reviewed bytes'),reviewed=()=> '34c167c6fb5150b552992350ff43f22c36e935af03b93b91e661cf4e62479801',store={appendEvent:event=>events.push(event)},mismatch={invoke:()=>({outcome:'ok',receipt:{result:{run:{id:'run',coordinator_handle:'new'}}}})},settle=()=>[{ok:true}];
  const accepted=reconcileLegacyCoordinatorLease(state,structuredClone(baseOp),{orca:mismatch,store,verifyPin:()=>({ok:true}),readFile:()=>source,hashSource:reviewed,settle});assert.equal(accepted.ok,true);assert.equal(events[0].event,'legacy-coordinator-no-effect-proved');
  assert.match(reconcileLegacyCoordinatorLease(state,structuredClone(baseOp),{orca:mismatch,store,verifyPin:()=>({ok:false,reason:'changed'}),readFile:()=>source,hashSource:reviewed,settle}).reason,/pin rejected/);
  assert.match(reconcileLegacyCoordinatorLease(state,structuredClone(baseOp),{orca:mismatch,store,verifyPin:()=>({ok:true}),readFile:()=>"orca.invoke('task-create'); "+message,settle}).reason,/not the reviewed/);
  assert.match(reconcileLegacyCoordinatorLease(state,{...structuredClone(baseOp),launch:{task:null,dispatch:null,stopReason:'some failure'}},{orca:mismatch,store,verifyPin:()=>({ok:true}),readFile:()=>source,hashSource:reviewed,settle}).reason,/unrecognized/);
  assert.match(reconcileLegacyCoordinatorLease(state,{...structuredClone(baseOp),dispatch:'dispatch-1'},{orca:mismatch,store,verifyPin:()=>({ok:true}),readFile:()=>source,hashSource:reviewed,settle}).reason,/launch-effect identity/);
  const matching={invoke:()=>({outcome:'ok',receipt:{result:{run:{id:'run',coordinator_handle:'old'}}}})};assert.match(reconcileLegacyCoordinatorLease(state,structuredClone(baseOp),{orca:matching,store,verifyPin:()=>({ok:true}),readFile:()=>source,hashSource:reviewed,settle}).reason,/still matches/);
});
