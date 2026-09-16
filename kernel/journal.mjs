import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

export const JOURNAL_SCHEMA='starci/operational-journal@1';
export const JOURNAL_VERSION=2;
const need=(ok,message)=>{if(!ok)throw Error(message);};
const json=value=>JSON.stringify(value??null);
const value=row=>row?{...row,payload:row.payload_json===null?null:JSON.parse(row.payload_json),result:row.result_json===null?null:JSON.parse(row.result_json)}:null;
const sqliteTuple=text=>String(text).split('.').map(Number);
export function sqliteAtLeast(actual,minimum){
  const a=sqliteTuple(actual),b=sqliteTuple(minimum);
  for(let i=0;i<Math.max(a.length,b.length);i+=1){if((a[i]??0)!==(b[i]??0))return (a[i]??0)>(b[i]??0);}
  return true;
}
export const newToken=()=>crypto.randomBytes(24).toString('hex');
/** A job in one of these states holds nothing the runtime still needs from it: its result is recorded or void. */
export const SETTLED_JOB_STATUSES=['succeeded','failed','cancelled'];
/**
 * The retention policy of the journal, in one place. The journal keeps what a workflow needs to continue and
 * nothing it has settled:
 *
 * - the bound generation of a workflow keeps ONE state body (its recovery state), every `transition:` and
 *   `bind:` checkpoint row (so a replayed transition is still recognised, body or not) and only the latest
 *   `save:` checkpoint (an older save row is a duplicate of a state the next save replaced);
 * - a retired generation (older than the bound one) keeps no snapshot rows, no settled jobs and none of their
 *   events: nothing reads them again - replay identity carries the generation, and a probation refund at the
 *   retry boundary runs before the generation it refunds is retired;
 * - live reservations (lease rows), unsettled jobs and the events of unsettled jobs are never touched, whatever
 *   their generation.
 */
export const RETENTION={snapshotBodiesKept:1,retiredGenerationRows:0};
/** Bodies kept per bound (workflow, generation, goal): the latest is the recovery state. */
export const SNAPSHOT_BODIES_KEPT=RETENTION.snapshotBodiesKept;
/**
 * Retire what the runtime can never read again. Bound (workflow, generation, goal): older bodies are let go,
 * older `save:` rows are dropped, retired generations are dropped whole. Unbound: the same, taking each
 * workflow's newest generation as its bound one. Returns the number of rows changed or removed.
 */
export function compactSnapshots(db,{workflowId=null,generation=null,goalIdentity=null,keep=SNAPSHOT_BODIES_KEPT}={}){
  const bound=workflowId&&generation!==null&&goalIdentity!==null;
  let changed=0;
  if(bound){
    changed+=db.prepare(`UPDATE state_snapshots SET state_json='' WHERE workflow_id=? AND generation=? AND goal_identity=? AND state_json<>'' AND snapshot_id NOT IN (SELECT snapshot_id FROM state_snapshots WHERE workflow_id=? AND generation=? AND goal_identity=? ORDER BY snapshot_id DESC LIMIT ?)`).run(workflowId,generation,goalIdentity,workflowId,generation,goalIdentity,keep).changes;
    changed+=db.prepare(`DELETE FROM state_snapshots WHERE workflow_id=? AND generation=? AND checkpoint_id LIKE 'save:%' AND snapshot_id<>(SELECT max(snapshot_id) FROM state_snapshots WHERE workflow_id=? AND generation=?)`).run(workflowId,generation,workflowId,generation).changes;
    changed+=db.prepare('DELETE FROM state_snapshots WHERE workflow_id=? AND generation<?').run(workflowId,generation).changes;
    return changed;
  }
  const scope=workflowId?' AND workflow_id=?':'',args=workflowId?[workflowId]:[];
  changed+=db.prepare(`DELETE FROM state_snapshots WHERE 1=1${scope} AND generation<(SELECT max(generation) FROM state_snapshots m WHERE m.workflow_id=state_snapshots.workflow_id)`).run(...args).changes;
  changed+=db.prepare(`UPDATE state_snapshots SET state_json='' WHERE state_json<>''${scope} AND snapshot_id NOT IN (SELECT snapshot_id FROM state_snapshots s WHERE s.workflow_id=state_snapshots.workflow_id AND s.generation=state_snapshots.generation AND s.goal_identity=state_snapshots.goal_identity ORDER BY s.snapshot_id DESC LIMIT ?)`).run(...args,keep).changes;
  changed+=db.prepare(`DELETE FROM state_snapshots WHERE checkpoint_id LIKE 'save:%'${scope} AND snapshot_id<>(SELECT max(snapshot_id) FROM state_snapshots s WHERE s.workflow_id=state_snapshots.workflow_id AND s.generation=state_snapshots.generation)`).run(...args).changes;
  return changed;
}
/**
 * Drop the settled jobs and events of every generation older than `generation` for one workflow. A job that
 * still holds a lease or is not settled stays, with its events, whatever its generation. Returns the counts.
 */
export function pruneRetiredGenerations(db,{workflowId,generation}){
  need(workflowId&&Number.isInteger(generation),'pruneRetiredGenerations needs a workflow and its bound generation');
  const settled=SETTLED_JOB_STATUSES.map(()=>'?').join(',');
  const jobs=db.prepare(`DELETE FROM jobs WHERE workflow_id=? AND generation<? AND status IN (${settled}) AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.job_id=jobs.job_id)`).run(workflowId,generation,...SETTLED_JOB_STATUSES).changes;
  const events=db.prepare(`DELETE FROM events WHERE workflow_id=? AND generation<? AND (entity_type<>'job' OR NOT EXISTS (SELECT 1 FROM jobs j WHERE j.job_id=events.entity_id))`).run(workflowId,generation).changes;
  return {jobs,events};
}
/** What still binds a workflow to this journal: its leases and its unsettled jobs. Empty means nothing does. */
export function liveRows(db,workflowId){
  const settled=SETTLED_JOB_STATUSES.map(()=>'?').join(',');
  const leases=db.prepare('SELECT job_id,resource_key FROM leases WHERE workflow_id=? ORDER BY job_id,resource_key').all(workflowId).map(row=>({jobId:row.job_id,resource:row.resource_key}));
  const jobs=db.prepare(`SELECT job_id,status,generation FROM jobs WHERE workflow_id=? AND status NOT IN (${settled}) ORDER BY job_id`).all(workflowId,...SETTLED_JOB_STATUSES).map(row=>({jobId:row.job_id,status:row.status,generation:row.generation}));
  return {leases,jobs};
}
/**
 * Remove every row of a workflow that holds nothing live. Refuses - and removes nothing - while the workflow
 * still holds a lease or an unsettled job: those are what the next kernel or retry reconciles, on the record.
 */
export function retireWorkflow(db,workflowId,{preserveRuntimeCustody=false}={}){
  need(workflowId,'retireWorkflow needs a workflow id');
  const live=liveRows(db,workflowId);
  if(live.leases.length||live.jobs.length)return {ok:false,workflowId,live,reason:'the workflow still holds live reservations or unsettled jobs'};
  if(preserveRuntimeCustody){
    const latest=db.prepare("SELECT snapshot_id,generation FROM state_snapshots WHERE workflow_id=? AND state_json<>'' ORDER BY generation DESC,snapshot_id DESC LIMIT 1").get(workflowId),
      receipts=latest?db.prepare("SELECT max(seq) seq FROM events WHERE workflow_id=? AND generation=? AND entity_type='runtime-file' AND kind='runtime-file-written' GROUP BY entity_id").all(workflowId,latest.generation).map(row=>row.seq):[],
      keep=receipts.length?receipts.map(()=>'?').join(','):null;
    const removed={
      snapshots:latest?db.prepare('DELETE FROM state_snapshots WHERE workflow_id=? AND snapshot_id<>?').run(workflowId,latest.snapshot_id).changes:db.prepare('DELETE FROM state_snapshots WHERE workflow_id=?').run(workflowId).changes,
      jobs:db.prepare('DELETE FROM jobs WHERE workflow_id=?').run(workflowId).changes,
      events:keep?db.prepare(`DELETE FROM events WHERE workflow_id=? AND seq NOT IN (${keep})`).run(workflowId,...receipts).changes:db.prepare('DELETE FROM events WHERE workflow_id=?').run(workflowId).changes,
      incidents:db.prepare('DELETE FROM incidents WHERE workflow_id=?').run(workflowId).changes};
    return {ok:true,workflowId,removed,retained:{snapshots:latest?1:0,runtimeFileReceipts:receipts.length,generation:latest?.generation??null}};
  }
  const removed={
    snapshots:db.prepare('DELETE FROM state_snapshots WHERE workflow_id=?').run(workflowId).changes,
    jobs:db.prepare('DELETE FROM jobs WHERE workflow_id=?').run(workflowId).changes,
    events:db.prepare('DELETE FROM events WHERE workflow_id=?').run(workflowId).changes,
    incidents:db.prepare('DELETE FROM incidents WHERE workflow_id=?').run(workflowId).changes};
  return {ok:true,workflowId,removed};
}
/** Every workflow id the journal holds a row for, with what still binds it. */
export function journalWorkflows(db){
  const ids=new Set();
  for(const table of ['state_snapshots','jobs','events','leases','incidents'])for(const row of db.prepare(`SELECT DISTINCT workflow_id FROM ${table}`).all())ids.add(row.workflow_id);
  return [...ids].sort().map(workflowId=>({workflowId,...liveRows(db,workflowId),rows:{snapshots:db.prepare('SELECT count(*) n FROM state_snapshots WHERE workflow_id=?').get(workflowId).n,jobs:db.prepare('SELECT count(*) n FROM jobs WHERE workflow_id=?').get(workflowId).n,events:db.prepare('SELECT count(*) n FROM events WHERE workflow_id=?').get(workflowId).n}}));
}

function migrate(db){
  const version=Number(db.prepare('PRAGMA user_version').get().user_version);
  need(version<=JOURNAL_VERSION,`Operational journal version ${version} is newer than supported ${JOURNAL_VERSION}`);
  // A journal created by this build gives freed pages back on its own; the setting must precede the first table.
  if(version===0)db.exec('PRAGMA auto_vacuum=INCREMENTAL');
  if(version===0)db.exec(`
    BEGIN IMMEDIATE;
    CREATE TABLE events(seq INTEGER PRIMARY KEY AUTOINCREMENT,event_id TEXT NOT NULL UNIQUE,workflow_id TEXT NOT NULL,entity_type TEXT NOT NULL,entity_id TEXT NOT NULL,generation INTEGER NOT NULL,kind TEXT NOT NULL,payload_json TEXT,created_at INTEGER NOT NULL);
    CREATE INDEX events_entity ON events(workflow_id,entity_type,entity_id,seq);
    CREATE TABLE jobs(job_id TEXT PRIMARY KEY,workflow_id TEXT NOT NULL,op_id TEXT,attempt INTEGER NOT NULL,generation INTEGER NOT NULL,kind TEXT NOT NULL,role TEXT,payload_json TEXT,status TEXT NOT NULL,priority_json TEXT,lease_token TEXT,worker_id TEXT,deadline INTEGER,result_json TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
    CREATE INDEX jobs_queue ON jobs(status,kind,created_at,job_id);
    CREATE TABLE resources(resource_key TEXT PRIMARY KEY,capacity INTEGER NOT NULL CHECK(capacity>=0));
    CREATE TABLE leases(resource_key TEXT NOT NULL,job_id TEXT NOT NULL,workflow_id TEXT NOT NULL,op_id TEXT,attempt INTEGER NOT NULL,generation INTEGER NOT NULL,token TEXT NOT NULL,units INTEGER NOT NULL CHECK(units>0),acquired_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,PRIMARY KEY(resource_key,job_id),FOREIGN KEY(job_id) REFERENCES jobs(job_id) ON DELETE CASCADE);
    CREATE INDEX leases_expiry ON leases(expires_at);
    CREATE TABLE budgets(scope_key TEXT PRIMARY KEY,limit_value INTEGER NOT NULL CHECK(limit_value>=0),used_value INTEGER NOT NULL DEFAULT 0 CHECK(used_value>=0),reserved_value INTEGER NOT NULL DEFAULT 0 CHECK(reserved_value>=0));
    CREATE TABLE budget_reservations(scope_key TEXT NOT NULL,job_id TEXT NOT NULL,units INTEGER NOT NULL CHECK(units>0),PRIMARY KEY(scope_key,job_id),FOREIGN KEY(scope_key) REFERENCES budgets(scope_key),FOREIGN KEY(job_id) REFERENCES jobs(job_id) ON DELETE CASCADE);
    CREATE TABLE incidents(incident_id TEXT PRIMARY KEY,workflow_id TEXT NOT NULL,op_id TEXT,attempts INTEGER NOT NULL DEFAULT 0,model_calls INTEGER NOT NULL DEFAULT 0,tokens INTEGER NOT NULL DEFAULT 0,elapsed_ms INTEGER NOT NULL DEFAULT 0,last_progress TEXT,status TEXT NOT NULL,updated_at INTEGER NOT NULL);
    PRAGMA user_version=1;
    COMMIT;`);
  if(version<2)db.exec(`BEGIN IMMEDIATE;
    CREATE TABLE state_snapshots(snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,checkpoint_id TEXT NOT NULL UNIQUE,workflow_id TEXT NOT NULL,generation INTEGER NOT NULL,goal_identity TEXT NOT NULL,state_json TEXT NOT NULL,created_at INTEGER NOT NULL);
    CREATE INDEX state_snapshots_lookup ON state_snapshots(workflow_id,generation,goal_identity,snapshot_id);
    PRAGMA user_version=2;
    COMMIT;`);
}

/** Give freed pages back to the filesystem where the file was created to allow it; a no-op on an older file. */
export function reclaimSpace(db){try{db.exec('PRAGMA incremental_vacuum');}catch{}}

/**
 * A journal opened to be read and nothing else: no migration, no compaction, no reclaim. What an operator's
 * inspection uses on a file a kernel may hold, and what a retirement check uses before it is allowed to touch.
 */
export function inspectJournal({file}={}){
  const {DatabaseSync}=require('node:sqlite');
  need(typeof file==='string'&&fs.existsSync(file),'inspectJournal needs an existing file');
  const db=new DatabaseSync(file,{readOnly:true,timeout:5000});
  return {schema:JOURNAL_SCHEMA,file,path:path.resolve(file),db,readOnly:true,
    version:Number(db.prepare('PRAGMA user_version').get().user_version),
    liveRows(workflowId){return liveRows(db,workflowId);},workflows(){return journalWorkflows(db);},close(){db.close();}};
}

export function openJournal({file,now=Date.now,busyTimeoutMs=5000,journalMode='DELETE',allowWal=false}={}){
  const {DatabaseSync}=require('node:sqlite');
  need(typeof file==='string'&&file.trim(),'openJournal needs a file');
  fs.mkdirSync(path.dirname(path.resolve(file)),{recursive:true});
  const db=new DatabaseSync(file,{timeout:busyTimeoutMs});
  db.exec('PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL;');
  const sqliteVersion=db.prepare('select sqlite_version() AS version').get().version;
  const requested=String(journalMode).toUpperCase();
  if(requested==='WAL')need(allowWal&&sqliteAtLeast(sqliteVersion,'3.51.3'),`WAL requires explicit allowWal and SQLite >=3.51.3; found ${sqliteVersion}`);
  need(['DELETE','WAL'].includes(requested),`Unsupported journal mode ${requested}`);
  const actual=String(db.prepare(`PRAGMA journal_mode=${requested}`).get().journal_mode).toUpperCase();
  need(actual===requested,`SQLite selected journal mode ${actual}, expected ${requested}`);
  migrate(db);
  const autoVacuum=Number(db.prepare('PRAGMA auto_vacuum').get().auto_vacuum);
  // Opening compacts what an older runtime left behind, for every workflow the file holds: no runtime reads it again.
  db.exec('BEGIN IMMEDIATE');try{compactSnapshots(db);db.exec('COMMIT');}catch(error){try{db.exec('ROLLBACK');}catch{}throw error;}
  reclaimSpace(db);
  const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const result=fn(db);db.exec('COMMIT');return result;}catch(error){try{db.exec('ROLLBACK');}catch{}throw error;}};
  return {
    schema:JOURNAL_SCHEMA,file,path:path.resolve(file),sqliteVersion,journalMode:actual,autoVacuum,db,now,transaction,
    appendEvent({eventId=newToken(),workflowId,entityType,entityId,generation=0,kind,payload=null,createdAt=now()}){
      need(workflowId&&entityType&&entityId&&kind,'Event identity and kind are required');
      db.prepare('INSERT OR IGNORE INTO events(event_id,workflow_id,entity_type,entity_id,generation,kind,payload_json,created_at) VALUES(?,?,?,?,?,?,?,?)').run(eventId,workflowId,entityType,entityId,generation,kind,json(payload),createdAt);
      return db.prepare('SELECT * FROM events WHERE event_id=?').get(eventId);
    },
    enqueueJob({jobId,workflowId,opId=null,attempt=1,generation=1,kind,role=null,payload=null,priority=null,createdAt=now()}){
      need(jobId&&workflowId&&kind,'Job identity and kind are required');
      db.prepare("INSERT OR IGNORE INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,priority_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?, 'queued',?,?,?)").run(jobId,workflowId,opId,attempt,generation,kind,role,json(payload),json(priority),createdAt,createdAt);
      return value(db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId));
    },
    getJob(jobId){return value(db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId));},
    listJobs({status=null,kind=null}={}){let sql='SELECT * FROM jobs WHERE 1=1';const args=[];if(status){sql+=' AND status=?';args.push(status);}if(kind){sql+=' AND kind=?';args.push(kind);}sql+=' ORDER BY created_at,job_id';return db.prepare(sql).all(...args).map(value);},
    events({workflowId=null}={}){return (workflowId?db.prepare('SELECT * FROM events WHERE workflow_id=? ORDER BY seq').all(workflowId):db.prepare('SELECT * FROM events ORDER BY seq').all()).map(row=>({...row,payload:JSON.parse(row.payload_json)}));},
    /** The rows of a workflow that are only history now: retired generations go, then freed pages are given back. */
    retireGenerations({workflowId,generation}){const pruned=transaction(inner=>pruneRetiredGenerations(inner,{workflowId,generation}));reclaimSpace(db);return pruned;},
    /** Everything of a workflow, when nothing of it is live. */
    retireWorkflow(workflowId,options={}){const result=transaction(inner=>retireWorkflow(inner,workflowId,options));if(result.ok)reclaimSpace(db);return result;},
    liveRows(workflowId){return liveRows(db,workflowId);},
    workflows(){return journalWorkflows(db);},
    close(){db.close();}
  };
}
