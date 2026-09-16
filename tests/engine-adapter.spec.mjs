import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createJobBridge,inputDigest} from '../kernel/job-bridge.mjs';
import {createJobs} from '../kernel/jobs.mjs';
import {candidateBaseFor,createEngineRuntime,settleGenerationLeases,settleNeverStartedModelJobs,unsettledGenerationJobs,prepareGenerationRetry,validateCandidateRoot} from '../kernel/engine.mjs';
import {attestModelResult} from '../kernel/job-attestation.mjs';
import {normalizeResolvedReferences} from '../models/validator-transport.mjs';
import {validateOp} from '../models/functions.mjs';
import {createWorkflowModelEligibility} from '../kernel/model-policy.mjs';
import {createAllocator,loadRuntimes,withProviderPreference} from '../kernel/schedule.mjs';
import {persistPrelaunchReservation,retryOwnedBaseline,retryableOperation} from '../kernel/kernel.mjs';

const fixture=t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-engine-adapter-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const state={id:'wf',worktree:dir,head:'a'.repeat(40),createdAt:1,engine:{schema:'starci/engine@1',generation:2,journalFile:path.join(dir,'journal.sqlite')},ops:[]};const store={dir:path.join(dir,'workflow'),appendEvent(){},saveState(){}},modelBudget={schema:'starci/runtime-budget@1',at:Date.now(),providers:{codex:{status:'ok',windows:{weekly:{usedPercent:10,resetsAt:null}}},claude:{status:'ok',windows:{weekly:{usedPercent:20,resetsAt:null}}},qwen:{status:'ok',windows:{weekly:{usedPercent:30,resetsAt:null}}}}};return {dir,state,store,modelBudget};};

test('candidate storage defaults beside the journal and a validated configured root scopes each workflow',t=>{
  const f=fixture(t),configured=path.join(f.dir,'candidate-volume');
  assert.equal(candidateBaseFor(f.state),path.join(f.dir,'candidates',f.state.id));
  assert.equal(validateCandidateRoot(configured),fs.realpathSync(configured));
  f.state.engine.candidateRoot=configured;
  assert.equal(candidateBaseFor(f.state),path.join(configured,f.state.id));
  const explicit=path.join(f.dir,'explicit-operation-base');
  assert.equal(candidateBaseFor(f.state,explicit),explicit,'an existing explicit candidate base remains exact');
  assert.throws(()=>validateCandidateRoot('relative/candidates'),/absolute local directory/);
  assert.throws(()=>validateCandidateRoot('\\\\server\\share\\candidates'),/absolute local directory/);
});

test('durable validator excludes cooling choices before selecting its single provider and replays across skip changes',t=>{
  const f=fixture(t),bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:7,once(){},unref(){}})}),runtime=createEngineRuntime({...f,bridge,eligibility:()=>({eligible:true})});
  const args={providers:['gpt-6-astra','claude-fable-5.1'],skip:['gpt-6-astra'],diff:{files:['a.js']}},op={id:'review',attempt:1};
  assert.throws(()=>runtime.model('validateOp',args,op),error=>error.code==='STARCI_JOB_PENDING');
  const first=runtime.journal.listJobs()[0];assert.deepEqual(first.payload.args.providers,['claude-fable-5.1'],'filter cooldown before narrowing the peer pool');
  assert.throws(()=>runtime.model('validateOp',{...args,skip:[]},op),error=>error.code==='STARCI_JOB_PENDING');
  assert.equal(runtime.journal.listJobs().length,1,'routing cooldown changes cannot duplicate a launched semantic job');bridge.close();
});

test('model calls respect shared and local cooldown and admit the same waiting job after expiry',t=>{
  const f=fixture(t);let stamp=Date.now();const now=()=>stamp;
  f.state.allocation={cooling:{'gpt-5.6-sol':{until:stamp+1000,kind:'rate-limited'}}};
  fs.writeFileSync(path.join(f.dir,'runtime-loads.json'),JSON.stringify({schema:'starci/runtime-loads@1',runtimes:{'claude-opus':{cooling:{until:stamp+1000,kind:'quota',workflow:'peer'}}}}));
  const bridge=createJobBridge({journalFile:f.state.engine.journalFile,now,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:7,once(){},unref(){}})}),runtime=createEngineRuntime({...f,now,bridge,eligibility:()=>({eligible:true})}),args={providers:['gpt-5.6-sol','claude-opus'],situation:'route',options:['a']},op={id:'manager',attempt:1};
  assert.throws(()=>runtime.model('decide',args,op),error=>error.code==='STARCI_MODEL_QUOTA_WAIT'&&error.waitKind==='provider-cooldown');assert.equal(runtime.journal.listJobs().length,0);
  stamp+=1001;assert.throws(()=>runtime.model('decide',args,op),error=>error.code==='STARCI_JOB_PENDING');assert.equal(runtime.journal.listJobs().length,1);bridge.close();
});

test('an in-process allocator cooldown routes a new model job to its healthy peer',t=>{
  const f=fixture(t),bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:7,once(){},unref(){}})}),runtime=createEngineRuntime({...f,bridge,eligibility:()=>({eligible:true}),modelCooling:()=>[{runtime:'gpt-5.6-sol',until:Date.now()+60_000}]});
  assert.throws(()=>runtime.model('decide',{providers:['gpt-5.6-sol','claude-opus'],situation:'next',options:['a']},{id:'next',attempt:1}),error=>error.code==='STARCI_JOB_PENDING');
  assert.deepEqual(runtime.journal.listJobs()[0].payload.args.providers,['claude-opus']);bridge.close();
});

test('upgrade replays the exact legacy skip-bearing validator job after routing observations change',t=>{
  for(const status of ['running','succeeded','effect_unknown']){
    const f=fixture(t),bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:7,once(){},unref(){}})}),bound={workflowId:'wf',opId:'legacy',attempt:1,generation:2};
    const args={providers:['gpt-6-astra','claude-fable-5.1'],skip:['claude-fable-5.1'],diff:{files:['a.js']}},saved={provider:'gpt-6-astra',runtime:'gpt-6-astra',mode:'qualified'};
    f.state.engine.modelSelections={[inputDigest({name:'validateOp',args,...bound})]:saved};
    const input={handler:'model-function',functionName:'validateOp',args:{...args,providers:[saved.provider]},admission:{runtime:saved.runtime,mode:saved.mode}},old=bridge.request({...bound,kind:'judge',role:'verify',input});
    bridge.journal.db.prepare('UPDATE jobs SET status=? WHERE job_id=?').run(status==='succeeded'?'running':status,old.identity.jobId);
    const runtime=createEngineRuntime({...f,bridge,eligibility:()=>({eligible:false,reasons:['new admission is unavailable']})});
    if(status==='succeeded')assert.equal(runtime.jobs.complete({...old.identity,leaseToken:bridge.journal.getJob(old.identity.jobId).lease_token,status:'succeeded',result:{ok:true,verdict:'accept'}}).ok,true);
    const replay=()=>runtime.model('validateOp',{...args,skip:['gpt-6-astra']},{id:'legacy',attempt:1});
    if(status==='succeeded')assert.deepEqual(replay(),{ok:true,verdict:'accept'});
    else assert.throws(replay,error=>error.code==='STARCI_JOB_PENDING'&&error.job.identity.jobId===old.identity.jobId);
    assert.equal(runtime.journal.listJobs().length,1,'an upgrade cannot launch or reserve a second legacy review');
    assert.throws(()=>runtime.model('validateOp',{...args,diff:{files:['other.js']}},{id:'legacy',attempt:1}),/No evaluated model is eligible/,'different semantic input cannot consume legacy evidence');
    assert.throws(()=>runtime.model('validateOp',args,{id:'foreign',attempt:1}),/No evaluated model is eligible/,'another operation cannot consume the legacy job');bridge.close();
  }
});

test('mixed model cooldown and capacity blocks report availability rather than exhausted quota',t=>{
  const f=fixture(t),profile=loadRuntimes();for(const item of Object.values(profile.runtimes))if(item.provider==='claude')item.maxParallel=1;
  const bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:7,once(){},unref(){}})}),runtime=createEngineRuntime({...f,bridge,runtimeProfile:profile,eligibility:()=>({eligible:true}),modelCooling:()=>[{runtime:'gpt-5.6-sol',until:Date.now()+60_000}]});
  assert.throws(()=>runtime.model('decide',{providers:['claude-opus'],situation:'occupy',options:['a']},{id:'busy',attempt:1}),error=>error.code==='STARCI_JOB_PENDING');
  assert.throws(()=>runtime.model('decide',{providers:['gpt-5.6-sol','claude-opus'],situation:'wait',options:['a']},{id:'wait',attempt:1}),error=>error.code==='STARCI_MODEL_QUOTA_WAIT'&&error.waitKind==='provider-availability'&&error.reasons.every(item=>item.known&&!item.exhausted));
  assert.equal(runtime.journal.listJobs().length,1);bridge.close();
});

test('ambiguous legacy validator jobs retain custody and cannot silently choose a completion',t=>{
  const f=fixture(t),bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:7,once(){},unref(){}})}),bound={workflowId:'wf',opId:'legacy',attempt:1,generation:2},base={providers:['gpt-6-astra','claude-fable-5.1'],diff:{files:['a.js']}},saved={provider:'gpt-6-astra',runtime:'gpt-6-astra',mode:'qualified'};f.state.engine.modelSelections={};
  for(const skip of [[],['claude-fable-5.1']]){
    const args={...base,skip};f.state.engine.modelSelections[inputDigest({name:'validateOp',args,...bound})]=saved;
    bridge.request({...bound,kind:'judge',role:'verify',input:{handler:'model-function',functionName:'validateOp',args:{...args,providers:[saved.provider]},admission:{runtime:saved.runtime,mode:saved.mode}}});
  }
  const runtime=createEngineRuntime({...f,bridge,eligibility:()=>({eligible:true})}),leases=runtime.journal.db.prepare('SELECT count(*) AS n FROM leases').get().n;
  assert.throws(()=>runtime.model('validateOp',{...base,skip:['gpt-6-astra']},{id:'legacy',attempt:1}),/Multiple legacy durable validateOp jobs/);
  assert.equal(runtime.journal.listJobs().length,2);assert.equal(runtime.journal.db.prepare('SELECT count(*) AS n FROM leases').get().n,leases);bridge.close();
});

test('prelaunch persistence failure retains one resumable reservation while launch intent remains effect-unknown',t=>{
  const f=fixture(t),bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>{throw Error('native launch must not run');}}),runtime=createEngineRuntime({...f,eligibility:()=>({eligible:true}),bridge}),allocated={runtime:'gpt-5.6-sol',target:'gpt-5.6-sol',role:'implement'};
  const safe={id:'safe',kind:'backend.implement',attempt:1,allowlist:[]};assert.equal(runtime.reserveOperation(safe,allocated).ok,true);assert.equal(runtime.reservationPhase(safe).phase,'reserved');
  assert.throws(()=>persistPrelaunchReservation({saveState(){throw Error('EPERM rename');}},f.state,safe,runtime),/EPERM rename/);assert.equal(runtime.reservationPhase(safe).phase,'reserved');assert.equal(runtime.journal.listJobs().filter(job=>job.op_id==='safe').length,1);assert.equal(runtime.reserveOperation(safe,allocated).jobId,safe.lease.jobId,'continuation reuses one durable job');
  const unknown={id:'unknown',kind:'backend.implement',attempt:1,allowlist:[]};assert.equal(runtime.reserveOperation(unknown,allocated).ok,true);runtime.beginLaunchIntent(unknown);assert.equal(runtime.reservationPhase(unknown).phase,'effect-intent');assert.throws(()=>runtime.beginLaunchIntent(unknown),error=>error.effectState==='unknown');assert.equal(runtime.journal.getJob(unknown.lease.jobId).status,'leased');bridge.close();
});

test('restart adopts the exact prelaunch reservation once and incomplete or unknown bindings never launch',t=>{
  const f=fixture(t);let consumed=0;const policy={consumeProbation:()=>{consumed+=1;return {ok:true};}},op={id:'reload',kind:'backend.implement',attempt:1,status:'ready',allowlist:['src/']};f.state.ops=[op];
  const firstBridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>{throw Error('no native launch');}}),first=createEngineRuntime({...f,bridge:firstBridge,eligibility:()=>({eligible:true,mode:'probation'}),modelPolicy:policy});const reserved=first.reserveOperation(op,{runtime:'gpt-5.6-sol',target:'gpt-5.6-sol',role:'implement'});assert.equal(consumed,1);delete op.lease;firstBridge.close();
  const reloadedState={...f.state,ops:[{id:'reload',kind:'backend.implement',attempt:1,status:'ready',allowlist:['src/']}]},secondBridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>{throw Error('no native launch');}}),second=createEngineRuntime({...f,state:reloadedState,bridge:secondBridge,eligibility:()=>({eligible:false,reasons:['fresh admission changed']}),modelPolicy:policy});second.pulse();const restored=reloadedState.ops[0];assert.equal(restored.lease.jobId,reserved.jobId);assert.deepEqual(second.reservationPhase(restored),{phase:'reserved',runtime:'gpt-5.6-sol',target:'gpt-5.6-sol',role:'implement'});assert.equal(second.reserveOperation(restored,{runtime:'gpt-5.6-sol',target:'gpt-5.6-sol',role:'implement'}).reattached,true,'already admitted reservation does not run fresh eligibility again');second.beginLaunchIntent(restored);assert.equal(consumed,1,'restart does not consume probation or create another job');assert.equal(second.journal.listJobs().filter(job=>job.op_id==='reload').length,1);
  second.journal.db.prepare("UPDATE jobs SET status='effect_unknown' WHERE job_id=?").run(restored.lease.jobId);assert.throws(()=>second.beginLaunchIntent(restored),error=>error.effectState==='unknown');assert.equal(second.journal.getJob(restored.lease.jobId).status,'effect_unknown');secondBridge.close();
});

test('reservation phase rejects a missing canonical writer resource',t=>{const f=fixture(t),bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>{}}),runtime=createEngineRuntime({...f,bridge,eligibility:()=>({eligible:true})}),op={id:'writer',kind:'backend.implement',attempt:1,status:'ready',allowlist:['src/']};runtime.reserveOperation(op,{runtime:'gpt-5.6-sol',target:'gpt-5.6-sol',role:'implement'});runtime.journal.db.prepare("DELETE FROM leases WHERE job_id=? AND resource_key LIKE 'canonical-writer:%'").run(op.lease.jobId);assert.equal(runtime.reservationPhase(op).phase,'unknown');assert.throws(()=>runtime.beginLaunchIntent(op),error=>error.effectState==='unknown');bridge.close();});

test('runtime exposes required validation and only sends evaluated providers to the detached model',t=>{
  const f=fixture(t),bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:7,once(){},unref(){}})});
  const seen=[],eligibility=(job,runtime)=>{seen.push([job.role,runtime.id]);return {eligible:runtime.id==='gpt-5.6-sol',reasons:[]};};const runtime=createEngineRuntime({...f,bridge,eligibility});assert.equal(runtime.requiredValidation,true);
  assert.throws(()=>runtime.model('validateOp',{providers:['qwen3.8-flash','gpt-5.6-sol'],diff:{files:['a.js']}},{id:'op',attempt:1}),error=>error.code==='STARCI_JOB_PENDING');
  const job=runtime.journal.listJobs()[0];assert.deepEqual(job.payload.args.providers,['gpt-5.6-sol']);assert.deepEqual(seen,[['verify','qwen3.8-flash'],['verify','gpt-5.6-sol']]);bridge.close();
});

test('runtime refuses a model function before launch when every candidate is unqualified',t=>{
  const f=fixture(t),bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>{throw Error('must not launch');}}),runtime=createEngineRuntime({...f,bridge,eligibility:()=>({eligible:false,reasons:['unqualified']})});
  assert.throws(()=>runtime.model('decide',{providers:['gpt-5.6-sol']},{id:'op',attempt:1}),/No evaluated model is eligible/);assert.equal(runtime.journal.listJobs().length,0);bridge.close();
});

test('agent manager uses its semantic decision id for durable replay and the global model admission path',t=>{
  const f=fixture(t);f.state.engine.coordination='agent-v1';const bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:7,once(){},unref(){}})}),runtime=createEngineRuntime({...f,bridge,eligibility:()=>({eligible:true})});
  const snapshot={schema:'starci/manager-snapshot@1',workflowId:'wf',decisionId:'manager-semantic-a',generation:2,version:1,digest:'digest-a',basisDigest:'basis-a',goal:{job:'finish',definitionOfDone:['done']},progress:{ready:1},ops:[],blockers:[],actions:[{id:'act',type:'plan-verification',opId:'op',preconditions:[],summary:'Plan verification',contextRefIds:[]}],contextCatalog:[],noProgress:{round:0,budget:2}};
  let first;try{runtime.manageWorkflow(snapshot,{providers:['gpt-5.6-sol']});}catch(error){assert.equal(error.code,'STARCI_JOB_PENDING');first=error.job.identity.jobId;}
  const job=runtime.journal.getJob(first);assert.equal(job.op_id,'manager-semantic-a');assert.equal(job.role,'decide');assert.equal(job.payload.functionName,'manageWorkflow');assert.equal(JSON.stringify(job.payload).includes('pollTimestamp'),false);
  let second;try{runtime.manageWorkflow(structuredClone(snapshot),{providers:['gpt-5.6-sol']});}catch(error){second=error.job.identity.jobId;}assert.equal(second,first,'the same semantic decision replays one durable job');bridge.close();
});

test('non-operation peer pools choose known quota after eligibility and wait when every quota is unknown',t=>{
  const f=fixture(t);f.state.engine.coordination='agent-v1';const snapshot={schema:'starci/manager-snapshot@1',workflowId:'wf',decisionId:'manager-quota',generation:2,version:1,digest:'d',basisDigest:'b',goal:{job:'finish',definitionOfDone:['done']},progress:{},ops:[],blockers:[],actions:[{id:'act',type:'plan-verification',opId:'op',preconditions:[],summary:'plan',contextRefIds:[]}],contextCatalog:[],noProgress:{round:0,budget:2}};
  f.modelBudget.providers.claude.windows.weekly.usedPercent=80;f.modelBudget.providers.codex.windows.weekly.usedPercent=10;const bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:7,once(){},unref(){}})}),runtime=createEngineRuntime({...f,bridge,eligibility:()=>({eligible:true})});
  assert.throws(()=>runtime.manageWorkflow(snapshot),error=>error.code==='STARCI_JOB_PENDING');assert.deepEqual(runtime.journal.listJobs()[0].payload.args.providers,['gpt-5.6-sol'],'the second peer wins because it has more known quota');bridge.close();
  const unknown=fixture(t),other=createJobBridge({journalFile:unknown.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>{throw Error('must not launch');}});unknown.state.engine.coordination='agent-v1';unknown.modelBudget={schema:'starci/runtime-budget@1',at:Date.now(),providers:{}};const waiting=createEngineRuntime({...unknown,bridge:other,eligibility:()=>({eligible:true})});assert.throws(()=>waiting.manageWorkflow({...snapshot,decisionId:'manager-unknown'}),error=>error.code==='STARCI_MODEL_QUOTA_WAIT'&&error.reasons.every(item=>item.known===false));assert.equal(waiting.journal.listJobs().length,0);other.close();
});

test('cached model completion replays after its probation scope is consumed',t=>{
  const f=fixture(t),bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:7,once(){},unref(){}})});let eligible=true;const runtime=createEngineRuntime({...f,bridge,eligibility:()=>({eligible,mode:'probation'}),modelPolicy:{providerFilter:()=>eligible?['gpt-5.6-sol']:[],consumeProbation:()=>({ok:true,code:'probation-consumed'})}}),op={id:'op',attempt:1};let pending;try{runtime.model('decide',{providers:['gpt-5.6-sol'],situation:'x',options:['a']},op);}catch(error){pending=error.job;}const job=runtime.journal.getJob(pending.identity.jobId);runtime.jobs.complete({jobId:job.job_id,workflowId:job.workflow_id,opId:job.op_id,attempt:job.attempt,generation:job.generation,leaseToken:job.lease_token,eventId:`${job.job_id}:terminal`,status:'succeeded',result:{ok:true,value:{option:'a'}}});eligible=false;assert.deepEqual(runtime.model('decide',{providers:['gpt-5.6-sol'],situation:'x',options:['a']},op),{ok:true,value:{option:'a'}});bridge.close();
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
  const f=fixture(t),bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:1,once(){},unref(){}})}),op={id:'op',attempt:1,status:'running',checks:[{command:'docker compose ps'}]};f.state.ops=[op];let selected;const runtime=createEngineRuntime({...f,bridge,eligibility:(job,candidate)=>{selected=candidate;return {eligible:candidate?.id==='gpt-5.6-sol'};}});const reserved=runtime.reserveOperation(op,{role:'implement',runtime:'gpt-5.6-sol',target:'gpt-5.6-sol'});assert.equal(reserved.ok,true);assert.equal(selected.provider,'codex');delete op.lease;runtime.pulse();assert.equal(op.lease.jobId,reserved.jobId);assert.deepEqual(op.lease.machineResources,['machine:local-stack']);bridge.close();
});

test('probation rejection cancels native operation reservation before launch',t=>{
  const f=fixture(t),bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>{throw Error('not used');}}),op={id:'op',attempt:1,status:'ready',allowlist:['a.js']};f.state.ops=[op];const runtime=createEngineRuntime({...f,bridge,modelPolicy:{consumeProbation:()=>({ok:false,code:'probation-exhausted'})},eligibility:()=>({eligible:true,mode:'probation'})});const result=runtime.reserveOperation(op,{role:'implement',runtime:'gpt-5.6-sol',target:'gpt-5.6-sol'});assert.equal(result.ok,false);assert.match(result.reasons[0],/probation-exhausted/);assert.equal(runtime.journal.db.prepare('SELECT count(*) AS n FROM leases').get().n,0);bridge.close();
});

test('real workflow model policy consumes the same model-function scope selected before spawn',t=>{
  const f=fixture(t);f.state.approved=true;f.state.ops=[{id:'op',kind:'work.author',checks:[]}];fs.writeFileSync(path.join(f.dir,'policy.json'),JSON.stringify({schema:'starci/model-capability-policy@1'}));const profiles=loadRuntimes(),policy=createWorkflowModelEligibility({runtimes:profiles,state:f.state,policyFile:path.join(f.dir,'policy.json'),qualificationsFile:path.join(f.dir,'none.json'),root:f.dir,now:()=>1});let launches=0;
  const runtime=createEngineRuntime({...f,modelPolicy:policy,eligibility:policy.eligibility,spawnChild:()=>({pid:9,once(){},unref(){}})});
  try{runtime.model('planOp',{providers:['gpt-5.6-sol'],node:{operation:'work.author'}},{id:'op',attempt:1});}catch(error){assert.equal(error.code,'STARCI_JOB_PENDING',error.stack);launches+=1;}
  const scopes=Object.keys(f.state.modelEligibility.probationScopes);assert.deepEqual(scopes,['wf/op/model.planOp/plan']);assert.equal(f.state.modelEligibility.probationScopes['wf/op/model.planOp/plan'].remaining,1,'the model function consumed its own scope');assert.equal(f.state.modelEligibility.probationBudget.remaining,f.state.modelEligibility.probationBudget.initial,'a kernel model function never spends the operation probation budget');assert.equal(launches,1);runtime.close();
});

test('real workflow policy consumes native author probation in the eligibility workload scope',t=>{
  const f=fixture(t);f.state.approved=true;const op={id:'author',kind:'work.author',attempt:1,status:'ready',allowlist:['src/a.js'],checks:[]};f.state.ops=[op];fs.writeFileSync(path.join(f.dir,'policy.json'),JSON.stringify({schema:'starci/model-capability-policy@1'}));
  const profiles=loadRuntimes(),policy=createWorkflowModelEligibility({runtimes:profiles,state:f.state,policyFile:path.join(f.dir,'policy.json'),qualificationsFile:path.join(f.dir,'none.json'),root:f.dir,now:()=>1});
  const eligibility=(job,candidate)=>{const source=job.input?.op??job,actual={...source,opId:job.opId??source.id,kind:source.kind,role:job.role??'write',independentReview:{required:true,freshContext:true},checks:[...(source.checks??[]),{name:'work-valid'}]};return policy.eligibility(actual,candidate);};
  const runtime=createEngineRuntime({...f,modelPolicy:policy,eligibility,spawnChild:()=>({pid:1,once(){},unref(){}})}),allocation={runtime:'gpt-5.6-sol',target:'gpt-5.6-sol'};
  const scope='wf/author/work.author/plan',first=runtime.reserveOperation(op,allocation);assert.equal(first.ok,true);assert.deepEqual(Object.keys(f.state.modelEligibility.probationScopes),[scope]);assert.equal(f.state.modelEligibility.probationScopes[scope].remaining,1);runtime.settled(op);
  op.attempt=2;const second=runtime.reserveOperation(op,allocation);assert.equal(second.ok,true);assert.equal(f.state.modelEligibility.probationScopes[scope].remaining,0);runtime.settled(op);
  op.attempt=3;const third=runtime.reserveOperation(op,allocation);assert.equal(third.ok,false);assert.match(third.reasons.join(' '),/exhausted|unavailable/);runtime.close();
});

test('model replay hash excludes candidate payload and mutable operation runtime fields',t=>{
  const f=fixture(t),bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:1,once(){},unref(){}})}),runtime=createEngineRuntime({...f,bridge,eligibility:()=>({eligible:true})}),op={id:'op',kind:'backend.implement',goal:'g',attempt:1,acceptance:['a'],allowlist:['a.js'],candidate:{huge:'x'.repeat(10000)},status:'running'};let first;try{runtime.model('validateOp',{providers:['gpt-5.6-sol'],op,diff:{files:['a.js'],text:'+x'}},op);}catch(error){first=error.job.identity.jobId;}op.candidate={different:'y'.repeat(10000)};op.status='blocked';let second;try{runtime.model('validateOp',{providers:['gpt-5.6-sol'],op,diff:{files:['a.js'],text:'+x'}},op);}catch(error){second=error.job.identity.jobId;}assert.equal(second,first);const payload=runtime.journal.getJob(first).payload;assert.equal(JSON.stringify(payload).includes('huge'),false);bridge.close();
});

test('worker-only settlement releases AI and retains writer until final acceptance settlement',t=>{
  const f=fixture(t),bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:1,once(){},unref(){}})}),op={id:'op',kind:'backend.implement',attempt:1,status:'running',allowlist:['a.js']};f.state.ops=[op];const runtime=createEngineRuntime({...f,bridge,eligibility:()=>({eligible:true})}),lease=runtime.reserveOperation(op,{role:'implement',runtime:'gpt-5.6-sol',target:'gpt-5.6-sol'});assert.equal(lease.ok,true);assert.equal(runtime.settled(op,{workerOnly:true}).writerRetained,true);let rows=runtime.journal.db.prepare('SELECT resource_key FROM leases WHERE job_id=?').all(lease.jobId).map(x=>x.resource_key);assert.equal(rows.includes('ai/global'),false);assert.equal(rows.some(x=>x.startsWith('canonical-writer:')),true);assert.equal(runtime.settled(op).ok,true);rows=runtime.journal.db.prepare('SELECT resource_key FROM leases WHERE job_id=?').all(lease.jobId);assert.equal(rows.length,0);bridge.close();
});

test('cross-root admission acquires both writers atomically and retains both through acceptance',t=>{
  const f=fixture(t),owner=path.join(f.dir,'backend-owner'),other=path.join(f.dir,'other-frontend');fs.mkdirSync(owner);fs.mkdirSync(other);
  const binding=(id,repoRoot)=>({id,role:id,repoRoot,allowlist:['owned/**'],runtimePaths:[],workerWritable:true,runtimeWritable:false});
  const first={id:'first',kind:'frontend.implement',attempt:1,status:'running',allowlist:['src/**'],candidateRootBindings:{bindings:[binding('source',f.dir),binding('work',owner)]}};
  const second={id:'second',kind:'frontend.implement',attempt:1,status:'ready',allowlist:['src/**'],candidateRootBindings:{bindings:[binding('source',other),binding('work',owner)]}};f.state.ops=[first,second];
  const bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:1,once(){},unref(){}})}),
    runtime=createEngineRuntime({...f,bridge,eligibility:()=>({eligible:true})}),allocation={role:'implement',runtime:'gpt-5.6-sol',target:'gpt-5.6-sol'};
  const held=runtime.reserveOperation(first,allocation);assert.equal(held.ok,true);runtime.settled(first,{workerOnly:true});
  const rows=runtime.journal.db.prepare('SELECT resource_key FROM leases WHERE job_id=? ORDER BY resource_key').all(held.jobId).map(row=>row.resource_key);
  assert.equal(rows.filter(key=>key.startsWith('canonical-writer:')).length,2,'both actual repositories remain fenced');
  const refused=runtime.reserveOperation(second,allocation);assert.equal(refused.ok,false);
  assert.equal(runtime.journal.db.prepare('SELECT count(*) AS n FROM leases WHERE job_id=?').get(refused.jobId).n,0,'a failed second-root acquisition leaves no partial first-root reservation');
  assert.equal(runtime.settled(first).ok,true);assert.equal(runtime.reserveOperation(second,allocation).ok,true);runtime.settled(second);bridge.close();
});

test('three workflows sharing one canonical store fence exact continuation projections without sharing a product writer',t=>{
  const f=fixture(t),storeRoot=path.join(f.dir,'canonical-store');fs.mkdirSync(storeRoot);
  const source=(name)=>{const root=path.join(f.dir,name);fs.mkdirSync(root);return {id:'source',role:'source',repoRoot:root,allowlist:['src/**'],runtimePaths:[],workerWritable:true,runtimeWritable:false};};
  const projection=id=>({id:'store',role:'workflow-store',repoRoot:storeRoot,allowlist:[],runtimePaths:[`workflows/${id}.md`],workerWritable:false,runtimeWritable:true,
    runtimeManagedFiles:[{path:`workflows/${id}.md`,start:'start',end:'end'}]});
  const ops=['business','backend','frontend'].map(id=>({id,kind:'backend.implement',attempt:1,status:'ready',allowlist:['src/**'],
    candidateRootBindings:{bindings:[source(`${id}-worktree`),projection(id)]}}));f.state.ops=ops;
  const bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:1,once(){},unref(){}})}),
    runtime=createEngineRuntime({...f,bridge,eligibility:()=>({eligible:true})}),allocation={role:'implement',runtime:'gpt-5.6-sol',target:'gpt-5.6-sol'};
  const leases=ops.map(op=>runtime.reserveOperation(op,allocation));assert.equal(leases.every(item=>item.ok),true,JSON.stringify(leases));
  const resources=leases.map(lease=>runtime.journal.db.prepare('SELECT resource_key FROM leases WHERE job_id=? ORDER BY resource_key').all(lease.jobId).map(row=>row.resource_key));
  assert.equal(new Set(resources.flat().filter(key=>key.startsWith('runtime-projection:'))).size,3);
  assert.equal(resources.every(keys=>keys.filter(key=>key.startsWith('canonical-writer:')).length===1),true,'each operation retains only its own product-root mutex');
  for(const op of ops)assert.equal(runtime.settled(op).ok,true);bridge.close();
});

test('a stopped exact native Dispatch freezes and preserves unreported effects before releasing its writer',t=>{
  const f=fixture(t),bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:1,once(){},unref(){}})}),op={id:'native',kind:'backend.implement',attempt:1,status:'running',allowlist:['a.js'],dispatch:'ctx-native'};f.state.ops=[op];
  const runtime=createEngineRuntime({...f,bridge,eligibility:()=>({eligible:true})});runtime.reserveOperation(op,{role:'implement',runtime:'gpt-5.6-sol',target:'gpt-5.6-sol'});runtime.beginLaunchIntent(op);op.launch={task:'task-native',dispatch:op.dispatch};runtime.recordLaunchObservation(op);runtime.launched(op);
  runtime.freezeCandidate=()=>{op.candidateDigest='candidate-digest';return {status:'sealed',observedFiles:['a.js']};};
  assert.equal(runtime.settleStoppedOperation(op,{dispatch:'ctx-other',settlement:{schema:'starci/orca-supervised-settlement@1',dispatchId:'ctx-native',effectState:'none'}}).ok,false,'a different Dispatch cannot release the fence');assert.ok(op.lease);
  const result=runtime.settleStoppedOperation(op,{dispatch:'ctx-native',settlement:{schema:'starci/orca-supervised-settlement@1',dispatchId:'ctx-native',effectState:'none'},reason:'stalled-prompt'});assert.deepEqual(result.observedFiles,['a.js']);assert.equal(op.lease,undefined);assert.deepEqual(op.ownedBaselinePaths,['a.js']);assert.equal(op.retryReconciled.dispatch,'ctx-native');assert.deepEqual(op.retryReconciled.observedFiles,['a.js']);
  const job=runtime.journal.listJobs().find(item=>item.op_id==='native');assert.equal(job.status,'failed');assert.equal(runtime.journal.db.prepare('SELECT count(*) AS n FROM leases WHERE job_id=?').get(job.job_id).n,0);assert.equal(runtime.journal.events({workflowId:'wf'}).some(event=>event.kind==='operation-stopped-effects-preserved'&&event.payload.dispatch==='ctx-native'),true);bridge.close();
});

test('an authenticated answered decision releases an exact stopped no-change retry without creating another retry',t=>{
  const f=fixture(t),bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:1,once(){},unref(){}})}),
    op={id:'answered',kind:'decision.prepare',attempt:2,status:'done',allowlist:['decision.yaml'],dispatch:'ctx-answered'};f.state.ops=[op];
  const runtime=createEngineRuntime({...f,bridge,eligibility:()=>({eligible:true})});runtime.reserveOperation(op,{role:'decide',runtime:'gpt-5.6-sol',target:'gpt-5.6-sol'});
  runtime.beginLaunchIntent(op);op.launch={task:'task-answered',dispatch:op.dispatch};runtime.recordLaunchObservation(op);runtime.launched(op);
  runtime.freezeCandidate=()=>{op.candidateDigest='sealed-empty';return {status:'sealed',observedFiles:[]};};
  const result=runtime.settleStoppedOperation(op,{dispatch:'ctx-answered',settlement:{schema:'starci/orca-supervised-settlement@1',dispatchId:'ctx-answered',effectState:'none'},acceptedPreparedDecision:true});
  assert.equal(result.ok,true);assert.equal(result.acceptedPreparedDecision,true);assert.equal(op.lease,undefined);assert.equal(op.retryReconciled,undefined);
  const job=runtime.journal.listJobs().find(item=>item.op_id==='answered');assert.equal(job.status,'succeeded');
  const next={id:'next',kind:'decision.prepare',attempt:1,status:'ready',allowlist:['decision.yaml']};f.state.ops.push(next);
  assert.equal(runtime.reserveOperation(next,{role:'decide',runtime:'gpt-5.6-sol',target:'gpt-5.6-sol'}).ok,true,'the next writer is admitted after the answered decision settles');
  runtime.settled(next);bridge.close();
});

test('an accepted prepared decision releases its writer before the owner answers and the next op is admitted',t=>{
  const f=fixture(t),bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:1,once(){},unref(){}})}),
    ask={id:'ask',kind:'decision.prepare',attempt:1,status:'running',allowlist:['decision.yaml'],dispatch:'ctx-ask'};f.state.ops=[ask];
  const runtime=createEngineRuntime({...f,bridge,eligibility:()=>({eligible:true})}),allocation={role:'decide',runtime:'gpt-5.6-sol',target:'gpt-5.6-sol'};
  assert.equal(runtime.reserveOperation(ask,allocation).ok,true);runtime.beginLaunchIntent(ask);ask.launch={task:'task-ask',dispatch:ask.dispatch};runtime.recordLaunchObservation(ask);runtime.launched(ask);
  assert.equal(runtime.settled(ask,{workerOnly:true,reason:'accepted decision report'}).ok,true,'report acceptance releases only the model capacity first');
  assert.ok(ask.lease,'the writer remains until the accepted candidate is finalized');
  ask.question={prepared:true};ask.ownerRequestStatus='waiting-owner';ask.status='done';
  assert.equal(runtime.settled(ask,{status:'succeeded',reason:'accepted prepared decision'}).ok,true,'accepted preparation finalizes the durable writer before owner input');
  assert.equal(ask.lease,undefined);
  ask.ownerAnswer={receiptId:'receipt-owner'};ask.ownerContinuationReceipt='receipt-owner';ask.ownerRequestStatus='answered';
  const next={id:'next-after-answer',kind:'backend.implement',attempt:1,status:'ready',allowlist:['decision.yaml']};f.state.ops.push(next);
  assert.equal(runtime.reserveOperation(next,{role:'implement',runtime:'gpt-5.6-sol',target:'gpt-5.6-sol'}).ok,true,'owner answer does not strand the completed decision writer');
  runtime.settled(next);bridge.close();
});

test('a completed user takeover proves the worker capability ended while preserving its live owner terminal',t=>{
  const f=fixture(t),bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:1,once(){},unref(){}})}),
    op={id:'takeover',kind:'decision.prepare',attempt:2,status:'done',allowlist:['decision.yaml'],dispatch:'ctx-takeover'};f.state.ops=[op];
  const runtime=createEngineRuntime({...f,bridge,eligibility:()=>({eligible:true})});runtime.reserveOperation(op,{role:'decide',runtime:'gpt-5.6-sol',target:'gpt-5.6-sol'});
  runtime.beginLaunchIntent(op);op.launch={task:'task-takeover',dispatch:op.dispatch};runtime.recordLaunchObservation(op);runtime.launched(op);
  runtime.freezeCandidate=()=>({status:'sealed',observedFiles:[]});
  const settlement={schema:'starci/orca-user-takeover-settlement@1',dispatchId:'ctx-takeover',effectState:'none',dispatchStatus:'completed',workerState:'succeeded',workerStage:'settled',capabilityRevoked:true,ownershipState:'user_owned'};
  assert.equal(runtime.settleStoppedOperation(op,{dispatch:'ctx-takeover',settlement,acceptedPreparedDecision:true}).ok,true);assert.equal(op.lease,undefined);
  const wrong={...settlement,capabilityRevoked:false};op.lease={workflowId:'wf',opId:'takeover',attempt:2,generation:1,jobId:'missing',leaseToken:'x'};
  assert.equal(runtime.settleStoppedOperation(op,{dispatch:'ctx-takeover',settlement:wrong,acceptedPreparedDecision:true}).ok,false);bridge.close();
});

test('an answered decision retry with new candidate effects retains its writer for explicit reconciliation',t=>{
  const f=fixture(t),bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:1,once(){},unref(){}})}),
    op={id:'answered-drift',kind:'decision.prepare',attempt:2,status:'done',allowlist:['decision.yaml'],dispatch:'ctx-answered-drift'};f.state.ops=[op];
  const runtime=createEngineRuntime({...f,bridge,eligibility:()=>({eligible:true})});runtime.reserveOperation(op,{role:'decide',runtime:'gpt-5.6-sol',target:'gpt-5.6-sol'});
  runtime.beginLaunchIntent(op);op.launch={task:'task-answered-drift',dispatch:op.dispatch};runtime.recordLaunchObservation(op);runtime.launched(op);
  runtime.freezeCandidate=()=>({status:'sealed',observedFiles:['decision.yaml']});
  const result=runtime.settleStoppedOperation(op,{dispatch:'ctx-answered-drift',settlement:{schema:'starci/orca-supervised-settlement@1',dispatchId:'ctx-answered-drift',effectState:'none'},acceptedPreparedDecision:true});
  assert.equal(result.ok,false);assert.equal(result.effectState,'partial');assert.ok(op.lease,'the writer fence remains while unaccepted bytes exist');
  assert.equal(runtime.journal.db.prepare("SELECT count(*) n FROM leases WHERE job_id=? AND resource_key LIKE 'canonical-writer:%'").get(op.lease.jobId).n,1);bridge.close();
});

test('a single unknown-effect failed launch binds its exact settled Dispatch before preserving candidate effects',t=>{
  const f=fixture(t),bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:1,once(){},unref(){}})}),
    op={id:'failed-native',kind:'frontend.implement',attempt:2,status:'blocked',allowlist:['a.js']};f.state.ops=[op];
  const runtime=createEngineRuntime({...f,bridge,eligibility:()=>({eligible:true})}),reserved=runtime.reserveOperation(op,{role:'implement',runtime:'gpt-5.6-sol',target:'gpt-5.6-sol'});
  assert.equal(reserved.ok,true);runtime.beginLaunchIntent(op);
  runtime.journal.db.prepare("UPDATE jobs SET status='effect_unknown',deadline=NULL WHERE job_id=?").run(reserved.jobId);
  op.launch={ok:false,task:'task-failed',dispatch:null,effectState:'unknown',attempts:[{dispatchId:'ctx-failed',effectState:'unknown',stage:'dispatch_input'}]};
  op.candidate={identity:{workflowId:f.state.id,opId:op.id,attempt:op.attempt,generation:f.state.engine.generation,jobId:op.lease.jobId}};
  runtime.freezeCandidate=()=>{op.candidateDigest='recovered-candidate';return {status:'sealed',observedFiles:['a.js']};};
  const result=runtime.settleStoppedOperation(op,{dispatch:'ctx-failed',settlement:{schema:'starci/orca-supervised-settlement@1',dispatchId:'ctx-failed',effectState:'none'},reason:'retry proved exit'});
  assert.equal(result.ok,true);assert.deepEqual(result.observedFiles,['a.js']);assert.equal(runtime.journal.getJob(reserved.jobId).worker_id,'ctx-failed');
  const event=runtime.journal.events({workflowId:f.state.id}).find(item=>item.kind==='operation-launch-reconciled');
  assert.deepEqual([event?.payload?.task,event?.payload?.dispatch],['task-failed','ctx-failed']);bridge.close();
});

test('failed-launch reconciliation rejects ambiguous attempts, mismatched candidates and missing resource custody',t=>{
  for(const variant of ['ambiguous','candidate-mismatch','missing-resources']){
    const f=fixture(t),bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:1,once(){},unref(){}})}),
      op={id:`failed-${variant}`,kind:'frontend.implement',attempt:2,status:'blocked',allowlist:['a.js']};f.state.ops=[op];
    const runtime=createEngineRuntime({...f,bridge,eligibility:()=>({eligible:true})}),reserved=runtime.reserveOperation(op,{role:'implement',runtime:'gpt-5.6-sol',target:'gpt-5.6-sol'});runtime.beginLaunchIntent(op);
    op.launch={ok:false,task:'task-failed',dispatch:null,effectState:'unknown',attempts:[{dispatchId:'ctx-failed',effectState:'unknown'},...(variant==='ambiguous'?[{dispatchId:'ctx-other',effectState:'unknown'}]:[])]};
    op.candidate={identity:{workflowId:f.state.id,opId:op.id,attempt:variant==='candidate-mismatch'?1:op.attempt,generation:f.state.engine.generation,jobId:op.lease.jobId}};
    if(variant==='missing-resources')runtime.journal.db.prepare('DELETE FROM leases WHERE job_id=?').run(reserved.jobId);
    const result=runtime.settleStoppedOperation(op,{dispatch:'ctx-failed',settlement:{schema:'starci/orca-supervised-settlement@1',dispatchId:'ctx-failed',effectState:'none'}});
    assert.equal(result.ok,false);assert.match(result.reason,/not bound/);assert.equal(runtime.journal.getJob(reserved.jobId).worker_id,null);bridge.close();
  }
});

test('a stopped native attempt with unsealable scope drift retains its writer and cannot launder paths into retry baseline',t=>{
  const f=fixture(t),bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:1,once(){},unref(){}})}),op={id:'drift',kind:'backend.implement',attempt:1,status:'running',allowlist:['src/**'],dispatch:'ctx-drift'};f.state.ops=[op];
  const runtime=createEngineRuntime({...f,bridge,eligibility:()=>({eligible:true})});runtime.reserveOperation(op,{role:'implement',runtime:'gpt-5.6-sol',target:'gpt-5.6-sol'});runtime.beginLaunchIntent(op);op.launch={task:'task-drift',dispatch:op.dispatch};runtime.recordLaunchObservation(op);runtime.launched(op);
  runtime.freezeCandidate=()=>({status:'quarantined',observedFiles:['outside.txt'],reasons:['outside allowlist']});
  const result=runtime.settleStoppedOperation(op,{dispatch:'ctx-drift',settlement:{schema:'starci/orca-supervised-settlement@1',dispatchId:'ctx-drift',effectState:'none'}});assert.equal(result.ok,false);assert.equal(op.ownedBaselinePaths,undefined);assert.ok(op.lease,'writer fence remains attached');
  const resources=runtime.journal.db.prepare('SELECT resource_key FROM leases WHERE job_id=?').all(op.lease.jobId).map(row=>row.resource_key);assert.equal(resources.includes('ai/global'),false);assert.equal(resources.some(key=>key.startsWith('canonical-writer:')),true);assert.equal(runtime.journal.getJob(op.lease.jobId).status,'running');bridge.close();
});

test('machine guard resources serialize native workers and detached checks while retaining only the writer',t=>{
  const f=fixture(t),spawned=[],bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>{spawned.push(true);return {pid:1,once(){},unref(){}};}});
  const first={id:'one',kind:'backend.implement',attempt:1,status:'running',allowlist:['a.js'],checks:[{command:'docker compose up'}]};
  const second={id:'two',kind:'backend.implement',attempt:1,status:'ready',allowlist:[],checks:[{command:'psql -h localhost:5432'}]};f.state.ops=[first,second];
  const runtime=createEngineRuntime({...f,bridge,eligibility:()=>({eligible:true})}),allocation={role:'implement',runtime:'gpt-5.6-sol',target:'gpt-5.6-sol'};
  assert.equal(runtime.reserveOperation(first,allocation).ok,true);
  assert.equal(runtime.reserveOperation(second,allocation).ok,false);
  assert.throws(()=>runtime.check('docker compose ps',{},second),error=>error.code==='STARCI_JOB_PENDING'&&error.job.status==='deferred');
  runtime.settled(first,{workerOnly:true});
  const held=runtime.journal.db.prepare('SELECT resource_key FROM leases WHERE job_id=?').all(first.lease.jobId).map(row=>row.resource_key);
  assert.deepEqual(held.filter(key=>key.startsWith('machine:')),[]);assert.equal(held.some(key=>key.startsWith('canonical-writer:')),true);
  assert.equal(runtime.reserveOperation(second,allocation).ok,true);
  assert.throws(()=>runtime.check('docker compose ps',{},second),error=>error.code==='STARCI_JOB_PENDING'&&error.job.status==='deferred');
  runtime.settled(second,{workerOnly:true});
  assert.throws(()=>runtime.check('docker compose ps',{},second),error=>error.code==='STARCI_JOB_PENDING'&&error.job.status==='running');assert.equal(spawned.length,1);
  bridge.close();
});

test('confirmed stopped old-generation lease can be settled before retry drops its state handle',t=>{
  const f=fixture(t),bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:1,once(){},unref(){}})}),op={id:'op',kind:'backend.implement',attempt:1,status:'running',allowlist:['a.js']};f.state.ops=[op];const runtime=createEngineRuntime({...f,bridge,eligibility:()=>({eligible:true})});runtime.reserveOperation(op,{role:'implement',runtime:'gpt-5.6-sol',target:'gpt-5.6-sol'});runtime.settled(op,{workerOnly:true});const lease={...op.lease};bridge.close();assert.equal(settleGenerationLeases({journalFile:f.state.engine.journalFile,leases:[lease]})[0].ok,true);const reopened=createJobBridge({journalFile:f.state.engine.journalFile});assert.equal(reopened.journal.db.prepare('SELECT count(*) AS n FROM leases WHERE job_id=?').get(lease.jobId).n,0);reopened.close();
});

test('retry baseline adopts only report-attributed files and keeps other dirty paths unclaimed',()=>{
  const state={worktree:'C:/repo'},op={allowlist:['src/**'],kernelOwned:[],reports:[{files:['src/owned.ts']}]},git=()=>({status:0,stdout:' M src/owned.ts\n M src/foreign.ts\n?? outside.txt\n'});assert.deepEqual(retryOwnedBaseline(state,op,git),{changed:['src/owned.ts','src/foreign.ts'],attributed:['src/owned.ts'],unclaimed:['src/foreign.ts']});
});

test('retry admits only runtime reconciliation leases and fences unresolved generation jobs',t=>{
  assert.equal(retryableOperation({status:'blocked',lease:{jobId:'op'},refusal:'runtime-reconciliation'}),true);
  assert.equal(retryableOperation({status:'blocked',lease:{jobId:'op'},workerSettled:true}),true);
  assert.equal(retryableOperation({status:'ready',retryReconciled:{jobId:'op',dispatch:'ctx'}}),true);
  assert.equal(retryableOperation({status:'blocked',lease:{jobId:'op'},ownerRequest:{id:'ask'}}),false);
  assert.equal(retryableOperation({status:'blocked',lease:{jobId:'op'},refusal:'business-rule'}),false);
  const f=fixture(t),bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:7,once(){},unref(){}})});
  bridge.request({workflowId:'wf',opId:'op',attempt:1,generation:2,kind:'model',role:'plan',input:{handler:'model-function',functionName:'planOp',args:{providers:['gpt-5.6-sol']}}});
  assert.deepEqual(unsettledGenerationJobs({journalFile:f.state.engine.journalFile,workflowId:'wf',generation:2}),[bridge.journal.listJobs()[0].job_id]);
  bridge.journal.enqueueJob({jobId:'never-launched',workflowId:'wf',opId:'op',attempt:1,generation:2,kind:'check',role:'machine-check',payload:{command:'x'}});
  bridge.journal.enqueueJob({jobId:'earlier-never-launched',workflowId:'wf',opId:'op',attempt:1,generation:1,kind:'operation',role:'implement',payload:{runtime:'gpt-5.6-sol'}});
  const prepared=prepareGenerationRetry({journalFile:f.state.engine.journalFile,workflowId:'wf',generation:2,now:()=>9});assert.deepEqual(prepared.cancelled,['earlier-never-launched','never-launched'],'a queued job that never launched is cancelled whatever its generation or kind');assert.equal(prepared.unsettled.length,1);assert.notEqual(prepared.unsettled[0],'never-launched');
  assert.equal(bridge.journal.getJob('never-launched').status,'cancelled');assert.equal(bridge.journal.events({workflowId:'wf'}).some(event=>event.kind==='job-retry-queued-cancelled'),true);
  assert.deepEqual(unsettledGenerationJobs({journalFile:f.state.engine.journalFile,workflowId:'wf',generation:1}),[]);bridge.close();
});

test('a non-operation model call combines fresh quota, admitted family load and bounded owner preference',t=>{
  const snapshot=decisionId=>({schema:'starci/manager-snapshot@1',workflowId:'wf',decisionId,generation:2,version:1,digest:'d',basisDigest:'b',
    goal:{job:'finish',definitionOfDone:['done']},progress:{},ops:[],blockers:[],
    actions:[{id:'act',type:'plan-verification',opId:'op',preconditions:[],summary:'plan',contextRefIds:[]}],contextCatalog:[],noProgress:{round:0,budget:2}});
  const preferring=()=>withProviderPreference(loadRuntimes(),{mode:'adaptive',preferredProvider:'codex'});
  const spawn=()=>({pid:7,once(){},unref(){}});

  const rich=fixture(t);rich.state.engine.coordination='agent-v1';
  rich.modelBudget.providers.claude.windows.weekly.usedPercent=10;rich.modelBudget.providers.codex.windows.weekly.usedPercent=80;
  const richBridge=createJobBridge({journalFile:rich.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:spawn});
  const chooser=createEngineRuntime({...rich,bridge:richBridge,eligibility:()=>({eligible:true}),runtimeProfile:preferring()});
  assert.throws(()=>chooser.manageWorkflow(snapshot('manager-prefers-codex')),error=>error.code==='STARCI_JOB_PENDING');
  assert.deepEqual(chooser.journal.listJobs()[0].payload.args.providers,['claude-opus'],'a bounded preference does not override a much healthier family');
  richBridge.close();

  const close=fixture(t);close.state.engine.coordination='agent-v1';close.modelBudget.providers.claude.windows.weekly.usedPercent=35;close.modelBudget.providers.codex.windows.weekly.usedPercent=40;
  const closeBridge=createJobBridge({journalFile:close.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:spawn});
  const closeChoice=createEngineRuntime({...close,bridge:closeBridge,eligibility:()=>({eligible:true}),runtimeProfile:preferring()});
  assert.throws(()=>closeChoice.manageWorkflow(snapshot('manager-close')),error=>error.code==='STARCI_JOB_PENDING');
  assert.deepEqual(closeChoice.journal.listJobs()[0].payload.args.providers,['gpt-5.6-sol'],'the bounded preference decides a close feasible choice');closeBridge.close();

  const drained=fixture(t);drained.state.engine.coordination='agent-v1';
  drained.modelBudget.providers.codex.windows.weekly.usedPercent=99;drained.modelBudget.providers.claude.windows.weekly.usedPercent=10;
  const drainedBridge=createJobBridge({journalFile:drained.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:spawn});
  const overflow=createEngineRuntime({...drained,bridge:drainedBridge,eligibility:()=>({eligible:true}),runtimeProfile:preferring()});
  assert.throws(()=>overflow.manageWorkflow(snapshot('manager-codex-drained')),error=>error.code==='STARCI_JOB_PENDING');
  assert.deepEqual(overflow.journal.listJobs()[0].payload.args.providers,['claude-opus'],'a preference never starves: an exhausted window overflows to the other member');
  drainedBridge.close();
});

test('provider-family admission is atomic for concurrent model selections and unknown effects retain the slot',t=>{
  const f=fixture(t),profile=withProviderPreference(loadRuntimes(),{mode:'adaptive',preferredProvider:'codex'});
  for(const runtime of Object.values(profile.runtimes))if(runtime.provider==='codex')runtime.maxParallel=runtime.target==='gpt-5.6-sol'?1:0;
  const bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:7,once(){},unref(){}})}),runtime=createEngineRuntime({...f,bridge,runtimeProfile:profile,eligibility:()=>({eligible:true})});
  assert.throws(()=>runtime.model('decide',{providers:['gpt-5.6-sol'],situation:'a',options:['x']},{id:'a',attempt:1}),error=>error.code==='STARCI_JOB_PENDING'&&error.job.status==='running');
  const first=runtime.journal.listJobs()[0];runtime.journal.db.prepare("UPDATE jobs SET status='effect_unknown' WHERE job_id=?").run(first.job_id);
  assert.throws(()=>runtime.model('decide',{providers:['gpt-5.6-sol'],situation:'b',options:['x']},{id:'b',attempt:1}),error=>error.code==='STARCI_MODEL_QUOTA_WAIT'&&error.waitKind==='provider-capacity');
  const held=runtime.journal.db.prepare("SELECT count(*) AS n FROM leases WHERE resource_key='ai/provider:codex'").get().n;
  assert.equal(held,1,'the unknown-effect job retains the one Codex family slot and the second atomic reservation is refused');
  const view=runtime.providerAdmissionView();assert.equal(view.providers.codex.capacity,1,'extra Codex model names do not add family capacity');assert.equal(view.providers.codex.used,1);
  const allocator=createAllocator({runtimes:profile,budget:f.modelBudget});allocator.bindProviderAdmission(()=>runtime.providerAdmissionView());
  const reviewed=allocator.review('backend.implement',{restrictTo:['gpt-5.6-sol','claude-opus']});
  assert.match(reviewed.blocked.find(item=>item.runtime==='gpt-5.6-sol').reason,/authoritative admission/);
  const operation=allocator.allocate('backend.implement',{restrictTo:['gpt-5.6-sol','claude-opus'],job:{opId:'native-after-unknown'}});
  assert.equal(operation.ok,true);assert.equal(profile.runtimes[operation.runtime].provider,'claude','operation scoring sees the model lease even after its controller became unknown');bridge.close();
});

test('settled model service remains durable pressure and rotates an equal-headroom peer pool',t=>{
  const f=fixture(t);let stamp=Date.UTC(2026,8,15,9);const now=()=>stamp;f.modelBudget.at=stamp;
  for(const provider of ['codex','claude'])f.modelBudget.providers[provider].windows.weekly={usedPercent:20,resetsAt:stamp+60*60_000,minutes:60};
  const profile=withProviderPreference(loadRuntimes(),{mode:'adaptive',preferredProvider:null}),
    bridge=createJobBridge({journalFile:f.state.engine.journalFile,now,eligibility:()=>({eligible:true}),spawnChild:()=>({pid:7,once(){},unref(){}})}),
    runtime=createEngineRuntime({...f,now,bridge,runtimeProfile:profile,eligibility:()=>({eligible:true})});
  assert.throws(()=>runtime.model('decide',{providers:['claude-opus','gpt-5.6-sol'],situation:'first',options:['x']},{id:'first',attempt:1}),error=>error.code==='STARCI_JOB_PENDING');
  const first=runtime.journal.listJobs()[0];assert.deepEqual(first.payload.args.providers,['claude-opus'],'the input-order tie break selects Claude first');
  const jobs=createJobs({journal:runtime.journal,admission:bridge.admission,now});
  assert.equal(jobs.complete({jobId:first.job_id,workflowId:first.workflow_id,opId:first.op_id,attempt:first.attempt,generation:first.generation,leaseToken:first.lease_token,status:'succeeded',result:{ok:true}}).ok,true);
  const view=runtime.providerAdmissionView();assert.equal(view.providers.claude.used,0);assert.equal(view.providers.claude.recentSettled,1);
  assert.throws(()=>runtime.model('decide',{providers:['claude-opus','gpt-5.6-sol'],situation:'second',options:['x']},{id:'second',attempt:1}),error=>error.code==='STARCI_JOB_PENDING');
  const second=runtime.journal.listJobs().find(job=>job.op_id==='second');assert.deepEqual(second.payload.args.providers,['gpt-5.6-sol'],'settled Claude service moves the next equal-headroom job to Codex');
  assert.equal(jobs.complete({jobId:second.job_id,workflowId:second.workflow_id,opId:second.op_id,attempt:second.attempt,generation:second.generation,leaseToken:second.lease_token,status:'succeeded',result:{ok:true}}).ok,true);
  stamp+=60*60_000+1;f.modelBudget.at=stamp;for(const provider of ['codex','claude'])f.modelBudget.providers[provider].windows.weekly.resetsAt=stamp+60*60_000;
  assert.throws(()=>runtime.model('decide',{providers:['claude-opus','gpt-5.6-sol'],situation:'new-window',options:['x']},{id:'new-window',attempt:1}),error=>error.code==='STARCI_JOB_PENDING');
  assert.deepEqual(runtime.journal.listJobs().find(job=>job.op_id==='new-window').payload.args.providers,['claude-opus'],'the current provider-window start excludes service from the prior window');bridge.close();
});

test('launched cancellation and worker-only stop remain service pressure while never-launched cancellation does not',t=>{
  const f=fixture(t),profile=withProviderPreference(loadRuntimes(),{mode:'adaptive',preferredProvider:null}),
    bridge=createJobBridge({journalFile:f.state.engine.journalFile,eligibility:()=>({eligible:true})}),runtime=createEngineRuntime({...f,bridge,runtimeProfile:profile,eligibility:()=>({eligible:true})}),
    launched={id:'launched',kind:'backend.implement',attempt:1,status:'running',allowlist:['a.js']};
  assert.equal(runtime.reserveOperation(launched,{role:'implement',runtime:'gpt-5.6-sol',target:'gpt-5.6-sol'}).ok,true);launched.dispatch='ctx-launched';runtime.launched(launched);
  assert.equal(runtime.settled(launched,{workerOnly:true,reason:'confirmed worker stop'}).ok,true);
  let view=runtime.providerAdmissionView();assert.equal(view.providers.codex.used,0,'the stopped worker releases provider capacity');assert.equal(view.providers.codex.recentSettled,1,'its consumed service remains visible while the writer is retained');
  assert.equal(runtime.settled(launched,{status:'cancelled',reason:'confirmed stopped generation retirement'}).ok,true);
  view=runtime.providerAdmissionView();assert.equal(view.providers.codex.recentSettled,1,'final cancellation is the same launched service, not a second unit');
  const never={id:'never',kind:'backend.implement',attempt:1,status:'ready',allowlist:['a.js']};assert.equal(runtime.reserveOperation(never,{role:'implement',runtime:'gpt-5.6-sol',target:'gpt-5.6-sol'}).ok,true);
  assert.equal(runtime.settled(never,{status:'cancelled',reason:'admission ended before native launch'}).ok,true);assert.equal(runtime.providerAdmissionView().providers.codex.recentSettled,1,'never-launched cancellation adds no service');bridge.close();
});

test('a pure model job whose worker never started settles instead of fencing the generation for good, while a command job keeps its fence',t=>{
  const f=fixture(t),file=f.state.engine.journalFile;
  const bridge=createJobBridge({journalFile:file,eligibility:()=>({eligible:true}),
    spawnChild:()=>{throw Error('EPERM: the worker could not be spawned');}});
  // The spawn fails, so the job is effect_unknown with no answer and no staged result.
  bridge.request({workflowId:'wf',opId:'manager-1',attempt:1,generation:2,kind:'model',role:'decide',
    input:{handler:'model-function',functionName:'manageWorkflow',args:{providers:['gpt-5.6-sol']}}});
  const stranded=bridge.journal.listJobs().find(job=>job.op_id==='manager-1');
  assert.equal(stranded.status,'effect_unknown','a worker that never started leaves the job effect_unknown');
  assert.deepEqual(unsettledGenerationJobs({journalFile:file,workflowId:'wf',generation:2}),[stranded.job_id],'and it fences the generation');
  // A command job may have touched the tree, so it is never settled on this ground.
  bridge.journal.enqueueJob({jobId:'ran-a-command',workflowId:'wf',opId:'op',attempt:1,generation:2,kind:'check',role:'machine-check',payload:{command:'npm test'}});
  bridge.journal.db.prepare("UPDATE jobs SET status='effect_unknown' WHERE job_id='ran-a-command'").run();

  const settled=settleNeverStartedModelJobs({journalFile:file,workflowId:'wf',generation:2,now:()=>9});
  assert.deepEqual(settled,[stranded.job_id]);
  assert.equal(bridge.journal.getJob(stranded.job_id).status,'failed');
  assert.match(JSON.parse(bridge.journal.getJob(stranded.job_id).result_json).reason,/never started/);
  assert.equal(bridge.journal.getJob(stranded.job_id).lease_token,null,'settlement clears the durable lease token');
  assert.equal(bridge.journal.db.prepare('SELECT COUNT(*) AS n FROM leases WHERE job_id=?').get(stranded.job_id).n,0,
    'the failed spawn returns global capacity instead of merely changing job.status');
  assert.equal(bridge.journal.getJob('ran-a-command').status,'effect_unknown','a command job keeps its fence');
  assert.deepEqual(unsettledGenerationJobs({journalFile:file,workflowId:'wf',generation:2}),['ran-a-command']);
  assert.deepEqual(settleNeverStartedModelJobs({journalFile:file,workflowId:'wf',generation:2,now:()=>9}),[],'settling twice changes nothing');
  bridge.close();
});
test('missing model output is not proof of a never-started worker',t=>{
  const f=fixture(t),file=f.state.engine.journalFile;
  const bridge=createJobBridge({journalFile:file,eligibility:()=>({eligible:true}),
    spawnChild:()=>({pid:process.pid,once(){},unref(){}})});
  const request=opId=>bridge.request({workflowId:'wf',opId,attempt:1,generation:2,kind:'model',role:'decide',
    input:{handler:'model-function',functionName:'manageWorkflow',args:{providers:['gpt-5.6-sol']}}});
  for(const opId of ['spawned','unknown','bound'])request(opId);
  for(const job of bridge.journal.listJobs()){
    bridge.journal.db.prepare("UPDATE jobs SET status='effect_unknown' WHERE job_id=?").run(job.job_id);
    if(job.op_id!=='spawned')bridge.journal.db.prepare("DELETE FROM events WHERE entity_id=? AND kind='job-spawned'").run(job.job_id);
    if(job.op_id!=='unknown')bridge.journal.appendEvent({eventId:`${job.job_id}:spawn-failed`,workflowId:'wf',
      entityType:'job',entityId:job.job_id,generation:2,kind:'job-spawn-failed',payload:{reason:'late error'}});
    if(job.op_id==='bound')bridge.journal.db.prepare('UPDATE jobs SET worker_id=? WHERE job_id=?').run(`pid:${process.pid}`,job.job_id);
  }
  assert.deepEqual(settleNeverStartedModelJobs({journalFile:file,workflowId:'wf',generation:2}),[]);
  assert.equal(bridge.journal.listJobs().filter(job=>job.status==='effect_unknown'&&job.lease_token).length,3,
    'spawned, unobserved and bound jobs all retain their capacity until real reconciliation');
  bridge.close();
});
