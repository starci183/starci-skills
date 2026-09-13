import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectWorkflow,superviseForever,superviseOnce,supervisorAction} from '../execution/kernel-supervisor.mjs';

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
