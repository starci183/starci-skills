import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {openLedger,openMachine,inspectLedger,ensureWorkflow,ledgerFileFor} from '../kernel/ledger-db.mjs';
import {setSignal,signalRow,claimSupervisor,readSupervisor,inspectStartup} from '../kernel/launch.mjs';
import {inspectWorkflow,startKernel,superviseOnce,superviseForever,supervisorAction} from '../kernel/supervisor.mjs';
import {reopenLane} from '../kernel/lanes.mjs';

/**
 * The supervisor against the ledger (docs/ledger-db.md): workflow discovery, kernel liveness through the
 * `kernel-lock` signal, the single-supervisor `supervisor-lock` claim, the machine sweep every tick, and
 * `reopenLane` recreating a lane whose worktree is gone.
 */
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'starci-supervisor-spec-'));
/**
 * SQLite on Windows can hold a file mapping open a moment past `close()`; give it a beat, then retry the wipe.
 * A directory Windows still won't release after that is a test-fixture leak, not an assertion the test makes -
 * every test asserts against the handles it holds open itself, never against what is left on disk after.
 */
const settle=()=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,200);
const wipe=dir=>{settle();try{fs.rmSync(dir,{recursive:true,force:true,maxRetries:30,retryDelay:200});}catch{}};

/** A workflow row + one event (for `lastAt`) + an optional `kernel-lock`/`stop` signal, exactly what
 * `listWorkflows(repoRoot)` will hand the supervisor once the store stream backs it by the ledger. */
function seedWorkflow(ledger,id,{approved=true,finished=null,lastAt=1,pid=null,phase='running',stop=false,worktree,lane=null,hostAdapter=null,engine=null,host='H',run=null}={}){
  ensureWorkflow(ledger.db,{workflowId:id,at:lastAt});
  ledger.appendEvent({workflowId:id,entityType:'workflow',entityId:id,generation:1,kind:'tick',createdAt:lastAt});
  if(pid)setSignal(ledger.db,id,'kernel-lock',{pid,token:'tok',value:{phase},at:lastAt});
  if(stop)setSignal(ledger.db,id,'stop',{value:true,at:lastAt});
  return {id,dir:null,state:{schema:'starci/workflow-state@1',kernel:'starci/workflow-kernel@1',id,approved,finished,worktree,lane,host,hostAdapter,engine,run}};
}
const listOf=(...entries)=>()=>entries;

test('a dead kernel pid relaunches: the supervisor starts a fresh kernel through the sealed launcher',()=>{
  const dir=tmp(),worktree=tmp();
  try{
    const ledger=openLedger({file:path.join(dir,'runtime.sqlite'),now:()=>10_000});
    const entry=seedWorkflow(ledger,'w-dead',{lastAt:9_000,pid:424242,worktree});
    const spawned=[],logged=[];
    const result=superviseOnce({repoRoot:dir,launcher:'L.mjs',now:()=>10_000,aliveFn:()=>false,
      spawnFn:(exe,args,options)=>{spawned.push({args,cwd:options.cwd});return {pid:5555,unref(){}};},
      listFn:listOf(entry),ledgerFor:()=>ledger,log:event=>logged.push(event)});
    assert.equal(result.rounds[0].action,'start');
    assert.equal(result.rounds[0].outcome.ok,true,'the dead pid did not block a fresh reservation');
    assert.equal(spawned.length,1);
    assert.deepEqual(spawned[0].args.slice(0,4),['L.mjs','workflow-run','--id','w-dead']);
    assert.equal(spawned[0].cwd,worktree);
    assert.equal(inspectStartup(ledger,'w-dead').pid,5555,'the ledger kernel-lock now names the new process');
    ledger.close();
  }finally{wipe(dir);wipe(worktree);}
});

test('an alive but silent kernel is killed; finished, stopped, unapproved and healthy workflows are left alone; the confirmed-dead pid relaunches next round',()=>{
  const dir=tmp(),worktrees={};
  const worktreeFor=id=>worktrees[id]??(worktrees[id]=tmp());
  try{
    const ledger=openLedger({file:path.join(dir,'runtime.sqlite'),now:()=>10_000});
    const entries=[
      seedWorkflow(ledger,'b-silent',{lastAt:1,pid:1001,worktree:worktreeFor('b-silent')}),
      seedWorkflow(ledger,'c-healthy',{lastAt:9_940,pid:1002,worktree:worktreeFor('c-healthy')}),
      seedWorkflow(ledger,'d-finished',{lastAt:1,finished:{outcome:'done'},worktree:worktreeFor('d-finished')}),
      seedWorkflow(ledger,'e-stopped',{lastAt:1,stop:true,worktree:worktreeFor('e-stopped')}),
      seedWorkflow(ledger,'f-unapproved',{lastAt:1,approved:false,worktree:worktreeFor('f-unapproved')}),
    ];
    const killed=[],spawned=[];
    // Both pids read alive: the kill lands, but nothing yet proves the old process is actually gone - the
    // reservation for a fresh launch must still refuse in the very tick that sent the signal.
    const first=superviseOnce({repoRoot:dir,launcher:'L.mjs',now:()=>10_000,healthMs:5000,aliveFn:()=>true,
      killFn:pid=>killed.push(pid),spawnFn:(exe,args)=>{spawned.push(args[args.indexOf('--id')+1]);return {pid:9999,unref(){}};},
      listFn:listOf(...entries),ledgerFor:()=>ledger,log:()=>{}});
    const byId=Object.fromEntries(first.rounds.map(item=>[item.id,item.action]));
    assert.deepEqual(byId,{'b-silent':'restart','c-healthy':'leave','d-finished':'leave','e-stopped':'leave','f-unapproved':'leave'});
    assert.deepEqual(killed,[1001]);
    assert.deepEqual(spawned,[],'the kernel-lock row still reads its old pid as running, so the relaunch is refused this tick');
    assert.equal(first.rounds.find(item=>item.id==='b-silent').outcome.ok,false);
    // Next round: b-silent's pid now reads dead (c-healthy's does not) - a fresh reservation is admitted.
    const second=superviseOnce({repoRoot:dir,launcher:'L.mjs',now:()=>10_001,healthMs:5000,aliveFn:pid=>pid!==1001,
      killFn:pid=>killed.push(pid),spawnFn:(exe,args)=>{spawned.push(args[args.indexOf('--id')+1]);return {pid:9999,unref(){}};},
      listFn:listOf(...entries),ledgerFor:()=>ledger,log:()=>{}});
    assert.equal(second.rounds.find(item=>item.id==='b-silent').action,'start');
    assert.deepEqual(spawned,['b-silent']);
    ledger.close();
  }finally{wipe(dir);for(const worktree of Object.values(worktrees))wipe(worktree);}
});

test('a launch reservation admits one supervisor round and a concurrent tick sees the launch in progress',()=>{
  const dir=tmp(),worktree=tmp();
  try{
    const ledger=openLedger({file:path.join(dir,'runtime.sqlite'),now:()=>1});
    const entry=seedWorkflow(ledger,'race',{lastAt:1,worktree});
    // A freshly-launched local child reads alive throughout: only that keeps its startup reservation standing
    // long enough for a concurrent tick to see it.
    const first=superviseOnce({repoRoot:dir,launcher:'L.mjs',now:()=>2,aliveFn:()=>true,spawnFn:()=>({pid:12345,unref(){}}),listFn:listOf(entry),ledgerFor:()=>ledger,log:()=>{}});
    const second=superviseOnce({repoRoot:dir,launcher:'L.mjs',now:()=>3,aliveFn:()=>true,spawnFn:()=>{throw Error('must not spawn twice');},listFn:listOf(entry),ledgerFor:()=>ledger,log:()=>{}});
    assert.equal(first.rounds[0].outcome.ok,true);
    assert.equal(second.rounds[0].action,'leave');assert.equal(second.rounds[0].reason,'kernel launch in progress');
    ledger.close();
  }finally{wipe(dir);wipe(worktree);}
});

test('two supervisors race the single-supervisor signal on the same ledger: one holds it, the other is told who does',()=>{
  const dir=tmp();
  try{
    const ledger=openLedger({file:path.join(dir,'runtime.sqlite'),now:()=>1});
    const alive=new Set([111]);
    const first=claimSupervisor(ledger,{pid:111,round:0,ttl:60_000,now:()=>1,alive:pid=>alive.has(pid)});
    const second=claimSupervisor(ledger,{pid:222,round:0,ttl:60_000,now:()=>2,alive:pid=>alive.has(pid)});
    assert.equal(first.ok,true);
    assert.equal(second.ok,false);assert.equal(second.holder.pid,111);
    assert.equal(readSupervisor(ledger).pid,111,'the ledger row still names the incumbent');
    // The incumbent's own re-claim refreshes its pulse; a holder whose pid has since died is reclaimed.
    const refreshed=claimSupervisor(ledger,{pid:111,round:1,ttl:60_000,now:()=>3,alive:pid=>alive.has(pid)});
    assert.equal(refreshed.ok,true);
    alive.delete(111);
    const takeover=claimSupervisor(ledger,{pid:222,round:0,ttl:60_000,now:()=>4,alive:pid=>alive.has(pid)});
    assert.equal(takeover.ok,true,'a dead incumbent never blocks a new supervisor');
    assert.equal(readSupervisor(ledger).pid,222);
    ledger.close();
  }finally{wipe(dir);}
});

test('the machine sweep every tick removes a lease no ledger row holds any more, and keeps a live one',()=>{
  const dir=tmp(),machineDir=tmp();
  try{
    const ledger=openLedger({file:path.join(dir,'runtime.sqlite'),now:()=>1});
    const machineFile=path.join(machineDir,'machine.sqlite');
    const machine=openMachine({file:machineFile,now:()=>1});
    const ledgerFile=ledger.path;
    const {ledgerId}=machine.registerLedger({file:ledgerFile,ledgerId:ledger.ledgerId});
    machine.setCapacity('ai/test',5);
    // Orphan: a machine reservation with no paired ledger lease naming its token - the crash-between-the-two case §6 describes.
    const orphan=machine.reserve({resourceKey:'ai/test',ledgerId,workflowId:'wf',jobId:'job-orphan',units:1,ttlMs:600_000});
    assert.equal(orphan.ok,true);
    // Live: a matching ledger lease row carries the same token as machine_ref, so the sweep must leave it.
    const live=machine.reserve({resourceKey:'ai/test',ledgerId,workflowId:'wf',jobId:'job-live',units:1,ttlMs:600_000});
    ledger.enqueueJob({jobId:'job-live',workflowId:'wf',opId:'op',attempt:1,generation:1,kind:'model'});
    ledger.db.prepare("UPDATE jobs SET status='leased',lease_token='t1' WHERE job_id='job-live'").run();
    ledger.db.prepare('INSERT INTO leases(resource_key,job_id,workflow_id,op_id,attempt,generation,token,units,acquired_at,expires_at,machine_ref) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
      .run('ai/test','job-live','wf','op',1,1,'t1',1,1,Number.MAX_SAFE_INTEGER,live.token);
    const logged=[];
    const result=superviseOnce({repoRoot:dir,launcher:'L.mjs',now:()=>2,listFn:listOf(),ledgerFor:()=>ledger,
      machine,inspectLedgerFn:inspectLedger,log:event=>logged.push(event)});
    assert.equal(result.rounds.length,0);
    const swept=logged.find(event=>event.event==='machine-leases-swept');
    assert.ok(swept,'the sweep logged what it did');
    assert.equal(swept.orphaned,1);
    const remaining=machine.db.prepare('SELECT job_id,token FROM leases').all();
    assert.deepEqual(remaining.map(row=>row.job_id),['job-live'],'only the orphan is gone');
    machine.close();ledger.close();
  }finally{wipe(dir);wipe(machineDir);}
});

test('a workflow that owns a lane is started inside it',()=>{
  const dir=tmp(),lane=path.join(dir,'lanes','laned');
  try{
    fs.mkdirSync(lane,{recursive:true});
    const ledger=openLedger({file:path.join(dir,'runtime.sqlite'),now:()=>1});
    const entry=seedWorkflow(ledger,'laned',{lastAt:1,worktree:lane,lane:{name:'laned',worktree:lane,branch:'orca/laned',base:{worktree:dir,branch:'main'}}});
    const spawned=[];
    const result=superviseOnce({repoRoot:dir,launcher:'L.mjs',now:()=>2,
      spawnFn:(exe,args,options)=>{spawned.push({args,cwd:options.cwd});return {pid:4242,unref(){}};},
      listFn:listOf(entry),ledgerFor:()=>ledger,log:()=>{}});
    assert.equal(result.rounds[0].action,'start');assert.equal(result.rounds[0].outcome.ok,true);
    assert.equal(spawned.length,1);assert.equal(spawned[0].cwd,lane,'the kernel of a lane runs in the lane, never the base worktree');
    ledger.close();
  }finally{wipe(dir);}
});

test('reopenLane recreates a deleted worktree on its recorded branch through the same Orca call openLane uses, and records the same worktree path',()=>{
  const repoRoot=tmp();
  try{
    const calls=[];
    const target=path.join(repoRoot,'.worktrees','lanes','wf-1');
    const orca={invoke:(name,params)=>{
      calls.push([name,params]);
      if(name==='worktree-create'){fs.mkdirSync(params.path,{recursive:true});return {outcome:'ok',receipt:{result:{worktree:{path:params.path,branch:`refs/heads/${params['base-branch']}`}}}};}
      if(name==='worktree-set')return {outcome:'ok',receipt:{result:{}}};
      throw Error(`unexpected call ${name}`);
    }};
    const reopened=reopenLane(orca,{workflowId:'wf-1',branch:'workflow/wf-1',path:target,repoRoot});
    assert.equal(reopened.worktree,target,'the reopened lane is recorded at the same worktree path');
    assert.equal(reopened.branch,'workflow/wf-1');
    assert.ok(fs.existsSync(target));
    assert.deepEqual(calls.map(([name])=>name),['worktree-create','worktree-set']);
    assert.equal(calls[0][1]['base-branch'],'workflow/wf-1');
  }finally{fs.rmSync(repoRoot,{recursive:true,force:true});}
});

test('the supervisor reopens a lane whose worktree is gone before it spawns into it',()=>{
  const dir=tmp(),base=tmp();
  const lane=path.join(base,'lanes','reopened');   // never created: this is the "gone" worktree
  try{
    const ledger=openLedger({file:path.join(dir,'runtime.sqlite'),now:()=>1});
    const entry=seedWorkflow(ledger,'reopened',{lastAt:1,worktree:lane,lane:{name:'reopened',worktree:lane,branch:'workflow/reopened',base:{worktree:base,branch:'main'}}});
    const calls=[];
    const orca={invoke:(name,params)=>{
      calls.push(name);
      if(name==='worktree-create'){fs.mkdirSync(params.path,{recursive:true});return {outcome:'ok',receipt:{result:{worktree:{path:params.path,branch:`refs/heads/${params['base-branch']}`}}}};}
      return {outcome:'ok',receipt:{result:{}}};
    }};
    const spawned=[];
    const result=superviseOnce({repoRoot:dir,launcher:'L.mjs',now:()=>2,orca,
      spawnFn:(exe,args,options)=>{spawned.push(options.cwd);return {pid:1,unref(){}};},
      listFn:listOf(entry),ledgerFor:()=>ledger,log:()=>{}});
    assert.deepEqual(calls,['worktree-create','worktree-set']);
    assert.equal(result.rounds[0].outcome.ok,true);
    assert.equal(spawned[0],lane,'the kernel is spawned into the reopened worktree at its recorded path');
    assert.ok(fs.existsSync(lane));
    ledger.close();
  }finally{wipe(dir);wipe(base);}
});

test('the supervisor loop claims the ledger, probes the budget on its cadence, and stops once nothing unfinished remains',()=>{
  const dir=tmp(),worktree=tmp();
  try{
    // The claim loop resolves the ledger from `ledgerFileFor(repoRoot)` itself - unlike `superviseOnce`, it takes
    // no `ledgerFor` override - so the fixture has to sit at the real path, not wherever `ledgerFor` would let it.
    const ledger=openLedger({file:ledgerFileFor(dir),now:()=>1});
    const entry=seedWorkflow(ledger,'looped',{lastAt:1,stop:true,worktree});
    ledger.close();
    const slept=[];
    const result=superviseForever({repoRoot:dir,launcher:'L.mjs',maxRounds:3,log:()=>{},sleep:ms=>slept.push(ms),pollMs:5,
      probe:()=>({ok:false,reason:'no orca in tests'}),listFn:listOf(entry)});
    assert.equal(result.rounds[0].action,'leave','a stop flag pauses a kernel but does not end supervision');
    assert.equal(slept.length,2,'the loop kept polling the paused workflow until maxRounds');
  }finally{wipe(dir);wipe(worktree);}
});
