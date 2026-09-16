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
  reconcileCanonicalDecisionInputs(store,state,ctx);const unavailable=deriveOwnerRequests(state)[0];state.ops[0].question.presentationFailedAt=123;
  raw.extensions.work3.srs.options=actual;
  reconcileCanonicalDecisionInputs(store,state,ctx);const current=deriveOwnerRequests(state)[0];
  assert.equal(current.status,'waiting-owner');assert.equal(current.subject,raw.extensions.work3.srs.question);
  assert.equal(state.ops[0].question.presentationFailedAt,undefined,'a stale empty-choice presentation failure does not cool down the repaired question');
  assert.equal(current.options.length,3);assert.notEqual(current.id,unavailable.id);
  assert.equal(applyOwnerAction(state,{type:'choose',workflowId:'wf',requestId:current.id,generation:6,revision:current.revision,optionsDigest:current.optionsDigest,actor,value:'1'}).ok,true);
  const frozen=structuredClone(state.ops[0]);delete raw.extensions.work3.srs.options;
  reconcileCanonicalDecisionInputs(store,state,ctx);assert.deepEqual(state.ops[0],frozen);
});

test('an unchanged valid canonical decision retains a legitimate presenter cooldown',()=>{
  const {state,ctx,store}=fixture();reconcileCanonicalDecisionInputs(store,state,ctx);
  const ask=state.ops[0];ask.question.presentationFailedAt=456;
  const before=ask.decisionOptionsDigest;
  assert.deepEqual(reconcileCanonicalDecisionInputs(store,state,ctx),[]);
  assert.equal(ask.decisionOptionsDigest,before);assert.equal(ask.question.presentationFailedAt,456);
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

const legacyRecord=(id,requiredDecisions,options)=>({schema:'work/node@2',id,kind:'business',state:'todo',description:'Open owner policy',extensions:{work3:{srs:{
  schema:'starci/srs-policy-decision@1',id:id.toUpperCase(),title:'Owner policy',decisionStatus:'open',accountableRole:'Product owner',
  question:'Which concrete policy applies?',safeDisposition:'Keep dependent work blocked.',closureCriteria:'The owner selects a concrete option.',
  requiredDecisions,...(options?{options}:{})
}}}});

const legacySavedStateFixture=({explicit=false}={})=>{
  const registrationTopics=['Whether any verified person, only invited people, or an existing principal may register.','Whether a principal must exist before checkout.'];
  const suspensionTopics=['Whether commerce can only notify, gate service eligibility, or revoke permissions.','Whether mandatory notice and grace are part of the suspension contract.'];
  const raws=new Map([
    ['decision.registration',legacyRecord('decision.registration',registrationTopics,explicit?['Allow self-service registration after verified e-mail.','Allow invited principals only.']:null)],
    ['decision.suspension',legacyRecord('decision.suspension',suspensionTopics,explicit?['Require notice and a seven-day grace period.','Permit immediate suspension after a failed renewal.']:null)],
  ]);
  const registrationReceipt='receipt-registration-topic',suspensionReceipt='receipt-suspension-topic';
  const unrelated={id:'accepted-unrelated',kind:'work.author',status:'done',answer:'accepted independent work'};
  const state={id:'wf',engine:{schema:'starci/engine@1',generation:25,jobId:'job'},needUser:[],ops:[
    {id:'login-intake',kind:'work.author',status:'ready',ownerContinuationReceipts:[registrationReceipt,suspensionReceipt],
      answer:`Authenticated owner action ${suspensionReceipt} for decision record decision.suspension: selected ${suspensionTopics[1]}.`,
      dependsOn:['other-work']},
    unrelated,
    {id:'ask-1',kind:'decision.prepare',status:'done',attempt:1,requesters:['login-intake'],ownerRequestStatus:'answered',ownerRequestRevision:1,
      ownerAnswer:{via:'owner',receiptId:registrationReceipt,channel:'orca-input',type:'choose',value:'1',selectedLabel:registrationTopics[0],decisionRecord:'decision.registration'},
      ownerContinuationReceipt:registrationReceipt,decisionOptionsDigest:'a'.repeat(64),answer:{choice:'1',note:'coordinator inferred a policy',via:'command'},
      question:{kind:'decision',prepared:true,from:'login-intake',record:'decision.registration',text:'Who may register?',options:registrationTopics.map((label,index)=>({id:String(index+1),label}))}},
    {id:'ask-2',kind:'decision.prepare',status:'done',attempt:1,requesters:['login-intake'],ownerRequestStatus:'answered',ownerRequestRevision:1,
      ownerAnswer:{via:'owner',receiptId:suspensionReceipt,channel:'orca-input',type:'choose',value:'2',selectedLabel:suspensionTopics[1],decisionRecord:'decision.suspension'},
      ownerContinuationReceipt:suspensionReceipt,decisionOptionsDigest:'b'.repeat(64),
      question:{kind:'decision',prepared:true,from:'login-intake',record:'decision.suspension',text:'What is the suspension policy?',options:suspensionTopics.map((label,index)=>({id:String(index+1),label}))}},
  ]};
  const events=[],nodes=new Map([...raws.keys()].map(id=>[id,{id,path:`features/login/${id}/index.yaml`,inputDigest:'c'.repeat(64)}]));
  const ctx={work:{node:id=>nodes.get(id)??null,at:{},api:{readNode:(_at,node)=>raws.get(node.id)}}},store={appendEvent:event=>events.push(event)};
  return {state,raws,ctx,store,events,registrationTopics,suspensionTopics,registrationReceipt,suspensionReceipt,unrelated:structuredClone(unrelated)};
};

const registrationOnlyFixture=()=>{
  const result=legacySavedStateFixture();
  result.state.ops=result.state.ops.filter(op=>op.id!=='ask-2');
  const login=result.state.ops.find(op=>op.id==='login-intake');
  login.ownerContinuationReceipts=[result.registrationReceipt];delete login.answer;
  return result;
};

test('saved malformed topic receipts become immutable history and stop satisfying the requester',()=>{
  const {state,ctx,store,events,unrelated}=legacySavedStateFixture();
  assert.deepEqual(reconcileCanonicalDecisionInputs(store,state,ctx),['ask-1','ask-2']);
  const login=state.ops.find(op=>op.id==='login-intake'),ask1=state.ops.find(op=>op.id==='ask-1'),ask2=state.ops.find(op=>op.id==='ask-2');
  assert.equal(login.status,'pending');assert.equal(login.answer,undefined);assert.equal(login.ownerContinuationReceipts,undefined);
  assert.deepEqual(new Set(login.dependsOn),new Set(['other-work','ask-1','ask-2']));
  for(const ask of [ask1,ask2]){
    assert.equal(ask.status,'ready');assert.equal(ask.attempt,2);assert.equal(ask.ownerAnswer,undefined);assert.equal(ask.ownerContinuationReceipt,undefined);assert.equal(ask.ownerRequestStatus,'preparing');
    assert.equal(ask.decisionInputError.code,'decision-options-invalid');assert.equal(ask.ownerDecisionHistory.length,1);
    assert.equal(ask.ownerDecisionHistory[0].schema,'starci/legacy-owner-decision-history@1');
    assert.deepEqual(ask.ownerDecisionHistory[0].operation,{status:'done',attempt:1,refusal:null,verdict:null,dispatch:null,terminal:null,candidateDigest:null,oracleDigest:null});
    assert.equal(ask.ownerDecisionHistory[0].ownerAnswer.receiptId,ask.id==='ask-1'?'receipt-registration-topic':'receipt-suspension-topic');
  }
  assert.deepEqual(state.ops.find(op=>op.id==='accepted-unrelated'),unrelated);
  assert.deepEqual(deriveOwnerRequests(state).map(request=>[request.opId,request.status,request.options.length]),[['ask-1','preparing',0],['ask-2','preparing',0]]);
  assert.equal(events.filter(event=>event.event==='legacy-decision-semantics-withdrawn').length,2);
  const frozen=structuredClone(state);const eventCount=events.length;
  assert.deepEqual(reconcileCanonicalDecisionInputs(store,state,ctx),[]);assert.deepEqual(state,frozen);assert.equal(events.length,eventCount);
});

test('corrected explicit outcomes reprepare a withdrawn topic receipt under a new digest',()=>{
  const {state,ctx,store}=legacySavedStateFixture({explicit:true});state.ops=state.ops.filter(op=>!['ask-2'].includes(op.id));
  const login=state.ops.find(op=>op.id==='login-intake');login.ownerContinuationReceipts=['receipt-registration-topic'];delete login.answer;
  assert.deepEqual(reconcileCanonicalDecisionInputs(store,state,ctx),['ask-1']);
  const ask=state.ops.find(op=>op.id==='ask-1'),request=deriveOwnerRequests(state).find(item=>item.opId==='ask-1');
  assert.equal(ask.status,'done');assert.equal(request.status,'waiting-owner');assert.equal(request.options.length,2);assert.match(request.optionsDigest,/^[a-f0-9]{64}$/);
  assert.notEqual(request.optionsDigest,'a'.repeat(64));assert.equal(ask.ownerDecisionHistory[0].ownerAnswer.receiptId,'receipt-registration-topic');
  const applied=applyOwnerAction(state,{type:'choose',workflowId:'wf',requestId:request.id,generation:25,revision:request.revision,
    optionsDigest:request.optionsDigest,actor:{...actor,receiptId:'receipt-explicit-policy'},value:'2'});
  assert.equal(applied.ok,true);assert.equal(ask.ownerAnswer.receiptId,'receipt-explicit-policy');assert.equal(ask.ownerAnswer.selectedLabel,'Allow invited principals only.');
});

test('settled receipts that do not exactly select a canonical agenda topic remain untouched',()=>{
  const {state,ctx,store}=legacySavedStateFixture();const ask=state.ops.find(op=>op.id==='ask-1');
  state.ops=state.ops.filter(op=>op.id!=='ask-2');const login=state.ops.find(op=>op.id==='login-intake');
  login.ownerContinuationReceipts=['receipt-registration-topic'];delete login.answer;
  ask.ownerAnswer.selectedLabel='Require a seven-day verified grace period.';
  const before=structuredClone(state);assert.deepEqual(reconcileCanonicalDecisionInputs(store,state,ctx),[]);assert.deepEqual(state,before);
});

test('canonical authority can withdraw the exact historical topic receipt after agenda wording improves',()=>{
  const {state,raws,ctx,store}=legacySavedStateFixture();state.ops=state.ops.filter(op=>op.id!=='ask-2');
  const login=state.ops.find(op=>op.id==='login-intake');login.ownerContinuationReceipts=['receipt-registration-topic'];delete login.answer;
  const payload=raws.get('decision.registration').extensions.work3.srs;
  payload.requiredDecisions=['Choose open self-service, invitation-only, existing-principal-only, or guest-then-claim purchaser admission.','Name the feature that owns registration.'];
  payload.authorityRefs=['owner-answer history: workflow ask-1 receipt receipt-registration-topic selected topic value 1; its frozen label contained multiple alternatives and therefore did not settle one policy.'];
  assert.deepEqual(reconcileCanonicalDecisionInputs(store,state,ctx),['ask-1']);
  const ask=state.ops.find(op=>op.id==='ask-1');assert.equal(ask.ownerAnswer,undefined);assert.equal(ask.ownerDecisionHistory[0].receiptId,'receipt-registration-topic');
  assert.equal(deriveOwnerRequests(state)[0].status,'preparing');
});

test('legacy agenda withdrawal requires the complete normalized unique topic set',()=>{
  {
    const {state,raws,ctx,store,events,registrationTopics}=registrationOnlyFixture();
    raws.get('decision.registration').extensions.work3.srs.requiredDecisions=[...registrationTopics,'Which identity proof is retained?'];
    const before=structuredClone(state);assert.deepEqual(reconcileCanonicalDecisionInputs(store,state,ctx),[]);assert.deepEqual(state,before);assert.deepEqual(events,[]);
  }
  for(const duplicate of ['saved','canonical']){
    const {state,raws,ctx,store,events,registrationTopics}=registrationOnlyFixture(),ask=state.ops.find(op=>op.id==='ask-1');
    if(duplicate==='saved')ask.question.options=[registrationTopics[0],registrationTopics[0],registrationTopics[1]].map((label,index)=>({id:String(index+1),label}));
    else raws.get('decision.registration').extensions.work3.srs.requiredDecisions=[registrationTopics[0],registrationTopics[0],registrationTopics[1]];
    const before=structuredClone(state);assert.deepEqual(reconcileCanonicalDecisionInputs(store,state,ctx),[]);assert.deepEqual(state,before);assert.deepEqual(events,[]);
  }
  {
    const {state,ctx,store,events}=registrationOnlyFixture(),ask=state.ops.find(op=>op.id==='ask-1');
    ask.question.options.push({id:'3',label:'   '});const before=structuredClone(state);
    assert.deepEqual(reconcileCanonicalDecisionInputs(store,state,ctx),[]);assert.deepEqual(state,before);assert.deepEqual(events,[]);
  }
  {
    const {state,raws,ctx,store,registrationTopics}=registrationOnlyFixture(),ask=state.ops.find(op=>op.id==='ask-1');
    raws.get('decision.registration').extensions.work3.srs.requiredDecisions=[`1. ${registrationTopics[0].toUpperCase()}`,`2.   ${registrationTopics[1]}`];
    ask.question.options=[{id:'1',label:`  ${registrationTopics[1]}  `},{id:'2',label:registrationTopics[0].toLowerCase()}];
    ask.ownerAnswer.value='2';ask.ownerAnswer.selectedLabel=registrationTopics[0];
    assert.deepEqual(reconcileCanonicalDecisionInputs(store,state,ctx),['ask-1']);assert.equal(ask.ownerAnswer,undefined);
  }
});

test('canonical invalidation binds exact structured ask and receipt tokens',()=>{
  const setup=()=>{const result=registrationOnlyFixture(),payload=result.raws.get('decision.registration').extensions.work3.srs;
    payload.requiredDecisions=['Choose purchaser admission.','Name the feature that owns registration.'];return {...result,payload};};
  {
    const {state,ctx,store,payload,registrationReceipt}=setup();
    payload.authorityRefs=[`owner-answer history: workflow (ask-1), receipt [${registrationReceipt}], selected topic value 1; its frozen label did not settle one policy.`];
    assert.deepEqual(reconcileCanonicalDecisionInputs(store,state,ctx),['ask-1']);assert.equal(state.ops.find(op=>op.id==='ask-1').ownerAnswer,undefined);
  }
  {
    const {state,ctx,store,events,payload}=setup();
    payload.authorityRefs=['owner-answer history: workflow ask-10 receipt receipt-registration-topic-10 selected topic value 1; its frozen label did not settle one policy.'];
    const before=structuredClone(state);assert.deepEqual(reconcileCanonicalDecisionInputs(store,state,ctx),[]);assert.deepEqual(state,before);assert.deepEqual(events,[]);
  }
});

test('legacy withdrawal holds without mutation unless every declared requester has exact unfinished provenance',()=>{
  const cases={
    missing:({ask})=>ask.requesters.push('missing-requester'),
    unlinked:({state,ask})=>{state.ops.push({id:'unlinked',kind:'work.author',status:'ready'});ask.requesters.push('unlinked');},
    done:({state,ask,receipt})=>{state.ops.push({id:'settled',kind:'work.author',status:'done',ownerContinuationReceipts:[receipt]});ask.requesters.push('settled');},
    running:({state,ask,receipt})=>{state.ops.push({id:'running',kind:'work.author',status:'running',ownerContinuationReceipts:[receipt]});ask.requesters.push('running');},
    mixed:({state,ask})=>{state.ops.push({id:'done-unlinked',kind:'work.author',status:'done'});ask.requesters.push('done-unlinked');},
  };
  for(const [name,alter] of Object.entries(cases)){
    const {state,ctx,store,events,registrationReceipt}=registrationOnlyFixture(),ask=state.ops.find(op=>op.id==='ask-1');
    alter({state,ask,receipt:registrationReceipt});const before=structuredClone(state);
    assert.deepEqual(reconcileCanonicalDecisionInputs(store,state,ctx),[],name);assert.deepEqual(state,before,name);assert.deepEqual(events,[],name);
  }
});

test('all linked unfinished requesters withdraw together while unrelated state remains',()=>{
  const {state,ctx,store,registrationReceipt}=registrationOnlyFixture(),ask=state.ops.find(op=>op.id==='ask-1'),login=state.ops.find(op=>op.id==='login-intake');
  login.ownerContinuationReceipts=['keep-login',registrationReceipt];login.answer='accepted independent login preparation';login.dependsOn=['keep-login-dependency'];
  const second={id:'second-intake',kind:'work.author',status:'paused',ownerContinuationReceipts:[registrationReceipt,'keep-second'],answer:'accepted independent second preparation',dependsOn:['keep-second-dependency']};
  state.ops.push(second);ask.requesters.push(second.id);
  assert.deepEqual(reconcileCanonicalDecisionInputs(store,state,ctx),['ask-1']);
  assert.deepEqual(login.ownerContinuationReceipts,['keep-login']);assert.equal(login.answer,'accepted independent login preparation');
  assert.deepEqual(new Set(login.dependsOn),new Set(['keep-login-dependency','ask-1']));
  assert.deepEqual(second.ownerContinuationReceipts,['keep-second']);assert.equal(second.answer,'accepted independent second preparation');
  assert.deepEqual(new Set(second.dependsOn),new Set(['keep-second-dependency','ask-1']));assert.equal(second.status,'paused');
});
