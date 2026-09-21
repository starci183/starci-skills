import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,ledgerFileFor,openLedger} from '../engine/ledger-db.mjs';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';

const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const out=r=>{try{return JSON.parse(r.stdout);}catch{return null;}};

// `api observe` is the kernel's READ-ONLY window onto its own job's exact op
// terminal — context for reasoning, never evidence. These specs pin:
//   - screen tail + typed turnState on a live worker (turn-idle and active)
//   - typed no-live-worker / job-not-found refusals, never a crash
//   - a dead terminal projects 'disconnected' with ok:true, not a refusal
//   - the 'op-observed' event is a compact receipt — never the screen bytes
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
  };
  const run=(...args)=>spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  const calls=()=>fs.existsSync(path.join(root,'calls.jsonl'))
    ?fs.readFileSync(path.join(root,'calls.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l).argv.slice(0,2).join(' '))
    :[];
  return {root,repo,env,run,calls,stateFile};
};

const seed=(repo,fn)=>{const ledger=openLedger({file:ledgerFileFor(repo)});try{fn(ledger);}finally{ledger.close();}};
const read=(repo,fn)=>{const ledger=inspectLedger({file:ledgerFileFor(repo)});try{return fn(ledger.db);}finally{ledger.close();}};
const json=v=>JSON.stringify(v??null);
const seedWorkflow=(repo,workflowId)=>seed(repo,ledger=>ledger.ensureWorkflow({workflowId,title:'observe spec'}));
// A running op exactly as `api dispatch` leaves it: worker_id is the exact
// terminal handle, payload.orca/hierarchy carry the same binding, and the
// contracts row names the Dispatch it was written for.
const seedRunningOp=(repo,{workflowId,jobId,handle,dispatchId})=>seed(repo,ledger=>{
  const at=Date.now();
  ledger.db.prepare("INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,worker_id,created_at,updated_at) VALUES(?,?,?,1,0,'op','op',?,'running',?,?,?)")
    .run(jobId,workflowId,'ex-test.probe',json({opId:'ex-test.probe',owned_paths:['docs/'],orca:{dispatchId,agentTerminalHandle:handle},hierarchy:{runtime:{host:'orca',agent:'devin',dispatchId,terminalHandle:handle}}}),handle,at,at);
  ledger.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(workflowId,'ex-test.probe',1,dispatchId,'# observe contract',json({}),at);
});
const lastEvent=(repo,wf,jobId)=>read(repo,db=>db.prepare("SELECT kind,payload_json FROM events WHERE workflow_id=? AND entity_id=? ORDER BY seq DESC LIMIT 1").get(wf,jobId));

/* ------------------------------------------------- live worker projection */

test('observe on a running op returns the screen tail and typed turnState, mutating only the events receipt',t=>{
  const fx=fixture(t),wf='wf-observe-live',jobId='op-observe-live';
  seedWorkflow(fx.repo,wf);
  seedRunningOp(fx.repo,{workflowId:wf,jobId,handle:'term-observe-live',dispatchId:'ctx-observe-live'});
  const counts=()=>read(fx.repo,db=>({
    jobs:db.prepare('SELECT count(*) n FROM jobs WHERE workflow_id=?').get(wf).n,
    contracts:db.prepare('SELECT count(*) n FROM contracts WHERE workflow_id=?').get(wf).n,
    reports:db.prepare('SELECT count(*) n FROM reports WHERE workflow_id=?').get(wf).n,
    checks:db.prepare('SELECT count(*) n FROM checks WHERE workflow_id=?').get(wf).n,
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
  assert.match(body?.screen??'',/Enter a prompt/,'the screen tail is the observed frame text');

  // Read-only: every durable row is identical; only the events log gains a receipt.
  assert.deepEqual(counts(),before,'observe must not touch jobs/contracts/reports/checks/leases rows');
  const event=lastEvent(fx.repo,wf,jobId);
  assert.equal(event?.kind,'op-observed');
  const payload=JSON.parse(event.payload_json);
  assert.equal(payload.terminal,'term-observe-live');
  assert.equal(payload.turnState,'turn-idle');
  assert.ok(payload.screenBytes>0,'the receipt records the screen byte length');
  assert.doesNotMatch(event.payload_json,/Enter a prompt/,'the receipt never stores screen bytes');

  // The host surface stayed read-only: show+read only, never send/close/rename.
  assert.ok(fx.calls().length>0,'observe should have read the terminal through orca wrappers');
  for(const verb of fx.calls()) assert.ok(['terminal show','terminal read'].includes(verb),`observe must not call ${verb}`);
});

test('observe --lines bounds the returned tail while turnState still classifies the full frame',t=>{
  const fx=fixture(t,{sends:1}),wf='wf-observe-lines',jobId='op-observe-lines';
  seedWorkflow(fx.repo,wf);
  seedRunningOp(fx.repo,{workflowId:wf,jobId,handle:'term-observe-lines',dispatchId:'ctx-observe-lines'});
  const r=fx.run('observe','--repo',fx.repo,'--job',jobId,'--lines','2','--json');
  assert.equal(r.status,0,r.stderr||r.stdout);
  const body=out(r);
  assert.equal(body?.turnState,'active','a worker mid-turn projects active');
  assert.ok((body?.screen??'').split('\n').length<=2,'--lines bounds the screen tail');
});

/* ---------------------------------------------------------- typed states */

test('observe refuses no-live-worker for a job with no bound terminal and job-not-found for an unknown job',t=>{
  const fx=fixture(t),wf='wf-observe-none';
  seedWorkflow(fx.repo,wf);
  seed(fx.repo,ledger=>ledger.enqueueJob({jobId:'op-observe-queued',workflowId:wf,opId:'ex-test.probe',kind:'op',payload:{opId:'ex-test.probe',owned_paths:['docs/']}}));

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
  assert.equal(body?.screen,null,'a dead terminal has no readable screen');
  const event=lastEvent(fx.repo,wf,jobId);
  assert.equal(event?.kind,'op-observed');
  const payload=JSON.parse(event.payload_json);
  assert.equal(payload.turnState,'disconnected');
  assert.equal(payload.screenBytes,0);
});

/* ------------------------------------------- reports lifecycle untouched */

test('observe never consumes or alters a filed report',t=>{
  const fx=fixture(t),wf='wf-observe-report',jobId='op-observe-report';
  seedWorkflow(fx.repo,wf);
  seedRunningOp(fx.repo,{workflowId:wf,jobId,handle:'term-observe-report',dispatchId:'ctx-observe-report'});
  const envelope={schema:'starci/op-report@1',outcome:'done',summary:'observe must not touch this',files:['docs/'],
    checks:[{name:'self-check',command:'true',exitCode:0}],run:'run-x',task:'task-x',dispatch:'ctx-observe-report',from:jobId};
  seed(fx.repo,ledger=>ledger.db.prepare('INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,from_terminal,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?,NULL,?)')
    .run(wf,'ctx-observe-report','ex-test.probe',1,0,'done',json(envelope),'term-observe-report',Date.now()));

  const r=fx.run('observe','--repo',fx.repo,'--job',jobId,'--json');
  assert.equal(r.status,0,r.stderr||r.stdout);
  const row=read(fx.repo,db=>db.prepare('SELECT * FROM reports WHERE workflow_id=?').get(wf));
  assert.equal(row?.outcome,'done');
  assert.equal(row?.consumed_at,null,'observe must never mark a report consumed');
  assert.equal(row?.report_json,json(envelope),'the filed envelope is byte-identical');
});
