import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {ledgerFileFor,openLedger} from '../../engine/db/ledger.mjs';
import {TEST_REGISTRY_ENV,openMachine} from '../../engine/db/machine.mjs';

const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
/* Keep a stable identity for fixture goals; the ledger no longer stores state snapshots. */
const stateGoalIdentity=state=>String(state?.goalDigest??state?.approval?.goalDigest??state?.approvalDigest??state?.goal?.digest??digest(json({job:state?.job??null,inputs:state?.inputs??state?.goal?.inputs??null,scope:state?.scope??state?.goal?.scope??null,definitionOfDone:state?.definitionOfDone??state?.goal?.definitionOfDone??null,ledgerMode:state?.ledgerMode??state?.goal?.ledgerMode??null})));
/** The §4 event chain: digest = sha256((prev_digest ?? '') + event_id + kind + payload_json + created_at). */
const eventDigest=(prev,row)=>digest(`${prev??''}${row.event_id}${row.kind}${row.payload_json}${row.created_at}`);
const EVENT_META=new Set(['at','seq','event','kind','event_id','eventId','entity_type','entityType','entity_id','entityId',
  'generation','created_at','createdAt','payload','payload_json','digest','prev_digest']);
const json=value=>JSON.stringify(value??null);

/**
 * A leaked ledger/store/machine sqlite handle holds its file open, which EPERMs a later `fs.rmSync` on
 * Windows (the cause s3 proved for `kernelMain`, and the same shape hit a dozen specs across this suite in
 * wave 2). `track(handle)` makes leaking one impossible: every tracked handle is closed, in reverse
 * acquisition order, before `t.after`'s own cleanup runs - close a `createStore()` result, a second
 * `openLedger`/`openMachine`/`inspectLedger` opened inside a test, anything shaped `{close()}`.
 *
 *   const track=trackHandles(t);
 *   const store=track(createStore({repoRoot,id}));
 *   const foreign=track(openLedger({file:otherFile}));
 */
export function trackHandles(t){
  const handles=[];
  t.after(()=>{for(const handle of handles.reverse())try{handle?.close();}catch{}});
  return handle=>{handles.push(handle);return handle;};
}

/**
 * `parentDir` places that world somewhere other than `os.tmpdir()`. A spec whose kernel path takes a
 * *relative* worktree (`path.relative(process.cwd(),state.worktree)`, refused when it is absolute) needs the
 * fixture on the same volume as the runtime checkout, because `path.relative` across two Windows drives can
 * only answer with an absolute path: pass `sameDriveTmp()`.
 *
 * One temp world for a ledger-backed spec: a repo root that owns `.starciwork/`, the ledger opened on it,
 * and a machine DB inside the same temp root. `process.env.LOCALAPPDATA` and the test registry
 * (`process.env.STARCI_TEST_MACHINE_FILE`, which machineFileFor honours first) are repointed at it for
 * the test's duration so no code path can reach the real machine arbiter; the after hook restores it,
 * closes both handles (and anything `track`ed) and removes the tree.
 *
 *   withLedger(t,({repoRoot,ledger,machine,ledgerFile,machineFile,track})=>{
 *     const store=track(createStore({repoRoot,id}));   // closed automatically, same as ledger/machine
 *   });
 */
/**
 * The temp base on the volume `process.cwd()` is on, for a fixture whose worktree a kernel path must name
 * RELATIVE to it (see `parentDir` below). `os.tmpdir()` is on another drive on this machine, and
 * `path.relative` across two Windows drives can only answer with an absolute path, which those paths refuse.
 * Never inside the runtime tree: `tests/engine-db/runtime-tree-hygiene.spec.mjs` enforces that.
 */
export const sameDriveTmp=()=>path.join(path.parse(process.cwd()).root,'starci-tmp');

/**
 * Resolve once `pid` has exited (true) or `timeoutMs` passed (false). A detached child a spec launched
 * through `api serve-ask` holds the fixture's ledger open until it exits, and it writes its last event
 * (`ask-serving-expired`) *before* `process.exit`: a spec that stops at that event lets `t.after`'s
 * `rmSync` race the child's handle and EPERM on Windows under full-suite load. Await the pid, not the event.
 */
export async function awaitExit(pid,{timeoutMs=30000}={}){
  const alive=()=>{try{process.kill(pid,0);return true;}catch(error){return error.code==='EPERM';}};
  const until=Date.now()+timeoutMs;
  while(alive()){if(Date.now()>=until)return false;await new Promise(res=>setTimeout(res,100));}
  return true;
}

export function withLedger(t,fn,{parentDir=os.tmpdir()}={}){
  fs.mkdirSync(parentDir,{recursive:true});
  const root=fs.mkdtempSync(path.join(parentDir,'starci-ledger-'));
  const repoRoot=path.join(root,'repo');
  fs.mkdirSync(path.join(repoRoot,'.starciwork'),{recursive:true});
  const machineHome=path.join(root,'machine');
  fs.mkdirSync(machineHome,{recursive:true});
  const saved=process.env.LOCALAPPDATA,savedRegistry=process.env[TEST_REGISTRY_ENV];
  const savedProjects=process.env.STARCI_PROJECTS_ROOT;
  process.env.LOCALAPPDATA=machineHome;
  process.env.STARCI_PROJECTS_ROOT=path.join(root,'projects');
  const machineFile=path.join(machineHome,'machine.sqlite');
  process.env[TEST_REGISTRY_ENV]=machineFile;
  const ledgerFile=ledgerFileFor(repoRoot);
  const machine=openMachine({file:machineFile}),ledger=openLedger({file:ledgerFile});
  const tracked=[];
  const track=handle=>{tracked.push(handle);return handle;};
  t.after(()=>{
    if(saved===undefined)delete process.env.LOCALAPPDATA;else process.env.LOCALAPPDATA=saved;
    if(savedRegistry===undefined)delete process.env[TEST_REGISTRY_ENV];else process.env[TEST_REGISTRY_ENV]=savedRegistry;
    if(savedProjects===undefined)delete process.env.STARCI_PROJECTS_ROOT;else process.env.STARCI_PROJECTS_ROOT=savedProjects;
    for(const handle of tracked.reverse())try{handle?.close();}catch{}
    try{ledger.close();}catch{}
    try{machine.close();}catch{}
    fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25});
  });
  return fn({root,repoRoot,machineHome,ledger,machine,ledgerFile,machineFile,track});
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
    const requestedPhase=state?.phase??'running';
    const hasOpJobs=jobs.some(job=>(job.kind??'op')!=='kernel');
    const initialPhase=hasOpJobs&&!['queued','running'].includes(requestedPhase)?'running':requestedPhase;
    const inserted=inner.prepare(`INSERT OR IGNORE INTO workflows(workflow_id,trace_id,title,created_at,updated_at,generation,goal_identity,phase)
      VALUES(?,?,?,?,?,?,?,?)`).run(id,digest(`trace:${id}`).slice(0,32),state?.job??null,at,at,gen,identity,initialPhase);
    if(inserted.changes)inner.prepare('INSERT INTO lifecycle_changes(workflow_id,from_phase,to_phase,by,reason,at) VALUES(?,NULL,?,?,?,?)')
      .run(id,initialPhase,'test-fixture','seed',at);
    if(goal)inner.prepare(`INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)`)
      .run(id,goal.revision??1,goal.identity??identity,goal.markdown??'',json(goal.json??goal),at);
    let prev=inner.prepare('SELECT digest FROM events WHERE workflow_id=? ORDER BY seq DESC LIMIT 1').get(id)?.digest??null;
    for(const [index,event] of events.entries()){
      const kind=event.kind??event.event;
      const payload=event.payload_json!==undefined?event.payload_json
        :event.payload!==undefined?json(event.payload)
        :json(Object.fromEntries(Object.entries(event).filter(([key])=>!EVENT_META.has(key))));
      const row={event_id:event.event_id??event.eventId??`seed:${id}:${index}:${digest(`${kind}${payload}`).slice(0,12)}`,
        workflow_id:id,generation:event.generation??gen,entity_type:event.entity_type??event.entityType??'workflow',
        entity_id:event.entity_id??event.entityId??id,kind,payload_json:payload,created_at:event.created_at??event.createdAt??event.at??at};
      row.prev_digest=prev;row.digest=eventDigest(prev,row);
      inner.prepare(`INSERT INTO events(event_id,workflow_id,generation,entity_type,entity_id,kind,payload_json,prev_digest,digest,occurred_at,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(row.event_id,row.workflow_id,row.generation,row.entity_type,row.entity_id,row.kind,row.payload_json,row.prev_digest,row.digest,
          event.occurred_at??event.occurredAt??row.created_at,row.created_at);
      prev=row.digest;
    }
    for(const job of jobs){
      const jobId=job.jobId??job.job_id,opId=job.opId??job.op_id??job.payload?.opId??null;
      const kind=job.kind==='kernel'?'kernel':'op',status=job.status??'queued';
      // Legacy fixture `attempt` named an observation; a new unit always starts at try 1.
      const tryNo=Math.max(1,job.tryNo??job.try_no??1),unitId=kind==='op'?(job.unitId??job.unit_id??jobId):null;
      const created=job.createdAt??job.created_at??at,updated=job.updatedAt??job.updated_at??created;
      const leaseToken=job.leaseToken??job.lease_token??leases.find(lease=>(lease.jobId??lease.job_id)===jobId)?.token??`seed:${jobId}`;
      if(unitId&&!inner.prepare('SELECT 1 FROM work_units WHERE workflow_id=? AND unit_id=?').get(id,unitId))
        inner.prepare(`INSERT INTO work_units(workflow_id,unit_id,op_id,subject_key,goal_revision,state,current_job_id,tries,created_at,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?)`).run(id,unitId,opId??'test.op',job.subjectKey??job.subject_key??unitId,
            job.goalRevision??job.goal_revision??goal?.revision??1,'queued',jobId,tryNo,created,updated);
      const needsAttempt=kind==='op'&&!['queued','ready','cancelled'].includes(status);
      const initialStatus=needsAttempt?'leased':status;
      inner.prepare(`INSERT INTO jobs(job_id,workflow_id,unit_id,op_id,try_no,retry_of,resume_of,generation,kind,role,payload_json,status,priority_json,
        lease_token,worker_id,deadline,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(jobId,id,unitId,opId,tryNo,job.retryOf??job.retry_of??null,job.resumeOf??job.resume_of??null,
          job.generation??gen,kind,job.role??null,json(job.payload??(kind==='op'?{opId,owned_paths:[]}:{})),initialStatus,json(job.priority),
          leaseToken,job.workerId??job.worker_id??null,job.deadline??null,created,updated);
      if(needsAttempt){
        const pool=job.pool??job.payload?.model??null;
        const agent=pool?String(pool).replace(/-agent$/,''):null;
        const result=job.result??(job.result_json?JSON.parse(job.result_json):null);
        const verdict=result?.verdict==='awaiting-owner'?'blocked':result?.verdict??null;
        const dispatched=job.dispatchedAt??job.dispatched_at??created;
        const settled=['succeeded','failed','awaiting_owner'].includes(status)?updated:null;
        inner.prepare(`INSERT INTO op_attempts(workflow_id,job_id,unit_id,op_id,try_no,dispatch_seq,dispatch_id,span_id,
          agent,model,pool,managed,run_id,task_id,terminal_handle,dispatched_at,started_at,settled_at,verdict,settle_json,end_state)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,jobId,unitId,opId??'test.op',tryNo,1,
            job.dispatchId??job.dispatch_id??`seed:${jobId}`,digest(`span:${jobId}`).slice(0,16),
            ['devin','codex','claude'].includes(agent)?agent:null,job.payload?.modelId??null,pool,
            job.payload?.managed?1:0,job.payload?.managed?.runId??null,job.payload?.managed?.taskId??null,
            job.terminalHandle??job.terminal_handle??job.payload?.managed?.agentTerminalHandle??job.payload?.orca?.agentTerminalHandle??null,
            dispatched,dispatched,settled,verdict,json(result),settled?'settled':null);
        for(const next of status==='leased'?[]:status==='running'?['running']:status==='answering'?['running','answering']:
          status==='reported'?['running','reported']:status==='deciding'?['running','reported','deciding']:
          status==='succeeded'?['running','reported','succeeded']:status==='failed'?['running','failed']:status==='awaiting_owner'?['running','reported','awaiting_owner']:
          status==='effect_unknown'?['running','effect_unknown']:[])
          inner.prepare('UPDATE jobs SET status=? WHERE job_id=?').run(next,jobId);
      }
      if(unitId)inner.prepare('UPDATE work_units SET state=?,done_at=?,updated_at=?,tries=max(tries,?),current_job_id=? WHERE workflow_id=? AND unit_id=?')
        .run(status==='succeeded'?'done':status==='failed'?'failed':status==='cancelled'?'dropped':
          status==='reported'?'reported':status==='deciding'||status==='awaiting_owner'?'deciding':status==='queued'||status==='ready'?'queued':'running',
          status==='succeeded'?updated:null,updated,tryNo,jobId,id,unitId);
    }
    for(const lease of leases){
      const jobId=lease.jobId??lease.job_id,job=inner.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
      if(!job)throw Error(`seedWorkflow lease names job ${jobId}, which was not seeded`);
      inner.prepare(`INSERT INTO leases(resource_key,job_id,workflow_id,op_id,try_no,generation,token,units,acquired_at,expires_at)
        VALUES(?,?,?,?,?,?,?,?,?,?)`)
        .run(lease.resourceKey??lease.resource_key,jobId,job.workflow_id,job.op_id,job.try_no,job.generation,job.lease_token,
          lease.units??1,lease.acquiredAt??lease.acquired_at??at,lease.expiresAt??lease.expires_at??at+60000);
    }
    for(const signal of signals){
      inner.prepare(`INSERT OR REPLACE INTO signals(scope,key,workflow_id,holder_pid,token,value_json,at,expires_at) VALUES(?,?,?,?,?,?,?,?)`)
        .run(signal.scope??'kernel',signal.key,id,signal.pid??signal.holder_pid??null,signal.token??null,
          signal.value_json??json(signal.value),signal.at??at,signal.expiresAt??signal.expires_at??null);
    }
    if(inserted.changes&&initialPhase!==requestedPhase){
      const phases=requestedPhase==='archived'?['finished','archived']:[requestedPhase];
      let from=initialPhase;
      for(const to of phases){
        inner.prepare('INSERT INTO lifecycle_changes(workflow_id,from_phase,to_phase,by,reason,at) VALUES(?,?,?,?,?,?)')
          .run(id,from,to,'test-fixture','seed',at);
        inner.prepare('UPDATE workflows SET phase=?,updated_at=? WHERE workflow_id=?').run(to,at,id);
        from=to;
      }
    }
  });
  return {id,generation:gen,goalIdentity:identity,events:events.length,jobs:jobs.length,leases:leases.length};
}
