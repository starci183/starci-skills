import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {closeStaleCoordinatorTerminals,readClosedCoordinatorTerminals,readCoordinatorTerminals,recordCoordinatorTerminal} from '../kernel/coordinator-terminals.mjs';
import {startKernel} from '../kernel/supervisor.mjs';
import {UNCLOSABLE_RETRY_MS,sweepStaleTerminals} from '../kernel/terminals.mjs';

const tmp=t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-coordinator-terminals-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100}));return dir;};

test('the record keeps every coordinator terminal once and closes all but the one to keep',t=>{
  const dir=tmp(t);
  assert.deepEqual(readCoordinatorTerminals(dir),[]);
  recordCoordinatorTerminal(dir,'term_a');recordCoordinatorTerminal(dir,'term_b');recordCoordinatorTerminal(dir,'term_a');recordCoordinatorTerminal(dir,'');
  assert.deepEqual(readCoordinatorTerminals(dir),['term_a','term_b']);
  const closes=[];
  const first=closeStaleCoordinatorTerminals(dir,{keep:'term_b',close:handle=>{closes.push(handle);return handle!=='term_a';}});
  assert.deepEqual(closes,['term_a']);assert.deepEqual(first.closed,[]);assert.deepEqual(first.kept,['term_a','term_b'],'a terminal whose close failed stays recorded');
  const second=closeStaleCoordinatorTerminals(dir,{keep:'term_b',close:()=>true});
  assert.deepEqual(second.closed.map(item=>item.terminal),['term_a']);assert.deepEqual(readCoordinatorTerminals(dir),['term_b']);
  const gone=closeStaleCoordinatorTerminals(dir,{keep:null,known:[],close:()=>{throw Error('never asked');}});
  assert.deepEqual(gone.closed,[{terminal:'term_b',reason:'coordinator terminal already gone'}]);assert.deepEqual(readCoordinatorTerminals(dir),[]);
});

test('a supervisor start closes the coordinator terminals of the dead kernels before it opens the new one, by handle',t=>{
  const dir=tmp(t);
  const calls=[];let created=0;
  const orca={invoke:(name,params)=>{calls.push([name,params?.terminal??params?.title??null]);if(name==='terminal-create'){created+=1;return {outcome:'ok',receipt:{result:{terminal:{handle:`term_${created}`}}}};}return {outcome:'ok',receipt:{result:{}}};}};
  const info={id:'wf',dir,worktree:'D:/repo',host:'D:/host',hostAdapter:'orca',run:'run_wf'};
  const first=startKernel(info,{launcher:'D:/host/launch.mjs',orca});
  assert.equal(first.terminal,'term_1');assert.deepEqual(readCoordinatorTerminals(dir),['term_1']);
  assert.deepEqual(calls.map(([name])=>name),['terminal-create','terminal-read','terminal-send'],'nothing to close on the first start');
  calls.length=0;const events=[];
  // The first kernel died (disk full) and Orca now titles its tab `powershell.exe`; the supervisor starts again.
  const second=startKernel(info,{launcher:'D:/host/launch.mjs',orca,log:event=>events.push(event)});
  assert.equal(second.terminal,'term_2');
  assert.deepEqual(calls.map(([name,arg])=>`${name}:${arg}`),['terminal-close:term_1','terminal-create:[Kernel] wf','terminal-read:term_2','terminal-send:term_2']);
  assert.deepEqual(readCoordinatorTerminals(dir),['term_2']);
  assert.deepEqual(events.find(event=>event.event==='stale-kernel-terminals-closed').closed.map(item=>item.terminal),['term_1']);
});

test('a running kernel sweep closes the recorded coordinator terminals of earlier kernels but never its own',t=>{
  const dir=tmp(t);
  recordCoordinatorTerminal(dir,'term_old1');recordCoordinatorTerminal(dir,'term_old2');recordCoordinatorTerminal(dir,'term_gone');recordCoordinatorTerminal(dir,'term_live');
  const events=[],store={dir,appendEvent:event=>events.push(event)};
  const state={id:'wf',worktree:'D:/repo',from:'term_live',ops:[]};
  const closes=[];
  const orca={invoke:(name,params)=>{
    if(name==='terminal-list')return {outcome:'ok',receipt:{result:{terminals:[
      {handle:'term_old1',title:'C:\\\\WINDOWS\\\\System32\\\\WindowsPowerShell\\\\v1.0\\\\powershell.exe'},{handle:'term_old2',title:'C:\\\\WINDOWS\\\\System32\\\\WindowsPowerShell\\\\v1.0\\\\powershell.exe'},
      {handle:'term_live',title:'[Kernel] wf'},{handle:'term_owner',title:'Terminal 1'}]}}};
    if(name==='terminal-close'){closes.push(params.terminal);return {outcome:'ok'};}
    throw Error(name);
  }};
  const closed=sweepStaleTerminals(orca,store,state,{cwd:'D:/repo',now:()=>5});
  assert.deepEqual(closes.sort(),['term_old1','term_old2'],'the shell-titled tabs of the dead kernels are closed by handle; the live kernel tab and the owner tab are not');
  assert.deepEqual(closed.map(item=>item.terminal).sort(),['term_old1','term_old2']);
  assert.deepEqual(readCoordinatorTerminals(dir),['term_live'],'a terminal Orca no longer lists is dropped from the record without a close call');assert.deepEqual(readClosedCoordinatorTerminals(dir).sort(),['term_old1','term_old2'],'answered closes are remembered while Orca lists the tabs');
  assert.equal(events.at(-1).event,'terminals-swept');
});

test('a start also closes the coordinator terminals the supervisor log remembers from before the record existed',t=>{
  const root=tmp(t),dir=path.join(root,'wf');fs.mkdirSync(dir);
  fs.writeFileSync(path.join(root,'supervisor.log'),[JSON.stringify({at:1,event:'kernel-started-in-coordinator',id:'wf',terminal:'term_old_a',run:'run_wf'}),'not json',JSON.stringify({at:2,event:'kernel-started-in-coordinator',id:'other',terminal:'term_other',run:'run_o'}),JSON.stringify({at:3,event:'kernel-started-in-coordinator',id:'wf',terminal:'term_old_b',run:'run_wf'})].join('\n')+'\n');
  const closed=[];let created=0;
  const orca={invoke:(name,params)=>{if(name==='terminal-create'){created+=1;return {outcome:'ok',receipt:{result:{terminal:{handle:`term_new_${created}`}}}};}if(name==='terminal-close'){closed.push(params.terminal);return {outcome:'ok'};}return {outcome:'ok',receipt:{result:{}}};}};
  const started=startKernel({id:'wf',dir,worktree:'D:/repo',host:'D:/host',hostAdapter:'orca',run:'run_wf'},{launcher:'D:/host/launch.mjs',orca});
  assert.equal(started.terminal,'term_new_1');assert.deepEqual(closed.sort(),['term_old_a','term_old_b'],'both logged terminals of this workflow are closed, the other workflow untouched');
  assert.deepEqual(readCoordinatorTerminals(dir),['term_new_1']);
});

test('a running kernel sweep also seeds the record from the supervisor log, so tabs opened before the record existed are closed',t=>{
  const root=tmp(t),dir=path.join(root,'wf');fs.mkdirSync(dir);
  fs.writeFileSync(path.join(root,'supervisor.log'),JSON.stringify({at:1,event:'kernel-started-in-coordinator',id:'wf',terminal:'term_before_record',run:'run_wf'})+String.fromCharCode(10));
  const events=[],store={dir,appendEvent:event=>events.push(event)},state={id:'wf',worktree:'D:/repo',from:'term_live',ops:[]},closes=[];
  const orca={invoke:(name,params)=>{if(name==='terminal-list')return {outcome:'ok',receipt:{result:{terminals:[{handle:'term_before_record',title:'powershell.exe'},{handle:'term_live',title:'[Kernel] wf'}]}}};if(name==='terminal-close'){closes.push(params.terminal);return {outcome:'ok'};}throw Error(name);}};
  sweepStaleTerminals(orca,store,state,{cwd:'D:/repo',now:()=>5});
  assert.deepEqual(closes,['term_before_record']);assert.deepEqual(readCoordinatorTerminals(dir),[],'the closed tab leaves the record; the kernel never recorded its own');
});

test('a tab Orca answers a close for but still lists is reported unclosable once and not asked again for half an hour',t=>{
  const dir=tmp(t);recordCoordinatorTerminal(dir,'term_zombie');
  const events=[],store={dir,appendEvent:event=>events.push(event)},state={id:'wf',worktree:'D:/repo',from:'term_live',ops:[]},closes=[];
  const orca={invoke:(name,params)=>{if(name==='terminal-list')return {outcome:'ok',receipt:{result:{terminals:[{handle:'term_zombie',title:'powershell.exe'},{handle:'term_live',title:'[Kernel] wf'}]}}};if(name==='terminal-close'){closes.push(params.terminal);return {outcome:'ok'};}throw Error(name);}};
  let clock=1_000_000;const now=()=>clock;
  sweepStaleTerminals(orca,store,state,{cwd:'D:/repo',now});
  assert.deepEqual(closes,['term_zombie']);assert.equal(events.filter(event=>event.event==='terminals-swept').length,1);
  clock+=30_000;sweepStaleTerminals(orca,store,state,{cwd:'D:/repo',now});
  clock+=30_000;sweepStaleTerminals(orca,store,state,{cwd:'D:/repo',now});
  assert.deepEqual(closes,['term_zombie'],'the tab still listed after its close is not closed again');
  assert.deepEqual(events.filter(event=>event.event==='terminals-unclosable').map(event=>event.terminals),[['term_zombie']],'reported exactly once');
  assert.equal(events.filter(event=>event.event==='terminals-swept').length,1,'no sweep event without a close');
  clock+=UNCLOSABLE_RETRY_MS;sweepStaleTerminals(orca,store,state,{cwd:'D:/repo',now});
  assert.deepEqual(closes,['term_zombie','term_zombie'],'after the window one more close is tried');
  const gone={invoke:(name,params)=>{if(name==='terminal-list')return {outcome:'ok',receipt:{result:{terminals:[{handle:'term_live',title:'[Kernel] wf'}]}}};throw Error(name);}};
  sweepStaleTerminals(gone,store,state,{cwd:'D:/repo',now});
  assert.deepEqual(Object.keys(state.terminalCloseAttempts),[],'a tab that finally left is forgotten');
});
