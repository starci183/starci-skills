import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DEFAULT_HEADROOM_BYTES,DISK_HEADROOM_CODE,HEADROOM_ENV,headroomThreshold,isDiskFull,measureHeadroom} from '../kernel/disk.mjs';
import {assertHeadroom,guardedStage} from '../kernel/kernel.mjs';
import {inspectWorkflow,superviseOnce,supervisorAction} from '../kernel/supervisor.mjs';
import {createStore,listWorkflows} from '../kernel/store.mjs';

/**
 * The disk is measured, never assumed: a kernel stops on the record below a printed threshold, the supervisor
 * starts nothing onto a volume without room, and a write the disk refused is a headroom stop, not one more
 * kernel error on the way to a crash loop.
 */
const statfsFor=free=>at=>({bsize:4096,bavail:Math.floor((typeof free==='function'?free(at):free)/4096)});

test('the threshold is one number, from the environment or the default, and every finding prints it',()=>{
  assert.equal(headroomThreshold({}),DEFAULT_HEADROOM_BYTES);
  assert.equal(headroomThreshold({[HEADROOM_ENV]:'2048'}),2048);
  assert.equal(headroomThreshold({[HEADROOM_ENV]:'plenty'}),DEFAULT_HEADROOM_BYTES,'an unreadable value is the default, not zero');
  const found=measureHeadroom(['D:/a/b','D:/a/c'],{thresholdBytes:10*4096,statfs:statfsFor(3*4096)});
  assert.equal(found.ok,false);assert.equal(found.checks.length,1,'one volume, one measurement');assert.equal(found.exhausted[0].thresholdBytes,10*4096);assert.equal(found.exhausted[0].freeBytes,3*4096);
});

test('a volume that cannot be measured counts as exhausted; the nearest existing ancestor of an absent path is what is measured',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-headroom-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const seen=[];const found=measureHeadroom([path.join(dir,'not','yet','created'),null,undefined],{thresholdBytes:1,statfs:at=>{seen.push(at);return {bsize:1,bavail:5};}});
  assert.deepEqual(seen,[path.resolve(dir)]);assert.equal(found.ok,true);
  const broken=measureHeadroom([dir],{thresholdBytes:1,statfs:()=>{throw Error('EIO');}});
  assert.equal(broken.ok,false);assert.equal(broken.exhausted[0].freeBytes,null);assert.match(broken.exhausted[0].reason,/EIO/);
});

test('a refused write is recognised whatever spelled it',()=>{
  assert.equal(isDiskFull(Object.assign(Error('write'),{code:'ENOSPC'})),true);
  assert.equal(isDiskFull(Object.assign(Error('database or disk is full'),{code:'ERR_SQLITE_ERROR'})),true);
  assert.equal(isDiskFull(Error('SQLITE_FULL: database or disk is full')),true);
  assert.equal(isDiskFull(Error('EPERM rename')),false);
});

test('the kernel records one event and stops with its own code when the disk is below the threshold; nothing is saved',()=>{
  const events=[],store={ledgerFile:'D:/store/.starciwork/runtime.sqlite',appendEvent:event=>events.push(event),saveState(){throw Error('must not save on a full disk');}},state={id:'wf',worktree:'D:/repo',engine:{schema:'starci/engine@1',ledgerFile:store.ledgerFile,machineFile:'D:/machine/machine.sqlite'}};
  const measure=paths=>({ok:false,thresholdBytes:5,checks:[],exhausted:paths.map(at=>({path:at,freeBytes:1,thresholdBytes:5,exhausted:true}))});
  assert.throws(()=>assertHeadroom(store,state,{measure}),error=>error.code===DISK_HEADROOM_CODE&&/disk headroom below 5 bytes/.test(error.message));
  assert.deepEqual(events,[{event:'disk-headroom-exhausted',thresholdBytes:5,volumes:[{path:store.ledgerFile,freeBytes:1},{path:'D:/repo',freeBytes:1},{path:'D:/machine/machine.sqlite',freeBytes:1}]}]);
  assert.equal(assertHeadroom(store,state,{measure:()=>({ok:true,thresholdBytes:5,checks:[],exhausted:[]})}).ok,true);
});

test('a stage that meets a full disk raises the headroom stop instead of counting a kernel error',()=>{
  const events=[],store={appendEvent:event=>events.push(event),saveState(){}},state={engine:{schema:'starci/engine@1'},kernelErrors:0,needUser:[],ops:[]};
  assert.throws(()=>guardedStage(store,state,{engine:{}},'accept',()=>{throw Object.assign(Error('database or disk is full'),{code:'ERR_SQLITE_ERROR'});}),error=>error.code===DISK_HEADROOM_CODE);
  assert.equal(state.kernelErrors,0,'not one more kernel error');assert.deepEqual(events.map(event=>event.event),['disk-full']);
  assert.equal(guardedStage(store,state,{engine:{}},'accept',()=>{throw Error('ordinary failure');}),'error');assert.equal(state.kernelErrors,1);
});

test('the supervisor leaves a workflow alone while its volume has no room, logging the change once, and starts it again when room returns',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-headroom-supervisor-'));
  const store=createStore({repoRoot:root,id:'wf'});
  t.after(()=>{store.close();fs.rmSync(root,{recursive:true,force:true});});
  // `.starciwork/_local` is retired kernel authority (never read by the supervisor); a workflow it can see is a
  // ledger row, so the fixture is a real ledger via createStore/saveState, read back through listWorkflows -
  // exactly what superviseOnce itself does.
  store.saveState({schema:'starci/workflow-state@1',kernel:'starci/workflow-kernel@1',id:'wf',approved:true,finished:null,worktree:root,host:'H'});
  store.appendEvent({event:'tick'});
  const measureExhausted=()=>({ok:false,thresholdBytes:9,checks:[],exhausted:[{path:root,freeBytes:2,thresholdBytes:9,exhausted:true}]}),measureFine=()=>({ok:true,thresholdBytes:9,checks:[],exhausted:[]});
  const [entry]=listWorkflows(root);
  const info=inspectWorkflow(entry,{now:()=>10,measure:measureExhausted});
  assert.deepEqual(supervisorAction(info),{action:'leave',reason:'disk headroom below threshold',headroom:info.headroom});
  assert.equal(supervisorAction(inspectWorkflow(entry,{now:()=>10,measure:measureFine})).action,'start');
  const log=[],spawns=[];
  const round=measure=>superviseOnce({repoRoot:root,launcher:'launch.mjs',now:()=>10,log:event=>log.push(event),measure,spawnFn:()=>{spawns.push(1);return {pid:4242,unref(){},once(){}};}});
  round(measureExhausted);round(measureExhausted);
  assert.deepEqual(log.filter(event=>event.event.startsWith('disk-')).map(event=>[event.event,event.id,event.volumes?.[0]?.freeBytes]),[['disk-headroom-exhausted','wf',2]],'the same exhaustion is logged once');
  assert.equal(spawns.length,0,'nothing is started onto a full disk');
  round(measureFine);
  assert.deepEqual(log.filter(event=>event.event.startsWith('disk-')).map(event=>event.event),['disk-headroom-exhausted','disk-headroom-restored']);
  assert.equal(spawns.length,1,'the kernel starts when room returns');
});
