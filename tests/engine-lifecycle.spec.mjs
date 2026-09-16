import test from 'node:test';
import {staleLeaseProof as staleLeaseProofUnderTest} from '../kernel/engine.mjs';
import {openJournal as openJournalForStale} from '../kernel/journal.mjs';
import fsForStale from 'node:fs';
import osForStale from 'node:os';
import pathForStale from 'node:path';

test('a lease the journal no longer backs is stale, a held one is live, an unknown journal answers nothing',()=>{
  const dir=fsForStale.mkdtempSync(pathForStale.join(osForStale.tmpdir(),'starci-stale-lease-'));
  try{
    const file=pathForStale.join(dir,'journal.sqlite');
    const journal=openJournalForStale({file});journal.close();
    const lease={jobId:'operation-abc',attempt:1,generation:2,workflowId:'wf',opId:'op'};
    assert.match(staleLeaseProofUnderTest({journalFile:file,lease}),/holds neither job operation-abc nor a lease/);
    assert.equal(staleLeaseProofUnderTest({journalFile:pathForStale.join(dir,'missing.sqlite'),lease}),null);
    assert.equal(staleLeaseProofUnderTest({journalFile:file,lease:{}}),null);
    const held=openJournalForStale({file});
    held.transaction(db=>{
      db.prepare("INSERT INTO jobs (job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,priority_json,lease_token,worker_id,deadline,result_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run('operation-abc','wf','op',1,2,'operation','implement','{}','running','{}','tok',null,null,null,1,1);
      db.prepare("INSERT INTO leases (resource_key,job_id,workflow_id,op_id,attempt,generation,token,units,acquired_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run('ai/global','operation-abc','wf','op',1,2,'tok',1,1,9e15);
    });
    held.close();
    assert.equal(staleLeaseProofUnderTest({journalFile:file,lease}),null,'a held lease row is live');
    const done=openJournalForStale({file});
    done.transaction(db=>{db.prepare("DELETE FROM leases WHERE job_id=?").run('operation-abc');db.prepare("UPDATE jobs SET status='failed' WHERE job_id=?").run('operation-abc');});
    done.close();
    assert.match(staleLeaseProofUnderTest({journalFile:file,lease}),/job operation-abc is failed and holds no lease/);
  }finally{try{fsForStale.rmSync(dir,{recursive:true,force:true});}catch{/* Windows may still hold the just-closed journal for a moment */}}
});
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {sealRuntime,verifyRuntimePin} from '../kernel/runtime-pin.mjs';
import {createStore} from '../kernel/store.mjs';
import {openJournal} from '../kernel/journal.mjs';
import {enrollEngine} from '../kernel/engine.mjs';
import {deriveOwnerRequests} from '../kernel/owner-requests.mjs';
import {enqueueOwnerInbox} from '../kernel/owner-inbox.mjs';
import {applyInbox,guardedStage,quarantineCandidate,readmitCompletedReportRetry} from '../kernel/kernel.mjs';
import {superviseOnce} from '../kernel/supervisor.mjs';

const fixture=t=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-engine-life-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;};
function pinAt(root){
  const sourceRoot=path.join(root,'source');
  for(const file of ['.dist/kernel/kernel.mjs','bin/starci.mjs','bin/starci-skills.mjs','scripts/config.mjs','config.json','core/runtime-root.mjs','core/yaml.mjs','init/AGENTS.md','init/CLAUDE.md','init/DEVIN.md','package.json','SKILL.md','docs/supervision-templates/op.md']){
    const target=path.join(sourceRoot,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,'synthetic pin fixture\n');
  }
  return sealRuntime({sourceRoot,buildsRoot:path.join(root,'builds'),version:'1.0.0'});
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

test('the supervisor retains the lock until the former kernel is confirmed dead',t=>{
  const root=fixture(t),pin=pinAt(root),store=createStore({repoRoot:root,id:'wf'});
  store.saveState({schema:store.schema,id:'wf',approved:true,worktree:root,host:root,engine:{schema:'starci/engine@1',runtimePin:pin}});
  store.appendEvent({event:'tick',at:1});fs.writeFileSync(path.join(store.dir,'kernel.lock'),JSON.stringify({pid:process.pid}));
  let spawns=0;
  const out=superviseOnce({repoRoot:root,launcher:'wrong.mjs',now:()=>999999999,killFn:()=>{},aliveFn:()=>true,spawnFn:()=>{spawns++;return {unref(){}};}});
  assert.equal(spawns,0);assert.equal(out.rounds[0].outcome.ok,false);assert.equal(fs.existsSync(path.join(store.dir,'kernel.lock')),true);
});

test('owner inbox commits the actual choice and requester continuation once',t=>{
  const root=fixture(t),store=createStore({repoRoot:root,id:'wf'}),journal=openJournal({file:path.join(root,'journal.sqlite')});
  const state={schema:store.schema,id:'wf',job:'synthetic approval fixture',approved:true,inputs:['approved-ref'],scope:[],definitionOfDone:[],ledgerMode:'plan',engine:{schema:'starci/engine@1',generation:2},needUser:[{op:'ask',kind:'decision',record:'decision.theme',options:['Use the blue theme.','Use the green theme.']}],ops:[
    {id:'ask',kind:'decision.prepare',status:'running',attempt:1,ownerRequestStatus:'waiting-owner',decisionOptionsDigest:'a'.repeat(64),
      question:{kind:'decision',record:'decision.theme',text:'Choose the theme',options:[{id:'1',label:'Use the blue theme.'},{id:'2',label:'Use the green theme.'}]},requesters:['work']},
    {id:'work',kind:'task.execute',status:'paused',waitingFor:'ask',dependsOn:['ask'],attempt:1}
  ]};store.bindJournal(journal,2,{state});
  const request=deriveOwnerRequests(state)[0],queued=enqueueOwnerInbox(store,{schema:'starci/owner-action@1',action:{type:'choose',workflowId:'wf',requestId:request.id,generation:2,revision:request.revision,
    optionsDigest:request.optionsDigest,value:'2',actor:{type:'owner',receiptId:'synthetic-authenticated-server-receipt',channel:'orca'}}});
  const bytes=JSON.stringify(queued.job);
  applyInbox(store,state,{engine:{journal}});
  assert.equal(state.ops[1].status,'ready');assert.match(state.ops[1].answer,/green theme/);assert.deepEqual(state.inputs,['approved-ref']);
  fs.writeFileSync(path.join(store.paths.inbox,'replay.json'),bytes);applyInbox(store,state,{engine:{journal}});
  assert.equal(state.ops[1].ownerContinuationReceipts.length,1);assert.equal(journal.events().filter(event=>event.kind==='owner-action-applied').length,1);
  journal.close();
});

test('pending durable work does not count as a kernel error or spend an operation retry',()=>{
  const state={engine:{schema:'starci/engine@1',generation:1},kernelErrors:0,ops:[{attempt:2}]},store={saveState(){},appendEvent(){throw Error('pending is not a kernel failure');}};
  const out=guardedStage(store,state,{engine:{}},'accept',()=>{const error=Error('pending');error.code='STARCI_JOB_PENDING';throw error;});
  assert.equal(out,'deferred');assert.equal(state.kernelErrors,0);assert.equal(state.ops[0].attempt,2);
});

test('enrollment refuses an unsettled worker without changing approved inputs',()=>{
  const state={ops:[{status:'running',dispatch:'ctx_live'}],inputs:['approved-ref']};
  assert.throws(()=>enrollEngine({},state),/Settle live/);assert.deepEqual(state.inputs,['approved-ref']);assert.equal(state.engine,undefined);
});

test('explicit enrollment starts fresh agent coordination without carrying an old manager binding',()=>{
  const events=[],state={id:'wf',worktree:'C:/fixture',ops:[],inputs:['approved-ref'],engine:{generation:4,coordination:'legacy',modelSelections:{old:{}},manager:{decisionId:'stale'}}};
  const store={appendEvent:event=>events.push(event),saveState(){}};
  const enrolled=enrollEngine(store,state,{journalFile:'C:/fixture/journal.sqlite',now:()=>123});
  assert.equal(enrolled.coordination,'agent-v1');assert.equal(enrolled.generation,5);
  assert.equal(enrolled.modelSelections,undefined);assert.equal(enrolled.manager,undefined);
  assert.equal(events[0].coordination,'agent-v1');assert.deepEqual(state.inputs,['approved-ref']);
});

test('candidate quarantine surfaces one incident and retains the writer identity and evidence',()=>{
  const lease={jobId:'old-job',leaseToken:'opaque-token'},candidate={packet:{candidateDigest:'immutable'}},op={id:'op-1',attempt:2,status:'running',lease:lease,candidate:candidate};
  const events=[],state={needUser:[]},store={appendEvent:event=>events.push(event),saveState(){}};
  const pending={kind:'candidate-quarantine',reasons:['canonical-head-drift']};
  quarantineCandidate(store,state,op,pending);quarantineCandidate(store,state,op,pending);
  assert.equal(op.status,'blocked');assert.equal(op.lease,lease);assert.equal(op.candidate,candidate);
  assert.equal(events.length,1);assert.equal(state.needUser.length,1);assert.equal(op.refusal,'runtime-reconciliation');
});

test('public retry recovery re-admits the exact completed report under its retained writer',()=>{
  const lease={workflowId:'wf',opId:'op-1',attempt:3,generation:8,jobId:'operation-exact'},events=[];
  const op={id:'op-1',status:'blocked',refusal:'runtime-reconciliation',pending:{kind:'dispatch-reconciliation'},attempt:3,allowlist:['src'],
    dispatch:'ctx-exact',terminal:'term-exact',launch:{task:'task-exact'},lease,candidate:{identity:{...lease}},workerSettled:false};
  const report={schema:'starci/op-report@1',outcome:'done',run:'run-exact',task:'task-exact',dispatch:'ctx-exact',from:'term-exact',summary:'done',files:['src/a.ts'],
    checks:[{name:'unit',command:'node test.mjs',exitCode:0,evidence:'pass'}],open:[],question:null,blocker:null,branch:null,head:null,gates:[],observations:[],reportedAt:'2026-09-16T15:00:00Z',signal:{type:'worker_done',orcaOutcome:'done'},sent:{messageId:'msg'}};
  const state={id:'wf',run:'run-exact',worktree:'D:/repo',ops:[op]},store={readReports:()=>[report],reportPath:()=>'/report.json',appendEvent:event=>events.push(event),saveState(){},unbindJournal(){}};
  let settled=false,closed=false;
  const result=readmitCompletedReportRetry(state,op,{store,orca:{},settleHost:()=>({effectState:'none'}),createRuntime:()=>({journal:{},settled(target,{workerOnly}){assert.equal(target,op);assert.equal(workerOnly,true);settled=true;return {ok:true,writerRetained:true};},close(){closed=true;}})});
  assert.equal(result.ok,true);assert.equal(op.status,'running');assert.equal(op.workerSettled,true);assert.equal(op.pending,undefined);assert.equal(op.lease,lease);
  assert.equal(settled,true);assert.equal(closed,true);assert.equal(events[0].event,'completed-report-readmitted');
});

test('retained-report recovery rejects mismatched identity without settling or changing the operation',()=>{
  const lease={workflowId:'wf',opId:'op-1',attempt:3,generation:8,jobId:'operation-exact'},op={id:'op-1',status:'blocked',refusal:'runtime-reconciliation',pending:{kind:'dispatch-reconciliation'},
    attempt:3,allowlist:['src'],dispatch:'ctx-exact',terminal:'term-exact',launch:{task:'task-exact'},lease,candidate:{identity:{...lease,jobId:'other'}}};
  const report={schema:'starci/op-report@1',outcome:'done',run:'run-exact',task:'task-exact',dispatch:'ctx-exact',from:'term-exact',summary:'done',files:['src/a.ts'],checks:[{name:'unit',command:'x',exitCode:0,evidence:'pass'}],open:[],question:null,blocker:null,branch:null,head:null,gates:[],observations:[],reportedAt:'2026-09-16T15:00:00Z',signal:{type:'worker_done',orcaOutcome:'done'}};
  const result=readmitCompletedReportRetry({id:'wf',run:'run-exact'},op,{store:{readReports:()=>[report]},orca:{},settleHost(){throw Error('must not settle');},createRuntime(){throw Error('must not open runtime');}});
  assert.equal(result.ok,false);assert.equal(op.status,'blocked');assert.equal(op.workerSettled,undefined);
});
