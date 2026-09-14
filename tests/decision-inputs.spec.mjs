import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileCanonicalDecisionInputs} from '../kernel/decision-inputs.mjs';
import {deriveOwnerRequests,applyOwnerAction} from '../kernel/owner-requests.mjs';

const actor={type:'owner',receiptId:'owner-receipt',channel:'orca-input'};
const fixture=()=>{const events=[],raw={schema:'work/node@2',id:'decision.customer-proof',kind:'business',state:'todo',description:'Owner decision context',extensions:{work3:{srs:{
  schema:'starci/srs-policy-decision@1',id:'D-CUSTOMER-PROOF',title:'Customer proof',decisionStatus:'open',accountableRole:'Product owner',question:'Which proof closes the requirement?',
  safeDisposition:'Keep the requirement blocked.',closureCriteria:'The owner selects one option.',requiredDecisions:[
  '1. Keep the customer proof requirement and create the dedicated proof path.',
  '2. Keep the requirement on the existing node until its proof path is exercised.',
  '3. Accept the provider OAuth grant and webhook registration as customer confirmation for supported providers.'
]}}}};
  const state={id:'wf',jobId:'job',engine:{generation:6},ops:[{id:'ask-2',kind:'decision.prepare',status:'done',attempt:9,ownerRequestStatus:'waiting-owner',
    question:{kind:'hidden-decision',text:'Choose the customer proof rule',options:['truncated option']}}],needUser:[{op:'ask-2',kind:'decision',record:'decision.customer-proof',options:['truncated option']} ]};
  const node={id:'decision.customer-proof',path:'features/chatbot/decision/index.yaml',inputDigest:'a'.repeat(64)};
  const ctx={work:{node:id=>id===node.id?node:null,at:{},api:{readNode:()=>raw}}},store={appendEvent:event=>events.push(event)};
  return {state,raw,ctx,store,events};};

test('canonical requiredDecisions replace a truncated report summary and bind the owner request digest',()=>{
  const {state,ctx,store}=fixture();assert.deepEqual(reconcileCanonicalDecisionInputs(store,state,ctx),['ask-2']);
  const request=deriveOwnerRequests(state)[0];
  assert.equal(request.options.length,3);assert.match(request.options[2].label,/webhook registration as customer confirmation/);
  assert.match(request.optionsDigest,/^[a-f0-9]{64}$/);assert.equal(request.revision,1);
  const applied=applyOwnerAction(state,{type:'choose',workflowId:'wf',requestId:request.id,generation:6,revision:1,optionsDigest:request.optionsDigest,actor,value:'3'});
  assert.equal(applied.ok,true);assert.equal(state.ops[0].ownerAnswer.selectedLabel,request.options[2].label);
});

test('an action rendered from an older canonical decision revision is rejected after the record changes',()=>{
  const {state,raw,ctx,store}=fixture();reconcileCanonicalDecisionInputs(store,state,ctx);const stale=deriveOwnerRequests(state)[0];
  raw.extensions.work3.srs.requiredDecisions[2]='3. Keep the accepted requirement and require a new signed customer proof.';
  ctx.work.node('decision.customer-proof').inputDigest='b'.repeat(64);reconcileCanonicalDecisionInputs(store,state,ctx);const current=deriveOwnerRequests(state)[0];
  assert.notEqual(current.optionsDigest,stale.optionsDigest);assert.notEqual(current.id,stale.id);assert.equal(current.revision,2);
  const rejected=applyOwnerAction(state,{type:'choose',workflowId:'wf',requestId:stale.id,generation:6,revision:1,optionsDigest:stale.optionsDigest,actor,value:'3'});
  assert.equal(rejected.ok,false);assert.equal(rejected.code,'request-stale');assert.equal(state.ops[0].ownerAnswer,undefined);
  const mismatched=applyOwnerAction(state,{type:'choose',workflowId:'wf',requestId:current.id,generation:6,revision:2,optionsDigest:stale.optionsDigest,actor,value:'3'});
  assert.equal(mismatched.ok,false);assert.equal(mismatched.code,'decision-options-stale');
});

test('missing canonical requiredDecisions keeps the request preparing without guessed options',()=>{
  const {state,raw,ctx,store}=fixture();delete raw.extensions.work3.srs.requiredDecisions;reconcileCanonicalDecisionInputs(store,state,ctx);
  const request=deriveOwnerRequests(state)[0];assert.equal(request.status,'preparing');assert.deepEqual(request.options,[]);
  assert.equal(state.ops[0].decisionInputError.code,'decision-options-invalid');
});

test('a conflicting question record cannot redirect the canonical owner decision',()=>{
  const {state,ctx,store}=fixture();state.ops[0].question.record='decision.other';
  reconcileCanonicalDecisionInputs(store,state,ctx);
  const request=deriveOwnerRequests(state)[0];assert.equal(request.status,'preparing');assert.deepEqual(request.options,[]);
  assert.equal(state.ops[0].decisionInputError.code,'decision-record-mismatch');
});

test('unchanged labels cannot accept a stale action after canonical decision context changes',()=>{
  const {state,raw,ctx,store}=fixture();reconcileCanonicalDecisionInputs(store,state,ctx);const stale=deriveOwnerRequests(state)[0];
  raw.extensions.work3.srs.safeDisposition='Preserve the requirement and stop every dependent release.';
  reconcileCanonicalDecisionInputs(store,state,ctx);const current=deriveOwnerRequests(state)[0];
  assert.deepEqual(current.options,stale.options);assert.notEqual(current.optionsDigest,stale.optionsDigest);assert.notEqual(current.id,stale.id);
  assert.equal(applyOwnerAction(state,{type:'choose',workflowId:'wf',requestId:stale.id,generation:6,revision:1,optionsDigest:stale.optionsDigest,actor,value:'1'}).code,'request-stale');
});

test('mismatched raw identity and malformed mixed options fail closed',()=>{
  const {state,raw,ctx,store}=fixture();raw.id='decision.other';reconcileCanonicalDecisionInputs(store,state,ctx);
  assert.equal(state.ops[0].decisionInputError.code,'decision-record-invalid');assert.deepEqual(deriveOwnerRequests(state)[0].options,[]);
  raw.id='decision.customer-proof';raw.extensions.work3.srs.requiredDecisions[1]='   ';reconcileCanonicalDecisionInputs(store,state,ctx);
  assert.equal(state.ops[0].decisionInputError.code,'decision-options-invalid');assert.deepEqual(deriveOwnerRequests(state)[0].options,[]);
});
