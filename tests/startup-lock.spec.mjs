import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {acquireStartup,inspectStartup,reserveStartup} from '../kernel/startup-lock.mjs';

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

test('an unresolved launching owner never expires into inferred no-effect',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-startup-unknown-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100}));
  const launch=reserveStartup(dir,{pid:999999,now:()=>1,alive:()=>false});assert.equal(launch.ok,true);
  const later=await runChild(dir);assert.equal(later.ok,false);assert.match(later.reason,/unresolved ownership/);
  assert.equal(inspectStartup(dir).token,launch.token);
});
