import test from 'node:test';
import assert from 'node:assert/strict';
import {buildManagerSnapshot,validateManagerDecision,MANAGER_DECISION} from '../kernel/manager.mjs';
import {coordinateManagedWorkflow,activatePendingOps,verificationCandidates,workflowModelConfigRoot} from '../kernel/kernel.mjs';

const state=()=>({id:'wf',job:'Ship approved work',definitionOfDone:['proof passes'],iterations:4,needUser:[],ledger:[],
  engine:{generation:2,coordination:'agent-v1',manager:{}},ops:[
    {id:'a',kind:'backend.implement',status:'ready',attempt:1,dependsOn:[],ledgerIds:[],checks:[]},
    {id:'b',kind:'backend.implement',status:'ready',attempt:1,dependsOn:[],ledgerIds:[],checks:[]} ]});

test('enrolled model configuration is read from the sealed pin instead of mutable host settings',()=>{
  assert.equal(workflowModelConfigRoot({host:'host',engine:{schema:'starci/engine@1',runtimePin:{root:'sealed'}}}),'sealed');
  assert.equal(workflowModelConfigRoot({host:'host'}),'host');
});

test('a persisted prelaunch reservation continues mechanically without spending another manager decision',()=>{
  const current=state(),reserved=current.ops[0];reserved.lease={jobId:'job-a'};let called=0;
  const result=coordinateManagedWorkflow({saveState(){},appendEvent(){}},current,{engine:{reservationPhase:op=>op===reserved?{phase:'reserved',runtime:'gpt-5.6-sol',target:'gpt-5.6-sol'}:{phase:'absent'}},manageWorkflow(){called+=1;throw Error('manager must not rerank a persisted reservation');}});
  assert.deepEqual(result.dispatch,['a']);assert.equal(result.continuation,true);assert.equal(called,0);
});

test('manager snapshot identity is stable while semantics do not change and stale or invented actions fail',()=>{
  const current=state(),actions=[{id:'dispatch:a',type:'dispatch',opId:'a',preconditions:['status:a:ready'],summary:'dispatch a',contextRefIds:[]}];
  const first=buildManagerSnapshot({state:current,actions});current.engine.manager={version:first.version,basisDigest:first.basisDigest};
  current.iterations+=10;const replay=buildManagerSnapshot({state:current,actions});
  assert.deepEqual([replay.version,replay.digest,replay.decisionId],[first.version,first.digest,first.decisionId]);
  const valid={schema:MANAGER_DECISION,workflowId:'wf',generation:2,version:first.version,digest:first.digest,decisionId:first.decisionId,basisDigest:first.basisDigest,orderedActionIds:['dispatch:a'],rationale:'a unlocks progress'};
  assert.equal(validateManagerDecision(valid,first).ok,true);
  assert.equal(validateManagerDecision({...valid,orderedActionIds:['dispatch:invented']},first).ok,false);
  assert.equal(validateManagerDecision({...valid,digest:'stale'},first).ok,false);
});

test('agent coordination dispatches only the selected executable action and persists the bound decision',()=>{
  const current=state(),events=[],store={saveState:()=>{},appendEvent:event=>events.push(event)};
  const ctx={engine:{},manageWorkflow:snapshot=>({schema:MANAGER_DECISION,workflowId:snapshot.workflowId,generation:snapshot.generation,
    version:snapshot.version,digest:snapshot.digest,decisionId:snapshot.decisionId,basisDigest:snapshot.basisDigest,orderedActionIds:['dispatch:b'],rationale:'choose b'})};
  const result=coordinateManagedWorkflow(store,current,ctx);
  assert.deepEqual(result.dispatch,['b']);assert.equal(current.ops[0].status,'ready');assert.equal(current.ops[1].status,'ready');
  assert.deepEqual(current.engine.manager.lastActions,['dispatch:b']);assert.equal(current.engine.manager.lastRationale,'choose b');assert.equal(events.at(-1).event,'manager-applied');assert.equal(events.at(-1).rationale,'choose b');
});

test('invalid manager output causes an explicit incident and never falls back to dispatching every ready op',()=>{
  const current=state(),events=[],store={saveState:()=>{},appendEvent:event=>events.push(event)};
  const ctx={engine:{},manageWorkflow:snapshot=>({schema:MANAGER_DECISION,workflowId:snapshot.workflowId,generation:snapshot.generation,
    version:snapshot.version,digest:snapshot.digest,decisionId:snapshot.decisionId,basisDigest:snapshot.basisDigest,orderedActionIds:['dispatch:not-offered'],rationale:'invent'})};
  const result=coordinateManagedWorkflow(store,current,ctx);
  assert.deepEqual(result.dispatch,[]);assert.equal(result.incident,true);assert.equal(current.engine.manager.incident.kind,'manager-invalid');assert.equal(current.engine.manager.lastRationale,undefined);
});

test('a durable pending manager turn selects no work and remains replayable',()=>{
  const current=state(),events=[],store={saveState:()=>{},appendEvent:event=>events.push(event)};
  const pending=Object.assign(new Error('pending'),{code:'STARCI_JOB_PENDING',job:{identity:{jobId:'manager-job'}}});
  const result=coordinateManagedWorkflow(store,current,{engine:{},manageWorkflow:()=>{throw pending;}});
  assert.deepEqual(result,{pending:true,dispatch:[]});assert.equal(current.engine.manager.pendingDecisionId.startsWith('manager-'),true);
  assert.equal(events.at(-1).event,'manager-pending');assert.equal(current.ops.every(op=>op.status==='ready'),true);
});

const recorder=()=>({saveState:()=>{},appendEvent:()=>{}});
const choose=snapshot=>({...Object.fromEntries(['workflowId','generation','version','digest','decisionId','basisDigest'].map(key=>[key,snapshot[key]])),schema:MANAGER_DECISION,orderedActionIds:snapshot.actions.map(action=>action.id),rationale:'choose available work'});

test('pending operations are activated before the first manager decision; an unknown dependency is not completion',()=>{
  const current=state();current.ops[0].status='done';current.ops[1].status='pending';current.ops[1].dependsOn=['a'];
  let offered=[];const result=coordinateManagedWorkflow(recorder(),current,{manageWorkflow:snapshot=>{offered=snapshot.actions.map(action=>action.id);return choose(snapshot);}});
  assert.deepEqual(offered,['dispatch:b']);assert.deepEqual(result.dispatch,['b']);
  current.ops[1].status='pending';current.ops[1].dependsOn=['missing'];activatePendingOps(recorder(),current);assert.equal(current.ops[1].status,'pending');
});

test('healthy active work and owner-only waits never spend manager no-progress rounds',()=>{
  const current=state();let now=0,calls=0;current.ops[0].status='running';
  const ctx={now:()=>now,manageWorkflow:snapshot=>{calls++;return choose(snapshot);}};
  coordinateManagedWorkflow(recorder(),current,ctx);for(let i=0;i<20;i++){now+=60001;coordinateManagedWorkflow(recorder(),current,ctx);}
  assert.equal(calls,1);assert.equal(current.engine.manager.noProgressRound,0);assert.equal(current.engine.manager.incident,null);
  current.ops=[{id:'owner',kind:'decision.prepare',status:'running',ownerRequest:true,dependsOn:[]}];
  coordinateManagedWorkflow(recorder(),current,ctx);assert.equal(calls,1);
});

test('unproductive executable work receives bounded timed reconsideration, not a new model call per tick',()=>{
  const current=state();let now=0,calls=0;const ctx={now:()=>now,manageWorkflow:snapshot=>{calls++;return choose(snapshot);}};
  coordinateManagedWorkflow(recorder(),current,ctx);
  for(let i=0;i<3;i++){now+=60001;coordinateManagedWorkflow(recorder(),current,ctx);}
  assert.equal(calls,3);assert.equal(current.engine.manager.incident.kind,'manager-no-progress');
  now+=60001;coordinateManagedWorkflow(recorder(),current,ctx);assert.equal(calls,3);
});

test('a live verification is not offered again and quota waits are distinct from manager failure',()=>{
  const current=state();current.ledger=[{id:'item',status:'implemented'}];current.ops=[
    {id:'writer',kind:'backend.implement',status:'done',ledgerIds:['item']},
    {id:'proof',kind:'review.verify',origin:'verify',status:'running',ledgerIds:['item']}];
  assert.deepEqual(verificationCandidates(current,{}),[]);
  const ready=state(),quota=Object.assign(Error('quota unknown'),{code:'STARCI_MODEL_QUOTA_WAIT'});
  const result=coordinateManagedWorkflow(recorder(),ready,{manageWorkflow:()=>{throw quota;}});
  assert.equal(result.quotaWait,true);assert.equal(ready.engine.manager.incident,null);
  const fail=coordinateManagedWorkflow(recorder(),ready,{manageWorkflow:()=>{throw Error('bad transport');}});
  assert.equal(fail.incident,true);assert.equal(ready.engine.manager.incident.kind,'manager-unavailable');
});

test('while an operation that writes is running, ready operations that write wait out of the manager list and buy no decision',()=>{
  const current=state(),events=[],store={saveState:()=>{},appendEvent:event=>events.push(event)};let called=0;
  current.ops[0].status='running';current.ops[0].allowlist=['.starciwork/features/a/**'];current.ops[1].allowlist=['.starciwork/features/b/**'];
  const ctx={engine:{},manageWorkflow(){called+=1;throw Error('no decision may be bought while nothing can be admitted');}};
  const result=coordinateManagedWorkflow(store,current,ctx);
  assert.deepEqual([result.waiting,result.dispatch,called],[true,[],0]);
  assert.deepEqual(events.filter(event=>event.event==='manager-held').map(event=>event.ops),[['b']],'the waiting operation is named once, not every round');
  assert.equal(coordinateManagedWorkflow(store,current,ctx).waiting,true);
  assert.equal(events.filter(event=>event.event==='manager-held').length,1);
  current.ops[0].status='done';
  const ctx2={engine:{},manageWorkflow:snapshot=>({schema:MANAGER_DECISION,workflowId:snapshot.workflowId,generation:snapshot.generation,version:snapshot.version,
    digest:snapshot.digest,decisionId:snapshot.decisionId,basisDigest:snapshot.basisDigest,orderedActionIds:['dispatch:b'],rationale:'the writer is free'})};
  assert.deepEqual(coordinateManagedWorkflow(store,current,ctx2).dispatch,['b'],'once the writer is free the operation is offered again');
});
