import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createJobBridge} from '../kernel/job-bridge.mjs';
import {createV6Runtime,settleGenerationLeases,unsettledGenerationJobs,prepareGenerationRetry} from '../kernel/runtime-v6.mjs';
import {attestModelResult} from '../kernel/job-attestation.mjs';
import {normalizeResolvedReferences} from '../models/validator-transport.mjs';
import {validateOp} from '../models/functions.mjs';
import {createWorkflowModelEligibility} from '../kernel/model-policy.mjs';
import {loadRuntimes} from '../kernel/schedule.mjs';
import {retryOwnedBaseline,retryableV6Operation} from '../kernel/kernel.mjs';

const fixture=t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-v6-adapter-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const state={id:'wf',worktree:dir,head:'a'.repeat(40),createdAt:1,engine:{major:6,generation:2,journalFile:path.join(dir,'journal.sqlite')},ops:[]};const store={appendEvent(){},saveState(){}};return {dir,state,store};};

test('runtime exposes required validation and only sends evaluated providers to the detached model',t=>{
  const f=fixture(t),bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:7,once(){},unref(){}})});
  const seen=[],eligibility=(job,runtime)=>{seen.push([job.role,runtime.id]);return {eligible:runtime.id==='gpt-5.6-sol',reasons:[]};};const runtime=createV6Runtime({...f,bridge,eligibility});assert.equal(runtime.requiredValidation,true);
  assert.throws(()=>runtime.model('validateOp',{providers:['qwen3.8-flash','gpt-5.6-sol'],diff:{files:['a.js']}},{id:'op',attempt:1}),error=>error.code==='STARCI_JOB_PENDING');
  const job=runtime.journal.listJobs()[0];assert.deepEqual(job.payload.args.providers,['gpt-5.6-sol']);assert.deepEqual(seen,[['verify','qwen3.8-flash'],['verify','gpt-5.6-sol']]);bridge.close();
});

test('runtime refuses a model function before launch when every candidate is unqualified',t=>{
  const f=fixture(t),bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>{throw Error('must not launch');}}),runtime=createV6Runtime({...f,bridge,eligibility:()=>({eligible:false,reasons:['unqualified']})});
  assert.throws(()=>runtime.model('decide',{providers:['gpt-5.6-sol']},{id:'op',attempt:1}),/No evaluated model is eligible/);assert.equal(runtime.journal.listJobs().length,0);bridge.close();
});

test('cached model completion replays after its probation scope is consumed',t=>{
  const f=fixture(t),bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:7,once(){},unref(){}})});let eligible=true;const runtime=createV6Runtime({...f,bridge,eligibility:()=>({eligible,mode:'probation'}),modelPolicy:{providerFilter:()=>eligible?['gpt-5.6-sol']:[],consumeProbation:()=>({ok:true,code:'probation-consumed'})}}),op={id:'op',attempt:1};let pending;try{runtime.model('decide',{providers:['gpt-5.6-sol'],situation:'x',options:['a']},op);}catch(error){pending=error.job;}const job=runtime.journal.getJob(pending.identity.jobId);runtime.jobs.complete({jobId:job.job_id,workflowId:job.workflow_id,opId:job.op_id,attempt:job.attempt,generation:job.generation,leaseToken:job.lease_token,eventId:`${job.job_id}:terminal`,status:'succeeded',result:{ok:true,value:{option:'a'}}});eligible=false;assert.deepEqual(runtime.model('decide',{providers:['gpt-5.6-sol'],situation:'x',options:['a']},op),{ok:true,value:{option:'a'}});bridge.close();
});

test('validator attestation is derived from the fresh executor and completeness input',()=>{
  const pass=attestModelResult({verdict:'accept',freshContext:false,reviewerAttemptId:'self'},{functionName:'validateOp',jobId:'j',generation:3,executorPid:42,input:{diff:{truncated:false}}});
  assert.equal(pass.complete,true);assert.equal(pass.independentFromAttempt,true);assert.equal(pass.freshContext,true);assert.equal(pass.reviewerAttemptId,'j:3:pid-42');
  const truncated=attestModelResult({verdict:'accept'},{functionName:'validateOp',jobId:'j',generation:3,executorPid:43,input:{diff:{truncated:true}}});assert.equal(truncated.complete,false);
  assert.equal(attestModelResult({verdict:'accept'},{functionName:'validateOp',jobId:'j',generation:3,executorPid:44,input:{resolvedReferencesTruncated:true}}).complete,false);
});

test('resolved reference bytes are normalized into bounded explicit validator transport',()=>{
  const normalized=normalizeResolvedReferences([{path:'rule.md',bytes:Buffer.from('decided rule')},{path:'large.md',bytes:Buffer.alloc(40*1024,120)}],{maxBytes:20,maxFileBytes:16});assert.equal(normalized.entries[0].text,'decided rule');assert.equal(normalized.truncated,true);assert.ok(normalized.bytes<=20);
  let prompt='';const result=validateOp({op:{id:'op',kind:'backend.implement'},diff:{files:['a.js'],text:'+ok'},resolvedReferences:[{path:'rule.md',bytes:Buffer.from('binding text')}],freshContext:true,authorAttemptId:{opId:'op',attempt:1},providers:['gpt-5.6-sol'],runHeadless:(_provider,input)=>{prompt=input;return JSON.stringify({verdict:'accept',summary:'ok'});}});assert.equal(result.verdict,'accept');assert.match(prompt,/binding text/);assert.match(prompt,/authorAttemptId/);
});

test('operation reservation evaluates the selected runtime and pulse adopts its lease after restart',t=>{
  const f=fixture(t),bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:1,once(){},unref(){}})}),op={id:'op',attempt:1,status:'running',checks:[{command:'docker compose ps'}]};f.state.ops=[op];let selected;const runtime=createV6Runtime({...f,bridge,eligibility:(job,candidate)=>{selected=candidate;return {eligible:candidate?.id==='gpt-5.6-sol'};}});const reserved=runtime.reserveOperation(op,{role:'implement',runtime:'gpt-5.6-sol',target:'gpt-5.6-sol'});assert.equal(reserved.ok,true);assert.equal(selected.provider,'codex');delete op.v6Lease;runtime.pulse();assert.equal(op.v6Lease.jobId,reserved.jobId);assert.deepEqual(op.v6Lease.machineResources,['machine:local-stack']);bridge.close();
});

test('probation rejection cancels native operation reservation before launch',t=>{
  const f=fixture(t),bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>{throw Error('not used');}}),op={id:'op',attempt:1,status:'ready',allowlist:['a.js']};f.state.ops=[op];const runtime=createV6Runtime({...f,bridge,modelPolicy:{consumeProbation:()=>({ok:false,code:'probation-exhausted'})},eligibility:()=>({eligible:true,mode:'probation'})});const result=runtime.reserveOperation(op,{role:'implement',runtime:'gpt-5.6-sol',target:'gpt-5.6-sol'});assert.equal(result.ok,false);assert.match(result.reasons[0],/probation-exhausted/);assert.equal(runtime.journal.db.prepare('SELECT count(*) AS n FROM leases').get().n,0);bridge.close();
});

test('real workflow model policy consumes the same model-function scope selected before spawn',t=>{
  const f=fixture(t);f.state.approved=true;f.state.ops=[{id:'op',kind:'work.author',checks:[]}];fs.writeFileSync(path.join(f.dir,'policy.json'),JSON.stringify({schema:'starci/model-capability-policy@1'}));const profiles=loadRuntimes(),policy=createWorkflowModelEligibility({runtimes:profiles,state:f.state,policyFile:path.join(f.dir,'policy.json'),qualificationsFile:path.join(f.dir,'none.json'),root:f.dir,now:()=>1});let launches=0;
  const runtime=createV6Runtime({...f,modelPolicy:policy,eligibility:policy.eligibility,spawnChild:()=>({pid:9,once(){},unref(){}})});
  try{runtime.model('planOp',{providers:['gpt-5.6-sol'],node:{operation:'work.author'}},{id:'op',attempt:1});}catch(error){assert.equal(error.code,'STARCI_JOB_PENDING',error.stack);launches+=1;}
  const scopes=Object.keys(f.state.modelEligibility.probationScopes);assert.deepEqual(scopes,['wf/op/model.planOp/plan']);assert.equal(f.state.modelEligibility.probationBudget.remaining,(f.state.modelEligibility.probationBudget.initial-1));assert.equal(launches,1);runtime.close();
});

test('real workflow policy consumes native author probation in the eligibility workload scope',t=>{
  const f=fixture(t);f.state.approved=true;const op={id:'author',kind:'work.author',attempt:1,status:'ready',allowlist:['src/a.js'],checks:[]};f.state.ops=[op];fs.writeFileSync(path.join(f.dir,'policy.json'),JSON.stringify({schema:'starci/model-capability-policy@1'}));
  const profiles=loadRuntimes(),policy=createWorkflowModelEligibility({runtimes:profiles,state:f.state,policyFile:path.join(f.dir,'policy.json'),qualificationsFile:path.join(f.dir,'none.json'),root:f.dir,now:()=>1});
  const eligibility=(job,candidate)=>{const source=job.input?.op??job,actual={...source,opId:job.opId??source.id,kind:source.kind,role:job.role??'write',independentReview:{required:true,freshContext:true},checks:[...(source.checks??[]),{name:'work-valid'}]};return policy.eligibility(actual,candidate);};
  const runtime=createV6Runtime({...f,modelPolicy:policy,eligibility,spawnChild:()=>({pid:1,once(){},unref(){}})}),allocation={runtime:'gpt-5.6-sol',target:'gpt-5.6-sol'};
  const scope='wf/author/work.author/plan',first=runtime.reserveOperation(op,allocation);assert.equal(first.ok,true);assert.deepEqual(Object.keys(f.state.modelEligibility.probationScopes),[scope]);assert.equal(f.state.modelEligibility.probationScopes[scope].remaining,1);runtime.settled(op);
  op.attempt=2;const second=runtime.reserveOperation(op,allocation);assert.equal(second.ok,true);assert.equal(f.state.modelEligibility.probationScopes[scope].remaining,0);runtime.settled(op);
  op.attempt=3;const third=runtime.reserveOperation(op,allocation);assert.equal(third.ok,false);assert.match(third.reasons.join(' '),/exhausted|unavailable/);runtime.close();
});

test('model replay hash excludes candidate payload and mutable operation runtime fields',t=>{
  const f=fixture(t),bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:1,once(){},unref(){}})}),runtime=createV6Runtime({...f,bridge,eligibility:()=>({eligible:true})}),op={id:'op',kind:'backend.implement',goal:'g',attempt:1,acceptance:['a'],allowlist:['a.js'],v6Candidate:{huge:'x'.repeat(10000)},status:'running'};let first;try{runtime.model('validateOp',{providers:['gpt-5.6-sol'],op,diff:{files:['a.js'],text:'+x'}},op);}catch(error){first=error.job.identity.jobId;}op.v6Candidate={different:'y'.repeat(10000)};op.status='blocked';let second;try{runtime.model('validateOp',{providers:['gpt-5.6-sol'],op,diff:{files:['a.js'],text:'+x'}},op);}catch(error){second=error.job.identity.jobId;}assert.equal(second,first);const payload=runtime.journal.getJob(first).payload;assert.equal(JSON.stringify(payload).includes('huge'),false);bridge.close();
});

test('worker-only settlement releases AI and retains writer until final acceptance settlement',t=>{
  const f=fixture(t),bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:1,once(){},unref(){}})}),op={id:'op',kind:'backend.implement',attempt:1,status:'running',allowlist:['a.js']};f.state.ops=[op];const runtime=createV6Runtime({...f,bridge,eligibility:()=>({eligible:true})}),lease=runtime.reserveOperation(op,{role:'implement',runtime:'gpt-5.6-sol',target:'gpt-5.6-sol'});assert.equal(lease.ok,true);assert.equal(runtime.settled(op,{workerOnly:true}).writerRetained,true);let rows=runtime.journal.db.prepare('SELECT resource_key FROM leases WHERE job_id=?').all(lease.jobId).map(x=>x.resource_key);assert.equal(rows.includes('ai/global'),false);assert.equal(rows.some(x=>x.startsWith('canonical-writer:')),true);assert.equal(runtime.settled(op).ok,true);rows=runtime.journal.db.prepare('SELECT resource_key FROM leases WHERE job_id=?').all(lease.jobId);assert.equal(rows.length,0);bridge.close();
});

test('machine guard resources serialize native workers and detached checks while retaining only the writer',t=>{
  const f=fixture(t),spawned=[],bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>{spawned.push(true);return {pid:1,once(){},unref(){}};}});
  const first={id:'one',kind:'backend.implement',attempt:1,status:'running',allowlist:['a.js'],checks:[{command:'docker compose up'}]};
  const second={id:'two',kind:'backend.implement',attempt:1,status:'ready',allowlist:[],checks:[{command:'psql -h localhost:5432'}]};f.state.ops=[first,second];
  const runtime=createV6Runtime({...f,bridge,eligibility:()=>({eligible:true})}),allocation={role:'implement',runtime:'gpt-5.6-sol',target:'gpt-5.6-sol'};
  assert.equal(runtime.reserveOperation(first,allocation).ok,true);
  assert.equal(runtime.reserveOperation(second,allocation).ok,false);
  assert.throws(()=>runtime.check('docker compose ps',{},second),error=>error.code==='STARCI_JOB_PENDING'&&error.job.status==='deferred');
  runtime.settled(first,{workerOnly:true});
  const held=runtime.journal.db.prepare('SELECT resource_key FROM leases WHERE job_id=?').all(first.v6Lease.jobId).map(row=>row.resource_key);
  assert.deepEqual(held.filter(key=>key.startsWith('machine:')),[]);assert.equal(held.some(key=>key.startsWith('canonical-writer:')),true);
  assert.equal(runtime.reserveOperation(second,allocation).ok,true);
  assert.throws(()=>runtime.check('docker compose ps',{},second),error=>error.code==='STARCI_JOB_PENDING'&&error.job.status==='deferred');
  runtime.settled(second,{workerOnly:true});
  assert.throws(()=>runtime.check('docker compose ps',{},second),error=>error.code==='STARCI_JOB_PENDING'&&error.job.status==='running');assert.equal(spawned.length,1);
  bridge.close();
});

test('confirmed stopped old-generation lease can be settled before retry drops its state handle',t=>{
  const f=fixture(t),bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:1,once(){},unref(){}})}),op={id:'op',kind:'backend.implement',attempt:1,status:'running',allowlist:['a.js']};f.state.ops=[op];const runtime=createV6Runtime({...f,bridge,eligibility:()=>({eligible:true})});runtime.reserveOperation(op,{role:'implement',runtime:'gpt-5.6-sol',target:'gpt-5.6-sol'});runtime.settled(op,{workerOnly:true});const lease={...op.v6Lease};bridge.close();assert.equal(settleGenerationLeases({journalFile:f.state.engine.journalFile,leases:[lease]})[0].ok,true);const reopened=createJobBridge({journalFile:f.state.engine.journalFile});assert.equal(reopened.journal.db.prepare('SELECT count(*) AS n FROM leases WHERE job_id=?').get(lease.jobId).n,0);reopened.close();
});

test('retry baseline adopts only report-attributed files and keeps other dirty paths unclaimed',()=>{
  const state={worktree:'C:/repo'},op={allowlist:['src/**'],kernelOwned:[],reports:[{files:['src/owned.ts']}]},git=()=>({status:0,stdout:' M src/owned.ts\n M src/foreign.ts\n?? outside.txt\n'});assert.deepEqual(retryOwnedBaseline(state,op,git),{changed:['src/owned.ts','src/foreign.ts'],attributed:['src/owned.ts'],unclaimed:['src/foreign.ts']});
});

test('retry admits only runtime reconciliation leases and fences unresolved generation jobs',t=>{
  assert.equal(retryableV6Operation({status:'blocked',v6Lease:{jobId:'op'},refusal:'runtime-reconciliation'}),true);
  assert.equal(retryableV6Operation({status:'blocked',v6Lease:{jobId:'op'},v6WorkerSettled:true}),true);
  assert.equal(retryableV6Operation({status:'blocked',v6Lease:{jobId:'op'},ownerRequest:{id:'ask'}}),false);
  assert.equal(retryableV6Operation({status:'blocked',v6Lease:{jobId:'op'},refusal:'business-rule'}),false);
  const f=fixture(t),bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:7,once(){},unref(){}})});
  bridge.request({workflowId:'wf',opId:'op',attempt:1,generation:2,kind:'model',role:'plan',input:{handler:'model-function',functionName:'planOp',args:{providers:['gpt-5.6-sol']}}});
  assert.deepEqual(unsettledGenerationJobs({journalFile:f.state.engine.journalFile,workflowId:'wf',generation:2}),[bridge.journal.listJobs()[0].job_id]);
  bridge.journal.enqueueJob({jobId:'never-launched',workflowId:'wf',opId:'op',attempt:1,generation:2,kind:'check',role:'machine-check',payload:{command:'x'}});
  const prepared=prepareGenerationRetry({journalFile:f.state.engine.journalFile,workflowId:'wf',generation:2,now:()=>9});assert.deepEqual(prepared.cancelled,['never-launched']);assert.equal(prepared.unsettled.length,1);assert.notEqual(prepared.unsettled[0],'never-launched');
  assert.equal(bridge.journal.getJob('never-launched').status,'cancelled');assert.equal(bridge.journal.events({workflowId:'wf'}).some(event=>event.kind==='job-retry-queued-cancelled'),true);
  assert.deepEqual(unsettledGenerationJobs({journalFile:f.state.engine.journalFile,workflowId:'wf',generation:1}),[]);bridge.close();
});
