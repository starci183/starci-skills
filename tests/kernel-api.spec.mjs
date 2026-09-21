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
// Lane k7: this spec is written against the lane contract for api.mjs —
//   survey|status|hierarchy|plan|enqueue|dispatch|settle|incident|finish
//   --repo <path> --workflow <id> [--job <id>] [--kind <k>] [--op <id>]
//   [--verdict pass|fail] [--report <file>] --json
// wrapping kernel/ledger-db.mjs tables (workflows, goals, inbox, jobs,
// signals, incidents, events). api.mjs lands in a sibling lane; until it does
// every test here is skipped (the gate lane runs them after all lanes land).
const API_EXISTS=fs.existsSync(API);
const skip=API_EXISTS?false:'scripts/kernel/api.mjs has not landed yet — written against the lane contract';

const runApi=(...args)=>spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000});
const out=r=>{try{return JSON.parse(r.stdout);}catch{return null;}};

/** One temp Work root per test: a plain directory; openLedger creates .starciwork/runtime.sqlite on demand. */
const fixture=t=>{
  const dirs=[];
  t.after(()=>{for(const dir of dirs)fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25});});
  return {repo(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-kapi-'));dirs.push(dir);return dir;}};
};
/** Seed rows through the ledger API, then close so the spawned CLI never shares the handle. */
const seed=(repo,fn)=>{const ledger=openLedger({file:ledgerFileFor(repo)});try{fn(ledger);}finally{ledger.close();}};
const read=(repo,fn)=>{const ledger=inspectLedger({file:ledgerFileFor(repo)});try{return fn(ledger);}finally{ledger.close();}};
const json=v=>JSON.stringify(v??null);

/** A workflow with a goal revision and a pending inbox goal row — the shape define-goal.mjs writes. */
const seedGoal=(repo,workflowId)=>{
  seed(repo,ledger=>{
    const at=Date.now();
    ledger.ensureWorkflow({workflowId,title:'k7 api smoke'});
    ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
      .run(workflowId,0,'k7goal','# goal',json({derivedFrom:'k7-test'}),at);
    ledger.db.prepare("INSERT INTO inbox(workflow_id,kind,key,payload_json,status,created_at) VALUES(?,?,?,?,'pending',?)")
      .run(workflowId,'goal',workflowId,json({prompt:'k7'}),at);
  });
};

test('survey on an empty workflow exits 0 with a sane empty result',{skip},t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-empty';
  seed(repo,ledger=>ledger.ensureWorkflow({workflowId:wf,title:'empty'}));
  const r=runApi('survey','--repo',repo,'--workflow',wf,'--json');
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const body=out(r);
  assert.ok(body&&typeof body==='object',`survey --json should print a JSON object, got: ${r.stdout}`);
  // Nothing exists yet — whatever summary shape the CLI chose, it must not invent rows.
  for(const key of ['jobs','events','inbox','incidents','signals'])
    if(Array.isArray(body[key]))assert.equal(body[key].length,0,`empty workflow but survey.${key} is non-empty`);
});

test('enqueue writes a queued job row the ledger can see',{skip},t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-enqueue';
  seedGoal(repo,wf);
  const r=runApi('enqueue','--repo',repo,'--workflow',wf,'--op','ex-test.probe','--paths','docs/',
    '--records','scope.workspace-canonicalization,scope.workspace-canonicalization',
    '--cut-id','consumer-migration','--cut-ordinal','1','--cut-total','3','--json');
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const jobs=read(repo,l=>l.db.prepare('SELECT * FROM jobs WHERE workflow_id=?').all(wf));
  assert.ok(jobs.length>=1,'enqueue produced no jobs row');
  const job=jobs.find(j=>j.op_id==='ex-test.probe')??jobs[0];
  assert.equal(job.status,'queued',`fresh job must be queued, got ${job.status}`);
  const payload=JSON.parse(job.payload_json);
  assert.deepEqual(payload.records,['scope.workspace-canonicalization'],
    'enqueue must persist the explicit closed Work-record read set');
  assert.deepEqual(payload.goal_binding,{revision:0,identity:'k7goal'},
    'enqueue must freeze the approved goal binding for this durable attempt');
  assert.deepEqual(payload.cut,{id:'consumer-migration',ordinal:1,total:3},
    'enqueue must durably bind one bounded slice to its stable cut set');
});

test('status marks a running workflow with no operation frontier as orphaned-frontier',{skip},t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-orphaned';
  seedGoal(repo,wf);
  seed(repo,ledger=>ledger.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id=?").run(wf));
  const r=runApi('status','--repo',repo,'--workflow',wf,'--json');
  assert.equal(r.status,0,r.stderr||r.error?.message);
  assert.deepEqual(out(r)?.frontier,{
    state:'orphaned-frontier',openOperations:0,unconsumedReports:0,nudgeReadyJobs:[],
    reason:'workflow is running but has no open operation and no unconsumed report; Kernel must derive/repair the next approved transition or finish',
  });
});

test('hierarchy projects workflow -> Kernel -> Op from durable job identity',{skip},t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-hierarchy';
  seedGoal(repo,wf);
  seed(repo,ledger=>{
    const at=Date.now();
    ledger.db.prepare("INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,worker_id,created_at,updated_at) VALUES(?,?,NULL,1,0,'kernel','kernel',?,'running',?,?,?)")
      .run(`kernel-${wf}`,wf,json({
        route:{host:'orca',agent:'codex',model:'gpt-5.6-sol',runtimePool:'codex-agent'},
        hierarchy:{schema:'starci/agent-hierarchy@1',nodeId:`agent:kernel:${wf}`,parentNodeId:`workflow:${wf}`,role:'kernel',runtime:{host:'orca',agent:'codex',model:'gpt-5.6-sol',terminalHandle:'term-kernel'}},
      }),'term-kernel',at,at);
  });
  const enq=runApi('enqueue','--repo',repo,'--workflow',wf,'--op','ex-test.probe','--paths','docs/','--json');
  assert.equal(enq.status,0,enq.stderr);
  const h=runApi('hierarchy','--repo',repo,'--workflow',wf,'--json');
  assert.equal(h.status,0,h.stderr);
  const body=out(h);
  assert.equal(body?.schema,'starci/agent-hierarchy@1');
  assert.equal(body?.workflow?.nodeId,`workflow:${wf}`);
  const kernel=body?.nodes?.find(n=>n.role==='kernel');
  const op=body?.nodes?.find(n=>n.role==='operation');
  assert.equal(kernel?.nodeId,`agent:kernel:${wf}`);
  assert.equal(kernel?.parentNodeId,`workflow:${wf}`);
  assert.equal(kernel?.runtime?.agent,'codex');
  assert.equal(kernel?.runtime?.model,'gpt-5.6-sol');
  assert.equal(op?.parentNodeId,kernel?.nodeId);
  assert.equal(op?.opId,'ex-test.probe');
  assert.ok(body?.edges?.some(e=>e.parentNodeId===kernel.nodeId&&e.childNodeId===op.nodeId));
});

test('status projects exact host liveness and live jobs cannot route or dispatch again',{skip},t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-liveness',jobId='op-k7-live';
  seedGoal(repo,wf);
  seed(repo,ledger=>{
    const at=Date.now();
    ledger.db.prepare("INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,worker_id,created_at,updated_at) VALUES(?,?,?,1,0,'op','op',?,'running',?,?,?)")
      .run(jobId,wf,'ex-test.probe',json({opId:'ex-test.probe',owned_paths:['docs/'],orca:{dispatchId:'ctx-k7-live',agentTerminalHandle:'term-k7-op'},hierarchy:{runtime:{host:'orca',agent:'devin',dispatchId:'ctx-k7-live',terminalHandle:'term-k7-op'}}}),'term-k7-op',at,at);
    ledger.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
      .run(wf,'ex-test.probe',1,'ctx-k7-live','# live contract',json({}),at);
  });
  const fakeRoot=fs.mkdtempSync(path.join(os.tmpdir(),'starci-kapi-live-'));
  t.after(()=>fs.rmSync(fakeRoot,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const stub=path.join(fakeRoot,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const callsFile=path.join(fakeRoot,'calls.jsonl');
  fs.writeFileSync(path.join(fakeRoot,'state.json'),JSON.stringify({sends:1}));
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG:callsFile,STARCI_FAKE_ORCA_STATE:path.join(fakeRoot,'state.json'),LOCALAPPDATA:path.join(fakeRoot,'localappdata')};
  const runLive=(...args)=>spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  const status=spawnSync(process.execPath,[API,'status','--repo',repo,'--workflow',wf,'--json'],
    {cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  assert.equal(status.status,0,status.stderr||status.error?.message);
  const worker=out(status)?.workers?.find(item=>item.jobId===jobId);
  assert.equal(worker?.terminalHandle,'term-k7-op');
  assert.equal(worker?.liveness,'active');
  assert.equal(worker?.connected,true);
  assert.equal(worker?.writable,true);
  const route=runApi('route','--repo',repo,'--job',jobId,'--json');
  assert.notEqual(route.status,0,'a live job must never be rerouted');
  assert.match(`${route.stdout}${route.stderr}`,/job-not-queued/);
  const dispatch=runApi('dispatch','--repo',repo,'--job',jobId,'--json');
  assert.notEqual(dispatch.status,0,'a live job must never be dispatched twice');
  assert.match(`${dispatch.stdout}${dispatch.stderr}`,/job-not-queued/);

  // Regression for an old reserve-rejection bug: the ledger was returned to
  // queued and its lease dropped although the original exact worker stayed
  // alive. Status must expose that mismatch, duplicate route/dispatch must
  // fail closed, and reconcile reattaches the worker + lease without spawn.
  seed(repo,ledger=>ledger.db.prepare("UPDATE jobs SET status='queued',worker_id=NULL,lease_token=NULL,deadline=NULL WHERE job_id=?").run(jobId));
  const driftStatus=runLive('status','--repo',repo,'--workflow',wf,'--json');
  assert.equal(driftStatus.status,0,driftStatus.stderr);
  const driftWorker=out(driftStatus)?.workers?.find(item=>item.jobId===jobId);
  assert.equal(driftWorker?.ledgerStatus,'queued');
  assert.equal(driftWorker?.liveness,'active');
  const driftRoute=runLive('route','--repo',repo,'--job',jobId,'--json');
  assert.notEqual(driftRoute.status,0);
  assert.match(`${driftRoute.stdout}${driftRoute.stderr}`,/job-live-worker/);
  const driftDispatch=runLive('dispatch','--repo',repo,'--job',jobId,'--json');
  assert.notEqual(driftDispatch.status,0);
  assert.match(`${driftDispatch.stdout}${driftDispatch.stderr}`,/job-live-worker/);
  const reconciled=runLive('reconcile','--repo',repo,'--job',jobId,'--json');
  assert.equal(reconciled.status,0,reconciled.stderr||reconciled.stdout);
  assert.equal(out(reconciled)?.status,'running');
  const repaired=read(repo,ledger=>({
    job:ledger.db.prepare('SELECT status,worker_id FROM jobs WHERE job_id=?').get(jobId),
    leases:ledger.db.prepare('SELECT count(*) n FROM leases WHERE job_id=?').get(jobId).n,
  }));
  assert.equal(repaired.job?.status,'running');
  assert.equal(repaired.job?.worker_id,'term-k7-op');
  assert.equal(repaired.leases,1);
});

test('status distinguishes a turn-idle Op and nudge wakes the exact worker without creating a job',{skip},t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-nudge',jobId='op-k7-idle';
  seedGoal(repo,wf);
  seed(repo,ledger=>{
    const at=Date.now();
    ledger.db.prepare("INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,worker_id,created_at,updated_at) VALUES(?,?,?,1,0,'op','op',?,'running',?,?,?)")
      .run(jobId,wf,'ex-test.probe',json({opId:'ex-test.probe',owned_paths:['docs/'],orca:{dispatchId:'ctx-k7-idle',agentTerminalHandle:'term-k7-idle'},hierarchy:{runtime:{host:'orca',agent:'devin',dispatchId:'ctx-k7-idle',terminalHandle:'term-k7-idle'}}}),'term-k7-idle',at,at);
    ledger.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
      .run(wf,'ex-test.probe',1,'ctx-k7-idle','# idle contract',json({}),at);
  });
  const fakeRoot=fs.mkdtempSync(path.join(os.tmpdir(),'starci-kapi-nudge-'));
  t.after(()=>fs.rmSync(fakeRoot,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const stub=path.join(fakeRoot,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const stateFile=path.join(fakeRoot,'state.json');fs.writeFileSync(stateFile,JSON.stringify({sends:0}));
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG:path.join(fakeRoot,'calls.jsonl'),STARCI_FAKE_ORCA_STATE:stateFile,LOCALAPPDATA:path.join(fakeRoot,'localappdata')};
  const runLive=(...args)=>spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});

  const before=runLive('status','--repo',repo,'--workflow',wf,'--json');
  assert.equal(before.status,0,before.stderr);
  assert.equal(out(before)?.workers?.find(item=>item.jobId===jobId)?.liveness,'turn-idle');
  assert.equal(out(before)?.frontier?.state,'worker-nudge-ready');
  assert.deepEqual(out(before)?.frontier?.nudgeReadyJobs,[jobId]);

  const nudged=runLive('nudge','--repo',repo,'--job',jobId,'--json');
  assert.equal(nudged.status,0,nudged.stderr||nudged.stdout);
  assert.equal(out(nudged)?.nudged,true);
  assert.equal(JSON.parse(fs.readFileSync(stateFile,'utf8')).sends,1,'nudge must send once to the exact terminal');
  const durable=read(repo,ledger=>({
    jobs:ledger.db.prepare('SELECT count(*) n FROM jobs WHERE workflow_id=?').get(wf).n,
    status:ledger.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId).status,
    event:ledger.db.prepare("SELECT kind FROM events WHERE workflow_id=? AND entity_id=? ORDER BY seq DESC LIMIT 1").get(wf,jobId)?.kind,
  }));
  assert.deepEqual(durable,{jobs:1,status:'running',event:'op-worker-nudged'});
  const after=runLive('status','--repo',repo,'--workflow',wf,'--json');
  assert.equal(out(after)?.workers?.find(item=>item.jobId===jobId)?.liveness,'active');
});

test('dispatch --job without --spawn prints the packet and leaves the job unclaimed',{skip},t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-dispatch';
  seedGoal(repo,wf);
  const enq=runApi('enqueue','--repo',repo,'--workflow',wf,'--op','ex-test.probe','--paths','docs/',
    '--records','scope.workspace-canonicalization','--json');
  assert.equal(enq.status,0,enq.stderr);
  const jobId=out(enq)?.jobId??out(enq)?.job_id??read(repo,l=>l.db.prepare('SELECT job_id FROM jobs WHERE workflow_id=?').get(wf))?.job_id;
  assert.ok(jobId,'could not resolve the enqueued job id');
  seed(repo,ledger=>ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
    .run(wf,1,'k7goal','# later approved revision',json({derivedFrom:'later-test-revision'}),Date.now()));
  const r=runApi('dispatch','--repo',repo,'--workflow',wf,'--job',jobId,'--json');
  assert.equal(r.status,0,r.stderr||r.error?.message);
  assert.ok(r.stdout.trim().length>0,'dispatch without --spawn should print the packet');
  const preview=out(r);
  assert.deepEqual(preview?.packet?.context?.records,['scope.workspace-canonicalization']);
  assert.deepEqual(preview?.packet?.context?.workflow,{id:wf,goal_revision:0,goal_identity:'k7goal'},
    'dispatch must keep the enqueue-time approved revision rather than silently adopting a later one');
  assert.match(preview?.prompt??'',/records: scope\.workspace-canonicalization/);
  assert.match(preview?.prompt??'',new RegExp(`workflow: ${wf} goal_revision=0 goal_identity=k7goal`));
  assert.match(preview?.prompt??'',new RegExp(path.join(ROOT,'SKILL.md').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),
    'an Op launched in a routed repo must receive the absolute canonical Source skill path');
  assert.match(preview?.prompt??'',new RegExp(path.join(ROOT,'modules','ops','ops','ex-test.probe.yaml').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),
    'an Op must receive the absolute operation-contract path, not a cwd-relative modules path');
  assert.doesNotMatch(preview?.prompt??'',/SKILL\.md \(repo root\)/);
  const job=read(repo,l=>l.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId));
  assert.notEqual(job?.status,'running','a packet print must not mark the job running — nothing was spawned');
});

test('settle --verdict fail --report marks the job settled and appends an event',{skip},t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-settle';
  seedGoal(repo,wf);
  const enq=runApi('enqueue','--repo',repo,'--workflow',wf,'--op','ex-test.probe','--paths','docs/','--json');
  assert.equal(enq.status,0,enq.stderr);
  const jobId=out(enq)?.jobId??out(enq)?.job_id??read(repo,l=>l.db.prepare('SELECT job_id FROM jobs WHERE workflow_id=?').get(wf))?.job_id;
  assert.ok(jobId);
  const reportFile=path.join(repo,'k7-report.json');
  fs.writeFileSync(reportFile,json({outcome:'failed',summary:'k7 settle smoke',checks:[]}));
  const before=read(repo,l=>l.db.prepare('SELECT count(*) n FROM events WHERE workflow_id=?').get(wf).n);
  const r=runApi('settle','--repo',repo,'--workflow',wf,'--job',jobId,'--verdict','fail','--report',reportFile,'--json');
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const after=read(repo,l=>({
    job:l.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId),
    events:l.db.prepare('SELECT count(*) n FROM events WHERE workflow_id=?').get(wf).n,
  }));
  assert.ok(after.job,'settled job row vanished');
  assert.ok(!['queued','running'].includes(after.job.status),`settled job still live: ${after.job.status}`);
  assert.ok(after.events>before,'settle appended no event');
});

test('cut pass requires the cut-aware green check names before settlement',{skip},t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-cut-settle',jobId='op-k7-cut';
  seedGoal(repo,wf);
  seed(repo,ledger=>{
    const at=Date.now();
    ledger.enqueueJob({jobId,workflowId:wf,opId:'ex-test.probe',kind:'op',payload:{
      opId:'ex-test.probe',owned_paths:['docs/'],cut:{id:'cut-a',ordinal:1,total:2},
    }});
    ledger.db.prepare("UPDATE jobs SET status='running' WHERE job_id=?").run(jobId);
    ledger.db.prepare('INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,from_terminal,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?,NULL,?)')
      .run(wf,jobId,'ex-test.probe',1,0,'done',json({outcome:'done'}),null,at);
    ledger.db.prepare('INSERT INTO checks(workflow_id,op_id,attempt,checks_json,created_at) VALUES(?,?,?,?,?)')
      .run(wf,'ex-test.probe',1,json({checks:[{name:'generic-green',exitCode:0}]}),at);
  });
  const refused=runApi('settle','--repo',repo,'--job',jobId,'--verdict','pass','--json');
  assert.notEqual(refused.status,0,'generic green evidence must not settle a cut pass');
  assert.match(`${refused.stdout}${refused.stderr}`,/cut-checks-missing/);
  seed(repo,ledger=>ledger.db.prepare('UPDATE checks SET checks_json=? WHERE workflow_id=? AND op_id=? AND attempt=1')
    .run(json({checks:[
      {name:'cut-slice-postcondition',exitCode:0},
      {name:'cut-regression-inventory',exitCode:0},
    ]}),wf,'ex-test.probe'));
  const accepted=runApi('settle','--repo',repo,'--job',jobId,'--verdict','pass','--json');
  assert.equal(accepted.status,0,accepted.stderr||accepted.stdout);
  assert.equal(read(repo,ledger=>ledger.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId)?.status),'succeeded');
});

test('incident writes an incidents row for the workflow',{skip},t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-incident';
  seedGoal(repo,wf);
  const r=runApi('incident','--repo',repo,'--workflow',wf,'--op','ex-test.probe','--kind','test','--detail','k7 incident smoke','--json');
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const n=read(repo,l=>l.db.prepare('SELECT count(*) n FROM incidents WHERE workflow_id=?').get(wf).n);
  assert.ok(n>=1,'incident produced no incidents row');
});

test('finish finishes the workflow, closes its inbox and keeps the goals rows',{skip},t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-finish';
  seedGoal(repo,wf);
  const fakeRoot=fs.mkdtempSync(path.join(os.tmpdir(),'starci-kapi-finish-'));
  t.after(()=>fs.rmSync(fakeRoot,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const stub=path.join(fakeRoot,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const callsFile=path.join(fakeRoot,'calls.jsonl');
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG:callsFile,STARCI_FAKE_ORCA_STATE:path.join(fakeRoot,'state.json'),LOCALAPPDATA:path.join(fakeRoot,'localappdata')};
  seed(repo,ledger=>{
    const at=Date.now(),jobId=`kernel-${wf}`;
    ledger.enqueueJob({jobId,workflowId:wf,kind:'kernel',role:'kernel',payload:{
      hierarchy:{schema:'starci/agent-hierarchy@1',nodeId:`agent:kernel:${wf}`,parentNodeId:`workflow:${wf}`,
        role:'kernel',runtime:{host:'orca',agent:'codex',model:'gpt-5.6-sol',terminalHandle:'term-k7-kernel'}},
    }});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='term-k7-kernel' WHERE job_id=?").run(jobId);
    ledger.db.prepare("INSERT INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES('kernel',?,NULL,?,?,?,NULL)")
      .run(wf,'token-k7',json({terminal:'term-k7-kernel',modelAttested:true}),at);
  });
  const goalsBefore=read(repo,l=>l.db.prepare('SELECT count(*) n FROM goals WHERE workflow_id=?').get(wf).n);
  assert.ok(goalsBefore>=1);
  const r=spawnSync(process.execPath,[API,'finish','--repo',repo,'--workflow',wf,'--json'],
    {cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const after=read(repo,l=>({
    phase:l.db.prepare('SELECT phase FROM workflows WHERE workflow_id=?').get(wf)?.phase,
    pending:l.db.prepare("SELECT count(*) n FROM inbox WHERE workflow_id=? AND status='pending'").get(wf).n,
    goals:l.db.prepare('SELECT count(*) n FROM goals WHERE workflow_id=?').get(wf).n,
    kernel:l.db.prepare("SELECT status,worker_id,payload_json FROM jobs WHERE workflow_id=? AND kind='kernel'").get(wf),
    kernelSignals:l.db.prepare("SELECT count(*) n FROM signals WHERE scope='kernel' AND key=?").get(wf).n,
  }));
  assert.equal(after.phase,'finished','finish must set workflows.phase=finished');
  assert.equal(after.pending,0,'finish must close the workflow inbox — no pending rows left');
  assert.equal(after.goals,goalsBefore,'finish finishes the goal, it never deletes the record');
  assert.equal(after.kernelSignals,0,'finish releases the live Kernel singleton signal');
  assert.equal(after.kernel?.status,'succeeded');
  assert.equal(after.kernel?.worker_id,null);
  assert.equal(JSON.parse(after.kernel?.payload_json)?.hierarchy?.runtime?.terminalHandle,null);
  const calls=fs.readFileSync(callsFile,'utf8').trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line).argv);
  assert.ok(calls.some(argv=>argv.slice(0,2).join(' ')==='terminal close'&&argv.includes('term-k7-kernel')),
    'finish must request close of the exact Kernel terminal');
});
