import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {bridgeJobId,createJobBridge,inputDigest} from './job-bridge.mjs';
import {hasReplayableStagedResult} from './job-worker.mjs';
import {createJobs} from './jobs.mjs';
import {rankJobs,updateProgressBudget,progressExhausted} from './scheduler.mjs';
import {ADAPTIVE_CAPACITY,OWNER_PREFERENCE_MULTIPLIER,loadRuntimes} from './schedule.mjs';
import {canonicalTarget} from './chains.mjs';
import {acknowledgeRuntimeBaseline,beginDetectionCandidate,candidateBindingWriterResource,candidateRecord,candidateWriterResource,freezeDetectionCandidate,maxConcurrentWriters,prepareCandidateDependencies,readCandidateBridge,readCandidatePacket,readCandidateSnapshot,scopeMatches} from './candidate-bridge.mjs';
import {candidateRootBindingDigest} from './candidate-roots.mjs';
import {normalizeResolvedReferences} from '../models/validator-transport.mjs';
import {reconcilePureModelJobs} from './job-reconcile.mjs';
import {openJournal} from './journal.mjs';
import {GLOBAL_AI_RESOURCE,createAdmission} from './admission.mjs';
import {resourceLocks} from './guards.mjs';
import {ENGINE_SCHEMA,isEnrolled,kindRole,predatesEngineSchema,sealedRuntimeOf} from './common.mjs';
import {nonOperationModels} from '../scripts/config.mjs';
import {budgetVerdict,readRuntimeBudget} from './budget.mjs';
import {loadsFileFor,pidAlive,readLoads} from './loads.mjs';
import {readDistJson} from '../core/runtime-root.mjs';

/** The engine version is the package version: one build, one name. */
export const ENGINE_VERSION=readDistJson('manifest.json').version;
export {ENGINE_SCHEMA,isEnrolled,predatesEngineSchema,sealedRuntimeOf};
export const isJobPending=error=>error?.code==='STARCI_JOB_PENDING';
export function deferJob(result){
  const error=new Error(result.reasons?.join('; ')||`Waiting for ${result.identity?.jobId??'durable job'}`);
  error.code='STARCI_JOB_PENDING';error.job=result;throw error;
}
/** The machine-local runtime root: the shared admission journal, candidates and probation ledgers live here. */
export const runtimeRootFor=(env=process.env)=>path.join(env.LOCALAPPDATA||path.join(os.homedir(),'.local','state'),'StarCi','runtime');
export const journalFileFor=(env=process.env)=>path.join(runtimeRootFor(env),'journal.sqlite');
const opIdentity=(state,op)=>({workflowId:state.id,opId:op?.id??null,attempt:op?.attempt??1,generation:state.engine.generation});
const modelInput=input=>{
  const copy=structuredClone(input);
  // Cooldown is a routing observation, not semantic input: changing it must not duplicate a durable job.
  delete copy.skip;
  if(copy.op)copy.op=Object.fromEntries(['id','kind','goal','attempt','acceptance','allowlist'].filter(key=>copy.op[key]!==undefined).map(key=>[key,copy.op[key]]));
  if(Array.isArray(copy.resolvedReferences)){const normalized=normalizeResolvedReferences(copy.resolvedReferences);copy.resolvedReferences=normalized.entries;copy.resolvedReferencesTruncated=normalized.truncated;copy.resolvedReferenceBytes=normalized.bytes;}
  return copy;
};
/** Release old-generation leases only after the native dispatches named by the caller were proven stopped. */
export function settleGenerationLeases({journalFile,leases=[],reason='fresh workflow generation after confirmed native stop'}={}){const journal=openJournal({file:journalFile}),admission=createAdmission({journal}),jobs=createJobs({journal,admission});try{return leases.map(lease=>jobs.complete({...lease,eventId:`${lease.jobId}:generation-settled`,status:'cancelled',result:{reason}}));}finally{journal.close();}}
/** Event kinds that prove a durable operation job reached a launch boundary or produced an effect. */
const OPERATION_EFFECT_EVENTS=new Set(['operation-launch-intent','operation-launched','operation-launch-observed','operation-worker-stopped','job-spawned','job-completion-replay-spawned','job-succeeded','job-failed']);
/**
 * A cancelled job that never held a lease and has no launch or effect receipt provably never ran: an aborted
 * retry leaves such rows behind, and the live operation re-derives their deterministic job id forever. Its id
 * may be re-keyed; a cancelled job WITH launch evidence keeps its fence for reconciliation instead.
 */
const neverLaunchedCancelledJob=(journal,job)=>job?.status==='cancelled'
  &&(journal.db.prepare('SELECT COUNT(*) AS n FROM leases WHERE job_id=?').get(job.job_id)?.n??0)===0
  &&!journal.events({workflowId:job.workflow_id}).some(event=>event.entity_id===job.job_id&&OPERATION_EFFECT_EVENTS.has(event.kind));
/**
 * Whether a lease an operation still carries is a stale field rather than a live reservation: the journal holds
 * neither the job nor a lease row for it, or holds the job in a terminal state with no lease row. The proof is the
 * journal's own answer, and the caller records it before clearing the field. A live or unknown lease answers null.
 */
export function staleLeaseProof({journalFile,lease}={}){
  if(!journalFile||!fs.existsSync(journalFile)||!lease?.jobId)return null;
  const journal=openJournal({file:journalFile});
  try{
    const job=journal.getJob(lease.jobId);
    const held=journal.transaction(db=>db.prepare('SELECT COUNT(*) AS n FROM leases WHERE job_id=?').get(lease.jobId)?.n??0);
    if(held>0)return null;
    if(!job)return `the journal holds neither job ${lease.jobId} nor a lease for it`;
    if(['succeeded','failed','cancelled'].includes(job.status))return `job ${lease.jobId} is ${job.status} and holds no lease`;
    return null;
  }finally{journal.close();}
}
/**
 * Move a workflow's journal binding: the former journal must hold nothing live of it. Its settled rows are then
 * retired there and the probation ledgers beside the former journal are copied beside the new one when the new
 * root has none. The state itself is bound to the new file by enrollment, not here.
 */
export function relocateJournal({from,to,workflowId}={}){
  const source=path.resolve(from),target=path.resolve(to);
  if(!fs.existsSync(source))return {ok:true,from:source,to:target,retired:null,copied:[],note:'the former journal does not exist'};
  const journal=openJournal({file:source});
  let retired;
  try{const live=journal.liveRows(workflowId);if(live.leases.length||live.jobs.length)return {ok:false,from:source,to:target,reason:`${live.leases.length} lease(s) and ${live.jobs.length} unsettled job(s) remain`,live};
    retired=journal.retireWorkflow(workflowId).removed??null;}
  finally{journal.close();}
  const copied=[];fs.mkdirSync(path.dirname(target),{recursive:true});
  for(const name of ['model-qualifications.json','model-probations.json']){const file=path.join(path.dirname(source),name),into=path.join(path.dirname(target),name);if(fs.existsSync(file)&&!fs.existsSync(into)){fs.copyFileSync(file,into);copied.push(name);}}
  return {ok:true,from:source,to:target,retired,copied};
}
/**
 * Recover a positively recorded launch failure, not an inferred absence of effects. A missing result does not
 * prove a model never ran: require a spawn-failed receipt, no spawned PID and no worker binding. Use admission's
 * transaction to settle the job together with its leases and budget reservations. Other unknown jobs retain
 * their fences and any staged result remains available for the normal completion replay. A `check` job may have
 * touched the tree, so it always keeps its fence until separately reconciled.
 */
export function settleNeverStartedModelJobs({journalFile,workflowId,generation,now=Date.now}={}){
  if(!journalFile||!fs.existsSync(journalFile))return [];
  const journal=openJournal({file:journalFile,now});
  try{
    const events=journal.events({workflowId});
    const stranded=journal.listJobs().filter(job=>job.workflow_id===workflowId&&job.generation===generation
      &&['model','judge'].includes(job.kind)&&job.status==='effect_unknown'&&job.lease_token&&!job.worker_id
      &&events.some(event=>event.entity_id===job.job_id&&event.generation===job.generation&&event.kind==='job-spawn-failed')
      &&!events.some(event=>event.entity_id===job.job_id&&event.generation===job.generation
        &&['job-spawned','job-completion-replay-spawned'].includes(event.kind)&&Number.isInteger(event.payload?.pid))
      &&!hasReplayableStagedResult(journal.path,job));
    if(!stranded.length)return [];
    const admission=createAdmission({journal,now});
    const settled=[];
    for(const job of stranded){
      const reason={reason:'the worker never started: spawn failed with no spawned PID, no worker binding and no staged result'};
      const result=admission.settleUnknown({jobId:job.job_id,generation:job.generation,
        leaseToken:job.lease_token,status:'failed',result:reason,
        event:{eventId:`${job.job_id}:never-started-settled`,workflowId,entityType:'job',entityId:job.job_id,
          generation,kind:'model-job-never-started',payload:reason}});
      if(result.ok)settled.push(job.job_id);
    }
    return settled;
  }finally{journal.close();}
}

/** Read-only retry fence: pure model and command jobs must settle in their current generation before it advances. */
export function unsettledGenerationJobs({journalFile,workflowId,generation}={}){
  if(!journalFile||!fs.existsSync(journalFile))return [];
  const journal=openJournal({file:journalFile});
  try{return journal.listJobs().filter(job=>job.workflow_id===workflowId&&job.generation===generation&&['model','judge','check'].includes(job.kind)&&!['succeeded','failed','cancelled'].includes(job.status)).map(job=>job.job_id);}
  finally{journal.close();}
}
/** Cancel only never-launched queued pure jobs, then report every job whose effect still needs settlement. */
export function prepareGenerationRetry({journalFile,workflowId,generation,now=Date.now,pidAliveFn=pidAlive}={}){
  if(!journalFile||!fs.existsSync(journalFile))return {cancelled:[],unsettled:[]};
  const neverStarted=settleNeverStartedModelJobs({journalFile,workflowId,generation,now});
  const journal=openJournal({file:journalFile,now});
  try{
    // A spawned model/judge/check job whose recorded processes are all gone cannot produce another byte: the
    // kernel that owned it died. The retiring generation settles it as cancelled with the dead-pid set as proof;
    // the row stays durable and replayable. A job that left a staged result is skipped - that evidence deserves
    // the replay path, not a quiet cancel.
    const pidsOf=new Map();
    for(const event of journal.events({workflowId})){
      const pid=event.kind==='job-spawned'?event.payload?.pid:event.kind==='job-wrapper-bound'?event.payload?.workerPid:event.kind==='job-nested-started'?event.payload?.nestedPid:null;
      if(Number.isInteger(pid)){const list=pidsOf.get(event.entity_id)??[];list.push(pid);pidsOf.set(event.entity_id,list);}
    }
    const deadSettled=[];
    const admission=createAdmission({journal,now});
    for(const job of journal.listJobs().filter(job=>job.workflow_id===workflowId&&job.generation===generation&&['model','judge','check'].includes(job.kind)&&!['succeeded','failed','cancelled'].includes(job.status))){
      const pids=pidsOf.get(job.job_id)??[];
      if(!pids.length||pids.some(pid=>pidAliveFn(pid))||hasReplayableStagedResult(journal.path,job))continue;
      if(job.lease_token){
        if(job.status!=='effect_unknown')journal.db.prepare("UPDATE jobs SET status='effect_unknown',deadline=NULL,updated_at=? WHERE job_id=? AND lease_token=?").run(now(),job.job_id,job.lease_token);
        const settled=admission.settleUnknown({jobId:job.job_id,generation:job.generation,leaseToken:job.lease_token,status:'cancelled',
          result:{reason:'the workflow retry proved every recorded process of this durable job is gone; the retiring generation cancels it'},
          event:{eventId:`${job.job_id}:${generation}:retry-dead-process`,workflowId,entityType:'job',entityId:job.job_id,generation,kind:'job-retry-dead-process',payload:{pids,jobKind:job.kind}}});
        if(settled.ok)deadSettled.push(job.job_id);
      }else{
        journal.db.prepare("UPDATE jobs SET status='cancelled',result_json=?,updated_at=? WHERE job_id=?").run(JSON.stringify({reason:'the workflow retry proved every recorded process of this durable job is gone; the retiring generation cancels it'}),now(),job.job_id);
        journal.appendEvent({eventId:`${job.job_id}:${generation}:retry-dead-process`,workflowId,entityType:'job',entityId:job.job_id,generation,kind:'job-retry-dead-process',payload:{pids,jobKind:job.kind}});
        deadSettled.push(job.job_id);
      }
    }
    const cancelled=journal.transaction(db=>{
            // Every generation up to this one: a queued job of a retired generation that never launched (no lease, no
      // receipt of any kind) would otherwise bind the workflow to its old journal for good and refuse the relocation.
      const rows=db.prepare("SELECT j.job_id FROM jobs j WHERE j.workflow_id=? AND j.generation<=? AND j.kind IN ('model','judge','check','operation') AND j.status='queued' AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.job_id=j.job_id) AND NOT EXISTS (SELECT 1 FROM events e WHERE e.workflow_id=j.workflow_id AND e.entity_type='job' AND e.entity_id=j.job_id) ORDER BY j.job_id").all(workflowId,generation);
      const stamp=now(),update=db.prepare("UPDATE jobs SET status='cancelled',result_json=?,updated_at=? WHERE job_id=? AND status='queued'"),event=db.prepare("INSERT OR IGNORE INTO events(event_id,workflow_id,entity_type,entity_id,generation,kind,payload_json,created_at) VALUES(?,?,?,?,?,?,?,?)");
      for(const row of rows){update.run(JSON.stringify({reason:'workflow retry cancelled a proven never-launched queued job'}),stamp,row.job_id);event.run(`${row.job_id}:retry-queued-cancelled`,workflowId,'job',row.job_id,generation,'job-retry-queued-cancelled',JSON.stringify({proof:'queued, unleased, and no job-spawned receipt'}),stamp);}
      return rows.map(row=>row.job_id);
    });
    const unsettled=journal.listJobs().filter(job=>job.workflow_id===workflowId&&job.generation===generation&&['model','judge','check'].includes(job.kind)&&!['succeeded','failed','cancelled'].includes(job.status)).map(job=>job.job_id);
    return {cancelled,unsettled,neverStarted,deadSettled};
  }finally{journal.close();}
}
const modelRole=name=>['critiqueGoal','validateOp','classifyScreen'].includes(name)?'verify':['assessGoal','planOp','presentOwnerQuestion'].includes(name)?'plan':'decide';
const configuredModelRole=name=>['assessGoal','planOp','presentOwnerQuestion'].includes(name)?'planner':['critiqueGoal','validateOp','classifyScreen'].includes(name)?'validator':'kernelManager';
const machineResource=key=>({key:`machine:${key}`,units:1});
/** Preserve pre-cooldown-fix durable identities; never relaunch a job just to normalize routing metadata. */
function legacyModelReplay({journal,state,name,base,bound}){
  const kind=name==='validateOp'?'judge':'model',role=modelRole(name),matches=[];
  for(const job of journal.listJobs()){
    if(job.workflow_id!==bound.workflowId||job.op_id!==bound.opId||job.attempt!==bound.attempt||job.generation!==bound.generation
      ||job.kind!==kind||job.role!==role||job.status==='queued'||job.payload?.functionName!==name||!Array.isArray(job.payload?.args?.skip))continue;
    const legacyBase={...base,skip:job.payload.args.skip},key=inputDigest({name,args:legacyBase,...bound}),saved=state.engine.modelSelections?.[key];
    if(!saved)continue;
    const input={handler:'model-function',functionName:name,args:{...legacyBase,providers:[saved.provider]},admission:{runtime:saved.runtime,mode:saved.mode}};
    if(inputDigest(input)!==inputDigest(job.payload)||bridgeJobId({...bound,kind,input})!==job.job_id)continue;
    matches.push({saved,selected:{args:input.args,runtime:{id:saved.runtime},decision:{mode:saved.mode},job:{kind,role}}});
  }
  if(matches.length>1)throw Error(`Multiple legacy durable ${name} jobs match this semantic call; reconcile their exact custody before continuing`);
  return matches[0]??null;
}
function eligibleModelSelection(name,args,eligibility,modelPolicy,runtimes=loadRuntimes(),identity={},budget=null,now=Date.now,providerAdmission={},cooling=[]){
  if(typeof eligibility!=='function')throw Error(`Model eligibility is required for ${name}`);
  const at=now(),role=modelRole(name),requested=Array.isArray(args?.providers)?args.providers:Object.keys(runtimes.runtimes??{});
  const job={kind:name==='validateOp'?'judge':'model',role,input:{functionName:name,args:modelInput(args)},...identity};
  const policyTargets=typeof modelPolicy?.providerFilter==='function'?new Set(modelPolicy.providerFilter(job).map(canonicalTarget)):null;
  const candidates=requested.map(id=>{const pool=canonicalTarget(id),def=runtimes.runtimes?.[pool];return {id,runtime:{id,pool,...def,model:def?.target}};}).filter(({runtime})=>runtime.target&&(runtime.roles??[]).includes(role)&&(!policyTargets||policyTargets.has(runtime.target)));
  const eligible=candidates.map((candidate,index)=>({...candidate,index,decision:eligibility(job,candidate.runtime),budget:budgetVerdict(candidate.runtime,budget,{now:at,requireFresh:true})})).filter(item=>item.decision?.eligible===true);
  const adaptive=runtimes.allocation?.policy===ADAPTIVE_CAPACITY,owner=runtimes.allocation?.ownerPolicy??{},preferred=owner.preferredProvider??null;
  const admitted=provider=>providerAdmission?.[provider]??null;
  const parked=new Set([...(Array.isArray(args?.skip)?args.skip.map(canonicalTarget):[]),...cooling.filter(item=>item.until>at).map(item=>canonicalTarget(item.runtime))]);
  const recentSettled=item=>{const starts=item.budget.windows.map(window=>Number.isFinite(window.resetsAt)&&Number.isFinite(window.minutes)?window.resetsAt-window.minutes*60_000:null).filter(Number.isFinite),since=Math.max(at-6*60*60*1000,...starts);
    return (admitted(item.runtime.provider)?.recentSettlements??[]).filter(entry=>entry.at>=since).length;};
  const available=eligible.filter(item=>!parked.has(canonicalTarget(item.id))&&item.budget.known&&!item.budget.exhausted&&(!admitted(item.runtime.provider)||admitted(item.runtime.provider).used<admitted(item.runtime.provider).capacity));
  if(adaptive)available.sort((a,b)=>{
    const score=item=>(item.budget.remaining/100)*(item.runtime.provider===preferred?(owner.preferenceMultiplier??OWNER_PREFERENCE_MULTIPLIER):1)
      /(1+(admitted(item.runtime.provider)?.used??0)+recentSettled(item));
    return score(b)-score(a)||b.budget.remaining-a.budget.remaining||a.index-b.index;
  });
  else available.sort((a,b)=>b.budget.remaining-a.budget.remaining||a.index-b.index);
  const providers=available.slice(0,1).map(item=>item.id);
  if(!providers.length){const quotaReady=eligible.filter(item=>item.budget.known&&!item.budget.exhausted),cooldownBlocked=quotaReady.length>0&&quotaReady.every(item=>parked.has(canonicalTarget(item.id))),capacityBlocked=quotaReady.length>0&&quotaReady.every(item=>{const view=admitted(item.runtime.provider);return view&&view.used>=view.capacity;});
    const error=Error(eligible.length?(cooldownBlocked?`Every eligible ${name} model with available quota is cooling`:capacityBlocked?`No eligible ${name} model has provider admission capacity`:quotaReady.length?`Eligible ${name} models are waiting for cooldown or provider admission capacity`:`No eligible ${name} model has known available provider quota`):`No evaluated model is eligible for ${name}`);
    if(eligible.length){error.code='STARCI_MODEL_QUOTA_WAIT';error.waitKind=cooldownBlocked?'provider-cooldown':capacityBlocked?'provider-capacity':quotaReady.length?'provider-availability':'provider-quota';error.reasons=eligible.map(item=>({runtime:item.id,known:item.budget.known,exhausted:item.budget.exhausted,until:item.budget.until,cooling:parked.has(canonicalTarget(item.id)),
      admitted:admitted(item.runtime.provider)?.used??null,capacity:admitted(item.runtime.provider)?.capacity??null}));}throw error;}
  const selected=available[0];return {args:{...modelInput(args),providers},runtime:selected.runtime,decision:selected.decision,job,
    considered:available.map(item=>({runtime:item.id,provider:item.runtime.provider,remaining:item.budget.remaining,active:admitted(item.runtime.provider)?.used??0,
      recentSettled:recentSettled(item),preferred:item.runtime.provider===preferred})),refused:candidates.filter(candidate=>!eligible.some(item=>item.id===candidate.id)).map(candidate=>candidate.id)};
}

/** Opt in only at a settled workflow boundary. Canonical Work and approved goal references stay intact. */
export function validateCandidateRoot(value){
  const supplied=String(value??'').trim();
  if(!supplied)return null;
  if(!path.isAbsolute(supplied)||/^[/\\]{2}/.test(supplied))throw Error('Candidate root must be an absolute local directory');
  const resolved=path.resolve(supplied);
  fs.mkdirSync(resolved,{recursive:true});
  const stat=fs.statSync(resolved);if(!stat.isDirectory())throw Error(`Candidate root is not a directory: ${resolved}`);
  fs.accessSync(resolved,fs.constants.W_OK);
  return fs.realpathSync(resolved);
}

export const candidateBaseFor=(state,explicit=null)=>explicit??path.join(state?.engine?.candidateRoot??path.join(path.dirname(state.engine.journalFile),'candidates'),state.id);

export function enrollEngine(store,state,{journalFile=journalFileFor(),runtimePin=null,candidateRoot=null,now=Date.now}={}){
  if(state.ops.some(op=>op.dispatch&&['running','answering'].includes(op.status)))throw Error('Settle live operation dispatches before enrolling a workflow in the durable engine');
  const previous=state.engine;
  state.engine={schema:ENGINE_SCHEMA,version:ENGINE_VERSION,generation:(previous?.generation??0)+1,journalFile:path.resolve(journalFile),
    assurance:'detection-only',coordination:'agent-v1',runtimePin:runtimePin??previous?.runtimePin??null,
    ...(candidateRoot??previous?.candidateRoot?{candidateRoot:path.resolve(candidateRoot??previous.candidateRoot)}:{}),enrolledAt:now()};
  state.finished=null;state.phase='run';
  store.appendEvent({event:'engine-enrolled',schema:ENGINE_SCHEMA,generation:state.engine.generation,version:ENGINE_VERSION,
    assurance:state.engine.assurance,coordination:state.engine.coordination,note:'Existing accepted Work remains accepted; only unfinished operations receive the new execution policy.'});
  store.saveState(state);
  return state.engine;
}

/** Runtime bridge used by the real kernel. The kernel remains the only workflow state writer. */
export function createEngineRuntime({store,state,now=Date.now,eligibility,modelPolicy=null,bridge=null,spawnChild=null,candidateBase=null,git=null,exec=null,modelBudget=null,modelCooling=null,runtimeProfile=null}={}){
  if(!isEnrolled(state))return null;
  const owned=!bridge;
  bridge??=createJobBridge({journalFile:state.engine.journalFile,now,...(spawnChild?{spawnChild}:{}),eligibility:job=>job.kind==='model'||job.kind==='judge'?{eligible:Array.isArray(job.input?.args?.providers)&&job.input.args.providers.length>0,reasons:['no evaluated provider in durable model job']}:{eligible:false,reasons:['operation eligibility must name its selected runtime']},beforeSpawn:({job})=>{const meta=job.payload?.admission;if(meta?.mode!=='probation')return {ok:true,code:'qualified'};const consumed=modelPolicy?.consumeProbation?.({kind:job.kind,role:job.role,input:job.payload,workflowId:job.workflow_id,opId:job.op_id,attempt:job.attempt,generation:job.generation,jobId:job.job_id},meta.runtime);if(!consumed?.ok)return {ok:false,code:consumed?.code??'probation-unavailable'};store.saveState(state);return consumed;}});
  const {journal,admission}=bridge,jobs=createJobs({journal,admission,now});
  runtimeProfile??=loadRuntimes();
  const providerResource=provider=>`ai/provider:${provider}`;
  // A provider family owns one concurrency ceiling. Adding another model name for the same account must not
  // manufacture more provider capacity, so the widest real runtime is the family ceiling instead of their sum.
  const providerCapacities={};for(const runtime of Object.values(runtimeProfile.runtimes??{})){if(!runtime?.provider)continue;providerCapacities[runtime.provider]=Math.max(providerCapacities[runtime.provider]??0,Math.max(0,Number(runtime.maxParallel??1)));}
  for(const [provider,capacity] of Object.entries(providerCapacities))admission.setCapacity(providerResource(provider),Math.max(0,capacity));
  const providerAdmissionView=()=>{
    // Expiry moves an unproved timed-out worker to effect_unknown and deliberately retains its lease. It also
    // clears residue only for already settled jobs, so this read never turns uncertainty into free capacity.
    admission.expire();
    const capacities=new Map(journal.db.prepare("SELECT resource_key,capacity FROM resources WHERE resource_key LIKE 'ai/provider:%' ORDER BY resource_key").all()
      .map(row=>[row.resource_key.slice('ai/provider:'.length),row.capacity]));
    const emptyProvider=(capacity=0)=>({capacity,used:0,jobs:[],recentSettled:0,recentNonOperationSettled:0,recentOperationSettled:0,recentSettlements:[]});
    const providers={};for(const [provider,capacity] of capacities)providers[provider]=emptyProvider(capacity);
    for(const row of journal.db.prepare("SELECT l.resource_key,l.units,j.job_id,j.workflow_id,j.op_id,j.kind,j.role,j.status,j.payload_json FROM leases l JOIN jobs j ON j.job_id=l.job_id WHERE l.resource_key LIKE 'ai/provider:%' ORDER BY l.resource_key,j.created_at,j.job_id").all()){
      const provider=row.resource_key.slice('ai/provider:'.length),entry=providers[provider]??=emptyProvider();
      let payload={};try{payload=JSON.parse(row.payload_json??'{}')??{};}catch{}
      entry.used+=row.units;entry.jobs.push({jobId:row.job_id,workflow:row.workflow_id,op:row.op_id,kind:row.kind,role:row.role,
        status:row.status,runtime:payload?.admission?.runtime??payload?.runtime??null,units:row.units});providers[provider]=entry;
    }
    // Completed and confirmed-stopped jobs no longer hold a provider lease, but they consumed provider service.
    // Immutable launch plus settlement receipts distinguish them from never-launched cancellation. A worker-only
    // stop is visible while writer custody remains, and later final settlement still counts the same job once.
    const since=now()-6*60*60*1000;
    for(const row of journal.db.prepare("SELECT j.kind,j.payload_json,(SELECT MAX(s.created_at) FROM events s WHERE s.workflow_id=j.workflow_id AND s.entity_id=j.job_id AND s.kind IN ('job-succeeded','job-failed','job-cancelled','operation-worker-stopped')) AS service_at FROM jobs j WHERE j.kind IN ('model','judge','operation') AND EXISTS (SELECT 1 FROM events l WHERE l.workflow_id=j.workflow_id AND l.entity_id=j.job_id AND l.kind IN ('job-spawned','operation-launched')) AND EXISTS (SELECT 1 FROM events s WHERE s.workflow_id=j.workflow_id AND s.entity_id=j.job_id AND s.kind IN ('job-succeeded','job-failed','job-cancelled','operation-worker-stopped') AND s.created_at>=?) ORDER BY service_at,j.job_id").all(since)){
      let payload={};try{payload=JSON.parse(row.payload_json??'{}')??{};}catch{}
      const runtime=payload?.admission?.runtime??payload?.runtime??null,provider=runtimeProfile.runtimes?.[canonicalTarget(runtime)]?.provider;
      if(!provider)continue;const entry=providers[provider]??=emptyProvider();
      entry.recentSettled+=1;entry.recentSettlements.push({at:row.service_at,kind:row.kind});if(row.kind==='operation')entry.recentOperationSettled+=1;else entry.recentNonOperationSettled+=1;
    }
    return {source:'sqlite-admission',providers};
  };
  // The per-repo writer pool is bounded, not exclusive: ops that run together already proved disjoint write
  // scopes at the launch fence, and freeze-time detection reclassifies their in-flight writes instead of
  // quarantining on them. `allocation.maxConcurrentWriters` overrides the default bound.
  const writerCapacity=maxConcurrentWriters(runtimeProfile);
  const writer=candidateWriterResource(state.worktree);admission.setCapacity(writer.key,writerCapacity);
  const declareMachineResources=value=>resourceLocks(value).map(machineResource).map(resource=>{admission.setCapacity(resource.key,1);return resource;});
  candidateBase=candidateBaseFor(state,candidateBase);
  const identity=op=>opIdentity(state,op);
  const unwrap=result=>{if(result?.pending)deferJob(result);if(result?.status!=='succeeded')throw Error(result?.result?.reason??`Durable job ${result?.status}`);return result.result;};
  const requestModel=(name,args,op=null)=>{args=Array.isArray(args?.providers)?args:{...args,providers:nonOperationModels(configuredModelRole(name))};const bound=identity(op),base=modelInput(args),selectionKey=inputDigest({name,args:base,...bound});state.engine.modelSelections??={};let saved=state.engine.modelSelections[selectionKey],selected;
    if(saved){const replayArgs={...base,providers:[saved.provider]},kind=name==='validateOp'?'judge':'model',role=modelRole(name),input={handler:'model-function',functionName:name,args:replayArgs,admission:{runtime:saved.runtime,mode:saved.mode}},jobId=bridgeJobId({...bound,kind,input}),existing=journal.getJob(jobId);if(existing&&existing.status!=='queued')selected={args:replayArgs,runtime:{id:saved.runtime},decision:{mode:saved.mode},job:{kind,role}};}
    if(!selected){const legacy=legacyModelReplay({journal,state,name,base,bound});if(legacy){saved=legacy.saved;selected=legacy.selected;}}
    if(!selected){const budget=typeof modelBudget==='function'?modelBudget():modelBudget??readRuntimeBudget(path.dirname(store.dir));
      const providerAdmission=providerAdmissionView().providers;
      const cooling=[...Object.entries(state.allocation?.cooling??{}),...Object.entries(readLoads({path:loadsFileFor(store.dir),workflow:state.id,now}).cooling)]
        .map(([runtime,value])=>({runtime,until:value?.until}));
      if(typeof modelCooling==='function')cooling.push(...modelCooling());
      selected=eligibleModelSelection(name,args,eligibility,modelPolicy,runtimeProfile,bound,budget,now,providerAdmission,cooling);saved={provider:selected.args.providers[0],runtime:selected.runtime.pool??selected.runtime.id,mode:selected.decision.mode??'qualified'};state.engine.modelSelections[selectionKey]=saved;
      store.appendEvent?.({event:'model-selected',function:name,op:bound.opId??null,runtime:saved.runtime,provider:saved.provider,mode:saved.mode,considered:selected.considered??[],refused:selected.refused??[]});store.saveState(state);}
    const kind=selected.job?.kind??(name==='validateOp'?'judge':'model'),role=selected.job?.role??modelRole(name),provider=runtimeProfile.runtimes?.[canonicalTarget(saved.runtime)]?.provider;
    const input={handler:'model-function',functionName:name,args:selected.args,admission:{runtime:saved.runtime,mode:saved.mode}};
    return unwrap(bridge.request({...bound,kind,role,input,resources:[{key:GLOBAL_AI_RESOURCE,units:1},...(provider?[{key:providerResource(provider),units:1}]:[])]}));};
  return {
    journal,admission,jobs,bridge,identity,requiredValidation:true,providerAdmissionView,writerCapacity,
    model:requestModel,
    manageWorkflow(snapshot,{providers=nonOperationModels('kernelManager')}={}){if(state.engine.coordination!=='agent-v1')throw Error('Agent-led coordination is not enrolled');return requestModel('manageWorkflow',{snapshot,providers},{id:snapshot.decisionId,attempt:1});},
    check(command,options={},op=null){const resources=declareMachineResources({kind:op?.kind,checks:[{command}],resources:options.resources});return unwrap(bridge.request({...identity(op),kind:'check',role:'machine-check',...(resources.length?{resources}:{}),input:{handler:'command',shellCommand:command,cwd:options.cwd??state.worktree,timeoutMs:options.timeoutMs??1800000,
      candidate:op?.candidateDigest??state.head??null,...(options.env?{env:options.env}:{})}}));},
    reserveOperation(op,allocated){
      // Each dispatch attempt owns a distinct durable job row. Rows cancelled before they ever launched (an
      // aborted retry's sweep proves this) must not trap the operation on their deterministic id: re-key.
      let dispatchAttempt=op.launchFailures??0,bound,existing,skipped=[];
      for(let guard=0;guard<64;guard++){
        bound={...identity(op),jobId:`operation-${inputDigest({...identity(op),dispatchAttempt}).slice(0,32)}`};
        existing=journal.getJob(bound.jobId);
        if(!existing||!neverLaunchedCancelledJob(journal,existing))break;
        skipped.push(existing.job_id);dispatchAttempt++;
      }
      if(skipped.length)journal.appendEvent({eventId:`${bound.jobId}:rekeyed`,workflowId:bound.workflowId,entityType:'job',entityId:bound.jobId,generation:bound.generation,kind:'operation-job-rekeyed',payload:{opId:bound.opId,attempt:bound.attempt,dispatchAttempt,skipped,proof:'predecessor rows were cancelled with no lease and no launch or effect receipt'}});
      const effectiveRole=allocated.role??kindRole(op.kind),job={kind:'operation',role:effectiveRole,input:{op,runtime:allocated.runtime,target:allocated.target},...bound};
      const probationJob={...bound,kind:op.kind,role:effectiveRole,input:{op}};
      const pool=runtimeProfile.runtimes?.[canonicalTarget(allocated.runtime)]??{};
      const bindings=op.candidateRootBindings?.bindings,rootWriters=Array.isArray(bindings)
        ?bindings.filter(binding=>binding.workerWritable||binding.runtimeWritable).map(candidateBindingWriterResource)
        :((op.allowlist??[]).length?[writer]:[]);
      for(const resource of rootWriters)admission.setCapacity(resource.key,writerCapacity);
      const provider=pool.provider,machineResources=declareMachineResources(op),resources=[{key:GLOBAL_AI_RESOURCE,units:1},...(provider?[{key:providerResource(provider),units:1}]:[]),...rootWriters,...machineResources]
        .sort((a,b)=>a.key.localeCompare(b.key));
      if(existing&&existing.lease_token&&['leased','running','effect_unknown'].includes(existing.status)){
        const rows=journal.db.prepare('SELECT resource_key,units,expires_at FROM leases WHERE job_id=? AND token=? ORDER BY resource_key').all(existing.job_id,existing.lease_token),expected=existing.payload?.expectedResources??[];
        const exact=existing.payload?.reservationProtocol==='intent-v1'&&rows.length>0&&rows.every(item=>Number.isFinite(item.expires_at)&&item.expires_at>now())&&JSON.stringify(rows.map(({resource_key,units})=>({resource_key,units})))===JSON.stringify([...expected].sort((a,b)=>a.key.localeCompare(b.key)).map(item=>({resource_key:item.key,units:item.units})));
        if(!exact)return {ok:false,reasons:['existing durable reservation resource binding is incomplete']};
        op.lease={...bound,leaseToken:existing.lease_token,machineResources:expected.map(item=>item.key).filter(key=>key.startsWith('machine:')),
          providerResource:expected.map(item=>item.key).find(key=>key.startsWith('ai/provider:'))??null,probationRuntime:existing.payload.runtime,probationRole:existing.role};
        return {ok:true,...bound,leaseToken:existing.lease_token,runtime:existing.payload.runtime,target:existing.payload.target,reattached:true};
      }
      // The model identity eligibility sees is the role's pinned model (what `allocate` selected), never the
      // pool's launch target - a pool alias like `codex-agent` is not a model and never matches probation or
      // qualification evidence, which the review pass keyed on the real role model.
      const admittedModel=allocated.model??pool.models?.[effectiveRole]??pool.target??allocated.target;
      const decision=eligibility?.(job,{id:allocated.runtime,...pool,model:admittedModel});
      if(!decision?.eligible)return {ok:false,reasons:decision?.reasons??['model eligibility unavailable']};
      journal.enqueueJob({...bound,kind:'operation',role:effectiveRole,payload:{runtime:allocated.runtime,target:allocated.target,kind:op.kind,reservationProtocol:'intent-v1',expectedResources:resources.map(item=>({key:item.key,units:item.units})).sort((a,b)=>a.key.localeCompare(b.key))}});
      const result=admission.reserve({...bound,resources,ttlMs:10*60*1000});
      if(result.ok&&decision.mode==='probation'){const consumed=modelPolicy?.consumeProbation?.(probationJob,{id:allocated.runtime,...pool,model:admittedModel});if(!consumed?.ok){admission.release({...bound,leaseToken:result.leaseToken});journal.db.prepare("UPDATE jobs SET status='cancelled',result_json=?,updated_at=? WHERE job_id=?").run(JSON.stringify({reason:consumed?.code??'probation-unavailable'}),now(),bound.jobId);return {ok:false,reasons:[consumed?.code??'probation-unavailable'],...bound};}}
      if(result.ok)op.lease={...bound,leaseToken:result.leaseToken,machineResources:machineResources.map(item=>item.key),providerResource:provider?providerResource(provider):null,probationRuntime:allocated.runtime,probationRole:effectiveRole};
      return {...result,...bound};
    },
    reservationPhase(op){
      const lease=op?.lease;if(!lease)return {phase:'absent'};
      const job=journal.getJob(lease.jobId),exact=job&&job.workflow_id===lease.workflowId&&job.op_id===lease.opId&&job.attempt===lease.attempt&&job.generation===lease.generation&&job.lease_token===lease.leaseToken;
      if(!exact||job.payload?.reservationProtocol!=='intent-v1')return {phase:'unknown',reason:'reservation is not bound to the intent-v1 protocol'};
      if(['cancelled','failed','succeeded'].includes(job.status))return {phase:'settled',status:job.status};
      if(job.status!=='leased')return {phase:'unknown',reason:`reservation durable status is ${job.status}`};
      const resources=journal.db.prepare('SELECT resource_key,units,expires_at FROM leases WHERE job_id=? AND token=? ORDER BY resource_key').all(lease.jobId,lease.leaseToken),expected=job.payload.expectedResources??[];
      const actualShape=resources.map(item=>({key:item.resource_key,units:item.units})),expectedShape=[...expected].sort((a,b)=>a.key.localeCompare(b.key));
      if(!resources.length||JSON.stringify(actualShape)!==JSON.stringify(expectedShape)||resources.some(resource=>!Number.isFinite(resource.expires_at)||resource.expires_at<=now()))return {phase:'unknown',reason:'reservation has no complete live expected resource binding'};
      const kinds=new Set(journal.events({workflowId:lease.workflowId}).filter(event=>event.entity_id===lease.jobId&&event.generation===lease.generation).map(event=>event.kind));
      const binding={runtime:job.payload.runtime,target:job.payload.target,role:job.role};
      if(kinds.has('operation-launched'))return {phase:'launched',...binding};
      if(kinds.has('operation-launch-intent'))return {phase:'effect-intent',...binding};
      return {phase:'reserved',...binding};
    },
    beginLaunchIntent(op){
      const phase=this.reservationPhase(op);if(phase.phase!=='reserved'){const error=Error(`Operation ${op.id} reservation cannot enter launch intent: ${phase.reason??phase.phase}`);error.effectState=op?.lease?'unknown':'none';throw error;}
      const lease=op.lease;journal.appendEvent({eventId:`${lease.jobId}:launch-intent`,workflowId:lease.workflowId,entityType:'job',entityId:lease.jobId,generation:lease.generation,kind:'operation-launch-intent',payload:{opId:lease.opId,attempt:lease.attempt}});
      return {phase:'effect-intent'};
    },
    recordLaunchObservation(op){
      const lease=op?.lease;if(!lease||!op.launch?.task||!op.launch?.dispatch)return {ok:false};
      journal.appendEvent({eventId:`${lease.jobId}:launch-observed:${op.launch.dispatch}`,workflowId:lease.workflowId,entityType:'job',entityId:lease.jobId,generation:lease.generation,kind:'operation-launch-observed',payload:{opId:lease.opId,attempt:lease.attempt,task:op.launch.task,dispatch:op.launch.dispatch}});
      return {ok:true};
    },
    refundUnbegunProbation(op,proof,identity=op.lease){
      if(!identity)return {ok:false,code:'probation-refund-job-identity-required'};
      const durable=journal.getJob(identity.jobId),payload=durable?.payload??{},runtimeId=payload.runtime??identity.probationRuntime??op.runtime,pool=runtimeProfile.runtimes?.[runtimeId]??{};
      const role=durable?.role??identity.probationRole??kindRole(op.kind),job={...identity,kind:op.kind,role,input:{op}};
      const journalBinding=durable?{source:'durable-journal',jobId:durable.job_id,workflowId:durable.workflow_id,opId:durable.op_id,generation:durable.generation,
        runtimeId:payload.runtime,role:durable.role,status:durable.status}:null,boundProof={...proof,runtimeId,role,...(journalBinding?{journalBinding}:{})};
      const result=modelPolicy?.refundProbation?.(job,{id:runtimeId,...pool,model:pool.target??op.target},boundProof)??{ok:false,code:'probation-refund-unavailable'};
      if(result.ok){store.saveState(state);journal.appendEvent({eventId:`${identity.jobId}:probation-refund:${proof.attestationId}`,workflowId:identity.workflowId,
        entityType:'job',entityId:identity.jobId,generation:identity.generation,kind:'probation-refunded',payload:{opId:identity.opId,runtimeId,attestationId:proof.attestationId,code:result.code}});}
      return result;
    },
    launched(op){
      if(!op.lease)return;
      journal.db.prepare("UPDATE jobs SET status='running',worker_id=?,updated_at=? WHERE job_id=? AND lease_token=?").run(op.dispatch,now(),op.lease.jobId,op.lease.leaseToken);
      journal.appendEvent({eventId:`${op.lease.jobId}:launched`,workflowId:state.id,entityType:'job',entityId:op.lease.jobId,generation:state.engine.generation,kind:'operation-launched',payload:{dispatch:op.dispatch,terminal:op.terminal}});
    },
    settled(op,{status='succeeded',reason='dispatch settlement confirmed',workerOnly=false}={}){
      if(!op.lease)return {ok:true,absent:true};
      const lease=op.lease,job=journal.getJob(lease.jobId);
      const exact=job&&job.workflow_id===lease.workflowId&&job.op_id===lease.opId
        &&job.attempt===lease.attempt&&job.generation===lease.generation&&job.kind==='operation';
      if(!exact)return {ok:false,reason:'operation settlement does not bind the exact durable job'};
      // The durable terminal transaction may have committed just before the workflow JSON save failed.
      // Recover that completed transition without changing its accepted outcome or reopening the operation.
      if(['succeeded','failed','cancelled'].includes(job.status)&&job.lease_token===null
        &&journal.db.prepare('SELECT COUNT(*) AS n FROM leases WHERE job_id=?').get(lease.jobId).n===0){
        delete op.lease;
        return {ok:true,duplicate:true,status:job.status};
      }
      if(job.lease_token!==lease.leaseToken)return {ok:false,reason:'stale operation settlement fence'};
      if(workerOnly){
        const heldProviders=journal.db.prepare("SELECT resource_key FROM leases WHERE job_id=? AND token=? AND resource_key LIKE 'ai/provider:%'").all(op.lease.jobId,op.lease.leaseToken).map(row=>row.resource_key);
        const releasable=new Set(['ai/global',...heldProviders,...(op.lease.machineResources??[])]);
        journal.transaction(db=>{const remove=db.prepare('DELETE FROM leases WHERE job_id=? AND token=? AND resource_key=?');for(const key of releasable)remove.run(op.lease.jobId,op.lease.leaseToken,key);});
        journal.appendEvent({eventId:`${op.lease.jobId}:worker-stopped`,workflowId:state.id,entityType:'job',entityId:op.lease.jobId,generation:state.engine.generation,kind:'operation-worker-stopped',payload:{reason,writerRetained:true}});
        return {ok:true,writerRetained:true};
      }
      const result=jobs.complete({...op.lease,eventId:`${op.lease.jobId}:settled`,status,result:{reason}});
      if(result.ok)delete op.lease;
      return result;
    },
    /**
     * Close one host-owned native attempt after settleDispatch proved its exact Dispatch has no live process.
     * Filesystem effects are not called absent: the launch candidate is frozen under the retained writer fence,
     * and its observed byte delta becomes the only baseline a fresh attempt may inherit.
     */
    settleStoppedOperation(op,{dispatch=op?.dispatch,settlement=null,reason='native worker stopped without a report',acceptedPreparedDecision=false,foreignAllowlists=[],concurrentScopes=[]}={}){
      const lease=op?.lease;if(!lease)return {ok:false,reason:'operation has no durable native lease'};
      const effectState=settlement?.effectState??'unknown';
      const preparedTakeover=acceptedPreparedDecision&&settlement?.schema==='starci/orca-user-takeover-settlement@1'&&
        settlement.dispatchId===dispatch&&settlement.dispatchStatus==='completed'&&settlement.workerState==='succeeded'&&settlement.workerStage==='settled'&&
        settlement.capabilityRevoked===true&&settlement.ownershipState==='user_owned';
      if((settlement?.schema!=='starci/orca-supervised-settlement@1'&&!preparedTakeover)||settlement.dispatchId!==dispatch||effectState!=='none')return {ok:false,effectState,reason:'typed host settlement did not prove this exact native process stopped'};
      let job=journal.getJob(lease.jobId),events=journal.events({workflowId:lease.workflowId});
      const attempts=Array.isArray(op?.launch?.attempts)?op.launch.attempts:[],candidate=op?.candidate?.identity,
        leaseRows=journal.db.prepare('SELECT resource_key,units FROM leases WHERE job_id=? AND token=? ORDER BY resource_key').all(lease.jobId,lease.leaseToken),
        expectedResources=[...(job?.payload?.expectedResources??[])].sort((a,b)=>a.key.localeCompare(b.key)),
        exactResources=leaseRows.length>0&&JSON.stringify(leaseRows.map(row=>({key:row.resource_key,units:row.units})))===JSON.stringify(expectedResources),
        intent=events.find(event=>event.entity_id===lease.jobId&&event.generation===lease.generation&&event.kind==='operation-launch-intent'
          &&event.payload?.opId===lease.opId&&event.payload?.attempt===lease.attempt),
        recoverable=job?.kind==='operation'&&job.workflow_id===lease.workflowId&&job.op_id===lease.opId&&job.attempt===lease.attempt&&job.generation===lease.generation
          &&['leased','effect_unknown'].includes(job.status)&&job.lease_token===lease.leaseToken&&exactResources&&!job.worker_id&&op?.launch?.ok===false&&typeof op.launch.task==='string'&&op.launch.task
          &&attempts.length===1&&attempts[0]?.dispatchId===dispatch&&attempts[0]?.effectState==='unknown'&&intent
          &&candidate?.workflowId===lease.workflowId&&candidate?.opId===lease.opId&&candidate?.attempt===lease.attempt
          &&candidate?.generation===lease.generation&&candidate?.jobId===lease.jobId;
      if(recoverable){
        const eventId=`${lease.jobId}:launch-reconciled:${dispatch}`;
        journal.transaction(db=>{const changed=db.prepare("UPDATE jobs SET worker_id=?,updated_at=? WHERE job_id=? AND lease_token=? AND status IN ('leased','effect_unknown') AND worker_id IS NULL").run(dispatch,now(),lease.jobId,lease.leaseToken).changes;
          if(changed===1)db.prepare('INSERT OR IGNORE INTO events(event_id,workflow_id,entity_type,entity_id,generation,kind,payload_json,created_at) VALUES(?,?,?,?,?,?,?,?)')
            .run(eventId,lease.workflowId,'job',lease.jobId,lease.generation,'operation-launch-reconciled',JSON.stringify({opId:lease.opId,attempt:lease.attempt,task:op.launch.task,dispatch,proof:'single persisted unknown-effect launch attempt plus exact typed host settlement'}),now());});
        job=journal.getJob(lease.jobId);events=journal.events({workflowId:lease.workflowId});
      }
      const exact=job&&job.kind==='operation'&&job.workflow_id===lease.workflowId&&job.op_id===lease.opId&&job.attempt===lease.attempt
        &&job.generation===lease.generation&&job.lease_token===lease.leaseToken&&job.worker_id===dispatch;
      const launched=events.some(event=>event.entity_id===lease.jobId&&event.generation===lease.generation&&['operation-launched','operation-launch-reconciled'].includes(event.kind)
        &&event.payload?.dispatch===dispatch);
      if(!exact||!launched||typeof dispatch!=='string'||!dispatch)return {ok:false,effectState:'unknown',reason:'host settlement is not bound to this exact durable Dispatch attempt'};
      op.workerSettled=true;
      const worker=this.settled(op,{workerOnly:true,reason:`${reason}; exact Dispatch ${dispatch} stopped`});
      if(!worker.ok)return {ok:false,effectState:'unknown',reason:'worker resources could not be settled'};
      let frozen;
      try{frozen=this.freezeCandidate(op,{reportedFiles:[],foreignAllowlists:[...foreignAllowlists,...concurrentScopes]});}
      catch(error){return {ok:false,effectState:'unknown',reason:`candidate freeze failed after native stop: ${String(error?.message??error)}`};}
      // `canonical-head-drift` alone is the ordinary residue of a stopped parallel attempt: a sibling commit
      // moved the canonical head, so this candidate's bytes can never be promoted - but the freeze already
      // proved every observed path is in-scope and attributable. A `pre-existing-user-work-modified` reason is
      // equally admissible when the freeze reports that file clean now: the uncommitted user bytes died with a
      // wiped worktree and the file equals HEAD again, so nothing attributable remains to launder. Preserve
      // the in-scope delta minus those user files as the next attempt's owned baseline, complete the durable
      // job and release the writer fence. Any violation reason (outside-allowlist, still-dirty baseline,
      // kernel-owned drift, binding drift) keeps the fence: those paths are never laundered into the retry
      // baseline.
      const sealReasons=[...(frozen.reasons??[])],cleanNow=new Set(frozen.cleanNow??[]),baselineTouched=new Set(frozen.baselineTouched??[]),
        unpromotableOnly=sealReasons.length>0&&sealReasons.every(reason=>{const text=String(reason);
          if(/(^|:)canonical-head-drift$/.test(text))return true;
          const match=text.match(/(^|:)pre-existing-user-work-modified:(.+)$/);return match!==null&&cleanNow.has(match[2]);});
      if(frozen.status!=='sealed'&&(!unpromotableOnly||acceptedPreparedDecision))
        return {ok:false,effectState:'unknown',reason:'candidate effects could not be sealed',pending:frozen};
      if(frozen.status!=='sealed'){
        const observed=[...new Set(frozen.observedFiles??[])].sort(),owned=observed.filter(file=>scopeMatches(file,op.allowlist??[])&&!baselineTouched.has(file));
        op.ownedBaselinePaths=owned;
        op.retryReconciled={schema:'starci/native-retry-reconciliation@1',jobId:lease.jobId,attempt:lease.attempt,generation:lease.generation,
          dispatch,observedFiles:owned,abandonedFiles:observed,abandonedReasons:sealReasons,candidateDigest:op.candidateDigest??null};
        journal.appendEvent({eventId:`${lease.jobId}:stopped-effects-abandoned`,workflowId:lease.workflowId,entityType:'job',entityId:lease.jobId,
          generation:lease.generation,kind:'operation-stopped-effects-abandoned',payload:{dispatch,reason,observedFiles:observed,ownedBaseline:owned,
            cleanedUserWork:[...cleanNow].sort(),unsealableReasons:sealReasons,candidateDigest:op.candidateDigest??null,historicalEffectState:observed.length?'partial':'none-observed'}});
        store.saveState(state);
        const completed=this.settled(op,{status:'failed',reason:`${reason}; worker stopped and its candidate is unpromotable (${sealReasons.join('; ')}); ${owned.length} in-scope path(s) preserved for a fresh attempt`});
        if(completed.ok)store.saveState(state);
        return completed.ok?{ok:true,effectState:'none',observedFiles:owned,abandonedFiles:observed,abandoned:true,candidateDigest:op.candidateDigest??null}:
          {ok:false,effectState:'unknown',reason:completed.reason??'durable native job could not be completed'};
      }
      const observed=[...new Set(frozen.observedFiles??[])].sort();
      if(acceptedPreparedDecision){
        if(observed.length)return {ok:false,effectState:'partial',reason:'prepared decision retry produced candidate changes that were never accepted',observedFiles:observed,candidateDigest:op.candidateDigest??null};
        const completed=this.settled(op,{status:'succeeded',reason:`${reason}; prepared decision retry stopped with no candidate changes`});
        return completed.ok?{ok:true,effectState:'none',observedFiles:[],candidateDigest:op.candidateDigest??null,acceptedPreparedDecision:true}:
          {ok:false,effectState:'unknown',reason:completed.reason??'prepared decision durable job could not be completed'};
      }
      op.ownedBaselinePaths=observed;
      op.retryReconciled={schema:'starci/native-retry-reconciliation@1',jobId:lease.jobId,attempt:lease.attempt,generation:lease.generation,
        dispatch,observedFiles:observed,candidateDigest:op.candidateDigest??null};
      journal.appendEvent({eventId:`${lease.jobId}:stopped-unreported-effects`,workflowId:lease.workflowId,entityType:'job',entityId:lease.jobId,
        generation:lease.generation,kind:'operation-stopped-effects-preserved',payload:{dispatch,reason,observedFiles:observed,
          candidateDigest:op.candidateDigest??null,historicalEffectState:observed.length?'partial':'none-observed'}});
      store.saveState(state);
      const completed=this.settled(op,{status:'failed',reason:`${reason}; worker stopped and ${observed.length} observed path(s) preserved for a fresh attempt`});
      if(completed.ok)store.saveState(state);
      return completed.ok?{ok:true,effectState:'none',observedFiles:observed,candidateDigest:op.candidateDigest??null}:{ok:false,effectState:'unknown',reason:completed.reason??'durable native job could not be completed'};
    },
    beginCandidate(op,{repoRoot=state.worktree,allowlist=op.allowlist??[],references=op.references??[],inputPaths=[],oraclePaths=[],ownedDirtyPaths=[],
      dependencyDigests={},environmentDigest=null,runtimeManagedFiles=[],dependencyInstall=null,dependencyRequired=false,roots=null,bindingDigest=null,
      foreignAllowlists=[],concurrentScopes=[]}={}){
      if(!git)throw Error('the candidate lifecycle requires the kernel Git adapter');
      const lease=op.lease;if(!lease)throw Error(`reserve ${op.id} before beginning its candidate`);
      if(op.candidate?.identity?.jobId===lease.jobId){const existing=this.candidateBridge(op),expected=bindingDigest??(roots?candidateRootBindingDigest(roots):null);
        if(expected&&existing.bindingDigest!==expected)throw Error(`candidate root binding changed for ${op.id}: expected ${expected}, recorded ${existing.bindingDigest??'legacy-single-root'}`);
        return existing;}
      delete op.candidate;delete op.candidateDigest;delete op.oracleDigest;
      const root=path.join(candidateBase,lease.jobId),bridgeRecord=beginDetectionCandidate({identity:{workflowId:lease.workflowId,opId:lease.opId,
        attempt:lease.attempt,generation:lease.generation,jobId:lease.jobId},repoRoot,workerRoot:path.join(root,'worker'),controlRoot:path.join(root,'control'),
        allowlist,references,inputPaths,oraclePaths,ownedDirtyPaths,dependencyDigests,environmentDigest,runtimeManagedFiles,dependencyInstall,dependencyRequired,
        maxWriters:writerCapacity,concurrentScopes:[...foreignAllowlists,...concurrentScopes],
        ...(roots?{roots,bindingDigest:bindingDigest??candidateRootBindingDigest(roots)}:{}),git,now});
      op.candidate=candidateRecord(bridgeRecord);return bridgeRecord;
    },
    /** The manifests of an operation's candidate, read from its control root: state keeps the record, not the bytes. */
    candidateBridge(op){if(typeof op?.candidate?.controlRoot!=='string')throw Error(`candidate ${op?.id} was not begun`);return readCandidateBridge(op.candidate.controlRoot);},
    candidateSnapshot(op){if(typeof op?.candidate?.controlRoot!=='string')throw Error(`candidate ${op?.id} was not begun`);return readCandidateSnapshot(op.candidate.controlRoot);},
    candidatePacket(op){if(op?.candidate?.status!=='sealed')throw Error(`candidate ${op?.id} is not sealed`);return readCandidatePacket(op.candidate.controlRoot);},
    candidateView(op){
      const bridge=this.candidateBridge(op),snapshot=bridge.snapshot,roots=bridge.schema==='starci/candidate-root-bridge@1'
        ?Object.fromEntries(bridge.roots.map(root=>{const binding=bridge.rootBindings.find(item=>item.id===root.id)??{};return [root.id,{...binding,...root,
          snapshot:root.bridge.snapshot,workerRoot:root.bridge.snapshot.workerRoot,baseRoot:root.bridge.snapshot.baseRoot,oracleRoot:root.bridge.snapshot.oracleRoot}];}))
        :{source:{id:'source',role:'source',repoRoot:bridge.repoRoot,snapshot,workerRoot:snapshot.workerRoot,baseRoot:snapshot.baseRoot,oracleRoot:snapshot.oracleRoot}};
      return {bridge,snapshot,roots,source:roots.source??Object.values(roots)[0],work:roots.work??roots.source??Object.values(roots)[0]};
    },
    freezeCandidate(op,{reportedFiles=[],requireReported=false,foreignAllowlists=[],concurrentScopes=[]}={}){
      if(op.candidate?.status==='sealed')return op.candidate;
      const frozen=freezeDetectionCandidate(this.candidateBridge(op),{git,reportedFiles,requireReported,
        foreignAllowlists:[...foreignAllowlists,...concurrentScopes],
        housekeeping:{workflowId:state.id,opId:op.id,dispatch:op.dispatch??op.launch?.dispatch??null},now});
      const {packet}=frozen;
      op.candidate={...op.candidate,status:frozen.status,observedFiles:[...(frozen.observedFiles??[])],assurance:frozen.assurance,
        concurrentWriterDrift:[...(frozen.concurrentWriterDrift??[])],baselineTouched:[...(frozen.baselineTouched??[])],cleanNow:[...(frozen.cleanNow??[])],
        reportDiagnostics:{unmatched:[...(frozen.reportDiagnostics?.unmatched??[])]},housekeepingObserved:[...(frozen.housekeepingObserved??[])],
        runtimeAcknowledgements:(frozen.runtimeAcknowledgements??[]).map(record=>({...record,paths:(record.paths??[]).map(item=>typeof item==='object'?{...item}:item)})),
        ...(frozen.observedByRoot?{observedByRoot:frozen.observedByRoot.map(item=>({...item}))}:{}),
        ...(frozen.roots?{roots:frozen.roots.map(root=>({id:root.id,role:root.role,repoRoot:root.repoRoot,status:root.status,
          acceptedHead:root.acceptedHead??null,candidateDigest:root.candidateDigest??null,snapshotDigest:root.snapshotDigest??null,
          oracleDigest:root.oracleDigest??null,observedFiles:(root.observedFiles??[]).map(item=>item.displayPath)}))}:{}),
        ...(frozen.status==='sealed'?{candidateDigest:packet.candidateDigest,oracleDigest:packet.oracleDigest,snapshotDigest:packet.snapshotDigest,sealedAt:packet.sealedAt,changed:packet.changes.length}:{reasons:[...(frozen.reasons??[])]})};
      if(frozen.status==='sealed'){op.candidateDigest=packet.candidateDigest;op.oracleDigest=packet.oracleDigest;}
      return op.candidate;
    },
    acknowledgeRuntimeWrites(op,paths){return acknowledgeRuntimeBaseline(this.candidateBridge(op),paths);},
    prepareCandidateDependencies(op){
      if(op.candidate?.status!=='sealed')throw Error(`seal candidate ${op.id} before preparing its dependency artifact`);
      if(!exec)throw Error('dependency preparation requires the kernel command adapter');
      const dependency=prepareCandidateDependencies(this.candidateBridge(op),{exec});op.candidate.dependency=dependency;return dependency;
    },
    candidateCwd(op){if(op.candidate?.status!=='sealed')throw Error(`candidate ${op.id} is not sealed`);return op.candidate.workerRoot;},
    candidateCheck(command,options={},op){
      const cwd=this.candidateCwd(op);return this.check(command,{...options,cwd,env:op.candidate?.dependency?.checkEnv},op);
    },
    pulse(){
      for(const op of state.ops)if(!op.lease){const adopted=journal.listJobs().filter(job=>job.kind==='operation'&&job.workflow_id===state.id&&job.op_id===op.id&&job.attempt===op.attempt&&job.generation===state.engine.generation&&job.lease_token&&['leased','running','effect_unknown'].includes(job.status)).at(-1);if(adopted){const machineResources=journal.db.prepare("SELECT resource_key FROM leases WHERE job_id=? AND token=? AND resource_key LIKE 'machine:%'").all(adopted.job_id,adopted.lease_token).map(row=>row.resource_key);op.lease={workflowId:state.id,opId:op.id,attempt:adopted.attempt,generation:adopted.generation,jobId:adopted.job_id,leaseToken:adopted.lease_token,machineResources};}}
      for(const op of state.ops)if(op.lease&&['running','answering'].includes(op.status))admission.renew({...op.lease,ttlMs:10*60*1000});
      admission.expire();
      const reconciled=reconcilePureModelJobs({journal,admission,workflowId:state.id,generation:state.engine.generation,now});
      for(const item of reconciled.unknown){
        state.engine.reconciliation??={};
        const key=item.jobId??item.job_id;
        if(key&&!state.engine.reconciliation[key]){
          state.engine.reconciliation[key]=item;
          store.appendEvent({event:'job-reconciliation-required',jobId:key,reason:item.reason??'The owned process ended without a conclusive effect receipt.'});
        }
      }
    },
    rank(ops){
      const all=new Map(state.ops.map(op=>[op.id,op]));
      const downstream=id=>state.ops.filter(op=>op.dependsOn?.includes(id)&&op.status!=='done');
      const depth=(id,seen=new Set())=>seen.has(id)?0:1+Math.max(0,...downstream(id).map(op=>depth(op.id,new Set([...seen,id]))));
      const queued=ops.map(op=>({...identity(op),jobId:op.id,kind:'operation',role:/verify|repair/.test(op.kind)?'review':op.kind,status:'queued',createdAt:op.createdAt??state.createdAt??now()}));
      return rankJobs({jobs:queued,now,graph:{criticalPath:job=>depth(job.opId),unlockCount:job=>downstream(job.opId).length},eligibility:()=>({eligible:true}),progress:{unverifiedCandidates:state.ops.filter(op=>op.pending).length}}).ranked.map(row=>all.get(row.job.opId));
    },
    incident(op,reason,findings){
      const fingerprint=inputDigest({reason,findings,head:state.head});
      const key=`${op.id}:${reason}`;
      state.engine.incidents??={};
      const current=state.engine.incidents[key]??{};
      // Repeated evidence is not progress. Changing runtime alone never resets this budget.
      const next=updateProgressBudget(current,{attempts:1,progressFingerprint:fingerprint});
      state.engine.incidents[key]=next;
      return {exhausted:progressExhausted(next,{attempts:6}),progress:next};
    },
    pending(){return journal.listJobs().some(job=>job.workflow_id===state.id&&job.generation===state.engine.generation&&['queued','leased','running','effect_unknown'].includes(job.status));},
    close(){if(owned)bridge.close();}
  };
}
