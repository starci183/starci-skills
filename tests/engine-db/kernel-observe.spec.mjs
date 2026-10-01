import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,ledgerFileFor,openLedger} from '../../engine/db/ledger.mjs';
import {FAKE_ORCA} from '../helpers/fake-orca.mjs';
import {seedWorkflow as seedLedgerWorkflow} from '../helpers/ledger-fixture.mjs';

const ROOT=path.resolve(import.meta.dirname,'..', '..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const out=r=>{try{return JSON.parse(r.stdout);}catch{return null;}};

// `api observe` is the kernel's READ-ONLY window onto its own job's exact op
// terminal — context for reasoning, never evidence. These specs pin:
//   - the worker's output tail, read by Dispatch (worker-read --source auto, deep map T1), plus a typed
//     turnState classified from the rendered frame (turn-idle and active)
//   - typed no-live-worker / job-not-found refusals, never a crash
//   - a dead terminal projects 'disconnected' with ok:true, not a refusal
//   - the 'op-observed' event is a compact receipt — never the output bytes
//   - jobs/contracts/reports/checks/leases rows are untouched and a filed
//     report is never consumed or altered by observation

const fixture=(t,{mode='healthy',sends=0}={})=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-observe-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const stateFile=path.join(root,'state.json');fs.writeFileSync(stateFile,JSON.stringify({sends}));
  const env={...process.env,
    STARCI_ORCA_COMMAND:process.execPath,
    STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_MODE:mode,
    STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),
    STARCI_FAKE_ORCA_STATE:stateFile,
    LOCALAPPDATA:path.join(root,'localappdata'),
    STARCI_PROJECTS_ROOT:path.join(root,'projects'),
    STARCI_TEST_MACHINE_FILE:path.join(root,'machine.sqlite'),
  };
  const priorProjects=process.env.STARCI_PROJECTS_ROOT,priorMachine=process.env.STARCI_TEST_MACHINE_FILE;
  process.env.STARCI_PROJECTS_ROOT=env.STARCI_PROJECTS_ROOT;
  process.env.STARCI_TEST_MACHINE_FILE=env.STARCI_TEST_MACHINE_FILE;
  t.after(()=>{
    if(priorProjects===undefined)delete process.env.STARCI_PROJECTS_ROOT;else process.env.STARCI_PROJECTS_ROOT=priorProjects;
    if(priorMachine===undefined)delete process.env.STARCI_TEST_MACHINE_FILE;else process.env.STARCI_TEST_MACHINE_FILE=priorMachine;
  });
  const run=(...args)=>spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  const calls=()=>fs.existsSync(path.join(root,'calls.jsonl'))
    ?fs.readFileSync(path.join(root,'calls.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l).argv.slice(0,2).join(' '))
    :[];
  return {root,repo,env,run,calls,stateFile};
};

const seed=(repo,fn)=>{const ledger=openLedger({file:ledgerFileFor(repo)});try{fn(ledger);}finally{ledger.close();}};
const read=(repo,fn)=>{const ledger=inspectLedger({file:ledgerFileFor(repo)});try{return fn(ledger.db);}finally{ledger.close();}};
const json=v=>JSON.stringify(v??null);
const seedWorkflow=(repo,workflowId)=>seed(repo,ledger=>seedLedgerWorkflow(ledger,{id:workflowId,state:{phase:'running',job:'observe spec'}}));
// A running op exactly as `api dispatch` leaves it: worker_id is the exact
// terminal handle, payload.orca/hierarchy carry the same binding, and the
// contracts row names the Dispatch it was written for.
const seedRunningOp=(repo,{workflowId,jobId,handle,dispatchId})=>seed(repo,ledger=>{
  const at=Date.now();
  seedLedgerWorkflow(ledger,{id:workflowId,jobs:[{jobId,opId:'ex-test.probe',status:'running',dispatchId,workerId:handle,terminalHandle:handle,
    createdAt:at,updatedAt:at,payload:{opId:'ex-test.probe',owned_paths:['docs/'],orca:{dispatchId,agentTerminalHandle:handle},
      hierarchy:{runtime:{host:'orca',agent:'devin',dispatchId,terminalHandle:handle}}}}]});
  const attemptId=ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get(jobId).attempt_id;
  ledger.db.prepare('INSERT INTO contracts(attempt_id,workflow_id,job_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?)')
    .run(attemptId,workflowId,jobId,'# observe contract',json({}),at);
});
const lastEvent=(repo,wf,jobId)=>read(repo,db=>db.prepare("SELECT kind,payload_json FROM events WHERE workflow_id=? AND entity_id=? ORDER BY seq DESC LIMIT 1").get(wf,jobId));

/* ------------------------------------------------- live worker projection */

test('observe on a running op returns the worker output by Dispatch and a typed turnState, mutating only the events receipt',t=>{
  const fx=fixture(t),wf='wf-observe-live',jobId='op-observe-live';
  seedWorkflow(fx.repo,wf);
  seedRunningOp(fx.repo,{workflowId:wf,jobId,handle:'term-observe-live',dispatchId:'ctx-observe-live'});
  const counts=()=>read(fx.repo,db=>({
    jobs:db.prepare('SELECT count(*) n FROM jobs WHERE workflow_id=?').get(wf).n,
    contracts:db.prepare('SELECT count(*) n FROM contracts WHERE workflow_id=?').get(wf).n,
    reports:db.prepare('SELECT count(*) n FROM reports WHERE workflow_id=?').get(wf).n,
    checks:db.prepare('SELECT count(*) n FROM check_runs WHERE workflow_id=?').get(wf).n,
    leases:db.prepare('SELECT count(*) n FROM leases WHERE job_id=?').get(jobId).n,
    status:db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId).status,
  }));
  const before=counts();
  const r=fx.run('observe','--repo',fx.repo,'--job',jobId,'--json');
  assert.equal(r.status,0,`api observe failed: ${r.stderr||r.stdout}`);
  const body=out(r);
  assert.equal(body?.ok,true);
  assert.equal(body?.job,jobId);
  assert.equal(body?.turnState,'turn-idle','a connected terminal at its input prompt projects turn-idle');
  assert.equal(body?.terminal?.handle,'term-observe-live');
  assert.equal(body?.terminal?.connected,true);
  assert.equal(body?.terminal?.writable,true);
  assert.equal(body?.terminal?.status,'running');
  assert.equal(body?.screen,undefined,'the frame is classified, never returned as context');
  assert.equal(body?.output?.dispatch,'ctx-observe-live','the output is read by the job\'s Dispatch');
  assert.equal(body?.output?.source,'transcript');
  assert.equal(body?.output?.contentComplete,true);
  assert.match(body?.output?.text??'',/fake worker output for ctx-observe-live/,'the output is the worker-read text');

  // Read-only: every durable row is identical; only the events log gains a receipt.
  assert.deepEqual(counts(),before,'observe must not touch jobs/contracts/reports/checks/leases rows');
  const event=lastEvent(fx.repo,wf,jobId);
  assert.equal(event?.kind,'op-observed');
  const payload=JSON.parse(event.payload_json);
  assert.equal(payload.terminal,'term-observe-live');
  assert.equal(payload.turnState,'turn-idle');
  assert.ok(payload.outputBytes>0,'the receipt records the output byte length');
  assert.equal(payload.dispatch,'ctx-observe-live');
  assert.doesNotMatch(event.payload_json,/fake worker output/,'the receipt never stores output bytes');

  // The host surface stayed read-only: show+read only, never send/close/rename.
  assert.ok(fx.calls().length>0,'observe should have read the terminal through orca wrappers');
  for(const verb of fx.calls()) assert.ok(['terminal show','terminal read','orchestration worker-read'].includes(verb),`observe must not call ${verb}`);
});

test('observe --lines bounds the returned tail while turnState still classifies the full frame',t=>{
  const fx=fixture(t,{sends:1}),wf='wf-observe-lines',jobId='op-observe-lines';
  seedWorkflow(fx.repo,wf);
  seedRunningOp(fx.repo,{workflowId:wf,jobId,handle:'term-observe-lines',dispatchId:'ctx-observe-lines'});
  const state=JSON.parse(fs.readFileSync(fx.stateFile,'utf8'));
  state.workerOutput={'ctx-observe-lines':{source:'terminal',pages:[{rows:['l1','l2','l3','l4','l5'],contentComplete:true}]}};
  fs.writeFileSync(fx.stateFile,JSON.stringify(state));
  const r=fx.run('observe','--repo',fx.repo,'--job',jobId,'--lines','2','--json');
  assert.equal(r.status,0,r.stderr||r.stdout);
  const body=out(r);
  assert.equal(body?.turnState,'active','a worker mid-turn projects active');
  assert.equal(body?.output?.text,'l4\nl5','--lines bounds the output to its newest lines');
  assert.equal(body?.output?.contentComplete,false,'a bounded tail never claims the whole output');
  const reads=JSON.parse(fs.readFileSync(fx.stateFile,'utf8')).workerReads??[];
  assert.deepEqual(reads.map(r=>[r.dispatch,r.source,r.limit]),[['ctx-observe-lines','auto','2']]);
});

/* ---------------------------------------------------------- typed states */

test('observe refuses no-live-worker for a job with no bound terminal and job-not-found for an unknown job',t=>{
  const fx=fixture(t),wf='wf-observe-none';
  seedWorkflow(fx.repo,wf);
  seed(fx.repo,ledger=>{
    ledger.write.createUnit({workflowId:wf,unitId:'op-observe-queued',opId:'ex-test.probe',subjectKey:'op-observe-queued',goalRevision:1});
    ledger.enqueueJob({jobId:'op-observe-queued',workflowId:wf,unitId:'op-observe-queued',tryNo:1,opId:'ex-test.probe',kind:'op',payload:{opId:'ex-test.probe',owned_paths:['docs/']}});
  });

  const r=fx.run('observe','--repo',fx.repo,'--job','op-observe-queued','--json');
  assert.notEqual(r.status,0,'a job with no live worker binding must refuse');
  assert.match(`${r.stdout}${r.stderr}`,/no-live-worker/);

  const missing=fx.run('observe','--repo',fx.repo,'--job','op-does-not-exist','--json');
  assert.notEqual(missing.status,0);
  assert.match(`${missing.stdout}${missing.stderr}`,/job-not-found/);
});

test('observe on a dead terminal projects disconnected — typed ok:true, never a crash',t=>{
  const fx=fixture(t,{mode:'dead-terminal'}),wf='wf-observe-dead',jobId='op-observe-dead';
  seedWorkflow(fx.repo,wf);
  seedRunningOp(fx.repo,{workflowId:wf,jobId,handle:'term-observe-dead',dispatchId:'ctx-observe-dead'});

  const r=fx.run('observe','--repo',fx.repo,'--job',jobId,'--json');
  assert.equal(r.status,0,`a dead terminal is a typed projection, not a refusal: ${r.stderr||r.stdout}`);
  const body=out(r);
  assert.equal(body?.ok,true);
  assert.equal(body?.turnState,'disconnected');
  assert.equal(body?.terminal?.connected,false);
  assert.equal(body?.terminal?.writable,false);
  assert.equal(body?.output?.text,null,'a worker Orca cannot read has no output');
  assert.equal(body?.output?.reason,'unreadable');
  const event=lastEvent(fx.repo,wf,jobId);
  assert.equal(event?.kind,'op-observed');
  const payload=JSON.parse(event.payload_json);
  assert.equal(payload.turnState,'disconnected');
  assert.equal(payload.outputBytes,0);
});

/* ------------------------------------------- reports lifecycle untouched */

test('observe never consumes or alters a filed report',t=>{
  const fx=fixture(t),wf='wf-observe-report',jobId='op-observe-report';
  seedWorkflow(fx.repo,wf);
  seedRunningOp(fx.repo,{workflowId:wf,jobId,handle:'term-observe-report',dispatchId:'ctx-observe-report'});
  const envelope={schema:'starci/op-report@1',outcome:'done',summary:'observe must not touch this',files:['docs/'],
    checks:[{name:'self-check',command:'true',exitCode:0}],run:'run-x',task:'task-x',dispatch:'ctx-observe-report',from:jobId};
  seed(fx.repo,ledger=>{
    const attemptId=ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get(jobId).attempt_id;
    ledger.db.prepare("INSERT INTO reports(workflow_id,attempt_id,dispatch_id,job_id,outcome,report_json,from_terminal,consumed_at,created_at) VALUES(?,?,?,?,'done',?,?,NULL,?)")
      .run(wf,attemptId,'ctx-observe-report',jobId,json(envelope),'term-observe-report',Date.now());
  });

  const r=fx.run('observe','--repo',fx.repo,'--job',jobId,'--json');
  assert.equal(r.status,0,r.stderr||r.stdout);
  const row=read(fx.repo,db=>db.prepare('SELECT * FROM reports WHERE workflow_id=?').get(wf));
  assert.equal(row?.outcome,'done');
  assert.equal(row?.consumed_at,null,'observe must never mark a report consumed');
  assert.equal(row?.report_json,json(envelope),'the filed envelope is byte-identical');
});
