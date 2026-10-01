import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,ledgerFileFor,openLedger,ensureWorkflow,changeWorkflowPhase,insertGoal,createUnit,enqueueJob,setJobStatus,startAttempt,writeContract,fileReport,markReportConsumed,recordJobResult,appendEvent} from '../../engine/db/ledger.mjs';
import {lineageJobsOf,ownerAnswersOf,repeatedAnswerOf} from '../../scripts/kernel/owner-answers.mjs';

// starci-next wf-starci-next-work-and-stacks-mud4qamv: ordinal 1 of business.decide asked the owner
// (ctx_3074731253e3), config.yaml asks.autoAcceptRecommended answered it (answeredBy auto-recommended),
// and the owner-answer retry (attempt 12, op-business.decide-7f71843aaa) filed the SAME question again
// (ctx_cc73a111de44): its packet carried no record of the answered ask. Dispatch now binds the answers of
// the job's retry lineage into packet context.owner_answers and the op prompt, and api report refuses an
// ask that repeats one (modules/kernel/api.yaml dispatch.ownerAnswers, report refuses ask-already-answered).
const ROOT=path.resolve(import.meta.dirname,'..', '..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const OP='docs.author';
const CUT={id:'business-paths-rag-rev1',ordinal:1,total:2};
const QUESTION={text:'Which study-day qualifier should the business rules use?',
  options:['Any completed lesson counts (recommended)','Only a finished topic counts','Ten minutes of study counts'],recommended:0,recommendedReason:'least friction'};
const env=(()=>{const e={...process.env};for(const k of ['ORCA_TERMINAL_HANDLE','STARCI_ROLE','STARCI_OP_JOB'])delete e[k];return e;})();
const runApi=(...args)=>spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
const out=r=>{try{return JSON.parse(r.stdout);}catch{return null;}};
// api report prints its JSON, then the rendered report block.
const reportOut=r=>{try{return JSON.parse(r.stdout.slice(0,r.stdout.indexOf('\n}')+2));}catch{return null;}};
const lastErr=r=>{try{return JSON.parse(String(r.stderr).trim().split('\n').at(-1));}catch{return null;}};
const json=v=>JSON.stringify(v??null);

const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-owner-answers-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(path.join(repo,'docs'),{recursive:true});
  const seed=fn=>{const l=openLedger({file:ledgerFileFor(repo)});try{return fn(l);}finally{l.close();}};
  const read=fn=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return fn(l.db);}finally{l.close();}};
  return {root,repo,seed,read};
};
const seedGoal=(fx,wf)=>fx.seed(l=>{
  const at=Date.now();
  l.transaction(db=>{
    ensureWorkflow(db,{workflowId:wf,phase:'queued',title:'owner answers',by:'test-fixture',reason:'seed',at});
    insertGoal(db,{workflowId:wf,revision:1,goalIdentity:'owner-answers-goal',markdown:'# goal',goal:{derivedFrom:'owner-answers-test'},createdAt:at});
    changeWorkflowPhase(db,{workflowId:wf,to:'running',by:'test-fixture',reason:'seed',at});
  });
});
const enqueue=(fx,wf,cut=CUT)=>{
  const r=runApi('enqueue','--repo',fx.repo,'--workflow',wf,'--op',OP,'--paths',`docs/biz-${cut.ordinal}`,
    '--cut-id',cut.id,'--cut-ordinal',String(cut.ordinal),'--cut-total',String(cut.total),'--json');
  assert.equal(r.status,0,r.stderr);
  return out(r).job_id;
};
const jobOf=(fx,jobId)=>fx.read(db=>db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId));
/** The ask attempt: settled awaiting-owner on a filed ask, answered by auto-accept with a receipt. */
const answeredAsk=(fx,wf,jobId,{dispatchId='ctx_3074731253e3',question=QUESTION,answeredBy='auto-recommended',optionIndex=0}={})=>{
  const receiptDir=path.join(fx.repo,'.starciwork','kernel-evidence',wf,'serve-ask');
  fs.mkdirSync(receiptDir,{recursive:true});
  const receiptPath=path.join(receiptDir,`answer-${dispatchId}.json`);
  fs.writeFileSync(receiptPath,json({schema:'starci/ask-answer@1',workflowId:wf,dispatchId,opId:OP,option:question.options[optionIndex],
    optionIndex,picks:null,answeredBy,note:'auto-accepted by config.yaml asks.autoAcceptRecommended',at:'2026-09-24T01:02:03.000Z'}));
  fx.seed(l=>{
    const at=Date.now();
    l.transaction(db=>{
      // The ask attempt the settle recorded: leased → dispatched → running, ask report filed and
      // consumed, then reported → deciding → awaiting_owner with the awaiting-owner result on the attempt.
      setJobStatus(db,{jobId,to:'ready',reason:'dispatch',at});
      setJobStatus(db,{jobId,to:'leased',reason:'dispatch',at});
      const attempt=startAttempt(db,{workflowId:wf,jobId,dispatchId,dispatchedAt:at,startedAt:at,at});
      setJobStatus(db,{jobId,to:'running',reason:'worker live',at});
      fileReport(db,{attemptId:attempt.attempt_id,outcome:'ask',
        report:{outcome:'ask',summary:'owner decision needed',from:jobId,dispatch:dispatchId,question},createdAt:at});
      markReportConsumed(db,{attemptId:attempt.attempt_id,at});
      setJobStatus(db,{jobId,to:'reported',reason:'report filed',at});
      setJobStatus(db,{jobId,to:'deciding',reason:'settle',at});
      setJobStatus(db,{jobId,to:'awaiting_owner',reason:'awaiting owner',at});
      recordJobResult(db,{jobId,result:{verdict:'awaiting-owner',kernelVerdict:'blocked',askDispatchId:dispatchId},at});
      appendEvent(db,{workflowId:wf,entityType:'report',entityId:dispatchId,kind:'ask-answered',
        payload:{dispatchId,receiptPath,answeredBy,optionIndex,option:question.options[optionIndex],note:'auto-accepted'},createdAt:at});
    });
  });
  return receiptPath;
};

test('ownerAnswersOf: an owner-answer retry carries the answered ask of its lineage, and a first attempt carries none',t=>{
  const fx=fixture(t),wf='wf-owner-answers-lineage';
  seedGoal(fx,wf);
  const ask=enqueue(fx,wf);
  const sibling=enqueue(fx,wf,{...CUT,ordinal:2});
  const receipt=answeredAsk(fx,wf,ask);
  // A sibling ordinal's own answered ask is not this ordinal's answer.
  answeredAsk(fx,wf,sibling,{dispatchId:'ctx_sibling',question:{text:'Sibling slice question?',options:['a','b']}});
  const retry=enqueue(fx,wf);
  const retryRow=jobOf(fx,retry);
  // The retry is the next try of the SAME work unit (H4): jobs.retry_of names the ask try and the
  // owner-answer settle result maps to a free 'follow-up' retry class (engine/admission.mjs).
  assert.equal(retryRow.retry_of,ask);
  assert.equal(retryRow.retry_class,'follow-up');
  fx.read(db=>{
    assert.deepEqual(lineageJobsOf(db,retryRow).map(r=>r.job_id),[ask]);
    assert.deepEqual(ownerAnswersOf(db,retryRow),[{
      dispatchId:'ctx_3074731253e3',jobId:ask,attempt:jobOf(fx,ask).try_no,question:QUESTION.text,options:QUESTION.options,
      chosen:{index:0,label:QUESTION.options[0]},note:'auto-accepted',answeredBy:'auto-recommended',answeredAt:'2026-09-24T01:02:03.000Z',receipt}]);
    assert.deepEqual(ownerAnswersOf(db,jobOf(fx,sibling)),[],'a first attempt has no lineage');
  });
  // A second retry (a business retry of the owner-answer retry) still carries the lineage's answer.
  fx.seed(l=>l.transaction(db=>{
    const at=Date.now();
    setJobStatus(db,{jobId:retry,to:'ready',reason:'dispatch',at});
    setJobStatus(db,{jobId:retry,to:'leased',reason:'dispatch',at});
    setJobStatus(db,{jobId:retry,to:'running',reason:'worker live',at});
    setJobStatus(db,{jobId:retry,to:'failed',reason:'business fail',at});
    recordJobResult(db,{jobId:retry,result:{verdict:'fail'},at});
  }));
  const again=enqueue(fx,wf);
  fx.read(db=>assert.deepEqual(ownerAnswersOf(db,jobOf(fx,again)).map(a=>a.dispatchId),['ctx_3074731253e3']));
});

test('dispatch binds context.owner_answers into the packet and says ANSWERED in the op prompt',t=>{
  const fx=fixture(t),wf='wf-owner-answers-packet';
  seedGoal(fx,wf);
  const ask=enqueue(fx,wf);
  const first=out(runApi('dispatch','--repo',fx.repo,'--job',ask,'--json'));
  assert.equal(first?.ok,true);
  assert.equal(first.packet.context.owner_answers,undefined,'a first attempt carries no owner answers');
  assert.doesNotMatch(first.prompt,/owner_answers:/);
  answeredAsk(fx,wf,ask);
  const retry=enqueue(fx,wf);
  const dry=runApi('dispatch','--repo',fx.repo,'--job',retry,'--json');
  const packet=out(dry)?.packet;
  assert.ok(packet,dry.stderr||dry.stdout);
  assert.deepEqual(packet.context.owner_answers.map(a=>[a.dispatchId,a.chosen,a.answeredBy]),
    [['ctx_3074731253e3',{index:0,label:QUESTION.options[0]},'auto-recommended']]);
  const prompt=out(dry).prompt;
  assert.match(prompt,/owner_answers: these questions were ALREADY ANSWERED/);
  assert.match(prompt,/Do NOT ask it again/);
  assert.match(prompt,/\[ctx_3074731253e3, attempt \d+\] "Which study-day qualifier/);
  assert.match(prompt,/-> option 1 "Any completed lesson counts \(recommended\)" note "auto-accepted" \(answeredBy auto-recommended at 2026-09-24T01:02:03\.000Z; receipt /);
});

test('repeatedAnswerOf matches the same text or the same options, never a handover.review round',()=>{
  const answers=[{dispatchId:'ctx_a',question:QUESTION.text,options:QUESTION.options}];
  assert.equal(repeatedAnswerOf({text:'  which STUDY-DAY qualifier should the business rules use  ',options:[]},answers)?.dispatchId,'ctx_a');
  assert.equal(repeatedAnswerOf({text:'Reworded: pick the qualifier',options:[...QUESTION.options].reverse().map(label=>({label}))},answers)?.dispatchId,'ctx_a');
  assert.equal(repeatedAnswerOf({text:'A new question the answer left open',options:['x','y']},answers),null);
  const handover=[{dispatchId:'ctx_h',question:'Approve the package?',options:['approve','feedback','question']}];
  assert.equal(repeatedAnswerOf({text:'Approve the revised package?',options:['approve','feedback','question']},handover,{op:'handover.review'}),null,
    'a handover asks the same three options every round');
  assert.equal(repeatedAnswerOf({text:'Approve the package?',options:['approve','feedback','question']},handover,{op:'handover.review'}),null,
    'and may word the approval the same way after feedback');
  assert.equal(repeatedAnswerOf({text:'Approve the package?',options:[]},handover,{op:'docs.author'})?.dispatchId,'ctx_h');
});

test('api report refuses an ask that repeats an answered ask of the lineage, and admits a declared re-ask loudly',t=>{
  const fx=fixture(t),wf='wf-owner-answers-report';
  seedGoal(fx,wf);
  const ask=enqueue(fx,wf);
  answeredAsk(fx,wf,ask);
  const retry=enqueue(fx,wf);
  // Bind the retry the way dispatch does: an op_attempts row with its scratch dir, a contract row
  // bound to that attempt, and the job running (H10: api report reads only the attempt's scratch).
  const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'starci-owner-answers-scratch-'));
  fx.seed(l=>l.transaction(db=>{
    const at=Date.now();
    setJobStatus(db,{jobId:retry,to:'ready',reason:'dispatch',at});
    setJobStatus(db,{jobId:retry,to:'leased',reason:'dispatch',at});
    const attempt=startAttempt(db,{workflowId:wf,jobId:retry,dispatchId:'ctx_cc73a111de44',
      terminalHandle:'term_retry',scratchDir:scratch,dispatchedAt:at,startedAt:at,at});
    writeContract(db,{attemptId:attempt.attempt_id,markdown:'# contract',context:{},createdAt:at});
    setJobStatus(db,{jobId:retry,to:'running',reason:'worker live',at,workerId:'term_retry'});
  }));
  const file=path.join(scratch,'report.json');
  const file_=(question)=>{fs.writeFileSync(file,json({outcome:'ask',summary:'owner decision needed',question}));return file;};

  const refused=runApi('report','--repo',fx.repo,'--job',retry,'--report',file_(QUESTION),'--json');
  assert.equal(refused.status,1,refused.stdout);
  assert.equal(lastErr(refused)?.code,'ask-already-answered',refused.stderr);
  assert.match(lastErr(refused).error,/repeats ask ctx_3074731253e3 .*auto-recommended already answered with option 1/);
  assert.equal(fx.read(db=>db.prepare("SELECT count(*) n FROM reports WHERE dispatch_id='ctx_cc73a111de44'").get().n),0,'nothing is filed');

  // Same options in other words is the same question.
  const reworded=runApi('report','--repo',fx.repo,'--job',retry,'--report',file_({...QUESTION,text:'Please choose how a study day qualifies'}),'--json');
  assert.equal(lastErr(reworded)?.code,'ask-already-answered');

  // A re-ask that does not name the answered ask, or gives no reason, is still refused.
  const vague=runApi('report','--repo',fx.repo,'--job',retry,'--report',file_({...QUESTION,reasks:{dispatchId:'ctx_other',reason:'x'}}),'--json');
  assert.equal(lastErr(vague)?.code,'ask-already-answered');

  // A declared re-ask of exactly that ask is filed, with a loud warning and the reask on the event.
  const declared=runApi('report','--repo',fx.repo,'--job',retry,'--report',
    file_({...QUESTION,reasks:{dispatchId:'ctx_3074731253e3',reason:'the answer named a rule the record schema rejects'}}),'--json');
  assert.equal(declared.status,0,declared.stderr);
  assert.match(declared.stderr,/WARNING: ask ctx_cc73a111de44 re-asks ctx_3074731253e3/);
  assert.deepEqual(reportOut(declared).reask,{dispatchId:'ctx_3074731253e3',reason:'the answer named a rule the record schema rejects'});
  const event=fx.read(db=>JSON.parse(db.prepare("SELECT payload_json FROM events WHERE kind='report-filed' ORDER BY seq DESC LIMIT 1").get().payload_json));
  assert.equal(event.reask.dispatchId,'ctx_3074731253e3');
});

test('api report still files a genuinely new ask on an owner-answer retry',t=>{
  const fx=fixture(t),wf='wf-owner-answers-new-ask';
  seedGoal(fx,wf);
  const ask=enqueue(fx,wf);
  answeredAsk(fx,wf,ask);
  const retry=enqueue(fx,wf);
  const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'starci-owner-answers-scratch-'));
  fx.seed(l=>l.transaction(db=>{
    const at=Date.now();
    setJobStatus(db,{jobId:retry,to:'ready',reason:'dispatch',at});
    setJobStatus(db,{jobId:retry,to:'leased',reason:'dispatch',at});
    const attempt=startAttempt(db,{workflowId:wf,jobId:retry,dispatchId:'ctx_new',
      terminalHandle:'term_new',scratchDir:scratch,dispatchedAt:at,startedAt:at,at});
    writeContract(db,{attemptId:attempt.attempt_id,markdown:'# contract',context:{},createdAt:at});
    setJobStatus(db,{jobId:retry,to:'running',reason:'worker live',at,workerId:'term_new'});
  }));
  const file=path.join(scratch,'report.json');
  fs.writeFileSync(file,json({outcome:'ask',summary:'a follow-up the answer left open',question:{text:'Does a lesson completed offline count on the day it syncs?',options:['yes','no']}}));
  const filed=runApi('report','--repo',fx.repo,'--job',retry,'--report',file,'--json');
  assert.equal(filed.status,0,filed.stderr);
  assert.equal(reportOut(filed).ok,true);
  assert.equal(reportOut(filed).reask,undefined);
});

test('ownerAnswersOf keeps to the job\'s own params.subject: another subject\'s answered ask is not its answer',t=>{
  const fx=fixture(t),wf='wf-owner-answers-subject';
  seedGoal(fx,wf);
  // params.subject is the unit subject key (admission.unitSubjectKey): the tax ask lives on unit-tax
  // as try 1, the chatbot unit never asked. A job is bound to its answers by jobs.unit_id, never by
  // a retry_of spelled across units.
  fx.seed(l=>l.transaction(db=>{
    const at=Date.now();
    createUnit(db,{workflowId:wf,unitId:'unit-tax',opId:'provision.ask',subjectKey:'subject:tax',goalRevision:1,createdAt:at});
    createUnit(db,{workflowId:wf,unitId:'unit-chatbot',opId:'provision.ask',subjectKey:'subject:chatbot',goalRevision:1,createdAt:at});
    enqueueJob(db,{jobId:'job-tax',workflowId:wf,unitId:'unit-tax',opId:'provision.ask',kind:'op',role:'op',
      payload:{opId:'provision.ask',params:{subject:'tax'}},createdAt:at});
    setJobStatus(db,{jobId:'job-tax',to:'ready',reason:'dispatch',at});
    setJobStatus(db,{jobId:'job-tax',to:'leased',reason:'dispatch',at});
    const attempt=startAttempt(db,{workflowId:wf,jobId:'job-tax',dispatchId:'ctx_tax',dispatchedAt:at,startedAt:at,at});
    setJobStatus(db,{jobId:'job-tax',to:'running',reason:'worker live',at});
    fileReport(db,{attemptId:attempt.attempt_id,outcome:'ask',
      report:{outcome:'ask',summary:'tax decision needed',from:'job-tax',dispatch:'ctx_tax',question:{text:'Which tax regime?',options:['VAT','none']}},createdAt:at});
    markReportConsumed(db,{attemptId:attempt.attempt_id,at});
    setJobStatus(db,{jobId:'job-tax',to:'reported',reason:'report filed',at});
    setJobStatus(db,{jobId:'job-tax',to:'deciding',reason:'settle',at});
    setJobStatus(db,{jobId:'job-tax',to:'awaiting_owner',reason:'awaiting owner',at});
    recordJobResult(db,{jobId:'job-tax',result:{verdict:'awaiting-owner'},at});
    appendEvent(db,{workflowId:wf,entityType:'report',entityId:'ctx_tax',kind:'ask-answered',
      payload:{dispatchId:'ctx_tax',optionIndex:0,answeredBy:'owner'},createdAt:at});
  }));
  const retryOf=(subject)=>({job_id:`job-${subject}-2`,workflow_id:wf,unit_id:`unit-${subject}`,
    payload_json:json({params:{subject},retry:{retryOf:'job-tax'}})});
  fx.read(db=>{
    assert.deepEqual(ownerAnswersOf(db,retryOf('tax')).map(a=>[a.dispatchId,a.chosen]),[['ctx_tax',{index:0,label:'VAT'}]]);
    assert.deepEqual(ownerAnswersOf(db,retryOf('chatbot')),[],'the chatbot unit\'s earlier tries never asked about tax');
  });
});
