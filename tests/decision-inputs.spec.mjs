import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalDecisionInput,reconcileCanonicalDecisionInputs} from '../kernel/decision-inputs.mjs';
import {validateSRSGraph} from '../specifications/srs-sections.mjs';
import {deriveOwnerRequests,applyOwnerAction} from '../kernel/owner-requests.mjs';
import {applyOwnerInbox} from '../kernel/owner-inbox.mjs';

const actor={type:'owner',receiptId:'owner-receipt',channel:'orca-input'};
const fixture=()=>{const events=[],raw={schema:'work/node@2',id:'decision.customer-proof',kind:'business',state:'todo',description:'Owner decision context',extensions:{work3:{srs:{
  schema:'starci/srs-policy-decision@1',id:'D-CUSTOMER-PROOF',title:'Customer proof',decisionStatus:'open',accountableRole:'Product owner',question:'Which proof closes the requirement?',
  safeDisposition:'Keep the requirement blocked.',closureCriteria:'The owner selects one option.',requiredDecisions:['Decide which customer proof is sufficient.'],options:[
  '1. Keep the customer proof requirement and create the dedicated proof path.',
  '2. Keep the requirement on the existing node until its proof path is exercised.',
  '3. Accept the provider OAuth grant and webhook registration as customer confirmation for supported providers.'
]}}}};
  const state={id:'wf',jobId:'job',engine:{schema:'starci/engine@1',generation:6},ops:[{id:'ask-2',kind:'decision.prepare',status:'done',attempt:9,ownerRequestStatus:'waiting-owner',
    question:{kind:'hidden-decision',text:'Choose the customer proof rule',options:['truncated option']}}],needUser:[{op:'ask-2',kind:'decision',record:'decision.customer-proof',options:['truncated option']} ]};
  const node={id:'decision.customer-proof',path:'features/chatbot/decision/index.yaml',inputDigest:'a'.repeat(64)};
  const ctx={work:{node:id=>id===node.id?node:null,at:{},api:{readNode:()=>raw}}},store={appendEvent:event=>events.push(event)};
  return {state,raw,ctx,store,events};};

test('SRS and owner inputs reject the same duplicate or empty numbered policy outcomes',()=>{
  const {state,raw,ctx}=fixture();
  for(const options of [['1. Same outcome','2. Same outcome'],['1. ','2. Another outcome'],['Same outcome',' Same outcome '],['1. Require prior notice','2. Permit immediate suspension']]){
    raw.extensions.work3.srs.options=options;
    const issues=validateSRSGraph([{path:'features/chatbot/business/srs/business-rules/policy-decisions/proof/index.yaml',classification:{aggregate:false,type:'policy-decision'},payload:raw.extensions.work3.srs}]);
    const canonical=canonicalDecisionInput(state,state.ops[0],ctx);
    assert.equal(issues.length===0,canonical.ok,JSON.stringify(options));
    assert.equal(canonical.ok,options[0]==='1. Require prior notice');
  }
});

test('explicit canonical options replace a truncated report summary and bind the owner request digest',()=>{
  const {state,ctx,store}=fixture();assert.deepEqual(reconcileCanonicalDecisionInputs(store,state,ctx),['ask-2']);
  const request=deriveOwnerRequests(state)[0];
  assert.equal(request.options.length,3);assert.match(request.options[2].label,/webhook registration as customer confirmation/);
  assert.match(request.optionsDigest,/^[a-f0-9]{64}$/);assert.equal(request.revision,1);
  const applied=applyOwnerAction(state,{type:'choose',workflowId:'wf',requestId:request.id,generation:6,revision:1,optionsDigest:request.optionsDigest,actor,value:'3'});
  assert.equal(applied.ok,true);assert.equal(state.ops[0].ownerAnswer.selectedLabel,request.options[2].label);
});

test('an action rendered from an older canonical decision revision is rejected after the record changes',()=>{
  const {state,raw,ctx,store}=fixture();reconcileCanonicalDecisionInputs(store,state,ctx);const stale=deriveOwnerRequests(state)[0];
  raw.extensions.work3.srs.options[2]='3. Keep the accepted requirement and require a new signed customer proof.';
  ctx.work.node('decision.customer-proof').inputDigest='b'.repeat(64);reconcileCanonicalDecisionInputs(store,state,ctx);const current=deriveOwnerRequests(state)[0];
  assert.notEqual(current.optionsDigest,stale.optionsDigest);assert.notEqual(current.id,stale.id);assert.equal(current.revision,2);
  const rejected=applyOwnerAction(state,{type:'choose',workflowId:'wf',requestId:stale.id,generation:6,revision:1,optionsDigest:stale.optionsDigest,actor,value:'3'});
  assert.equal(rejected.ok,false);assert.equal(rejected.code,'request-stale');assert.equal(state.ops[0].ownerAnswer,undefined);
  const mismatched=applyOwnerAction(state,{type:'choose',workflowId:'wf',requestId:current.id,generation:6,revision:2,optionsDigest:stale.optionsDigest,actor,value:'3'});
  assert.equal(mismatched.ok,false);assert.equal(mismatched.code,'decision-options-stale');
});

test('decision topics never become answer options when explicit canonical options are missing',()=>{
  const {state,raw,ctx,store}=fixture();delete raw.extensions.work3.srs.options;
  raw.extensions.work3.srs.requiredDecisions=['Whether any verified person or only invited people may register.','Whether notice and grace are mandatory.'];
  state.ops[0].options=['stale legacy choice'];
  state.ops[0].question.presentation={language:'vi',text:'Old question',options:['old translated choice']};
  reconcileCanonicalDecisionInputs(store,state,ctx);
  const request=deriveOwnerRequests(state)[0];assert.equal(request.status,'preparing');assert.deepEqual(request.options,[]);
  assert.equal(state.ops[0].decisionInputError.code,'decision-options-invalid');
  assert.equal(request.presentation,null);
  assert.equal(applyOwnerAction(state,{type:'answer',workflowId:'wf',requestId:request.id,generation:6,revision:request.revision,optionsDigest:request.optionsDigest,actor,value:'1'}).code,'decision-input-unavailable');
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
  raw.id='decision.customer-proof';raw.extensions.work3.srs.options[1]='   ';reconcileCanonicalDecisionInputs(store,state,ctx);
  assert.equal(state.ops[0].decisionInputError.code,'decision-options-invalid');assert.deepEqual(deriveOwnerRequests(state)[0].options,[]);
});

test('repairing the draft restores actionable choices without touching settled owner receipts',()=>{
  const {state,raw,ctx,store}=fixture();const actual=raw.extensions.work3.srs.options;delete raw.extensions.work3.srs.options;
  reconcileCanonicalDecisionInputs(store,state,ctx);const unavailable=deriveOwnerRequests(state)[0];
  raw.extensions.work3.srs.options=actual;
  reconcileCanonicalDecisionInputs(store,state,ctx);const current=deriveOwnerRequests(state)[0];
  assert.equal(current.status,'waiting-owner');assert.equal(current.subject,raw.extensions.work3.srs.question);
  assert.equal(current.options.length,3);assert.notEqual(current.id,unavailable.id);
  assert.equal(applyOwnerAction(state,{type:'choose',workflowId:'wf',requestId:current.id,generation:6,revision:current.revision,optionsDigest:current.optionsDigest,actor,value:'1'}).ok,true);
  const frozen=structuredClone(state.ops[0]);delete raw.extensions.work3.srs.options;
  reconcileCanonicalDecisionInputs(store,state,ctx);assert.deepEqual(state.ops[0],frozen);
});

test('canonical question changes clear stale translated options and single-option drafts remain unready',()=>{
  const {state,raw,ctx,store}=fixture();reconcileCanonicalDecisionInputs(store,state,ctx);
  state.ops[0].question.presentation={language:'vi',text:'Old question',options:['Old one','Old two']};
  raw.extensions.work3.srs.question='Which independently verified proof must be retained?';
  reconcileCanonicalDecisionInputs(store,state,ctx);let current=deriveOwnerRequests(state)[0];
  assert.equal(current.subject,raw.extensions.work3.srs.question);assert.equal(current.presentation,null);
  raw.extensions.work3.srs.options=['A single suggested answer'];reconcileCanonicalDecisionInputs(store,state,ctx);
  current=deriveOwnerRequests(state)[0];assert.equal(current.status,'preparing');assert.deepEqual(current.options,[]);
});

test('a running enrolled decision cannot turn agenda topics into an owner receipt before canonical reconciliation',()=>{
  const state={id:'wf',engine:{schema:'starci/engine@1',generation:6,jobId:'job'},ops:[{id:'ask-early',kind:'decision.prepare',status:'running',attempt:1,
    question:{kind:'decision',text:'Which policy?',options:['Whether notice is required.','Whether grace is required.'],presentation:{language:'vi',text:'Chọn chính sách',options:['Thông báo','Ân hạn']}}}],needUser:[]};
  const request=deriveOwnerRequests(state)[0];
  assert.equal(request.status,'preparing');assert.deepEqual(request.options,[]);assert.equal(request.optionsDigest,null);assert.equal(request.presentation,null);
  const result=applyOwnerAction(state,{type:'choose',workflowId:'wf',requestId:request.id,generation:6,revision:0,optionsDigest:null,actor,value:'1'});
  assert.equal(result.ok,false);assert.equal(result.code,'decision-input-unavailable');assert.equal(state.ops[0].ownerAnswer,undefined);
});

test('the owner inbox cannot bypass canonical readiness for an enrolled business decision',()=>{
  const events=[],state={id:'wf',engine:{schema:'starci/engine@1',generation:6,jobId:'job'},ops:[{id:'ask-early',kind:'decision.prepare',status:'ready',attempt:1,
    question:{kind:'decision',text:'Which policy?',options:['Topic A','Topic B']}}],needUser:[]};
  const request=deriveOwnerRequests(state)[0],store={appendEvent:event=>events.push(event),saveState:()=>events.push({event:'saved'})};
  const result=applyOwnerInbox(store,state,{schema:'starci/owner-action@1',action:{type:'answer',workflowId:'wf',requestId:request.id,generation:6,revision:0,
    optionsDigest:null,actor,value:'choose topic A'}});
  assert.equal(result.ok,false);assert.equal(result.code,'decision-input-unavailable');assert.equal(state.ops[0].ownerAnswer,undefined);
  assert.equal(events.some(event=>event.event==='saved'),false);assert.equal(events.at(-1).event,'owner-inbox-rejected');
});

test('a settled legacy receipt stays visible but reopening it does not revive noncanonical choices',()=>{
  const state={id:'wf',engine:{schema:'starci/engine@1',generation:6,jobId:'job'},ops:[{id:'ask-old',kind:'decision.prepare',status:'done',attempt:1,
    ownerRequestStatus:'answered',ownerRequestRevision:1,ownerAnswer:{via:'owner',receiptId:'old-receipt',channel:'orca',type:'choose',value:'1',selectedLabel:'Whether notice is required.'},
    question:{kind:'decision',text:'Which policy?',options:['Whether notice is required.','Whether grace is required.']}}],needUser:[]};
  const settled=deriveOwnerRequests(state)[0];assert.equal(settled.status,'answered');assert.equal(settled.options.length,2);
  const reopened=applyOwnerAction(state,{type:'reopen',workflowId:'wf',requestId:settled.id,generation:6,revision:1,optionsDigest:null,actor});
  assert.equal(reopened.ok,true);
  const current=deriveOwnerRequests(state)[0];assert.equal(current.status,'preparing');assert.deepEqual(current.options,[]);
  const refused=applyOwnerAction(state,{type:'choose',workflowId:'wf',requestId:current.id,generation:6,revision:2,optionsDigest:null,actor,value:'2'});
  assert.equal(refused.code,'decision-input-unavailable');assert.equal(state.ops[0].ownerAnswer.receiptId,'old-receipt');
});
