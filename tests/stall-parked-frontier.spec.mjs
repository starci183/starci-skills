import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,ledgerFileFor,openLedger} from '../engine/ledger-db.mjs';
import {withLedger,seedWorkflow} from './_ledger-fixture.mjs';
import {stallFindings,workingWorkers} from '../scripts/supervisor/stall.mjs';
import {inboxAlert} from '../scripts/supervisor/stall-alert.mjs';
import {parkedBehindWaits,waitHeldOperations} from '../scripts/kernel/frontier-parked.mjs';

// Two false STALLED alerts from scripts/supervisor/stall.mjs.
//
// inc-56d621d6359e (starci-next wf-sn-subscription-mufrhhro), and nivo wf-nivo-academy-debt-mugycgwl
// ("frontier engaged; queued: peer-wait 1, dependency 1"): a job queued --after a job a typed peer-wait
// holds read queuedBecause dependency and counted as engaged work, so api status read `engaged` instead of
// `peer-wait` and stall's peer-parked exemption never applied. api status now parks a dependant whose chain
// ends in a held or waited job (scripts/kernel/frontier-parked.mjs); stall reads that frontier.
//
// inc-b1435cb9c2b9 (nivo wf-nivo-workspace-provision-mudqjokb, same class as inc-42d3cceaa714): the alert
// its Kernel quoted on 09-26 10:49Z was the 09-25 13:20:32Z STALL-ALERT "idle 966m: frontier
// orphaned-frontier ACTIONABLE but the Kernel has not moved", judged while every wake had been skipped
// kernel-busy since 21:50Z and 9 s after the Kernel enqueued the next leg (job-enqueued 13:20:23Z). stall
// asked a peer's Kernel whether it was mid-turn but never the workflow's own, and read its idle clock
// before the frontier. It now takes the one busy judgement (busyWhy) for itself too, re-reads the clock
// after the frontier, and its supervisor alert says when it was judged.

const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const MIN=60_000;
const json=text=>{try{return JSON.parse(text);}catch{return null;}};
const WORK='wf-sn-subscription-mufrhhro',PEER='wf-sn-learn-content-mufrhgwz';

const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-stall-parked-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});
  const env={...process.env};
  for(const key of ['ORCA_TERMINAL_HANDLE','STARCI_ROLE','STARCI_OP_JOB'])delete env[key];
  const api=args=>spawnSync(process.execPath,[API,...args,'--repo',repo,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    for(const workflowId of [WORK,PEER]){
      ledger.ensureWorkflow({workflowId,title:workflowId,ledgerMode:'durable',sourceRoots:[repo]});
      ledger.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id=?").run(workflowId);
      ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
        .run(workflowId,0,`goal-${workflowId}`,'# goal',JSON.stringify({derivedFrom:'stall-parked-spec'}),Date.now());
    }
  }finally{ledger.close();}
  const ok=args=>{const r=api(args);assert.equal(r.status,0,`${args.join(' ')}: ${r.stderr||r.stdout}`);return json(r.stdout);};
  const status=(repoArg,wf)=>{const r=api(['status','--workflow',wf]);return r.status===0?{ok:true,...json(r.stdout)}:{ok:false,error:r.stderr};};
  const enqueue=(op,paths,extra=[])=>ok(['enqueue','--workflow',WORK,'--op',op,'--paths',paths,...extra]).job_id;
  const read=fn=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return fn(l.db);}finally{l.close();}};
  return {repo,ok,status,enqueue,read};
};

test('inc-56d621d6359e: a job queued --after a peer-wait-held job is parked behind the wait - the frontier reads peer-wait, and stall does not alert',t=>{
  const fx=fixture(t);
  const ord3=fx.enqueue('backend.implement','src/modules/domain/purchase');
  const {incidentId}=fx.ok(['incident','--workflow',WORK,'--kind','peer-wait','--peer',PEER,'--holds',ord3,'--detail','repo gates must be green on learn-content/import first']);
  const ord6=fx.enqueue('backend.implement','src/modules/domain/subscription',['--after',ord3]);
  const tail=fx.enqueue('backend.implement','src/modules/domain/invoice',['--after',ord6]);

  const front=fx.status(fx.repo,WORK).frontier;
  assert.deepEqual([front.state,front.actionable,front.readyOperations],['peer-wait',false,0],
    'the defect: openOperations 3 > peer-held 1 read engaged, and stall alerted STALLED on a parked workflow');
  const row=id=>front.queued.find(q=>q.jobId===id);
  assert.equal(row(ord3).queuedBecause,'peer-wait');
  for(const id of [ord6,tail]){
    assert.equal(row(id).queuedBecause,'dependency','the cause stays what it is');
    assert.deepEqual(row(id).parkedBehind,{heldBecause:'peer-wait',incident:incidentId,peer:PEER,via:ord3},`${id} is parked behind the wait through ${ord3}, transitively`);
    assert.match(row(id).detail,new RegExp(`parked behind peer-wait ${incidentId} through ${ord3}`));
  }
  assert.match(front.reason,new RegExp(`queued behind the wait: .*${ord6} \\(after ${ord3}\\)`));

  // The supervisor's stall check reads that same frontier: parked on a justified peer-wait, not a stall.
  const now=Date.now()+120*MIN;
  const l=inspectLedger({file:ledgerFileFor(fx.repo)});
  try{
    const found=stallFindings(l.db,{repo:fx.repo,now,stallMinutes:30,frontierOf:fx.status,wanted:new Set([WORK]),
      kernelTurnOf:(db,wf)=>(wf===PEER?'active':'turn-idle')});
    const stalled=found.find(f=>f.type==='STALLED');
    assert.ok(stalled,'idle past the threshold, so it is judged');
    assert.deepEqual([stalled.frontierState,stalled.justifiedPeerWait,stalled.alert],['peer-wait',true,false]);
  }finally{l.close();}

  // Resolved, the chain is the Kernel's again: the held job reads ready, its dependants wait on it (engaged).
  fx.ok(['incident','--workflow',WORK,'--resolve',incidentId,'--detail','peer gates green']);
  const after=fx.status(fx.repo,WORK).frontier;
  assert.deepEqual([after.state,after.actionable],['engaged',true]);
  assert.equal(after.queued.find(q=>q.jobId===ord6).parkedBehind,undefined);
});

test('parkedBehindWaits: owner-gate and deferred-settle roots, chains behind running or ready jobs park nothing, cycles end',()=>{
  const queued=[
    {jobId:'a',queuedBecause:'owner-gate',blockedBy:{incident:'inc-g'}},
    {jobId:'b',queuedBecause:'dependency',blockedBy:{job:'a'}},
    {jobId:'c',queuedBecause:'dependency',blockedBy:{job:'s'}},
    {jobId:'d',queuedBecause:'dependency',blockedBy:{job:'running-1'}},
    {jobId:'e',queuedBecause:'ready',blockedBy:null},
    {jobId:'f',queuedBecause:'dependency',blockedBy:{job:'e'}},
    {jobId:'x',queuedBecause:'dependency',blockedBy:{job:'y'}},
    {jobId:'y',queuedBecause:'dependency',blockedBy:{job:'x'}},
    {jobId:'z',queuedBecause:'dependency-failed',blockedBy:{job:'a'}},
  ];
  const heldSettle=[{jobId:'s',heldBecause:'peer-wait',blockedBy:{incident:'inc-p',peer:'wf-peer'}}];
  const parked=parkedBehindWaits(queued,heldSettle);
  assert.deepEqual([...parked.keys()].sort(),['b','c']);
  assert.deepEqual(parked.get('b'),{heldBecause:'owner-gate',incident:'inc-g',via:'a'});
  assert.deepEqual(parked.get('c'),{heldBecause:'peer-wait',incident:'inc-p',peer:'wf-peer',via:'s',settle:true});
  // A dependant behind an owner-gate-held job counts like that job (open); behind a deferred settle it is held.
  assert.equal(waitHeldOperations(queued,heldSettle,parked),0+1+1);
});

// nivo wf-nivo-workspace-provision-mudqjokb as the 09-25 13:20Z pass saw it: last progress op-settled 21:14Z the
// day before, no open operation (orphaned-frontier, actionable), the Kernel mid-turn the whole time.
const WSPV='wf-nivo-workspace-provision-mudqjokb';
const NOW=Date.now();
const orphaned=()=>({ok:true,frontier:{state:'orphaned-frontier',actionable:true,queued:[],queuedCauses:{},reason:'workflow is running but has no open operation and no unconsumed report'},workers:[]});
const seedWspv=ledger=>{
  seedWorkflow(ledger,{id:WSPV,now:NOW-2000*MIN,events:[{kind:'op-settled',payload:{},created_at:NOW-966*MIN}]});
  ledger.db.prepare("UPDATE workflows SET phase='running'").run();
};

test('inc-b1435cb9c2b9: a Kernel mid-turn is the workflow moving - no STALLED "the Kernel has not moved"; at its prompt it still is one',t=>withLedger(t,({repoRoot,ledger})=>{
  seedWspv(ledger);
  const busy=stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:orphaned,kernelTurnOf:()=>'active'});
  assert.equal(busy.filter(f=>f.type==='STALLED').length,0,'the defect: STALLED idle 966m ACTIONABLE while every wake was skipped kernel-busy');
  const idle=stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:orphaned,kernelTurnOf:()=>'turn-idle'});
  const [stalled]=idle.filter(f=>f.type==='STALLED');
  assert.ok(stalled,'a Kernel at its prompt with an actionable frontier has not moved');
  assert.match(stalled.line,/^STALLED wf-nivo-workspace-provision-mudqjokb idle 966m: frontier orphaned-frontier ACTIONABLE but the Kernel has not moved/);
}));

test('inc-b1435cb9c2b9: progress made between the idle clock and the frontier read is what that frontier shows - no stale STALLED',t=>withLedger(t,({repoRoot,ledger})=>{
  seedWspv(ledger);
  // The Kernel enqueues the next leg while the pass runs (job-enqueued 13:20:23Z, alert 13:20:32Z).
  const racing=()=>{
    ledger.appendEvent({workflowId:WSPV,entityType:'job',entityId:'op-interface.implement-efce9599f9',kind:'job-enqueued',payload:{opId:'interface.implement'},createdAt:NOW-1000});
    return {ok:true,frontier:{state:'engaged',actionable:true,readyOperations:1,queued:[],queuedCauses:{ready:1},reason:'queued or fenced operations are waiting on the Kernel'},workers:[]};
  };
  const found=stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:racing,kernelTurnOf:()=>'turn-idle'});
  assert.equal(found.filter(f=>f.type==='STALLED').length,0,'the defect: idle 966m stood beside a frontier read after the Kernel moved');
}));

test('inc-b1435cb9c2b9: the supervisor alert says when it was judged, so a late relay reads as the old snapshot it is',()=>{
  const at=Date.UTC(2026,8,25,13,20,32);
  const text=inboxAlert([{f:{line:'STALLED wf-x idle 966m: frontier orphaned-frontier ACTIONABLE but the Kernel has not moved'},why:'self-heal never ran'}],at);
  assert.match(text,/^STALL-ALERT 1 finding\(s\) the workflows could not fix themselves \(judged 2026-09-25 13:20Z; re-read api status before acting on it\): STALLED wf-x idle 966m/);
});

// nivo inc-3a0e90528cbc (wf-nivo-modules-agentos-mudqjov6): STALLED idle 94m "frontier engaged" while
// op-interface.implement-26e189461a's Devin turn was "Thinking 97m+" with bounded commands running - api
// status read its liveness outside active, but its terminal output (outputAgeOf) was seconds old.
const AGENTOS='wf-nivo-modules-agentos-mudqjov6',JOB='op-interface.implement-26e189461a';
const engagedOn=worker=>()=>({ok:true,frontier:{state:'engaged',actionable:false,queued:[],queuedCauses:{},nudgeReadyJobs:[],deadWorkerJobs:[],wedgedJobs:[],workerQuestionJobs:[],reason:null},
  workers:[{jobId:JOB,ledgerStatus:'running',...worker}]});

test('inc-3a0e90528cbc: a worker whose output or heartbeat api status aged fresh is mid-turn whatever its frame classified as',t=>withLedger(t,({repoRoot,ledger})=>{
  seedWorkflow(ledger,{id:AGENTOS,now:NOW-600*MIN,events:[{kind:'op-dispatched',payload:{jobId:JOB},created_at:NOW-94*MIN}]});
  ledger.db.prepare("UPDATE workflows SET phase='running'").run();
  const stalled=worker=>stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:engagedOn(worker),kernelTurnOf:()=>'turn-idle'}).filter(f=>f.type==='STALLED');
  assert.equal(stalled({liveness:'failed',screenState:'failed',outputAgeMs:4000}).length,0,'the defect: fresh output on a running worker alerted STALLED idle 94m');
  assert.equal(stalled({liveness:'unknown',outputAgeMs:null,heartbeatAgeMs:60_000}).length,0,'a fresh dispatch heartbeat is the worker moving too');
  assert.equal(stalled({liveness:'failed',screenState:'failed',outputAgeMs:94*MIN}).length,1,'old output and no heartbeat: nothing moves');
  assert.equal(stalled({liveness:'unknown',outputAgeMs:null}).length,1,'an unknown age is never fresh');
  // A worker the frontier itself lists as not working stays not working, however fresh its output.
  const flagged={ok:true,frontier:{nudgeReadyJobs:[JOB]},workers:[{jobId:JOB,liveness:'turn-idle',outputAgeMs:1000}]};
  assert.deepEqual(workingWorkers(flagged,600_000),[]);
  assert.deepEqual(workingWorkers({ok:true,frontier:{},workers:[{jobId:JOB,liveness:'active'}]},600_000).map(w=>w.jobId),[JOB]);
}));
