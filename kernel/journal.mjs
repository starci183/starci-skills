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
/** Bodies kept per bound (workflow, generation, goal): the latest is the recovery state, the rest a short margin. */
export const SNAPSHOT_BODIES_KEPT=3;
/**
 * Retire snapshot bodies the runtime can never read again. A bound generation reads only its latest body; an
 * older generation is never read. The checkpoint rows themselves stay, with their ids, so a replayed transition
 * is still recognised; only the state text is let go. Returns the number of bodies retired.
 */
export function compactSnapshots(db,{workflowId=null,generation=null,goalIdentity=null,keep=SNAPSHOT_BODIES_KEPT}={}){
  const scope=workflowId?' AND workflow_id=?':'',args=workflowId?[workflowId]:[];
  const bound=generation!==null&&goalIdentity!==null;
  // The bound generation - or, unbound, the newest generation of each workflow - keeps its latest few bodies.
  const current=bound
    ?db.prepare(`UPDATE state_snapshots SET state_json='' WHERE workflow_id=? AND generation=? AND goal_identity=? AND state_json<>'' AND snapshot_id NOT IN (SELECT snapshot_id FROM state_snapshots WHERE workflow_id=? AND generation=? AND goal_identity=? ORDER BY snapshot_id DESC LIMIT ?)`).run(workflowId,generation,goalIdentity,workflowId,generation,goalIdentity,keep).changes
    :db.prepare(`UPDATE state_snapshots SET state_json='' WHERE state_json<>''${scope} AND generation=(SELECT max(generation) FROM state_snapshots m WHERE m.workflow_id=state_snapshots.workflow_id) AND snapshot_id NOT IN (SELECT snapshot_id FROM state_snapshots s WHERE s.workflow_id=state_snapshots.workflow_id AND s.generation=state_snapshots.generation AND s.goal_identity=state_snapshots.goal_identity ORDER BY s.snapshot_id DESC LIMIT ?)`).run(...args,keep).changes;
  // An older generation keeps exactly one body as evidence.
  const older=bound
    ?db.prepare(`UPDATE state_snapshots SET state_json='' WHERE workflow_id=? AND generation<? AND state_json<>'' AND snapshot_id NOT IN (SELECT max(snapshot_id) FROM state_snapshots WHERE workflow_id=? AND generation<? GROUP BY generation,goal_identity)`).run(workflowId,generation,workflowId,generation).changes
    :db.prepare(`UPDATE state_snapshots SET state_json='' WHERE state_json<>''${scope} AND generation<(SELECT max(generation) FROM state_snapshots m WHERE m.workflow_id=state_snapshots.workflow_id) AND snapshot_id NOT IN (SELECT max(snapshot_id) FROM state_snapshots GROUP BY workflow_id,generation,goal_identity)`).run(...args).changes;
  return current+older;
}

function migrate(db){
  const version=Number(db.prepare('PRAGMA user_version').get().user_version);
  need(version<=JOURNAL_VERSION,`Operational journal version ${version} is newer than supported ${JOURNAL_VERSION}`);
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
  compactSnapshots(db);
  const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const result=fn(db);db.exec('COMMIT');return result;}catch(error){try{db.exec('ROLLBACK');}catch{}throw error;}};
  return {
    schema:JOURNAL_SCHEMA,file,path:path.resolve(file),sqliteVersion,journalMode:actual,db,now,transaction,
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
    close(){db.close();}
  };
}
