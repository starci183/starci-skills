import {newToken} from './journal.mjs';

export const AI_JOB_KINDS=['model','operation','judge'];
const need=(ok,message)=>{if(!ok)throw Error(message);};

export function createJobs({journal,admission,now=Date.now}={}){
  need(journal?.transaction&&admission,'createJobs needs journal and admission');
  const create=spec=>journal.enqueueJob(spec);
  const claim=(job,{resources=[],budgets=[],ttlMs=60000}={})=>admission.reserve({jobId:job.job_id??job.jobId,workflowId:job.workflow_id??job.workflowId,opId:job.op_id??job.opId??null,attempt:job.attempt,generation:job.generation,resources,budgets,ttlMs});
  return {
    create,
    claimNext({workerId,kinds=null,eligibility=null,resourcesFor=()=>[],budgetsFor=()=>[],ttlMs=60000}={}){
      const candidates=journal.listJobs({status:'queued'}).filter(job=>!kinds||kinds.includes(job.kind));
      for(const job of candidates){
        if(AI_JOB_KINDS.includes(job.kind)&&typeof eligibility!=='function')throw Error(`Model eligibility is required to claim ${job.kind} job ${job.job_id}`);
        if(eligibility&&!eligibility(job).eligible)continue;
        const result=claim(job,{resources:resourcesFor(job),budgets:budgetsFor(job),ttlMs});
        if(!result.ok)continue;
        journal.db.prepare("UPDATE jobs SET worker_id=?,status='running',updated_at=? WHERE job_id=? AND lease_token=?").run(workerId,now(),job.job_id,result.leaseToken);
        return {...journal.getJob(job.job_id),leaseToken:result.leaseToken};
      }
      return null;
    },
    heartbeat(identity,ttlMs){return admission.renew({...identity,ttlMs});},
    complete({jobId,workflowId,opId=null,attempt,generation,leaseToken,eventId=newToken(),result=null,status='succeeded'}){
      need(['succeeded','failed','cancelled','effect_unknown'].includes(status),'Invalid terminal job status');
      return journal.transaction(db=>{
        const job=db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
        const existing=db.prepare('SELECT * FROM events WHERE event_id=?').get(eventId);if(existing&&existing.workflow_id===workflowId&&existing.entity_id===jobId&&existing.generation===generation)return {ok:true,duplicate:true,status:job?.status??status};
        if(!job||job.workflow_id!==workflowId||job.op_id!==opId||job.attempt!==attempt||job.generation!==generation||job.lease_token!==leaseToken)return {ok:false,reason:'stale fence'};
        for(const row of db.prepare('SELECT scope_key,units FROM budget_reservations WHERE job_id=?').all(jobId))db.prepare('UPDATE budgets SET reserved_value=MAX(0,reserved_value-?),used_value=used_value+? WHERE scope_key=?').run(row.units,row.units,row.scope_key);
        db.prepare('DELETE FROM budget_reservations WHERE job_id=?').run(jobId);
        db.prepare('DELETE FROM leases WHERE job_id=? AND token=?').run(jobId,leaseToken);
        const at=now();db.prepare('UPDATE jobs SET status=?,result_json=?,lease_token=NULL,deadline=NULL,updated_at=? WHERE job_id=?').run(status,JSON.stringify(result),at,jobId);
        db.prepare('INSERT INTO events(event_id,workflow_id,entity_type,entity_id,generation,kind,payload_json,created_at) VALUES(?,?,?,?,?,?,?,?)').run(eventId,workflowId,'job',jobId,generation,`job-${status}`,JSON.stringify({opId,attempt,result}),at);
        return {ok:true,duplicate:false,status};
      });
    },
    recoverExpired(){admission.expire();return journal.db.prepare("SELECT job_id FROM jobs WHERE status='effect_unknown' AND lease_token IS NOT NULL ORDER BY updated_at").all().map(row=>row.job_id);}
  };
}

export function createJobRunner({jobs,handlers,workerId=`runner-${process.pid}`,eligibility,resourcesFor=job=>AI_JOB_KINDS.includes(job.kind)?[{key:'ai/global',units:1}]:[]}={}){
  need(jobs&&handlers,'createJobRunner needs jobs and handlers');
  let stopped=false;
  return {
    stop(){stopped=true;},
    async runOne({kinds=null,ttlMs=60000}={}){
      if(stopped)return {status:'stopped'};
      const job=jobs.claimNext({workerId,kinds,eligibility,resourcesFor,ttlMs});
      if(!job)return {status:'idle'};
      const handler=handlers[job.kind];
      if(typeof handler!=='function')return jobs.complete({...job,jobId:job.job_id,workflowId:job.workflow_id,opId:job.op_id,leaseToken:job.leaseToken,status:'failed',result:{reason:`No handler for ${job.kind}`}});
      try{const result=await Promise.resolve().then(()=>handler(job,{heartbeat:ms=>jobs.heartbeat({jobId:job.job_id,generation:job.generation,leaseToken:job.leaseToken},ms)}));return jobs.complete({jobId:job.job_id,workflowId:job.workflow_id,opId:job.op_id,attempt:job.attempt,generation:job.generation,leaseToken:job.leaseToken,status:'succeeded',result});}
      catch(error){return jobs.complete({jobId:job.job_id,workflowId:job.workflow_id,opId:job.op_id,attempt:job.attempt,generation:job.generation,leaseToken:job.leaseToken,status:'failed',result:{reason:String(error?.message??error)}});}
    }
  };
}
