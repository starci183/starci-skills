import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {sealRuntime,verifyRuntimePin} from '../kernel/runtime-pin.mjs';
import {createStore} from '../kernel/store.mjs';
import {openJournal} from '../kernel/journal.mjs';
import {enrollV6} from '../kernel/runtime-v6.mjs';
import {deriveOwnerRequests} from '../kernel/owner-requests.mjs';
import {enqueueOwnerInbox} from '../kernel/owner-inbox.mjs';
import {applyInbox,guardedStage,quarantineCandidate} from '../kernel/kernel.mjs';
import {superviseOnce} from '../kernel/supervisor.mjs';

const fixture=t=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-v6-life-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;};
function pinAt(root){
  const sourceRoot=path.join(root,'source');
  for(const file of ['.dist/kernel/kernel.mjs','bin/starci.mjs','bin/starci-skills.mjs','scripts/config.mjs','core/runtime-root.mjs','core/yaml.mjs','init/AGENTS.md','init/CLAUDE.md','package.json','SKILL.md','docs/supervision-templates/op.md']){
    const target=path.join(sourceRoot,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,'synthetic pin fixture\n');
  }
  return sealRuntime({sourceRoot,buildsRoot:path.join(root,'builds'),version:'6.0.0-alpha.1'});
}

test('runtime pin reuses identical bytes and rejects changed or unsealed executables',t=>{
  const root=fixture(t),pin=pinAt(root);
  assert.equal(verifyRuntimePin(pin).ok,true);assert.deepEqual(pinAt(root),pin);
  fs.writeFileSync(path.join(pin.root,'.dist','injected.mjs'),'unexpected');
  assert.match(verifyRuntimePin(pin).reason,/unsealed/);
  fs.rmSync(path.join(pin.root,'.dist','injected.mjs'));
  fs.appendFileSync(path.join(pin.root,'bin','starci.mjs'),'drift');
  assert.match(verifyRuntimePin(pin).reason,/changed/);
});

test('v6 supervisor retains the lock until the former kernel is confirmed dead',t=>{
  const root=fixture(t),pin=pinAt(root),store=createStore({repoRoot:root,id:'wf'});
  store.saveState({schema:store.schema,id:'wf',approved:true,worktree:root,host:root,engine:{major:6,runtimePin:pin}});
  store.appendEvent({event:'tick',at:1});fs.writeFileSync(path.join(store.dir,'kernel.lock'),JSON.stringify({pid:process.pid}));
  let spawns=0;
  const out=superviseOnce({repoRoot:root,launcher:'wrong.mjs',now:()=>999999999,killFn:()=>{},aliveFn:()=>true,spawnFn:()=>{spawns++;return {unref(){}};}});
  assert.equal(spawns,0);assert.equal(out.rounds[0].outcome.ok,false);assert.equal(fs.existsSync(path.join(store.dir,'kernel.lock')),true);
});

test('owner inbox commits the actual choice and requester continuation once',t=>{
  const root=fixture(t),store=createStore({repoRoot:root,id:'wf'}),journal=openJournal({file:path.join(root,'journal.sqlite')});
  const state={schema:store.schema,id:'wf',job:'synthetic approval fixture',approved:true,inputs:['approved-ref'],scope:[],definitionOfDone:[],ledgerMode:'plan',engine:{major:6,generation:2},needUser:[{op:'ask',kind:'decision'}],ops:[
    {id:'ask',kind:'decision.prepare',status:'running',attempt:1,question:{kind:'decision',text:'Choose the theme',options:['Blue','Green']},requesters:['work']},
    {id:'work',kind:'task.execute',status:'paused',waitingFor:'ask',dependsOn:['ask'],attempt:1}
  ]};store.bindJournal(journal,2,{state});
  const request=deriveOwnerRequests(state)[0],queued=enqueueOwnerInbox(store,{schema:'starci/owner-action@1',action:{type:'choose',workflowId:'wf',requestId:request.id,generation:2,revision:request.revision,value:'2',actor:{type:'owner',receiptId:'synthetic-authenticated-server-receipt',channel:'orca'}}});
  const bytes=JSON.stringify(queued.job);
  applyInbox(store,state,{v6:{journal}});
  assert.equal(state.ops[1].status,'ready');assert.match(state.ops[1].answer,/Green/);assert.deepEqual(state.inputs,['approved-ref']);
  fs.writeFileSync(path.join(store.paths.inbox,'replay.json'),bytes);applyInbox(store,state,{v6:{journal}});
  assert.equal(state.ops[1].ownerContinuationReceipts.length,1);assert.equal(journal.events().filter(event=>event.kind==='owner-action-applied').length,1);
  journal.close();
});

test('pending durable work does not count as a kernel error or spend an operation retry',()=>{
  const state={engine:{major:6,generation:1},kernelErrors:0,ops:[{attempt:2}]},store={saveState(){},appendEvent(){throw Error('pending is not a kernel failure');}};
  const out=guardedStage(store,state,{v6:{}},'accept',()=>{const error=Error('pending');error.code='STARCI_JOB_PENDING';throw error;});
  assert.equal(out,'deferred');assert.equal(state.kernelErrors,0);assert.equal(state.ops[0].attempt,2);
});

test('enrollment refuses an unsettled worker without changing approved inputs',()=>{
  const state={ops:[{status:'running',dispatch:'ctx_live'}],inputs:['approved-ref']};
  assert.throws(()=>enrollV6({},state),/Settle live/);assert.deepEqual(state.inputs,['approved-ref']);assert.equal(state.engine,undefined);
});

test('candidate quarantine surfaces one incident and retains the writer identity and evidence',()=>{
  const lease={jobId:'old-job',leaseToken:'opaque-token'},candidate={packet:{candidateDigest:'immutable'}},op={id:'op-1',attempt:2,status:'running',v6Lease:lease,v6Candidate:candidate};
  const events=[],state={needUser:[]},store={appendEvent:event=>events.push(event),saveState(){}};
  const pending={kind:'candidate-quarantine',reasons:['canonical-head-drift']};
  quarantineCandidate(store,state,op,pending);quarantineCandidate(store,state,op,pending);
  assert.equal(op.status,'blocked');assert.equal(op.v6Lease,lease);assert.equal(op.v6Candidate,candidate);
  assert.equal(events.length,1);assert.equal(state.needUser.length,1);assert.equal(op.refusal,'runtime-reconciliation');
});
