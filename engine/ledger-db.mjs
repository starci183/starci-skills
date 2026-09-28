import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {findOwnedPathLeaseConflicts} from './admission.mjs';
import {sha256} from './digest.mjs';
import {putBlob,blobPath} from '../scripts/lib/artifact-store.mjs';
const require=createRequire(import.meta.url);

/*
 * runtime.sqlite — the ONE writer (and the reader opener) of a project's runtime ledger (DBTREE.sql PHẦN A,
 * ARCHITECTURE-DB §4, RESEARCH-STORAGE §3). The DDL is engine/migrations/runtime/0001-init.sql, executed as is:
 * STRICT tables, state machines, append-only guards and views live IN the database, so an invalid write is refused
 * at the write whatever code issued it. Clean slate (alpha.3): a file that is not 'starci/runtime@1' is refused
 * with a pointer to the comeback; there is no migrator, no backfill and no legacy table.
 *
 * Every write to runtime.sqlite goes through the typed functions below (`write.*` on the handle, or the exported
 * functions taking a db inside a transaction). Each state change appends exactly one events row in the same
 * transaction; the events hash chain (digest) is computed here, in JS.
 */

// ---------------------------------------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------------------------------------
export const newToken=()=>crypto.randomBytes(24).toString('hex');
/** W3C trace id (32 hex) and span id (16 hex). */
export const newTraceId=()=>crypto.randomBytes(16).toString('hex');
export const newSpanId=()=>crypto.randomBytes(8).toString('hex');
/** The TRACEPARENT an op receives: 00-<trace>-<span>-01. */
export const traceparent=(traceId,spanId)=>`00-${traceId}-${spanId}-01`;
/**
 * jobs.status (DBTREE A4 job_transitions), grouped by what a row in that state still owes: `dispatchable` rows are the
 * live frontier, `awaiting` wait on a settle or decision, `fenced` keeps a launch whose effect is unproven, `settled`
 * holds nothing the runtime still needs. The SQL CHECK and job_transitions are the authority; this is their mirror.
 */
export const JOB_STATUSES=Object.freeze({
  dispatchable:Object.freeze(['queued','ready','leased','running','answering']),
  awaiting:Object.freeze(['reported','deciding']),
  fenced:Object.freeze(['effect_unknown']),
  settled:Object.freeze(['succeeded','failed','cancelled']),
});
export const SETTLED_JOB_STATUSES=JOB_STATUSES.settled;
export const WORKFLOW_PHASES=Object.freeze(['awaiting-approval','queued','running','paused','stopped','finished','archived']);
export const UNIT_STATES=Object.freeze(['planned','queued','running','reported','deciding','done','failed','dropped']);
export const DEFAULT_TRY_BUDGET=5;
export const JOB_ARTIFACT_KINDS=Object.freeze(['diff','patch','image','video','report','log','trace','file']);
export const JOB_ARTIFACT_SUBKINDS=Object.freeze(['draw-render','asset-gen','app-capture','e2e-capture','uat-capture','uat-video','e2e-video',
  'playwright-trace','patch','patch-json','diff','report','log','critique','metrics','grammar-proposal','asset-request','terminal-transcript','cli-transcript']);
export const JOB_ARTIFACT_ROLES=Object.freeze(['check-output','check-stdout','check-stderr','patch','diff','report-attachment','log',
  'direction','prompt','render','redline','critique','capture','dom','screenshot','video','trace','uat-run','metrics','salvage','scan','other']);

export const LEDGER_SCHEMA='starci/runtime@1';
export const LEDGER_VERSION=1;
export const MACHINE_SCHEMA='starci/machine-db@1';
export const MACHINE_VERSION=1;
/** Where the comeback lives: every refusal of an old ledger names it. */
export const COMEBACK_HINT='run the alpha.3 comeback (node scripts/supervisor/comeback.mjs) to archive the old runtime state and create a fresh runtime.sqlite';

const need=(ok,message,code)=>{if(!ok)throw Object.assign(Error(message),code?{code}:{});};
const json=value=>value===undefined||value===null?null:JSON.stringify(value);
const parseJson=text=>text===null||text===undefined?null:JSON.parse(text);

// ---------------------------------------------------------------------------------------------------------
// Paths (decision Q1: runtime.sqlite lives OUT of .starciwork, at %LOCALAPPDATA%/StarCi/projects/<ledger_id>/)
// ---------------------------------------------------------------------------------------------------------
/**
 * The runtime tree is never a Work root of its own: a project's Work root is its backend, reached through
 * `.workspaces`. A ledger for a root inside the runtime checkout is refused by name.
 */
const RUNTIME_MARKER=root=>fs.existsSync(path.join(root,'bin','starci.mjs'))
  &&fs.existsSync(path.join(root,'engine','ledger-db.mjs'));
export const isRuntimeRoot=root=>RUNTIME_MARKER(path.resolve(root));
// The per-host runtime state root (%LOCALAPPDATA%/StarCi/runtime, or ~/.local/state/StarCi/runtime).
const localStateRoot=(env=process.env)=>path.join(env.LOCALAPPDATA||path.join(os.homedir(),'.local','state'),'StarCi');
export const runtimeRootFor=(env=process.env)=>path.join(localStateRoot(env),'runtime');
/**
 * The explicit test registry: a machine.sqlite path that replaces the host's for this process tree.
 */
export const TEST_REGISTRY_ENV='STARCI_TEST_MACHINE_FILE';
/** Overrides the projects root (the directory holding <ledger_id>/runtime.sqlite) for this process tree. */
export const PROJECTS_ROOT_ENV='STARCI_PROJECTS_ROOT';
const normDir=file=>path.resolve(String(file)).replace(/\\/g,'/').replace(/\/+$/,'').toLowerCase();
const isFsRoot=dir=>/^(?:[a-z]:)?$/.test(dir);
/** The OS temp directories (os.tmpdir(), TEMP, TMP, each also as its realpath), normalized; never a filesystem root. */
const tempDirsOf=(env=process.env)=>[...new Set([os.tmpdir(),env.TEMP,env.TMP].filter(Boolean)
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
 * The machine registry (machine.sqlite) for `env`: the explicit test registry when TEST_REGISTRY_ENV is set; else
 * <runtime root>/machine.sqlite - except inside a node --test process tree, which gets a registry under the OS temp dir.
 */
export const machineFileFor=(env=process.env)=>{
  if(env[TEST_REGISTRY_ENV])return path.resolve(env[TEST_REGISTRY_ENV]);
  const file=path.join(runtimeRootFor(env),'machine.sqlite');
  if(env.NODE_TEST_CONTEXT&&!isUnderTempDir(file,{env}))return path.join(os.tmpdir(),'starci-test-registry','machine.sqlite');
  return file;
};
/** %LOCALAPPDATA%/StarCi/projects (a node --test process tree gets one under the OS temp directory). */
export const projectsRootFor=(env=process.env)=>{
  if(env[PROJECTS_ROOT_ENV])return path.resolve(env[PROJECTS_ROOT_ENV]);
  const root=path.join(localStateRoot(env),'projects');
  if(env.NODE_TEST_CONTEXT&&!isUnderTempDir(root,{env}))return path.join(os.tmpdir(),'starci-test-projects');
  return root;
};
/** The normalized identity of a repository root: resolved, realpath when it exists, forward slashes, lower case. */
export const repoRootKey=repoRoot=>{let root=path.resolve(repoRoot);try{root=fs.realpathSync.native(root);}catch{}return normDir(root);};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/**
 * The ledger id of a repository root until the machine registry (a3-2 machine.ledgers) resolves it: a name-based
 * UUID of the normalized root, so the same root always names the same ledger and no side registry is needed.
 */
export const ledgerIdForRepo=repoRoot=>{
  const h=sha256(`starci-ledger:${repoRootKey(repoRoot)}`);
  return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-${(8|(parseInt(h[16],16)&3)).toString(16)}${h.slice(17,20)}-${h.slice(20,32)}`;
};
// file → repo root, for the meta seed of a ledger created through ledgerFileFor.
const repoRootOfFile=new Map();
/**
 * The runtime.sqlite of a project, by its Work-root repository: <projects root>/<ledger_id>/runtime.sqlite.
 * The returned file may not exist yet; openLedger on it creates the ledger with that ledger_id and repo_root.
 */
export const ledgerFileFor=(repoRoot,{env=process.env}={})=>{
  if(typeof repoRoot!=='string'||!repoRoot.trim())throw Error('ledgerFileFor needs a repository root');
  const root=path.resolve(repoRoot);
  if(isRuntimeRoot(root))throw Object.assign(Error(`ledger-root-is-runtime: ${root} is the StarCi runtime, not a Work root; route the project through .workspaces`),{code:'STARCI_LEDGER_ROOT_IS_RUNTIME'});
  const file=path.join(projectsRootFor(env),ledgerIdForRepo(root),'runtime.sqlite');
  repoRootOfFile.set(path.resolve(file),root);
  return file;
};

// ---------------------------------------------------------------------------------------------------------
// Connection policy (DBTREE header "PRAGMA lúc mở", RESEARCH-STORAGE §3)
// ---------------------------------------------------------------------------------------------------------
const INIT_SQL_FILE=new URL('./migrations/runtime/0001-init.sql',import.meta.url);
const INIT_SQL=fs.readFileSync(INIT_SQL_FILE,'utf8');
const INIT_SQL_SHA=sha256(INIT_SQL);
export const LEDGER_BUSY_TIMEOUT_MS=15000;
/**
 * Writer pragmas. wal_autocheckpoint=0 on EVERY connection except the one checkpointer (openLedger({checkpointer:true}),
 * the reconciler engine): SQLite 3.50.4 (node:sqlite of Node 25.2.1) sits in the WAL-reset bug range 3.7.0–3.51.2 when two
 * connections checkpoint concurrently.
 */
export const LEDGER_PRAGMAS=Object.freeze({synchronous:'NORMAL',foreign_keys:'ON',temp_store:'MEMORY',cache_size:-16000,
  journal_size_limit:67108864,trusted_schema:'OFF',wal_autocheckpoint:0});
export const CHECKPOINTER_AUTOCHECKPOINT=8000;
const READ_PRAGMAS=Object.freeze({query_only:'ON',temp_store:'MEMORY',cache_size:-16000,trusted_schema:'OFF'});
const applyPragmas=(db,pragmas)=>db.exec(Object.entries(pragmas).map(([k,v])=>`PRAGMA ${k}=${v};`).join(' '));
/** The pragma values a handle actually runs with. */
export const connectionFacts=db=>({journalMode:String(db.prepare('PRAGMA journal_mode').get().journal_mode).toLowerCase(),
  synchronous:Number(db.prepare('PRAGMA synchronous').get().synchronous),busyTimeoutMs:Number(db.prepare('PRAGMA busy_timeout').get().timeout),
  tempStore:Number(db.prepare('PRAGMA temp_store').get().temp_store),cacheSize:Number(db.prepare('PRAGMA cache_size').get().cache_size),
  walAutocheckpoint:Number(db.prepare('PRAGMA wal_autocheckpoint').get().wal_autocheckpoint),
  foreignKeys:Number(db.prepare('PRAGMA foreign_keys').get().foreign_keys),queryOnly:Number(db.prepare('PRAGMA query_only').get().query_only)});
/** True for SQLITE_BUSY / SQLITE_LOCKED ("database is locked"). */
export const isBusyError=error=>error?.errcode===5||error?.errcode===6||/SQLITE_BUSY|database is (?:locked|busy)/i.test(String(error?.message??error));
/** BEGIN IMMEDIATE: spin for `spinMs` without the busy handler's 15 ms sleeps, then wait with the connection's busy_timeout. */
export const LEDGER_SPIN_MS=20;
export function beginImmediate(db,{spinMs=LEDGER_SPIN_MS}={}){
  if(spinMs>0){
    const busyTimeoutMs=Number(db.prepare('PRAGMA busy_timeout').get()?.timeout??LEDGER_BUSY_TIMEOUT_MS);
    db.exec('PRAGMA busy_timeout=0');
    try{
      const until=performance.now()+spinMs;
      for(;;){
        try{db.exec('BEGIN IMMEDIATE');return;}
        catch(error){if(!isBusyError(error))throw error;if(performance.now()>=until)break;}
      }
    }finally{db.exec(`PRAGMA busy_timeout=${Math.trunc(busyTimeoutMs)}`);}
  }
  db.exec('BEGIN IMMEDIATE');
}
let openLedgerTransactions=0;
/** Ledger write transactions open in THIS process (the typed-log writer never flushes inside one). */
export const ledgerTransactionDepth=()=>openLedgerTransactions;
const openSleep=ms=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);
// SQLITE_CANTOPEN is transient on Windows while a concurrent process closes the WAL files: a short bounded retry.
const OPEN_RETRY_DELAYS_MS=[0,300,900];
const cantOpen=error=>/unable to open/i.test(String(error?.message??''));
function openDb({file,busyTimeoutMs,journalMode='WAL',autoVacuum=false,label,pragmas=LEDGER_PRAGMAS}){
  const {DatabaseSync}=require('node:sqlite');
  need(typeof file==='string'&&file.trim(),`${label} needs a file`);
  fs.mkdirSync(path.dirname(path.resolve(file)),{recursive:true});
  let lastError;
  for(const delay of OPEN_RETRY_DELAYS_MS){
    if(delay)openSleep(delay);
    let db;
    try{
      db=new DatabaseSync(file,{timeout:busyTimeoutMs});
      // page_size/auto_vacuum only take on an empty database, before WAL and before the first table.
      if(autoVacuum&&Number(db.prepare('PRAGMA page_count').get().page_count)===0)db.exec('PRAGMA page_size=4096; PRAGMA auto_vacuum=INCREMENTAL;');
      const sqliteVersion=db.prepare('select sqlite_version() AS version').get().version;
      const actual=String(db.prepare(`PRAGMA journal_mode=${journalMode}`).get().journal_mode).toUpperCase();
      need(actual===String(journalMode).toUpperCase(),`${label}: SQLite selected journal mode ${actual}, expected ${journalMode} (a network or UNC path cannot hold WAL)`,'STARCI_LEDGER_NOT_WAL');
      applyPragmas(db,pragmas);
      return {db,sqliteVersion,journalMode:actual};
    }catch(error){
      try{db?.close();}catch{}
      if(!cantOpen(error))throw error;
      lastError=error;
    }
  }
  throw lastError;
}
// handle.transaction(fn): BEGIN IMMEDIATE … COMMIT; a nested call throws. transaction.active() tells whether one is open,
// so the handle's one-call writes (write.*, ensureWorkflow, appendEvent, enqueueJob) join an open transaction instead.
const makeTransaction=(db,label)=>{let inside=false;const tx=fn=>{if(inside)throw Error(`${label}-nested-transaction`);inside=true;try{beginImmediate(db);}catch(error){inside=false;throw error;}openLedgerTransactions++;try{const result=fn(db);db.exec('COMMIT');return result;}catch(error){try{db.exec('ROLLBACK');}catch{}throw error;}finally{inside=false;openLedgerTransactions--;}};tx.active=()=>inside;return tx;};
const userVersion=db=>Number(db.prepare('PRAGMA user_version').get().user_version);
const metaOf=db=>Object.fromEntries(db.prepare('SELECT key,value FROM meta').all().map(row=>[row.key,row.value]));
const hasTable=(db,name)=>Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));
/** True when the ledger `db` holds `table`. */
export const hasLedgerTable=hasTable;
/** True when `table` of the ledger `db` has `column`. */
export const hasLedgerColumn=(db,table,column)=>db.prepare(`PRAGMA table_info(${table})`).all().some(c=>c.name===column);
const versionTuple=v=>String(v).split('.').map(Number);
const olderThan=(a,b)=>{const x=versionTuple(a),y=versionTuple(b);for(let i=0;i<Math.max(x.length,y.length);i++){if((x[i]??0)!==(y[i]??0))return (x[i]??0)<(y[i]??0);}return false;};

/**
 * Refuse any file that is not a starci/runtime@1 ledger at user_version 1 (clean slate: no migration). Also refuses a
 * running SQLite older than the one the ledger recorded.
 */
function verifyLedger(db,{file,sqliteVersion}){
  const version=userVersion(db);
  const legacy=hasTable(db,'meta')?metaOf(db).schema:(hasTable(db,'jobs')||hasTable(db,'events')?'pre-meta':null);
  need(version===LEDGER_VERSION&&legacy===LEDGER_SCHEMA,
    `ledger-schema-refused: ${file} is ${legacy??'not a StarCi ledger'} at user_version ${version}, this runtime opens only ${LEDGER_SCHEMA} at user_version ${LEDGER_VERSION}; ${COMEBACK_HINT}`,'STARCI_LEDGER_SCHEMA_REFUSED');
  const recorded=metaOf(db).sqlite_version;
  need(!recorded||!olderThan(sqliteVersion,recorded),`ledger-sqlite-downgrade: ${file} was last opened by SQLite ${recorded}, this process runs ${sqliteVersion}`,'STARCI_LEDGER_SQLITE_DOWNGRADE');
}

/** Create the ledger on an empty file: 0001-init.sql, user_version=1, meta, schema_migrations — one transaction. */
function initLedger(db,{file,now,sqliteVersion,journalMode,repoRoot=null,product=null,ledgerId=null}){
  const empty=()=>userVersion(db)===0&&!db.prepare("SELECT 1 FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' LIMIT 1").get();
  if(!empty())return false;
  beginImmediate(db);
  try{
    if(!empty()){db.exec('ROLLBACK');return false;}
    const at=now();
    db.exec(INIT_SQL);
    db.exec(`PRAGMA user_version=${LEDGER_VERSION}`);
    const dirId=path.basename(path.dirname(path.resolve(file)));
    const id=ledgerId??(UUID.test(dirId)?dirId:crypto.randomUUID());
    const seed=db.prepare('INSERT INTO meta(key,value) VALUES(?,?)');
    const meta={ledger_id:id,schema:LEDGER_SCHEMA,created_at:String(at),journal_mode:journalMode.toLowerCase(),sqlite_version:sqliteVersion,
      blob_root:path.resolve(process.env.STARCI_ARTIFACT_ROOT||path.join(os.homedir(),'.starci','artifacts')),runtime_rev:runtimeRev()};
    if(repoRoot)meta.repo_root=path.resolve(repoRoot);
    if(product)meta.product=product;
    for(const [k,v] of Object.entries(meta))if(v!=null)seed.run(k,String(v));
    db.prepare("INSERT INTO schema_migrations(version,name,runtime_rev,sql_sha256,started_at,finished_at,status) VALUES(1,'0001-init',?,?,?,?,'done')")
      .run(meta.runtime_rev,INIT_SQL_SHA,at,now());
    db.exec('COMMIT');
    return true;
  }catch(error){try{db.exec('ROLLBACK');}catch{}throw error;}
}
let cachedRev;
function runtimeRev(){
  if(cachedRev!==undefined)return cachedRev;
  try{
    const root=path.dirname(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([a-z]:)/i,'$1')));
    const head=fs.readFileSync(path.join(root,'.git','HEAD'),'utf8').trim();
    cachedRev=head.startsWith('ref:')?fs.readFileSync(path.join(root,'.git',head.slice(5).trim()),'utf8').trim():head;
  }catch{cachedRev=null;}
  return cachedRev;
}

/** The ledger's own identity, from its `meta` row. Never derived from a path (§5). */
export function ledgerIdOf(handle){
  need(handle?.db,'ledgerIdOf needs a handle');
  return handle.db.prepare("SELECT value FROM meta WHERE key='ledger_id'").get()?.value??null;
}

// ---------------------------------------------------------------------------------------------------------
// Readers: read-only handles (readOnly, query_only=ON, busy_timeout), never the writer's connection
// ---------------------------------------------------------------------------------------------------------
/** A runtime.sqlite opened read-only with the enforced busy_timeout — what every reader outside the writer uses. */
export function openLedgerReader(file,{busyTimeoutMs=LEDGER_BUSY_TIMEOUT_MS,verify=true,queryOnly=true}={}){
  const {DatabaseSync}=require('node:sqlite');
  const db=new DatabaseSync(file,{readOnly:true,timeout:busyTimeoutMs});
  try{
    // queryOnly:false only for a backup's VACUUM INTO (the file itself stays read-only).
    applyPragmas(db,queryOnly?READ_PRAGMAS:{...READ_PRAGMAS,query_only:'OFF'});
    if(verify)verifyLedger(db,{file,sqliteVersion:db.prepare('select sqlite_version() AS version').get().version});
  }catch(error){try{db.close();}catch{}throw error;}
  return db;
}
const rowOf=row=>row?{...row,payload:parseJson(row.payload_json)}:null;
const readAccessors=db=>({
  eventsHead(workflowId){return eventsHead(db,workflowId);},
  getJob(jobId){return rowOf(db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId));},
  listJobs({status=null,kind=null,workflowId=null}={}){let sql='SELECT * FROM jobs WHERE 1=1';const args=[];if(status){sql+=' AND status=?';args.push(status);}if(kind){sql+=' AND kind=?';args.push(kind);}if(workflowId){sql+=' AND workflow_id=?';args.push(workflowId);}sql+=' ORDER BY created_at,job_id';return db.prepare(sql).all(...args).map(rowOf);},
  events({workflowId=null,since=null}={}){let sql='SELECT * FROM events WHERE 1=1';const args=[];if(workflowId){sql+=' AND workflow_id=?';args.push(workflowId);}if(since!==null){sql+=' AND seq>?';args.push(since);}sql+=' ORDER BY seq';return db.prepare(sql).all(...args).map(rowOf);},
  getWorkflow(workflowId){return db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(workflowId)??null;},
  getAttempt(attemptId){return db.prepare('SELECT * FROM op_attempts WHERE attempt_id=?').get(attemptId)??null;},
  meta(){return metaOf(db);},
});
/** A ledger opened read-only: no init, no writes. What operator inspection, the UI and the connectors use. */
export function inspectLedger({file}={}){
  need(typeof file==='string'&&fs.existsSync(file),'inspectLedger needs an existing file');
  const db=openLedgerReader(file);
  return {schema:LEDGER_SCHEMA,file,path:path.resolve(file),db,readOnly:true,ledgerId:ledgerIdOf({db}),
    version:userVersion(db),
    ...readAccessors(db),
    close(){db.close();}};
}
/** The digest of the workflow's newest event row, or null when it has none. */
export function eventsHead(db,workflowId){
  return db.prepare('SELECT digest FROM events WHERE workflow_id=? ORDER BY seq DESC LIMIT 1').get(workflowId)?.digest??null;
}

// ---------------------------------------------------------------------------------------------------------
// The writer: typed write functions. Each takes the db of an open write transaction (handle.transaction).
// Column values are camelCase keys mapped to the table's snake_case columns; `xJson` columns take any JSON value
// under `x` or `xJson`. Unknown keys throw, so a caller can never write a column the schema does not have.
// ---------------------------------------------------------------------------------------------------------
const snake=key=>key.replace(/[A-Z]/g,c=>`_${c.toLowerCase()}`);
const columnCache=new WeakMap();
const columnsOf=(db,table)=>{
  let byDb=columnCache.get(db);if(!byDb)columnCache.set(db,byDb=new Map());
  if(!byDb.has(table)){const cols=db.prepare(`PRAGMA table_xinfo(${table})`).all().filter(c=>c.hidden!==2&&c.hidden!==3).map(c=>c.name);need(cols.length,`unknown table ${table}`);byDb.set(table,new Set(cols));}
  return byDb.get(table);
};
/** {camelKey:value} → [[column,sqlValue]] for `table`; JSON columns stringify. */
function toColumns(db,table,fields){
  const cols=columnsOf(db,table),out=[];
  for(const [key,raw] of Object.entries(fields)){
    if(raw===undefined)continue;
    let col=snake(key),val=raw;
    if(!cols.has(col)&&cols.has(`${col}_json`)){col=`${col}_json`;val=json(raw);}
    else if(col.endsWith('_json')&&raw!==null&&typeof raw!=='string')val=json(raw);
    need(cols.has(col),`${table} has no column ${col} (key ${key})`,'STARCI_LEDGER_UNKNOWN_COLUMN');
    if(typeof val==='boolean')val=val?1:0;
    out.push([col,val]);
  }
  return out;
}
function insertRow(db,table,fields,{orIgnore=false}={}){
  const pairs=toColumns(db,table,fields);
  const sql=`INSERT ${orIgnore?'OR IGNORE ':''}INTO ${table}(${pairs.map(p=>p[0]).join(',')}) VALUES(${pairs.map(()=>'?').join(',')})`;
  return db.prepare(sql).run(...pairs.map(p=>p[1]));
}
function updateRow(db,table,where,fields){
  const pairs=toColumns(db,table,fields),keys=toColumns(db,table,where);
  if(!pairs.length)return {changes:0};
  const sql=`UPDATE ${table} SET ${pairs.map(p=>`${p[0]}=?`).join(',')} WHERE ${keys.map(p=>`${p[0]} IS ?`).join(' AND ')}`;
  return db.prepare(sql).run(...pairs.map(p=>p[1]),...keys.map(p=>p[1]));
}
const nowMs=()=>Date.now();
const EVENT_PAYLOAD_MAX=16384;

// --- blobs ------------------------------------------------------------------------------------------------
/** Index a blob already in the store (scripts/lib/artifact-store.mjs putBlob). Idempotent on sha256. */
export function recordBlob(db,{sha256:sha,bytes,mediaType,fileUri,encoding=null,redaction=null,pinned=0,createdAt=nowMs()}){
  need(/^[a-f0-9]{64}$/.test(sha??''),'recordBlob needs a sha256');
  need(Number.isInteger(bytes)&&bytes>=0&&mediaType&&fileUri,'recordBlob needs bytes, mediaType and fileUri');
  insertRow(db,'blobs',{sha256:sha,bytes,mediaType,fileUri:String(fileUri).replace(/\\/g,'/'),encoding,redaction,pinned,createdAt},{orIgnore:true});
  if(pinned)db.prepare('UPDATE blobs SET pinned=1 WHERE sha256=?').run(sha);
  return db.prepare('SELECT * FROM blobs WHERE sha256=?').get(sha);
}
/**
 * Put `content` (Buffer, Uint8Array or a file path) in the blob store and index it; returns the blobs row. `redaction`
 * is the caller's claim ('v1' after scripts/lib/redact.mjs, 'binary', or null).
 */
export function storeBlob(db,{content,mediaType='application/octet-stream',redaction=null,createdAt=nowMs()}){
  const {sha,size}=putBlob(content,{mediaType});
  return recordBlob(db,{sha256:sha,bytes:size,mediaType,fileUri:blobPath(sha),redaction,createdAt});
}

// --- events -----------------------------------------------------------------------------------------------
/** digest = sha256(prev_digest || event_id || kind || coalesce(payload_json,'') || created_at), per workflow chain. */
export const eventDigest=({prevDigest,eventId,kind,payloadJson,createdAt})=>sha256(`${prevDigest??''}${eventId}${kind}${payloadJson??''}${createdAt}`);
/**
 * One events row. The chain link is computed here inside the caller's BEGIN IMMEDIATE. A payload over 16 KiB goes to
 * the blob store (payloadSha) and the row keeps no payload_json.
 */
export function appendEvent(db,{eventId=newToken(),workflowId,entityType,entityId,generation=null,kind,payload=null,payloadSha=null,
  attemptId=null,spanId=null,occurredAt=null,createdAt=nowMs()}){
  need(workflowId&&entityType&&entityId!=null&&kind,'Event workflowId, entityType, entityId and kind are required');
  let payloadJson=json(payload);
  need(payloadJson===null||payloadJson.length<=EVENT_PAYLOAD_MAX||payloadSha,`event payload is ${payloadJson?.length} bytes (> ${EVENT_PAYLOAD_MAX}); store it as a blob and pass payloadSha`,'STARCI_EVENT_PAYLOAD_TOO_LARGE');
  if(payloadSha&&payloadJson&&payloadJson.length>EVENT_PAYLOAD_MAX)payloadJson=null;
  const gen=generation??db.prepare('SELECT generation FROM workflows WHERE workflow_id=?').get(workflowId)?.generation??0;
  const prevDigest=eventsHead(db,workflowId);
  const digest=eventDigest({prevDigest,eventId,kind,payloadJson,createdAt});
  const {lastInsertRowid}=insertRow(db,'events',{eventId,workflowId,generation:gen,entityType,entityId:String(entityId),attemptId,spanId,kind,
    payloadJson,payloadSha,prevDigest,digest,occurredAt:occurredAt??createdAt,createdAt});
  return db.prepare('SELECT * FROM events WHERE seq=?').get(lastInsertRowid);
}
/** Recompute a workflow's chain; returns {ok, count, brokenAt}. */
export function verifyEventChain(db,workflowId){
  let prev=null,count=0;
  for(const row of db.prepare('SELECT * FROM events WHERE workflow_id=? ORDER BY seq').iterate(workflowId)){
    count++;
    if(row.prev_digest!==prev||row.digest!==eventDigest({prevDigest:prev,eventId:row.event_id,kind:row.kind,payloadJson:row.payload_json,createdAt:row.created_at}))
      return {ok:false,count,brokenAt:row.seq};
    prev=row.digest;
  }
  return {ok:true,count,brokenAt:null};
}

// --- workflows, lifecycle, goals ----------------------------------------------------------------------------
/** Create a workflow (and its first lifecycle_changes row + event). Throws when it exists. */
export function createWorkflow(db,{workflowId,phase='awaiting-approval',by='owner',reason='define-goal',traceId=newTraceId(),title=null,displayName=null,
  ledgerMode=null,sourceRoots=null,goalIdentity=null,pinDigest=null,allowedParallel=null,at=nowMs()}){
  need(workflowId,'createWorkflow needs a workflow id');
  need(['awaiting-approval','queued'].includes(phase),`a workflow is created awaiting-approval or queued, not ${phase}`);
  insertRow(db,'workflows',{workflowId,traceId,title,displayName,phase,phaseReason:reason,ledgerMode,sourceRoots,goalIdentity,pinDigest,allowedParallel,createdAt:at,updatedAt:at});
  insertRow(db,'lifecycle_changes',{workflowId,fromPhase:null,toPhase:phase,by,reason,at});
  appendEvent(db,{workflowId,entityType:'workflow',entityId:workflowId,kind:'workflow-created',payload:{phase,by,reason},createdAt:at});
  return db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(workflowId);
}
/** Create the workflow when absent (phase `phase`), else return it; a set displayName is never overwritten. */
export function ensureWorkflow(db,{workflowId,phase='queued',by='kernel',reason='ensure',title=null,displayName=null,ledgerMode=null,sourceRoots=null,at=nowMs()}={}){
  need(workflowId,'ensureWorkflow needs a workflow id');
  const row=db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(workflowId);
  if(!row)return createWorkflow(db,{workflowId,phase,by,reason,title,displayName,ledgerMode,sourceRoots,at});
  if(displayName!==null&&row.display_name===null)db.prepare('UPDATE workflows SET display_name=?,updated_at=? WHERE workflow_id=?').run(displayName,at,workflowId);
  return db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(workflowId);
}
/**
 * Move workflows.phase along workflow_transitions: lifecycle_changes row, UPDATE, event — one transaction (the
 * workflows_phase_guard trigger refuses an unrecorded or invalid move). No-op (returns false) when already at `to`.
 */
export function changeWorkflowPhase(db,{workflowId,to,by,reason,at=nowMs(),finished=undefined}){
  need(workflowId&&to&&by&&reason,'changeWorkflowPhase needs workflowId, to, by and reason');
  const row=db.prepare('SELECT phase FROM workflows WHERE workflow_id=?').get(workflowId);
  need(row,`workflow ${workflowId} not found`,'STARCI_WORKFLOW_NOT_FOUND');
  if(row.phase===to)return false;
  insertRow(db,'lifecycle_changes',{workflowId,fromPhase:row.phase,toPhase:to,by,reason,at});
  const fields={phase:to,phaseReason:reason,updatedAt:at};
  if(to==='finished'){fields.finishedAt=at;if(finished!==undefined)fields.finishedJson=json(finished);}
  if(to==='archived')fields.archivedAt=at;
  updateRow(db,'workflows',{workflowId},fields);
  appendEvent(db,{workflowId,entityType:'workflow',entityId:workflowId,kind:'phase-transition',payload:{from:row.phase,to,by,reason},createdAt:at});
  return true;
}
const WORKFLOW_SPEC_FIELDS=new Set(['title','displayName','ledgerMode','sourceRoots','generation','observedGeneration','goalIdentity','pinDigest','allowedParallel','finished']);
/** Update non-phase workflow fields (phase moves only through changeWorkflowPhase). */
export function updateWorkflow(db,{workflowId,at=nowMs(),...fields}){
  for(const key of Object.keys(fields))need(WORKFLOW_SPEC_FIELDS.has(key),`updateWorkflow cannot set ${key}`);
  return updateRow(db,'workflows',{workflowId},{...fields,updatedAt:at}).changes>0;
}
/** The workflows.phase queued → running move (kernel boot, first dispatch). Returns true when this call moved it. */
export function transitionWorkflowToRunning(ledgerOrDb,{workflowId,now=Date.now(),by='kernel',reason='kernel-start'}){
  const db=ledgerOrDb.db??ledgerOrDb;
  const phase=db.prepare('SELECT phase FROM workflows WHERE workflow_id=?').get(workflowId)?.phase;
  if(phase!=='queued'){db.prepare('UPDATE workflows SET updated_at=? WHERE workflow_id=?').run(now,workflowId);return false;}
  return changeWorkflowPhase(db,{workflowId,to:'running',by,reason,at:now});
}
export function insertGoal(db,{workflowId,revision,goalIdentity,markdown,goal,amendment=null,approvedBy=null,approvalRef=null,createdAt=nowMs()}){
  need(workflowId&&Number.isInteger(revision)&&goalIdentity&&typeof markdown==='string'&&goal!==undefined,'insertGoal needs workflowId, revision, goalIdentity, markdown and goal');
  const {lastInsertRowid}=insertRow(db,'goals',{workflowId,revision,goalIdentity,markdown,json:json(goal),amendment,approvedBy,approvalRef,createdAt});
  appendEvent(db,{workflowId,entityType:'workflow',entityId:workflowId,kind:'goal-revision',payload:{revision,goalIdentity},createdAt});
  return Number(lastInsertRowid);
}
export function recordGoalInput(db,{workflowId,key,goalRevision,sha256:sha,origin,createdAt=nowMs()}){
  insertRow(db,'goal_inputs',{workflowId,key,goalRevision,sha256:sha,origin,createdAt});
}

// --- units and edges ----------------------------------------------------------------------------------------
/** A work unit (one logical step). UNIQUE(workflow, op, subject_key, goal_revision): the same work is never a new unit. */
export function createUnit(db,{workflowId,unitId,opId,subjectKey,goalRevision,title=null,cutId=null,cutOrdinal=null,cutTotal=null,repository=null,
  state='planned',tryBudget=DEFAULT_TRY_BUDGET,createdAt=nowMs()}){
  need(workflowId&&unitId&&opId&&subjectKey&&Number.isInteger(goalRevision),'createUnit needs workflowId, unitId, opId, subjectKey and goalRevision');
  insertRow(db,'work_units',{workflowId,unitId,opId,subjectKey,goalRevision,title,cutId,cutOrdinal,cutTotal,repository,state,tryBudget,createdAt,updatedAt:createdAt});
  appendEvent(db,{workflowId,entityType:'unit',entityId:unitId,kind:'unit-created',payload:{opId,subjectKey,goalRevision,state},createdAt});
  return getUnit(db,workflowId,unitId);
}
export const getUnit=(db,workflowId,unitId)=>db.prepare('SELECT * FROM work_units WHERE workflow_id=? AND unit_id=?').get(workflowId,unitId)??null;
/** Move a unit's state (+ event). A done unit leaves 'done' only through reopenUnit. */
export function setUnitState(db,{workflowId,unitId,to,reason=null,at=nowMs(),currentJobId=undefined}){
  const unit=getUnit(db,workflowId,unitId);
  need(unit,`unit ${workflowId}/${unitId} not found`,'STARCI_UNIT_NOT_FOUND');
  const fields={state:to,updatedAt:at};
  if(currentJobId!==undefined)fields.currentJobId=currentJobId;
  if(to==='done')fields.doneAt=at;
  if(unit.state===to&&currentJobId===undefined)return false;
  updateRow(db,'work_units',{workflowId,unitId},fields);
  if(unit.state!==to)appendEvent(db,{workflowId,entityType:'unit',entityId:unitId,kind:'unit-state',payload:{from:unit.state,to,reason},createdAt:at});
  return true;
}
/** H5: the only way to rerun a done unit — a reason, who, and a new reopened_at. */
export function reopenUnit(db,{workflowId,unitId,reason,by,to='queued',at=nowMs()}){
  need(reason&&by,'reopenUnit needs a reason and who reopens');
  const unit=getUnit(db,workflowId,unitId);need(unit,`unit ${workflowId}/${unitId} not found`);
  updateRow(db,'work_units',{workflowId,unitId},{state:to,reopenReason:reason,reopenedBy:by,reopenedAt:at,doneAt:null,updatedAt:at});
  appendEvent(db,{workflowId,entityType:'unit',entityId:unitId,kind:'unit-reopened',payload:{from:unit.state,to,reason,by},createdAt:at});
}
/** Q13: raise a unit's try_budget above 5 — only the owner or the Supervisor, with a reference. */
export function raiseTryBudget(db,{workflowId,unitId,tryBudget,by,ref,at=nowMs()}){
  need(['owner','supervisor'].includes(by)&&ref&&Number.isInteger(tryBudget),'raiseTryBudget needs by (owner|supervisor), ref and an integer budget');
  updateRow(db,'work_units',{workflowId,unitId},{tryBudget,budgetRaisedBy:by,budgetRaisedRef:ref,updatedAt:at});
  appendEvent(db,{workflowId,entityType:'unit',entityId:unitId,kind:'unit-budget-raised',payload:{tryBudget,by,ref},createdAt:at});
}
export function addUnitEdge(db,{workflowId,fromUnit,toUnit,kind,source,createdAt=nowMs()}){
  return insertRow(db,'unit_edges',{workflowId,fromUnit,toUnit,kind,source,createdAt},{orIgnore:true}).changes>0;
}
export function recordGraphVersion(db,{workflowId,version,event,graph,diff,colors,reason,authorOp,authorJob=null,digest,createdAt=nowMs()}){
  insertRow(db,'work_graph_versions',{workflowId,version,event,graphJson:json(graph),diffJson:json(diff),colorsJson:json(colors),reason,authorOp,authorJob,digest,createdAt});
  appendEvent(db,{workflowId,entityType:'workflow',entityId:workflowId,kind:`graph-${event}`,payload:{version,reason,authorOp},createdAt});
}

// --- jobs -------------------------------------------------------------------------------------------------
/**
 * Enqueue one job (a try of a unit). The jobs_enqueue_guard trigger enforces unit, budget and lineage (H3/H4/H5/H9);
 * this also bumps work_units.tries/current_job_id and moves a planned unit to queued. Idempotent on jobId.
 */
export function enqueueJob(db,{jobId,workflowId,unitId=null,opId=null,tryNo=1,retryOf=null,resumeOf=null,retryClass=null,generation=null,kind='op',role=null,
  status='queued',payload=null,priority=null,deadline=null,createdAt=nowMs()}){
  need(jobId&&workflowId&&kind,'Job identity and kind are required');
  const existing=db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  if(existing)return rowOf(existing);
  const gen=generation??db.prepare('SELECT generation FROM workflows WHERE workflow_id=?').get(workflowId)?.generation??0;
  insertRow(db,'jobs',{jobId,workflowId,unitId,opId,tryNo,retryOf,resumeOf,retryClass,generation:gen,kind,role,status,payload,priority,deadline,createdAt,updatedAt:createdAt});
  if(unitId){
    db.prepare('UPDATE work_units SET tries=max(tries,?),current_job_id=?,updated_at=? WHERE workflow_id=? AND unit_id=?').run(tryNo,jobId,createdAt,workflowId,unitId);
    const unit=getUnit(db,workflowId,unitId);
    if(unit&&['planned','failed'].includes(unit.state))setUnitState(db,{workflowId,unitId,to:'queued',reason:`job ${jobId}`,at:createdAt});
  }
  appendEvent(db,{workflowId,entityType:'job',entityId:jobId,kind:'job-enqueued',payload:{opId,unitId,tryNo,retryOf,resumeOf,retryClass,status},createdAt});
  return rowOf(db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId));
}
const JOB_MUTABLE=new Set(['leaseToken','workerId','deadline','payload','priority','role']);
/**
 * Move jobs.status along job_transitions (+ one event). `fields` may set lease_token, worker_id, deadline, payload,
 * priority. A terminal status drops the job's leases (trigger). Returns false when the job already is at `to`.
 */
export function setJobStatus(db,{jobId,to,reason=null,at=nowMs(),spanId=null,attemptId=null,expect=null,...fields}){
  for(const key of Object.keys(fields))need(JOB_MUTABLE.has(key),`setJobStatus cannot set ${key}`);
  const job=db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  need(job,`job ${jobId} not found`,'STARCI_JOB_NOT_FOUND');
  if(expect)need([expect].flat().includes(job.status),`job ${jobId} is ${job.status}, expected ${[expect].flat().join('|')}`,'STARCI_JOB_STATUS_CONFLICT');
  if(job.status===to){if(Object.keys(fields).length)updateRow(db,'jobs',{jobId},{...fields,updatedAt:at});return false;}
  updateRow(db,'jobs',{jobId},{...fields,status:to,updatedAt:at});
  appendEvent(db,{workflowId:job.workflow_id,entityType:'job',entityId:jobId,kind:'job-status',attemptId,spanId,payload:{from:job.status,to,reason},createdAt:at});
  return true;
}
/** Update non-status job fields (lease token, worker, deadline, payload, priority). */
export function updateJob(db,{jobId,at=nowMs(),...fields}){
  for(const key of Object.keys(fields))need(JOB_MUTABLE.has(key),`updateJob cannot set ${key}`);
  return updateRow(db,'jobs',{jobId},{...fields,updatedAt:at}).changes>0;
}

// --- attempts, contracts ---------------------------------------------------------------------------------------
/**
 * One op_attempts row per dispatch. The dispatch guard requires the job leased and the workflow running. spanId is
 * minted when absent; the attempt's dispatch_seq follows the job's previous dispatches.
 */
export function startAttempt(db,{workflowId,jobId,dispatchId,spanId=newSpanId(),parentSpanId=null,at=nowMs(),...fields}){
  const job=db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  need(job,`job ${jobId} not found`,'STARCI_JOB_NOT_FOUND');
  need(dispatchId,'startAttempt needs a dispatch id');
  const dispatchSeq=Number(db.prepare('SELECT COALESCE(max(dispatch_seq),0)+1 n FROM op_attempts WHERE job_id=?').get(jobId).n);
  const {lastInsertRowid}=insertRow(db,'op_attempts',{workflowId:workflowId??job.workflow_id,jobId,unitId:job.unit_id,opId:job.op_id,tryNo:job.try_no,dispatchSeq,dispatchId,
    spanId,parentSpanId,routedAt:fields.routedAt??at,...fields});
  const attemptId=Number(lastInsertRowid);
  if(job.unit_id)db.prepare('UPDATE work_units SET dispatches=dispatches+1,updated_at=? WHERE workflow_id=? AND unit_id=?').run(at,job.workflow_id,job.unit_id);
  appendEvent(db,{workflowId:job.workflow_id,entityType:'attempt',entityId:String(attemptId),attemptId,spanId,kind:'attempt-started',payload:{jobId,dispatchId,dispatchSeq},createdAt:at});
  return db.prepare('SELECT * FROM op_attempts WHERE attempt_id=?').get(attemptId);
}
const ATTEMPT_IDENTITY=new Set(['attempt_id','workflow_id','job_id','unit_id','op_id','try_no','dispatch_seq','dispatch_id','span_id']);
/** Update an attempt's facts; any *_at, verdict or end_state change appends one 'attempt-updated' event naming the changed columns. */
export function updateAttempt(db,{attemptId,at=nowMs(),...fields}){
  const row=db.prepare('SELECT * FROM op_attempts WHERE attempt_id=?').get(attemptId);
  need(row,`attempt ${attemptId} not found`,'STARCI_ATTEMPT_NOT_FOUND');
  const pairs=toColumns(db,'op_attempts',fields);
  for(const [col] of pairs)need(!ATTEMPT_IDENTITY.has(col),`updateAttempt cannot change ${col}`);
  const changed=pairs.filter(([col,val])=>row[col]!==val);
  if(!changed.length)return false;
  updateRow(db,'op_attempts',{attemptId},Object.fromEntries(changed.map(([c,v])=>[c.replace(/_([a-z])/g,(_,x)=>x.toUpperCase()),v])));
  const marks=changed.filter(([col])=>/_at$|^verdict$|^end_state$|^report_outcome$/.test(col));
  if(marks.length)appendEvent(db,{workflowId:row.workflow_id,entityType:'attempt',entityId:String(attemptId),attemptId,spanId:row.span_id,kind:'attempt-updated',
    payload:Object.fromEntries(marks),createdAt:at});
  return true;
}
export function writeContract(db,{attemptId,markdown,context=null,contractRev=null,createdAt=nowMs()}){
  const a=db.prepare('SELECT workflow_id,job_id FROM op_attempts WHERE attempt_id=?').get(attemptId);
  need(a,`attempt ${attemptId} not found`,'STARCI_ATTEMPT_NOT_FOUND');
  insertRow(db,'contracts',{attemptId,workflowId:a.workflow_id,jobId:a.job_id,contractRev,markdown,context,createdAt});
}

// --- leases and resources --------------------------------------------------------------------------------------
export function declareResource(db,{resourceKey,capacity,declaredBy=null,at=nowMs()}){
  db.prepare('INSERT INTO resources(resource_key,capacity,declared_by,declared_at) VALUES(?,?,?,?) ON CONFLICT(resource_key) DO UPDATE SET capacity=excluded.capacity,declared_by=excluded.declared_by,declared_at=excluded.declared_at').run(resourceKey,capacity,declaredBy,at);
}
/** One lease row, identity-checked against the job (leases_match_job trigger). */
export function acquireLease(db,{resourceKey,jobId,units=1,expiresAt,attemptId=null,holder=null,at=nowMs()}){
  const job=db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  need(job?.lease_token,`job ${jobId} holds no lease token`);
  insertRow(db,'leases',{resourceKey,jobId,workflowId:job.workflow_id,opId:job.op_id,tryNo:job.try_no,generation:job.generation,token:job.lease_token,units,attemptId,holder,acquiredAt:at,expiresAt});
}
export function renewLeases(db,{jobId,expiresAt,attemptId=undefined,holder=undefined,at=nowMs()}){
  const fields={renewedAt:at,expiresAt};if(attemptId!==undefined)fields.attemptId=attemptId;if(holder!==undefined)fields.holder=holder;
  return updateRow(db,'leases',{jobId},fields).changes;
}
export function releaseLeases(db,{jobId}){return db.prepare('DELETE FROM leases WHERE job_id=?').run(jobId).changes;}

// --- api_requests (idempotency) ----------------------------------------------------------------------------------
/** request_id = --request-id, or sha(verb + dispatch_id + args). */
export const requestIdOf=({verb,dispatchId=null,args=null})=>sha256(`${verb}\n${dispatchId??''}\n${json(args)??''}`);
/**
 * Run `fn(db)` once per request id inside the caller's transaction: a replay returns {replayed:true,result} from the
 * stored row; the same id with other args throws. `fn`'s return value is the stored result.
 */
export function idempotent(db,{requestId=null,verb,caller=null,workflowId=null,attemptId=null,dispatchId=null,args=null,at=nowMs()},fn){
  need(verb,'idempotent needs a verb');
  const id=requestId??requestIdOf({verb,dispatchId,args});
  const argsSha=sha256(json(args)??'');
  const prior=db.prepare('SELECT * FROM api_requests WHERE request_id=?').get(id);
  if(prior){
    need(prior.verb===verb&&prior.args_sha===argsSha,`request-id-reused: ${id} was ${prior.verb} with other arguments`,'STARCI_REQUEST_ID_REUSED');
    if(prior.status==='done')return {replayed:true,requestId:id,result:parseJson(prior.result_json)};
    db.prepare('DELETE FROM api_requests WHERE request_id=?').run(id);
  }
  insertRow(db,'api_requests',{requestId:id,verb,caller,workflowId,attemptId,argsSha,status:'running',createdAt:at});
  const result=fn(db);
  updateRow(db,'api_requests',{requestId:id},{status:'done',resultJson:json(result??null),finishedAt:nowMs()});
  return {replayed:false,requestId:id,result};
}
/** Record a failed request outside the rolled-back transaction (a replay reruns it). */
export function recordFailedRequest(db,{requestId,verb,caller=null,workflowId=null,attemptId=null,args=null,error,at=nowMs()}){
  db.prepare("INSERT INTO api_requests(request_id,verb,caller,workflow_id,attempt_id,args_sha,status,result_json,created_at,finished_at) VALUES(?,?,?,?,?,?,'failed',?,?,?) ON CONFLICT(request_id) DO UPDATE SET status='failed',result_json=excluded.result_json,finished_at=excluded.finished_at")
    .run(requestId,verb,caller,workflowId,attemptId,sha256(json(args)??''),json({error:String(error?.message??error)}),at,nowMs());
}

// --- reports, checks, artifacts, transcripts, usage ----------------------------------------------------------------
/**
 * File an attempt's report (H10: immutable). The same report again returns the stored row; a different one throws.
 * Sets op_attempts.report_outcome/reported_at (+ event).
 */
export function fileReport(db,{attemptId,outcome,report,fromTerminal=null,createdAt=nowMs()}){
  const a=db.prepare('SELECT * FROM op_attempts WHERE attempt_id=?').get(attemptId);
  need(a,`attempt ${attemptId} not found`,'STARCI_ATTEMPT_NOT_FOUND');
  const reportJson=typeof report==='string'?report:json(report);
  const prior=db.prepare('SELECT * FROM reports WHERE attempt_id=?').get(attemptId);
  if(prior){need(prior.report_json===reportJson&&prior.outcome===outcome,`report-already-filed: attempt ${attemptId} has a different report`,'STARCI_REPORT_ALREADY_FILED');return {...prior,replayed:true};}
  const {lastInsertRowid}=insertRow(db,'reports',{workflowId:a.workflow_id,attemptId,dispatchId:a.dispatch_id,jobId:a.job_id,outcome,reportJson,fromTerminal,createdAt});
  updateAttempt(db,{attemptId,reportOutcome:outcome,reportedAt:createdAt,at:createdAt});
  return db.prepare('SELECT * FROM reports WHERE report_id=?').get(lastInsertRowid);
}
export function markReportConsumed(db,{attemptId,at=nowMs()}){
  db.prepare('UPDATE reports SET consumed_at=? WHERE attempt_id=? AND consumed_at IS NULL').run(at,attemptId);
  updateAttempt(db,{attemptId,consumedAt:at,at});
}
/** One check_runs row; run_seq follows earlier runs of the same (attempt, runner, phase, name). */
export function recordCheckRun(db,{attemptId,name,phase,runner,authority=runner==='op'?'declared':'runtime',status,spanId=newSpanId(),createdAt=nowMs(),...fields}){
  const a=db.prepare('SELECT * FROM op_attempts WHERE attempt_id=?').get(attemptId);
  need(a,`attempt ${attemptId} not found`,'STARCI_ATTEMPT_NOT_FOUND');
  const runSeq=fields.runSeq??Number(db.prepare('SELECT COALESCE(max(run_seq),0)+1 n FROM check_runs WHERE attempt_id=? AND runner=? AND phase=? AND name=?').get(attemptId,runner,phase,name).n);
  const {lastInsertRowid}=insertRow(db,'check_runs',{workflowId:a.workflow_id,attemptId,jobId:a.job_id,opId:a.op_id,spanId,parentSpanId:a.span_id,name,phase,runner,authority,status,createdAt,...fields,runSeq});
  return db.prepare('SELECT * FROM check_runs WHERE check_id=?').get(lastInsertRowid);
}
/**
 * One job_artifacts row over an indexed blob (H10: immutable; the same (attempt, name, sha) again returns the row, a
 * different sha under the same name throws). A kernel artifact has no attempt (origin 'kernel').
 */
export function recordArtifact(db,{workflowId=null,attemptId=null,name,sha256:sha,role,kind,origin=attemptId?'op':'kernel',createdAt=nowMs(),...fields}){
  const blob=db.prepare('SELECT * FROM blobs WHERE sha256=?').get(sha);
  need(blob,`blob ${sha} is not indexed; recordBlob/storeBlob first`,'STARCI_BLOB_NOT_INDEXED');
  const a=attemptId?db.prepare('SELECT * FROM op_attempts WHERE attempt_id=?').get(attemptId):null;
  need(!attemptId||a,`attempt ${attemptId} not found`,'STARCI_ATTEMPT_NOT_FOUND');
  const wf=workflowId??a?.workflow_id;need(wf,'recordArtifact needs a workflow');
  const prior=attemptId?db.prepare('SELECT * FROM job_artifacts WHERE attempt_id=? AND name=?').get(attemptId,name)
    :db.prepare('SELECT * FROM job_artifacts WHERE workflow_id=? AND attempt_id IS NULL AND name=?').get(wf,name);
  if(prior){need(prior.sha256===sha,`artifacts are immutable: ${name} already holds ${prior.sha256}`,'STARCI_ARTIFACT_IMMUTABLE');return prior;}
  const {lastInsertRowid}=insertRow(db,'job_artifacts',{workflowId:wf,attemptId,jobId:a?.job_id??fields.jobId,opId:a?.op_id??fields.opId,name,sha256:sha,
    bytes:blob.bytes,mediaType:blob.media_type,role,kind,origin,createdAt,...fields,...(a?{jobId:a.job_id,opId:a.op_id}:{})});
  return db.prepare('SELECT * FROM job_artifacts WHERE artifact_id=?').get(lastInsertRowid);
}
export function attachToReport(db,{reportId,artifactId}){insertRow(db,'report_attachments',{reportId,artifactId},{orIgnore:true});}
export function recordArtifactProof(db,{artifactId,claims,codeSha=null,deps,createdAt=nowMs()}){
  insertRow(db,'artifact_proofs',{artifactId,claimsJson:json(claims),codeSha,depsJson:json(deps),createdAt});
}
export function citeBlob(db,{recordId,recordPath,field,sha256:sha,artifactId=null,role=null,recordRev=null,createdAt=nowMs()}){
  db.prepare('INSERT INTO work_citations(record_id,record_path,field,artifact_id,sha256,role,record_rev,created_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(record_id,field) DO UPDATE SET record_path=excluded.record_path,artifact_id=excluded.artifact_id,sha256=excluded.sha256,role=excluded.role,record_rev=excluded.record_rev,created_at=excluded.created_at')
    .run(recordId,recordPath,field,artifactId,sha,role,recordRev,createdAt);
  db.prepare('UPDATE blobs SET pinned=1 WHERE sha256=?').run(sha);
}
/** A periodic scrollback snapshot (UI-API §2.10); an unchanged scrollback adds nothing. */
export function recordTranscriptSnapshot(db,{attemptId,sha256:sha,lines,bytes,at=nowMs()}){
  const a=db.prepare('SELECT workflow_id FROM op_attempts WHERE attempt_id=?').get(attemptId);
  need(a,`attempt ${attemptId} not found`,'STARCI_ATTEMPT_NOT_FOUND');
  return insertRow(db,'attempt_transcript_snapshots',{workflowId:a.workflow_id,attemptId,at,lines,bytes,sha256:sha},{orIgnore:true}).changes>0;
}
/** The final transcript / session / prompt blobs of an attempt. */
export function setAttemptTranscript(db,{attemptId,transcriptSha=undefined,sessionSha=undefined,promptSha=undefined,at=nowMs()}){
  return updateAttempt(db,{attemptId,transcriptSha,sessionSha,promptSha,at});
}
/** Q11: token counts only; cost_usd stays NULL unless a provider reported it. */
export function recordLlmUsage(db,{workflowId,subjectType,attemptId=null,turnRef=null,provider,source,at=nowMs(),...fields}){
  insertRow(db,'llm_usage',{workflowId,subjectType,attemptId,turnRef,provider,source,at,...fields});
}

// --- logs ---------------------------------------------------------------------------------------------------------
export const LOG_ACTORS=Object.freeze(['kernel','op','runtime','check','land','settler','reconciler']);
export const LOG_LEVELS=Object.freeze(['debug','info','warn','error']);
/** One typed log row; returns {changes,lastInsertRowid} (changes 0 when `orIgnore` and its src is already stored). */
export function appendLog(db,{at=nowMs(),workflowId,actor,level='info',kind,msg,data=null,refs=null,jobId=null,attemptId=null,traceId=null,spanId=null,nodeId=null,src=null,orIgnore=src!==null}){
  need(workflowId&&actor&&kind&&typeof msg==='string','appendLog needs workflowId, actor, kind and msg');
  return insertRow(db,'logs',{at,workflowId,jobId,attemptId,traceId,spanId,actor,nodeId,level,kind,msg,dataJson:json(data),refsJson:json(refs),src},{orIgnore});
}
/** log_cursors: `mode` 'max' never moves a cursor back. */
export function setLogCursor(db,{name,value,mode='set'}){
  db.prepare(`INSERT INTO log_cursors(name,value) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET value=${mode==='max'?'max(value,excluded.value)':'excluded.value'}`).run(name,value);
}

// --- conditions, incidents, inbox, decisions ------------------------------------------------------------------------
/** Upsert one condition; a status change moves last_transition_at and appends 'condition-changed'. */
export function setCondition(db,{workflowId,entityType,entityId,type,status,reason,message=null,owner=null,observedGeneration=null,at=nowMs()}){
  const prior=db.prepare('SELECT * FROM conditions WHERE entity_type=? AND entity_id=? AND type=?').get(entityType,String(entityId),type);
  const moved=!prior||prior.status!==status;
  db.prepare(`INSERT INTO conditions(workflow_id,entity_type,entity_id,type,status,reason,message,owner,observed_generation,last_transition_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(entity_type,entity_id,type) DO UPDATE SET status=excluded.status,reason=excluded.reason,message=excluded.message,owner=excluded.owner,
    observed_generation=excluded.observed_generation,updated_at=excluded.updated_at,last_transition_at=CASE WHEN conditions.status<>excluded.status THEN excluded.last_transition_at ELSE conditions.last_transition_at END`)
    .run(workflowId,entityType,String(entityId),type,status,reason,message,owner,observedGeneration,at,at);
  if(moved)appendEvent(db,{workflowId,entityType,entityId:String(entityId),kind:'condition-changed',payload:{type,from:prior?.status??null,to:status,reason},createdAt:at});
  return moved;
}
export function openIncident(db,{incidentId=`inc-${newToken().slice(0,12)}`,workflowId,kind,owner,detail=null,dueAt=null,opId=null,jobId=null,attemptId=null,at=nowMs()}){
  insertRow(db,'incidents',{incidentId,workflowId,opId,jobId,attemptId,kind,detail,owner,dueAt,status:'open',createdAt:at,updatedAt:at});
  appendEvent(db,{workflowId,entityType:'incident',entityId:incidentId,attemptId,kind:'incident-opened',payload:{kind,owner,detail},createdAt:at});
  return incidentId;
}
const INCIDENT_MUTABLE=new Set(['detail','owner','dueAt','attempts','modelCalls','tokens','elapsedMs','lastProgress']);
export function updateIncident(db,{incidentId,at=nowMs(),...fields}){
  for(const key of Object.keys(fields))need(INCIDENT_MUTABLE.has(key),`updateIncident cannot set ${key}`);
  return updateRow(db,'incidents',{incidentId},{...fields,updatedAt:at}).changes>0;
}
export function resolveIncident(db,{incidentId,reason,status='resolved',at=nowMs()}){
  const row=db.prepare('SELECT * FROM incidents WHERE incident_id=?').get(incidentId);
  need(row,`incident ${incidentId} not found`);
  if(row.status!=='open')return false;
  updateRow(db,'incidents',{incidentId},{status,resolvedReason:reason,resolvedAt:at,updatedAt:at});
  appendEvent(db,{workflowId:row.workflow_id,entityType:'incident',entityId:incidentId,kind:'incident-resolved',payload:{reason,status},createdAt:at});
  return true;
}
export function postInbox(db,{workflowId,kind,payload,key=null,fromRef=null,attemptId=null,createdAt=nowMs()}){
  const {lastInsertRowid}=insertRow(db,'inbox',{workflowId,kind,key,fromRef,attemptId,payloadJson:json(payload),status:'pending',createdAt});
  appendEvent(db,{workflowId,entityType:'inbox',entityId:String(lastInsertRowid),attemptId,kind:'inbox-posted',payload:{kind,key,fromRef},createdAt});
  return Number(lastInsertRowid);
}
export function setInboxStatus(db,{inboxId,status,disposition=undefined,at=nowMs()}){
  const row=db.prepare('SELECT * FROM inbox WHERE inbox_id=?').get(inboxId);need(row,`inbox ${inboxId} not found`);
  if(row.status===status)return false;
  const fields={status};if(disposition!==undefined)fields.dispositionJson=json(disposition);if(['applied','done'].includes(status))fields.appliedAt=at;
  updateRow(db,'inbox',{inboxId},fields);
  appendEvent(db,{workflowId:row.workflow_id,entityType:'inbox',entityId:String(inboxId),kind:'inbox-status',payload:{from:row.status,to:status},createdAt:at});
  return true;
}
/** MB-07: one DI per full identity key; an existing open DI with the same key is returned, not duplicated. */
export function openDecisionItem(db,{diId=null,idempotencyKey,keyParts,workflowId=null,kind,decider,summary,openedBy,payload={},at=nowMs(),...fields}){
  const prior=db.prepare('SELECT * FROM decision_items WHERE idempotency_key=?').get(idempotencyKey);
  if(prior)return prior;
  const id=diId??`di-${sha256(idempotencyKey).slice(0,8)}`;
  insertRow(db,'decision_items',{diId:id,idempotencyKey,keyPartsJson:json(keyParts),workflowId,kind,decider,summary,status:'open',openedBy,openedAt:at,payloadJson:json(payload),...fields});
  if(workflowId)appendEvent(db,{workflowId,entityType:'decision',entityId:id,kind:'decision-opened',payload:{kind,decider,summary},createdAt:at});
  return db.prepare('SELECT * FROM decision_items WHERE di_id=?').get(id);
}
const DI_MUTABLE=new Set(['status','dueAt','escalateTo','escalations','claimBy','claimAt','claimTtlMs','resolvedBy','resolvedAt','resolutionVerb','decisionId','supersededBy','evidence','options','allowedVerbs','payload','summary']);
export function updateDecisionItem(db,{diId,at=nowMs(),...fields}){
  for(const key of Object.keys(fields))need(DI_MUTABLE.has(key),`updateDecisionItem cannot set ${key}`);
  const row=db.prepare('SELECT * FROM decision_items WHERE di_id=?').get(diId);need(row,`decision item ${diId} not found`);
  updateRow(db,'decision_items',{diId},fields);
  if(fields.status&&fields.status!==row.status&&row.workflow_id)
    appendEvent(db,{workflowId:row.workflow_id,entityType:'decision',entityId:diId,kind:'decision-status',payload:{from:row.status,to:fields.status},createdAt:at});
}
export function recordDecision(db,{decisionId=`dec-${newToken().slice(0,12)}`,workflowId=null,spanId=newSpanId(),parentSpanId=null,decider,diId=null,subjectType=null,subjectId=null,choice,rationale=null,result=null,decidedAt=nowMs()}){
  insertRow(db,'decisions',{decisionId,workflowId,spanId,parentSpanId,decider,diId,subjectType,subjectId,choice,rationale,resultJson:json(result),decidedAt});
  if(workflowId)appendEvent(db,{workflowId,entityType:subjectType??'workflow',entityId:subjectId??workflowId,spanId,kind:'decision',payload:{decisionId,choice,decider},createdAt:decidedAt});
  return decisionId;
}
/** signals: process fences only. */
export function setSignal(db,{scope,key,workflowId=null,holderPid=null,token=null,value=null,expiresAt=null,at=nowMs()}){
  db.prepare('INSERT INTO signals(scope,key,workflow_id,holder_pid,token,value_json,at,expires_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(scope,key) DO UPDATE SET workflow_id=excluded.workflow_id,holder_pid=excluded.holder_pid,token=excluded.token,value_json=excluded.value_json,at=excluded.at,expires_at=excluded.expires_at')
    .run(scope,key,workflowId,holderPid,token,json(value),at,expiresAt);
}
export function clearSignal(db,{scope,key,token=null}){
  return (token?db.prepare('DELETE FROM signals WHERE scope=? AND key=? AND token=?').run(scope,key,token):db.prepare('DELETE FROM signals WHERE scope=? AND key=?').run(scope,key)).changes>0;
}
/** settle_tails queue (replaces <ledger dir>/settle-tail/<job>.json). */
export function queueSettleTail(db,{attemptId,dueAt=null,at=nowMs()}){
  const a=db.prepare('SELECT workflow_id FROM op_attempts WHERE attempt_id=?').get(attemptId);need(a,`attempt ${attemptId} not found`);
  insertRow(db,'settle_tails',{attemptId,workflowId:a.workflow_id,state:'queued',dueAt,queuedAt:at},{orIgnore:true});
}
export function updateSettleTail(db,{attemptId,state,lastError=undefined,dueAt=undefined,at=nowMs()}){
  const fields={state};if(lastError!==undefined)fields.lastError=lastError;if(dueAt!==undefined)fields.dueAt=dueAt;
  if(state==='running'){fields.startedAt=at;db.prepare('UPDATE settle_tails SET tries=tries+1 WHERE attempt_id=?').run(attemptId);}
  if(state==='done')fields.doneAt=at;
  return updateRow(db,'settle_tails',{attemptId},fields).changes>0;
}
export function recordProductLand(db,{workflowId,repoRoot,wfBranch,result='queued',spanId=newSpanId(),startedAt=nowMs(),...fields}){
  const {lastInsertRowid}=insertRow(db,'product_lands',{workflowId,spanId,repoRoot,wfBranch,result,startedAt,...fields});
  appendEvent(db,{workflowId,entityType:'workflow',entityId:workflowId,spanId,kind:'product-land',payload:{landId:Number(lastInsertRowid),result},createdAt:startedAt});
  return Number(lastInsertRowid);
}
export function finishProductLand(db,{landId,result,at=nowMs(),...fields}){
  const row=db.prepare('SELECT * FROM product_lands WHERE land_id=?').get(landId);need(row,`product land ${landId} not found`);
  updateRow(db,'product_lands',{landId},{result,finishedAt:at,...fields});
  appendEvent(db,{workflowId:row.workflow_id,entityType:'workflow',entityId:row.workflow_id,spanId:row.span_id,kind:'product-land',payload:{landId,result},createdAt:at});
}

/** Every typed write, for the handle's `write` namespace. */
export const LEDGER_WRITES=Object.freeze({recordBlob,storeBlob,appendEvent,createWorkflow,ensureWorkflow,changeWorkflowPhase,updateWorkflow,insertGoal,recordGoalInput,
  createUnit,setUnitState,reopenUnit,raiseTryBudget,addUnitEdge,recordGraphVersion,enqueueJob,setJobStatus,updateJob,startAttempt,updateAttempt,writeContract,
  declareResource,acquireLease,renewLeases,releaseLeases,idempotent,recordFailedRequest,fileReport,markReportConsumed,recordCheckRun,recordArtifact,attachToReport,
  recordArtifactProof,citeBlob,recordTranscriptSnapshot,setAttemptTranscript,recordLlmUsage,appendLog,setLogCursor,setCondition,openIncident,updateIncident,resolveIncident,
  postInbox,setInboxStatus,openDecisionItem,updateDecisionItem,recordDecision,setSignal,clearSignal,queueSettleTail,updateSettleTail,recordProductLand,finishProductLand});

/**
 * The read-write handle. A new (empty) file is created with 0001-init.sql; any other schema is refused (clean slate).
 * `checkpointer:true` is the one connection that checkpoints (the reconciler engine): wal_autocheckpoint=8000 and
 * handle.checkpoint() for the periodic PASSIVE checkpoint; every other connection runs wal_autocheckpoint=0.
 * `write.<fn>(args)` runs one typed write in its own transaction; inside handle.transaction(db=>…) call the exported
 * functions with that db.
 */
export function openLedger({file,now=Date.now,busyTimeoutMs=LEDGER_BUSY_TIMEOUT_MS,repoRoot=null,product=null,checkpointer=false,machine=null}={}){
  const pragmas=checkpointer?{...LEDGER_PRAGMAS,wal_autocheckpoint:CHECKPOINTER_AUTOCHECKPOINT}:LEDGER_PRAGMAS;
  const {db,sqliteVersion,journalMode}=openDb({file,busyTimeoutMs,journalMode:'WAL',autoVacuum:true,label:'openLedger',pragmas});
  try{
    initLedger(db,{file,now,sqliteVersion,journalMode,repoRoot:repoRoot??repoRootOfFile.get(path.resolve(file))??null,product});
    verifyLedger(db,{file,sqliteVersion});
    const meta=metaOf(db);
    if(meta.sqlite_version!==sqliteVersion)db.prepare("UPDATE meta SET value=? WHERE key='sqlite_version'").run(sqliteVersion);
  }catch(error){try{db.close();}catch{}throw error;}
  const transaction=makeTransaction(db,'ledger');
  const resolved=path.resolve(file),ledgerId=ledgerIdOf({db});
  if(machine?.registerLedger)machine.registerLedger({ledgerId,file:resolved});
  const inTx=fn=>transaction.active()?fn(db):transaction(fn);
  const write=Object.fromEntries(Object.entries(LEDGER_WRITES).map(([name,fn])=>[name,
    name==='idempotent'?(args,body)=>inTx(tx=>fn(tx,{at:now(),...args},body)):args=>inTx(tx=>fn(tx,args??{}))]));
  return {
    schema:LEDGER_SCHEMA,file,path:resolved,sqliteVersion,journalMode,db,now,transaction,ledgerId,write,checkpointer,
    ensureWorkflow(args={}){return inTx(tx=>ensureWorkflow(tx,{at:now(),...args}));},
    appendEvent(args){return inTx(tx=>appendEvent(tx,{createdAt:now(),...args}));},
    enqueueJob(args){return inTx(tx=>enqueueJob(tx,{createdAt:now(),...args}));},
    /** PASSIVE checkpoint: only the checkpointer connection may run it. */
    checkpoint(){need(checkpointer,'only the checkpointer connection checkpoints');return db.prepare('PRAGMA wal_checkpoint(PASSIVE)').get();},
    ...readAccessors(db),
    close(){db.close();}
  };
}
/** A read-write connection to an EXISTING ledger (the typed-log writer's own connection), verified, never initialised. */
export function openLedgerConnection(file,{busyTimeoutMs=LEDGER_BUSY_TIMEOUT_MS}={}){
  need(fs.existsSync(file),`openLedgerConnection needs an existing ledger: ${file}`);
  const {db,sqliteVersion}=openDb({file,busyTimeoutMs,journalMode:'WAL',label:'openLedgerConnection'});
  try{verifyLedger(db,{file,sqliteVersion});}catch(error){try{db.close();}catch{}throw error;}
  return db;
}

/**
 * Admission: in one ledger transaction, refuse on a durable path-lease overlap or a full repo resource, else move the job
 * ready → leased with its fencing token and write its leases. The ledger is registered on the machine registry first.
 */
export function reserveTwoPhase(ledger,machine,{job,leases=[],ttlMs=60000,canonicalOf=null}={}){
  need(ledger?.transaction&&ledger?.db,'reserveTwoPhase needs a ledger handle');
  need(machine?.registerLedger,'reserveTwoPhase needs a machine handle');
  need(job?.jobId&&job?.workflowId,'Job identity is required');
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
      const capacity=row?.capacity??1;
      const used=db.prepare('SELECT COALESCE(SUM(units),0) u FROM leases WHERE resource_key=? AND expires_at>?').get(item.resourceKey,at).u;
      if(used+item.units>capacity)reasons.push(`resource ${item.resourceKey} capacity ${capacity} has ${used} used and needs ${item.units}`);
    }
    if(reasons.length)return {ok:false,reason:reasons.join('; '),reasons,pathConflicts:pathConflicts.map(({requested,held,job_id,workflow_id,op_id,expires_at})=>({requested,held,jobId:job_id,workflowId:workflow_id,opId:op_id,expiresAt:expires_at}))};
    const existing=db.prepare('SELECT * FROM jobs WHERE job_id=?').get(job.jobId);
    need(existing,`job ${job.jobId} is not enqueued`,'STARCI_JOB_NOT_FOUND');
    need(existing.workflow_id===job.workflowId,'Reservation identity does not match the durable job');
    if(existing.status==='queued')setJobStatus(db,{jobId:job.jobId,to:'ready',reason:'admission',at});
    setJobStatus(db,{jobId:job.jobId,to:'leased',reason:'admission',leaseToken:token,deadline:at+ttlMs,at,expect:['ready','queued']});
    for(const item of repoNeeds)acquireLease(db,{resourceKey:item.resourceKey,jobId:job.jobId,units:item.units,expiresAt:at+(item.ttlMs??ttlMs),at});
    return {ok:true,leaseToken:token,expiresAt:at+ttlMs,fencing:Object.fromEntries(repoNeeds.map(item=>[item.resourceKey,existing.generation]))};
  });
}
/** The mirror of reserveTwoPhase: drop the job's lease rows and, with `status`, move the job (a terminal status also drops leases). */
export function releaseTwoPhase(ledger,machine,{jobId,status=null,reason=null}={}){
  need(ledger?.transaction,'releaseTwoPhase needs a ledger handle');
  need(jobId,'releaseTwoPhase needs a job id');
  const released=ledger.transaction(db=>{
    const n=releaseLeases(db,{jobId});
    if(status)setJobStatus(db,{jobId,to:status,reason,leaseToken:null,deadline:null,at:ledger.now()});
    else updateJob(db,{jobId,leaseToken:null,deadline:null,at:ledger.now()});
    return n;
  });
  return {ok:true,released};
}

// ---------------------------------------------------------------------------------------------------------
// machine.sqlite (lane a3-2 replaces this block with engine/machine-db.mjs)
// ---------------------------------------------------------------------------------------------------------
const MACHINE_SQL=fs.readFileSync(new URL('machine.sql',import.meta.url),'utf8');
const realpathOf=file=>{try{return fs.realpathSync(file);}catch{return path.resolve(file);}};
const inTransaction=(db,fn)=>{beginImmediate(db);try{const result=fn();db.exec('COMMIT');return result;}catch(error){try{db.exec('ROLLBACK');}catch{}throw error;}};
function migrateMachine(db){
  const version=userVersion(db);
  need(version<=MACHINE_VERSION,`Machine db version ${version} is newer than supported ${MACHINE_VERSION}`);
  if(version!==0)return;
  inTransaction(db,()=>{if(userVersion(db)===0)db.exec(`${MACHINE_SQL}
    PRAGMA user_version=${MACHINE_VERSION};`);});
}
const MACHINE_PRAGMAS=Object.freeze({synchronous:'NORMAL',foreign_keys:'ON',temp_store:'MEMORY',cache_size:-16000,wal_autocheckpoint:8000,journal_size_limit:67108864});

/**
 * One-shot, idempotent registry maintenance: delete the `ledgers` rows whose file is missing or under the OS temp
 * directory. A row that still owns machine leases or budget reservations is kept.
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

/** The live registry refuses to enrol a ledger under the OS temp directory. */
export function openMachine({file,now=Date.now,busyTimeoutMs=LEDGER_BUSY_TIMEOUT_MS,journalMode='WAL',env=process.env,tempDirs=tempDirsOf(env)}={}){
  const {db,sqliteVersion,journalMode:actual}=openDb({file,busyTimeoutMs,journalMode,label:'openMachine',pragmas:MACHINE_PRAGMAS});
  migrateMachine(db);
  const transaction=makeTransaction(db,'machine');
  const live=!env[TEST_REGISTRY_ENV]&&!isUnderTempDir(file,{env,tempDirs});
  return {
    schema:MACHINE_SCHEMA,file,path:path.resolve(file),sqliteVersion,journalMode:actual,db,now,transaction,live,
    registerLedger({file:ledgerFile,ledgerId}={}){
      need(ledgerId,'registerLedger needs the ledger meta.ledger_id');
      if(live&&isUnderTempDir(ledgerFile,{env,tempDirs}))
        return {ledgerId,registered:false,refused:`registry-temp-ledger: ${path.resolve(ledgerFile)} is under the OS temp directory and ${path.resolve(file)} is the live registry; set ${TEST_REGISTRY_ENV} to a test registry`};
      const at=now();
      db.prepare('INSERT INTO ledgers(ledger_id,file,registered_at,seen_at) VALUES(?,?,?,?) ON CONFLICT(ledger_id) DO UPDATE SET file=excluded.file,seen_at=excluded.seen_at').run(ledgerId,realpathOf(ledgerFile),at,at);
      return {ledgerId,registered:true};
    },
    pruneRegistry(options={}){return pruneRegistry({db,transaction},{env,tempDirs,...options});},
    release(tokens){
      const list=[...new Set([tokens].flat().map(item=>typeof item==='string'?item:item?.token).filter(Boolean))];
      let released=0;for(const token of list)released+=db.prepare('DELETE FROM leases WHERE token=?').run(token).changes;
      return {ok:true,released};
    },
    close(){db.close();}
  };
}
