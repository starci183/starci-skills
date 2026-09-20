import fs from 'node:fs';
import path from 'node:path';
import {repositoryRoot} from './reports.mjs';
import crypto from 'node:crypto';
import {configuredProgressDebug,configuredProgressLanguage,createProgressReporter} from './progress.mjs';
import {checkpointLedger,compactSnapshots,eventsHead,inspectLedger,ledgerFileFor,newToken,openLedger,writeAnchor} from './ledger-db.mjs';

/**
 * Runtime state of a 5.0 workflow. Everything a workflow needs to continue lives in one ledger —
 * `<repo>/.starciwork/runtime.sqlite` (schema `starci/ledger-db@1`): `events` is the hash-chained
 * audit trail, `state_snapshots` the recovery state, and goals, reports, contracts, checks, inbox
 * and signals are tables beside them. `.starciwork/_local` is never written or read here; it is an
 * import source for `ledger-migrate` and an optional export target for `workflow-export` only.
 * The one file that legitimately stays on disk is the continuation projection `workflows/<id>.md`,
 * in the repository, acknowledged through `acknowledgeRuntimeFile`.
 */
export const WORKFLOW_STATE='starci/workflow-state@1';
export const RUNTIME_FILE_WRITE='starci/runtime-file-write@1';

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const need=(condition,message)=>{if(!condition)throw Error(message);};
const required=(value,label)=>{need(typeof value==='string'&&value.trim(),`Missing ${label}`);return value.trim();};
const slash=value=>String(value??'').replaceAll('\\','/');
const stamp=ms=>{const iso=new Date(ms).toISOString();return [iso.slice(0,10).replaceAll('-',''),iso.slice(11,19).replaceAll(':','')];};
const json=value=>JSON.stringify(value??null);
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const digest=value=>sha256(JSON.stringify(value??null));

export {repositoryRoot};
/** Migrator/exporter only: `_local/workflows` is a `ledger-migrate` import source and a `workflow-export` target, never a store. */
export function workflowsRoot(repoRoot){return path.join(required(repoRoot,'repository root'),'.starciwork','_local','workflows');}

/** `yyyymmdd-hhmmss-slug`: sortable by time, readable by a human, safe as a directory name on Windows. */
export function slugify(title){
  const slug=String(title??'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40).replace(/-+$/,'');
  return slug||'workflow';
}
export function newWorkflowId(title,now=Date.now){
  const [day,time]=stamp(typeof now==='function'?now():now);
  return `${day}-${time}-${slugify(title)}`;
}

const renameWait=new Int32Array(new SharedArrayBuffer(4));
/** Windows readers can briefly deny replacement; retain atomic rename and bound the retry to 775 ms. */
export function replaceStateSnapshot(tmp,file,{rename=fs.renameSync,wait=ms=>Atomics.wait(renameWait,0,0,ms),platform=process.platform}={}){
  const delays=[25,50,100,200,400];
  for(let attempt=0;;attempt++){
    try{return rename(tmp,file);}
    catch(error){
      if(platform!=='win32'||!['EPERM','EACCES','EBUSY'].includes(error?.code)||attempt>=delays.length)throw error;
      wait(delays[attempt]);
    }
  }
}
export const stateGoalIdentity=state=>String(state?.goalDigest??state?.approval?.goalDigest??state?.approvalDigest??state?.goal?.digest??digest({job:state?.job??null,inputs:state?.inputs??state?.goal?.inputs??null,scope:state?.scope??state?.goal?.scope??null,definitionOfDone:state?.definitionOfDone??state?.goal?.definitionOfDone??null,ledgerMode:state?.ledgerMode??state?.goal?.ledgerMode??null}));
function assertNoRawSecrets(value,path=[]){if(!value||typeof value!=='object')return;for(const [key,item] of Object.entries(value)){const at=[...path,key];if(/^(plaintext|rawSecret|secretValue|credentialValue|passwordValue)$/i.test(key)&&item!==null&&item!==undefined&&item!=='')throw Error(`Workflow state contains raw secret field ${at.join('.')}`);assertNoRawSecrets(item,at);}}

export {eventsHead};
/** Hash-chain link of one events row — identical to ledger-db's `digestOf`: sha256(prevDigest + eventId + kind + payloadJson + createdAt), '' for the first row of a workflow. */
export const eventDigest=({prevDigest=null,eventId,kind,payloadJson,createdAt})=>sha256(`${prevDigest??''}${eventId}${kind}${payloadJson??''}${createdAt}`);

const removed=name=>{throw Error(`store-paths-removed:${name}`);};
const inboxRow=row=>({id:row.inbox_id,kind:row.kind,key:row.key,payload:JSON.parse(row.payload_json),status:row.status,
  disposition:row.disposition_json===null?null:JSON.parse(row.disposition_json),createdAt:row.created_at,appliedAt:row.applied_at});
const safeName=value=>String(value).replace(/[\\/:*?"<>|]+/g,'_');

/** Open the workflow's ledger record. No directory under `_local` is created; there is none to create. */
export function createStore({repoRoot,id}){
  const workflowId=required(id,'workflow id');
  need(!/[\\/]/.test(workflowId),`Workflow id must be one directory segment: ${workflowId}`);
  const boundRepoRoot=path.resolve(required(repoRoot,'repository root'));
  const file=ledgerFileFor(boundRepoRoot);
  const ledger=openLedger({file});
  const db=ledger.db,now=ledger.now;
  try{
    // A `_local` workflow directory without a `workflows` row was never migrated: refuse, never read it.
    const migrated=db.prepare('SELECT 1 FROM workflows WHERE workflow_id=?').get(workflowId);
    need(migrated||!fs.existsSync(path.join(workflowsRoot(boundRepoRoot),workflowId)),`ledger-unmigrated:${workflowId}`);
    ledger.ensureWorkflow({workflowId});
  }catch(error){ledger.close();throw error;}
  let durable=null,continuationOverride=null;
  // The tab speaks the host's configured language; the events it renders stay as recorded.
  const reportProgress=createProgressReporter({language:configuredProgressLanguage(),debug:configuredProgressDebug()});
  const bound=()=>durable?.ledger.db??db;
  /**
   * The generation an event belongs to when no durable binding is held. It is the workflow's own bound
   * generation (the `workflows` row), not 0: `pruneRetiredGenerations` deletes everything below the bound
   * generation, so filing a current event under 0 handed it to the next retention pass. That is how the
   * kernel's own `run-bound`/`run-resumed` receipt - written before the run binds its ledger handle - was
   * recorded and then deleted on the same start. 0 remains right for a workflow that was never enrolled.
   */
  const currentGeneration=inner=>inner.prepare('SELECT generation FROM workflows WHERE workflow_id=?').get(workflowId)?.generation??0;
  const insertEvent=(inner,{eventId=newToken(),generation=durable?.generation??currentGeneration(inner),entityType='workflow',entityId=workflowId,kind,payload=null,createdAt=now(),ignore=false}={})=>{
    const payloadJson=json(payload),prevDigest=eventsHead(inner,workflowId);
    inner.prepare(`INSERT ${ignore?'OR IGNORE ':''}INTO events(event_id,workflow_id,generation,entity_type,entity_id,kind,payload_json,prev_digest,digest,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`)
      .run(eventId,workflowId,generation,entityType,entityId,kind,payloadJson,prevDigest,eventDigest({prevDigest,eventId,kind,payloadJson,createdAt}),createdAt);
    return inner.prepare('SELECT seq FROM events WHERE event_id=?').get(eventId)?.seq??null;
  };
  const insertSnapshot=(inner,{checkpoint,generation,goalIdentity,state,ignore=true})=>
    inner.prepare(`INSERT ${ignore?'OR IGNORE ':''}INTO state_snapshots(checkpoint_id,workflow_id,generation,goal_identity,state_json,events_head,created_at) VALUES(?,?,?,?,?,?,?)`)
      .run(checkpoint,workflowId,generation,goalIdentity,JSON.stringify(state),eventsHead(inner,workflowId),now());
  /** §12: after a checkpoint's transaction commits, the tracked anchor follows it — non-transactional by design (ledger ahead of anchor is safe). */
  const anchorCheckpoint=(handle,{generation,checkpointId})=>{
    const head=handle.db.prepare('SELECT seq,digest FROM events WHERE workflow_id=? ORDER BY seq DESC LIMIT 1').get(workflowId);
    writeAnchor(boundRepoRoot,{ledgerId:handle.ledgerId,workflowId,generation,checkpointId,eventsHead:head?.digest??null,seq:head?.seq??null,at:now()});
  };
  const touch=(inner,state)=>inner.prepare('UPDATE workflows SET updated_at=?,phase=COALESCE(?,phase),goal_identity=COALESCE(?,goal_identity),finished_json=COALESCE(?,finished_json) WHERE workflow_id=?')
    .run(now(),state?.phase??null,state?stateGoalIdentity(state):null,state?.finished?json(state.finished):null,workflowId);
  const latestBody=(inner,{generation=null,goalIdentity=null}={})=>
    inner.prepare(`SELECT state_json FROM state_snapshots WHERE workflow_id=? AND state_json<>''${generation===null?'':' AND generation=?'}${goalIdentity===null?'':' AND goal_identity=?'} ORDER BY snapshot_id DESC LIMIT 1`)
      .get(workflowId,...[generation,goalIdentity].filter(value=>value!==null));
  const workflowsDir=path.join(boundRepoRoot,'workflows');
  const acknowledgeFile=(file,name,mode)=>{
    if(!durable)return null;
    let bytes=null;try{bytes=fs.readFileSync(file);}catch(error){if(error?.code!=='ENOENT')throw error;}
    const state=bytes!==null?'file':'absent',sum=bytes!==null?sha256(bytes):null,size=bytes?.length??0;
    const seq=insertEvent(durable.ledger.db,{eventId:`runtime-file:${workflowId}:${durable.generation}:${name}:${now()}:${crypto.randomBytes(8).toString('hex')}`,
      entityType:'runtime-file',entityId:name,kind:'runtime-file-written',
      payload:{schema:RUNTIME_FILE_WRITE,file,relative:name,mode,state,sha256:sum,size}});
    return {seq,file,relative:name,mode,state,sha256:sum,size};
  };
  // `paths.*` is removed except the two keys with no equivalent dedicated method: the continuation projection
  // (§8/docstring — the one file that legitimately stays on disk, but real callers resolve/override its exact
  // target dynamically, not just the canonical `<id>.md`) and the final-report reference (backed by the
  // `signal` 'final-report' key, never a file). Every other key still fails loudly with its name.
  const paths=new Proxy({},{
    get:(target,name)=>{
      if(typeof name==='symbol')return undefined;
      const key=String(name);
      if(key==='continuation')return continuationOverride??api.continuation;
      if(key==='final')return `ledger://final-report/${workflowId}`;
      return removed(key);
    },
    set:(target,name,value)=>{
      const key=String(name);
      if(key==='continuation'){continuationOverride=path.resolve(String(value));return true;}
      return removed(key);
    }
  });
  const api={
    schema:WORKFLOW_STATE,id:workflowId,repoRoot:boundRepoRoot,dir:null,ledger,ledgerFile:path.resolve(file),paths,
    /** Canonical continuation projection — the one workflow file that stays on disk, in the repo not `_local`. */
    continuation:path.join(workflowsDir,`${workflowId}.md`),
    /** Append one audit line. `events` is append-only, so a reader can replay a workflow from seq 1. */
    appendEvent(event){
      need(plain(event),'An event must be an object');
      need(event.seq===undefined,'seq is assigned by the log, never by the caller');
      const at=event.at??now();
      const seq=insertEvent(bound(),{kind:String(event.event??event.kind??'audit'),payload:event,createdAt:at});
      const line={at,seq,...event};
      reportProgress(line);
      return line;
    },
    /** The workflow's audit lines in seq order; `since` replays after a seq. */
    readEvents({since=0}={}){
      return bound().prepare("SELECT seq,payload_json,created_at FROM events WHERE workflow_id=? AND entity_type='workflow' AND entity_id=? AND seq>? ORDER BY seq")
        .all(workflowId,workflowId,since).map(row=>({seq:row.seq,at:row.created_at,...JSON.parse(row.payload_json)}));
    },
    /** Generations are a column now: retiring one records `events-generation-closed` once and moves on. */
    rotateEvents(generation){
      need(Number.isInteger(generation)&&generation>0,'rotateEvents needs the retired generation');
      insertEvent(bound(),{eventId:`events-closed:${workflowId}:${generation}`,kind:'events-generation-closed',payload:{event:'events-generation-closed',generation},ignore:true});
      return {rotated:null,generation};
    },
    /** One snapshot row per save; the bound generation's latest body is the recovery state. */
    saveState(state){
      need(plain(state)&&state.schema===WORKFLOW_STATE,`State must carry schema ${WORKFLOW_STATE}`);
      assertNoRawSecrets(state);const goal=stateGoalIdentity(state);
      if(durable)need(goal===durable.goalIdentity,'Workflow goal identity changed across the durable binding');
      const generation=durable?.generation??0,handle=durable?.ledger??ledger,checkpoint=`save:${workflowId}:${generation}:${digest(state)}`;
      handle.transaction(inner=>{
        insertSnapshot(inner,{checkpoint,generation,goalIdentity:goal,state});
        compactSnapshots(inner,{workflowId,generation,goalIdentity:goal});
        touch(inner,state);
      });
      anchorCheckpoint(handle,{generation,checkpointId:checkpoint});
      return state;
    },
    loadState(){
      const row=durable?latestBody(durable.ledger.db,{generation:durable.generation,goalIdentity:durable.goalIdentity}):latestBody(db);
      return row?JSON.parse(row.state_json):null;
    },
    /** Bind the ledger handle that owns this workflow's durable writes for one generation. */
    bindJournal(handle,generation,{goalIdentity=null,state=null}={}){
      need(handle?.transaction&&handle?.db,'bindJournal needs a ledger handle');
      need(Number.isInteger(generation)&&generation>0,'bindJournal needs a positive generation');
      const handleFile=handle.file??handle.path;
      need(handleFile===undefined||handleFile===null||path.resolve(handleFile)===path.resolve(file),`ledger-binding-mismatch:${workflowId}`);
      const seedRow=latestBody(handle.db),seed=state??(seedRow?JSON.parse(seedRow.state_json):null);
      durable={ledger:handle,generation,goalIdentity:goalIdentity??stateGoalIdentity(seed)};
      const any=handle.db.prepare('SELECT goal_identity FROM state_snapshots WHERE workflow_id=? AND generation=? ORDER BY snapshot_id DESC LIMIT 1').get(workflowId,generation);
      need(!any||any.goal_identity===durable.goalIdentity,'Durable workflow snapshot belongs to a different approved goal');
      const found=handle.db.prepare('SELECT 1 FROM state_snapshots WHERE workflow_id=? AND generation=? AND goal_identity=? LIMIT 1').get(workflowId,generation,durable.goalIdentity);
      if(!found&&plain(seed)){assertNoRawSecrets(seed);handle.transaction(inner=>insertSnapshot(inner,{checkpoint:`bind:${workflowId}:${generation}:${digest(seed)}`,generation,goalIdentity:durable.goalIdentity,state:seed}));}
      // The generations this binding retires keep one body each; the bound one keeps its latest few.
      handle.transaction(inner=>{compactSnapshots(inner,{workflowId,generation,goalIdentity:durable.goalIdentity});
        inner.prepare('UPDATE workflows SET generation=?,goal_identity=?,updated_at=? WHERE workflow_id=?').run(generation,durable.goalIdentity,now(),workflowId);});
      const head=handle.db.prepare('SELECT checkpoint_id FROM state_snapshots WHERE workflow_id=? AND generation=? AND goal_identity=? ORDER BY snapshot_id DESC LIMIT 1').get(workflowId,generation,durable.goalIdentity);
      if(head)anchorCheckpoint(handle,{generation,checkpointId:head.checkpoint_id});
      return api;
    },
    unbindJournal(handle=null){if(!handle||durable?.ledger===handle)durable=null;return api;},
    /** The continuation projection is the one runtime-owned file left on disk; everything else is a row. */
    acknowledgeRuntimeFile(file,name=null,mode='replace'){
      const target=path.resolve(file),relative=slash(path.relative(workflowsDir,target));
      need(relative&&relative!=='..'&&!relative.startsWith('../')&&!path.isAbsolute(relative)&&relative.toLowerCase().endsWith('.md'),
        'runtime file acknowledgement is limited to the continuation projection under workflows/');
      const expected=slash(path.relative(boundRepoRoot,target));
      need((name===null?expected:slash(required(name,'runtime file name')))===expected,'runtime file acknowledgement name does not match its repository path');
      return acknowledgeFile(target,expected,mode);
    },
    transition(state,{transitionId,event,apply}={}){
      need(durable,'transition needs a bound ledger');need(typeof transitionId==='string'&&transitionId,'transition needs a stable id');need(typeof apply==='function','transition needs an apply function');
      const checkpoint=`transition:${workflowId}:${durable.generation}:${transitionId}`;
      const existing=durable.ledger.db.prepare('SELECT 1 FROM state_snapshots WHERE checkpoint_id=?').get(checkpoint);
      if(existing)return JSON.parse(latestBody(durable.ledger.db,{generation:durable.generation,goalIdentity:durable.goalIdentity}).state_json);
      const next=structuredClone(state);apply(next);assertNoRawSecrets(next);need(stateGoalIdentity(next)===durable.goalIdentity,'Transition changed the workflow goal identity');
      durable.ledger.transaction(inner=>{
        insertSnapshot(inner,{checkpoint,generation:durable.generation,goalIdentity:durable.goalIdentity,state:next,ignore:false});
        if(event)insertEvent(inner,{eventId:`transition:${workflowId}:${transitionId}`,kind:event.kind??'state-transition',payload:event.payload??event,ignore:true});
        compactSnapshots(inner,{workflowId,generation:durable.generation,goalIdentity:durable.goalIdentity});
        touch(inner,next);
      });
      anchorCheckpoint(durable.ledger,{generation:durable.generation,checkpointId:checkpoint});
      return next;
    },
    reportPath(){removed('reportPath');},
    contractPath(){removed('contractPath');},
    checksPath(){removed('checksPath');},
    writeReport({dispatchId,opId=null,attempt=null,generation=null,outcome=null,report=null,fromTerminal=null}={}){
      const dispatch=required(dispatchId,'dispatch id'),resolved=outcome??(plain(report)?report.outcome:null);
      need(resolved,'writeReport needs an outcome');
      // A rewrite under the same dispatch is a NEW report, not the consumed one again: `consumed_at` binds the
      // applied bytes, so it resets exactly when report_json changes. Without the reset a worker that reported
      // `blocked`, was answered, and reported `done` under its one dispatch would have the done row still marked
      // consumed - and without the consumed row the kernel would apply the blocked report every tick.
      bound().prepare(`INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,from_terminal,created_at) VALUES(?,?,?,?,?,?,?,?,?)
        ON CONFLICT(workflow_id,dispatch_id) DO UPDATE SET op_id=COALESCE(excluded.op_id,reports.op_id),attempt=COALESCE(excluded.attempt,reports.attempt),generation=COALESCE(excluded.generation,reports.generation),outcome=excluded.outcome,report_json=excluded.report_json,from_terminal=COALESCE(excluded.from_terminal,reports.from_terminal),created_at=excluded.created_at,consumed_at=CASE WHEN excluded.report_json<>reports.report_json THEN NULL ELSE reports.consumed_at END`)
        .run(workflowId,dispatch,opId,attempt,generation,resolved,json(report),fromTerminal,now());
      return {dispatchId:dispatch,outcome:resolved};
    },
    readReports(){
      return bound().prepare('SELECT * FROM reports WHERE workflow_id=? ORDER BY dispatch_id').all(workflowId)
        .map(row=>{const report=JSON.parse(row.report_json);return {...(plain(report)?report:{report}),reportId:row.report_id,dispatchId:row.dispatch_id,opId:row.op_id,attempt:row.attempt,generation:row.generation,consumedAt:row.consumed_at,fromTerminal:row.from_terminal,createdAt:row.created_at};});
    },
    writeContract({opId,attempt=1,dispatchId=null,markdown,context=null}={}){
      const op=required(opId,'operation id');need(Number.isInteger(attempt)&&attempt>0,'writeContract needs a positive attempt');need(typeof markdown==='string','writeContract needs contract markdown');
      bound().prepare('INSERT OR REPLACE INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
        .run(workflowId,op,attempt,dispatchId,markdown,context===null?null:json(context),now());
      return {opId:op,attempt};
    },
    readContract(opId,attempt=null){
      const op=required(opId,'operation id');
      const row=attempt===null
        ?bound().prepare('SELECT * FROM contracts WHERE workflow_id=? AND op_id=? ORDER BY attempt DESC LIMIT 1').get(workflowId,op)
        :bound().prepare('SELECT * FROM contracts WHERE workflow_id=? AND op_id=? AND attempt=?').get(workflowId,op,attempt);
      return row?{opId:row.op_id,attempt:row.attempt,dispatchId:row.dispatch_id,markdown:row.markdown,context:row.context_json===null?null:JSON.parse(row.context_json),createdAt:row.created_at}:null;
    },
    writeChecks({opId,attempt=1,checks}={}){
      const op=required(opId,'operation id');need(Number.isInteger(attempt)&&attempt>0,'writeChecks needs a positive attempt');
      bound().prepare('INSERT OR REPLACE INTO checks(workflow_id,op_id,attempt,checks_json,created_at) VALUES(?,?,?,?,?)')
        .run(workflowId,op,attempt,json(checks),now());
      return {opId:op,attempt};
    },
    readChecks(opId,attempt=null){
      const op=required(opId,'operation id');
      const row=attempt===null
        ?bound().prepare('SELECT * FROM checks WHERE workflow_id=? AND op_id=? ORDER BY attempt DESC LIMIT 1').get(workflowId,op)
        :bound().prepare('SELECT * FROM checks WHERE workflow_id=? AND op_id=? AND attempt=?').get(workflowId,op,attempt);
      return row?JSON.parse(row.checks_json):null;
    },
    inbox:{
      push({kind,key=null,payload=null}={}){
        const value=required(kind,'inbox kind'),at=now();
        const inserted=bound().prepare("INSERT INTO inbox(workflow_id,kind,key,payload_json,status,created_at) VALUES(?,?,?,?,'pending',?)").run(workflowId,value,key,json(payload),at);
        return {id:Number(inserted.lastInsertRowid),kind:value,key,payload,status:'pending',createdAt:at};
      },
      pending(){return bound().prepare("SELECT * FROM inbox WHERE workflow_id=? AND status='pending' ORDER BY inbox_id").all(workflowId).map(inboxRow);},
      settle(id,status,disposition=null){
        return bound().prepare('UPDATE inbox SET status=?,disposition_json=?,applied_at=? WHERE workflow_id=? AND inbox_id=?')
          .run(required(status,'inbox status'),disposition===null?null:json(disposition),now(),workflowId,id).changes>0;
      }
    },
    signal:{
      set(scope,key,{pid=null,token=null,value=null,ttl=null}={}){
        const at=now(),expires=ttl===null?null:at+ttl,named=required(key,'signal key');
        bound().prepare('INSERT OR REPLACE INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES(?,?,?,?,?,?,?)')
          .run(required(scope,'signal scope'),named,pid,token,value===null?null:json(value),at,expires);
        return {scope,key:named,pid,token,value,at,expiresAt:expires};
      },
      get(scope,key){
        const row=bound().prepare('SELECT * FROM signals WHERE scope=? AND key=?').get(scope,key);
        return row?{scope:row.scope,key:row.key,pid:row.holder_pid,token:row.token,value:row.value_json===null?null:JSON.parse(row.value_json),at:row.at,expiresAt:row.expires_at}:null;
      },
      clear(scope,key){return bound().prepare('DELETE FROM signals WHERE scope=? AND key=?').run(scope,key).changes>0;}
    },
    inputs:{
      put({key,goalRevision,bytes,origin,mediaType=null}={}){
        const named=required(key,'input key');need(Number.isInteger(goalRevision)&&goalRevision>0,'inputs.put needs a positive goal revision');
        return (durable?.ledger??ledger).inputs.put({workflowId,key:named,goalRevision,bytes,origin:required(origin,'input origin'),mediaType});
      },
      get(key){
        const row=(durable?.ledger??ledger).inputs.get({workflowId,key:required(key,'input key')});
        return row?{key:row.key,goalRevision:row.goal_revision,sha256:row.sha256,size:row.size,mediaType:row.media_type,origin:row.origin,bytes:row.bytes,createdAt:row.created_at,ref:row.ref}:null;
      },
      list(){
        return (durable?.ledger??ledger).inputs.list({workflowId}).map(row=>({key:row.key,goalRevision:row.goal_revision,sha256:row.sha256,size:row.size,mediaType:row.media_type,origin:row.origin,createdAt:row.created_at,ref:row.ref}));
      },
      materialise(key,dir){
        return (durable?.ledger??ledger).inputs.materialise({workflowId,key:required(key,'input key'),dir:path.resolve(required(dir,'materialise directory'))});
      }
    },
    /** The current goal revision; anything that needs the goal reads this, never a file. */
    goal(){
      const row=bound().prepare('SELECT * FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1').get(workflowId);
      return row?{revision:row.revision,identity:row.goal_identity,markdown:row.markdown,json:JSON.parse(row.json),
        amendment:row.amendment_json===null?null:JSON.parse(row.amendment_json),createdAt:row.created_at}:null;
    },
    setGoal({markdown,json:record,amendment=null,identity=null}={}){
      need(typeof markdown==='string','setGoal needs goal markdown');need(record!==null&&record!==undefined,'setGoal needs the goal record');
      const goalIdentity=identity??digest(record),at=now();
      const revision=(durable?.ledger??ledger).transaction(inner=>{
        const next=(inner.prepare('SELECT max(revision) latest FROM goals WHERE workflow_id=?').get(workflowId).latest??0)+1;
        inner.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,amendment_json,created_at) VALUES(?,?,?,?,?,?,?)')
          .run(workflowId,next,goalIdentity,markdown,json(record),amendment===null?null:json(amendment),at);
        inner.prepare('UPDATE workflows SET goal_identity=?,updated_at=? WHERE workflow_id=?').run(goalIdentity,at,workflowId);
        return next;
      });
      return {revision,identity:goalIdentity};
    },
    /**
     * Rewrite the current revision's rendered page in place. The kernel splices the critique section and the
     * lane header into goal.md after the phase rendered it; in 1.0.3 that edited the one goal.md file, so it
     * must not become a second `goals` row here. A revision is what `goal.revise`/`workflow-amend` moves -
     * inputs are bound to it (`inputs.goal_revision`) - never a re-render of the same goal.
     */
    reviseGoalMarkdown(markdown){
      need(typeof markdown==='string','reviseGoalMarkdown needs goal markdown');
      const row=bound().prepare('SELECT revision FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1').get(workflowId);
      need(row,`No goal revision to revise for ${workflowId}`);
      bound().prepare('UPDATE goals SET markdown=? WHERE workflow_id=? AND revision=?').run(markdown,workflowId,row.revision);
      return {revision:row.revision};
    },
    /** `workflow-export`: today's `_local` file layout, written under `dir` for humans. Never the record. */
    exportTo(dir){
      const target=path.resolve(required(dir,'export directory'));
      fs.mkdirSync(target,{recursive:true});
      // WAL makes the ledger three files; truncate it into runtime.sqlite before reading so an archive of this export stays one file (§3).
      checkpointLedger(durable?.ledger??ledger);
      const files=[],write=(name,content)=>{const file=path.join(target,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content);files.push(slash(name));};
      const pretty=value=>`${JSON.stringify(value,null,2)}\n`;
      const latest=api.loadState();
      if(latest)write('state.json',pretty(latest));
      const events=api.readEvents();
      write('events.jsonl',events.length?`${events.map(event=>JSON.stringify(event)).join('\n')}\n`:'');
      const goalRow=api.goal();
      if(goalRow){write('goal.md',goalRow.markdown);write('goal.json',pretty(goalRow.json));}
      for(const row of bound().prepare('SELECT dispatch_id,report_json FROM reports WHERE workflow_id=? ORDER BY dispatch_id').all(workflowId))
        write(`reports/${safeName(row.dispatch_id)}.json`,pretty(JSON.parse(row.report_json)));
      for(const [table,folder,field,ext] of [['contracts','contracts','markdown','md'],['checks','checks','checks_json','json']]){
        const rows=bound().prepare(`SELECT op_id,attempt,${field} body FROM ${table} WHERE workflow_id=? ORDER BY op_id,attempt`).all(workflowId);
        const counts=new Map();for(const row of rows)counts.set(row.op_id,(counts.get(row.op_id)??0)+1);
        for(const row of rows)write(`${folder}/${safeName(row.op_id)}${counts.get(row.op_id)>1?`.attempt-${row.attempt}`:''}.${ext}`,ext==='md'?row.body:pretty(JSON.parse(row.body)));
      }
      return {dir:target,files};
    },
    close(){ledger.close();}
  };
  return api;
}

/**
 * Every workflow of a repository, newest first: the id carries the timestamp, so the order is the name order.
 *
 * Runtime 1.0.4 (§8): a workflow has no directory any more, so a lister that returned only `{id,dir,state}`
 * left its one caller - the `workflow-list` row builder - reading `events.jsonl`, `kernel.lock` and
 * `stop.flag` under a `dir` that is now `null`. The three facts that row needs are ledger rows, so they are
 * read here, inside the one handle this function already opens, rather than from a directory that is gone.
 */
export function listWorkflows(repoRoot){
  const root=path.resolve(required(repoRoot,'repository root')),file=ledgerFileFor(root);
  if(!fs.existsSync(file))return [];
  const ledger=inspectLedger({file});
  try{
    const lastEventOf=ledger.db.prepare("SELECT seq,payload_json,created_at FROM events WHERE workflow_id=? AND entity_type='workflow' AND entity_id=? ORDER BY seq DESC LIMIT 1");
    const signalOf=ledger.db.prepare('SELECT holder_pid,value_json,at FROM signals WHERE scope=? AND key=?');
    return ledger.db.prepare(`SELECT w.workflow_id id,w.updated_at,
        (SELECT s.state_json FROM state_snapshots s WHERE s.workflow_id=w.workflow_id AND s.state_json<>'' ORDER BY s.snapshot_id DESC LIMIT 1) state_json
      FROM workflows w ORDER BY w.workflow_id DESC`).all()
      .map(row=>{
        const event=lastEventOf.get(row.id,row.id)??null,lock=signalOf.get(row.id,'kernel-lock')??null;
        return {id:row.id,dir:null,state:row.state_json?JSON.parse(row.state_json):null,updatedAt:row.updated_at,
          // The stored payload carries the event's own `at`; `created_at` is the row's, and is the fallback.
          lastEvent:event?{seq:event.seq,at:event.created_at,...JSON.parse(event.payload_json)}:null,
          kernelPid:lock?.holder_pid??null,
          stopRequested:Boolean(signalOf.get(row.id,'stop'))};
      });
  }finally{ledger.close();}
}
