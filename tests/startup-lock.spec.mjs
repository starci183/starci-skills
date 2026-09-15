import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {LAUNCH_WINDOW_MS,acquireStartup,bindStartupTerminal,inspectStartup,reserveStartup} from '../kernel/startup-lock.mjs';

const moduleUrl=new URL('../kernel/startup-lock.mjs',import.meta.url).href;
const runChild=(dir,delay=0)=>new Promise((resolve,reject)=>{
  const source=`import {reserveStartup} from ${JSON.stringify(moduleUrl)};const value=reserveStartup(process.argv[1]);process.stdout.write(JSON.stringify(value));setTimeout(()=>{},${delay});`;
  const child=spawn(process.execPath,['--input-type=module','-e',source,dir],{stdio:['ignore','pipe','pipe'],windowsHide:true});let out='',err='';child.stdout.on('data',chunk=>out+=chunk);child.stderr.on('data',chunk=>err+=chunk);child.on('error',reject);child.on('exit',code=>code===0?resolve(JSON.parse(out)):reject(Error(err||`exit ${code}`)));
});

test('two real processes transactionally contend for one stale running startup owner',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-startup-race-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100}));
  const launch=reserveStartup(dir,{pid:999999,alive:()=>false}),running=acquireStartup(dir,{launchToken:launch.token,pid:999999});assert.equal(running.ok,true);
  const results=await Promise.all([runChild(dir,150),runChild(dir,150)]);
  assert.equal(results.filter(item=>item.ok).length,1);assert.equal(results.filter(item=>!item.ok).length,1);
  assert.equal(inspectStartup(dir).phase,'launching');
});

test('two real processes safely initialize the database and admit one first launch',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-startup-first-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100}));
  const results=await Promise.all([runChild(dir,150),runChild(dir,150)]);
  assert.equal(results.filter(item=>item.ok).length,1);assert.equal(results.filter(item=>!item.ok).length,1);
  assert.equal(inspectStartup(dir).phase,'launching');
});

test('an unresolved launching owner holds through the launch window, then a dead reserver is reclaimed on the record',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-startup-unknown-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100}));
  const at=Date.now();
  const launch=reserveStartup(dir,{pid:999999,now:()=>at,alive:()=>false});assert.equal(launch.ok,true);
  const later=await runChild(dir);assert.equal(later.ok,false,'a real process inside the window sees the reservation as held');assert.match(later.reason,/unresolved ownership/);
  const within=reserveStartup(dir,{pid:999998,now:()=>at+LAUNCH_WINDOW_MS-1,alive:()=>false});assert.equal(within.ok,false);assert.match(within.reason,/unresolved ownership/);
  assert.equal(inspectStartup(dir).token,launch.token,'inside the window the reservation stands even though its reserver is gone');
  const heldByLiveReserver=reserveStartup(dir,{pid:999998,now:()=>at+LAUNCH_WINDOW_MS+1,alive:pid=>pid===999999});assert.equal(heldByLiveReserver.ok,false,'a reserver that still runs keeps its reservation past the window');
  const reclaimed=reserveStartup(dir,{pid:999998,now:()=>at+LAUNCH_WINDOW_MS+1,alive:()=>false});assert.equal(reclaimed.ok,true);
  assert.equal(reclaimed.reclaimed.token,launch.token);assert.match(reclaimed.reclaimed.reason,/launch window passed/);
  assert.equal(inspectStartup(dir).token,reclaimed.token);
});

test('a native launch binds its coordinator terminal and is reclaimed only after the window with no kernel lock alive',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-startup-native-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100}));
  const launch=reserveStartup(dir,{pid:4480,now:()=>1,alive:()=>false});
  const bound=bindStartupTerminal(dir,{token:launch.token,terminal:'term_kernel',now:()=>2});assert.equal(bound.ok,true);
  assert.deepEqual([inspectStartup(dir).phase,inspectStartup(dir).terminal],['launching-native','term_kernel']);
  assert.equal(bindStartupTerminal(dir,{token:'other',terminal:'term_x'}).ok,false,'only the exact launch token binds');
  assert.equal(reserveStartup(dir,{pid:5,now:()=>LAUNCH_WINDOW_MS,alive:()=>false}).ok,false,'inside the window the native launch holds');
  fs.writeFileSync(path.join(dir,'kernel.lock'),JSON.stringify({pid:777}));
  assert.equal(reserveStartup(dir,{pid:5,now:()=>LAUNCH_WINDOW_MS+3,alive:pid=>pid===777}).ok,false,'a kernel holding the lock keeps the native launch past the window');
  const acquired=acquireStartup(dir,{launchToken:launch.token,pid:777,now:()=>4});assert.equal(acquired.phase,'running','the native kernel acquires through its launch token');
  assert.equal(reserveStartup(dir,{pid:5,now:()=>LAUNCH_WINDOW_MS+5,alive:pid=>pid===777}).ok,false,'a running kernel is never reclaimed by age');
  fs.rmSync(path.join(dir,'kernel.lock'));
  const dead=reserveStartup(dir,{pid:5,now:()=>LAUNCH_WINDOW_MS+6,alive:()=>false});assert.equal(dead.ok,true);assert.equal(dead.reclaimed.phase,'running');
  const again=reserveStartup(dir,{pid:6,now:()=>7,alive:()=>false});assert.equal(again.ok,false);
  bindStartupTerminal(dir,{token:dead.token,terminal:'term_two',now:()=>8});
  const reclaimed=reserveStartup(dir,{pid:6,now:()=>LAUNCH_WINDOW_MS+9,alive:()=>false});assert.equal(reclaimed.ok,true);
  assert.equal(reclaimed.reclaimed.terminal,'term_two');assert.match(reclaimed.reclaimed.reason,/no kernel process holds the lock/);
});
