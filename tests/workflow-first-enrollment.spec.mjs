import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createStore} from '../kernel/store.mjs';
import {createWorkflowState,kernelMain} from '../kernel/kernel.mjs';
import {sealRuntime} from '../kernel/runtime-pin.mjs';
import {openJournal} from '../kernel/journal.mjs';

test('public retry first enrolls an approved workflow without inventing a retired event generation',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-first-enrollment-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const store=createStore({repoRoot:root,id:'first-enrollment'});
  const state=createWorkflowState({job:'Keep approved work and enroll its first runtime',worktree:root,branch:'main',store});
  Object.assign(state,{approved:true,phase:'run',goalDigest:'f'.repeat(64),definitionOfDone:['Preserve approved history'],
    decisions:[{id:'owner-choice',answer:'Keep the current behavior'}]});
  store.saveState(state);store.appendEvent({event:'owner-approved',proof:'fixture actual approval'});
  const pin=sealRuntime({sourceRoot:process.cwd(),buildsRoot:path.join(root,'builds'),version:'1.0.0'});
  const pinFile=path.join(root,'pin.json'),journalFile=path.join(root,'runtime','journal.sqlite'),candidateRoot=path.join(root,'candidate-volume');
  fs.writeFileSync(pinFile,JSON.stringify(pin));
  const orca={invoke(){throw Error('Enrollment must not launch a worker');}};
  const result=kernelMain('workflow-retry',{id:state.id,'runtime-pin':pinFile,'journal-file':journalFile,'candidate-root':candidateRoot},{orca,cwd:root});
  assert.equal(result.ok,true);assert.equal(result.generation,1);assert.equal(result.candidateRoot,fs.realpathSync(candidateRoot));
  const enrolled=store.loadState();assert.equal(enrolled.approved,true);assert.equal(enrolled.goalDigest,state.goalDigest);
  assert.deepEqual(enrolled.decisions,state.decisions);assert.equal(enrolled.engine.generation,1);
  assert.equal(enrolled.engine.candidateRoot,fs.realpathSync(candidateRoot));
  assert.ok(store.readEvents().some(event=>event.event==='owner-approved'));
  assert.ok(!fs.readdirSync(store.dir).some(name=>/^events\.g/.test(name)),'no generation existed to rotate');
  const retried=kernelMain('workflow-retry',{id:state.id},{orca,cwd:root});
  assert.equal(retried.generation,2);assert.equal(retried.candidateRoot,fs.realpathSync(candidateRoot));assert.ok(fs.existsSync(path.join(store.dir,'events.g1.jsonl')));
  assert.ok(store.readEvents().some(event=>event.event==='owner-approved'));
  const journal=openJournal({file:journalFile});
  try{assert.deepEqual(journal.liveRows(state.id),{leases:[],jobs:[]});}finally{journal.close();}
});
