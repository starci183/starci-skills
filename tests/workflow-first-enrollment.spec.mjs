import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createStore} from '../kernel/store.mjs';
import {createWorkflowState,kernelMain} from '../kernel/kernel.mjs';
import {sealRuntime} from '../kernel/runtime-pin.mjs';
import {ledgerFileFor,openLedger} from '../kernel/ledger-db.mjs';

/**
 * Ported to the 1.0.4 ledger (docs/ledger-db.md). A workflow's ledger is `<repo>/.starciwork/runtime.sqlite`
 * and nothing else: `createStore` opens exactly that file and `bindJournal` refuses a handle on any other
 * (`ledger-binding-mismatch`), so `--journal-file <somewhere else>` is no longer a thing a retry can be told.
 * The two file-shaped claims move with it: §8 removed `store.dir` and the `events.g<n>.jsonl` segments, and a
 * generation is now a column - retiring one records `events-generation-closed` exactly once instead.
 */
test('public retry first enrolls an approved workflow without inventing a retired event generation',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-first-enrollment-'));
  const store=createStore({repoRoot:root,id:'first-enrollment'});
  // Cleanup never depends on the code under test: the handle is closed if it can be, the tree goes either way.
  t.after(()=>{
    try{store.close();}catch{}
    // SQLite on Windows can hold the file mapping a moment past close(); the removal retries through it.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,150);
    fs.rmSync(root,{recursive:true,force:true,maxRetries:30,retryDelay:150});
  });
  const state=createWorkflowState({job:'Keep approved work and enroll its first runtime',worktree:root,branch:'main',store});
  Object.assign(state,{approved:true,phase:'run',goalDigest:'f'.repeat(64),definitionOfDone:['Preserve approved history'],
    decisions:[{id:'owner-choice',answer:'Keep the current behavior'}]});
  store.saveState(state);store.appendEvent({event:'owner-approved',proof:'fixture actual approval'});
  const pin=sealRuntime({sourceRoot:process.cwd(),buildsRoot:path.join(root,'builds'),version:'1.0.0'});
  const pinFile=path.join(root,'pin.json'),candidateRoot=path.join(root,'candidate-volume');
  fs.writeFileSync(pinFile,JSON.stringify(pin));
  const orca={invoke(){throw Error('Enrollment must not launch a worker');}};
  const closed=()=>store.readEvents().filter(event=>(event.event??event.kind)==='events-generation-closed');
  const result=kernelMain('workflow-retry',{id:state.id,'runtime-pin':pinFile,'candidate-root':candidateRoot},{orca,cwd:root});
  assert.equal(result.ok,true);assert.equal(result.generation,1);assert.equal(result.candidateRoot,fs.realpathSync(candidateRoot));
  const enrolled=store.loadState();assert.equal(enrolled.approved,true);assert.equal(enrolled.goalDigest,state.goalDigest);
  assert.deepEqual(enrolled.decisions,state.decisions);assert.equal(enrolled.engine.generation,1);
  assert.equal(enrolled.engine.candidateRoot,fs.realpathSync(candidateRoot));
  assert.equal(enrolled.engine.ledgerFile,path.resolve(ledgerFileFor(root)),'the workflow is bound to its repository\'s own ledger');
  assert.ok(store.readEvents().some(event=>event.event==='owner-approved'));
  assert.deepEqual(closed(),[],'no generation existed to retire');
  const retried=kernelMain('workflow-retry',{id:state.id},{orca,cwd:root});
  assert.equal(retried.generation,2);assert.equal(retried.candidateRoot,fs.realpathSync(candidateRoot));
  assert.deepEqual(closed().map(event=>event.generation),[1],'the retired generation is closed once, as a column not a file');
  assert.ok(store.readEvents().some(event=>event.event==='owner-approved'));
  const ledger=openLedger({file:ledgerFileFor(root)});
  try{assert.deepEqual(ledger.liveRows(state.id),{leases:[],jobs:[]});}finally{ledger.close();}
  assert.equal(fs.existsSync(path.join(root,'.starciwork','_local')),false,'the enrollment wrote nothing under _local');
});
