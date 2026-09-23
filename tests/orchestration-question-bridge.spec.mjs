import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {openLedger,inspectLedger,ledgerFileFor} from '../engine/ledger-db.mjs';

// Incidents inc-b944cbaef24b (runtime-orchestration-message-bridge) and inc-20449a260df8
// (runtime-seam-ask-unreachable), starci-next base-repos backend.scaffold: Orca's preamble tells a worker to
// reach its coordinator with an orchestration ask; the coordinator is the Kernel terminal, which may not call
// Orca, and api had no verb to read or answer those messages. A cut ordinal waited on an ESLint question and
// a seam retry on a background ask while status said engaged. The bridge: status projects the pending
// question as the actionable frontier `worker-question`, `api questions` bridges it into the ledger inbox,
// `api reply` answers it (or routes it to the owner through outcome ask) via the Orca reply wrapper.
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};

const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-question-bridge-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const stateFile=path.join(root,'state.json');
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),STARCI_FAKE_ORCA_STATE:stateFile};
  const api=(args,more={})=>spawnSync(process.execPath,[API,...args,'--repo',repo,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:{...env,...more}});
  const orcaState=()=>json(fs.readFileSync(stateFile,'utf8'))??{};
  const writeState=fn=>{const s=orcaState();fn(s);fs.writeFileSync(stateFile,JSON.stringify(s));};
  const workflowId='wf-question-bridge',jobId='job-question-bridge';
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    ledger.enqueueJob({jobId:`kernel-${workflowId}`,workflowId,kind:'kernel',role:'kernel',
      payload:{hierarchy:{schema:'starci/agent-hierarchy@1',nodeId:`agent:kernel:${workflowId}`,parentNodeId:`workflow:${workflowId}`,role:'kernel'}}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id=?").run(`kernel-${workflowId}`);
    ledger.enqueueJob({jobId,workflowId,opId:'code.refactor',kind:'op',payload:{opId:'code.refactor',owned_paths:['docs/'],model:'codex-agent',difficulty:'hard',
      cut:{id:'be-baseline-r1-g2',ordinal:3,total:5}}});
  }finally{ledger.close();}
  const read=fn=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return fn(l.db);}finally{l.close();}};
  return {repo,workflowId,jobId,api,orcaState,writeState,read};
};

// Orca's inbox row for a worker ask (the shape `orchestration inbox --json` returns).
const question=(id,{run='run-fake-1',dispatch,text,options=[]})=>({id,run_id:run,delivery_contract:'current_delivery',
  from_handle:`dispatch:${dispatch}`,to_handle:`run:${run}`,subject:'Question',body:text,type:'question',priority:'normal',
  thread_id:id,payload:JSON.stringify({taskId:'task-fake-1',dispatchId:dispatch,question:text,options}),read:0,created_at:new Date().toISOString()});

test('a worker orchestration ask is surfaced, bridged into the ledger and answered through api reply',t=>{
  const fx=fixture(t);
  const d=fx.api(['dispatch','--job',fx.jobId,'--model','codex-agent','--spawn']);
  assert.equal(d.status,0,d.stderr||d.stdout);
  const dispatchId=json(d.stdout).dispatchId;
  assert.ok(dispatchId);
  const eslint='Ordinal 3 needs eslint.config.mjs, which ordinal 1 owns. Should I lint only my own paths?';
  fx.writeState(s=>{s.messages=[
    question('msg_q1',{dispatch:dispatchId,text:eslint,options:['Only my paths','Wait for ordinal 1']}),
    question('msg_other',{run:'run-another-workflow',dispatch:'ctx_elsewhere',text:'not this workflow'}),
    {id:'msg_hb',run_id:'run-fake-1',from_handle:`dispatch:${dispatchId}`,type:'heartbeat',subject:'alive',body:'',thread_id:null,payload:null},
  ];});

  // status: the question is the actionable frontier, not a bare `engaged`.
  const status=json(fx.api(['status','--workflow',fx.workflowId]).stdout);
  assert.equal(status.frontier.state,'worker-question');
  assert.equal(status.frontier.actionable,true);
  assert.deepEqual(status.frontier.workerQuestionJobs,[fx.jobId]);
  assert.deepEqual(status.workerQuestions.map(q=>[q.messageId,q.jobId,q.question,q.bridged]),[['msg_q1',fx.jobId,eslint,false]]);
  assert.deepEqual(status.workerQuestions[0].options,['Only my paths','Wait for ordinal 1']);
  assert.equal(fx.read(db=>db.prepare("SELECT count(*) n FROM inbox WHERE kind='worker-question'").get().n),0,'status writes nothing');

  // questions bridges it once into the ledger inbox.
  const bridged=fx.api(['questions','--workflow',fx.workflowId]);
  assert.equal(bridged.status,0,bridged.stderr);
  assert.deepEqual([json(bridged.stdout).bridged,json(bridged.stdout).pending.map(q=>q.messageId)],[1,['msg_q1']]);
  assert.equal(json(fx.api(['questions','--workflow',fx.workflowId]).stdout).bridged,0,'idempotent');
  const row=fx.read(db=>db.prepare("SELECT * FROM inbox WHERE kind='worker-question' AND key='msg_q1'").get());
  assert.equal(row.status,'pending');
  assert.equal(json(row.payload_json).jobId,fx.jobId);
  assert.equal(fx.read(db=>db.prepare("SELECT count(*) n FROM events WHERE kind='worker-question-bridged'").get().n),1);

  // reply answers the exact message in its Run and the ledger records it.
  const answer='Lint only your own owned paths; the set-closing pass runs the full lint.';
  const replied=fx.api(['reply','--workflow',fx.workflowId,'--message','msg_q1','--body',answer]);
  assert.equal(replied.status,0,replied.stderr);
  assert.deepEqual(fx.orcaState().replies,[{id:'msg_q1',body:answer,run:'run-fake-1'}]);
  const answered=fx.read(db=>db.prepare("SELECT status,disposition_json FROM inbox WHERE kind='worker-question' AND key='msg_q1'").get());
  assert.equal(answered.status,'applied');
  assert.equal(json(answered.disposition_json).reply,answer);
  assert.equal(fx.read(db=>db.prepare("SELECT count(*) n FROM events WHERE kind='worker-question-answered' AND entity_id=?").get(fx.jobId).n),1);
  const after=json(fx.api(['status','--workflow',fx.workflowId]).stdout);
  assert.deepEqual(after.workerQuestions,[]);
  assert.notEqual(after.frontier.state,'worker-question');
  const again=fx.api(['reply','--workflow',fx.workflowId,'--message','msg_q1','--body','again']);
  assert.equal(again.status,1);
  assert.equal(json(again.stderr.trim().split('\n').at(-1)).code,'question-answered');

  // An owner decision is routed to the ask channel, never answered by the Kernel.
  fx.writeState(s=>{s.messages=[question('msg_q2',{dispatch:dispatchId,text:'Which brand color should the health page use?'}),...s.messages];});
  const routed=fx.api(['reply','--workflow',fx.workflowId,'--message','msg_q2','--to-owner']);
  assert.equal(routed.status,0,routed.stderr);
  assert.equal(json(routed.stdout).toOwner,true);
  assert.match(fx.orcaState().replies.at(-1).body,/outcome ask.*api report/);

  // A reply that does not land writes nothing; the question stays pending.
  fx.writeState(s=>{s.messages=[question('msg_q3',{dispatch:dispatchId,text:'May I add a devDependency?'}),...s.messages];});
  const failed=fx.api(['reply','--workflow',fx.workflowId,'--message','msg_q3','--body','yes'],{STARCI_FAKE_ORCA_REPLY_FAILS:'1'});
  assert.equal(failed.status,1);
  assert.equal(json(failed.stdout).reason,'reply-failed');
  assert.deepEqual(json(fx.api(['status','--workflow',fx.workflowId]).stdout).workerQuestions.map(q=>q.messageId),['msg_q3']);

  // Answered in Orca directly: no longer the Kernel's.
  fx.writeState(s=>{s.messages=[{id:'msg_r3',run_id:'run-fake-1',from_handle:'run:run-fake-1',type:'status',subject:'Re: Question',body:'yes',thread_id:'msg_q3',payload:null},...s.messages];});
  assert.deepEqual(json(fx.api(['status','--workflow',fx.workflowId]).stdout).workerQuestions,[]);

  // A settled job's bridged question is closed; nothing is left to answer.
  fx.writeState(s=>{s.messages=[question('msg_q4',{dispatch:dispatchId,text:'Still there?'}),...s.messages];});
  assert.equal(json(fx.api(['questions','--workflow',fx.workflowId]).stdout).bridged,1);
  const settled=fx.api(['settle','--job',fx.jobId,'--verdict','fail']);
  assert.equal(settled.status,0,settled.stderr);
  assert.equal(fx.read(db=>db.prepare("SELECT status FROM inbox WHERE kind='worker-question' AND key='msg_q4'").get().status),'done');
  const late=fx.api(['reply','--workflow',fx.workflowId,'--message','msg_q4','--body','late']);
  assert.equal(late.status,1);
  assert.equal(json(late.stderr.trim().split('\n').at(-1)).code,'question-answered');
});

test('reply refuses an unknown question and a missing body before any host call',t=>{
  const fx=fixture(t);
  const noBody=fx.api(['reply','--workflow',fx.workflowId,'--message','msg_x']);
  assert.equal(noBody.status,1);
  assert.equal(json(noBody.stderr.trim().split('\n').at(-1)).code,'reply-body-missing');
  const unknown=fx.api(['reply','--workflow',fx.workflowId,'--message','msg_x','--body','hi']);
  assert.equal(unknown.status,1);
  assert.equal(json(unknown.stderr.trim().split('\n').at(-1)).code,'question-unknown');
});
