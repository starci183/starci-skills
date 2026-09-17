import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {ledgerFileFor,machineFileFor,openLedger,openMachine} from '../kernel/ledger-db.mjs';
import {stateGoalIdentity} from '../kernel/store.mjs';

const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
/** The §4 event chain: digest = sha256((prev_digest ?? '') + event_id + kind + payload_json + created_at). */
const eventDigest=(prev,row)=>digest(`${prev??''}${row.event_id}${row.kind}${row.payload_json}${row.created_at}`);
const EVENT_META=new Set(['at','seq','event','kind','event_id','eventId','entity_type','entityType','entity_id','entityId',
  'generation','created_at','createdAt','payload','payload_json','digest','prev_digest']);
const json=value=>JSON.stringify(value??null);

/**
 * One temp world for a ledger-backed spec: a repo root that owns `.starciwork/`, the ledger opened on it,
 * and a machine DB inside the same temp root. `process.env.LOCALAPPDATA` is repointed at the temp root for
 * the test's duration so no code path can reach the real machine arbiter; the after hook restores it,
 * closes both handles and removes the tree.
 *
 *   withLedger(t,({repoRoot,ledger,machine,ledgerFile,machineFile})=>{ ... });
 */
export function withLedger(t,fn){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-ledger-'));
  const repoRoot=path.join(root,'repo');
  fs.mkdirSync(path.join(repoRoot,'.starciwork'),{recursive:true});
  const machineHome=path.join(root,'machine');
  fs.mkdirSync(machineHome,{recursive:true});
  const ledgerFile=ledgerFileFor(repoRoot),machineFile=machineFileFor({LOCALAPPDATA:machineHome});
  const ledger=openLedger({file:ledgerFile}),machine=openMachine({file:machineFile});
  const saved=process.env.LOCALAPPDATA;
  process.env.LOCALAPPDATA=machineHome;
  t.after(()=>{
    if(saved===undefined)delete process.env.LOCALAPPDATA;else process.env.LOCALAPPDATA=saved;
    try{ledger.close();}catch{}
    try{machine.close();}catch{}
    fs.rmSync(root,{recursive:true,force:true});
  });
  return fn({root,repoRoot,machineHome,ledger,machine,ledgerFile,machineFile});
}

/**
 * Seed one workflow's rows into an open ledger. `state` becomes the bound-generation snapshot;
 * `events` accept today's events.jsonl line shape (`{at,seq,event,...fields}`) or the row shape
 * (`{kind,entityType,entityId,generation,payload}`); `jobs` take today's field names; `leases` need only
 * `{resourceKey,jobId,units}` - the job's identity fields are mirrored so `leases_match_job` cannot fire.
 * Returns the inserted row counts.
 */
export function seedWorkflow(ledger,{id,state=null,events=[],jobs=[],leases=[],goal=null,signals=[],generation=null,goalIdentity=null,now=ledger.now??Date.now}){
  const db=ledger.db,at=typeof now==='function'?now():now;
  const gen=generation??state?.engine?.generation??1,identity=goalIdentity??(state?stateGoalIdentity(state):digest(id));
  ledger.transaction(inner=>{
    inner.prepare(`INSERT OR IGNORE INTO workflows(workflow_id,title,created_at,updated_at,generation,goal_identity,phase)
      VALUES(?,?,?,?,?,?,?)`).run(id,state?.job??null,at,at,gen,identity,state?.phase??null);
    if(state)inner.prepare(`INSERT INTO state_snapshots(checkpoint_id,workflow_id,generation,goal_identity,state_json,created_at)
      VALUES(?,?,?,?,?,?)`).run(`seed:${id}:${gen}:${digest(json(state)).slice(0,16)}`,id,gen,identity,json(state),at);
    if(goal)inner.prepare(`INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)`)
      .run(id,goal.revision??1,goal.identity??identity,goal.markdown??'',json(goal.json??goal),at);
    let prev=null;
    for(const [index,event] of events.entries()){
      const kind=event.kind??event.event;
      const payload=event.payload_json!==undefined?event.payload_json
        :event.payload!==undefined?json(event.payload)
        :json(Object.fromEntries(Object.entries(event).filter(([key])=>!EVENT_META.has(key))));
      const row={event_id:event.event_id??event.eventId??`seed:${id}:${index}:${digest(`${kind}${payload}`).slice(0,12)}`,
        workflow_id:id,generation:event.generation??gen,entity_type:event.entity_type??event.entityType??'workflow',
        entity_id:event.entity_id??event.entityId??id,kind,payload_json:payload,created_at:event.created_at??event.createdAt??event.at??at};
      row.prev_digest=prev;row.digest=eventDigest(prev,row);
      inner.prepare(`INSERT INTO events(event_id,workflow_id,generation,entity_type,entity_id,kind,payload_json,prev_digest,digest,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?)`).run(row.event_id,row.workflow_id,row.generation,row.entity_type,row.entity_id,row.kind,row.payload_json,row.prev_digest,row.digest,row.created_at);
      prev=row.digest;
    }
    for(const job of jobs){
      inner.prepare(`INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,priority_json,
        lease_token,worker_id,deadline,result_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(job.jobId??job.job_id,id,job.opId??job.op_id??null,job.attempt??1,job.generation??gen,job.kind??'operation',job.role??null,
          json(job.payload),job.status??'queued',json(job.priority),job.leaseToken??job.lease_token??null,job.workerId??job.worker_id??null,
          job.deadline??null,json(job.result),job.createdAt??job.created_at??at,job.updatedAt??job.updated_at??at);
    }
    for(const lease of leases){
      const jobId=lease.jobId??lease.job_id,job=inner.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
      if(!job)throw Error(`seedWorkflow lease names job ${jobId}, which was not seeded`);
      inner.prepare(`INSERT INTO leases(resource_key,job_id,workflow_id,op_id,attempt,generation,token,units,acquired_at,expires_at,machine_ref)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
        .run(lease.resourceKey??lease.resource_key,jobId,job.workflow_id,job.op_id,job.attempt,job.generation,job.lease_token,
          lease.units??1,lease.acquiredAt??lease.acquired_at??at,lease.expiresAt??lease.expires_at??at+60000,lease.machineRef??lease.machine_ref??null);
    }
    for(const signal of signals){
      inner.prepare(`INSERT OR REPLACE INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES(?,?,?,?,?,?,?)`)
        .run(signal.scope??id,signal.key,signal.pid??signal.holder_pid??null,signal.token??null,
          signal.value_json??json(signal.value),signal.at??at,signal.expiresAt??signal.expires_at??null);
    }
  });
  return {id,generation:gen,goalIdentity:identity,events:events.length,jobs:jobs.length,leases:leases.length};
}
