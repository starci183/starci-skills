import test from 'node:test';
import assert from 'node:assert/strict';
import {coordinateManagedWorkflow} from '../kernel/kernel.mjs';
import {MANAGER_DECISION} from '../kernel/manager.mjs';

const workflow=()=>({id:'wf',job:'approved goal',definitionOfDone:['accepted proof'],iterations:1,ledger:[],
  needUser:[{op:'ask-2',kind:'decision',record:'decision.customer-proof'}],engine:{generation:6,coordination:'agent-v1',manager:{}},ops:[
    {id:'work-1',kind:'backend.implement',status:'ready',attempt:1,dependsOn:[],ledgerIds:[],checks:[]},
    {id:'ask-2',kind:'decision.prepare',status:'done',attempt:1,dependsOn:[],ledgerIds:[],ownerRequest:true,checks:[]} ]});
const store=()=>{const events=[];return {events,saveState(){},appendEvent(event){events.push(event);}};};
const decision=(snapshot,ids)=>({schema:MANAGER_DECISION,workflowId:snapshot.workflowId,generation:snapshot.generation,
  version:snapshot.version,digest:snapshot.digest,decisionId:snapshot.decisionId,basisDigest:snapshot.basisDigest,
  orderedActionIds:ids,rationale:'select only the executable action'});

test('a completed durable manager answer is discarded when worker progress changed its pending snapshot',()=>{
  const state=workflow(),journal=store(),pending=Object.assign(new Error('pending'),{code:'STARCI_JOB_PENDING'});
  const first=coordinateManagedWorkflow(journal,state,{v6:{},manageWorkflow(){throw pending;}});
  assert.equal(first.pending,true);const pendingId=state.engine.manager.pendingDecisionId;
  state.ops[0].status='running';state.ops[0].v6Lease={jobId:'native-work-1'};
  const second=coordinateManagedWorkflow(journal,state,{v6:{},manageWorkflow:snapshot=>decision(snapshot,['dispatch:work-1'])});
  assert.deepEqual(second,{pending:false,stale:true,dispatch:[]});
  assert.equal(journal.events.at(-1).event,'manager-stale-discarded');assert.equal(journal.events.at(-1).decisionId,pendingId);
});

test('manager output cannot select or resolve an owner decision request',()=>{
  const state=workflow(),journal=store();let snapshot;
  const result=coordinateManagedWorkflow(journal,state,{v6:{},manageWorkflow:value=>{snapshot=value;return decision(value,['owner:ask-2']);}});
  assert.equal(result.incident,true);assert.deepEqual(result.dispatch,[]);
  assert.equal(snapshot.actions.some(action=>action.opId==='ask-2'),false);
  assert.equal(state.needUser[0].record,'decision.customer-proof');assert.equal(state.ops[1].ownerRequest,true);
});
