import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {newToken,sqliteAtLeast,SETTLED_JOB_STATUSES,RETENTION,reclaimSpace} from './journal.mjs';
const require=createRequire(import.meta.url);
export {newToken,sqliteAtLeast,SETTLED_JOB_STATUSES,RETENTION,reclaimSpace};

export const LEDGER_SCHEMA='starci/ledger-db@1';
export const LEDGER_VERSION=1;
export const MACHINE_SCHEMA='starci/machine-db@1';
export const MACHINE_VERSION=1;
/**
 * `.claude` is the runtime every project loads, never a Work root of its own: the Work root is the project's
 * backend, reached through `.workspaces`. But the runtime is its own git checkout, and the Work root is
 * resolved with `git rev-parse --git-common-dir` - so any CLI or worker whose cwd sat inside the runtime
 * resolved the runtime as its own Work root and quietly opened a SECOND ledger there. One was found holding
 * a live workflow's id. A parallel record is worse than no record, so this refuses by name instead.
 */
const RUNTIME_MARKER=root=>fs.existsSync(path.join(root,'bin','starci.mjs'))
  &&(fs.existsSync(path.join(root,'kernel','ledger-db.mjs'))||fs.existsSync(path.join(root,'.dist','kernel','ledger-db.mjs')));
export const isRuntimeRoot=root=>RUNTIME_MARKER(path.resolve(root));
export const ledgerFileFor=repoRoot=>{
  if(typeof repoRoot!=='string'||!repoRoot.trim())throw Error('ledgerFileFor needs a repository root');
  const root=path.resolve(repoRoot);
  if(isRuntimeRoot(root))throw Object.assign(Error(`ledger-root-is-runtime: ${root} is the StarCi runtime, not a Work root; route the project through .workspaces`),{code:'STARCI_LEDGER_ROOT_IS_RUNTIME'});
  return path.join(root,'.starciwork','runtime.sqlite');
};
// Same root as engine.mjs's runtimeRootFor, kept local so this module never imports the engine.
const runtimeRootFor=(env=process.env)=>path.join(env.LOCALAPPDATA||path.join(os.homedir(),'.local','state'),'StarCi','runtime');
export const machineFileFor=(env=process.env)=>path.join(runtimeRootFor(env),'machine.sqlite');
export const SNAPSHOT_BODIES_KEPT=RETENTION.snapshotBodiesKept;

const need=(ok,message)=>{if(!ok)throw Error(message);};
const json=value=>JSON.stringify(value??null);
const value=row=>row?{...row,payload:row.payload_json===null?null:JSON.parse(row.payload_json),result:row.result_json===null?null:JSON.parse(row.result_json)}:null;
const sha256=text=>crypto.createHash('sha256').update(text).digest('hex');
const realpathOf=file=>{try{return fs.realpathSync(file);}catch{return path.resolve(file);}};
const digestOf=(prevDigest,row)=>sha256(`${prevDigest??''}${row.event_id}${row.kind}${row.payload_json??''}${row.created_at}`);
// A caller (inside this module or outside it - kernel/jobs.mjs writes `events` rows directly, and always
// will) can omit or get the hash chain wrong. Rather than chase every such INSERT, the chain is enforced by
// the table itself: `digest` defaults to '' so an omitted column never trips NOT NULL, and this AFTER INSERT
// trigger recomputes prev_digest/digest from the workflow's own history regardless of what was supplied,
// via a registered SQL function mirroring `digestOf` exactly (registerDigestFunction, below).
const EVENTS_DIGEST_TRIGGER=`CREATE TRIGGER IF NOT EXISTS events_digest_chain AFTER INSERT ON events BEGIN
    UPDATE events SET
      prev_digest=(SELECT digest FROM events WHERE workflow_id=NEW.workflow_id AND seq<NEW.seq ORDER BY seq DESC LIMIT 1),
      digest=starci_sha256(COALESCE((SELECT digest FROM events WHERE workflow_id=NEW.workflow_id AND seq<NEW.seq ORDER BY seq DESC LIMIT 1),'')||NEW.event_id||NEW.kind||COALESCE(NEW.payload_json,'')||NEW.created_at)
    WHERE seq=NEW.seq;
  END;`;
const registerDigestFunction=db=>db.function('starci_sha256',{deterministic:true},text=>sha256(String(text)));
/** The ledger's own identity, from its `meta` row. Never derived from a path (§5). */
export function ledgerIdOf(handle){
  need(handle?.db,'ledgerIdOf needs a handle');
  return handle.db.prepare("SELECT value FROM meta WHERE key='ledger_id'").get()?.value??null;
}
const runCheckpoint=db=>{
  const row=db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
  return {ok:!row.busy,busy:Boolean(row.busy),logFrames:Number(row.log),checkpointedFrames:Number(row.checkpointed)};
};
/** Truncate the WAL into the main file. Every copy path (archive, workflow-export, backup, supervisor snapshot) calls this on its handle before copying `runtime.sqlite` alone (§3). */
export function checkpointLedger(handle){need(handle?.db,'checkpointLedger needs a ledger handle');return runCheckpoint(handle.db);}

/**
 * Retention of the ledger, ported whole from journal.mjs: the bound generation keeps one state body, its
 * `transition:`/`bind:` checkpoint rows and only the latest `save:` row; retired generations keep nothing.
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
/** Drop the settled jobs and events of every generation older than `generation` for one workflow. */
export function pruneRetiredGenerations(db,{workflowId,generation}){
  need(workflowId&&Number.isInteger(generation),'pruneRetiredGenerations needs a workflow and its bound generation');
  const settled=SETTLED_JOB_STATUSES.map(()=>'?').join(',');
  const jobs=db.prepare(`DELETE FROM jobs WHERE workflow_id=? AND generation<? AND status IN (${settled}) AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.job_id=jobs.job_id)`).run(workflowId,generation,...SETTLED_JOB_STATUSES).changes;
  const events=db.prepare(`DELETE FROM events WHERE workflow_id=? AND generation<? AND (entity_type<>'job' OR NOT EXISTS (SELECT 1 FROM jobs j WHERE j.job_id=events.entity_id))`).run(workflowId,generation).changes;
  return {jobs,events};
}
/** What still binds a workflow to this ledger: its leases and its unsettled jobs. Empty means nothing does. */
export function liveRows(db,workflowId){
  const settled=SETTLED_JOB_STATUSES.map(()=>'?').join(',');
  const leases=db.prepare('SELECT job_id,resource_key FROM leases WHERE workflow_id=? ORDER BY job_id,resource_key').all(workflowId).map(row=>({jobId:row.job_id,resource:row.resource_key}));
  const jobs=db.prepare(`SELECT job_id,status,generation FROM jobs WHERE workflow_id=? AND status NOT IN (${settled}) ORDER BY job_id`).all(workflowId,...SETTLED_JOB_STATUSES).map(row=>({jobId:row.job_id,status:row.status,generation:row.generation}));
  return {leases,jobs};
}
/**
 * Remove every row of a workflow that holds nothing live, then its `workflows` registration — the same
 * semantics as journal.retireWorkflow, extended across the ledger tables that key on workflow_id. With
 * `preserveRuntimeCustody` the latest state body and the newest receipt per runtime file stay, so the
 * `workflows` row must stay too: the kept snapshot references it.
 */
export function retireWorkflow(db,workflowId,{preserveRuntimeCustody=false}={}){
  need(workflowId,'retireWorkflow needs a workflow id');
  const live=liveRows(db,workflowId);
  if(live.leases.length||live.jobs.length)return {ok:false,workflowId,live,reason:'the workflow still holds live reservations or unsettled jobs'};
  const drop=table=>db.prepare(`DELETE FROM ${table} WHERE workflow_id=?`).run(workflowId).changes;
  if(preserveRuntimeCustody){
    const latest=db.prepare("SELECT snapshot_id,generation FROM state_snapshots WHERE workflow_id=? AND state_json<>'' ORDER BY generation DESC,snapshot_id DESC LIMIT 1").get(workflowId),
      receipts=latest?db.prepare("SELECT max(seq) seq FROM events WHERE workflow_id=? AND generation=? AND entity_type='runtime-file' AND kind='runtime-file-written' GROUP BY entity_id").all(workflowId,latest.generation).map(row=>row.seq):[],
      keep=receipts.length?receipts.map(()=>'?').join(','):null;
    const removed={
      snapshots:latest?db.prepare('DELETE FROM state_snapshots WHERE workflow_id=? AND snapshot_id<>?').run(workflowId,latest.snapshot_id).changes:db.prepare('DELETE FROM state_snapshots WHERE workflow_id=?').run(workflowId).changes,
      jobs:drop('jobs'),
      events:keep?db.prepare(`DELETE FROM events WHERE workflow_id=? AND seq NOT IN (${keep})`).run(workflowId,...receipts).changes:db.prepare('DELETE FROM events WHERE workflow_id=?').run(workflowId).changes,
      incidents:drop('incidents'),goals:drop('goals'),reports:drop('reports'),contracts:drop('contracts'),checks:drop('checks'),inbox:drop('inbox'),
      inputs:drop('inputs'),
      signals:db.prepare('DELETE FROM signals WHERE scope=?').run(workflowId).changes};
    return {ok:true,workflowId,removed,retained:{snapshots:latest?1:0,runtimeFileReceipts:receipts.length,generation:latest?.generation??null}};
  }
  const removed={
    snapshots:drop('state_snapshots'),jobs:drop('jobs'),events:drop('events'),incidents:drop('incidents'),
    goals:drop('goals'),reports:drop('reports'),contracts:drop('contracts'),checks:drop('checks'),inbox:drop('inbox'),
    inputs:drop('inputs'),
    signals:db.prepare('DELETE FROM signals WHERE scope=?').run(workflowId).changes,
    workflows:db.prepare('DELETE FROM workflows WHERE workflow_id=?').run(workflowId).changes};
  return {ok:true,workflowId,removed};
}
/** Every workflow id the ledger holds a row for, with what still binds it. */
export function ledgerWorkflows(db){
  const ids=new Set();
  for(const table of ['workflows','state_snapshots','jobs','events','leases','incidents'])for(const row of db.prepare(`SELECT DISTINCT workflow_id FROM ${table}`).all())ids.add(row.workflow_id);
  return [...ids].sort().map(workflowId=>({workflowId,...liveRows(db,workflowId),rows:{snapshots:db.prepare('SELECT count(*) n FROM state_snapshots WHERE workflow_id=?').get(workflowId).n,jobs:db.prepare('SELECT count(*) n FROM jobs WHERE workflow_id=?').get(workflowId).n,events:db.prepare('SELECT count(*) n FROM events WHERE workflow_id=?').get(workflowId).n}}));
}
/** One row per workflow the ledger owns: insert it when absent, always touch updated_at. */
export function ensureWorkflow(db,{workflowId,title=null,ledgerMode=null,sourceRoots=null,at=Date.now()}={}){
  need(workflowId,'ensureWorkflow needs a workflow id');
  db.prepare('INSERT OR IGNORE INTO workflows(workflow_id,title,created_at,updated_at,ledger_mode,source_roots_json) VALUES(?,?,?,?,?,?)').run(workflowId,title,at,at,ledgerMode,sourceRoots===null?null:json(sourceRoots));
  db.prepare('UPDATE workflows SET updated_at=? WHERE workflow_id=?').run(at,workflowId);
  return db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(workflowId);
}
/** The digest of the workflow's newest event row, or null when it has none. */
export function eventsHead(db,workflowId){
  return db.prepare('SELECT digest FROM events WHERE workflow_id=? ORDER BY seq DESC LIMIT 1').get(workflowId)?.digest??null;
}
export const inputRef=(workflowId,key,digest)=>`ledger://inputs/${workflowId}/${key}#sha256=${digest}`;
/** The input's bytes with their recorded digest proven on read: a tampered row refuses `input-digest-mismatch`. */
export function readInput(db,{workflowId,key}={}){
  need(workflowId&&key,'readInput needs a workflow id and a key');
  const row=db.prepare('SELECT * FROM inputs WHERE workflow_id=? AND key=?').get(workflowId,key);
  if(!row)return null;
  need(sha256(row.bytes)===row.sha256,'input-digest-mismatch');
  return {...row,ref:inputRef(row.workflow_id,row.key,row.sha256)};
}
/** Walk one workflow's events by seq, recomputing the chain: {ok,checked,brokenAt} where brokenAt is a seq. */
export function verifyChain(db,{workflowId}={}){
  need(workflowId,'verifyChain needs a workflow id');
  // The walk starts from the first row this ledger still holds, whatever `prev_digest` that row carries.
  // Retention (`pruneRetiredGenerations`) legitimately removes a retired generation's rows, and the surviving
  // head then names a predecessor that is gone - which is the whole point of the link: the truncation stays
  // visible. Seeding `prev` with `null` instead called every workflow that ever retired a generation broken,
  // so `ledger-verify` and the §12 continuation boundary refused every real workflow after its first retry.
  // Everything the chain actually proves is kept: each row's own digest is recomputed (so a tampered or
  // reordered row still fails) and every link inside the retained range must hold. Which history is the agreed
  // one is the anchor's question (§12), never the chain's.
  let prev,checked=0;
  for(const row of db.prepare('SELECT seq,event_id,kind,payload_json,created_at,prev_digest,digest FROM events WHERE workflow_id=? ORDER BY seq').all(workflowId)){
    if(prev===undefined)prev=row.prev_digest??null;
    if((row.prev_digest??null)!==prev||digestOf(prev,row)!==row.digest)return {ok:false,checked,brokenAt:row.seq};
    prev=row.digest;checked+=1;
  }
  return {ok:true,checked,brokenAt:null};
}

// §12 anchor: the small, tracked, human-readable counter-record `.starciwork/ledger-anchor.json`.
export const ANCHOR_SCHEMA='starci/ledger-anchor@1';
export const anchorFileFor=repoRoot=>path.join(repoRoot,'.starciwork','ledger-anchor.json');
/** The tracked anchor, or null when nothing has ever been anchored (legitimate first boot). */
export function readAnchor(repoRoot){
  need(repoRoot,'readAnchor needs a repo root');
  const file=anchorFileFor(repoRoot);
  if(!fs.existsSync(file))return null;
  return JSON.parse(fs.readFileSync(file,'utf8'));
}
/** Replace the anchor atomically (write temp + rename) with one workflow's head updated. */
export function writeAnchor(repoRoot,{ledgerId,workflowId,generation,checkpointId,eventsHead=null,seq=null,at=Date.now()}={}){
  need(repoRoot&&ledgerId&&workflowId&&Number.isInteger(generation)&&checkpointId,'writeAnchor needs a repo root, ledger id, workflow id, generation and checkpoint id');
  const current=readAnchor(repoRoot);
  need(!current||current.ledgerId===ledgerId,'ledger-identity-mismatch');
  const anchor={schema:ANCHOR_SCHEMA,ledgerId,updatedAt:at,workflows:{...current?.workflows,[workflowId]:{generation,checkpointId,eventsHead,seq,at}}};
  const dir=path.dirname(anchorFileFor(repoRoot));
  fs.mkdirSync(dir,{recursive:true});
  const tmp=path.join(dir,`.ledger-anchor.${process.pid}-${Math.random().toString(36).slice(2)}.tmp`);
  fs.writeFileSync(tmp,JSON.stringify(anchor));
  fs.renameSync(tmp,anchorFileFor(repoRoot));
  return anchor;
}
/**
 * Per §12: a tracked anchor with no ledger at all is `ledger-missing`; a ledgerId that does not match the
 * ledger's own `meta` row is `ledger-identity-mismatch`; a ledger that lacks an anchored workflow's head
 * (event digest at its seq, or a snapshot at or after its generation) is `ledger-behind-anchor`. No tracked
 * anchor, or one with no workflow heads yet, is the legitimate first boot.
 */
export function verifyAnchor(ledger,repoRoot){
  const anchor=readAnchor(repoRoot);
  if(!anchor)return {ok:true,checked:0};
  if(!ledger?.db)return {ok:false,reason:'ledger-missing'};
  const ledgerId=ledger.ledgerId??ledgerIdOf(ledger);
  if(anchor.ledgerId!==ledgerId)return {ok:false,reason:'ledger-identity-mismatch'};
  const db=ledger.db;
  let checked=0;
  for(const [workflowId,head] of Object.entries(anchor.workflows??{})){
    checked+=1;
    if(head.eventsHead!==null&&!db.prepare('SELECT 1 FROM events WHERE workflow_id=? AND seq=? AND digest=?').get(workflowId,head.seq,head.eventsHead))
      return {ok:false,reason:'ledger-behind-anchor',workflowId};
    if(!db.prepare('SELECT 1 FROM state_snapshots WHERE workflow_id=? AND generation>=? LIMIT 1').get(workflowId,head.generation))
      return {ok:false,reason:'ledger-behind-anchor',workflowId};
  }
  return {ok:true,checked};
}

// Its own constant (not inlined in LEDGER_DDL) so the schema-catalog test's `CREATE TABLE (\w+)` source scan
// - and the meta-backfill path below, which runs this exact statement standalone - each see it exactly once.
const META_TABLE_DDL='CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT NOT NULL)';
const LEDGER_DDL=`
  -- the ledger's own identity and open-mode facts. Seeded once, on create, and never rewritten (§4):
  -- ledger_id (randomUUID at create, THE identity — moves with the bytes, never derived from the path),
  -- schema, created_at (epoch ms), journal_mode ('wal' | 'delete', kept in step with what an open achieves).
  ${META_TABLE_DDL};
  CREATE TABLE workflows(
    workflow_id TEXT PRIMARY KEY, title TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    ledger_mode TEXT, source_roots_json TEXT, generation INTEGER NOT NULL DEFAULT 0,
    goal_identity TEXT, phase TEXT, finished_json TEXT, pin_digest TEXT, archived_at INTEGER);
  CREATE TABLE goals(
    goal_seq INTEGER PRIMARY KEY AUTOINCREMENT, workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id),
    revision INTEGER NOT NULL, goal_identity TEXT NOT NULL, markdown TEXT NOT NULL, json TEXT NOT NULL,
    amendment_json TEXT, created_at INTEGER NOT NULL, UNIQUE(workflow_id,revision));
  CREATE TABLE state_snapshots(
    snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT, checkpoint_id TEXT NOT NULL UNIQUE,
    workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id), generation INTEGER NOT NULL,
    goal_identity TEXT NOT NULL, state_json TEXT NOT NULL, events_head TEXT, created_at INTEGER NOT NULL);
  CREATE INDEX state_snapshots_lookup ON state_snapshots(workflow_id,generation,goal_identity,snapshot_id);
  CREATE TABLE events(
    seq INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT NOT NULL UNIQUE,
    workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id), generation INTEGER NOT NULL,
    entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, kind TEXT NOT NULL, payload_json TEXT,
    prev_digest TEXT, digest TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL);
  CREATE INDEX events_entity ON events(workflow_id,entity_type,entity_id,seq);
  CREATE INDEX events_kind ON events(workflow_id,kind,seq);
  ${EVENTS_DIGEST_TRIGGER}
  CREATE TABLE jobs(
    job_id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id), op_id TEXT,
    attempt INTEGER NOT NULL, generation INTEGER NOT NULL, kind TEXT NOT NULL, role TEXT, payload_json TEXT,
    status TEXT NOT NULL, priority_json TEXT, lease_token TEXT, worker_id TEXT, deadline INTEGER,
    result_json TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
  CREATE INDEX jobs_queue ON jobs(status,kind,created_at,job_id);
  CREATE INDEX jobs_op ON jobs(workflow_id,op_id,attempt);
  CREATE TABLE resources(resource_key TEXT PRIMARY KEY, capacity INTEGER NOT NULL CHECK(capacity>=0));
  CREATE TABLE leases(
    resource_key TEXT NOT NULL, job_id TEXT NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    workflow_id TEXT NOT NULL, op_id TEXT, attempt INTEGER NOT NULL, generation INTEGER NOT NULL,
    token TEXT NOT NULL, units INTEGER NOT NULL CHECK(units>0), acquired_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL, machine_ref TEXT,
    PRIMARY KEY(resource_key,job_id));
  CREATE INDEX leases_expiry ON leases(expires_at);
  CREATE TRIGGER leases_match_job BEFORE INSERT ON leases BEGIN
    SELECT RAISE(ABORT,'lease-identity-drift') WHERE NOT EXISTS(
      SELECT 1 FROM jobs j WHERE j.job_id=NEW.job_id AND j.workflow_id=NEW.workflow_id
        AND j.op_id IS NEW.op_id AND j.attempt=NEW.attempt AND j.generation=NEW.generation
        AND j.lease_token=NEW.token);
  END;
  CREATE TRIGGER leases_match_job_update BEFORE UPDATE ON leases BEGIN
    SELECT RAISE(ABORT,'lease-identity-drift') WHERE NOT EXISTS(
      SELECT 1 FROM jobs j WHERE j.job_id=NEW.job_id AND j.workflow_id=NEW.workflow_id
        AND j.op_id IS NEW.op_id AND j.attempt=NEW.attempt AND j.generation=NEW.generation
        AND j.lease_token=NEW.token);
  END;
  CREATE TABLE budgets(scope_key TEXT PRIMARY KEY, limit_value INTEGER NOT NULL CHECK(limit_value>=0),
    used_value INTEGER NOT NULL DEFAULT 0 CHECK(used_value>=0), reserved_value INTEGER NOT NULL DEFAULT 0 CHECK(reserved_value>=0));
  CREATE TABLE budget_reservations(scope_key TEXT NOT NULL REFERENCES budgets(scope_key), job_id TEXT NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    units INTEGER NOT NULL CHECK(units>0), PRIMARY KEY(scope_key,job_id));
  CREATE TABLE incidents(incident_id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL, op_id TEXT, attempts INTEGER NOT NULL DEFAULT 0,
    model_calls INTEGER NOT NULL DEFAULT 0, tokens INTEGER NOT NULL DEFAULT 0, elapsed_ms INTEGER NOT NULL DEFAULT 0,
    last_progress TEXT, status TEXT NOT NULL, updated_at INTEGER NOT NULL);
  CREATE TABLE reports(
    report_id INTEGER PRIMARY KEY AUTOINCREMENT, workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id),
    dispatch_id TEXT NOT NULL, op_id TEXT, attempt INTEGER, generation INTEGER, outcome TEXT NOT NULL,
    report_json TEXT NOT NULL, from_terminal TEXT, consumed_at INTEGER, created_at INTEGER NOT NULL,
    UNIQUE(workflow_id,dispatch_id));
  CREATE TABLE contracts(
    workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id), op_id TEXT NOT NULL, attempt INTEGER NOT NULL,
    dispatch_id TEXT, markdown TEXT NOT NULL, context_json TEXT, created_at INTEGER NOT NULL,
    PRIMARY KEY(workflow_id,op_id,attempt));
  CREATE TABLE checks(
    workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id), op_id TEXT NOT NULL, attempt INTEGER NOT NULL,
    checks_json TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(workflow_id,op_id,attempt));
  CREATE TABLE inbox(
    inbox_id INTEGER PRIMARY KEY AUTOINCREMENT, workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id),
    kind TEXT NOT NULL, key TEXT, payload_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
    disposition_json TEXT, created_at INTEGER NOT NULL, applied_at INTEGER);
  CREATE TABLE signals(
    scope TEXT NOT NULL, key TEXT NOT NULL,
    holder_pid INTEGER, token TEXT, value_json TEXT, at INTEGER NOT NULL, expires_at INTEGER,
    PRIMARY KEY(scope,key));
  CREATE TABLE runtime_loads(runtime TEXT PRIMARY KEY, loads_json TEXT NOT NULL, at INTEGER NOT NULL);
  -- owner-named external inputs, frozen at goal time (today: copies under the WORKTREE's .starciwork/_local/inputs/<wf>/,
  -- which die with the worktree — restart test 2026-09-17 lost 1-be-architecture-business-handoff.md and
  -- 1-architecture-partition.md this way). The bytes are the record; an op binds them by sha256, never by path.
  CREATE TABLE inputs(
    workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id), key TEXT NOT NULL,      -- '<index>-<basename>' as today
    goal_revision INTEGER NOT NULL, sha256 TEXT NOT NULL, size INTEGER NOT NULL, media_type TEXT,
    origin TEXT NOT NULL,           -- the owner's original absolute path or URL, for provenance only
    bytes BLOB NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(workflow_id,key));
  CREATE TABLE migrations(source TEXT PRIMARY KEY, kind TEXT NOT NULL, rows_json TEXT NOT NULL, at INTEGER NOT NULL);`;

const MACHINE_DDL=`
  -- ledger_id is the ledger's own meta.ledger_id (§5); file is only the last known path, refreshed on every
  -- register, and used to reopen the ledger read-only for the sweep. A moved ledger keeps its rows.
  CREATE TABLE ledgers(ledger_id TEXT PRIMARY KEY, file TEXT NOT NULL, registered_at INTEGER NOT NULL, seen_at INTEGER NOT NULL);
  CREATE TABLE resources(resource_key TEXT PRIMARY KEY, capacity INTEGER NOT NULL CHECK(capacity>=0));
  CREATE TABLE leases(
    resource_key TEXT NOT NULL, token TEXT NOT NULL, ledger_id TEXT NOT NULL REFERENCES ledgers(ledger_id),
    workflow_id TEXT NOT NULL, job_id TEXT NOT NULL, units INTEGER NOT NULL CHECK(units>0),
    acquired_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, PRIMARY KEY(resource_key,token));
  CREATE INDEX machine_leases_expiry ON leases(expires_at);
  CREATE TABLE budgets(scope_key TEXT PRIMARY KEY, limit_value INTEGER NOT NULL, used_value INTEGER NOT NULL DEFAULT 0, reserved_value INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE budget_reservations(scope_key TEXT NOT NULL, ledger_id TEXT NOT NULL, job_id TEXT NOT NULL, units INTEGER NOT NULL, PRIMARY KEY(scope_key,ledger_id,job_id));`;

const seedMeta=(db,now)=>{
  // Seeded once, on create, and never rewritten: this identity moves with the bytes (§4/§5).
  const seed=db.prepare('INSERT OR IGNORE INTO meta(key,value) VALUES(?,?)');
  seed.run('ledger_id',crypto.randomUUID());seed.run('schema',LEDGER_SCHEMA);seed.run('created_at',String(now()));
};
function migrateLedger(db,{now}){
  const version=Number(db.prepare('PRAGMA user_version').get().user_version);
  need(version<=LEDGER_VERSION,`Ledger version ${version} is newer than supported ${LEDGER_VERSION}`);
  if(version===0){
    db.exec(`BEGIN IMMEDIATE;${LEDGER_DDL}
      PRAGMA user_version=${LEDGER_VERSION};
      COMMIT;`);
    seedMeta(db,now);
    return;
  }
  // A ledger already at LEDGER_VERSION can still predate the `meta` table and the digest-chain trigger: both
  // were added to LEDGER_DDL without a version bump, so user_version alone cannot tell a fresh v1 file from
  // one built before either landed. Check the schema itself and bring it up without touching any other row.
  if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='meta'").get()){
    db.exec('BEGIN IMMEDIATE');
    try{db.exec(META_TABLE_DDL);db.exec('COMMIT');}
    catch(error){try{db.exec('ROLLBACK');}catch{}throw error;}
    seedMeta(db,now);
  }
  if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='trigger' AND name='events_digest_chain'").get())db.exec(EVENTS_DIGEST_TRIGGER);
}
function migrateMachine(db){
  const version=Number(db.prepare('PRAGMA user_version').get().user_version);
  need(version<=MACHINE_VERSION,`Machine db version ${version} is newer than supported ${MACHINE_VERSION}`);
  if(version!==0)return;
  db.exec(`BEGIN IMMEDIATE;${MACHINE_DDL}
    PRAGMA user_version=${MACHINE_VERSION};
    COMMIT;`);
}

// WAL is the default (§3): under DELETE every reader blocks the writer for the length of its read, and ten
// workers read their contracts through the ledger while the kernel writes. WAL cannot be set on some network
// and UNC paths; when the PRAGMA does not actually report `wal`, the handle falls back to DELETE rather than
// fail closed on an open — the fallback is recorded in `meta.journal_mode` by the caller.
const setJournalMode=(db,{journalMode})=>{
  const requested=String(journalMode).toUpperCase();
  need(['DELETE','WAL'].includes(requested),`Unsupported journal mode ${requested}`);
  const actual=String(db.prepare(`PRAGMA journal_mode=${requested}`).get().journal_mode).toUpperCase();
  if(requested==='WAL'&&actual!=='WAL')return String(db.prepare('PRAGMA journal_mode=DELETE').get().journal_mode).toUpperCase();
  need(actual===requested,`SQLite selected journal mode ${actual}, expected ${requested}`);
  return actual;
};
function openDb({file,busyTimeoutMs,journalMode,autoVacuum=false,label}){
  const {DatabaseSync}=require('node:sqlite');
  need(typeof file==='string'&&file.trim(),`${label} needs a file`);
  fs.mkdirSync(path.dirname(path.resolve(file)),{recursive:true});
  const db=new DatabaseSync(file,{timeout:busyTimeoutMs});
  try{
    // auto_vacuum only takes on a database SQLite still considers empty; switching to WAL first defeats it.
    if(autoVacuum)db.exec('PRAGMA auto_vacuum=INCREMENTAL');
    db.exec('PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL;');
    const sqliteVersion=db.prepare('select sqlite_version() AS version').get().version;
    const actual=setJournalMode(db,{journalMode});
    return {db,sqliteVersion,journalMode:actual};
  }catch(error){try{db.close();}catch{}throw error;}
}
const makeTransaction=(db,label)=>{let inside=false;return fn=>{if(inside)throw Error(`${label}-nested-transaction`);inside=true;db.exec('BEGIN IMMEDIATE');try{const result=fn(db);db.exec('COMMIT');return result;}catch(error){try{db.exec('ROLLBACK');}catch{}throw error;}finally{inside=false;}};};

/**
 * A ledger opened to be read and nothing else: no migration, no compaction, no reclaim. What an operator's
 * inspection, the candidate bridge and machine.sweep use on a file a kernel may hold.
 */
// The read surface both handles share: an inspection is a full read of the ledger, not a lesser one, so
// anything openLedger's handle can query (jobs, events, workflows, chain) inspectLedger's must too.
const readAccessors=db=>({
  liveRows(workflowId){return liveRows(db,workflowId);},workflows(){return ledgerWorkflows(db);},
  eventsHead(workflowId){return eventsHead(db,workflowId);},verifyChain(options={}){return verifyChain(db,options);},
  getJob(jobId){return value(db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId));},
  listJobs({status=null,kind=null}={}){let sql='SELECT * FROM jobs WHERE 1=1';const args=[];if(status){sql+=' AND status=?';args.push(status);}if(kind){sql+=' AND kind=?';args.push(kind);}sql+=' ORDER BY created_at,job_id';return db.prepare(sql).all(...args).map(value);},
  events({workflowId=null,since=null}={}){let sql='SELECT * FROM events WHERE 1=1';const args=[];if(workflowId){sql+=' AND workflow_id=?';args.push(workflowId);}if(since!==null){sql+=' AND seq>?';args.push(since);}sql+=' ORDER BY seq';return db.prepare(sql).all(...args).map(row=>({...row,payload:JSON.parse(row.payload_json)}));},
});
export function inspectLedger({file}={}){
  const {DatabaseSync}=require('node:sqlite');
  need(typeof file==='string'&&fs.existsSync(file),'inspectLedger needs an existing file');
  const db=new DatabaseSync(file,{readOnly:true,timeout:5000});
  return {schema:LEDGER_SCHEMA,file,path:path.resolve(file),db,readOnly:true,ledgerId:ledgerIdOf({db}),
    version:Number(db.prepare('PRAGMA user_version').get().user_version),
    ...readAccessors(db),
    close(){db.close();}};
}

export function openLedger({file,now=Date.now,busyTimeoutMs=15000,journalMode='WAL',machine=null}={}){
  const {db,sqliteVersion,journalMode:actual}=openDb({file,busyTimeoutMs,journalMode,autoVacuum:true,label:'openLedger'});
  registerDigestFunction(db);
  migrateLedger(db,{now});
  // Kept in step with the mode this open actually achieved, WAL or its DELETE fallback (§3).
  db.prepare("INSERT INTO meta(key,value) VALUES('journal_mode',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(actual.toLowerCase());
  const autoVacuum=Number(db.prepare('PRAGMA auto_vacuum').get().auto_vacuum);
  // Opening compacts what an older runtime left behind, for every workflow the file holds.
  db.exec('BEGIN IMMEDIATE');try{compactSnapshots(db);db.exec('COMMIT');}catch(error){try{db.exec('ROLLBACK');}catch{}throw error;}
  reclaimSpace(db);
  const transaction=makeTransaction(db,'ledger');
  const resolved=path.resolve(file),ledgerId=ledgerIdOf({db});
  if(machine?.registerLedger)machine.registerLedger({ledgerId,file:resolved});
  const handle={
    schema:LEDGER_SCHEMA,file,path:resolved,sqliteVersion,journalMode:actual,autoVacuum,db,now,transaction,ledgerId,
    checkpoint(){return runCheckpoint(db);},
    ensureWorkflow({workflowId,title=null,ledgerMode=null,sourceRoots=null}={}){return ensureWorkflow(db,{workflowId,title,ledgerMode,sourceRoots,at:now()});},
    appendEvent({eventId=newToken(),workflowId,entityType,entityId,generation=0,kind,payload=null,createdAt=now()}){
      need(workflowId&&entityType&&entityId&&kind,'Event identity and kind are required');
      ensureWorkflow(db,{workflowId,at:createdAt});
      const prev=eventsHead(db,workflowId),payloadJson=json(payload);
      db.prepare('INSERT OR IGNORE INTO events(event_id,workflow_id,generation,entity_type,entity_id,kind,payload_json,prev_digest,digest,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
        .run(eventId,workflowId,generation,entityType,entityId,kind,payloadJson,prev,digestOf(prev,{event_id:eventId,kind,payload_json:payloadJson,created_at:createdAt}),createdAt);
      return db.prepare('SELECT * FROM events WHERE event_id=?').get(eventId);
    },
    enqueueJob({jobId,workflowId,opId=null,attempt=1,generation=1,kind,role=null,payload=null,priority=null,createdAt=now()}){
      need(jobId&&workflowId&&kind,'Job identity and kind are required');
      ensureWorkflow(db,{workflowId,at:createdAt});
      db.prepare("INSERT OR IGNORE INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,priority_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?, 'queued',?,?,?)").run(jobId,workflowId,opId,attempt,generation,kind,role,json(payload),json(priority),createdAt,createdAt);
      return value(db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId));
    },
    ...readAccessors(db),
    /** The rows of a workflow that are only history now: retired generations go, then freed pages are given back. */
    retireGenerations({workflowId,generation}){const pruned=transaction(inner=>pruneRetiredGenerations(inner,{workflowId,generation}));reclaimSpace(db);return pruned;},
    /** Everything of a workflow, when nothing of it is live. */
    retireWorkflow(workflowId,options={}){const result=transaction(inner=>retireWorkflow(inner,workflowId,options));if(result.ok)reclaimSpace(db);return result;},
    inputs:{
      put({workflowId,key,goalRevision,bytes,origin,mediaType=null}={}){
        need(workflowId&&key&&Number.isInteger(goalRevision)&&bytes&&origin,'inputs.put needs a workflow, key, goal revision, bytes and origin');
        ensureWorkflow(db,{workflowId,at:now()});
        const body=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes),digest=sha256(body);
        db.prepare('INSERT INTO inputs(workflow_id,key,goal_revision,sha256,size,media_type,origin,bytes,created_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(workflow_id,key) DO UPDATE SET goal_revision=excluded.goal_revision,sha256=excluded.sha256,size=excluded.size,media_type=excluded.media_type,origin=excluded.origin,bytes=excluded.bytes,created_at=excluded.created_at')
          .run(workflowId,key,goalRevision,digest,body.length,mediaType,origin,body,now());
        return {ref:inputRef(workflowId,key,digest),sha256:digest};
      },
      get({workflowId,key}={}){return readInput(db,{workflowId,key});},
      list({workflowId}={}){need(workflowId,'inputs.list needs a workflow id');return db.prepare('SELECT workflow_id,key,goal_revision,sha256,size,media_type,origin,created_at FROM inputs WHERE workflow_id=? ORDER BY key').all(workflowId).map(row=>({...row,ref:inputRef(row.workflow_id,row.key,row.sha256)}));},
      /** Digest-checked copy for a worker that needs a file on disk; never the record. */
      materialise({workflowId,key,dir}={}){const input=readInput(db,{workflowId,key});need(input&&dir,'inputs.materialise needs a known input and a directory');fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,input.key);fs.writeFileSync(file,input.bytes);return {file,ref:input.ref,sha256:input.sha256};}
    },
    close(){db.close();}
  };
  return handle;
}

export function openMachine({file,now=Date.now,busyTimeoutMs=15000,journalMode='WAL'}={}){
  const {db,sqliteVersion,journalMode:actual}=openDb({file,busyTimeoutMs,journalMode,label:'openMachine'});
  migrateMachine(db);
  const transaction=makeTransaction(db,'machine');
  return {
    schema:MACHINE_SCHEMA,file,path:path.resolve(file),sqliteVersion,journalMode:actual,db,now,transaction,
    checkpoint(){return runCheckpoint(db);},
    // ledger_id is always the ledger's own `meta.ledger_id` (§5) — never derived here from the path.
    registerLedger({file:ledgerFile,ledgerId}={}){
      need(ledgerId,'registerLedger needs the ledger meta.ledger_id');
      const at=now();
      db.prepare('INSERT INTO ledgers(ledger_id,file,registered_at,seen_at) VALUES(?,?,?,?) ON CONFLICT(ledger_id) DO UPDATE SET file=excluded.file,seen_at=excluded.seen_at').run(ledgerId,realpathOf(ledgerFile),at,at);
      return {ledgerId};
    },
    setCapacity(resourceKey,capacity){db.prepare('INSERT INTO resources(resource_key,capacity) VALUES(?,?) ON CONFLICT(resource_key) DO UPDATE SET capacity=excluded.capacity').run(resourceKey,capacity);},
    /** Reserve cross-ledger units (ai/* quota, machine budgets). One tiny transaction of its own. */
    reserve({resourceKey,ledgerId,workflowId,jobId,units,ttlMs=null,ttl=null}={}){
      need(resourceKey&&ledgerId&&workflowId&&jobId&&Number.isInteger(units)&&units>0,'machine.reserve needs a resource, a ledger, a job and positive units');
      return transaction(inner=>{
        const at=now(),ms=ttlMs??ttl??60000;
        inner.prepare('DELETE FROM leases WHERE expires_at<=?').run(at);
        const row=inner.prepare('SELECT capacity FROM resources WHERE resource_key=?').get(resourceKey);
        if(!row)return {ok:false,reason:`resource ${resourceKey} has no declared capacity`};
        const used=inner.prepare('SELECT COALESCE(SUM(units),0) u FROM leases WHERE resource_key=?').get(resourceKey).u;
        if(used+units>row.capacity)return {ok:false,reason:`resource ${resourceKey} capacity ${row.capacity} has ${used} used and needs ${units}`};
        const token=newToken();
        inner.prepare('INSERT INTO leases(resource_key,token,ledger_id,workflow_id,job_id,units,acquired_at,expires_at) VALUES(?,?,?,?,?,?,?,?)').run(resourceKey,token,ledgerId,workflowId,jobId,units,at,at+ms);
        return {ok:true,token,expiresAt:at+ms};
      });
    },
    release(tokens){
      const list=[...new Set([tokens].flat().map(item=>typeof item==='string'?item:item?.token).filter(Boolean))];
      let released=0;for(const token of list)released+=db.prepare('DELETE FROM leases WHERE token=?').run(token).changes;
      return {ok:true,released};
    },
    /**
     * Delete expired machine rows and rows whose (ledger_id,job_id) no longer holds the paired ledger lease.
     * A registered ledger is only trusted to prove its leases gone when its own `meta.ledger_id` still
     * matches the group's key (§5/§6): a path now holding a different ledger proves the old one moved, never
     * that its leases are live, so that group is skipped, same as an inspection that fails to open at all.
     */
    sweep({inspectLedger:inspect=inspectLedger,at=now()}={}){
      let expired=0,orphaned=0;
      transaction(inner=>{
        expired=inner.prepare('DELETE FROM leases WHERE expires_at<=?').run(at).changes;
        const byLedger=new Map();
        for(const row of inner.prepare('SELECT l.resource_key,l.token,l.ledger_id,l.job_id,g.file FROM leases l JOIN ledgers g ON g.ledger_id=l.ledger_id').all()){
          const list=byLedger.get(row.ledger_id)??[];list.push(row);byLedger.set(row.ledger_id,list);
        }
        for(const [ledgerId,rows] of byLedger){
          let inspection=null;try{inspection=inspect({file:rows[0].file});}catch{inspection=null;}
          if(!inspection)continue;   // cannot prove the lease is gone; its TTL still owns it
          try{
            if(inspection.ledgerId!==ledgerId)continue;   // this path now holds a different ledger
            for(const row of rows){
              const held=inspection.db.prepare('SELECT 1 FROM leases WHERE job_id=? AND machine_ref=? LIMIT 1').get(row.job_id,row.token);
              if(!held)orphaned+=inner.prepare('DELETE FROM leases WHERE resource_key=? AND token=?').run(row.resource_key,row.token).changes;
            }
          }finally{inspection.close();}
        }
      });
      return {ok:true,expired,orphaned};
    },
    close(){db.close();}
  };
}

/**
 * §6 admission: in one ledger transaction, insert the job as leased with its repo-scoped leases, then take
 * each ai/* / machine-budget need on the machine and mirror it into a paired ledger lease carrying
 * machine_ref. Any failure rolls the ledger rows back and releases every machine token already taken.
 */
export function reserveTwoPhase(ledger,machine,{job,leases=[],machineNeeds=[],ttlMs=60000}={}){
  need(ledger?.transaction&&ledger?.db,'reserveTwoPhase needs a ledger handle');
  need(machine?.reserve&&machine?.release,'reserveTwoPhase needs a machine handle');
  need(job?.jobId&&job?.workflowId&&job?.kind&&Number.isInteger(job?.generation),'Job identity, kind and generation are required');
  const opId=job.opId??null,attempt=job.attempt??1;
  const {ledgerId}=machine.registerLedger({file:ledger.path,ledgerId:ledger.ledgerId??ledgerIdOf(ledger)});
  const merge=list=>{const byKey=new Map();for(const item of list){need(item?.resourceKey&&Number.isInteger(item.units)&&item.units>0,'Invalid resource request');const prev=byKey.get(item.resourceKey);byKey.set(item.resourceKey,{resourceKey:item.resourceKey,units:(prev?.units??0)+item.units,ttlMs:item.ttlMs??prev?.ttlMs??null});}return [...byKey.values()];};
  const repoNeeds=merge(leases),machNeeds=merge(machineNeeds),tokens=[];
  try{
    return ledger.transaction(db=>{
      const at=ledger.now(),token=newToken();
      const reasons=[];
      for(const item of repoNeeds){
        const row=db.prepare('SELECT capacity FROM resources WHERE resource_key=?').get(item.resourceKey);
        if(!row){reasons.push(`resource ${item.resourceKey} has no declared capacity`);continue;}
        const used=db.prepare('SELECT COALESCE(SUM(units),0) u FROM leases WHERE resource_key=? AND expires_at>?').get(item.resourceKey,at).u;
        if(used+item.units>row.capacity)reasons.push(`resource ${item.resourceKey} capacity ${row.capacity} has ${used} used and needs ${item.units}`);
      }
      if(reasons.length)return {ok:false,reason:reasons.join('; '),reasons};
      ensureWorkflow(db,{workflowId:job.workflowId,at});
      const existing=db.prepare('SELECT * FROM jobs WHERE job_id=?').get(job.jobId);
      if(existing){
        need(existing.workflow_id===job.workflowId&&existing.op_id===opId&&existing.attempt===attempt&&existing.generation===job.generation,'Reservation identity does not match the durable job');
        need(existing.status==='queued',`job is ${existing.status}`);
        db.prepare("UPDATE jobs SET status='leased',lease_token=?,deadline=?,updated_at=? WHERE job_id=?").run(token,at+ttlMs,at,job.jobId);
      }else db.prepare("INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,priority_json,lease_token,deadline,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,'leased',?,?,?,?,?)")
        .run(job.jobId,job.workflowId,opId,attempt,job.generation,job.kind,job.role??null,json(job.payload),json(job.priority),token,at+ttlMs,at,at);
      const insert=db.prepare('INSERT INTO leases(resource_key,job_id,workflow_id,op_id,attempt,generation,token,units,acquired_at,expires_at,machine_ref) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
      for(const item of repoNeeds)insert.run(item.resourceKey,job.jobId,job.workflowId,opId,attempt,job.generation,token,item.units,at,at+(item.ttlMs??ttlMs),null);
      for(const item of machNeeds){
        const reserved=machine.reserve({resourceKey:item.resourceKey,ledgerId,workflowId:job.workflowId,jobId:job.jobId,units:item.units,ttlMs:item.ttlMs??ttlMs});
        if(!reserved.ok)throw Object.assign(Error(reserved.reason),{reserveFailed:true});
        tokens.push(reserved.token);
        insert.run(item.resourceKey,job.jobId,job.workflowId,opId,attempt,job.generation,token,item.units,at,at+(item.ttlMs??ttlMs),reserved.token);
      }
      return {ok:true,tokens,leaseToken:token,expiresAt:at+ttlMs,fencing:Object.fromEntries([...repoNeeds,...machNeeds].map(item=>[item.resourceKey,job.generation]))};
    });
  }catch(error){
    if(tokens.length)machine.release(tokens);
    if(error.reserveFailed)return {ok:false,reason:error.message};
    throw error;
  }
}

/** The mirror of reserveTwoPhase: drop the job's lease rows, settle its fencing fields, release machine_refs. */
export function releaseTwoPhase(ledger,machine,{jobId,status=null,result=null}={}){
  need(ledger?.transaction,'releaseTwoPhase needs a ledger handle');
  need(jobId,'releaseTwoPhase needs a job id');
  const refs=ledger.transaction(db=>{
    const held=db.prepare('SELECT machine_ref FROM leases WHERE job_id=? AND machine_ref IS NOT NULL').all(jobId).map(row=>row.machine_ref);
    db.prepare('DELETE FROM leases WHERE job_id=?').run(jobId);
    if(status)db.prepare('UPDATE jobs SET status=?,result_json=?,lease_token=NULL,deadline=NULL,updated_at=? WHERE job_id=?').run(status,json(result),ledger.now(),jobId);
    else db.prepare('UPDATE jobs SET lease_token=NULL,deadline=NULL,updated_at=? WHERE job_id=?').run(ledger.now(),jobId);
    return held;
  });
  if(machine&&refs.length)machine.release(refs);
  return {ok:true,released:refs};
}
