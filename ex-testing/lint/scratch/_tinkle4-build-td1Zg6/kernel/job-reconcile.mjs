import {pidAlive as defaultPidAlive} from './loads.mjs';

export const PURE_MODEL_EXECUTION='starci/read-only-model-execution@1';
const pureModel=job=>job.kind==='model'&&job.payload?.execution?.schema===PURE_MODEL_EXECUTION
  &&job.payload.execution.readOnly===true&&job.payload.execution.toolsDisabled===true;

/**
 * Reconcile only processes the runtime owns and can prove gone. A model prompt is not assumed read-only: the
 * provider launch must have durably attested both a read-only sandbox and disabled tools. Everything else keeps
 * its lease/capacity and is surfaced for effect reconciliation.
 */
export function reconcilePureModelJobs({journal,admission,workflowId=null,generation=null,pidAlive=defaultPidAlive,now=Date.now}={}){
  const jobs=journal.listJobs().filter(job=>['leased','running','effect_unknown'].includes(job.status)&&job.lease_token
    &&(!workflowId||job.workflow_id===workflowId)&&(!Number.isInteger(generation)||job.generation===generation));
  const events=journal.events({workflowId}),spawned=new Map();for(const event of events)if(event.kind==='job-spawned'&&Number.isInteger(event.payload?.pid))spawned.set(event.entity_id,event.payload.pid);
  const result={settled:[],unknown:[],live:[]};
  for(const job of jobs){const pid=spawned.get(job.job_id);
    // Native Orca workers have dispatch identities, not child PIDs in this journal. Their host adapter owns
    // liveness; absence of a detached-process event is not evidence that a running native worker died.
    if(job.kind==='operation'){result.live.push({jobId:job.job_id,hostOwned:true,status:job.status,
      workerId:job.worker_id??null,reason:'native operation liveness belongs to its exact host Dispatch'});continue;}
    if(Number.isInteger(pid)&&pidAlive(pid)){result.live.push({jobId:job.job_id,pid});continue;}const reason=Number.isInteger(pid)?`owned process ${pid} is gone`:'owned spawn pid is unavailable';
    if(pureModel(job)&&Number.isInteger(pid)){
      if(job.status!=='effect_unknown')journal.db.prepare("UPDATE jobs SET status='effect_unknown',deadline=NULL,updated_at=? WHERE job_id=? AND lease_token=?").run(now(),job.job_id,job.lease_token);
      const settled=admission.settleUnknown({jobId:job.job_id,workflowId:job.workflow_id,opId:job.op_id,attempt:job.attempt,generation:job.generation,leaseToken:job.lease_token,status:'failed',result:{reason}});
      if(settled.ok){journal.appendEvent({eventId:`${job.job_id}:${job.generation}:dead-read-only-model`,workflowId:job.workflow_id,entityType:'job',entityId:job.job_id,generation:job.generation,kind:'dead-read-only-model-settled',payload:{pid,reason}});result.settled.push({jobId:job.job_id,pid});continue;}
    }
    if(job.status!=='effect_unknown')journal.db.prepare("UPDATE jobs SET status='effect_unknown',deadline=NULL,updated_at=? WHERE job_id=? AND lease_token=?").run(now(),job.job_id,job.lease_token);
    journal.appendEvent({eventId:`${job.job_id}:${job.generation}:reconciliation-required`,workflowId:job.workflow_id,entityType:'job',entityId:job.job_id,generation:job.generation,kind:'job-reconciliation-required',payload:{pid:pid??null,reason,jobKind:job.kind,readOnlyAttested:pureModel(job)}});
    result.unknown.push({jobId:job.job_id,pid:pid??null,kind:job.kind,reason});
  }
  return result;
}
