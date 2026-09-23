import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {spawn, spawnSync} from 'node:child_process';
import {acquireUatSlot, maxConcurrent, slotHolders, slotQueue, slotsDir} from '../scripts/uat/uat-slots.mjs';

// The owner rule: at most uat.maxConcurrent (default 10) UAT runs execute at once machine-wide; the rest
// wait for a slot. Every case here uses its own STARCI_UAT_SLOTS_DIR, never the machine's.
const SLOTS_URL=new URL('../scripts/uat/uat-slots.mjs',import.meta.url).href;
const tempSlots=t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-uat-slots-spec-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  return {dir,env:{...process.env,STARCI_UAT_SLOTS_DIR:dir}};
};
const locks=dir=>fs.readdirSync(dir).filter(name=>/^slot-\d+\.lock$/.test(name)).sort();
const deadPid=()=>{const r=spawnSync(process.execPath,['-e',''],{windowsHide:true});return r.pid;};
const exited=child=>new Promise(resolve=>{if(child.exitCode!==null||child.signalCode!==null)resolve();else child.once('exit',()=>resolve());});
const holdIn=(env,body)=>spawn(process.execPath,['--input-type=module','-e',`import {acquireUatSlot} from ${JSON.stringify(SLOTS_URL)};
const slot=await acquireUatSlot({runId:'child',limit:1,pollMs:50});console.log('held '+slot.slot);${body}`],{env,stdio:['ignore','pipe','ignore'],windowsHide:true});
const firstLine=child=>new Promise((resolve,reject)=>{let text='';child.stdout.on('data',chunk=>{text+=chunk;if(text.includes('\n'))resolve(text.trim());});child.once('exit',()=>reject(new Error(`child exited before printing: ${text}`)));});

test('the ceiling is STARCI_UAT_MAX_CONCURRENT, else config uat.maxConcurrent, else 10; the dir sits beside machine.sqlite',()=>{
  assert.equal(maxConcurrent({env:{STARCI_UAT_MAX_CONCURRENT:'3'},config:null}),3);
  assert.equal(maxConcurrent({env:{},config:{uat:{maxConcurrent:4}}}),4);
  assert.equal(maxConcurrent({env:{},config:{}}),10);
  assert.equal(maxConcurrent({env:{STARCI_UAT_MAX_CONCURRENT:'0'},config:{}}),10,'a non-positive override is ignored');
  assert.equal(maxConcurrent({env:{},config:{uat:{maxConcurrent:0}}}),10,'an invalid config never stops a run');
  assert.equal(slotsDir({LOCALAPPDATA:path.join(os.tmpdir(),'la')}),path.join(os.tmpdir(),'la','StarCi','runtime','uat-slots'));
});

test('11 concurrent acquisitions with cap 10: exactly 10 hold, 1 queues, and it gets the slot one releases',async t=>{
  const {dir,env}=tempSlots(t);
  const queued=[];let settled=0;
  const pending=Array.from({length:11},(_,i)=>acquireUatSlot({runId:`run-${i}`,env,limit:10,pollMs:20,onQueued:info=>queued.push({i,...info})}).then(slot=>{settled++;return {i,slot};}));
  const early=await Promise.race([Promise.all(pending.slice(0,10)),new Promise(resolve=>setTimeout(()=>resolve(null),3000))]);
  assert.ok(early,'the first ten acquisitions hold a slot');
  await new Promise(resolve=>setTimeout(resolve,150));
  assert.equal(settled,10,'the eleventh is still waiting');
  assert.equal(locks(dir).length,10);
  assert.deepEqual(slotHolders({env}).map(h=>h.slot),[1,2,3,4,5,6,7,8,9,10]);
  assert.deepEqual(queued.map(q=>q.i),[10]);
  assert.deepEqual({position:queued[0].position,limit:queued[0].limit,holders:queued[0].holders},{position:1,limit:10,holders:10});
  assert.equal(slotQueue({env}).length,1,'the waiter is visible in the queue');
  const freed=early[3].slot;freed.release();freed.release();
  const last=await pending[10];
  assert.equal(last.slot.slot,freed.slot,'the queued run takes the released slot');
  assert.equal(last.slot.waited,true);
  assert.equal(locks(dir).length,10,'never more than the cap');
  assert.equal(slotQueue({env}).length,0,'the ticket is gone once it holds');
  for(const {slot} of [...early.filter(e=>e.i!==3),last])slot.release();
  assert.equal(locks(dir).length,0);
});

test('a stale slot — dead holder, or a pid recorded before this boot — is reclaimed',async t=>{
  const {dir,env}=tempSlots(t);
  fs.writeFileSync(path.join(dir,'slot-1.lock'),JSON.stringify({pid:deadPid(),startedAt:new Date().toISOString(),runId:'dead'}));
  fs.writeFileSync(path.join(dir,'slot-2.lock'),JSON.stringify({pid:process.pid,startedAt:'2000-01-01T00:00:00.000Z',runId:'previous-boot'}));
  assert.deepEqual(slotHolders({env,reclaim:false}),[]);
  const a=await acquireUatSlot({runId:'a',env,limit:2,pollMs:20});
  const b=await acquireUatSlot({runId:'b',env,limit:2,pollMs:20});
  assert.deepEqual([a.slot,b.slot].sort(),[1,2]);
  assert.deepEqual(slotHolders({env}).map(h=>h.runId).sort(),['a','b']);
  a.release();b.release();
});

test('a crash releases its slot: an uncaught error through the exit hook, a hard kill by stale reclaim',async t=>{
  const {dir,env}=tempSlots(t);
  const crash=holdIn(env,`setTimeout(()=>{throw new Error('boom');},20);`);
  t.after(()=>{try{crash.kill();}catch{}});
  assert.equal(await firstLine(crash),'held 1');
  await exited(crash);
  assert.notEqual(crash.exitCode,0);
  assert.deepEqual(locks(dir),[],'the exit hook removed the lock');
  const killed=holdIn(env,'setInterval(()=>{},1000);');
  t.after(()=>{try{killed.kill('SIGKILL');}catch{}});
  assert.equal(await firstLine(killed),'held 1');
  killed.kill('SIGKILL');await exited(killed);
  assert.deepEqual(locks(dir),['slot-1.lock'],'a hard kill leaves its lock behind');
  const next=await acquireUatSlot({runId:'next',env,limit:1,pollMs:20});
  assert.equal(next.slot,1,'the dead holder\'s slot is reclaimed');
  next.release();
});
