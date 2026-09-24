import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {openLedger,inspectLedger,ledgerFileFor} from '../engine/ledger-db.mjs';
import {bindWorkflowRun,staleTasks} from '../scripts/kernel/orca-runs.mjs';

// After the 2026-09-24 reboot every restarted Kernel was rejected at
// task-create with an empty error (nivo inc-5c0ff394e676): the workflow's Run
// still existed, but Orca named the pre-reboot terminal as its coordinator, and
// orcaCall reported only stderr while Orca wrote its refusal as JSON on stdout.
// The fake Orca refuses a task-create from a terminal that is not the Run's
// coordinator the same way; api dispatch must re-bind the Run once and
// dispatch, and a lost Run must be replaced by a new one.

const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const WF='wf-rebind';

const fixture=(t,runs)=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-rebind-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const stateFile=path.join(root,'state.json');
  fs.writeFileSync(stateFile,JSON.stringify({sends:0,runs}));
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),STARCI_FAKE_ORCA_STATE:stateFile};
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    for(const id of ['job-a','job-b'])ledger.enqueueJob({jobId:id,workflowId:WF,opId:'code.refactor',kind:'op',payload:{opId:'code.refactor',owned_paths:[`docs/${id}/`]}});
    const now=Date.now();
    ledger.db.prepare("INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,worker_id,created_at,updated_at) VALUES(?,?,NULL,2,0,'kernel','kernel',?,'running',?,?,?)")
      .run(`kernel-${WF}`,WF,JSON.stringify({orca:{runId:'run-fake-1'},hierarchy:{runtime:{runId:'run-fake-1',terminalHandle:'term-new'}}}),'term-new',now,now);
  }finally{ledger.close();}
  const state=()=>JSON.parse(fs.readFileSync(stateFile,'utf8'));
  const dispatch=jobId=>spawnSync(process.execPath,[API,'dispatch','--repo',repo,'--job',jobId,'--spawn','--json'],
    {cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  const read=fn=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return fn(l.db);}finally{l.close();}};
  return {root,repo,env,state,dispatch,read};
};

test('a restarted Kernel re-binds the durable Run once and dispatches; a later dispatch issues no second run-use',t=>{
  const fx=fixture(t,{'run-fake-1':{id:'run-fake-1',coordinator:'term-old'}});
  const first=fx.dispatch('job-a');
  assert.equal(first.status,0,`dispatch after a kernel restart must succeed: ${first.stderr||first.stdout}`);
  assert.deepEqual(fx.state().runUses,[{id:'run-fake-1',from:'term-new'}]);
  const rebound=fx.read(db=>db.prepare("SELECT payload_json FROM events WHERE kind='run-rebound'").all().map(r=>JSON.parse(r.payload_json)));
  assert.equal(rebound.length,1);
  assert.equal(rebound[0].previousCoordinator,'term-old');
  assert.equal(rebound[0].kernelTerminal,'term-new');
  const second=fx.dispatch('job-b');
  assert.equal(second.status,0,second.stderr||second.stdout);
  assert.equal(fx.state().runUses.length,1,'a bound Run is never re-bound again (a repeated run-use invalidates live Dispatches)');
  assert.equal(fx.read(db=>db.prepare("SELECT json_extract(payload_json,'$.orca.runId') r FROM jobs WHERE job_id='job-b'").get().r),'run-fake-1');
});

test('a Run Orca no longer knows is replaced by a new Run bound to the current Kernel, and the old id is kept',t=>{
  const fx=fixture(t,{'run-fake-1':{id:'run-fake-1',coordinator:'term-old',lost:true}});
  const r=fx.dispatch('job-a');
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.equal(fx.state().runs['run-fake-2'].coordinator,'term-new');
  const kernel=fx.read(db=>JSON.parse(db.prepare(`SELECT payload_json FROM jobs WHERE job_id='kernel-${WF}'`).get().payload_json));
  assert.equal(kernel.orca.runId,'run-fake-2');
  assert.deepEqual(kernel.orca.previousRunIds,['run-fake-1']);
  const created=fx.read(db=>JSON.parse(db.prepare("SELECT payload_json FROM events WHERE kind='run-created'").get().payload_json));
  assert.equal(created.replacedRunId,'run-fake-1');
});

test("an Orca refusal written as JSON on stdout reaches the caller's error instead of an empty string",t=>{
  const fx=fixture(t,{'run-fake-1':{id:'run-fake-1',coordinator:'term-old'}});
  const r=spawnSync(process.execPath,[path.join(ROOT,'scripts','api','orca','task-create.mjs'),'--run','run-fake-1','--spec','x','--from','term-new'],
    {cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:60000,env:fx.env});
  assert.notEqual(r.status,0);
  const out=JSON.parse(r.stdout);
  assert.equal(out.ok,false);
  assert.match(out.error,/not_run_coordinator: Terminal term-new is not the coordinator of run run-fake-1/);
});

test('bindWorkflowRun: bound, rebound, missing and a host that does not answer',()=>{
  const uses=[];
  const use=a=>{uses.push(a);return {ok:true};};
  assert.equal(bindWorkflowRun({runId:'r',kernelHandle:'k'},{show:()=>({ok:true,coordinator:'k'}),use}).action,'bound');
  assert.deepEqual(bindWorkflowRun({runId:'r',kernelHandle:'k'},{show:()=>({ok:true,coordinator:'old'}),use}),
    {ok:true,runId:'r',action:'rebound',previousCoordinator:'old'});
  assert.deepEqual(uses,[{id:'r',from:'k'}]);
  assert.equal(bindWorkflowRun({runId:'r',kernelHandle:'k'},{show:()=>({ok:false,missing:true}),use}).action,'missing');
  const down=bindWorkflowRun({runId:'r',kernelHandle:'k'},{show:()=>({ok:false,hostUnavailable:true,error:'runtime_unavailable'}),use});
  assert.equal(down.action,'failed');
  assert.equal(down.hostUnavailable,true);
  assert.equal(uses.length,1,'no run-use without a proven mismatch');
});

test('staleTasks closes only open StarCi Tasks no live job holds',()=>{
  const old='2026-09-23 08:36:57',now=Date.parse('2026-09-24T06:00:00Z');
  const tasks=[
    {id:'task_a',status:'ready',task_title:'backend.implement #3',display_name:'[Op] backend.implement',created_at:old},
    {id:'task_b',status:'dispatched',task_title:'interface.draw #1',display_name:'[Op] interface.draw',created_at:old},
    {id:'task_c',status:'completed',task_title:'backend.implement #2',display_name:'[Op] backend.implement',created_at:old},
    {id:'task_d',status:'ready',task_title:'owner scratch task',display_name:'mine',created_at:old},
    {id:'task_e',status:'ready',task_title:'backend.implement #4',display_name:'[Op] backend.implement',created_at:'2026-09-24 05:58:00'},
  ];
  const plan=staleTasks(tasks,{heldTaskIds:new Set(['task_b']),now});
  assert.deepEqual(plan.close.map(t=>t.id),['task_a']);
  assert.deepEqual(plan.keep.map(k=>[k.task.id,k.reason]),[['task_b','held-by-live-job'],['task_d','not-starci'],['task_e','recent']]);
});
