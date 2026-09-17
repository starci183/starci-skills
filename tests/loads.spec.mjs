import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {openLedger} from '../kernel/ledger-db.mjs';
import {setSignal} from '../kernel/launch.mjs';
import {createLoadsLedger,kernelAliveAt,readLoads,readProviderLoads,recordProviderLoads,sweepRuntimeLoads} from '../kernel/loads.mjs';

/**
 * The shared runtime ledger (docs/ledger-db.md §4 `runtime_loads`): one workflow's reserve/launch/release
 * cycle is visible to another's `readLoads`, minus its own entries; a dead kernel's live rows never survive a
 * sweep; provider quota rows (`provider:<name>`) live beside load rows and are never touched by it.
 */
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'starci-loads-spec-'));
const settle=()=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,150);
const wipe=dir=>{settle();try{fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:150});}catch{}};
/** A kernel-lock row naming a pid this test's fixed `alive` set will answer for. */
const markKernel=(ledger,workflow,alive,pid=1)=>setSignal(ledger.db,workflow,'kernel-lock',{pid,value:{phase:alive?'running':'exited'},at:1});

test('reserve, launch and release are visible to another workflow, minus its own entries; completion enters history',()=>{
  const dir=tmp();
  try{
    const ledger=openLedger({file:path.join(dir,'runtime.sqlite'),now:()=>1});
    markKernel(ledger,'wf-a',true,1);markKernel(ledger,'wf-b',true,2);
    const alive=id=>['wf-a','wf-b'].includes(id);
    const a=createLoadsLedger({ledger,workflow:'wf-a',now:()=>1000,alive});
    const b=createLoadsLedger({ledger,workflow:'wf-b',now:()=>1000,alive});
    const reserved=a.reserved({runtime:'test-runtime-a',op:'op-1',role:'implement'});
    assert.equal(reserved.reserved,true);
    const seenByB=b.read();
    assert.equal(seenByB.loads['test-runtime-a'],1,'B sees A\'s reservation as outside load');
    assert.equal(seenByB.ops['test-runtime-a'][0].workflow,'wf-a');
    const seenByA=a.read();
    assert.equal(seenByA.loads['test-runtime-a']??0,0,'A never counts its own reservation as outside load');
    a.launched({runtime:'test-runtime-a',op:'op-1'});
    assert.equal(b.read().ops['test-runtime-a'][0].phase,'launched');
    const released=a.released({runtime:'test-runtime-a',op:'op-1',completed:true});
    assert.equal(released.dropped,'op-1');
    const after=b.read();
    assert.equal(after.loads['test-runtime-a']??0,0,'the live entry is gone once released');
    assert.equal(after.history['test-runtime-a']?.[0]?.op,'op-1','a completed op enters the rolling service history');
    ledger.close();
  }finally{wipe(dir);}
});

test('a reserve against a stale revision conflicts and writes nothing; a fresh one succeeds',()=>{
  const dir=tmp();
  try{
    const ledger=openLedger({file:path.join(dir,'runtime.sqlite'),now:()=>1});
    markKernel(ledger,'wf-a',true);
    const a=createLoadsLedger({ledger,workflow:'wf-a',now:()=>1,alive:()=>true});
    const first=a.reserved({runtime:'test-runtime-a',op:'op-1'});
    const revision=first.revision;
    const stale=a.reserved({runtime:'test-runtime-a',op:'op-2',expectedRevision:revision-1});
    assert.equal(stale.conflict,true);assert.equal(stale.actualRevision,revision);
    assert.equal(a.read().ops['test-runtime-a']?.some(op=>op.op==='op-2'),undefined,'the conflicting write never happened');
    const fresh=a.reserved({runtime:'test-runtime-a',op:'op-2',expectedRevision:revision});
    assert.equal(fresh.reserved,true);
    ledger.close();
  }finally{wipe(dir);}
});

test('a provider cooldown is shared, and the longest one seen wins over a shorter later report',()=>{
  const dir=tmp();
  try{
    const ledger=openLedger({file:path.join(dir,'runtime.sqlite'),now:()=>1});
    markKernel(ledger,'wf-a',true);markKernel(ledger,'wf-b',true);
    const alive=()=>true;
    const a=createLoadsLedger({ledger,workflow:'wf-a',now:()=>1,alive});
    const b=createLoadsLedger({ledger,workflow:'wf-b',now:()=>1,alive});
    a.cooled({runtime:'test-runtime-a',until:5000,reason:'rate-limited',kind:'rate-limited'});
    assert.equal(b.read().cooling['test-runtime-a'].until,5000);
    a.cooled({runtime:'test-runtime-a',until:3000,reason:'a shorter one reported late'});
    assert.equal(b.read().cooling['test-runtime-a'].until,5000,'the longer cooldown is never shortened');
    ledger.close();
  }finally{wipe(dir);}
});

test('sync drops this workflow\'s live entries whose op is no longer running, and only its own',()=>{
  const dir=tmp();
  try{
    const ledger=openLedger({file:path.join(dir,'runtime.sqlite'),now:()=>1});
    markKernel(ledger,'wf-a',true);markKernel(ledger,'wf-b',true);
    const alive=()=>true;
    const a=createLoadsLedger({ledger,workflow:'wf-a',now:()=>1,alive});
    const b=createLoadsLedger({ledger,workflow:'wf-b',now:()=>1,alive});
    a.reserved({runtime:'test-runtime-a',op:'stale-op'});
    a.reserved({runtime:'test-runtime-a',op:'kept-op'});
    b.reserved({runtime:'test-runtime-a',op:'op-b'});
    const result=a.sync({ops:['kept-op']});
    assert.deepEqual(result.dropped,[{runtime:'test-runtime-a',op:'stale-op'}]);
    const view=readLoads({ledger,workflow:null,now:()=>2,alive});
    assert.deepEqual(view.ops['test-runtime-a'].map(op=>op.op).sort(),['kept-op','op-b']);
    ledger.close();
  }finally{wipe(dir);}
});

test('sweepRuntimeLoads drops the live entries of a kernel whose kernel-lock is no longer alive, and reports what it dropped',()=>{
  const dir=tmp();
  try{
    const ledger=openLedger({file:path.join(dir,'runtime.sqlite'),now:()=>1});
    markKernel(ledger,'wf-live',true,111);
    markKernel(ledger,'wf-dead',false,222);
    const alive=id=>id==='wf-live';
    createLoadsLedger({ledger,workflow:'wf-live',now:()=>1,alive}).reserved({runtime:'test-runtime-a',op:'op-live'});
    createLoadsLedger({ledger,workflow:'wf-dead',now:()=>1,alive}).reserved({runtime:'test-runtime-a',op:'op-dead'});
    const swept=sweepRuntimeLoads(ledger,{now:()=>2,alive});
    assert.deepEqual(swept.dropped,[{runtime:'test-runtime-a',workflow:'wf-dead',op:'op-dead'}]);
    const view=readLoads({ledger,workflow:null,now:()=>3,alive});
    assert.deepEqual(view.ops['test-runtime-a'].map(op=>op.workflow),['wf-live']);
    ledger.close();
  }finally{wipe(dir);}
});

test('kernelAliveAt is true only for a running, live-pid kernel-lock; a launching one is not yet a kernel',()=>{
  const dir=tmp();
  try{
    const ledger=openLedger({file:path.join(dir,'runtime.sqlite'),now:()=>1});
    setSignal(ledger.db,'wf-running','kernel-lock',{pid:process.pid,value:{phase:'running'},at:1});
    setSignal(ledger.db,'wf-launching','kernel-lock',{pid:process.pid,value:{phase:'launching'},at:1});
    assert.equal(kernelAliveAt(ledger.db,'wf-running'),true,'the default alive check treats the current process as alive');
    assert.equal(kernelAliveAt(ledger.db,'wf-launching'),false,'launching is not yet a kernel holding the runtime');
    assert.equal(kernelAliveAt(ledger.db,'wf-unknown'),false);
    ledger.close();
  }finally{wipe(dir);}
});

test('provider windows round-trip beside load rows, and the sweep never touches them',()=>{
  const dir=tmp();
  try{
    const ledger=openLedger({file:path.join(dir,'runtime.sqlite'),now:()=>1});
    markKernel(ledger,'wf-dead',false);
    createLoadsLedger({ledger,workflow:'wf-dead',now:()=>1,alive:()=>false}).reserved({runtime:'test-runtime-a',op:'op-1'});
    const written=recordProviderLoads(ledger,{providers:{claude:{windows:{session:{usedPercent:10}}}}},{now:()=>5});
    assert.deepEqual(written.providers,['claude']);
    const swept=sweepRuntimeLoads(ledger,{now:()=>6,alive:()=>false});
    assert.deepEqual(swept.dropped,[{runtime:'test-runtime-a',workflow:'wf-dead',op:'op-1'}]);
    const read=readProviderLoads({ledger});
    assert.equal(read.providers.claude.windows.session.usedPercent,10,'the provider row survived the sweep of dead load entries');
    ledger.close();
  }finally{wipe(dir);}
});
