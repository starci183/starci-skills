import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {openLedger,inspectLedger,ledgerFileFor} from '../engine/ledger-db.mjs';

// After the 2026-09-24 reboot the Orca sidebar kept the dead ops of every
// workflow as open Tasks under Runs whose coordinator was a pre-reboot
// terminal, and nivo kept a kernel job 'running' for a workflow finished days
// before. `api reconcile --orca-tasks` re-binds the running workflow's Run to
// its live Kernel and closes the open StarCi Tasks no live job holds;
// `api reconcile --orphan-kernel-jobs` settles kernel jobs of finished or
// archived workflows.

const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const op=(id,title=`${id.split('-')[0]}.implement #1`)=>({id,status:'ready',task_title:title,display_name:'[Op] backend.implement'});

const world=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-orca-tasks-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const stateFile=path.join(root,'state.json');
  fs.writeFileSync(stateFile,JSON.stringify({sends:0,
    runs:{'run-a':{id:'run-a',coordinator:'term-old'},'run-old':{id:'run-old',coordinator:'term-gone'}},
    tasks:{
      'run-a':[op('task_live'),op('task_dead'),op('task_orphan'),{id:'task_owner',status:'ready',task_title:'my own task',display_name:'mine'},{...op('task_done'),status:'completed'}],
      'run-old':[op('task_x')],
    },
    terminals:{'term-kernel':{handle:'term-kernel',connected:true,writable:true}}}));
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),STARCI_FAKE_ORCA_STATE:stateFile};
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    const now=Date.now();
    const job=(jobId,workflowId,status,payload,kind='op',worker=null)=>{
      ledger.enqueueJob({jobId,workflowId,opId:kind==='op'?'backend.implement':null,kind,payload});
      ledger.db.prepare('UPDATE jobs SET status=?,worker_id=? WHERE job_id=?').run(status,worker,jobId);
    };
    job('kernel-wf-a','wf-a','running',{orca:{runId:'run-a'}},'kernel','term-kernel');
    job('op-live','wf-a','running',{orca:{runId:'run-a',taskId:'task_live'}});
    job('op-dead','wf-a','succeeded',{orca:{runId:'run-a',taskId:'task_dead'}});
    job('op-old','wf-a','failed',{orca:{runId:'run-old',taskId:'task_x'}});
    job('op-gone','wf-a','succeeded',{orca:{runId:'run-old',taskId:'task_y'}});
    job('kernel-wf-f','wf-f','running',{},'kernel','term-f');
    ledger.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id='wf-a'").run();
    ledger.db.prepare("UPDATE workflows SET phase='finished' WHERE workflow_id='wf-f'").run();
    ledger.db.prepare("INSERT INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES('kernel','wf-f',NULL,'kernel-old',?,?,NULL)")
      .run(JSON.stringify({terminal:'term-f'}),now);
  }finally{ledger.close();}
  const api=(...args)=>{const r=spawnSync(process.execPath,[API,'reconcile','--repo',repo,...args,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
    return {...r,out:(()=>{try{return JSON.parse(r.stdout);}catch{return null;}})()};};
  const state=()=>JSON.parse(fs.readFileSync(stateFile,'utf8'));
  const read=fn=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return fn(l.db);}finally{l.close();}};
  return {api,state,read};
};

test('--orca-tasks re-binds the running Run to the live Kernel and closes only open StarCi Tasks no live job holds',t=>{
  const w=world(t);
  const dry=w.api('--orca-tasks','--dry-run');
  assert.equal(dry.status,0,dry.stderr);
  assert.equal(dry.out.totals.closed,2);
  assert.equal(w.state().runUses,undefined,'a dry run issues no run-use');
  assert.equal(w.state().taskUpdates,undefined,'a dry run closes nothing');

  const r=w.api('--orca-tasks');
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.deepEqual(w.state().runUses,[{id:'run-a',from:'term-kernel'}]);
  assert.deepEqual(w.state().taskUpdates.map(u=>[u.id,u.status,u.run,u.from]),
    [['task_dead','completed','run-a','term-kernel'],['task_orphan','completed','run-a','term-kernel']],
    'the live job\'s Task, the owner\'s own Task and a closed Task are left alone');
  const wfA=r.out.workflows.find(x=>x.workflowId==='wf-a');
  const old=wfA.runs.find(x=>x.runId==='run-old');
  assert.deepEqual(old.unclosable,['task_x'],'a Run with no live coordinator is read only');
  assert.deepEqual(old.ledgerClosed,['op-gone'],'a Task Orca no longer lists is closed in the ledger');
  const closed=w.read(db=>Object.fromEntries(db.prepare("SELECT job_id,json_extract(payload_json,'$.taskClosed.ok') ok FROM jobs WHERE kind='op'").all().map(x=>[x.job_id,x.ok])));
  assert.deepEqual(closed,{'op-live':null,'op-dead':1,'op-old':null,'op-gone':1});
  assert.equal(w.read(db=>db.prepare("SELECT count(*) n FROM events WHERE kind='orca-tasks-reconciled'").get().n),1);

  const again=w.api('--orca-tasks');
  assert.equal(again.status,0);
  assert.equal(again.out.totals.closed,0,'idempotent');
  assert.equal(w.state().runUses.length,1,'the bound Run is not re-bound');
});

test('--orphan-kernel-jobs settles the kernel job of a finished workflow and releases its signal; a running workflow keeps its kernel',t=>{
  const w=world(t);
  const dry=w.api('--orphan-kernel-jobs','--dry-run');
  assert.deepEqual(dry.out.reconciled.map(x=>[x.jobId,x.wouldSettle,x.terminal]),[['kernel-wf-f','cancelled','term-f']]);
  assert.equal(w.read(db=>db.prepare("SELECT status FROM jobs WHERE job_id='kernel-wf-f'").get().status),'running');
  const r=w.api('--orphan-kernel-jobs');
  assert.equal(r.status,0,r.stderr);
  assert.equal(r.out.reconciled[0].signalReleased,true);
  const rows=w.read(db=>({
    f:db.prepare("SELECT status,worker_id,json_extract(result_json,'$.reason') reason FROM jobs WHERE job_id='kernel-wf-f'").get(),
    a:db.prepare("SELECT status FROM jobs WHERE job_id='kernel-wf-a'").get().status,
    signal:db.prepare("SELECT count(*) n FROM signals WHERE key='wf-f'").get().n,
    event:db.prepare("SELECT count(*) n FROM events WHERE kind='orphan-kernel-job-reconciled'").get().n}));
  assert.deepEqual({...rows.f},{status:'cancelled',worker_id:null,reason:'orphan-kernel-job'});
  assert.equal(rows.a,'running');
  assert.equal(rows.signal,0);
  assert.equal(rows.event,1);
  assert.deepEqual(w.api('--orphan-kernel-jobs').out.reconciled,[],'idempotent');
});

test('reconcile still needs --job for the per-job modes',t=>{
  const w=world(t);
  const r=w.api();
  assert.equal(r.status,2);
  assert.match(r.stderr,/reconcile needs --job/);
});
