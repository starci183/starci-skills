import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {openJournal,sqliteAtLeast} from '../kernel/journal.mjs';
import {createAdmission,GLOBAL_AI_RESOURCE} from '../kernel/admission.mjs';
import {createJobs,createJobRunner} from '../kernel/jobs.mjs';
import {rankJobs,scheduleJobs,updateProgressBudget,progressExhausted} from '../kernel/scheduler.mjs';
import {createJobBridge,replayCommandCheck,JOB_PENDING,isJobPending,jobPendingError} from '../kernel/job-bridge.mjs';
import {createStore,WORKFLOW_STATE} from '../kernel/store.mjs';
import {PURE_MODEL_EXECUTION,reconcilePureModelJobs} from '../kernel/job-reconcile.mjs';

const temporary=()=>fs.mkdtempSync(path.join(os.tmpdir(),'starci-journal-'));
const identity=(n,kind='operation')=>({jobId:`job-${n}`,workflowId:`workflow-${n}`,opId:`op-${n}`,attempt:1,generation:1,kind});
const withJournal=async fn=>{const dir=temporary(),journal=openJournal({file:path.join(dir,'journal.sqlite')});try{return await fn(journal,dir);}finally{journal.close();fs.rmSync(dir,{recursive:true,force:true});}};

test('journal defaults to DELETE/FULL, persists across reopen, and deduplicates events',()=>withJournal((journal,dir)=>{
  assert.equal(journal.journalMode,'DELETE');
  assert.equal(journal.db.prepare('PRAGMA synchronous').get().synchronous,2);
  journal.enqueueJob(identity(1));
  const event={eventId:'same',workflowId:'workflow-1',entityType:'job',entityId:'job-1',generation:1,kind:'queued',payload:{workRef:'feature/x'}};
  journal.appendEvent(event);journal.appendEvent(event);assert.equal(journal.events().length,1);
  journal.close();const reopened=openJournal({file:path.join(dir,'journal.sqlite')});assert.equal(reopened.getJob('job-1').payload,null);assert.equal(reopened.events()[0].payload.workRef,'feature/x');reopened.close();
  // Balance withJournal's close after the explicit reopen exercise.
  journal.close=()=>{};
}));

test('WAL is opt-in and gated by the embedded SQLite fix level',()=>withJournal(journal=>{
  assert.equal(sqliteAtLeast('3.51.3','3.51.3'),true);assert.equal(sqliteAtLeast('3.51.2','3.51.3'),false);
  assert.throws(()=>openJournal({file:path.join(temporary(),'wal.sqlite'),journalMode:'WAL'}),/explicit allowWal/);
  if(!sqliteAtLeast(journal.sqliteVersion,'3.51.3'))assert.throws(()=>openJournal({file:path.join(temporary(),'wal2.sqlite'),journalMode:'WAL',allowWal:true}),/>=3.51.3/);
}));

test('atomic multi-resource admission and stale fencing',()=>withJournal(journal=>{
  const admission=createAdmission({journal,now:()=>100,defaultAiCapacity:1});admission.setCapacity('db/test',1);admission.setBudget('tokens/day',5);
  journal.enqueueJob(identity(1));journal.enqueueJob(identity(2));
  const one=admission.reserve({...identity(1),resources:[{key:GLOBAL_AI_RESOURCE,units:1},{key:'db/test',units:1}],budgets:[{key:'tokens/day',units:5}]});assert.equal(one.ok,true);
  const two=admission.reserve({...identity(2),resources:[{key:GLOBAL_AI_RESOURCE,units:1},{key:'db/test',units:1}]});assert.equal(two.ok,false);
  assert.equal(journal.db.prepare("SELECT count(*) AS n FROM leases WHERE job_id='job-2'").get().n,0);
  assert.equal(admission.assertFence({...identity(1),leaseToken:'wrong'}),false);assert.equal(admission.assertFence({...identity(1),leaseToken:one.leaseToken}),true);
  assert.equal(admission.release({...identity(1),leaseToken:one.leaseToken,consumeBudgets:true}).ok,true);assert.deepEqual({...journal.db.prepare("SELECT used_value,reserved_value FROM budgets WHERE scope_key='tokens/day'").get()},{used_value:5,reserved_value:0});
}));

test('an expired lease becomes effect_unknown before capacity is reused',()=>withJournal(journal=>{
  let at=100;const admission=createAdmission({journal,now:()=>at,defaultAiCapacity:1});journal.enqueueJob(identity(1));journal.enqueueJob(identity(2));
  assert.equal(admission.reserve({...identity(1),resources:[{key:GLOBAL_AI_RESOURCE,units:1}],ttlMs:5}).ok,true);at=106;
  assert.equal(admission.reserve({...identity(2),resources:[{key:GLOBAL_AI_RESOURCE,units:1}]}).ok,false);assert.equal(journal.getJob('job-1').status,'effect_unknown');
  const token=journal.getJob('job-1').lease_token;assert.equal(admission.settleUnknown({...identity(1),leaseToken:token}).ok,true);assert.equal(admission.reserve({...identity(2),resources:[{key:GLOBAL_AI_RESOURCE,units:1}]}).ok,true);
}));

test('ten-slot cap is atomic across separate Node processes',async()=>{
  const dir=temporary(),file=path.join(dir,'journal.sqlite'),journal=openJournal({file});for(let i=0;i<20;i+=1)journal.enqueueJob(identity(i));journal.close();
  const journalUrl=pathToFileURL(path.resolve('kernel/journal.mjs')).href,admissionUrl=pathToFileURL(path.resolve('kernel/admission.mjs')).href;
  const code=`import {openJournal} from ${JSON.stringify(journalUrl)}; import {createAdmission} from ${JSON.stringify(admissionUrl)}; const [file,n]=process.argv.slice(1); const j=openJournal({file}); const a=createAdmission({journal:j}); const x={jobId:'job-'+n,workflowId:'workflow-'+n,opId:'op-'+n,attempt:1,generation:1}; const r=a.reserve({...x,resources:[{key:'ai/global',units:1}],ttlMs:60000}); process.stdout.write(r.ok?'1':'0'); j.close();`;
  const runs=Array.from({length:20},(_,i)=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--input-type=module','-e',code,file,String(i)],{stdio:['ignore','pipe','pipe']});let out='',err='';child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);child.on('exit',status=>status===0?resolve(out):reject(Error(err)));}));
  const results=await Promise.all(runs);assert.equal(results.filter(x=>x==='1').length,10);
  const check=openJournal({file});assert.equal(check.db.prepare("SELECT sum(units) AS n FROM leases WHERE resource_key='ai/global'").get().n,10);check.close();fs.rmSync(dir,{recursive:true,force:true});
});

test('async runner awaits a real promise and atomically emits one terminal event',async()=>withJournal(async journal=>{
  const admission=createAdmission({journal});const jobs=createJobs({journal,admission});jobs.create(identity(1,'model'));
  let resolved=false;const runner=createJobRunner({jobs,eligibility:()=>({eligible:true}),handlers:{model:async()=>{await new Promise(resolve=>setImmediate(resolve));resolved=true;return {answer:42};}}});
  const result=await runner.runOne();assert.equal(result.ok,true);assert.equal(resolved,true);assert.equal(journal.getJob('job-1').status,'succeeded');assert.equal(journal.events().filter(e=>e.kind==='job-succeeded').length,1);
}));

test('detached command bridge returns pending then replays the durable result',async()=>{
  const dir=temporary(),journalFile=path.join(dir,'journal.sqlite'),bridge=createJobBridge({journalFile});const id={workflowId:'wf',opId:'op',attempt:1,generation:1};
  const first=replayCommandCheck(bridge,process.execPath,['-e','process.stdout.write("ok")'],id);assert.equal(first.schema,JOB_PENDING);assert.equal(isJobPending(first),true);assert.equal(jobPendingError(first).code,'STARCI_JOB_PENDING');
  let final;for(let i=0;i<100&&!final;i+=1){await new Promise(resolve=>setTimeout(resolve,10));const value=bridge.poll({...first.identity});if(value&&!value.pending)final=value;}
  assert.equal(final?.status,'succeeded');assert.equal(final?.result.stdout,'ok');const replay=replayCommandCheck(bridge,process.execPath,['-e','process.stdout.write("ok")'],id);assert.equal(replay.pending,false);assert.equal(replay.identity.jobId,first.identity.jobId);
  bridge.close();fs.rmSync(dir,{recursive:true,force:true});
});

test('command bridge preserves nonzero exit as a check result',async()=>{
  const dir=temporary(),bridge=createJobBridge({journalFile:path.join(dir,'journal.sqlite')}),id={workflowId:'wf7',opId:'op7',attempt:1,generation:1};const first=replayCommandCheck(bridge,`${JSON.stringify(process.execPath)} -e "process.stderr.write('bad');process.exit(7)"`,id);
  let final;for(let i=0;i<100&&!final;i+=1){await new Promise(resolve=>setTimeout(resolve,10));const value=bridge.poll(first.identity);if(value&&!value.pending)final=value;}
  assert.equal(final.status,'succeeded');assert.equal(final.result.status,7);assert.equal(final.result.stderr,'bad');bridge.close();fs.rmSync(dir,{recursive:true,force:true});
});

test('a capacity-deferred queued bridge job is admitted on a later replay',()=>{
  const dir=temporary(),launched=[],bridge=createJobBridge({journalFile:path.join(dir,'journal.sqlite'),spawnChild:(...args)=>{launched.push(args);return {pid:1,once(){},unref(){}};},eligibility:()=>({eligible:true})});bridge.admission.setCapacity(GLOBAL_AI_RESOURCE,0);const id={workflowId:'wfq',opId:'opq',attempt:1,generation:1};const first=bridge.request({...id,kind:'model',input:{handler:'model-function',functionName:'extractJson',args:'{}'}});assert.equal(first.status,'deferred');assert.equal(launched.length,0);bridge.admission.setCapacity(GLOBAL_AI_RESOURCE,1);const second=bridge.request({...id,kind:'model',input:{handler:'model-function',functionName:'extractJson',args:'{}'}});assert.equal(second.status,'running');assert.equal(launched.length,1);bridge.close();fs.rmSync(dir,{recursive:true,force:true});
});

test('spawn failure is durable effect_unknown and keeps its lease for reconciliation',()=>{
  const dir=temporary(),bridge=createJobBridge({journalFile:path.join(dir,'journal.sqlite'),spawnChild:()=>{throw Error('spawn broke');},eligibility:()=>({eligible:true})});const request=bridge.request({workflowId:'wfs',opId:'ops',attempt:1,generation:1,kind:'model',input:{handler:'model-function',functionName:'extractJson',args:'{}'}});assert.equal(request.status,'effect_unknown');const job=bridge.journal.getJob(request.identity.jobId);assert.ok(job.lease_token);assert.equal(bridge.journal.events().at(-1).kind,'job-spawn-failed');bridge.close();fs.rmSync(dir,{recursive:true,force:true});
});

test('pre-spawn admission rejection cancels a proven-no-effect reservation and never spawns',()=>{
  const dir=temporary();let launches=0;const bridge=createJobBridge({journalFile:path.join(dir,'journal.sqlite'),eligibility:()=>({eligible:true}),beforeSpawn:()=>({ok:false,code:'probation-unavailable'}),spawnChild:()=>{launches+=1;return {once(){},unref(){}};}});const result=bridge.request({workflowId:'wfp',opId:'opp',attempt:1,generation:1,kind:'model',input:{handler:'model-function',functionName:'extractJson',args:'{}'}});assert.equal(result.pending,false);assert.equal(result.status,'cancelled');assert.equal(launches,0);assert.equal(bridge.journal.db.prepare('SELECT count(*) AS n FROM leases').get().n,0);bridge.close();fs.rmSync(dir,{recursive:true,force:true});
});

test('changed check input gets a fresh durable job identity',()=>{
  const dir=temporary(),bridge=createJobBridge({journalFile:path.join(dir,'journal.sqlite'),spawnChild:()=>({pid:1,once(){},unref(){}})}),id={workflowId:'wff',opId:'opf',attempt:1,generation:1};const a=replayCommandCheck(bridge,'exit 1',id),b=replayCommandCheck(bridge,'exit 2',id);assert.notEqual(a.identity.jobId,b.identity.jobId);bridge.close();fs.rmSync(dir,{recursive:true,force:true});
});

test('model jobs fail explicit without an eligibility policy',()=>withJournal(journal=>{const jobs=createJobs({journal,admission:createAdmission({journal})});jobs.create(identity(1,'model'));assert.throws(()=>jobs.claimNext({workerId:'x'}),/Model eligibility is required/);}));

test('scheduler ranks completion pressure, critical path, unlocks, age and stable identity',()=>{
  const now=1000,jobs=[{...identity('build'),status:'queued',createdAt:1},{...identity('review','review'),status:'queued',createdAt:900},{...identity('unlock'),status:'queued',createdAt:500}];
  const graph={criticalPath:j=>j.jobId==='job-build'?9:1,unlockCount:j=>j.jobId==='job-unlock'?20:0};const eligibility=()=>({eligible:true});
  const ranked=rankJobs({jobs,graph,now,eligibility}).ranked.map(x=>x.job.jobId);assert.deepEqual(ranked,['job-review','job-build','job-unlock']);
  assert.deepEqual(rankJobs({jobs:[{...identity(2),status:'queued'},{...identity(1),status:'queued'}],eligibility}).ranked.map(x=>x.job.jobId),['job-1','job-2']);
});

test('scheduler backpressure and review reservation are lendable',()=>{
  const eligibility=()=>({eligible:true}),review={...identity('r','review'),status:'queued'},build={...identity('b'),status:'queued'};
  assert.equal(rankJobs({jobs:[build],progress:{unverifiedCandidates:3},eligibility}).deferred[0].reason,'unverified candidate backlog reached its limit');
  assert.deepEqual(scheduleJobs({jobs:[review,build],capacity:1,eligibility}).selected.map(x=>x.job.jobId),['job-r']);
  assert.deepEqual(scheduleJobs({jobs:[build],capacity:1,eligibility}).selected.map(x=>x.job.jobId),['job-b']);
});

test('progress budgets reset only on a new evidence fingerprint',()=>{
  let p=updateProgressBudget({}, {attempts:1,modelCalls:1,progressFingerprint:'a'});assert.equal(p.attempts,0);
  p=updateProgressBudget(p,{attempts:2,modelCalls:2,progressFingerprint:'a'});assert.equal(p.attempts,2);assert.equal(progressExhausted(p,{attempts:2}),true);
  p=updateProgressBudget(p,{attempts:1,progressFingerprint:'b'});assert.equal(p.attempts,0);assert.equal(p.progressed,true);
});

test('journal-bound store recovers committed state when the JSON projection is lost',async()=>{
  const repo=temporary(),store=createStore({repoRoot:repo,id:'wf'}),state={schema:WORKFLOW_STATE,id:'wf',job:'goal',ops:[],counter:1};store.saveState(state);
  const journal=openJournal({file:path.join(repo,'journal.sqlite')});store.bindJournal(journal,1,{state});store.saveState({...state,counter:2});fs.writeFileSync(store.paths.state,'{"torn":');assert.equal(store.loadState().counter,2);journal.close();fs.rmSync(repo,{recursive:true,force:true});
});

test('durable transition applies continuation and its event once',async()=>{
  const repo=temporary(),store=createStore({repoRoot:repo,id:'wf'}),state={schema:WORKFLOW_STATE,id:'wf',job:'goal',ops:[],counter:0};store.saveState(state);const journal=openJournal({file:path.join(repo,'journal.sqlite')});store.bindJournal(journal,1,{state});let applied=0;
  const options={transitionId:'owner-action-1',event:{kind:'owner-action-applied',payload:{requestId:'r'}},apply:next=>{applied+=1;next.counter+=1;}};const first=store.transition(state,options),second=store.transition(state,options);assert.equal(first.counter,1);assert.equal(second.counter,1);assert.equal(applied,1);assert.equal(journal.events().filter(event=>event.kind==='owner-action-applied').length,1);journal.close();fs.rmSync(repo,{recursive:true,force:true});
});

test('durable recovery rejects the same job text with changed approved inputs',async()=>{
  const repo=temporary(),store=createStore({repoRoot:repo,id:'wf'}),a={schema:WORKFLOW_STATE,id:'wf',job:'same',inputs:['input-a'],scope:['x'],definitionOfDone:['done'],ops:[]};store.saveState(a);const journal=openJournal({file:path.join(repo,'journal.sqlite')});store.bindJournal(journal,1,{state:a});
  const reopened=createStore({repoRoot:repo,id:'wf'}),b={...a,inputs:['input-b']};assert.throws(()=>reopened.bindJournal(journal,1,{state:b}),/different approved goal/);journal.close();fs.rmSync(repo,{recursive:true,force:true});
});

test('replaying transition A after B returns B and cannot roll state backward',async()=>{
  const repo=temporary(),store=createStore({repoRoot:repo,id:'wf'}),state={schema:WORKFLOW_STATE,id:'wf',job:'goal',inputs:[],ops:[],counter:0};store.saveState(state);const journal=openJournal({file:path.join(repo,'journal.sqlite')});store.bindJournal(journal,1,{state});
  const a=store.transition(state,{transitionId:'a',apply:next=>{next.counter=1;}}),b=store.transition(a,{transitionId:'b',apply:next=>{next.counter=2;}}),replayA=store.transition(b,{transitionId:'a',apply:()=>{throw Error('must not run');}});assert.equal(replayA.counter,2);assert.equal(store.loadState().counter,2);journal.close();fs.rmSync(repo,{recursive:true,force:true});
});

test('dead read-only tool-disabled model is settled, while unknown operation retains capacity',()=>withJournal(journal=>{
  const admission=createAdmission({journal,defaultAiCapacity:2}),model={...identity('m','model'),payload:{execution:{schema:PURE_MODEL_EXECUTION,readOnly:true,toolsDisabled:true}}},operation=identity('o','operation');journal.enqueueJob(model);journal.enqueueJob(operation);const a=admission.reserve({...model,resources:[{key:GLOBAL_AI_RESOURCE,units:1}]}),b=admission.reserve({...operation,resources:[{key:GLOBAL_AI_RESOURCE,units:1}]});journal.appendEvent({eventId:'spawn-m',workflowId:model.workflowId,entityType:'job',entityId:model.jobId,generation:1,kind:'job-spawned',payload:{pid:101}});journal.appendEvent({eventId:'spawn-o',workflowId:operation.workflowId,entityType:'job',entityId:operation.jobId,generation:1,kind:'job-spawned',payload:{pid:102}});
  const reconciled=reconcilePureModelJobs({journal,admission,pidAlive:()=>false});assert.deepEqual(reconciled.settled.map(x=>x.jobId),['job-m']);assert.deepEqual(reconciled.unknown.map(x=>x.jobId),['job-o']);assert.equal(journal.getJob('job-m').status,'failed');assert.equal(journal.getJob('job-o').status,'effect_unknown');assert.equal(journal.getJob('job-o').lease_token,b.leaseToken);assert.equal(journal.db.prepare("SELECT sum(units) AS n FROM leases WHERE resource_key='ai/global'").get().n,1);assert.ok(a.leaseToken);
}));

test('a dead model without provider read-only/tool-disabled attestation remains unknown',()=>withJournal(journal=>{
  const admission=createAdmission({journal}),model={...identity('unsafe','model'),payload:{execution:{readOnly:true}}};journal.enqueueJob(model);const lease=admission.reserve({...model,resources:[{key:GLOBAL_AI_RESOURCE,units:1}]});journal.appendEvent({eventId:'spawn-unsafe',workflowId:model.workflowId,entityType:'job',entityId:model.jobId,generation:1,kind:'job-spawned',payload:{pid:103}});const result=reconcilePureModelJobs({journal,admission,pidAlive:()=>false});assert.equal(result.settled.length,0);assert.equal(result.unknown[0].jobId,model.jobId);assert.equal(journal.getJob(model.jobId).lease_token,lease.leaseToken);
}));
