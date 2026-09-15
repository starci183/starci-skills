import crypto from 'node:crypto';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {openJournal} from './journal.mjs';
import {createAdmission,GLOBAL_AI_RESOURCE} from './admission.mjs';
import {hasReplayableStagedResult} from './job-worker.mjs';

export const JOB_PENDING='starci/job-pending@1';
export const isJobPending=value=>value?.schema===JOB_PENDING&&value.pending===true;
export function jobPendingError(value){const error=Error(`Durable job ${value?.identity?.jobId??'unknown'} is ${value?.status??'pending'}`);error.code='STARCI_JOB_PENDING';error.job=value;return error;}
const here=path.dirname(fileURLToPath(import.meta.url));
const canonical=value=>{if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));return value;};
export const inputDigest=input=>crypto.createHash('sha256').update(JSON.stringify(canonical(input))).digest('hex');
export const bridgeJobId=({workflowId,opId,attempt,generation,kind,input})=>`bridge-${inputDigest({workflowId,opId,attempt,generation,kind,input}).slice(0,32)}`;

export function createJobBridge({journalFile,now=Date.now,spawnChild=spawn,workerFile=path.join(here,'job-worker.mjs'),eligibility,beforeSpawn=null}={}){
  const journal=openJournal({file:journalFile,now}),admission=createAdmission({journal,now});
  const request=({workflowId,opId=null,attempt=1,generation=1,jobId=null,kind,input,role=null,ttlMs=15*60*1000,resources=null})=>{
    const identity={workflowId,opId,attempt,generation,jobId:jobId??bridgeJobId({workflowId,opId,attempt,generation,kind,input})};
    const existing=journal.getJob(identity.jobId);
    if(existing){
      if(existing.workflow_id!==workflowId||existing.op_id!==opId||existing.attempt!==attempt||existing.generation!==generation||inputDigest(existing.payload)!==inputDigest(input))throw Error(`Bridge job identity collision for ${identity.jobId}`);
      if(['succeeded','failed','cancelled'].includes(existing.status))return {pending:false,identity,status:existing.status,result:existing.result};
      if(existing.status==='effect_unknown'&&hasReplayableStagedResult(journal.path,existing)){
        const claimed=journal.db.prepare("UPDATE jobs SET status='running',worker_id=?,updated_at=? WHERE job_id=? AND status='effect_unknown' AND lease_token=?").run('completion-replay-pending',now(),identity.jobId,existing.lease_token);
        if(claimed.changes===1){let replay;try{replay=spawnChild(process.execPath,[workerFile,journal.path,identity.jobId,existing.lease_token],{detached:true,stdio:'ignore',windowsHide:true});}catch(error){journal.db.prepare("UPDATE jobs SET status='effect_unknown',worker_id=NULL,updated_at=? WHERE job_id=? AND lease_token=?").run(now(),identity.jobId,existing.lease_token);journal.appendEvent({eventId:`${identity.jobId}:completion-replay-spawn-failed`,workflowId,entityType:'job',entityId:identity.jobId,generation,kind:'job-completion-replay-spawn-failed',payload:{reasonDigest:inputDigest(String(error?.message??error))}});return {schema:JOB_PENDING,pending:true,identity,status:'effect_unknown'};}replay.once?.('error',()=>{try{journal.db.prepare("UPDATE jobs SET status='effect_unknown',worker_id=NULL,updated_at=? WHERE job_id=? AND lease_token=?").run(now(),identity.jobId,existing.lease_token);}catch{}});replay.unref();journal.appendEvent({eventId:`${identity.jobId}:completion-replay-spawned`,workflowId,entityType:'job',entityId:identity.jobId,generation,kind:'job-completion-replay-spawned',payload:{pid:replay.pid??null}});}
        return {schema:JOB_PENDING,pending:true,identity,status:'running'};
      }
      if(existing.status!=='queued')return {schema:JOB_PENDING,pending:true,identity,status:existing.status};
    }
    const ai=['model','operation','judge'].includes(kind);
    if(ai){if(typeof eligibility!=='function')throw Error(`Model eligibility is required for bridge job ${identity.jobId}`);const decision=eligibility({kind,role,input,...identity});if(!decision?.eligible)return {schema:JOB_PENDING,pending:true,identity,status:'deferred',reasons:decision?.reasons??['model ineligible']};}
    if(!existing)journal.enqueueJob({...identity,kind,role,payload:input});
    const reserved=admission.reserve({...identity,resources:resources??(ai?[{key:GLOBAL_AI_RESOURCE,units:1}]:[]),ttlMs});
    if(!reserved.ok)return {schema:JOB_PENDING,pending:true,identity,status:'deferred',reasons:reserved.reasons};
    if(beforeSpawn){let admitted;try{admitted=beforeSpawn({job:journal.getJob(identity.jobId),identity,leaseToken:reserved.leaseToken,journal});}catch(error){admitted={ok:false,reason:String(error?.message??error)};}if(admitted?.ok===false){admission.release({...identity,leaseToken:reserved.leaseToken});journal.db.prepare("UPDATE jobs SET status='cancelled',result_json=?,updated_at=? WHERE job_id=?").run(JSON.stringify({reason:admitted.reason??admitted.code??'pre-spawn admission rejected'}),now(),identity.jobId);journal.appendEvent({eventId:`${identity.jobId}:admission-rejected`,workflowId,entityType:'job',entityId:identity.jobId,generation,kind:'job-admission-rejected',payload:admitted});return {pending:false,identity,status:'cancelled',result:{reason:admitted.reason??admitted.code??'pre-spawn admission rejected'}};}}
    let child;
    try{child=spawnChild(process.execPath,[workerFile,journal.path,identity.jobId,reserved.leaseToken],{detached:true,stdio:'ignore',windowsHide:true});}
    catch(error){journal.db.prepare("UPDATE jobs SET status='effect_unknown',deadline=NULL,updated_at=? WHERE job_id=? AND lease_token=?").run(now(),identity.jobId,reserved.leaseToken);journal.appendEvent({eventId:`${identity.jobId}:spawn-failed`,workflowId,entityType:'job',entityId:identity.jobId,generation,kind:'job-spawn-failed',payload:{reason:String(error?.message??error)}});return {schema:JOB_PENDING,pending:true,identity,status:'effect_unknown'};}
    child.once?.('error',error=>{try{journal.db.prepare("UPDATE jobs SET status='effect_unknown',deadline=NULL,updated_at=? WHERE job_id=? AND lease_token=?").run(now(),identity.jobId,reserved.leaseToken);journal.appendEvent({eventId:`${identity.jobId}:spawn-failed`,workflowId,entityType:'job',entityId:identity.jobId,generation,kind:'job-spawn-failed',payload:{reason:String(error?.message??error)}});}catch{}});
    child.once?.('close',(status,signal)=>{try{journal.appendEvent({eventId:`${identity.jobId}:wrapper-closed`,workflowId,entityType:'job',entityId:identity.jobId,generation,kind:'job-wrapper-closed',payload:{pid:child.pid??null,status:Number.isInteger(status)?status:null,signal:signal??null}});}catch{}});child.unref();
    journal.appendEvent({eventId:`${identity.jobId}:spawned`,workflowId,entityType:'job',entityId:identity.jobId,generation,kind:'job-spawned',payload:{pid:child.pid}});
    return {schema:JOB_PENDING,pending:true,identity,status:'running'};
  };
  return {journal,admission,request,poll({jobId,workflowId,opId=null,attempt=1,generation=1}){const job=journal.getJob(jobId);if(!job||job.workflow_id!==workflowId||job.op_id!==opId||job.attempt!==attempt||job.generation!==generation)return null;return ['succeeded','failed','cancelled'].includes(job.status)?{pending:false,identity:{jobId,workflowId,opId,attempt,generation},status:job.status,result:job.result}:{schema:JOB_PENDING,pending:true,identity:{jobId,workflowId,opId,attempt,generation},status:job.status};},close(){journal.close();}};
}

export function replayModelFunction(bridge,functionName,args,identity,{admission=null,kind='model',role=functionName}={}){return bridge.request({...identity,kind,role,input:{handler:'model-function',functionName,args,...(admission?{admission}:{})}});}
export function replayCommandCheck(bridge,command,argsOrIdentity,identityOrOptions={},maybeOptions={}){const array=Array.isArray(argsOrIdentity),identity=array?identityOrOptions:argsOrIdentity,options=array?maybeOptions:identityOrOptions;return bridge.request({...identity,kind:'check',role:'machine-check',input:{handler:'command',...(array?{command,args:argsOrIdentity}:{shellCommand:command}),cwd:options.cwd,timeoutMs:options.timeoutMs??600000}});}
