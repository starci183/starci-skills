import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {findOwnedPathLeaseConflicts} from './admission.mjs';
const require=createRequire(import.meta.url);

// The ledger's small store vocabulary: a token mint and the settled-job set.
export const newToken=()=>crypto.randomBytes(24).toString('hex');
/**
 * The complete jobs.status vocabulary, in one place, grouped by what a row in that state still owes:
 * `dispatchable` rows are the live frontier (a queued row is the queue entry; leased/running/answering
 * hold a worker), `fenced` keeps a launch whose effect is unproven until `api reconcile` settles it, and
 * `settled` holds nothing the runtime still needs — its result is recorded or void. Every caller derives
 * its own set from this; nothing re-spells the strings. jobs.status carries no SQL CHECK: adding one to an
 * existing ledger means rebuilding the table under its foreign key and indexes, which migrateLedger
 * (additive DDL only) cannot do safely.
 */
export const JOB_STATUSES=Object.freeze({
  dispatchable:Object.freeze(['queued','leased','running','answering']),
  fenced:Object.freeze(['effect_unknown']),
  settled:Object.freeze(['succeeded','failed','cancelled']),
});
export const SETTLED_JOB_STATUSES=JOB_STATUSES.settled;
/**
 * The workflows.phase queued → running write, in one place: kernel boot (scripts/kernel/start-workflow.mjs)
 * and the first `api dispatch` of a workflow both take it. Guarded on phase='queued' so a kernel restart is
 * idempotent and a finished workflow is never regressed; the 'phase-transition' event is appended only when
 * the row actually moved, and an already-running workflow only gets a fresh updated_at. Call inside the
 * caller's transaction. Returns true when this call moved the row.
 */
export function transitionWorkflowToRunning(ledger,{workflowId,now=Date.now(),generation=null}){
  const moved=ledger.db.prepare("UPDATE workflows SET phase='running',updated_at=? WHERE workflow_id=? AND phase='queued'").run(now,workflowId).changes>0;
  if(moved)ledger.appendEvent({workflowId,entityType:'workflow',entityId:workflowId,...(generation==null?{}:{generation}),
    kind:'phase-transition',payload:{from:'queued',to:'running'},createdAt:now});
  else ledger.db.prepare('UPDATE workflows SET updated_at=? WHERE workflow_id=?').run(now,workflowId);
  return moved;
}

export const LEDGER_SCHEMA='starci/ledger-db@1';
export const LEDGER_VERSION=1;
export const MACHINE_SCHEMA='starci/machine-db@1';
export const MACHINE_VERSION=1;
/**
 * The runtime tree is never a Work root of its own: a project's Work root is its backend, reached through
 * `.workspaces`. The runtime is its own git checkout, so `git rev-parse --git-common-dir` resolves it as a
 * root for any CLI or worker whose cwd sits inside it — and a second ledger opened there is a parallel
 * record of live workflows, which is worse than no record. A ledger path rooted at the runtime is refused
 * by name.
 */
const RUNTIME_MARKER=root=>fs.existsSync(path.join(root,'bin','starci.mjs'))
  &&fs.existsSync(path.join(root,'engine','ledger-db.mjs'));
export const isRuntimeRoot=root=>RUNTIME_MARKER(path.resolve(root));
export const ledgerFileFor=repoRoot=>{
  if(typeof repoRoot!=='string'||!repoRoot.trim())throw Error('ledgerFileFor needs a repository root');
  const root=path.resolve(repoRoot);
  if(isRuntimeRoot(root))throw Object.assign(Error(`ledger-root-is-runtime: ${root} is the StarCi runtime, not a Work root; route the project through .workspaces`),{code:'STARCI_LEDGER_ROOT_IS_RUNTIME'});
  return path.join(root,'.starciwork','runtime.sqlite');
};
// The per-host runtime state root (%LOCALAPPDATA%/StarCi/runtime, or ~/.local/state/StarCi/runtime),
// keyed off the environment so a test can repoint it; kept local so this module stands alone. Machine-local
// state that is not the registry (connectors, uat-slots, watchdog logs) lives here, and it does not move
// with the registry override below.
export const runtimeRootFor=(env=process.env)=>path.join(env.LOCALAPPDATA||path.join(os.homedir(),'.local','state'),'StarCi','runtime');
/**
 * The explicit test registry: a machine.sqlite path that replaces the host's for this process tree. The
 * node --test preload (tests/setup/isolated-registry.mjs) sets it per run, and a registry named here may
 * enrol a ledger under the OS temp directory (openMachine refuses that on the live registry).
 */
export const TEST_REGISTRY_ENV='STARCI_TEST_MACHINE_FILE';
const normDir=file=>path.resolve(String(file)).replace(/\\/g,'/').replace(/\/+$/,'').toLowerCase();
const isFsRoot=dir=>/^(?:[a-z]:)?$/.test(dir);
/** The OS temp directories (os.tmpdir(), TEMP, TMP, each also as its realpath), normalized; never a filesystem root. */
export const tempDirsOf=(env=process.env)=>[...new Set([os.tmpdir(),env.TEMP,env.TMP].filter(Boolean)
  .flatMap(dir=>{const out=[normDir(dir)];try{out.push(normDir(fs.realpathSync.native(dir)));}catch{}return out;}))]
  .filter(dir=>!isFsRoot(dir));
/** True when `file` sits under one of `tempDirs` (default: the OS temp directories), as written or as its realpath. */
export function isUnderTempDir(file,{env=process.env,tempDirs=tempDirsOf(env)}={}){
  if(typeof file!=='string'||!file)return false;
  const dirs=tempDirs.map(normDir),forms=[normDir(file)];
  try{forms.push(normDir(fs.realpathSync.native(file)));}catch{/* missing: the written path decides */}
  return forms.some(form=>dirs.some(dir=>form.startsWith(`${dir}/`)));
}
/**
 * The machine registry (machine.sqlite) for `env`: the explicit test registry when TEST_REGISTRY_ENV is set;
 * else <runtime root>/machine.sqlite - except inside a node --test process tree (NODE_TEST_CONTEXT, which the
 * test runner sets and every child inheriting its env keeps) whose runtime root is not already under the OS
 * temp directory: that gets a shared registry under the OS temp directory, so no spec, and no api.mjs a spec
 * spawns, can enrol its ledgers on the live host registry.
 */
export const machineFileFor=(env=process.env)=>{
  if(env[TEST_REGISTRY_ENV])return path.resolve(env[TEST_REGISTRY_ENV]);
  const file=path.join(runtimeRootFor(env),'machine.sqlite');
  if(env.NODE_TEST_CONTEXT&&!isUnderTempDir(file,{env}))return path.join(os.tmpdir(),'starci-test-registry','machine.sqlite');
  return file;
};
const need=(ok,message)=>{if(!ok)throw Error(message);};
const json=value=>JSON.stringify(value??null);
const value=row=>row?{...row,payload:row.payload_json===null?null:JSON.parse(row.payload_json),result:row.result_json===null?null:JSON.parse(row.result_json)}:null;
const sha256=text=>crypto.createHash('sha256').update(text).digest('hex');
const realpathOf=file=>{try{return fs.realpathSync(file);}catch{return path.resolve(file);}};
// The DDL is data: `schema.sql`/`machine.sql`/`triggers.sql` beside this module are the EXECUTED source
// of truth, read here instead of duplicated. `starci_sha256` must be registered before schema.sql runs: its
// events_digest_chain trigger calls the function on every events INSERT.
const readEngineSql=name=>fs.readFileSync(new URL(name,import.meta.url),'utf8');
const SCHEMA_SQL=readEngineSql('schema.sql');
const MACHINE_SQL=readEngineSql('machine.sql');
// The events hash chain is owned by the table: `digest` defaults to '' and the events_digest_chain AFTER
// INSERT trigger computes prev_digest/digest from the workflow's own history through the registered
// `starci_sha256` function. schema.sql carries the trigger inline; triggers.sql repeats it standalone for the
// v1 backfill path in migrateLedger.
const EVENTS_DIGEST_TRIGGER=readEngineSql('triggers.sql');
const registerDigestFunction=db=>db.function('starci_sha256',{deterministic:true},text=>sha256(String(text)));
/** The ledger's own identity, from its `meta` row. Never derived from a path (§5). */
export function ledgerIdOf(handle){
  need(handle?.db,'ledgerIdOf needs a handle');
  return handle.db.prepare("SELECT value FROM meta WHERE key='ledger_id'").get()?.value??null;
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

// Its own constant so the meta-backfill path below, which runs this exact statement standalone, sees it
// once. The canonical text also lives in schema.sql (the `meta` table is the first CREATE there); this copy
// exists because a v1 ledger that predates `meta` needs the statement alone, not the whole file.
const META_TABLE_DDL='CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT NOT NULL)';

const seedMeta=(db,now)=>{
  // Seeded once, on create, and never rewritten: this identity moves with the bytes (§4/§5).
  const seed=db.prepare('INSERT OR IGNORE INTO meta(key,value) VALUES(?,?)');
  seed.run('ledger_id',crypto.randomUUID());seed.run('schema',LEDGER_SCHEMA);seed.run('created_at',String(now()));
};
// One schema step: BEGIN IMMEDIATE, the body, COMMIT; a failing body rolls back so no open transaction
// outlives the throw.
const inTransaction=(db,fn)=>{db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){try{db.exec('ROLLBACK');}catch{}throw error;}};
const userVersion=db=>Number(db.prepare('PRAGMA user_version').get().user_version);
function migrateLedger(db,{now}){
  const version=userVersion(db);
  need(version<=LEDGER_VERSION,`Ledger version ${version} is newer than supported ${LEDGER_VERSION}`);
  // Re-read under the write lock: a second process creating the same file waits here, then finds it built.
  if(version===0&&inTransaction(db,()=>{
    if(userVersion(db)!==0)return false;
    db.exec(`${SCHEMA_SQL}
      PRAGMA user_version=${LEDGER_VERSION};`);
    seedMeta(db,now);
    return true;
  }))return;
  // A ledger already at LEDGER_VERSION can still predate the `meta` table and the digest-chain trigger:
  // user_version alone cannot tell a fresh v1 file from one built before either landed. Check the schema
  // itself and bring it up without touching any other row.
  if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='meta'").get())
    inTransaction(db,()=>{db.exec(META_TABLE_DDL);seedMeta(db,now);});
  if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='trigger' AND name='events_digest_chain'").get())db.exec(EVENTS_DIGEST_TRIGGER);
}
function migrateMachine(db){
  const version=userVersion(db);
  need(version<=MACHINE_VERSION,`Machine db version ${version} is newer than supported ${MACHINE_VERSION}`);
  if(version!==0)return;
  inTransaction(db,()=>{if(userVersion(db)===0)db.exec(`${MACHINE_SQL}
    PRAGMA user_version=${MACHINE_VERSION};`);});
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
// A synchronous sleep for the open-retry backoff — the engine cannot import
// scripts/api/orca/lib.mjs's sleep (engine sits below scripts), so it uses the
// same Atomics.wait primitive inline.
const openSleep=ms=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);
// SQLITE_CANTOPEN surfaces as "unable to open database file" and is transient on Windows: a
// concurrent process mid-close can leave the WAL -shm/-wal delete-pending exactly when this
// process maps them (observed 2026-09-20, two kernels dispatching in the same second). The
// busy_timeout only covers lock waits AFTER a successful open, so the open itself gets a
// short bounded retry; every other error still fails immediately.
const OPEN_RETRY_DELAYS_MS=[0,300,900];
const cantOpen=error=>/unable to open/i.test(String(error?.message??''));
function openDb({file,busyTimeoutMs,journalMode,autoVacuum=false,label}){
  const {DatabaseSync}=require('node:sqlite');
  need(typeof file==='string'&&file.trim(),`${label} needs a file`);
  fs.mkdirSync(path.dirname(path.resolve(file)),{recursive:true});
  let lastError;
  for(const delay of OPEN_RETRY_DELAYS_MS){
    if(delay)openSleep(delay);
    let db;
    try{
      db=new DatabaseSync(file,{timeout:busyTimeoutMs});
      // auto_vacuum only takes on an empty database, before WAL; on an existing file the PRAGMA is a header
      // write that waits on any held write lock, so it runs on a new file only.
      if(autoVacuum&&Number(db.prepare('PRAGMA page_count').get().page_count)===0)db.exec('PRAGMA auto_vacuum=INCREMENTAL');
      db.exec('PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL;');
      const sqliteVersion=db.prepare('select sqlite_version() AS version').get().version;
      const actual=setJournalMode(db,{journalMode});
      return {db,sqliteVersion,journalMode:actual};
    }catch(error){
      try{db?.close();}catch{}
      if(!cantOpen(error))throw error;
      lastError=error;
    }
  }
  throw lastError;
}
const makeTransaction=(db,label)=>{let inside=false;return fn=>{if(inside)throw Error(`${label}-nested-transaction`);inside=true;db.exec('BEGIN IMMEDIATE');try{const result=fn(db);db.exec('COMMIT');return result;}catch(error){try{db.exec('ROLLBACK');}catch{}throw error;}finally{inside=false;}};};

// The read surface both handles share: an inspection is a full read of the ledger, not a lesser one.
const readAccessors=db=>({
  eventsHead(workflowId){return eventsHead(db,workflowId);},
  getJob(jobId){return value(db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId));},
  listJobs({status=null,kind=null}={}){let sql='SELECT * FROM jobs WHERE 1=1';const args=[];if(status){sql+=' AND status=?';args.push(status);}if(kind){sql+=' AND kind=?';args.push(kind);}sql+=' ORDER BY created_at,job_id';return db.prepare(sql).all(...args).map(value);},
  events({workflowId=null,since=null}={}){let sql='SELECT * FROM events WHERE 1=1';const args=[];if(workflowId){sql+=' AND workflow_id=?';args.push(workflowId);}if(since!==null){sql+=' AND seq>?';args.push(since);}sql+=' ORDER BY seq';return db.prepare(sql).all(...args).map(row=>({...row,payload:JSON.parse(row.payload_json)}));},
});
/** A ledger opened read-only: no migration, no writes. What operator inspection and the connectors use. */
export function inspectLedger({file}={}){
  const {DatabaseSync}=require('node:sqlite');
  need(typeof file==='string'&&fs.existsSync(file),'inspectLedger needs an existing file');
  const db=new DatabaseSync(file,{readOnly:true,timeout:5000});
  return {schema:LEDGER_SCHEMA,file,path:path.resolve(file),db,readOnly:true,ledgerId:ledgerIdOf({db}),
    version:Number(db.prepare('PRAGMA user_version').get().user_version),
    ...readAccessors(db),
    close(){db.close();}};
}

/**
 * The read-write handle. Opening an established ledger writes nothing: the schema steps and the
 * `meta.journal_mode` record run only when the file needs them, so an open never waits on, or takes, the
 * write lock another kernel holds.
 */
export function openLedger({file,now=Date.now,busyTimeoutMs=15000,journalMode='WAL',machine=null}={}){
  const {db,sqliteVersion,journalMode:actual}=openDb({file,busyTimeoutMs,journalMode,autoVacuum:true,label:'openLedger'});
  try{
    registerDigestFunction(db);
    migrateLedger(db,{now});
    // Kept in step with the mode this open actually achieved, WAL or its DELETE fallback (§3).
    const mode=actual.toLowerCase();
    if(db.prepare("SELECT value FROM meta WHERE key='journal_mode'").get()?.value!==mode)
      db.prepare("INSERT INTO meta(key,value) VALUES('journal_mode',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(mode);
  }catch(error){try{db.close();}catch{}throw error;}
  const autoVacuum=Number(db.prepare('PRAGMA auto_vacuum').get().auto_vacuum);
  const transaction=makeTransaction(db,'ledger');
  const resolved=path.resolve(file),ledgerId=ledgerIdOf({db});
  if(machine?.registerLedger)machine.registerLedger({ledgerId,file:resolved});
  return {
    schema:LEDGER_SCHEMA,file,path:resolved,sqliteVersion,journalMode:actual,autoVacuum,db,now,transaction,ledgerId,
    ensureWorkflow({workflowId,title=null,ledgerMode=null,sourceRoots=null}={}){return ensureWorkflow(db,{workflowId,title,ledgerMode,sourceRoots,at:now()});},
    /** One events row; the table's trigger computes its hash-chain link. A duplicate event_id throws. */
    appendEvent({eventId=newToken(),workflowId,entityType,entityId,generation=0,kind,payload=null,createdAt=now()}){
      need(workflowId&&entityType&&entityId&&kind,'Event identity and kind are required');
      ensureWorkflow(db,{workflowId,at:createdAt});
      const {lastInsertRowid}=db.prepare('INSERT INTO events(event_id,workflow_id,generation,entity_type,entity_id,kind,payload_json,created_at) VALUES(?,?,?,?,?,?,?,?)')
        .run(eventId,workflowId,generation,entityType,entityId,kind,json(payload),createdAt);
      return db.prepare('SELECT * FROM events WHERE seq=?').get(lastInsertRowid);
    },
    enqueueJob({jobId,workflowId,opId=null,attempt=1,generation=1,kind,role=null,payload=null,priority=null,createdAt=now()}){
      need(jobId&&workflowId&&kind,'Job identity and kind are required');
      ensureWorkflow(db,{workflowId,at:createdAt});
      db.prepare("INSERT OR IGNORE INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,priority_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?, 'queued',?,?,?)").run(jobId,workflowId,opId,attempt,generation,kind,role,json(payload),json(priority),createdAt,createdAt);
      return value(db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId));
    },
    ...readAccessors(db),
    close(){db.close();}
  };
}

/**
 * One-shot, idempotent registry maintenance: delete the `ledgers` rows whose file is missing or under the OS
 * temp directory (`tempDirs`) - what specs enrolled on a registry before the test registry existed. A ledger
 * that exists outside the temp directories is never touched, and a row that still owns machine leases or
 * budget reservations is kept whatever its path. A pruned product
 * ledger that was only missing for a moment re-registers on its next reservation: the row is a cache of the
 * ledger's own meta.ledger_id and path. `dryRun` counts without deleting. Returns
 * {ok, dryRun, before, after, pruned, missing, temp, kept:[{ledgerId,file,reason}]}.
 */
export function pruneRegistry(machine,{env=process.env,tempDirs=tempDirsOf(env),dryRun=false,exists=fs.existsSync}={}){
  need(machine?.db,'pruneRegistry needs a machine handle');
  const {db}=machine,count=()=>Number(db.prepare('SELECT count(*) n FROM ledgers').get().n);
  const before=count(),victims=[],kept=[];
  let missing=0,temp=0;
  const held=db.prepare('SELECT (SELECT count(*) FROM leases WHERE ledger_id=?)+(SELECT count(*) FROM budget_reservations WHERE ledger_id=?) n');
  for(const row of db.prepare('SELECT ledger_id,file FROM ledgers ORDER BY ledger_id').all()){
    const isTemp=isUnderTempDir(row.file,{env,tempDirs}),isMissing=!isTemp&&!exists(row.file);
    if(!isTemp&&!isMissing)continue;
    if(Number(held.get(row.ledger_id,row.ledger_id).n)>0){kept.push({ledgerId:row.ledger_id,file:row.file,reason:'holds machine leases or budget reservations'});continue;}
    victims.push(row.ledger_id);if(isTemp)temp++;else missing++;
  }
  if(!dryRun&&victims.length){
    const drop=inner=>{const del=inner.prepare('DELETE FROM ledgers WHERE ledger_id=?');for(const id of victims)del.run(id);};
    if(machine.transaction)machine.transaction(drop);else{db.exec('BEGIN IMMEDIATE');try{drop(db);db.exec('COMMIT');}catch(error){try{db.exec('ROLLBACK');}catch{}throw error;}}
  }
  return {ok:true,dryRun,before,after:dryRun?before:count(),pruned:victims.length,missing,temp,kept};
}

/**
 * `env`/`tempDirs` decide which registry this is: one outside the OS temp directory, with no explicit test
 * registry (TEST_REGISTRY_ENV) in `env`, is the live host registry, and it refuses to enrol a ledger under the
 * OS temp directory - a spec's fixture, whose row would outlive the spec in every later scan.
 */
export function openMachine({file,now=Date.now,busyTimeoutMs=15000,journalMode='WAL',env=process.env,tempDirs=tempDirsOf(env)}={}){
  const {db,sqliteVersion,journalMode:actual}=openDb({file,busyTimeoutMs,journalMode,label:'openMachine'});
  migrateMachine(db);
  const transaction=makeTransaction(db,'machine');
  const live=!env[TEST_REGISTRY_ENV]&&!isUnderTempDir(file,{env,tempDirs});
  return {
    schema:MACHINE_SCHEMA,file,path:path.resolve(file),sqliteVersion,journalMode:actual,db,now,transaction,live,
    // ledger_id is always the ledger's own `meta.ledger_id` (§5) — never derived here from the path.
    // Returns {ledgerId,registered:true}, or {ledgerId,registered:false,refused} when the live registry
    // refuses a temp-directory ledger: nothing is written.
    registerLedger({file:ledgerFile,ledgerId}={}){
      need(ledgerId,'registerLedger needs the ledger meta.ledger_id');
      if(live&&isUnderTempDir(ledgerFile,{env,tempDirs}))
        return {ledgerId,registered:false,refused:`registry-temp-ledger: ${path.resolve(ledgerFile)} is under the OS temp directory and ${path.resolve(file)} is the live registry; set ${TEST_REGISTRY_ENV} to a test registry`};
      const at=now();
      db.prepare('INSERT INTO ledgers(ledger_id,file,registered_at,seen_at) VALUES(?,?,?,?) ON CONFLICT(ledger_id) DO UPDATE SET file=excluded.file,seen_at=excluded.seen_at').run(ledgerId,realpathOf(ledgerFile),at,at);
      return {ledgerId,registered:true};
    },
    /** One-shot registry maintenance: see pruneRegistry. */
    pruneRegistry(options={}){return pruneRegistry({db,transaction},{env,tempDirs,...options});},
    /** Drop machine leases by token (a ledger lease's machine_ref). */
    release(tokens){
      const list=[...new Set([tokens].flat().map(item=>typeof item==='string'?item:item?.token).filter(Boolean))];
      let released=0;for(const token of list)released+=db.prepare('DELETE FROM leases WHERE token=?').run(token).changes;
      return {ok:true,released};
    },
    close(){db.close();}
  };
}

/**
 * Admission: in one ledger transaction, refuse on a durable path-lease overlap or a full repo resource, else
 * flip the job to leased (or insert it leased) with its fencing token and write its repo-scoped leases. The
 * ledger is registered on the machine registry first.
 */
export function reserveTwoPhase(ledger,machine,{job,leases=[],ttlMs=60000,canonicalOf=null}={}){
  need(ledger?.transaction&&ledger?.db,'reserveTwoPhase needs a ledger handle');
  need(machine?.registerLedger,'reserveTwoPhase needs a machine handle');
  need(job?.jobId&&job?.workflowId&&job?.kind&&Number.isInteger(job?.generation),'Job identity, kind and generation are required');
  const opId=job.opId??null,attempt=job.attempt??1;
  const merge=list=>{const byKey=new Map();for(const item of list){need(item?.resourceKey&&Number.isInteger(item.units)&&item.units>0,'Invalid resource request');const prev=byKey.get(item.resourceKey);byKey.set(item.resourceKey,{resourceKey:item.resourceKey,units:(prev?.units??0)+item.units,ttlMs:item.ttlMs??prev?.ttlMs??null});}return [...byKey.values()];};
  const repoNeeds=merge(leases);
  machine.registerLedger({file:ledger.path,ledgerId:ledger.ledgerId??ledgerIdOf(ledger)});
  return ledger.transaction(db=>{
    const at=ledger.now(),token=newToken();
    const reasons=[];
    const pathConflicts=findOwnedPathLeaseConflicts(db,repoNeeds,{canonicalOf});
    for(const conflict of pathConflicts)reasons.push(`resource ${conflict.requested} overlaps durable lease ${conflict.held} held by ${conflict.job_id}`);
    for(const item of repoNeeds){
      const row=db.prepare('SELECT capacity FROM resources WHERE resource_key=?').get(item.resourceKey);
      if(!row){reasons.push(`resource ${item.resourceKey} has no declared capacity`);continue;}
      const used=db.prepare('SELECT COALESCE(SUM(units),0) u FROM leases WHERE resource_key=? AND expires_at>?').get(item.resourceKey,at).u;
      if(used+item.units>row.capacity)reasons.push(`resource ${item.resourceKey} capacity ${row.capacity} has ${used} used and needs ${item.units}`);
    }
    // pathConflicts rides on the refusal so a caller can tell a write set another job still owns (a
    // wait: the job stays queued until that lease is released) from a launcher or capacity failure.
    if(reasons.length)return {ok:false,reason:reasons.join('; '),reasons,pathConflicts:pathConflicts.map(({requested,held,job_id,workflow_id,op_id,expires_at})=>({requested,held,jobId:job_id,workflowId:workflow_id,opId:op_id,expiresAt:expires_at}))};
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
    return {ok:true,leaseToken:token,expiresAt:at+ttlMs,fencing:Object.fromEntries(repoNeeds.map(item=>[item.resourceKey,job.generation]))};
  });
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
