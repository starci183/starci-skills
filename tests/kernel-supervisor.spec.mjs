import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {inspectWorkflow,startKernel,superviseForever,superviseOnce,supervisorAction} from '../kernel/supervisor.mjs';
import {LAUNCH_WINDOW_MS,acquireStartup,inspectStartup,reserveStartup} from '../kernel/startup-lock.mjs';

test('Orca supervisor starts the kernel inside its owned coordinator terminal',()=>{
  const calls=[],orca={invoke:(name,params)=>{calls.push([name,params]);return name==='terminal-create'?{outcome:'ok',receipt:{result:{terminal:{handle:'term_monitor'}}}}:{outcome:'ok',receipt:{result:{}}};}};
  let spawned=false;const result=startKernel({id:'wf',dir:'D:/state',worktree:'D:/repo',host:'D:/host',hostAdapter:'orca',run:'run_wf'},{launcher:'D:/host/launch.mjs',orca,spawnFn:()=>{spawned=true;}});
  assert.equal(result.ok,true);assert.equal(result.terminal,'term_monitor');assert.equal(spawned,false);assert.deepEqual(calls.map(([name])=>name),['terminal-create','terminal-read','terminal-send']);assert.match(calls[2][1].text,/workflow-run/);assert.match(calls[2][1].text,/--from.*term_monitor/);assert.match(calls[2][1].text,/--run.*run_wf/);
});

const tmp=()=>{const dir=path.join(os.tmpdir(),'starci-supervisor-spec',`${Date.now()}-${Math.random().toString(16).slice(2)}`);fs.mkdirSync(path.join(dir,'.starciwork','_local','workflows'),{recursive:true});return dir;};
function workflow(root,id,{approved=true,finished=null,lastAt,pid=null,stop=false,worktree=root,lane=null}={}){
  const dir=path.join(root,'.starciwork','_local','workflows',id);fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'state.json'),JSON.stringify({schema:'starci/workflow-state@1',kernel:'starci/workflow-kernel@1',id,approved,finished,worktree,lane,host:'H'}));
  fs.writeFileSync(path.join(dir,'events.jsonl'),JSON.stringify({at:lastAt,seq:1,event:'tick'})+'\n');
  if(pid)fs.writeFileSync(path.join(dir,'kernel.lock'),JSON.stringify({pid}));
  if(stop)fs.writeFileSync(path.join(dir,'stop.flag'),'1');
  return dir;
}

test('the supervisor starts a missing kernel, restarts a silent one, and leaves finished, stopped or healthy ones alone',()=>{
  const root=tmp();const now=()=>10_000_000;
  try{
    workflow(root,'a-missing',{lastAt:9_000_000});
    workflow(root,'b-silent',{lastAt:now()-30*60*1000,pid:process.pid});
    workflow(root,'c-healthy',{lastAt:now()-60*1000,pid:process.pid});
    workflow(root,'d-finished',{lastAt:1,finished:{outcome:'done'},pid:null});
    workflow(root,'e-stopped',{lastAt:1,stop:true});
    workflow(root,'f-unapproved',{lastAt:1,approved:false});
    const spawned=[],killed=[];
    const result=superviseOnce({repoRoot:root,launcher:'L.mjs',now,spawnFn:(exe,args)=>{spawned.push(args[3]);return {pid:4242,unref(){}};},killFn:pid=>{killed.push(pid);},log:()=>{}});
    const byId=Object.fromEntries(result.rounds.map(item=>[item.id,item.action]));
    assert.deepEqual(byId,{'a-missing':'start','b-silent':'restart','c-healthy':'leave','d-finished':'leave','e-stopped':'leave','f-unapproved':'leave'});
    assert.deepEqual(spawned.sort(),['a-missing','b-silent']);
    assert.deepEqual(killed,[process.pid]);
    assert.equal(supervisorAction(inspectWorkflow({id:'c-healthy',dir:path.join(root,'.starciwork','_local','workflows','c-healthy')},{now})).reason,'healthy');
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('a stop flag pauses a kernel but does not end supervision; only finished workflows do',()=>{
  const root=tmp();const now=()=>10_000_000;
  try{
    workflow(root,'paused',{lastAt:1,stop:true});
    const slept=[];
    const paused=superviseForever({repoRoot:root,launcher:'L.mjs',maxRounds:3,log:()=>{},sleep:ms=>slept.push(ms),pollMs:5});
    assert.equal(paused.rounds[0].action,'leave');
    assert.equal(slept.length,2,'the loop kept polling the paused workflow until maxRounds');
    fs.rmSync(path.join(root,'.starciwork','_local','workflows','paused'),{recursive:true,force:true});
    workflow(root,'over',{lastAt:1,finished:{outcome:'done'}});
    const over=superviseForever({repoRoot:root,launcher:'L.mjs',maxRounds:3,log:()=>{},sleep:ms=>slept.push(ms),pollMs:5});
    assert.equal(over.rounds[0].finished,true);
    assert.equal(slept.length,2,'a finished workflow ends the loop without another sleep');
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('a workflow whose tree was named explicitly is started with the same --ledger-root, and a worktree store is covered beside the repository store',()=>{
  const root=tmp();const other=tmp();const now=()=>10_000_000;
  try{
    const dir=workflow(root,'named',{lastAt:1});
    const state=JSON.parse(fs.readFileSync(path.join(dir,'state.json'),'utf8'));
    fs.writeFileSync(path.join(dir,'state.json'),JSON.stringify({...state,ledgerRoot:'X:/tree/.starciwork',ledgerSource:'option'}));
    workflow(other,'beside',{lastAt:1});
    const spawned=[];
    const result=superviseOnce({repoRoot:root,roots:[root,other],launcher:'L.mjs',now,spawnFn:(exe,args)=>{spawned.push(args);return {pid:1,unref(){}};},killFn:()=>{},log:()=>{}});
    assert.deepEqual(result.rounds.map(item=>[item.id,item.action]),[['named','start'],['beside','start']]);
    const named=spawned.find(args=>args.includes('named'));
    assert.deepEqual(named.slice(named.indexOf('--ledger-root')),['--ledger-root','X:/tree/.starciwork']);
    assert.ok(!spawned.find(args=>args.includes('beside')).includes('--ledger-root'),'a routed or local tree is resolved by the kernel itself');
  }finally{fs.rmSync(root,{recursive:true,force:true});fs.rmSync(other,{recursive:true,force:true});}
});

/**
 * A lane does not move the store: it lives in the repository, so the supervisor lists it once whether it polls
 * from the base worktree or from the lane, and starts the kernel inside the lane - the tree that workflow owns.
 */
test('a round that throws is logged and the next one runs; every round leaves a pulse beside the store',()=>{
  const root=tmp();
  try{
    workflow(root,'live',{lastAt:1,stop:true});
    const logged=[];let calls=0;
    const result=superviseForever({repoRoot:root,launcher:'L.mjs',maxRounds:3,log:event=>logged.push(event),sleep:()=>{},pollMs:5,
      probe:()=>{calls+=1;if(calls===1)throw Error('a state file read mid-write');return {ok:false,reason:'no orca in tests'};},stamp:()=>null});
    assert.ok(result,'the supervisor survived the fault and returned normally');
    const pulse=JSON.parse(fs.readFileSync(path.join(root,'.starciwork','_local','workflows','supervisor.lock'),'utf8'));
    assert.equal(pulse.pid,process.pid);assert.ok(typeof pulse.at==='number');
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('a rebuilt launcher ends the supervisor after it started its successor from the same command line',()=>{
  const root=tmp();
  try{
    workflow(root,'live',{lastAt:1,stop:true});
    let build=100;const logged=[];const slept=[];
    const result=superviseForever({repoRoot:root,launcher:'L.mjs',maxRounds:5,log:event=>logged.push(event),sleep:ms=>{slept.push(ms);build=200;},pollMs:5,
      probe:()=>({ok:false,reason:'no orca in tests'}),stamp:()=>build,respawn:()=>4242});
    assert.deepEqual(result.rebuilt,{from:100,to:200,successor:4242});
    assert.equal(slept.length,1,'one round ran on the old build, the rebuilt one was seen at the next');
    assert.deepEqual(logged.filter(event=>event.event==='supervisor-rebuilt').map(event=>[event.from,event.to,event.successor]),[[100,200,4242]]);
    // A launcher that cannot be read binds nothing: the supervisor simply keeps going.
    const blind=superviseForever({repoRoot:root,launcher:'L.mjs',maxRounds:2,log:()=>{},sleep:()=>{},pollMs:5,probe:()=>({ok:false,reason:'x'}),stamp:()=>null,respawn:()=>{throw Error('never');}});
    assert.equal(blind.rebuilt,undefined);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('a workflow that owns a lane is listed once from the repository store and its kernel is started inside the lane',()=>{
  const root=tmp();const now=()=>10_000_000;
  const lane=path.join(root,'lanes','laned');
  try{
    fs.mkdirSync(lane,{recursive:true});
    workflow(root,'laned',{lastAt:1,worktree:lane,
      lane:{name:'laned',worktree:lane,branch:'orca/laned',base:{worktree:root,branch:'main'}}});
    const spawned=[];
    const result=superviseOnce({repoRoot:root,roots:[root,lane],launcher:'L.mjs',now,
      spawnFn:(executable,args,options)=>{spawned.push({args,cwd:options.cwd});return {pid:4242,unref(){}};},
      killFn:()=>{},log:()=>{}});
    assert.deepEqual(result.rounds.map(item=>[item.id,item.action]),[['laned','start']],'listed once, not twice');
    assert.equal(spawned.length,1);
    assert.deepEqual(spawned[0].args.slice(0,4),['L.mjs','workflow-run','--id','laned']);
    assert.equal(spawned[0].cwd,lane,'the kernel of a lane runs in the lane, never in the base worktree');
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('a launch reservation admits one supervisor and suppresses a concurrent coordinator launch',()=>{
  const root=tmp(),calls=[];try{
    workflow(root,'race',{lastAt:1});
    const raceDir=path.join(root,'.starciwork','_local','workflows','race'),raceState=JSON.parse(fs.readFileSync(path.join(raceDir,'state.json'),'utf8'));raceState.hostAdapter='orca';fs.writeFileSync(path.join(raceDir,'state.json'),JSON.stringify(raceState));
    const orca={invoke:(name)=>{calls.push(name);return name==='terminal-create'?{outcome:'ok',receipt:{result:{terminal:{handle:'term_once'}}}}:{outcome:'ok',receipt:{result:{}}};}};
    const first=superviseOnce({repoRoot:root,launcher:'L.mjs',orca,now:()=>10_000_000,log:()=>{}});
    const second=superviseOnce({repoRoot:root,launcher:'L.mjs',orca,now:()=>10_000_001,log:()=>{}});
    assert.equal(first.rounds[0].outcome.ok,true);
    assert.equal(second.rounds[0].action,'leave');assert.equal(second.rounds[0].reason,'kernel launch in progress');
    assert.equal(calls.filter(name=>name==='terminal-create').length,1,'only one native coordinator was created');
  }finally{Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,100);fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('failed bootstrap releases only its reservation and never removes a live kernel lock',()=>{
  const root=tmp();try{
    const dir=workflow(root,'failed',{lastAt:1});
    const live={pid:process.pid,startedAt:1,owner:'existing'};fs.writeFileSync(path.join(dir,'kernel.lock'),JSON.stringify(live));
    // A stale inspection may decide to restart, but an unconfirmed stop of an enrolled kernel retains the incumbent lock.
    const state=JSON.parse(fs.readFileSync(path.join(dir,'state.json'),'utf8'));state.engine={schema:'starci/engine@1'};fs.writeFileSync(path.join(dir,'state.json'),JSON.stringify(state));
    const held=superviseOnce({repoRoot:root,launcher:'L.mjs',now:()=>10_000_000,killFn:()=>{},aliveFn:()=>true,log:()=>{}});
    assert.equal(held.rounds[0].outcome.ok,false);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir,'kernel.lock'),'utf8')),live);
    assert.equal(fs.existsSync(path.join(dir,'kernel.launch.lock')),false);

    fs.writeFileSync(path.join(dir,'state.json'),JSON.stringify({...state,engine:null,hostAdapter:'orca'}));fs.writeFileSync(path.join(dir,'events.jsonl'),JSON.stringify({at:1,event:'tick'})+'\n');fs.rmSync(path.join(dir,'kernel.lock'));
    const orca={invoke:name=>name==='terminal-create'?{outcome:'ok',receipt:{result:{terminal:{handle:'term_failed'}}}}:{outcome:'failed',effectState:'none',reason:'injected readiness failure'}};
    const failed=superviseOnce({repoRoot:root,launcher:'L.mjs',now:()=>10_000_001,orca,log:()=>{}});
    assert.equal(failed.rounds[0].outcome.ok,false);assert.equal(fs.existsSync(path.join(dir,'kernel.launch.lock')),false,'failed bootstrap released its own reservation');
  }finally{Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,100);fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('an unknown native bootstrap effect retains the reservation and blocks duplicate creation',()=>{
  const root=tmp();try{
    const dir=workflow(root,'unknown',{lastAt:1}),state=JSON.parse(fs.readFileSync(path.join(dir,'state.json'),'utf8'));state.hostAdapter='orca';fs.writeFileSync(path.join(dir,'state.json'),JSON.stringify(state));
    let creates=0;const orca={invoke:name=>{if(name==='terminal-create'){creates+=1;return {outcome:'ok',receipt:{result:{terminal:{handle:'term_uncertain'}}}};}return {outcome:'unknown',effectState:'unknown',reason:'read outcome unavailable'};}};
    const first=superviseOnce({repoRoot:root,launcher:'L.mjs',now:()=>10_000_000,orca,log:()=>{}});assert.equal(first.rounds[0].outcome.effectState,'unknown');
    const second=superviseOnce({repoRoot:root,launcher:'L.mjs',now:()=>10_000_001,orca,log:()=>{}});assert.equal(second.rounds[0].reason,'kernel launch in progress');assert.equal(creates,1);
  }finally{Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,100);fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('a confirmed local child exit releases only a still-launching exact reservation',()=>{
  const root=tmp();try{
    const runningDir=workflow(root,'local-running',{lastAt:1});let runningChild;
    const runningLaunch=superviseOnce({repoRoot:root,launcher:'L.mjs',now:()=>10_000_000,spawnFn:()=>{runningChild=new EventEmitter();runningChild.pid=54321;runningChild.unref=()=>{};return runningChild;},log:()=>{},only:['local-running']});
    assert.equal(runningLaunch.rounds[0].outcome.ok,true);const reserved=inspectStartup(runningDir);assert.equal(reserved.pid,54321);
    const acquired=acquireStartup(runningDir,{launchToken:reserved.token,pid:54321});runningChild.emit('close',0,null);
    assert.equal(inspectStartup(runningDir).phase,'running','a child close after acquisition cannot release running ownership');assert.equal(inspectStartup(runningDir).token,acquired.token);

    const exitDir=workflow(root,'local-exit',{lastAt:1});let exitedChild;
    const first=superviseOnce({repoRoot:root,launcher:'L.mjs',now:()=>10_000_001,spawnFn:()=>{exitedChild=new EventEmitter();exitedChild.pid=54322;exitedChild.unref=()=>{};return exitedChild;},log:()=>{},only:['local-exit']});
    assert.equal(first.rounds[0].outcome.ok,true);assert.equal(inspectStartup(exitDir).pid,54322);
    exitedChild.emit('close',1,null);assert.equal(inspectStartup(exitDir),null);
    const second=superviseOnce({repoRoot:root,launcher:'L.mjs',now:()=>10_000_002,spawnFn:()=>({pid:54323,unref(){},once(){}}),log:()=>{},only:['local-exit']});
    assert.equal(second.rounds[0].outcome.ok,true,'a confirmed pre-acquire exit permits an exact retry');
  }finally{Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,100);fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('unknown native terminal cleanup retains startup ownership and suppresses retry',()=>{
  const root=tmp();try{
    const dir=workflow(root,'cleanup-unknown',{lastAt:1}),state=JSON.parse(fs.readFileSync(path.join(dir,'state.json'),'utf8'));state.hostAdapter='orca';fs.writeFileSync(path.join(dir,'state.json'),JSON.stringify(state));let creates=0,closes=0;
    const orca={invoke:name=>{if(name==='terminal-create'){creates+=1;return {outcome:'ok',receipt:{result:{terminal:{handle:'term_cleanup'}}}};}if(name==='terminal-read')return {outcome:'failed',effectState:'none',reason:'not ready'};if(name==='terminal-close'){closes+=1;return {outcome:'unknown',effectState:'unknown',reason:'transport lost'};}throw Error(name);}};
    const first=superviseOnce({repoRoot:root,launcher:'L.mjs',orca,now:()=>10_000_000,log:()=>{}});
    assert.equal(first.rounds[0].outcome.effectState,'unknown');assert.equal(closes,1);assert.equal(inspectStartup(dir).phase,'launching');
    const second=superviseOnce({repoRoot:root,launcher:'L.mjs',orca,now:()=>10_000_001,log:()=>{}});
    assert.equal(second.rounds[0].reason,'kernel launch in progress');assert.equal(creates,1);
  }finally{Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,100);fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('the synchronous supervisor loop reclaims a confirmed exited local child without waiting for its close callback',()=>{
  const root=tmp();try{
    workflow(root,'real-child-exit',{lastAt:1});const launcher=path.join(root,'exit.mjs');fs.writeFileSync(launcher,'process.exit(0);\n');
    const result=superviseForever({repoRoot:root,launcher,maxRounds:2,pollMs:250,probe:()=>({ok:false,reason:'test'}),stamp:()=>1,log:()=>{}});
    const starts=fs.readFileSync(path.join(root,'.starciwork','_local','workflows','real-child-exit','kernel.log'),'utf8').match(/=== kernel start/g)??[];
    assert.equal(starts.length,2,'the second synchronous round confirms the first pid exited and launches once more');
    assert.equal(result.rounds[0].outcome.ok,true);
  }finally{Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,150);fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('a startup reservation a dead supervisor left past the launch window is reclaimed and the kernel starts again',()=>{
  const root=tmp();try{
    const dir=workflow(root,'stale-reservation',{lastAt:1});
    const stale=reserveStartup(dir,{pid:999999,now:()=>1,alive:()=>false});assert.equal(stale.ok,true);
    const early=superviseOnce({repoRoot:root,launcher:'L.mjs',now:()=>LAUNCH_WINDOW_MS-1,aliveFn:()=>false,spawnFn:()=>{throw Error('no launch inside the window');},log:()=>{}});
    assert.equal(early.rounds[0].reason,'kernel launch in progress');
    const events=[];
    const late=superviseOnce({repoRoot:root,launcher:'L.mjs',now:()=>LAUNCH_WINDOW_MS+1,aliveFn:()=>false,spawnFn:()=>({pid:54330,unref(){},once(){}}),log:event=>events.push(event)});
    assert.equal(late.rounds[0].action,'start');assert.equal(late.rounds[0].outcome.ok,true);
    const reclaimed=events.find(event=>event.event==='startup-reservation-reclaimed');
    assert.equal(reclaimed.pid,999999);assert.equal(reclaimed.phase,'launching');assert.match(reclaimed.reason,/launch window passed/);
    assert.equal(inspectStartup(dir).pid,54330,'the new launch owns startup');
  }finally{Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,100);fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test('an Orca kernel launch binds its coordinator terminal; a launch that never acquires is reclaimed after the window and its terminal closed',()=>{
  const root=tmp();try{
    const dir=workflow(root,'native-dead',{lastAt:1}),state=JSON.parse(fs.readFileSync(path.join(dir,'state.json'),'utf8'));state.hostAdapter='orca';fs.writeFileSync(path.join(dir,'state.json'),JSON.stringify(state));
    let creates=0;const closed=[];
    const orca={invoke:(name,params)=>{if(name==='terminal-create'){creates+=1;return {outcome:'ok',receipt:{result:{terminal:{handle:`term_${creates}`}}}};}if(name==='terminal-close'){closed.push(params.terminal);return {outcome:'ok'};}return {outcome:'ok',receipt:{result:{}}};}};
    const first=superviseOnce({repoRoot:root,launcher:'L.mjs',orca,now:()=>10_000_000,aliveFn:()=>true,log:()=>{}});
    assert.equal(first.rounds[0].outcome.terminal,'term_1');assert.deepEqual([inspectStartup(dir).phase,inspectStartup(dir).terminal],['launching-native','term_1']);
    const waiting=superviseOnce({repoRoot:root,launcher:'L.mjs',orca,now:()=>10_000_000+LAUNCH_WINDOW_MS-1,aliveFn:()=>true,log:()=>{}});
    assert.equal(waiting.rounds[0].reason,'kernel launch in progress');assert.equal(creates,1);
    const events=[];
    const reclaim=superviseOnce({repoRoot:root,launcher:'L.mjs',orca,now:()=>10_000_000+LAUNCH_WINDOW_MS+1,aliveFn:()=>true,log:event=>events.push(event)});
    assert.equal(reclaim.rounds[0].action,'start');assert.equal(reclaim.rounds[0].outcome.terminal,'term_2');
    assert.deepEqual(closed,['term_1'],'the terminal of the dead launch is closed before the new one opens');
    assert.deepEqual(events.map(event=>event.event),['startup-reservation-reclaimed','stale-kernel-terminals-closed','kernel-started-in-coordinator']);assert.equal(events[0].terminal,'term_1');
    assert.match(events[0].reason,/no kernel process holds the lock/);
    assert.equal(inspectStartup(dir).terminal,'term_2');
  }finally{Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,100);fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});
