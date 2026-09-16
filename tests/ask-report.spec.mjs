import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {toOp} from '../kernel/common.mjs';
import {buildReport} from '../kernel/reports.mjs';
import {answerOrEscalate,answerOwnerQuestion,settleOwnerAsk} from '../kernel/owner.mjs';
import {ANSWER_ENVELOPE,QUESTION_RECORD,buildAnswer,buildQuestion,envelopeForCommand,goalRevOf,
  issueQuestion,markStaleQuestions,questionStale,renderQuestion,validateAnswer,validateQuestion} from '../kernel/ask.mjs';

const tmp=()=>{const dir=path.join(os.tmpdir(),'starci-ask-report',`${Date.now()}-${Math.random().toString(16).slice(2)}`);fs.mkdirSync(dir,{recursive:true});return dir;};
function stubStore(dir){
  const events=[];
  return {id:'wf-ask',dir,events,
    paths:{reports:path.join(dir,'reports'),goalJson:path.join(dir,'goal.json'),inbox:path.join(dir,'inbox')},
    appendEvent(event){events.push(event);return event;},
    saveState(){},readEvents(){return events;},readReports(){return [];},
    checksPath:id=>path.join(dir,'checks',`${id}.json`),
    contractPath:id=>path.join(dir,'contracts',`${id}.md`),
    reportPath:dispatch=>path.join(dir,'reports',`${dispatch}.json`)};
}
const stubState=(store,ops=[])=>({id:store.id,dir:store.dir,job:'typed questions under test',worktree:store.dir,branch:'ask',
  ledgerMode:'plan',scope:[],inputs:[],ledger:[],ops,needUser:[],lanes:{},gates:[],gateResults:[],verifyRounds:{},
  gateRounds:0,counters:{},iterations:1,decisions:[],sharedQueue:[],silences:{},dynamicOps:0,dynamicOpsBudget:64,
  head:null,stalls:0,critique:null,approved:true,provisional:[]});
const askOp=(id='ask-1',question={},requesters=['op-work'])=>toOp({id,kind:'decision.prepare',goal:'Prepare the decision',
  allowlist:['.starciwork/decisions/**'],question:{kind:'decision',text:'Which retry policy?',...question},requesters},0);

test('a question record is canonical: the digest binds content, never key order or answer state',()=>{
  const record=buildQuestion({questionId:'ask-1',goalRev:2,at:1,
    fields:[{id:'answer',type:'select',label:'Which retry policy?',options:['retry twice','retry five times']}],
    context:{op:'ask-1',kind:'decision'}});
  assert.equal(record.schema,QUESTION_RECORD);
  assert.equal(record.goalRev,2);
  assert.match(record.digest,/^[0-9a-f]{64}$/);
  assert.equal(validateQuestion(record).ok,true);
  // The same content in a different key order is the same record.
  const reordered={...record,fields:record.fields.map(field=>({options:field.options,label:field.label,id:field.id,type:field.type}))};
  assert.equal(validateQuestion(reordered).ok,true,'field key order is not content');
  // An edited option is a different question.
  const tampered={...record,fields:[{...record.fields[0],options:[{id:'1',label:'retry twice'},{id:'2',label:'never retry'}]}]};
  assert.equal(validateQuestion(tampered).ok,false);
  assert.throws(()=>buildQuestion({questionId:'x',fields:[{id:'a',type:'select',label:'one?',options:['only']}]}),/at least two/);
  assert.throws(()=>buildQuestion({questionId:'x',fields:[{id:'a',type:'text',label:'t?',options:['a','b']}]}),/only select and multi/);
});

test('the terminal renderer writes the fixed template: numbered options and typed fields, never model markup',()=>{
  const record=buildQuestion({questionId:'ask-1',goalRev:3,at:1,
    fields:[{id:'answer',type:'select',label:'Which mailbox?',options:['the provider sandbox','a shared tenant']},
      {id:'why',type:'text',label:'Why is this one safe?'},
      {id:'ok',type:'confirm',label:'The list is final'}],
    context:{op:'ask-1',kind:'decision',from:'op-intake'}});
  assert.deepEqual(renderQuestion(record),[
    'Question ask-1 (goal rev 3)',
    '  op: ask-1','  kind: decision','  from: op-intake',
    '1. Which mailbox? - choose one',
    '   1) the provider sandbox','   2) a shared tenant',
    '2. Why is this one safe? - free text',
    '3. The list is final - confirm',
    '   1) yes','   2) no']);
});

test('a report carries the typed record of the question the worker declared',()=>{
  const report=buildReport({outcome:'ask',run:'run_1',task:'task_1',dispatch:'ctx_1',from:'term_1',
    summary:'Need a ruling.',question:{text:'Which sandbox?',options:['own','shared'],kind:'account'},goalRev:2});
  const typed=report.question.typed;
  assert.equal(typed.schema,QUESTION_RECORD);
  assert.equal(typed.goalRev,2);
  assert.equal(typed.questionId,'task_1:ctx_1');
  assert.equal(validateQuestion(typed).ok,true);
  assert.deepEqual(typed.fields.map(field=>[field.id,field.type,field.options.length]),[['answer','select',2]]);
});

test('a schema-valid answer resolves exactly the op it names, and a wrong option is rejected and re-asked',()=>{
  const dir=tmp();
  try{
    const store=stubStore(dir);
    const one=askOp('ask-1',{options:['reopen the order','close it']});
    const other=askOp('ask-2',{options:['retry','give up']},['op-other']);
    const paused=toOp({id:'op-work',kind:'backend.implement',goal:'Build the intake',allowlist:['src/intake.ts']},1);
    paused.status='paused';paused.waitingFor='ask-1';
    const waiting=toOp({id:'op-other',kind:'backend.implement',goal:'Build the other slice',allowlist:['src/other.ts']},2);
    waiting.status='paused';waiting.waitingFor='ask-2';
    const state=stubState(store,[one,other,paused,waiting]);
    state.goalRev=1;
    for(const ask of[one,other])issueQuestion(store,state,ask);

    // An answer outside the offered options is rejected and settles nothing.
    assert.throws(()=>answerOwnerQuestion(store,state,{op:'ask-1',choice:9}),/does not fit the question/);
    const rejected=store.events.find(event=>event.event==='answer-rejected');
    assert.equal(rejected.question,'ask-1');
    assert.equal(paused.status,'paused','the wrong option never resumes the op');

    // The typed envelope binds the exact record and unparks only this ask's requester.
    const record=one.question.typed;
    const envelope=buildAnswer({questionId:record.questionId,digest:record.digest,goalRev:record.goalRev,answers:{answer:'2'},note:'the volume justifies it'});
    const answered=answerOwnerQuestion(store,state,{op:'ask-1',envelope});
    assert.equal(answered.ask,'ask-1');
    const journaled=store.events.find(event=>event.event==='answered');
    assert.deepEqual([journaled.question,journaled.digest,journaled.goalRev,journaled.via],['ask-1',record.digest,1,'envelope']);
    assert.equal(paused.status,'ready','the requester of this question resumes');
    assert.equal(waiting.status,'paused','another question\'s requester is untouched');
    assert.match(paused.answer,/option 2 - close it; the volume justifies it/);
    // A digest that binds other content is refused, and an envelope naming another question is refused too.
    assert.throws(()=>answerOwnerQuestion(store,state,{op:'ask-2',envelope:buildAnswer({questionId:'ask-2',digest:'0'.repeat(64),goalRev:1,answers:{answer:'1'}})}),/digest/);
    assert.throws(()=>answerOwnerQuestion(store,state,{op:'ask-2',envelope}),/names ask-1/);
    assert.equal(waiting.status,'paused');
    answerOwnerQuestion(store,state,{op:'ask-2',choice:1});
    assert.equal(waiting.status,'ready');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('the kernel answers a mechanical question once, from the offered options, journaled as kernel-answer',()=>{
  const dir=tmp();
  try{
    const store=stubStore(dir);
    const op=toOp({id:'op-build',kind:'backend.implement',goal:'Build the intake',allowlist:['src/intake.ts']},0);
    const state=stubState(store,[op]);
    const report=buildReport({outcome:'ask',run:'run_1',task:'task_1',dispatch:'ctx_1',from:'term_1',
      summary:'Tooling question.',question:{text:'Run the suite with vitest or jest?',options:['vitest','jest'],kind:'mechanical'}});
    const ctx={cwd:dir,decide:input=>{
      assert.ok(input.options.includes('vitest')&&input.options.includes('jest'),'the closed set is offered to the kernel');
      return {ok:true,value:{option:'vitest',rationale:'the repository already runs vitest'}};
    }};
    assert.equal(answerOrEscalate(null,store,state,op,report,ctx),'answer');
    const journaled=store.events.find(event=>event.event==='kernel-answer');
    assert.ok(journaled,'a kernel answer is journaled as itself, never as an owner answer');
    assert.deepEqual([journaled.op,journaled.option,journaled.label,journaled.reason],
      ['op-build','1','vitest','the repository already runs vitest']);
    assert.equal(journaled.question,report.question.typed.questionId);
    assert.equal(store.events.some(event=>event.event==='owner-answered'),false);
    assert.equal(op.status,'answering');
    assert.match(op.answer,/option 1 - vitest/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('a question asked under an older goal revision goes stale: its answers settle nothing and it is re-asked',()=>{
  const dir=tmp();
  try{
    const store=stubStore(dir);
    const ask=askOp('ask-1',{options:['reopen the order','close it']});
    const paused=toOp({id:'op-work',kind:'backend.implement',goal:'Build the intake',allowlist:['src/intake.ts']},1);
    paused.status='paused';paused.waitingFor='ask-1';
    const state=stubState(store,[ask,paused]);
    state.goalRev=1;
    const issued=issueQuestion(store,state,ask);
    assert.equal(issued.goalRev,1);
    assert.equal(questionStale(issued,goalRevOf(state,store)),false);

    // The goal moves on: every question bound to rev 1 is marked stale and re-asked under rev 2.
    state.goalRev=2;
    const reasked=markStaleQuestions(store,state);
    assert.deepEqual(reasked,['ask-1']);
    const fresh=ask.question.typed;
    assert.equal(fresh.goalRev,2);
    assert.notEqual(fresh.digest,issued.digest,'the re-asked record binds the new revision');
    assert.equal(fresh.context.supersedes,issued.digest);
    assert.ok(store.events.some(event=>event.event==='question-stale'&&event.digest===issued.digest&&event.to===2));
    assert.ok(store.events.some(event=>event.event==='asked'&&event.digest===fresh.digest));

    // An answer that still binds the stale record resolves nothing.
    const stale=buildAnswer({questionId:issued.questionId,digest:issued.digest,goalRev:issued.goalRev,answers:{answer:'2'}});
    assert.throws(()=>answerOwnerQuestion(store,state,{op:'ask-1',envelope:stale}),/digest/);
    assert.equal(paused.status,'paused');
    assert.ok(store.events.some(event=>event.event==='answer-rejected'&&event.answerDigest===issued.digest));

    // And a question that was never swept is caught lazily at answer time: stale, re-asked, not settled.
    const two=askOp('ask-9',{options:['a','b']},['op-late']);
    const second=toOp({id:'op-late',kind:'backend.implement',goal:'Build the late slice',allowlist:['src/late.ts']},2);
    second.status='paused';second.waitingFor='ask-9';
    state.ops.push(two,second);
    const stale2=issueQuestion(store,state,two,{at:2});
    state.goalRev=3;
    assert.throws(()=>answerOwnerQuestion(store,state,{op:'ask-9',choice:1}),/went stale/);
    assert.equal(second.status,'paused','a stale answer never resolves the op');
    assert.equal(two.question.typed.goalRev,3,'the op re-asked under the current revision');
    assert.notEqual(two.question.typed.digest,stale2.digest);
    // The fresh record answers normally under the new revision.
    answerOwnerQuestion(store,state,{op:'ask-9',choice:2});
    assert.equal(second.status,'ready');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('a number typed in the ask\'s own terminal is the same typed answer: outside the offered options it is rejected',()=>{
  const dir=tmp();
  try{
    const store=stubStore(dir);
    const requester=toOp({id:'op-work',kind:'backend.implement',goal:'Build the intake',allowlist:['src/intake.ts']},0);
    requester.status='paused';requester.waitingFor='ask-1';
    const ask=askOp('ask-1',{options:['retry twice','retry five times']});
    const state=stubState(store,[requester,ask]);
    // `9` was never offered: the question is listed for a real answer, and nothing was settled.
    settleOwnerAsk(store,state,ask,{summary:'answered-by-owner: 9'});
    assert.equal(requester.status,'paused');
    assert.ok(store.events.some(event=>event.event==='answer-rejected'&&event.op==='ask-1'));
    assert.ok(state.needUser.some(item=>item.op==='ask-1'&&item.kind==='decision'));
    // The valid number through the same door settles it and resumes exactly this requester.
    settleOwnerAsk(store,state,ask,{summary:'answered-by-owner: 2'});
    assert.equal(requester.status,'ready');
    assert.match(requester.answer,/option 2 - retry five times/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('the command line maps to the envelope: a choice picks an option by id, a note annotates or answers text',()=>{
  const record=buildQuestion({questionId:'ask-1',goalRev:1,at:1,
    fields:[{id:'answer',type:'select',label:'Which?',options:['a','b']}]});
  const env=envelopeForCommand(record,{choice:2,note:'because'});
  assert.equal(env.schema,ANSWER_ENVELOPE);
  assert.deepEqual([env.answers.answer,env.note],['2','because']);
  assert.equal(validateAnswer(record,env).ok,true);
  // A number outside the offered options is carried as-is and then rejected, never corrected.
  const out=envelopeForCommand(record,{choice:7});
  const verdict=validateAnswer(record,out);
  assert.equal(verdict.ok,false);
  assert.match(verdict.errors.join(';'),/not one of the offered options/);
  // Text questions take the note as the answer.
  const text=buildQuestion({questionId:'ask-2',goalRev:1,fields:[{id:'answer',type:'text',label:'What broke?'}]});
  assert.equal(validateAnswer(text,envelopeForCommand(text,{note:'the migration'})).ok,true);
});
