import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {openLedger} from '../kernel/ledger-db.mjs';
import {awaitLaunch,closeStaleCoordinatorTerminals,pruneClosedCoordinatorTerminals,readClosedCoordinatorTerminals,
  readCoordinatorTerminals,readLaunch,recordCoordinatorTerminal,seedCoordinatorTerminals,writeLaunch} from '../kernel/launch.mjs';

/**
 * `kernel/launch.mjs`'s launch hand-off record (was `launch.json`) and coordinator-terminal record (was
 * `coordinator-terminals.json` + `supervisor.log` replay), now `signals` rows of the ledger (docs §4).
 */
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'starci-launch-spec-'));
const settle=()=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,150);
const wipe=dir=>{settle();try{fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:150});}catch{}};

test('a launch record is written once and read back; awaitLaunch polls until one appears or its timeout passes',async()=>{
  const dir=tmp();
  try{
    const ledger=openLedger({file:path.join(dir,'runtime.sqlite'),now:()=>1});
    assert.equal(readLaunch(ledger,'wf'),null);
    const timedOut=await awaitLaunch(ledger,'wf',{wait:true,timeoutMs:30,intervalMs:5});
    assert.equal(timedOut,null,'no launch ever appeared, so a waiting caller times out rather than hanging');
    writeLaunch(ledger,'wf',{run:'run_1',from:'term_1'});
    assert.deepEqual(readLaunch(ledger,'wf'),{run:'run_1',from:'term_1'});
    const found=await awaitLaunch(ledger,'wf',{wait:true,timeoutMs:1000,intervalMs:5});
    assert.deepEqual(found,{run:'run_1',from:'term_1'});
    ledger.close();
  }finally{wipe(dir);}
});

test('awaitLaunch resolves as soon as a launch lands, without waiting out its full timeout',async()=>{
  const dir=tmp();
  try{
    const ledger=openLedger({file:path.join(dir,'runtime.sqlite'),now:()=>1});
    const started=Date.now();
    setTimeout(()=>writeLaunch(ledger,'wf',{run:'run_late'}),40);
    const found=await awaitLaunch(ledger,'wf',{wait:true,timeoutMs:5000,intervalMs:10});
    assert.deepEqual(found,{run:'run_late'});
    assert.ok(Date.now()-started<2000,'the wait ended on the poll that found it, not the timeout');
    ledger.close();
  }finally{wipe(dir);}
});

test('a coordinator terminal is recorded once even if opened twice; a stale one is closed and moved to the closed list',()=>{
  const dir=tmp();
  try{
    const ledger=openLedger({file:path.join(dir,'runtime.sqlite'),now:()=>1});
    recordCoordinatorTerminal(ledger,'wf','term_a');
    recordCoordinatorTerminal(ledger,'wf','term_a');
    recordCoordinatorTerminal(ledger,'wf','term_b');
    assert.deepEqual(readCoordinatorTerminals(ledger,'wf'),['term_a','term_b']);
    const closed=[];
    const result=closeStaleCoordinatorTerminals(ledger,'wf',{keep:'term_b',known:['term_a','term_b'],close:handle=>{closed.push(handle);return true;}});
    assert.deepEqual(result.closed,[{terminal:'term_a',reason:'coordinator terminal of a kernel that is not running'}]);
    assert.deepEqual(closed,['term_a']);
    assert.deepEqual(readCoordinatorTerminals(ledger,'wf'),['term_b']);
    assert.deepEqual(readClosedCoordinatorTerminals(ledger,'wf'),['term_a']);
    // A terminal Orca no longer lists at all is pruned from the closed record - nothing left to retry.
    pruneClosedCoordinatorTerminals(ledger,'wf',[]);
    assert.deepEqual(readClosedCoordinatorTerminals(ledger,'wf'),[]);
    ledger.close();
  }finally{wipe(dir);}
});

test('a close that fails leaves the terminal open and off the closed list',()=>{
  const dir=tmp();
  try{
    const ledger=openLedger({file:path.join(dir,'runtime.sqlite'),now:()=>1});
    recordCoordinatorTerminal(ledger,'wf','term_stuck');
    const result=closeStaleCoordinatorTerminals(ledger,'wf',{keep:[],known:['term_stuck'],close:()=>false});
    assert.deepEqual(result.closed,[]);
    assert.deepEqual(readCoordinatorTerminals(ledger,'wf'),['term_stuck']);
    ledger.close();
  }finally{wipe(dir);}
});

test('seedCoordinatorTerminals recovers coordinators a kernel opened before the signal existed, from the supervisor log',()=>{
  const dir=tmp();
  try{
    const ledger=openLedger({file:path.join(dir,'runtime.sqlite'),now:()=>1});
    const logFile=path.join(dir,'supervisor.log');
    const lines=[
      {event:'kernel-started-in-coordinator',id:'wf',terminal:'term_old'},
      {event:'kernel-started-in-coordinator',id:'wf',terminal:'term_old'},   // duplicate line, seeded once
      {event:'kernel-started-in-coordinator',id:'other-workflow',terminal:'term_other'},
      {event:'kernel-started',id:'wf',pid:1},                               // not a coordinator event, ignored
      'not even json',
    ];
    fs.writeFileSync(logFile,lines.map(line=>typeof line==='string'?line:JSON.stringify(line)).join('\n'));
    const seeded=seedCoordinatorTerminals(ledger,'wf',{logFile});
    assert.deepEqual(seeded.seeded,['term_old']);
    assert.deepEqual(readCoordinatorTerminals(ledger,'wf'),['term_old']);
    assert.equal(seedCoordinatorTerminals(ledger,'wf',{logFile}).seeded.length,0,'a second seed adds nothing new');
    assert.deepEqual(seedCoordinatorTerminals(ledger,'missing-log',{logFile:path.join(dir,'nope.log')}).seeded,[]);
    ledger.close();
  }finally{wipe(dir);}
});
