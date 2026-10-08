import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from '../helpers/fake-orca.mjs';
import {proofRepo} from '../helpers/sonar-scan.mjs';
import {adoptLaunchTrust} from '../helpers/launch-trust.mjs';
import {registerRepoWorkflowWorktree} from '../helpers/workflow-worktree-row.mjs';
import {openLedger,inspectLedger,ledgerFileFor,ensureWorkflow,changeWorkflowPhase,insertGoal,createUnit,enqueueJob,setJobStatus} from '../../engine/db/ledger.mjs';

// Two live incidents on a base-repos backend.scaffold run (an orchestration message bridge gap and an
// unreachable seam ask): Orca's preamble tells a worker to
// reach its coordinator with an orchestration ask; the coordinator is the Kernel terminal, which may not call
// Orca, and api had no verb to read or answer those messages. A cut ordinal waited on an ESLint question and
// a seam retry on a background ask while status said engaged. The bridge (map REPLACE #7): status, questions,
// messages and reply drain the workflow's Runs through the consuming `orchestration check --run <run> --terminal
// <kernel>` into the ledger inbox, ack each Delivery after the commit, and project the pending question as the
// actionable frontier `worker-question`; `starci kernel reply` answers it (or routes it to the owner through outcome ask)
// via the Orca reply wrapper.
const ROOT=path.resolve(import.meta.dirname,'..', '..');
const API=path.join(ROOT,'scripts','kernel','cli.mjs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};

let sharedFixture=null;
const createSharedFixture=()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-question-bridge-'));
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});proofRepo({after:()=>{}},repo);fs.mkdirSync(path.join(repo,'docs'),{recursive:true});
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const stateFile=path.join(root,'state.json');
  const callsFile=path.join(root,'calls.jsonl');
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG:callsFile,STARCI_FAKE_ORCA_STATE:stateFile,
    STARCI_TEST_MACHINE_FILE:path.join(root,'machine.db'),
    ...adoptLaunchTrust(root,{roots:[repo],ref:'private question-bridge fixture adoption'})};  // every fixture registers a repo named 'repo' — isolate the registry
  const rawApi=(args,more={})=>spawnSync(process.execPath,[API,...args,'--repo',repo,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:{...env,...more}});
  const orcaState=()=>json(fs.readFileSync(stateFile,'utf8'))??{};
  const writeState=fn=>{const s=orcaState();fn(s);fs.writeFileSync(stateFile,JSON.stringify(s));};
  const workflowId='wf-question-bridge',jobId='job-question-bridge';
  registerRepoWorkflowWorktree({repo,workflowId,env});
  const ledgerFile=ledgerFileFor(repo);
  const ledger=openLedger({file:ledgerFile});
  try{
    const at=Date.now();
    ledger.transaction(db=>{
      ensureWorkflow(db,{workflowId,phase:'queued',title:'question-bridge',by:'test-fixture',reason:'seed',at});
      insertGoal(db,{workflowId,revision:1,goalIdentity:`goal-${workflowId}`,markdown:'# goal',goal:{},createdAt:at});
      changeWorkflowPhase(db,{workflowId,to:'running',by:'test-fixture',reason:'seed',at});
      enqueueJob(db,{jobId:`kernel-${workflowId}`,workflowId,kind:'kernel',role:'kernel',
        payload:{hierarchy:{schema:'starci/agent-hierarchy@1',nodeId:`agent:kernel:${workflowId}`,parentNodeId:`workflow:${workflowId}`,role:'kernel'}},createdAt:at});
      setJobStatus(db,{jobId:`kernel-${workflowId}`,to:'ready',reason:'seed',at});
      setJobStatus(db,{jobId:`kernel-${workflowId}`,to:'leased',reason:'seed',at});
      setJobStatus(db,{jobId:`kernel-${workflowId}`,to:'running',reason:'seed',at,workerId:'fake-kernel-terminal'});
      const unitId=`unit-${jobId}`;
      createUnit(db,{workflowId,unitId,opId:'code.refactor',subjectKey:unitId,goalRevision:1,createdAt:at});
      enqueueJob(db,{jobId,workflowId,unitId,opId:'code.refactor',kind:'op',
        payload:{opId:'code.refactor',owned_paths:['docs/'],model:'codex-agent',difficulty:'hard',
          cut:{id:'be-baseline-r1-g2',ordinal:3,total:5}},createdAt:at});
    });
  }finally{ledger.close();}
  const read=fn=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return fn(l.db);}finally{l.close();}};
  const snapshot=()=>{
    const checkpointer=openLedger({file:ledgerFile,checkpointer:true});
    try{checkpointer.checkpoint();}finally{checkpointer.close();}
    return {
      ledger:fs.readFileSync(ledgerFile),
      state:fs.existsSync(stateFile)?fs.readFileSync(stateFile):null,
      calls:fs.existsSync(callsFile)?fs.readFileSync(callsFile):null,
    };
  };
  const restore=saved=>{
    for(const file of [ledgerFile,`${ledgerFile}-shm`,`${ledgerFile}-wal`,`${ledgerFile}-journal`])fs.rmSync(file,{force:true});
    fs.writeFileSync(ledgerFile,saved.ledger);
    for(const [file,content] of [[stateFile,saved.state],[callsFile,saved.calls]]){
      if(content===null)fs.rmSync(file,{force:true});else fs.writeFileSync(file,content);
    }
    if(process.env.STARCI_TEST_TEMP_DIR)fs.rmSync(path.join(process.env.STARCI_TEST_TEMP_DIR,'starci-job-scratch'),{recursive:true,force:true,maxRetries:20,retryDelay:25});
  };
  const beforeDispatch=snapshot();
  const dispatch=rawApi(['dispatch','--job',jobId,'--model','codex-agent','--spawn']);
  const afterDispatch=snapshot();
  return {repo,workflowId,jobId,rawApi,orcaState,writeState,read,restore,beforeDispatch,afterDispatch,dispatch,
    cleanup:()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25})};
};
const fixture=(_t,{dispatched=true}={})=>{
  sharedFixture??=createSharedFixture();
  sharedFixture.restore(dispatched?sharedFixture.afterDispatch:sharedFixture.beforeDispatch);
  // The status that surfaces a worker ask drains the Runs: a reaction of the reconciler, which owns it, never of a person reading.
  const api=(args,more={})=>args[0]==='dispatch'?sharedFixture.dispatch:sharedFixture.rawApi(args,['status','questions','messages'].includes(args[0])?{STARCI_ACTOR:'reconciler/job',...more}:more);
  return {...sharedFixture,api};
};
test.after(()=>sharedFixture?.cleanup());

// Orca's message row for a worker ask (the shape `orchestration check --json` delivers).
const question=(id,{run='run-fake-1',dispatch,text,options=[]})=>({id,run_id:run,delivery_contract:'current_delivery',
  from_handle:`dispatch:${dispatch}`,to_handle:`run:${run}`,subject:'Question',body:text,type:'question',priority:'normal',
  thread_id:id,payload:JSON.stringify({taskId:'task-fake-1',dispatchId:dispatch,question:text,options}),read:0,created_at:new Date().toISOString()});

test('a worker orchestration ask is surfaced, bridged into the ledger and answered through starci kernel reply',t=>{
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
  assert.deepEqual(status.workerQuestions.map(q=>[q.messageId,q.jobId,q.question]),[['msg_q1',fx.jobId,eslint]]);
  assert.deepEqual(status.workerQuestions[0].options,['Only my paths','Wait for ordinal 1']);
  // status drained the Run: the question is a ledger row, and the Delivery was acknowledged after that commit.
  assert.equal(fx.read(db=>db.prepare("SELECT count(*) n FROM inbox WHERE kind='worker-question'").get().n),1,'status bridges the Delivery');
  const checks=fx.orcaState().checks;
  assert.deepEqual(checks[0],{run:'run-fake-1',terminal:'fake-kernel-terminal',ack:null},'the Run is checked naming the Kernel terminal');
  assert.equal(checks[1].ack,'delivery_1','the Delivery is acknowledged after the ledger commit');
  assert.ok(Object.values(fx.orcaState().deliveries).every(d=>d.acked));
  assert.equal(fx.read(db=>db.prepare("SELECT count(*) n FROM events WHERE kind='orchestration-delivery-bridged'").get().n),1);

  // questions finds it bridged once; a second drain writes nothing.
  const bridged=fx.api(['questions','--workflow',fx.workflowId]);
  assert.equal(bridged.status,0,bridged.stderr);
  assert.deepEqual([json(bridged.stdout).bridged,json(bridged.stdout).pending.map(q=>q.messageId)],[0,['msg_q1']]);
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
  assert.match(fx.orcaState().replies.at(-1).body,/outcome ask.*starci kernel report/);

  // A reply that does not land writes nothing; the question stays pending.
  fx.writeState(s=>{s.messages=[question('msg_q3',{dispatch:dispatchId,text:'May I add a devDependency?'}),...s.messages];});
  const failed=fx.api(['reply','--workflow',fx.workflowId,'--message','msg_q3','--body','yes'],{STARCI_FAKE_ORCA_REPLY_FAILS:'1'});
  assert.equal(failed.status,1);
  assert.equal(json(failed.stdout).reason,'reply-failed');
  assert.deepEqual(json(fx.api(['status','--workflow',fx.workflowId]).stdout).workerQuestions.map(q=>q.messageId),['msg_q3']);

  // Answered in Orca directly (a status row threaded onto the question, delivered to the Run): no longer the Kernel's.
  fx.writeState(s=>{s.messages=[{id:'msg_r3',run_id:'run-fake-1',from_handle:'run:run-fake-1',type:'status',subject:'Re: Question',body:'yes',thread_id:'msg_q3',payload:null},...s.messages];});
  assert.deepEqual(json(fx.api(['status','--workflow',fx.workflowId]).stdout).workerQuestions,[]);
  assert.equal(fx.read(db=>json(db.prepare("SELECT disposition_json FROM inbox WHERE kind='worker-question' AND key='msg_q3'").get().disposition_json).reason),'replied-elsewhere');

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

// Live defect: a monorepo run's inbox (thousands of worker heartbeats) passed spawnSync's 1 MB default and
// every `starci kernel questions` failed with `spawnSync orca.exe ENOBUFS`, so Codex ops blocked in `orca orchestration
// ask` never reached the Kernel. A consuming check delivers 50 messages at a
// time: the drain walks every Delivery, counts heartbeats on the Delivery event (Orca keeps lastHeartbeatAt) and
// bridges the ask inside them.
test('a Run of 1600 heartbeats still bridges the Codex worker ask inside it, every Delivery acknowledged',t=>{
  const fx=fixture(t);
  const d=fx.api(['dispatch','--job',fx.jobId,'--model','codex-agent','--spawn']);
  assert.equal(d.status,0,d.stderr||d.stdout);
  const dispatchId=json(d.stdout).dispatchId;
  const handle=fx.read(db=>{const p=json(db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(fx.jobId).payload_json);
    return p.managed?.agentTerminalHandle??p.orca?.agentTerminalHandle??p.hierarchy?.runtime?.terminalHandle;});
  assert.ok(handle,'the dispatched op has an exact terminal');
  const beat=i=>({id:`msg_hb_${i}`,run_id:'run-fake-1',delivery_contract:'current_delivery',from_handle:handle,to_handle:'run:run-fake-1',
    subject:'alive',body:'',type:'heartbeat',priority:'normal',thread_id:null,
    payload:JSON.stringify({taskId:'task-fake-1',dispatchId}),read:0,sequence:i,created_at:new Date().toISOString()});
  // The shape a Codex op's `orca orchestration ask --from term_...` left in the nivo inbox: sent from its
  // terminal handle, the question only in the body, a payload without a question field.
  const codexAsk={...question('msg_codex_ask',{dispatch:dispatchId,text:'Reissue contract, continue per source contract, or report blocked?'}),
    from_handle:handle,payload:JSON.stringify({taskId:'task-fake-1'})};
  fx.writeState(s=>{s.messages=[...Array.from({length:400},(_,i)=>beat(i)),codexAsk,...Array.from({length:1200},(_,i)=>beat(400+i))];});

  const bridged=fx.api(['questions','--workflow',fx.workflowId]);
  assert.equal(bridged.status,0,bridged.stderr);
  const out=json(bridged.stdout);
  assert.equal(out.error,undefined,'every check answered');
  assert.equal(out.bridged,1);
  assert.equal(out.deliveries,33,'1601 messages are 33 Deliveries of at most 50');
  assert.deepEqual(out.pending.map(q=>[q.messageId,q.jobId,q.question]),[['msg_codex_ask',fx.jobId,codexAsk.body]]);
  assert.ok(Object.values(fx.orcaState().deliveries).every(x=>x.acked),'every Delivery acknowledged');
  const beats=fx.read(db=>db.prepare("SELECT payload_json FROM events WHERE kind='orchestration-delivery-bridged'").all().reduce((n,r)=>n+json(r.payload_json).heartbeats,0));
  assert.equal(beats,1600,'heartbeats are counted on the Delivery events');
  assert.equal(fx.read(db=>db.prepare("SELECT count(*) n FROM events WHERE kind='orchestration-message'").get().n),0,'no row per heartbeat');
  assert.equal(json(fx.api(['status','--workflow',fx.workflowId]).stdout).frontier.state,'worker-question');
});

// Live defect: a Codex op sent an escalation ("Blocked: frontend source boundary
// and build lock") and waited for the Kernel's decision; starci kernel reply refused it question-unknown, so no verb
// could answer. An escalation is answered exactly like a question.
test('a worker escalation is surfaced and answered through starci kernel reply',t=>{
  const fx=fixture(t);
  const d=fx.api(['dispatch','--job',fx.jobId,'--model','codex-agent','--spawn']);
  assert.equal(d.status,0,d.stderr||d.stdout);
  const dispatchId=json(d.stdout).dispatchId;
  const text='Build hits EBUSY at apps/app/.next/standalone, held by another workflow server; stop it or give me a separate build.';
  fx.writeState(s=>{s.messages=[{...question('msg_esc1',{dispatch:dispatchId,text}),type:'escalation',subject:'Blocked: build lock',
    payload:JSON.stringify({taskId:'task-fake-1',dispatchId})}];});
  const status=json(fx.api(['status','--workflow',fx.workflowId]).stdout);
  assert.equal(status.frontier.state,'worker-question');
  assert.deepEqual(status.workerQuestions.map(q=>[q.messageId,q.type,q.jobId,q.question]),[['msg_esc1','escalation',fx.jobId,text]]);
  const messages=json(fx.api(['messages','--workflow',fx.workflowId]).stdout);
  assert.match(messages.messages.find(m=>m.id==='msg_esc1').handle,/starci kernel reply --message <id>/);
  const answer='Do not stop it; build with a separate Next distDir or report partial with the EBUSY evidence.';
  const replied=fx.api(['reply','--workflow',fx.workflowId,'--message','msg_esc1','--body',answer]);
  assert.equal(replied.status,0,replied.stderr);
  assert.deepEqual(fx.orcaState().replies,[{id:'msg_esc1',body:answer,run:'run-fake-1'}]);
  assert.equal(fx.read(db=>db.prepare("SELECT count(*) n FROM events WHERE kind='worker-question-answered' AND entity_id=?").get(fx.jobId).n),1);
  assert.deepEqual(json(fx.api(['status','--workflow',fx.workflowId]).stdout).workerQuestions,[]);
});

test('reply refuses an unknown question and a missing body before any host call',t=>{
  const fx=fixture(t,{dispatched:false});
  const noBody=fx.api(['reply','--workflow',fx.workflowId,'--message','msg_x']);
  assert.equal(noBody.status,1);
  assert.equal(json(noBody.stderr.trim().split('\n').at(-1)).code,'reply-body-missing');
  const unknown=fx.api(['reply','--workflow',fx.workflowId,'--message','msg_x','--body','hi']);
  assert.equal(unknown.status,1);
  assert.equal(json(unknown.stderr.trim().split('\n').at(-1)).code,'question-unknown');
});

// Live defect: the supervisor replaced the Collab Kernel (start-workflow, a new terminal); the Run
// still named the old terminal, and starci kernel reply was refused consumer_fenced until some later dispatch rebound
// it. Every Run-scoped call binds the Run to the current Kernel terminal first.
test('a replaced Kernel rebinds the Run before starci kernel reply answers',t=>{
  const fx=fixture(t);
  const d=fx.api(['dispatch','--job',fx.jobId,'--model','codex-agent','--spawn']);
  assert.equal(d.status,0,d.stderr||d.stdout);
  const dispatchId=json(d.stdout).dispatchId;
  assert.equal(fx.orcaState().runs['run-fake-1'].coordinator,'fake-kernel-terminal');
  const l=openLedger({file:ledgerFileFor(fx.repo)});
  try{l.db.prepare("UPDATE jobs SET worker_id='term-kernel-new',updated_at=? WHERE kind='kernel'").run(Date.now());}finally{l.close();}
  fx.writeState(s=>{s.callerTerminal='term-kernel-new';s.messages=[question('msg_q9',{dispatch:dispatchId,text:'Which lint config applies to my paths?'})];});
  const replied=fx.api(['reply','--workflow',fx.workflowId,'--message','msg_q9','--body','The repo root eslint.config.mjs.']);
  assert.equal(replied.status,0,replied.stderr||replied.stdout);
  assert.deepEqual(fx.orcaState().runUses,[{id:'run-fake-1',from:'term-kernel-new'}]);
  assert.equal(fx.read(db=>db.prepare("SELECT count(*) n FROM events WHERE kind='run-rebound'").get().n),1);
});
