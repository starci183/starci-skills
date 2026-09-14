import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileFailedLaunchLease,reconcileLegacyCoordinatorLease,refundLegacyCoordinatorProbations,resetReviewEpoch,settleSkippedGenerationLeases} from '../kernel/kernel.mjs';

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

test('failed launch reconciliation requires exact stopped worker and released owned terminal',()=>{
  const lease={jobId:'lease',generation:4},op={id:'verify',status:'blocked',v6Lease:lease,launch:{task:'task',dispatch:null}},events=[],state={run:'run',worktree:'D:/repo',engine:{journalFile:'journal'}},receipt={dispatch:{id:'ctx',task_id:'task',run_id:'run',assignee_handle:'term',status:'failed',last_failure:'agent_prompt_stalled'},worker:{dispatch_id:'ctx',state:'failed',stage:'dispatch_input'},terminal:{handle:'term',connected:false},observation:{exactWorker:true,status:'exited'},terminalResource:{originDispatchId:'ctx',ownerDispatchId:'ctx',ownershipState:'released',releaseState:'released'}};
  const orca={invoke:name=>name==='dispatch-show'?{outcome:'ok',receipt:{result:{dispatch:receipt.dispatch}}}:{outcome:'ok',receipt:{result:receipt}}},store={appendEvent:event=>events.push(event)},settle=()=>[{ok:true}];
  const observeLaunch=()=>({kind:'operation-launch-observed'});assert.equal(reconcileFailedLaunchLease(state,op,{orca,store,settle,observeLaunch}).ok,true);assert.equal(op.v6WorkerSettled,true);assert.equal(op.launch.dispatch,'ctx');assert.equal(events[0].event,'failed-launch-stopped-proved');
  const unknown={...structuredClone(op),v6Lease:lease,launch:{task:'task',dispatch:null}};delete unknown.v6WorkerSettled;receipt.terminalResource.releaseState='retained';assert.match(reconcileFailedLaunchLease(state,unknown,{orca,store,settle,observeLaunch}).reason,/not proven exited/);assert.equal(unknown.v6WorkerSettled,undefined);assert.match(reconcileFailedLaunchLease(state,unknown,{orca,store,settle,observeLaunch:()=>null}).reason,/not bound/);
});

test('public retry refund binds historical runtime to the cancelled durable operation job',()=>{
  const op={id:'verify',kind:'review.verify'},state={id:'wf',ops:[op]},store={readEvents:()=>[{event:'legacy-coordinator-no-effect-proved',op:'verify',jobId:'old',generation:3,pin:'pin'}]},seen=[];
  const runtime={journal:{getJob:()=>({job_id:'old',workflow_id:'wf',op_id:'verify',attempt:1,generation:3,kind:'operation',role:'verify',status:'cancelled',payload:{runtime:'gpt-6-astra'}})},refundUnbegunProbation:(actual,proof,identity)=>{seen.push({actual,proof,identity});return {ok:true,code:'probation-refunded'};}};
  assert.deepEqual(refundLegacyCoordinatorProbations(store,state,runtime),[{jobId:'old',code:'probation-refunded'}]);assert.equal(seen[0].proof.runtimeId,'gpt-6-astra');assert.equal(seen[0].identity.probationRuntime,'gpt-6-astra');assert.equal(seen[0].identity.generation,3);
});
