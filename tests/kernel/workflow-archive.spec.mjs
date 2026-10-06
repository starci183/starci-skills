// starci kernel archive: the owner's stop for a workflow that will not finish. It sets workflows.archived_at,
// retires the open asks, drops every unsettled operation (leases, worker, Task), releases the Kernel
// seat and closes the Kernel terminal; a second archive writes nothing. The Kernel watchdog ends on an
// archived workflow instead of replacing its Kernel, and finish keeps refusing where it refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from '../helpers/fake-orca.mjs';
import {withLedger,seedWorkflow} from '../helpers/ledger-fixture.mjs';
import {runningWorkflows} from '../../scripts/kernel/managed-repos.mjs';
import {jobResult} from '../../engine/db/ledger.mjs';

const ROOT=path.resolve(import.meta.dirname,'..', '..');
const API=path.join(ROOT,'scripts','kernel','cli.mjs');
const WATCHDOG=path.join(ROOT,'scripts','kernel','kernel-watchdog.mjs');
const WF='wf-archive-spec',PEER='wf-archive-peer',KERNEL_TERM='term-archive-kernel',OP_TERM='term-archive-op';
const HOUR=3600*1000;
const out=r=>{try{return JSON.parse(r.stdout);}catch{return null;}};

const world=(t,fn)=>withLedger(t,({root,repoRoot,machineHome,ledger})=>{
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const stateFile=path.join(root,'orca-state.json'),callsFile=path.join(root,'calls.jsonl');
  fs.writeFileSync(stateFile,JSON.stringify({sends:0,terminals:{
    [KERNEL_TERM]:{handle:KERNEL_TERM,connected:true,writable:true},[OP_TERM]:{handle:OP_TERM,connected:true,writable:true}}}));
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_MODE:'healthy',STARCI_FAKE_ORCA_STATE:stateFile,STARCI_FAKE_ORCA_LOG:callsFile,STARCI_LOCAL_ROOT:machineHome};
  delete env.ORCA_TERMINAL_HANDLE;
  const run=(...args)=>spawnSync(process.execPath,[API,...args,'--repo',repoRoot,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  const calls=()=>fs.existsSync(callsFile)?fs.readFileSync(callsFile,'utf8').trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line).argv):[];
  const at=Date.now();
  for(const id of [WF,PEER]){
    seedWorkflow(ledger,{id,state:{phase:'running'}});
    ledger.db.prepare("UPDATE workflows SET source_roots_json=? WHERE workflow_id=?").run(JSON.stringify([repoRoot]),id);
  }
  seedWorkflow(ledger,{id:WF,jobs:[
    {jobId:`kernel-${WF}`,kind:'kernel',role:'kernel',status:'running',workerId:KERNEL_TERM,
      payload:{hierarchy:{role:'kernel',runtime:{host:'orca',agent:'codex',terminalHandle:KERNEL_TERM}}}},
    {jobId:'job-running',opId:'docs.author',kind:'op',status:'running',workerId:OP_TERM,leaseToken:'tok-running',
      payload:{opId:'docs.author',owned_paths:['docs/'],orca:{dispatchId:OP_TERM,agentTerminalHandle:OP_TERM,taskId:'task-running',runId:'run-archive'},managed:{dispatchId:OP_TERM,agentTerminalHandle:OP_TERM}}},
    {jobId:'job-queued',opId:'docs.author',kind:'op',status:'queued',attempt:2,payload:{opId:'docs.author',owned_paths:['src/']}},
    {jobId:'job-done',opId:'docs.author',kind:'op',status:'succeeded',attempt:3,payload:{opId:'docs.author'},result:{verdict:'pass'}},
    {jobId:'job-ask',opId:'business.decide',kind:'op',status:'awaiting_owner',dispatchId:'ask-open',
      payload:{opId:'business.decide',owned_paths:[]},result:{verdict:'awaiting-owner'}},
  ],leases:[{resourceKey:'path:docs/',jobId:'job-running',expiresAt:at+HOUR}]});
  ledger.db.prepare("INSERT INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES('kernel',?,NULL,'tok-k',?,?,NULL)")
    .run(WF,JSON.stringify({terminal:KERNEL_TERM}),at);
  ledger.db.prepare("INSERT INTO inbox(workflow_id,kind,key,payload_json,status,created_at) VALUES(?,'goal',?,'{}','claimed',?)").run(WF,WF,at);
  const attemptId=ledger.db.prepare("SELECT attempt_id FROM op_attempts WHERE job_id='job-ask'").get().attempt_id;
  ledger.db.prepare("INSERT INTO reports(workflow_id,attempt_id,dispatch_id,job_id,outcome,report_json,created_at) VALUES(?,?,?,?,'ask',?,?)")
    .run(WF,attemptId,'ask-open','job-ask',JSON.stringify({outcome:'ask',question:{text:'Which?',options:['a','b']}}),at);
  const events=(kind,wf=WF)=>ledger.db.prepare('SELECT payload_json FROM events WHERE workflow_id=? AND kind=? ORDER BY seq').all(wf,kind).map(r=>JSON.parse(r.payload_json));
  return fn({repoRoot,ledger,run,calls,events,env});
});

test('archive stops a running workflow: asks retired, open jobs dropped, Kernel and Tasks closed',t=>world(t,({repoRoot,ledger,run,calls,events})=>{
  const r=run('archive','--workflow',WF,'--reason','replaced by the canon-conformance workflow','--by','owner');
  assert.equal(r.status,0,r.stderr||r.stdout);
  const body=out(r);
  assert.equal(body.archived,true);
  assert.deepEqual(body.jobsDropped.map(j=>[j.jobId,j.priorStatus]).sort(),[['job-queued','queued'],['job-running','running']]);
  assert.deepEqual(body.asksRetired,['ask-open']);
  const db=ledger.db;
  const wf=db.prepare('SELECT phase,archived_at FROM workflows WHERE workflow_id=?').get(WF);
  assert.ok(wf.archived_at>0,'archived_at is set');
  assert.equal(wf.phase,'archived','archive records the terminal lifecycle phase');
  const [archivedEvent]=events('workflow-archived');
  assert.deepEqual([archivedEvent.archived.reason,archivedEvent.archived.by,archivedEvent.archived.at],['replaced by the canon-conformance workflow','owner',wf.archived_at]);
  assert.equal(db.prepare("SELECT count(*) n FROM inbox WHERE workflow_id=? AND status NOT IN ('done','applied')").get(WF).n,0,'the goal row is closed');
  for(const jobId of ['job-running','job-queued']){
    const job=db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId);
    assert.equal(job.status,'cancelled');
    assert.deepEqual([jobResult(db,jobId).verdict,jobResult(db,jobId).reason],['dropped','workflow-archived']);
  }
  assert.equal(db.prepare("SELECT status FROM jobs WHERE job_id='job-done'").get().status,'succeeded','a settled job is untouched');
  assert.equal(db.prepare('SELECT count(*) n FROM leases WHERE workflow_id=?').get(WF).n,0,'leases released');
  assert.deepEqual(events('job-dropped').map(e=>e.reason),['workflow-archived','workflow-archived']);
  assert.equal(db.prepare("SELECT count(*) n FROM signals WHERE scope='kernel' AND key=?").get(WF).n,0,'the Kernel signal is deleted');
  const kernel=db.prepare('SELECT status,worker_id FROM jobs WHERE job_id=?').get(`kernel-${WF}`);
  assert.deepEqual([kernel.status,kernel.worker_id,jobResult(db,`kernel-${WF}`).reason],['cancelled',null,'workflow-archived']);
  assert.deepEqual(events('ask-superseded').map(e=>[e.dispatchId,e.reason,e.retired]),[['ask-open','workflow-archived',true]]);
  const running=JSON.parse(db.prepare("SELECT payload_json FROM jobs WHERE job_id='job-running'").get().payload_json);
  assert.deepEqual([running.managedWorker?.dispatchId,running.managedWorker?.custody?.state],[OP_TERM,'released'],'the dropped worker is released and recorded');
  const argv=calls();
  assert.ok(argv.some(a=>a.slice(0,2).join(' ')==='orchestration worker-release'&&a.includes(OP_TERM)),'the worker is released with worker-release');
  // A release is not trusted to end the agent: the runtime closes the released worker's terminal itself (scripts/machine/worker-close.mjs), after the release.
  const heads=argv.map(a=>a.slice(0,2).join(' '));
  assert.ok(argv.some(a=>a.slice(0,2).join(' ')==='terminal close'&&a.includes(OP_TERM)),'the released worker terminal is closed');
  assert.ok(heads.lastIndexOf('terminal close')>heads.lastIndexOf('orchestration worker-release'),'the close follows the release');
  assert.equal(argv.some(a=>a.slice(0,2).join(' ')==='orchestration task-update'),false,'archive closes no Task: the Task of an op belongs to Orca');
  const closes=argv.filter(a=>a.slice(0,2).join(' ')==='terminal close');
  assert.ok(closes.at(-1).includes(KERNEL_TERM),'the Kernel terminal is closed, and closed last');
  assert.equal(body.kernelTerminalCloseRequested,true);
  // Peers: the archived workflow is not running for anyone waiting on it.
  const notify=run('notify','--workflow',PEER,'--to',WF,'--kind','heads-up','--subject','s','--body','b');
  assert.notEqual(notify.status,0);
  assert.match(notify.stderr,/peer-not-running/);
  assert.deepEqual(runningWorkflows(repoRoot).map(w=>w.workflowId),[PEER],'no seat is managed for it');
}));

test('archiving an archived workflow changes nothing and says so',t=>world(t,({ledger,run,calls})=>{
  assert.equal(run('archive','--workflow',WF,'--reason','stop').status,0);
  const seq=ledger.db.prepare('SELECT max(seq) s FROM events').get().s;
  const archivedAt=ledger.db.prepare('SELECT archived_at FROM workflows WHERE workflow_id=?').get(WF).archived_at;
  const callCount=calls().length;
  const again=run('archive','--workflow',WF,'--reason','stop again','--by','supervisor');
  assert.equal(again.status,0,again.stderr);
  assert.deepEqual([out(again).archived,out(again).alreadyArchived,out(again).archivedAt],[false,true,archivedAt]);
  assert.equal(ledger.db.prepare('SELECT max(seq) s FROM events').get().s,seq,'no event written');
  assert.equal(calls().length,callCount,'no host call made');
  const missing=run('archive','--workflow',PEER,'--reason','  ');
  assert.notEqual(missing.status,0);
  assert.match(missing.stderr,/archive-needs-reason/);
  const badBy=run('archive','--workflow',PEER,'--reason','x','--by','nobody');
  assert.match(badBy.stderr,/archive-bad-by/);
  const claimed=run('archive','--workflow',PEER,'--reason','x','--by','kernel');
  assert.match(claimed.stderr,/kernel-caller-actor/,'an unbound owner cannot attest the Kernel');
  assert.equal(ledger.db.prepare('SELECT archived_at FROM workflows WHERE workflow_id=?').get(PEER).archived_at,null,'a refused archive writes nothing');
}));

test('the Kernel watchdog ends on an archived workflow and never replaces its Kernel',t=>world(t,({repoRoot,run,calls,env})=>{
  assert.equal(run('archive','--workflow',WF,'--reason','stop').status,0);
  const before=calls().length;
  const r=spawnSync(process.execPath,[WATCHDOG,'--repo',repoRoot,'--workflow',WF,'--once','--repair','--json'],
    {cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  assert.equal(r.status,0,r.stderr||r.stdout);
  const last=JSON.parse(r.stdout.trim().split(/\r?\n/).pop());
  assert.equal(last.action,'archived','the pass reports archived');
  assert.ok(!calls().slice(before).some(a=>['terminal create','orchestration worker-start'].includes(a.slice(0,2).join(' '))),'no Kernel is started');
}));

test('finish is still refused for open jobs and for a handover the owner never approved',t=>world(t,({ledger,run})=>{
  const open=run('finish','--workflow',WF);
  assert.notEqual(open.status,0);
  assert.match(open.stderr,/workflow-open-jobs/);
  ledger.db.prepare("UPDATE jobs SET status='cancelled' WHERE workflow_id=? AND kind<>'kernel' AND status NOT IN ('succeeded','failed','awaiting_owner')").run(WF);
  const unapproved=run('finish','--workflow',WF);
  assert.notEqual(unapproved.status,0);
  assert.match(unapproved.stderr,/handover-not-approved/);
  assert.equal(ledger.db.prepare('SELECT phase FROM workflows WHERE workflow_id=?').get(WF).phase,'running','a refused finish writes nothing');
}));
