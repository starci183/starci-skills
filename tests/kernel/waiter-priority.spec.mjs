import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectLedger,ledgerFileFor,openLedger,ensureWorkflow,changeWorkflowPhase,insertGoal,setJobStatus} from '../../engine/db/ledger.mjs';
import {BLOCKING_HEADS_UP_MS,blockingJobs,blockingLines,orderQueuedByBlocking} from '../../scripts/kernel/waiter-priority.mjs';
import {workflowProgress,workflowSection} from '../../scripts/supervisor/progress-report.mjs';
import {runKernelCli} from '../helpers/kernel-waiter-priority-fixture.mjs';
import {FAKE_ORCA} from '../helpers/fake-orca.mjs';
import {fakeDevinQuotaEnv} from '../helpers/fake-devin-quota.mjs';
// These specs exercise the owner-flow contract; autopilot (scripts/kernel/autopilot-run.mjs, owner ruling 2026-09-28) is
// on by default, so they run with it off - tests/kernel/autopilot.spec.mjs covers the autopilot flow.
process.env.STARCI_AUTOPILOT ??= 'off';

// A job a peer workflow waits on was just another queued row of its own workflow: dispatched in created
// order, and nothing told its Kernel that N workflows sat behind it (nivo AUTH waited on WSPV's
// op-backend.implement-82b3110067 for hours under inc-9f2e1e7ff1f6). waiter-priority.mjs finds every
// waiter of every open job; status orders queued work by that weight and projects blockingOthers, route
// names the heavier job to dispatch first, a job blocking a peer past the threshold without being
// dispatched gets its own Kernel a heads-up, and the supervisor prints one BLOCKING line per job.
const ROOT=path.resolve(import.meta.dirname,'..', '..');
const API=path.join(ROOT,'scripts','kernel','cli.mjs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};
const WAITER='wf-wp-waiter',OWNER='wf-wp-owner',THIRD='wf-wp-third';

const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-waiter-prio-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});for(const d of ["src"])fs.mkdirSync(path.join(repo,d),{recursive:true});
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const env={...process.env,...fakeDevinQuotaEnv(t,path.join(root,'appdata')),
    STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_STATE:path.join(root,'state.json'),STARCI_TEST_MACHINE_FILE:path.join(root,'machine.db')};
  for(const key of ['ORCA_TERMINAL_HANDLE','STARCI_ROLE','STARCI_OP_JOB'])delete env[key];
  // The status pass sends the blocking heads-up: a reaction of the reconciler, which owns it; a person reading status sends nothing.
  const api=args=>runKernelCli({args,repo,env:args[0]==='status'?{...env,STARCI_ACTOR:'reconciler/job'}:env,cwd:ROOT});
  const ledger=openLedger({file:ledgerFileFor(repo,{env})});
  try{
    const at=Date.now();
    ledger.transaction(db=>{
      for(const workflowId of [WAITER,OWNER,THIRD]){
        ensureWorkflow(db,{workflowId,phase:'queued',title:workflowId,ledgerMode:'durable',sourceRoots:[repo],by:'test-fixture',reason:'seed',at});
        insertGoal(db,{workflowId,revision:1,goalIdentity:`goal-${workflowId}`,markdown:'# goal',goal:{derivedFrom:'waiter-priority-spec'},createdAt:at});
        changeWorkflowPhase(db,{workflowId,to:'running',by:'test-fixture',reason:'seed',at});
      }
    });
  }finally{ledger.close();}
  const read=fn=>{const l=inspectLedger({file:ledgerFileFor(repo,{env})});try{return fn(l.db);}finally{l.close();}};
  const seed=fn=>{const l=openLedger({file:ledgerFileFor(repo,{env})});try{return fn(l);}finally{l.close();}};
  const ok=async args=>{const r=await api(args);assert.equal(r.status,0,`${args.join(' ')}: ${r.stderr||r.stdout}`);return json(r.stdout);};
  const status=wf=>ok(['status','--workflow',wf]);
  const enqueue=async(wf,op,paths,extra=[])=>(await ok(['enqueue','--workflow',wf,'--op',op,'--paths',paths,...extra])).job_id;
  // Age an incident's raise (and so its waiters) by `ms`.
  // events are append-only in the current schema (events_append_only trigger): the backdate suspends
  // the trigger for this one write and restores it verbatim.
  const age=(incidentId,ms)=>seed(l=>l.db.exec(`DROP TRIGGER events_append_only;
    UPDATE events SET created_at=created_at-${Number(ms)} WHERE entity_id='${incidentId}' AND kind='incident-raised';
    CREATE TRIGGER events_append_only BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT,'events are append-only'); END;`));
  return {repo,api,ok,read,seed,status,enqueue,age};
};

test('orderQueuedByBlocking puts the heaviest blocking job first and keeps the rest in order',()=>{
  const queued=[{jobId:'a'},{jobId:'b'},{jobId:'c'},{jobId:'d'}];
  const blocking=new Map([['c',{weight:2.5,waiters:[{},{}],waitingWorkflows:['w1','w2'],since:1}],['b',{weight:1.1,waiters:[{}],waitingWorkflows:['w1'],since:2}]]);
  orderQueuedByBlocking(queued,blocking);
  assert.deepEqual(queued.map(q=>q.jobId),['c','b','a','d']);
  assert.deepEqual(queued[0].blocking,{waiters:2,workflows:['w1','w2'],weight:2.5,since:1});
  assert.equal(queued[2].blocking,undefined);
  const withFoundation=[{jobId:'f',foundation:'shell'},{jobId:'x'},{jobId:'y'}];
  orderQueuedByBlocking(withFoundation,new Map([['y',{weight:3,waiters:[{}],waitingWorkflows:['w1'],since:1}]]));
  assert.deepEqual(withFoundation.map(q=>q.jobId),['f','y','x'],'foundation legs keep leading; weight orders the rest');
});

test('a typed --until-job wait makes the awaited job blocking: blockingOthers, queued order and route advice',{concurrency:true},async t=>{
  const fx=fixture(t);
  const first=await fx.enqueue(OWNER,'backend.scaffold','src/a');
  const awaited=await fx.enqueue(OWNER,'backend.implement','src/b');
  const {incidentId}=await fx.ok(['incident','--workflow',WAITER,'--kind','peer-wait','--peer',OWNER,'--op','brand.decide','--until-job',awaited,'--detail','needs the owner module']);
  const owner=(await fx.status(OWNER)).frontier;
  assert.deepEqual(owner.queued.map(q=>q.jobId),[awaited,first],'the job another workflow waits on ranks first although it was enqueued later');
  assert.deepEqual(owner.queued[0].blocking.workflows,[WAITER]);
  assert.equal(owner.blockingOthers.length,1);
  const [b]=owner.blockingOthers;
  assert.deepEqual([b.jobId,b.opId,b.status,b.waiters,b.workflows,b.via.map(({since,...v})=>v)],[awaited,'backend.implement','queued',1,[WAITER],[{workflowId:WAITER,via:'until-job',ref:incidentId}]]);
  assert.equal((await fx.status(WAITER)).frontier.blockingOthers,undefined,'the waiter blocks nobody');

  const route=json((await fx.api(['route','--job',first])).stdout);
  assert.deepEqual(route?.blocking?.outrankedBy?.map(o=>o.jobId),[awaited],JSON.stringify(route));
});

test('an --until-job wait on a failed job blocks through its retry: the open retry ranks first',{concurrency:true},async t=>{
  const fx=fixture(t);
  const awaited=await fx.enqueue(OWNER,'backend.implement','src/b');
  const {incidentId}=await fx.ok(['incident','--workflow',WAITER,'--kind','peer-wait','--peer',OWNER,'--op','brand.decide','--until-job',awaited,'--detail','needs the owner module']);
  fx.seed(l=>l.transaction(db=>{
    const at=Date.now();
    // queued→failed is not a job_transitions edge: walk the job to running, then fail it.
    for(const to of ['ready','leased','running','failed'])setJobStatus(db,{jobId:awaited,to,reason:'seed',at});
  }));
  const first=await fx.enqueue(OWNER,'backend.scaffold','src/a');
  const retry=await fx.enqueue(OWNER,'backend.implement','src/b');
  assert.equal(fx.read(db=>db.prepare('SELECT retry_of FROM jobs WHERE job_id=?').get(retry).retry_of),awaited);
  const owner=(await fx.status(OWNER)).frontier;
  assert.deepEqual(owner.queued.map(q=>q.jobId),[retry,first]);
  assert.deepEqual(owner.blockingOthers.map(b=>[b.jobId,b.via.map(v=>v.ref)]),[[retry,[incidentId]]]);
});

test('free-text gates of another workflow naming a job id, peer requests naming its op or record, and --after count as waiters',{concurrency:true},async t=>{
  const fx=fixture(t);
  const scaffold=await fx.enqueue(OWNER,'interface.scaffold','.starciwork/shell');
  await fx.ok(['incident','--workflow',WAITER,'--kind','owner-gate','--op','interface.draw','--detail',`Ch\u1edd job ${scaffold} settle + sha r\u1ed3i m\u1edbi v\u1ebd l\u1ea1i`]);
  await fx.ok(['notify','--workflow',THIRD,'--to',OWNER,'--kind','request','--subject','need the new shell','--body','please land .starciwork/shell rev 18 (interface.scaffold)']);
  const dependant=await fx.enqueue(OWNER,'interface.implement','src/ui',['--after',scaffold]);
  const entry=fx.read(db=>blockingJobs(db).get(scaffold));
  assert.deepEqual(entry.waiters.map(w=>[w.workflowId,w.via]).sort(),[[OWNER,'dependency'],[THIRD,'peer-request'],[WAITER,'gate-names']].sort());
  assert.deepEqual(entry.waitingWorkflows.sort(),[THIRD,WAITER].sort());
  assert.equal(fx.read(db=>blockingJobs(db).get(dependant)),undefined);
  // A gate naming its OWN workflow's job holds it; it does not wait on it.
  await fx.ok(['incident','--workflow',OWNER,'--kind','owner-gate','--holds',dependant,'--detail',`owner signs ${dependant}`]);
  assert.equal(fx.read(db=>blockingJobs(db).get(dependant)),undefined);
});

test('a queued job blocking another workflow past the threshold gets its Kernel one heads-up per newly waiting workflow',{concurrency:true},async t=>{
  const fx=fixture(t);
  const awaited=await fx.enqueue(OWNER,'backend.implement','src/b');
  const first=(await fx.ok(['incident','--workflow',WAITER,'--kind','peer-wait','--peer',OWNER,'--op','brand.decide','--until-job',awaited,'--detail','x'])).incidentId;
  assert.equal((await fx.status(OWNER)).frontier.peerMessageKeys.length,0,'a young wait is not yet a heads-up');
  fx.age(first,BLOCKING_HEADS_UP_MS+60_000);
  const told=await fx.status(OWNER);
  assert.equal(told.frontier.state,'peer-message');
  assert.equal(told.frontier.actionable,true,'the watchdog wakes the owning Kernel');
  const [message]=told.peerMessages;
  assert.equal(message.from,WAITER);
  assert.match(message.subject,new RegExp(`1 workflow\\(s\\) wait on ${awaited} \\(backend.implement\\)`));
  const payload=fx.read(db=>JSON.parse(db.prepare('SELECT payload_json FROM inbox WHERE key=?').get(message.key).payload_json));
  assert.deepEqual([payload.auto,payload.blockingJob,payload.waitingWorkflows],['blocking-waiters',awaited,[WAITER]]);
  assert.equal((await fx.status(OWNER)).peerMessages.length,1,'told once');

  // A second waiting workflow is news: one more heads-up. A dispatched job is not.
  const second=(await fx.ok(['incident','--workflow',THIRD,'--kind','owner-gate','--op','x','--until-job',awaited,'--detail','x'])).incidentId;
  fx.age(second,BLOCKING_HEADS_UP_MS+60_000);
  assert.equal((await fx.status(OWNER)).peerMessages.length,2);
  fx.seed(l=>l.transaction(db=>{
    const at=Date.now();
    for(const to of ['ready','leased','running'])setJobStatus(db,{jobId:awaited,to,reason:'seed',at});
  }));
  const third=(await fx.ok(['incident','--workflow',WAITER,'--kind','owner-gate','--op','y','--until-job',awaited,'--detail','y'])).incidentId;
  fx.age(third,BLOCKING_HEADS_UP_MS+60_000);
  assert.equal((await fx.status(OWNER)).peerMessages.length,2);
});

test('the supervisor prints one BLOCKING line per job and the progress report names it',{concurrency:true},async t=>{
  const fx=fixture(t);
  const awaited=await fx.enqueue(OWNER,'backend.implement','src/b');
  const {incidentId}=await fx.ok(['incident','--workflow',WAITER,'--kind','peer-wait','--peer',OWNER,'--op','brand.decide','--until-job',`${awaited}:succeeded`,'--detail','x']);
  const lines=fx.read(db=>blockingLines(db));
  assert.equal(lines.length,1);
  assert.match(lines[0],new RegExp(`^BLOCKING wp-owner ${awaited} \\(backend.implement, queued\\) blocks 1 workflow\\(s\\) \\[wp-waiter\\] for 0m via until-job ${incidentId}; not dispatched yet`));
  assert.deepEqual(fx.read(db=>blockingLines(db,{wanted:new Set([THIRD])})),[],'a --workflow filter keeps only its own jobs and waits');
  const row=fx.read(db=>workflowProgress(db,db.prepare('SELECT workflow_id,created_at FROM workflows WHERE workflow_id=?').get(OWNER)));
  assert.deepEqual(row.blocking.map(b=>[b.jobId,b.status]),[[awaited,'queued']]);
  assert.match(workflowSection(row),/⛓ \u0110ang ch\u1eb7n workflow kh\u00e1c: <b>Code backend<\/b>/);
});
