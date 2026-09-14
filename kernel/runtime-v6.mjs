import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {bridgeJobId,createJobBridge,inputDigest,replayModelFunction} from './job-bridge.mjs';
import {createJobs} from './jobs.mjs';
import {rankJobs,updateProgressBudget,progressExhausted} from './scheduler.mjs';
import {loadRuntimes} from './schedule.mjs';
import {acknowledgeRuntimeBaseline,beginDetectionCandidate,candidateWriterResource,freezeDetectionCandidate,prepareCandidateDependencies} from './candidate-bridge.mjs';
import {normalizeResolvedReferences} from '../models/validator-transport.mjs';
import {reconcilePureModelJobs} from './job-reconcile.mjs';
import {openJournal} from './journal.mjs';
import {createAdmission} from './admission.mjs';
import {resourceLocks} from './guards.mjs';
import {kindRole} from './common.mjs';
import {nonOperationModels} from '../scripts/config.mjs';
import {budgetVerdict,readRuntimeBudget} from './budget.mjs';

export const ENGINE_VERSION='1.0.0-alpha';
export const isV6=state=>state?.engine?.major===6;
export const isJobPending=error=>error?.code==='STARCI_JOB_PENDING';
export function deferJob(result){
  const error=new Error(result.reasons?.join('; ')||`Waiting for ${result.identity?.jobId??'durable job'}`);
  error.code='STARCI_JOB_PENDING';error.job=result;throw error;
}
export const journalFileFor=(env=process.env)=>path.join(env.LOCALAPPDATA||path.join(os.homedir(),'.local','state'),'StarCi','runtime-v6','journal.sqlite');
const opIdentity=(state,op)=>({workflowId:state.id,opId:op?.id??null,attempt:op?.attempt??1,generation:state.engine.generation});
const modelInput=input=>{
  const copy=structuredClone(input);
  if(copy.op)copy.op=Object.fromEntries(['id','kind','goal','attempt','acceptance','allowlist'].filter(key=>copy.op[key]!==undefined).map(key=>[key,copy.op[key]]));
  if(Array.isArray(copy.resolvedReferences)){const normalized=normalizeResolvedReferences(copy.resolvedReferences);copy.resolvedReferences=normalized.entries;copy.resolvedReferencesTruncated=normalized.truncated;copy.resolvedReferenceBytes=normalized.bytes;}
  return copy;
};
/** Release old-generation leases only after the native dispatches named by the caller were proven stopped. */
export function settleGenerationLeases({journalFile,leases=[],reason='fresh workflow generation after confirmed native stop'}={}){const journal=openJournal({file:journalFile}),admission=createAdmission({journal}),jobs=createJobs({journal,admission});try{return leases.map(lease=>jobs.complete({...lease,eventId:`${lease.jobId}:generation-settled`,status:'cancelled',result:{reason}}));}finally{journal.close();}}
/** Read-only retry fence: pure model and command jobs must settle in their current generation before it advances. */
export function unsettledGenerationJobs({journalFile,workflowId,generation}={}){
  if(!journalFile||!fs.existsSync(journalFile))return [];
  const journal=openJournal({file:journalFile});
  try{return journal.listJobs().filter(job=>job.workflow_id===workflowId&&job.generation===generation&&['model','judge','check'].includes(job.kind)&&!['succeeded','failed','cancelled'].includes(job.status)).map(job=>job.job_id);}
  finally{journal.close();}
}
/** Cancel only never-launched queued pure jobs, then report every job whose effect still needs settlement. */
export function prepareGenerationRetry({journalFile,workflowId,generation,now=Date.now}={}){
  if(!journalFile||!fs.existsSync(journalFile))return {cancelled:[],unsettled:[]};
  const journal=openJournal({file:journalFile,now});
  try{
    const cancelled=journal.transaction(db=>{
      const rows=db.prepare("SELECT j.job_id FROM jobs j WHERE j.workflow_id=? AND j.generation=? AND j.kind IN ('model','judge','check') AND j.status='queued' AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.job_id=j.job_id) AND NOT EXISTS (SELECT 1 FROM events e WHERE e.workflow_id=j.workflow_id AND e.entity_type='job' AND e.entity_id=j.job_id AND e.kind='job-spawned') ORDER BY j.job_id").all(workflowId,generation);
      const stamp=now(),update=db.prepare("UPDATE jobs SET status='cancelled',result_json=?,updated_at=? WHERE job_id=? AND status='queued'"),event=db.prepare("INSERT OR IGNORE INTO events(event_id,workflow_id,entity_type,entity_id,generation,kind,payload_json,created_at) VALUES(?,?,?,?,?,?,?,?)");
      for(const row of rows){update.run(JSON.stringify({reason:'workflow retry cancelled a proven never-launched queued job'}),stamp,row.job_id);event.run(`${row.job_id}:retry-queued-cancelled`,workflowId,'job',row.job_id,generation,'job-retry-queued-cancelled',JSON.stringify({proof:'queued, unleased, and no job-spawned receipt'}),stamp);}
      return rows.map(row=>row.job_id);
    });
    const unsettled=journal.listJobs().filter(job=>job.workflow_id===workflowId&&job.generation===generation&&['model','judge','check'].includes(job.kind)&&!['succeeded','failed','cancelled'].includes(job.status)).map(job=>job.job_id);
    return {cancelled,unsettled};
  }finally{journal.close();}
}
const modelRole=name=>['critiqueGoal','validateOp'].includes(name)?'verify':['assessGoal','planOp'].includes(name)?'plan':'decide';
const configuredModelRole=name=>['assessGoal','planOp'].includes(name)?'planner':['critiqueGoal','validateOp'].includes(name)?'validator':'kernelManager';
const machineResource=key=>({key:`machine:${key}`,units:1});
function eligibleModelSelection(name,args,eligibility,modelPolicy,runtimes=loadRuntimes(),identity={},budget=null,now=Date.now){
  if(typeof eligibility!=='function')throw Error(`Model eligibility is required for ${name}`);
  const role=modelRole(name),requested=Array.isArray(args?.providers)?args.providers:Object.keys(runtimes.runtimes??{});
  const job={kind:name==='validateOp'?'judge':'model',role,input:{functionName:name,args:modelInput(args)},...identity};
  const policyTargets=typeof modelPolicy?.providerFilter==='function'?new Set(modelPolicy.providerFilter(job)):null;
  const candidates=requested.map(id=>({id,runtime:{id,...runtimes.runtimes?.[id],model:runtimes.runtimes?.[id]?.target}})).filter(({runtime})=>runtime.target&&(runtime.roles??[]).includes(role)&&(!policyTargets||policyTargets.has(runtime.target)));
  const eligible=candidates.map((candidate,index)=>({...candidate,index,decision:eligibility(job,candidate.runtime),budget:budgetVerdict(candidate.runtime,budget,{now:now(),requireFresh:true})})).filter(item=>item.decision?.eligible===true);
  const available=eligible.filter(item=>item.budget.known&&!item.budget.exhausted).sort((a,b)=>b.budget.remaining-a.budget.remaining||a.index-b.index),providers=available.slice(0,1).map(item=>item.id);
  if(!providers.length){const error=Error(eligible.length?`No eligible ${name} model has known available provider quota`:`No evaluated model is eligible for ${name}`);if(eligible.length){error.code='STARCI_MODEL_QUOTA_WAIT';error.reasons=eligible.map(item=>({runtime:item.id,known:item.budget.known,exhausted:item.budget.exhausted,until:item.budget.until}));}throw error;}
  const selected=available[0];return {args:{...modelInput(args),providers},runtime:selected.runtime,decision:selected.decision,job};
}

/** Opt in only at a settled workflow boundary. Canonical Work and approved goal references stay intact. */
export function enrollV6(store,state,{journalFile=journalFileFor(),runtimePin=null,now=Date.now}={}){
  if(state.ops.some(op=>op.dispatch&&['running','answering'].includes(op.status)))throw Error('Settle live operation dispatches before enrolling a workflow in v6');
  const previous=state.engine;
  state.engine={major:6,version:ENGINE_VERSION,generation:(previous?.generation??0)+1,journalFile:path.resolve(journalFile),
    assurance:'detection-only',coordination:'agent-v1',runtimePin:runtimePin??previous?.runtimePin??null,enrolledAt:now()};
  state.finished=null;state.phase='run';
  store.appendEvent({event:'engine-enrolled',major:6,generation:state.engine.generation,version:ENGINE_VERSION,
    assurance:state.engine.assurance,coordination:state.engine.coordination,note:'Existing accepted Work remains accepted; only unfinished operations receive the new execution policy.'});
  store.saveState(state);
  return state.engine;
}

/** Runtime bridge used by the real kernel. The kernel remains the only workflow state writer. */
export function createV6Runtime({store,state,now=Date.now,eligibility,modelPolicy=null,bridge=null,spawnChild=null,candidateBase=null,git=null,exec=null,modelBudget=null}={}){
  if(!isV6(state))return null;
  const owned=!bridge;
  bridge??=createJobBridge({journalFile:state.engine.journalFile,now,...(spawnChild?{spawnChild}:{}),eligibility:job=>job.kind==='model'||job.kind==='judge'?{eligible:Array.isArray(job.input?.args?.providers)&&job.input.args.providers.length>0,reasons:['no evaluated provider in durable model job']}:{eligible:false,reasons:['operation eligibility must name its selected runtime']},beforeSpawn:({job})=>{const meta=job.payload?.admission;if(meta?.mode!=='probation')return {ok:true,code:'qualified'};const consumed=modelPolicy?.consumeProbation?.({kind:job.kind,role:job.role,input:job.payload,workflowId:job.workflow_id,opId:job.op_id,attempt:job.attempt,generation:job.generation,jobId:job.job_id},meta.runtime);if(!consumed?.ok)return {ok:false,code:consumed?.code??'probation-unavailable'};store.saveState(state);return consumed;}});
  const {journal,admission}=bridge,jobs=createJobs({journal,admission,now}),runtimeProfile=loadRuntimes();
  const writer=candidateWriterResource(state.worktree);admission.setCapacity(writer.key,1);
  const declareMachineResources=value=>resourceLocks(value).map(machineResource).map(resource=>{admission.setCapacity(resource.key,1);return resource;});
  candidateBase??=path.join(path.dirname(state.engine.journalFile),'candidates',state.id);
  const identity=op=>opIdentity(state,op);
  const unwrap=result=>{if(result?.pending)deferJob(result);if(result?.status!=='succeeded')throw Error(result?.result?.reason??`Durable job ${result?.status}`);return result.result;};
  const requestModel=(name,args,op=null)=>{args=Array.isArray(args?.providers)?args:{...args,providers:nonOperationModels(configuredModelRole(name))};const bound=identity(op),base=modelInput(args),selectionKey=inputDigest({name,args:base,...bound});state.engine.modelSelections??={};let saved=state.engine.modelSelections[selectionKey],selected;
    if(saved){const replayArgs={...base,providers:[saved.provider]},kind=name==='validateOp'?'judge':'model',role=modelRole(name),input={handler:'model-function',functionName:name,args:replayArgs,admission:{runtime:saved.runtime,mode:saved.mode}},jobId=bridgeJobId({...bound,kind,input}),existing=journal.getJob(jobId);if(existing&&existing.status!=='queued')selected={args:replayArgs,runtime:{id:saved.runtime},decision:{mode:saved.mode},job:{kind,role}};}
    if(!selected){const budget=typeof modelBudget==='function'?modelBudget():modelBudget??readRuntimeBudget(path.dirname(store.dir));selected=eligibleModelSelection(name,args,eligibility,modelPolicy,runtimeProfile,bound,budget,now);saved={provider:selected.args.providers[0],runtime:selected.runtime.id,mode:selected.decision.mode??'qualified'};state.engine.modelSelections[selectionKey]=saved;store.saveState(state);}
    return unwrap(replayModelFunction(bridge,name,selected.args,bound,{admission:{runtime:saved.runtime,mode:saved.mode},kind:selected.job?.kind??(name==='validateOp'?'judge':'model'),role:selected.job?.role??modelRole(name)}));};
  return {
    journal,admission,jobs,bridge,identity,requiredValidation:true,
    model:requestModel,
    manageWorkflow(snapshot,{providers=nonOperationModels('kernelManager')}={}){if(state.engine.coordination!=='agent-v1')throw Error('Agent-led coordination is not enrolled');return requestModel('manageWorkflow',{snapshot,providers},{id:snapshot.decisionId,attempt:1});},
    check(command,options={},op=null){const resources=declareMachineResources({kind:op?.kind,checks:[{command}],resources:options.resources});return unwrap(bridge.request({...identity(op),kind:'check',role:'machine-check',...(resources.length?{resources}:{}),input:{handler:'command',shellCommand:command,cwd:options.cwd??state.worktree,timeoutMs:options.timeoutMs??1800000,
      candidate:op?.v6CandidateDigest??state.head??null,...(options.env?{env:options.env}:{})}}));},
    reserveOperation(op,allocated){
      const bound={...identity(op),jobId:`operation-${inputDigest({...identity(op),dispatchAttempt:op.launchFailures??0}).slice(0,32)}`};
      const effectiveRole=allocated.role??kindRole(op.kind),job={kind:'operation',role:effectiveRole,input:{op,runtime:allocated.runtime,target:allocated.target},...bound};
      const probationJob={...bound,kind:op.kind,role:effectiveRole,input:{op}};
      const pool=runtimeProfile.runtimes?.[allocated.runtime]??{};
      const existing=journal.getJob(bound.jobId);
      const machineResources=declareMachineResources(op),resources=[{key:'ai/global',units:1},...((op.allowlist??[]).length?[writer]:[]),...machineResources];
      if(existing&&existing.lease_token&&['leased','running','effect_unknown'].includes(existing.status)){
        const rows=journal.db.prepare('SELECT resource_key,units,expires_at FROM leases WHERE job_id=? AND token=? ORDER BY resource_key').all(existing.job_id,existing.lease_token),expected=existing.payload?.expectedResources??[];
        const exact=existing.payload?.reservationProtocol==='intent-v1'&&rows.length>0&&rows.every(item=>Number.isFinite(item.expires_at)&&item.expires_at>now())&&JSON.stringify(rows.map(({resource_key,units})=>({resource_key,units})))===JSON.stringify([...expected].sort((a,b)=>a.key.localeCompare(b.key)).map(item=>({resource_key:item.key,units:item.units})));
        if(!exact)return {ok:false,reasons:['existing durable reservation resource binding is incomplete']};
        op.v6Lease={...bound,leaseToken:existing.lease_token,machineResources:expected.map(item=>item.key).filter(key=>key.startsWith('machine:')),probationRuntime:existing.payload.runtime,probationRole:existing.role};
        return {ok:true,...bound,leaseToken:existing.lease_token,runtime:existing.payload.runtime,target:existing.payload.target,reattached:true};
      }
      const decision=eligibility?.(job,{id:allocated.runtime,...pool,model:pool.target??allocated.target});
      if(!decision?.eligible)return {ok:false,reasons:decision?.reasons??['model eligibility unavailable']};
      journal.enqueueJob({...bound,kind:'operation',role:effectiveRole,payload:{runtime:allocated.runtime,target:allocated.target,kind:op.kind,reservationProtocol:'intent-v1',expectedResources:resources.map(item=>({key:item.key,units:item.units})).sort((a,b)=>a.key.localeCompare(b.key))}});
      const result=admission.reserve({...bound,resources,ttlMs:10*60*1000});
      if(result.ok&&decision.mode==='probation'){const consumed=modelPolicy?.consumeProbation?.(probationJob,{id:allocated.runtime,...pool,model:pool.target??allocated.target});if(!consumed?.ok){admission.release({...bound,leaseToken:result.leaseToken});journal.db.prepare("UPDATE jobs SET status='cancelled',result_json=?,updated_at=? WHERE job_id=?").run(JSON.stringify({reason:consumed?.code??'probation-unavailable'}),now(),bound.jobId);return {ok:false,reasons:[consumed?.code??'probation-unavailable'],...bound};}}
      if(result.ok)op.v6Lease={...bound,leaseToken:result.leaseToken,machineResources:machineResources.map(item=>item.key),probationRuntime:allocated.runtime,probationRole:effectiveRole};
      return {...result,...bound};
    },
    reservationPhase(op){
      const lease=op?.v6Lease;if(!lease)return {phase:'absent'};
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
      const phase=this.reservationPhase(op);if(phase.phase!=='reserved'){const error=Error(`Operation ${op.id} reservation cannot enter launch intent: ${phase.reason??phase.phase}`);error.effectState=op?.v6Lease?'unknown':'none';throw error;}
      const lease=op.v6Lease;journal.appendEvent({eventId:`${lease.jobId}:launch-intent`,workflowId:lease.workflowId,entityType:'job',entityId:lease.jobId,generation:lease.generation,kind:'operation-launch-intent',payload:{opId:lease.opId,attempt:lease.attempt}});
      return {phase:'effect-intent'};
    },
    recordLaunchObservation(op){
      const lease=op?.v6Lease;if(!lease||!op.launch?.task||!op.launch?.dispatch)return {ok:false};
      journal.appendEvent({eventId:`${lease.jobId}:launch-observed:${op.launch.dispatch}`,workflowId:lease.workflowId,entityType:'job',entityId:lease.jobId,generation:lease.generation,kind:'operation-launch-observed',payload:{opId:lease.opId,attempt:lease.attempt,task:op.launch.task,dispatch:op.launch.dispatch}});
      return {ok:true};
    },
    refundUnbegunProbation(op,proof,identity=op.v6Lease){
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
      if(!op.v6Lease)return;
      journal.db.prepare("UPDATE jobs SET status='running',worker_id=?,updated_at=? WHERE job_id=? AND lease_token=?").run(op.dispatch,now(),op.v6Lease.jobId,op.v6Lease.leaseToken);
      journal.appendEvent({eventId:`${op.v6Lease.jobId}:launched`,workflowId:state.id,entityType:'job',entityId:op.v6Lease.jobId,generation:state.engine.generation,kind:'operation-launched',payload:{dispatch:op.dispatch,terminal:op.terminal}});
    },
    settled(op,{status='succeeded',reason='dispatch settlement confirmed',workerOnly=false}={}){
      if(!op.v6Lease)return {ok:true,absent:true};
      if(workerOnly){
        const releasable=new Set(['ai/global',...(op.v6Lease.machineResources??[])]);
        journal.transaction(db=>{const remove=db.prepare('DELETE FROM leases WHERE job_id=? AND token=? AND resource_key=?');for(const key of releasable)remove.run(op.v6Lease.jobId,op.v6Lease.leaseToken,key);});
        journal.appendEvent({eventId:`${op.v6Lease.jobId}:worker-stopped`,workflowId:state.id,entityType:'job',entityId:op.v6Lease.jobId,generation:state.engine.generation,kind:'operation-worker-stopped',payload:{reason,writerRetained:true}});
        return {ok:true,writerRetained:true};
      }
      const result=jobs.complete({...op.v6Lease,eventId:`${op.v6Lease.jobId}:settled`,status,result:{reason}});
      if(result.ok)delete op.v6Lease;
      return result;
    },
    beginCandidate(op,{repoRoot=state.worktree,allowlist=op.allowlist??[],references=op.references??[],inputPaths=[],oraclePaths=[],ownedDirtyPaths=[],
      dependencyDigests={},environmentDigest=null,dependencyInstall=null}={}){
      if(!git)throw Error('v6 candidate lifecycle requires the kernel Git adapter');
      const lease=op.v6Lease;if(!lease)throw Error(`reserve ${op.id} before beginning its candidate`);
      if(op.v6Candidate?.bridge?.identity?.jobId===lease.jobId)return op.v6Candidate.bridge;
      delete op.v6Candidate;delete op.v6CandidateDigest;delete op.v6OracleDigest;
      const root=path.join(candidateBase,lease.jobId),bridgeRecord=beginDetectionCandidate({identity:{workflowId:lease.workflowId,opId:lease.opId,
        attempt:lease.attempt,generation:lease.generation,jobId:lease.jobId},repoRoot,workerRoot:path.join(root,'worker'),controlRoot:path.join(root,'control'),
        allowlist,references,inputPaths,oraclePaths,ownedDirtyPaths,dependencyDigests,environmentDigest,dependencyInstall,git,now});
      op.v6Candidate={status:'running',bridge:bridgeRecord};return bridgeRecord;
    },
    freezeCandidate(op,{reportedFiles=[]}={}){
      if(op.v6Candidate?.status==='sealed')return op.v6Candidate;
      if(!op.v6Candidate?.bridge)throw Error(`candidate ${op.id} was not begun`);
      const frozen=freezeDetectionCandidate(op.v6Candidate.bridge,{git,reportedFiles,now});
      op.v6Candidate={...op.v6Candidate,...frozen};
      if(frozen.status==='sealed'){op.v6CandidateDigest=frozen.packet.candidateDigest;op.v6OracleDigest=frozen.packet.oracleDigest;}
      return op.v6Candidate;
    },
    acknowledgeRuntimeWrites(op,paths){if(!op.v6Candidate?.bridge)throw Error(`candidate ${op.id} was not begun`);return acknowledgeRuntimeBaseline(op.v6Candidate.bridge,paths);},
    prepareCandidateDependencies(op){
      if(op.v6Candidate?.status!=='sealed')throw Error(`seal candidate ${op.id} before preparing its dependency artifact`);
      if(!exec)throw Error('v6 dependency preparation requires the kernel command adapter');
      const dependency=prepareCandidateDependencies(op.v6Candidate.bridge,{exec});op.v6Candidate.dependency=dependency;return dependency;
    },
    candidateCwd(op){if(op.v6Candidate?.status!=='sealed')throw Error(`candidate ${op.id} is not sealed`);return op.v6Candidate.snapshot.workerRoot;},
    candidateCheck(command,options={},op){
      const cwd=this.candidateCwd(op);return this.check(command,{...options,cwd,env:op.v6Candidate?.dependency?.checkEnv},op);
    },
    pulse(){
      for(const op of state.ops)if(!op.v6Lease){const adopted=journal.listJobs().filter(job=>job.kind==='operation'&&job.workflow_id===state.id&&job.op_id===op.id&&job.attempt===op.attempt&&job.generation===state.engine.generation&&job.lease_token&&['leased','running','effect_unknown'].includes(job.status)).at(-1);if(adopted){const machineResources=journal.db.prepare("SELECT resource_key FROM leases WHERE job_id=? AND token=? AND resource_key LIKE 'machine:%'").all(adopted.job_id,adopted.lease_token).map(row=>row.resource_key);op.v6Lease={workflowId:state.id,opId:op.id,attempt:adopted.attempt,generation:adopted.generation,jobId:adopted.job_id,leaseToken:adopted.lease_token,machineResources};}}
      for(const op of state.ops)if(op.v6Lease&&['running','answering'].includes(op.status))admission.renew({...op.v6Lease,ttlMs:10*60*1000});
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
      return rankJobs({jobs:queued,now,graph:{criticalPath:job=>depth(job.opId),unlockCount:job=>downstream(job.opId).length},eligibility:()=>({eligible:true}),progress:{unverifiedCandidates:state.ops.filter(op=>op.v6Pending).length}}).ranked.map(row=>all.get(row.job.opId));
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
