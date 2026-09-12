import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectWorkflow,superviseForever,superviseOnce,supervisorAction} from '../execution/kernel-supervisor.mjs';

const tmp=()=>{const dir=path.join(os.tmpdir(),'starci-supervisor-spec',`${Date.now()}-${Math.random().toString(16).slice(2)}`);fs.mkdirSync(path.join(dir,'.starciwork','_local','workflows'),{recursive:true});return dir;};
function workflow(root,id,{approved=true,finished=null,lastAt,pid=null,stop=false}={}){
  const dir=path.join(root,'.starciwork','_local','workflows',id);fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'state.json'),JSON.stringify({schema:'starci/workflow-state@1',kernel:'starci/workflow-kernel@1',id,approved,finished,worktree:root,host:'H'}));
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
