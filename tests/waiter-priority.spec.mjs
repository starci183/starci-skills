import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,ledgerFileFor,openLedger} from '../engine/ledger-db.mjs';
import {BLOCKING_HEADS_UP_MS,blockingJobs,blockingLines,orderQueuedByBlocking} from '../scripts/kernel/waiter-priority.mjs';
import {workflowProgress,workflowSection} from '../scripts/supervisor/progress-report.mjs';

// A job a peer workflow waits on was just another queued row of its own workflow: dispatched in created
// order, and nothing told its Kernel that N workflows sat behind it (nivo AUTH waited on WSPV's
// op-backend.implement-82b3110067 for hours under inc-9f2e1e7ff1f6). waiter-priority.mjs finds every
// waiter of every open job; status orders queued work by that weight and projects blockingOthers, route
// names the heavier job to dispatch first, a job blocking a peer past the threshold without being
// dispatched gets its own Kernel a heads-up, and the supervisor prints one BLOCKING line per job.
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};
const WAITER='wf-wp-waiter',OWNER='wf-wp-owner',THIRD='wf-wp-third';

const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-waiter-prio-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});
  const env={...process.env};
  for(const key of ['ORCA_TERMINAL_HANDLE','STARCI_ROLE','STARCI_OP_JOB'])delete env[key];
  const api=args=>spawnSync(process.execPath,[API,...args,'--repo',repo,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    const at=Date.now();
    for(const workflowId of [WAITER,OWNER,THIRD]){
      ledger.ensureWorkflow({workflowId,title:workflowId,ledgerMode:'durable',sourceRoots:[repo]});
      ledger.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id=?").run(workflowId);
      ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
        .run(workflowId,0,`goal-${workflowId}`,'# goal',JSON.stringify({derivedFrom:'waiter-priority-spec'}),at);
    }
  }finally{ledger.close();}
  const read=fn=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return fn(l.db);}finally{l.close();}};
  const seed=fn=>{const l=openLedger({file:ledgerFileFor(repo)});try{return fn(l);}finally{l.close();}};
  const ok=args=>{const r=api(args);assert.equal(r.status,0,`${args.join(' ')}: ${r.stderr||r.stdout}`);return json(r.stdout);};
  const status=wf=>ok(['status','--workflow',wf]);
  const enqueue=(wf,op,paths,extra=[])=>ok(['enqueue','--workflow',wf,'--op',op,'--paths',paths,...extra]).job_id;
  // Age an incident's raise (and so its waiters) by `ms`.
  const age=(incidentId,ms)=>seed(l=>l.db.prepare("UPDATE events SET created_at=created_at-? WHERE entity_id=? AND kind='incident-raised'").run(ms,incidentId));
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

test('a typed --until-job wait makes the awaited job blocking: blockingOthers, queued order and route advice',t=>{
  const fx=fixture(t);
  const first=fx.enqueue(OWNER,'backend.scaffold','src/a');
  const awaited=fx.enqueue(OWNER,'backend.implement','src/b');
  const {incidentId}=fx.ok(['incident','--workflow',WAITER,'--kind','peer-wait','--peer',OWNER,'--op','brand.decide','--until-job',awaited,'--detail','needs the owner module']);
  const owner=fx.status(OWNER).frontier;
  assert.deepEqual(owner.queued.map(q=>q.jobId),[awaited,first],'the job another workflow waits on ranks first although it was enqueued later');
  assert.deepEqual(owner.queued[0].blocking.workflows,[WAITER]);
  assert.equal(owner.blockingOthers.length,1);
  const [b]=owner.blockingOthers;
  assert.deepEqual([b.jobId,b.opId,b.status,b.waiters,b.workflows,b.via.map(({since,...v})=>v)],[awaited,'backend.implement','queued',1,[WAITER],[{workflowId:WAITER,via:'until-job',ref:incidentId}]]);
  assert.equal(fx.status(WAITER).frontier.blockingOthers,undefined,'the waiter blocks nobody');

  const route=json(fx.api(['route','--job',first]).stdout);
  assert.deepEqual(route?.blocking?.outrankedBy?.map(o=>o.jobId),[awaited],JSON.stringify(route));
});

test('free-text gates of another workflow naming a job id, peer requests naming its op or record, and --after count as waiters',t=>{
  const fx=fixture(t);
  const scaffold=fx.enqueue(OWNER,'interface.scaffold','.starciwork/shell');
  fx.ok(['incident','--workflow',WAITER,'--kind','owner-gate','--op','interface.draw','--detail',`Chờ job ${scaffold} settle + sha rồi mới vẽ lại`]);
  fx.ok(['notify','--workflow',THIRD,'--to',OWNER,'--kind','request','--subject','need the new shell','--body','please land .starciwork/shell rev 18 (interface.scaffold)']);
  const dependant=fx.enqueue(OWNER,'interface.implement','src/ui',['--after',scaffold]);
  const entry=fx.read(db=>blockingJobs(db).get(scaffold));
  assert.deepEqual(entry.waiters.map(w=>[w.workflowId,w.via]).sort(),[[OWNER,'dependency'],[THIRD,'peer-request'],[WAITER,'gate-names']].sort());
  assert.deepEqual(entry.waitingWorkflows.sort(),[THIRD,WAITER].sort());
  assert.equal(fx.read(db=>blockingJobs(db).get(dependant)),undefined);
  // A gate naming its OWN workflow's job holds it; it does not wait on it.
  fx.ok(['incident','--workflow',OWNER,'--kind','owner-gate','--holds',dependant,'--detail',`owner signs ${dependant}`]);
  assert.equal(fx.read(db=>blockingJobs(db).get(dependant)),undefined);
});

test('a queued job blocking another workflow past the threshold gets its Kernel one heads-up per newly waiting workflow',t=>{
  const fx=fixture(t);
  const awaited=fx.enqueue(OWNER,'backend.implement','src/b');
  const first=fx.ok(['incident','--workflow',WAITER,'--kind','peer-wait','--peer',OWNER,'--op','brand.decide','--until-job',awaited,'--detail','x']).incidentId;
  assert.equal(fx.status(OWNER).frontier.peerMessageKeys.length,0,'a young wait is not yet a heads-up');
  fx.age(first,BLOCKING_HEADS_UP_MS+60_000);
  const told=fx.status(OWNER);
  assert.equal(told.frontier.state,'peer-message');
  assert.equal(told.frontier.actionable,true,'the watchdog wakes the owning Kernel');
  const [message]=told.peerMessages;
  assert.equal(message.from,WAITER);
  assert.match(message.subject,new RegExp(`1 workflow\\(s\\) wait on ${awaited} \\(backend.implement\\)`));
  const payload=fx.read(db=>JSON.parse(db.prepare('SELECT payload_json FROM inbox WHERE key=?').get(message.key).payload_json));
  assert.deepEqual([payload.auto,payload.blockingJob,payload.waitingWorkflows],['blocking-waiters',awaited,[WAITER]]);
  assert.equal(fx.status(OWNER).peerMessages.length,1,'told once');

  // A second waiting workflow is news: one more heads-up. A dispatched job is not.
  const second=fx.ok(['incident','--workflow',THIRD,'--kind','owner-gate','--op','x','--until-job',awaited,'--detail','x']).incidentId;
  fx.age(second,BLOCKING_HEADS_UP_MS+60_000);
  assert.equal(fx.status(OWNER).peerMessages.length,2);
  fx.seed(l=>l.db.prepare("UPDATE jobs SET status='running' WHERE job_id=?").run(awaited));
  const third=fx.ok(['incident','--workflow',WAITER,'--kind','owner-gate','--op','y','--until-job',awaited,'--detail','y']).incidentId;
  fx.age(third,BLOCKING_HEADS_UP_MS+60_000);
  assert.equal(fx.status(OWNER).peerMessages.length,2);
});

test('the supervisor prints one BLOCKING line per job and the progress report names it',t=>{
  const fx=fixture(t);
  const awaited=fx.enqueue(OWNER,'backend.implement','src/b');
  const {incidentId}=fx.ok(['incident','--workflow',WAITER,'--kind','peer-wait','--peer',OWNER,'--op','brand.decide','--until-job',`${awaited}:succeeded`,'--detail','x']);
  const lines=fx.read(db=>blockingLines(db));
  assert.equal(lines.length,1);
  assert.match(lines[0],new RegExp(`^BLOCKING wp-owner ${awaited} \\(backend.implement, queued\\) blocks 1 workflow\\(s\\) \\[wp-waiter\\] for 0m via until-job ${incidentId}; not dispatched yet`));
  assert.deepEqual(fx.read(db=>blockingLines(db,{wanted:new Set([THIRD])})),[],'a --workflow filter keeps only its own jobs and waits');
  const row=fx.read(db=>workflowProgress(db,db.prepare('SELECT workflow_id,created_at FROM workflows WHERE workflow_id=?').get(OWNER)));
  assert.deepEqual(row.blocking.map(b=>[b.jobId,b.status]),[[awaited,'queued']]);
  assert.match(workflowSection(row),/⛓ Đang chặn workflow khác: <b>Code backend<\/b>/);
});
