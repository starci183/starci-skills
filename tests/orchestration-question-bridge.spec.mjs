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

// inc-13ab4be5059f: a nivo run's inbox (thousands of worker heartbeats) passed spawnSync's 1 MB default and
// every `api questions` failed with `spawnSync orca.exe ENOBUFS`, so Codex ops blocked in `orca orchestration
// ask` (inc-884fc91be4bc, inc-ee62686a70a3) never reached the Kernel. Reads get a 64 MB buffer and the inbox
// wrapper drops heartbeat/progress rows before anything is bridged.
test('a multi-megabyte inbox of heartbeats still bridges the Codex worker asks inside it',t=>{
  const fx=fixture(t);
  const d=fx.api(['dispatch','--job',fx.jobId,'--model','codex-agent','--spawn']);
  assert.equal(d.status,0,d.stderr||d.stdout);
  const dispatchId=json(d.stdout).dispatchId;
  const handle=fx.read(db=>{const p=json(db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(fx.jobId).payload_json);
    return p.managed?.agentTerminalHandle??p.orca?.agentTerminalHandle??p.hierarchy?.runtime?.terminalHandle;});
  assert.ok(handle,'the dispatched op has an exact terminal');
  const pad='x'.repeat(900);
  const beat=i=>({id:`msg_hb_${i}`,run_id:'run-fake-1',delivery_contract:'current_delivery',from_handle:handle,to_handle:'run:run-fake-1',
    subject:'alive',body:'',type:i%7?'heartbeat':'progress',priority:'normal',thread_id:null,
    payload:JSON.stringify({taskId:'task-fake-1',dispatchId,phase:`verifying ${pad}`}),read:0,sequence:i,created_at:new Date().toISOString()});
  // The shape a Codex op's `orca orchestration ask --from term_…` left in the nivo inbox: sent from its
  // terminal handle, the question only in the body, a payload without a question field.
  const codexAsk={...question('msg_codex_ask',{dispatch:dispatchId,text:'Reissue contract, continue per source contract, or report blocked?'}),
    from_handle:handle,payload:JSON.stringify({taskId:'task-fake-1'})};
  fx.writeState(s=>{s.messages=[...Array.from({length:400},(_,i)=>beat(i)),codexAsk,...Array.from({length:1200},(_,i)=>beat(400+i))];});
  assert.ok(fs.statSync(path.join(path.dirname(fx.repo),'state.json')).size>1.5*1024*1024,'the inbox read is well past the 1 MB default buffer');

  const status=json(fx.api(['status','--workflow',fx.workflowId]).stdout);
  assert.equal(status.frontier.state,'worker-question');
  const bridged=fx.api(['questions','--workflow',fx.workflowId]);
  assert.equal(bridged.status,0,bridged.stderr);
  const out=json(bridged.stdout);
  assert.equal(out.error,undefined,'the host inbox was readable');
  assert.equal(out.bridged,1);
  assert.deepEqual(out.pending.map(q=>[q.messageId,q.jobId,q.question]),[['msg_codex_ask',fx.jobId,codexAsk.body]]);

  // The wrapper itself: heartbeat and progress rows never leave it; --all keeps them.
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([path.join(path.dirname(fx.repo),'fake-orca.mjs')]),
    STARCI_FAKE_ORCA_STATE:path.join(path.dirname(fx.repo),'state.json')};
  const inbox=args=>json(spawnSync(process.execPath,[path.join(ROOT,'scripts','api','orca','orch-inbox.mjs'),...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env,maxBuffer:64*1024*1024}).stdout);
  const filtered=inbox(['--limit','5000']);
  assert.equal(filtered.ok,true);
  assert.deepEqual(filtered.messages.map(m=>m.id),['msg_codex_ask']);
  assert.equal(filtered.dropped,1600);
  assert.equal(inbox(['--limit','5000','--all']).messages.length,1601);
});

// nivo inc-6e7b57326aa5: a Codex op sent escalation msg_8173221888c2 ("Blocked: frontend source boundary
// and build lock") and waited for the Kernel's decision; api reply refused it question-unknown, so no verb
// could answer. An escalation is answered exactly like a question.
test('a worker escalation is surfaced and answered through api reply',t=>{
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
  assert.match(messages.messages.find(m=>m.id==='msg_esc1').handle,/api reply/);
  const answer='Do not stop it; build with a separate Next distDir or report partial with the EBUSY evidence.';
  const replied=fx.api(['reply','--workflow',fx.workflowId,'--message','msg_esc1','--body',answer]);
  assert.equal(replied.status,0,replied.stderr);
  assert.deepEqual(fx.orcaState().replies,[{id:'msg_esc1',body:answer,run:'run-fake-1'}]);
  assert.equal(fx.read(db=>db.prepare("SELECT count(*) n FROM events WHERE kind='worker-question-answered' AND entity_id=?").get(fx.jobId).n),1);
  assert.deepEqual(json(fx.api(['status','--workflow',fx.workflowId]).stdout).workerQuestions,[]);
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
