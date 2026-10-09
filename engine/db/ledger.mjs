import { installRefResolver } from './ref-value.mjs';
import { olderThan } from './version-order.mjs';
import { assertMutationFence } from '../../scripts/lib/mutation-fence.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {resourceAdmission,workflowOpSlots,SETTLED_JOB_LIST} from '../admission.mjs';
import {sha256} from '../digest.mjs';
import {putBlob,blobPath,artifactRoot} from './blob.mjs';import {EVENT_LIMITS,eventPayloadRecord} from './event-compact.mjs';
import {redactData,redactText} from '../../scripts/lib/redact.mjs';
import {isBusyError,newSpanId,newTraceId,withMachine} from './machine.mjs';
import {projectsRootFor,repoRootKey,resolveLedgerFile,ledgerFixtureInit,assertOperationalLedger} from './ledger-paths.mjs';
import { hasTable, insertRowWith } from '../../scripts/lib/sqlite.mjs';
// The machine-side path helpers have one definition (engine/db/machine.mjs); re-exported for the ledger's callers.
export {isUnderTempDir,machineFileFor,starciLocalRoot,TEST_REGISTRY_ENV} from './machine.mjs';
const require=createRequire(import.meta.url);

/*
 * runtime.sqlite — the one project ledger writer and reader opener. Its canonical DDL is executed as is:
 * STRICT tables, state machines and append-only guards refuse invalid SQL writes at the database boundary.
 * Unsupported schemas are preserved and refused; openLedger initializes a fresh store through ledgerFileFor.
 * Typed writes own state changes and their events hash chain in one transaction. Initialization-only samples
 * use the same DDL and journal, carry synthetic identity/portable metadata and never enroll a live project.
 */

// ---------------------------------------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------------------------------------
export const newToken=()=>crypto.randomBytes(24).toString('hex');
/**
 * jobs.status (DBTREE A4 job_transitions), grouped by what a row in that state still owes: `dispatchable` rows are the
 * live frontier, `awaiting` wait on a settle or decision, `fenced` keeps a launch whose effect is unproven, `settled`
 * holds nothing the runtime still needs. The SQL CHECK and job_transitions are the authority; this is their mirror.
 */
export const JOB_STATUSES=Object.freeze({
  dispatchable:Object.freeze(['queued','ready','leased','running','answering']),
  awaiting:Object.freeze(['reported','deciding']),
  fenced:Object.freeze(['effect_unknown']),
  settled:SETTLED_JOB_LIST,
});
export const SETTLED_JOB_STATUSES=JOB_STATUSES.settled;
// Queued operations and Kernel seats hold no operation slot; an unproved fenced launch still does.
export const OP_SLOT_HOLDING_STATUSES=Object.freeze([...JOB_STATUSES.dispatchable.filter(status=>status!=='queued'),...JOB_STATUSES.fenced]);
export const UNIT_STATES=Object.freeze(['planned','queued','running','reported','deciding','done','failed','dropped']);
const DEFAULT_TRY_BUDGET=5;
export const JOB_ARTIFACT_KINDS=Object.freeze(['diff','patch','image','video','report','log','trace','file']);
export const JOB_ARTIFACT_SUBKINDS=Object.freeze(['draw-render','asset-gen','app-capture','e2e-capture','uat-capture','uat-video','e2e-video',
  'playwright-trace','patch','patch-json','diff','report','log','critique','metrics','grammar-proposal','asset-request','terminal-transcript','cli-transcript']);
export const JOB_ARTIFACT_ROLES=Object.freeze(['check-output','check-stdout','check-stderr','patch','diff','report-attachment','log',
  'direction','prompt','render','redline','critique','capture','dom','screenshot','video','trace','uat-run','metrics','salvage','scan','other']);

export const LEDGER_SCHEMA='starci/runtime@1';
export const LEDGER_VERSION=1;

const need=(ok,message,code)=>{if(!ok)throw Object.assign(new Error(message),code?{code}:{});};
const json=value=>value===undefined||value===null?null:JSON.stringify(value);
const parseJson=text=>text===null||text===undefined?null:JSON.parse(text);

// ---------------------------------------------------------------------------------------------------------
// Paths (decision Q1: runtime.sqlite lives OUT of .starciwork, at <runtime root>/.runtime/projects/<ledger_id>/)
// ---------------------------------------------------------------------------------------------------------
/**
 * The runtime tree is never a Work root of its own: a project's Work root is its backend, reached through
 * `.workspaces`. A ledger for a root inside the runtime checkout is refused by name.
 */
const RUNTIME_MARKER=root=>fs.existsSync(path.join(root,'packages','cli','bin','starci.mjs'))
  &&fs.existsSync(path.join(root,'engine','db','ledger.mjs'));
export const isRuntimeRoot=root=>RUNTIME_MARKER(path.resolve(root));
/** True when `root` is a repository with a ledger on this host (the runtime checkout itself never is one). */
export const hasLedger=(root)=>{try{return !isRuntimeRoot(root)&&fs.existsSync(ledgerFileFor(root));}catch{return false;}};
export {PROJECTS_ROOT_ENV,projectsRootFor,ledgerIdForRepo} from './ledger-paths.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// file → repo root, for the meta seed (and registration) of a ledger created through ledgerFileFor.
const repoRootOfFile=new Map();
const resolvedFiles=new Map();
/**
 * The runtime.sqlite of a project, by its Work-root repository (decision Q1): the file machine.ledgers registers for
 * that root; an unregistered root gets <projects root>/<ledgerIdForRepo(root)>/runtime.sqlite, which openLedger creates
 * (meta.ledger_id = that id, meta.repo_root = the root) and registers in machine.ledgers. Resolved once per process.
 */
export const ledgerFileFor=(repoRoot,{env=process.env}={})=>{
  if(typeof repoRoot!=='string'||!repoRoot.trim())throw new Error('ledgerFileFor needs a repository root');
  const root=path.resolve(repoRoot);
  if(isRuntimeRoot(root))throw Object.assign(new Error(`ledger-root-is-runtime: ${root} is the StarCi runtime, not a Work root; route the project through .workspaces`),{code:'STARCI_LEDGER_ROOT_IS_RUNTIME'});
  const key=`${repoRootKey(root)}\n${projectsRootFor(env)}`;
  let file=resolvedFiles.get(key);
  if(!file){
    file=resolveLedgerFile(root,{env,openReader:openLedgerReader});
    if(fs.existsSync(file))resolvedFiles.set(key,file);
  }
  repoRootOfFile.set(path.resolve(file),root);
  return file;
};

// ---------------------------------------------------------------------------------------------------------
// Connection policy (DBTREE header "PRAGMA at open", RESEARCH-STORAGE §3)
// ---------------------------------------------------------------------------------------------------------
const INIT_SQL_FILE=new URL('./schema/runtime.sql',import.meta.url);
const INIT_SQL=fs.readFileSync(INIT_SQL_FILE,'utf8');
const LEDGER_BUSY_TIMEOUT_MS=15000;
/**
 * Writer pragmas. wal_autocheckpoint=0 on EVERY connection except the one checkpointer (openLedger({checkpointer:true}),
 * the reconciler engine): SQLite 3.50.4 (node:sqlite of Node 25.2.1) sits in the WAL-reset bug range 3.7.0–3.51.2 when two
 * connections checkpoint concurrently.
 */
export const LEDGER_PRAGMAS=Object.freeze({synchronous:'NORMAL',foreign_keys:'ON',temp_store:'MEMORY',cache_size:-16000,
  journal_size_limit:67108864,trusted_schema:'OFF',wal_autocheckpoint:0});
const CHECKPOINTER_AUTOCHECKPOINT=8000;
const READ_PRAGMAS=Object.freeze({query_only:'ON',temp_store:'MEMORY',cache_size:-16000,trusted_schema:'OFF'});
const applyPragmas=(db,pragmas)=>db.exec(Object.entries(pragmas).map(([k,v])=>`PRAGMA ${k}=${v};`).join(' '));
/** BEGIN IMMEDIATE: spin for `spinMs` without the busy handler's 15 ms sleeps, then wait with the connection's busy_timeout. */
const LEDGER_SPIN_MS=20;
export function beginImmediate(db,{spinMs=LEDGER_SPIN_MS}={}){
  if(spinMs>0){
    const busyTimeoutMs=Number(db.prepare('PRAGMA busy_timeout').get()?.timeout??LEDGER_BUSY_TIMEOUT_MS);
    db.exec('PRAGMA busy_timeout=0');
    try{
      const until=performance.now()+spinMs;
      for(;;){
        try{db.exec('BEGIN IMMEDIATE');return;}
        catch(error){if(!isBusyError(error)){throw error;}if(performance.now()>=until)break;}
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
      db=installRefResolver(new DatabaseSync(file,{timeout:busyTimeoutMs}));
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
const makeTransaction=(db,label,fixture=null)=>{let inside=false;const tx=fn=>{if(fixture){assertOperationalLedger(metaOf(db));}if(inside){throw new Error(`${label}-nested-transaction`);}inside=true;try{beginImmediate(db);}catch(error){inside=false;throw error;}openLedgerTransactions++;try{assertMutationFence({kind:'ledger-write',db});const result=fn(db);db.exec('COMMIT');return result;}catch(error){try{db.exec('ROLLBACK');}catch{/* rollback may fail */}throw error;}finally{inside=false;openLedgerTransactions--;}};tx.active=()=>inside;return tx;};
const userVersion=db=>Number(db.prepare('PRAGMA user_version').get().user_version);
const metaOf=db=>Object.fromEntries(db.prepare('SELECT key,value FROM meta').all().map(row=>[row.key,row.value]));
const assertWritableFile=(file,busyTimeoutMs)=>{if(fs.statSync(file).size===0){return;}const reader=openLedgerReader(file,{verify:false,busyTimeoutMs});try{if(hasTable(reader,'meta'))assertOperationalLedger(metaOf(reader));}finally{reader.close();}};
/** True when the ledger `db` holds `table`. */
export {hasTable as hasLedgerTable} from '../../scripts/lib/sqlite.mjs';
/** True when `table` of the ledger `db` has `column`. */
export const hasLedgerColumn=(db,table,column)=>db.prepare(`PRAGMA table_info(${table})`).all().some(c=>c.name===column);

/**
 * Refuse any file that is not a starci/runtime@1 ledger at user_version LEDGER_VERSION. Also refuses a
 * running SQLite older than the one the ledger recorded.
 */
function verifyLedger(db,{file,sqliteVersion}){
  const version=userVersion(db);
  let found=null;if(hasTable(db,'meta'))found=metaOf(db).schema;else if(hasTable(db,'jobs')||hasTable(db,'events'))found='no-meta';
  need(version===LEDGER_VERSION&&found===LEDGER_SCHEMA,
    `ledger-schema-refused: ${file} is ${found??'not a StarCi ledger'} at user_version ${version}, this runtime opens only ${LEDGER_SCHEMA} at user_version ${LEDGER_VERSION}; preserve the database and its WAL, use a compatible runtime, or resolve its identity with the owner`,'STARCI_LEDGER_SCHEMA_REFUSED');
  const recorded=metaOf(db).sqlite_version;
  need(!recorded||!olderThan(sqliteVersion,recorded),`ledger-sqlite-downgrade: ${file} was last opened by SQLite ${recorded}, this process runs ${sqliteVersion}`,'STARCI_LEDGER_SQLITE_DOWNGRADE');
}

/** Create the ledger on an empty file: schema/runtime.sql, user_version=LEDGER_VERSION, meta — one transaction. */
function initLedger(db,{file,now,sqliteVersion,journalMode,repoRoot=null,product=null,ledgerId=null,blobRoot=null,fixtureMarker=null}){
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
      blob_root:blobRoot??artifactRoot(),runtime_rev:runtimeRev()};
    if(fixtureMarker)meta.fixture=fixtureMarker;
    if(repoRoot)meta.repo_root=path.resolve(repoRoot);
    if(product)meta.product=product;
    for(const [k,v] of Object.entries(meta))if(v!=null)seed.run(k,String(v));
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
  const db=installRefResolver(new DatabaseSync(file,{readOnly:true,timeout:busyTimeoutMs}));
  try{
    // queryOnly:false only for a backup's VACUUM INTO (the file itself stays read-only).
    applyPragmas(db,queryOnly?READ_PRAGMAS:{...READ_PRAGMAS,query_only:'OFF'});
    if(verify)verifyLedger(db,{file,sqliteVersion:db.prepare('select sqlite_version() AS version').get().version});
  }catch(error){try{db.close();}catch{}throw error;}
  return db;
}
const rowOf=row=>row?{...row,payload:parseJson(row.payload_json)}:null;
export const readAccessors=db=>({
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
  let byDb=columnCache.get(db);if(!byDb){byDb=new Map();columnCache.set(db,byDb);}
  if(!byDb.has(table)){const cols=db.prepare(`PRAGMA table_xinfo(${table})`).all().filter(c=>c.hidden!==2&&c.hidden!==3).map(c=>c.name);need(cols.length,`unknown table ${table}`);byDb.set(table,new Set(cols));}
  return byDb.get(table);
};
/**
 * The free-text and JSON columns the writer redacts itself (scripts/lib/redact.mjs), so no caller can skip it: a log
 * message, a report, a check command, an incident detail... Identity columns (ids, shas, paths of record) are never
 * touched. events.payload_json is redacted in appendEvent, before its digest is taken.
 */
export const REDACTED_COLUMNS=Object.freeze({
  logs:['msg','data_json','refs_json'],reports:['report_json'],check_runs:['command','note','summary_json','attribution_json'],
  incidents:['detail','last_progress'],inbox:['payload_json','disposition_json'],decision_items:['summary','payload_json','evidence_json'],
  decisions:['rationale','result_json'],contracts:['markdown','context_json'],api_requests:['result_json'],op_attempts:['settle_json','why_json'],
  conditions:['message'],goals:['markdown','amendment_json'],settle_tails:['last_error'],
  record_changes:['reason'],foundations:['detail'],foundation_declarations:['detail'],interface_audits:['findings_json'],
});
const redactValue=(col,val)=>{
  if(val===null||val===undefined||typeof val!=='string')return val;
  if(col.endsWith('_json')){try{return JSON.stringify(redactData(JSON.parse(val)));}catch{return redactText(val);}}
  return redactText(val);
};
/** {camelKey:value} → [[column,sqlValue]] for `table`; JSON columns stringify; REDACTED_COLUMNS are redacted. */
function toColumns(db,table,fields){
  const cols=columnsOf(db,table),out=[];
  for(const [key,raw] of Object.entries(fields)){
    if(raw===undefined)continue;
    let col=snake(key),val=raw;
    if(!cols.has(col)&&cols.has(`${col}_json`)){col=`${col}_json`;val=json(raw);}
    else if(col.endsWith('_json')&&raw!==null&&typeof raw!=='string')val=json(raw);
    need(cols.has(col),`${table} has no column ${col} (key ${key})`,'STARCI_LEDGER_UNKNOWN_COLUMN');
    if(typeof val==='boolean')val=val?1:0;
    if(REDACTED_COLUMNS[table]?.includes(col))val=redactValue(col,val);
    out.push([col,val]);
  }
  return out;
}
const insertRow=insertRowWith(toColumns);
function updateRow(db,table,where,fields){
  const pairs=toColumns(db,table,fields),keys=toColumns(db,table,where);
  if(!pairs.length)return {changes:0};
  const sql=`UPDATE ${table} SET ${pairs.map(p=>p[0]+'=?').join(',')} WHERE ${keys.map(p=>p[0]+' IS ?').join(' AND ')}`;
  return db.prepare(sql).run(...pairs.map(p=>p[1]),...keys.map(p=>p[1]));
}
const nowMs=()=>Date.now();
const EVENT_PAYLOAD_MAX=EVENT_LIMITS.payloadBytes;

// --- blobs ------------------------------------------------------------------------------------------------
/** Index a blob already in the store (engine/db/blob.mjs putBlob). Idempotent on sha256. */
export function recordBlob(db,{sha256:sha,bytes,mediaType,fileUri,encoding=null,redaction=null,pinned=0,createdAt=nowMs()}){
  need(/^[a-f0-9]{64}$/.test(sha??''),'recordBlob needs a sha256');
  need(Number.isInteger(bytes)&&bytes>=0&&mediaType&&fileUri,'recordBlob needs bytes, mediaType and fileUri');
  insertRow(db,'blobs',{sha256:sha,bytes,mediaType,fileUri:String(fileUri).replaceAll('\\','/'),encoding,redaction,pinned,createdAt},{orIgnore:true});
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
 * One events row. The chain link is computed here inside the caller's BEGIN IMMEDIATE. A payload over 16 KiB, or one that carries a
 * launch admission decision or refusal (event-compact.mjs), goes whole to the blob store (payloadSha); the row keeps a bounded inline view.
 */
export function appendEvent(db,{eventId=newToken(),workflowId,entityType,entityId,generation=null,kind,payload=null,payloadSha=null,
  attemptId=null,spanId=null,occurredAt=null,createdAt=nowMs()}){
  need(workflowId&&entityType&&entityId!=null&&kind,'Event workflowId, entityType, entityId and kind are required');
  let payloadJson;({payloadJson,payloadSha}=eventPayloadRecord(payload,payloadSha,content=>storeBlob(db,{content,mediaType:'application/json',redaction:'v1',createdAt}).sha256));
  need(payloadJson===null||payloadJson.length<=EVENT_PAYLOAD_MAX||payloadSha,`event payload is ${payloadJson?.length} bytes (> ${EVENT_PAYLOAD_MAX}); store it as a blob and pass payloadSha`,'STARCI_EVENT_PAYLOAD_TOO_LARGE');
  if(payloadSha&&payloadJson?.length>EVENT_PAYLOAD_MAX)payloadJson=null;
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
  // The event goes first: an archived workflow refuses every later write (events_refuse_archived), its own last event included.
  appendEvent(db,{workflowId,entityType:'workflow',entityId:workflowId,kind:'phase-transition',payload:{from:row.phase,to,by,reason},createdAt:at});
  updateRow(db,'workflows',{workflowId},fields);
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
/** Rewrite a goal revision's derived json (starci kernel plan: the derived plan); markdown and approval never change. */
export function updateGoalJson(db,{goalSeq,goal,at=nowMs()}){
  const row=db.prepare('SELECT workflow_id,revision FROM goals WHERE goal_seq=?').get(goalSeq);
  need(row,`goal ${goalSeq} not found`);
  updateRow(db,'goals',{goalSeq},{json:json(goal)});
  appendEvent(db,{workflowId:row.workflow_id,entityType:'goal',entityId:row.workflow_id,kind:'goal-json-updated',payload:{revision:row.revision},createdAt:at});
}
/** Inbox rows by (workflow, kind, key[, status]) moved to `status`; returns how many moved. */
export function setInboxStatusByKey(db,{workflowId,kind,key=null,onlyStatus=null,status,disposition=undefined,at=nowMs()}){
  let sql='SELECT inbox_id FROM inbox WHERE workflow_id=? AND kind=?';const args=[workflowId,kind];
  if(key!==null){sql+=' AND key=?';args.push(key);}
  if(onlyStatus){sql+=' AND status=?';args.push(onlyStatus);}
  let n=0;for(const r of db.prepare(sql).all(...args))if(setInboxStatus(db,{inboxId:r.inbox_id,status,disposition,at}))n++;
  return n;
}
function recordGoalInput(db,{workflowId,key,goalRevision,sha256:sha,origin,createdAt=nowMs()}){
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
/** One work_graph_versions row + its event (`eventKind`/`eventPayload` name the caller's event; default graph-<event>). */
export function recordGraphVersion(db,{workflowId,version,event,graph,diff,colors,reason,authorOp,authorJob=null,digest,createdAt=nowMs(),
  eventKind=`graph-${event}`,eventPayload={version,event,reason,authorOp,authorJob,digest}}){
  insertRow(db,'work_graph_versions',{workflowId,version,event,graphJson:json(graph),diffJson:json(diff),colorsJson:json(colors),reason,authorOp,authorJob,digest,createdAt});
  appendEvent(db,{workflowId,entityType:'work-graph',entityId:workflowId,kind:eventKind,payload:eventPayload,createdAt});
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
  if(job.status===to){if(Object.keys(fields).length){updateRow(db,'jobs',{jobId},{...fields,updatedAt:at});}return false;}
  updateRow(db,'jobs',{jobId},{...fields,status:to,updatedAt:at});
  appendEvent(db,{workflowId:job.workflow_id,entityType:'job',entityId:jobId,kind:'job-status',attemptId,spanId,payload:{from:job.status,to,reason},createdAt:at});
  return true;
}
/**
 * A job's result (jobs has no result column: DBTREE keeps results on the attempt). With an attempt: the job's newest
 * attempt gets settle_json = result (and verdict / failure_class / next_step when the result names valid ones). Without
 * one (a job cancelled before dispatch, a kernel job): one 'job-result' event carries it. Read back with jobResult.
 */
const VERDICTS=new Set(['pass','fail','partial','blocked','dropped','cancelled']);
export function recordJobResult(db,{jobId,result,at=nowMs()}){
  const job=db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  need(job,`job ${jobId} not found`,'STARCI_JOB_NOT_FOUND');
  const attempt=db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=? ORDER BY attempt_id DESC LIMIT 1').get(jobId);
  if(attempt){
    const fields={settleJson:json(result??null)};
    if(result&&VERDICTS.has(result.verdict))fields.verdict=result.verdict;
    if(result?.failureClass!=null)fields.failureClass=typeof result.failureClass==='string'?result.failureClass:json(result.failureClass);
    if(result?.nextStep!=null)fields.nextStep=typeof result.nextStep==='string'?result.nextStep:json(result.nextStep);
    updateAttempt(db,{attemptId:attempt.attempt_id,at,...fields});
  }else appendEvent(db,{workflowId:job.workflow_id,entityType:'job',entityId:jobId,kind:'job-result',payload:result??null,createdAt:at});
  return true;
}
/** The result recordJobResult stored for `jobId` (the newest attempt's settle_json, else the newest job-result event), or null. */
export function jobResult(db,jobId){
  const a=db.prepare('SELECT settle_json FROM op_attempts WHERE job_id=? ORDER BY attempt_id DESC LIMIT 1').get(jobId);
  if(a)return parseJson(a.settle_json);
  const e=db.prepare("SELECT payload_json FROM events WHERE entity_type='job' AND entity_id=? AND kind='job-result' ORDER BY seq DESC LIMIT 1").get(jobId);
  return e?parseJson(e.payload_json):null;
}
/**
 * The kernel seat's job (kernel-<wf>, kind 'kernel', no unit): created running on first boot; a released seat (ready)
 * goes ready → leased → running; a running one is re-bound (adoption). A kernel job that ended cannot come back.
 */
export function bindKernelJob(db,{workflowId,workerId,payload=undefined,generation=undefined,reason='kernel-boot',at=nowMs()}){
  const jobId=`kernel-${workflowId}`;
  const job=db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  if(!job){enqueueJob(db,{jobId,workflowId,kind:'kernel',role:'kernel',status:'running',payload:payload??null,generation,createdAt:at});updateRow(db,'jobs',{jobId},{workerId,updatedAt:at});return jobId;}
  need(!SETTLED_JOB_STATUSES.includes(job.status),`kernel-job-ended: ${jobId} is ${job.status}`,'STARCI_KERNEL_JOB_ENDED');
  const fields={workerId};if(payload!==undefined){fields.payload=payload;}if(generation!==undefined){fields.generation=generation;}
  if(job.status==='running'){updateRow(db,'jobs',{jobId},{...fields,updatedAt:at});return jobId;}
  if(job.status==='queued')setJobStatus(db,{jobId,to:'ready',reason,at});
  if(['queued','ready'].includes(job.status))setJobStatus(db,{jobId,to:'leased',reason,at});
  updateRow(db,'jobs',{jobId},{...fields,updatedAt:at});
  setJobStatus(db,{jobId,to:'running',reason,at});
  return jobId;
}
/** Release the kernel seat's job (running → ready) so a later boot re-binds it; returns false when it was not running. */
export function releaseKernelJob(db,{workflowId,reason='kernel-stopped',at=nowMs()}){
  const jobId=`kernel-${workflowId}`;
  const job=db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId);
  if(job?.status!=='running')return false;
  setJobStatus(db,{jobId,to:'ready',reason,workerId:null,at});
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
/**
 * A launch the host refused ends its attempt here, in the refusal's own transaction: end_state requeued (nothing ran, the
 * job goes back to ready) or effect-unknown (a worker may have started; reconcile decides). A requeued attempt is also
 * settled by the kernel (settled_at, no verdict: nothing was judged) and released, so every reader that asks "still open?"
 * answers no; task_closed_at is stamped when its Orca Task was closed. A refused launch is never a try of the unit and
 * never a dispatch it spent: work_units.dispatches (the "attempts" the UI counts) gives the slot back.
 * An attempt that is already sealed or ended otherwise is left alone (returns false).
 */
export function endRejectedAttempt(db,{attemptId,endState,effectState,releasedAt=null,taskClosedAt=null,at=nowMs()}){
  need(['requeued','effect-unknown'].includes(endState),`a refused launch ends requeued or effect-unknown, not ${endState}`);
  const row=db.prepare('SELECT * FROM op_attempts WHERE attempt_id=?').get(attemptId);
  need(row,`attempt ${attemptId} not found`,'STARCI_ATTEMPT_NOT_FOUND');
  if(row.settled_at!=null||row.end_state!=null)return false;
  updateAttempt(db,{attemptId,at,endState,effectState,...(releasedAt!=null?{releasedAt,settledAt:releasedAt,settledBy:'kernel'}:{}),...(taskClosedAt!=null?{taskClosedAt}:{})});
  if(row.unit_id)db.prepare('UPDATE work_units SET dispatches=max(dispatches-1,0),updated_at=? WHERE workflow_id=? AND unit_id=?').run(at,row.workflow_id,row.unit_id);
  return true;
}
/** Re-baseline an attempt's contract context (settle's input digests); the markdown and revision never change. */
export function updateContractContext(db,{attemptId,context}){
  need(db.prepare('SELECT 1 FROM contracts WHERE attempt_id=?').get(attemptId),`contract of attempt ${attemptId} not found`);
  updateRow(db,'contracts',{attemptId},{context});
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
  const fields={renewedAt:at,expiresAt};if(attemptId!==undefined){fields.attemptId=attemptId;}if(holder!==undefined){fields.holder=holder;}
  return updateRow(db,'leases',{jobId},fields).changes;
}
export function releaseLeases(db,{jobId}){return db.prepare('DELETE FROM leases WHERE job_id=?').run(jobId).changes;}

// --- api_requests (idempotency) ----------------------------------------------------------------------------------
/** request_id = --request-id, or sha(verb + dispatch_id + args). */
const requestIdOf=({verb,dispatchId=null,args=null})=>sha256(`${verb}\n${dispatchId??''}\n${json(args)??''}`);
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
function recordFailedRequest(db,{requestId,verb,caller=null,workflowId=null,attemptId=null,args=null,error,at=nowMs()}){
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
  const reportJson=redactValue('report_json',typeof report==='string'?report:json(report));
  const prior=db.prepare('SELECT * FROM reports WHERE attempt_id=?').get(attemptId);
  if(prior){need(prior.report_json===reportJson&&prior.outcome===outcome,`report-already-filed: attempt ${attemptId} has a different report`,'STARCI_REPORT_ALREADY_FILED');return {...prior,replayed:true};}
  const {lastInsertRowid}=insertRow(db,'reports',{workflowId:a.workflow_id,attemptId,dispatchId:a.dispatch_id,jobId:a.job_id,outcome,reportJson,fromTerminal,createdAt});
  updateAttempt(db,{attemptId,reportOutcome:outcome,reportedAt:createdAt,at:createdAt});
  return db.prepare('SELECT * FROM reports WHERE report_id=?').get(lastInsertRowid);
}
/** Mark an attempt's report consumed (by attemptId, or workflowId + dispatchId); returns true when it was not yet. */
export function markReportConsumed(db,{attemptId=null,workflowId=null,dispatchId=null,at=nowMs()}){
  const id=attemptId??db.prepare('SELECT attempt_id FROM reports WHERE workflow_id=? AND dispatch_id=?').get(workflowId,dispatchId)?.attempt_id;
  if(id==null)return false;
  const changed=db.prepare('UPDATE reports SET consumed_at=? WHERE attempt_id=? AND consumed_at IS NULL').run(at,id).changes>0;
  if(changed)updateAttempt(db,{attemptId:id,consumedAt:at,at});
  return changed;
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
/** A periodic scrollback snapshot; an unchanged scrollback adds nothing. */
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
function recordLlmUsage(db,{workflowId,subjectType,attemptId=null,turnRef=null,provider,source,at=nowMs(),...fields}){
  insertRow(db,'llm_usage',{workflowId,subjectType,attemptId,turnRef,provider,source,at,...fields});
}

const USAGE_COLUMNS=r=>({responseModel:r.model??null,inputTokens:r.inputTokens??null,outputTokens:r.outputTokens??null,cacheReadTokens:r.cacheReadTokens??null,
  cacheWriteTokens:r.cacheWriteTokens??null,reasoningTokens:r.reasoningTokens??null,costUsd:r.costUsd??null,turns:r.turns??null,toolCalls:r.toolCalls??null,toolErrors:r.toolErrors??null});
/**
 * The measured usage of one op attempt (scripts/kernel/usage-record.mjs): one llm_usage row per model, the summary on
 * op_attempts (tokens_in = fresh + cache read + cache write, tokens_out, cost_usd only when every model is priced,
 * usage_source) and one 'attempt-usage-recorded' event. An attempt that already has llm_usage rows is left alone, so a
 * re-run never double counts. Returns {recorded, rows}.
 */
export function recordAttemptUsage(db,{attemptId,rows,source='cli-transcript',provider=null,requestModel=null,sessions=null,at=nowMs()}){
  const a=db.prepare('SELECT * FROM op_attempts WHERE attempt_id=?').get(attemptId);
  need(a,`attempt ${attemptId} not found`,'STARCI_ATTEMPT_NOT_FOUND');
  need(Array.isArray(rows)&&rows.length,'recordAttemptUsage needs at least one usage row');
  if(db.prepare("SELECT 1 FROM llm_usage WHERE subject_type='attempt' AND attempt_id=? LIMIT 1").get(attemptId))return {recorded:false,rows:0};
  for(const r of rows)recordLlmUsage(db,{workflowId:a.workflow_id,subjectType:'attempt',attemptId,provider:provider??a.provider??a.agent??'unknown',source,at,
    spanId:a.span_id,requestModel:requestModel??a.request_model??a.model??null,...USAGE_COLUMNS(r)});
  const tokensIn=rows.reduce((n,r)=>n+(r.inputTokens??0)+(r.cacheReadTokens??0)+(r.cacheWriteTokens??0),0);
  const tokensOut=rows.reduce((n,r)=>n+(r.outputTokens??0),0);
  const costUsd=rows.every(r=>typeof r.costUsd==='number')?Math.round(rows.reduce((n,r)=>n+r.costUsd,0)*1e6)/1e6:null;
  updateAttempt(db,{attemptId,at,tokensIn,tokensOut,costUsd,usageSource:source,usageReason:null});
  appendEvent(db,{workflowId:a.workflow_id,entityType:'attempt',entityId:String(attemptId),attemptId,spanId:a.span_id,kind:'attempt-usage-recorded',
    payload:{attemptId,source,models:rows.map(r=>r.model),tokensIn,tokensOut,costUsd,...(sessions?{sessions}:{})},createdAt:at});   // sessions: [{session id, matchedBy, where}] - the exact link
  return {recorded:true,rows:rows.length};
}
/**
 * An attempt whose usage cannot be measured: usage_source 'unavailable' and usage_reason (no usage adapter for its agent, or no
 * session file found after the grace window). Never overwrites a measured attempt; a later measurement (recordAttemptUsage) replaces it.
 * One 'attempt-usage-unavailable' event when the recorded reason changes. Returns {marked}.
 */
export function markAttemptUsageUnavailable(db,{attemptId,reason,at=nowMs()}){
  const a=db.prepare('SELECT * FROM op_attempts WHERE attempt_id=?').get(attemptId);
  need(a,`attempt ${attemptId} not found`,'STARCI_ATTEMPT_NOT_FOUND');
  need(reason,'markAttemptUsageUnavailable needs a reason');
  if(db.prepare("SELECT 1 FROM llm_usage WHERE subject_type='attempt' AND attempt_id=? LIMIT 1").get(attemptId))return {marked:false};
  if(a.usage_source==='unavailable'&&a.usage_reason===reason)return {marked:false};
  updateAttempt(db,{attemptId,at,tokensIn:null,tokensOut:null,costUsd:null,usageSource:'unavailable',usageReason:reason});
  appendEvent(db,{workflowId:a.workflow_id,entityType:'attempt',entityId:String(attemptId),attemptId,spanId:a.span_id,kind:'attempt-usage-unavailable',payload:{attemptId,reason},createdAt:at});
  return {marked:true};
}
/**
 * The usage a Kernel seat's session added since its last recording: one llm_usage row per model, subject 'kernel-turn',
 * turn_ref '<kernel:workflow>:<session>@<turns so far>' (the caller derives it from what the ledger already holds, so a
 * re-run over an unchanged session adds nothing). One 'kernel-usage-recorded' event. Returns {recorded, rows}.
 */
export function recordKernelUsage(db,{workflowId,turnRef,rows,provider,source='cli-transcript',requestModel=null,at=nowMs()}){
  need(workflowId&&turnRef&&provider,'recordKernelUsage needs workflowId, turnRef and provider');
  need(db.prepare('SELECT 1 FROM workflows WHERE workflow_id=?').get(workflowId),`workflow ${workflowId} not found`,'STARCI_WORKFLOW_NOT_FOUND');
  if(!Array.isArray(rows)||!rows.length)return {recorded:false,rows:0};
  if(db.prepare("SELECT 1 FROM llm_usage WHERE subject_type='kernel-turn' AND workflow_id=? AND turn_ref=? LIMIT 1").get(workflowId,turnRef))return {recorded:false,rows:0};
  for(const r of rows)recordLlmUsage(db,{workflowId,subjectType:'kernel-turn',turnRef,provider,source,at,requestModel,...USAGE_COLUMNS(r)});
  appendEvent(db,{workflowId,entityType:'workflow',entityId:workflowId,kind:'kernel-usage-recorded',
    payload:{turnRef,source,models:rows.map(r=>r.model),tokens:rows.reduce((n,r)=>n+(r.inputTokens??0)+(r.cacheReadTokens??0)+(r.cacheWriteTokens??0)+(r.outputTokens??0),0)},createdAt:at});
  return {recorded:true,rows:rows.length};
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
  const moved=prior?.status!==status;
  db.prepare(`INSERT INTO conditions(workflow_id,entity_type,entity_id,type,status,reason,message,owner,observed_generation,last_transition_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(entity_type,entity_id,type) DO UPDATE SET status=excluded.status,reason=excluded.reason,message=excluded.message,owner=excluded.owner,
    observed_generation=excluded.observed_generation,updated_at=excluded.updated_at,last_transition_at=CASE WHEN conditions.status<>excluded.status THEN excluded.last_transition_at ELSE conditions.last_transition_at END`)
    .run(workflowId,entityType,String(entityId),type,status,reason,message,owner,observedGeneration,at,at);
  if(moved)appendEvent(db,{workflowId,entityType,entityId:String(entityId),kind:'condition-changed',payload:{type,from:prior?.status??null,to:status,reason},createdAt:at});
  return moved;
}
const INCIDENT_KINDS=Object.freeze(['infra-provider','config-defect','owner-ask','credential-missing','safety-block','runtime-defect','evidence-missing','scope-change','partial-effect','other']);
/**
 * The runtime's free incident kinds (starci kernel incident --kind, the '[kind] detail' prefix of last_progress) mapped onto the
 * incidents.kind enum and the owner who must clear it. An enum value maps to itself.
 */
function incidentClassOf(freeKind){
  const k=String(freeKind??'').toLowerCase();
  if(INCIDENT_KINDS.includes(k)){let owner='kernel';if(['owner-ask','credential-missing','safety-block','scope-change','partial-effect'].includes(k)){owner='owner';}if(['runtime-defect','config-defect'].includes(k)){owner='supervisor';}return {kind:k,owner};}
  if(/owner|handover|approval/.test(k)){return {kind:'owner-ask',owner:'owner'};}
  if(/credential|secret|provision/.test(k)){return {kind:'credential-missing',owner:'owner'};}
  if(/safety/.test(k)){return {kind:'safety-block',owner:'owner'};}
  if(/scope|goal/.test(k)){return {kind:'scope-change',owner:'owner'};}
  if(/partial|effect/.test(k)){return {kind:'partial-effect',owner:'owner'};}
  if(/infra|provider|quota|environment|network/.test(k)){return {kind:'infra-provider',owner:'kernel'};}
  if(/config/.test(k)){return {kind:'config-defect',owner:'supervisor'};}
  if(/supervisor|runtime|orca|settler|tree|kernel/.test(k)){return {kind:'runtime-defect',owner:'supervisor'};}
  if(/evidence|proof|capture/.test(k)){return {kind:'evidence-missing',owner:'kernel'};}
  return {kind:'other',owner:'kernel'};
}
/** Open one incident. A free `kind` (peer-wait, owner-gate, ...) is classed by incidentClassOf; `owner` defaults to the class's. */
export function openIncident(db,{incidentId=`inc-${newToken().slice(0,12)}`,workflowId,kind,owner=null,detail=null,lastProgress=null,dueAt=null,opId=null,jobId=null,attemptId=null,at=nowMs()}){
  const cls=incidentClassOf(kind);kind=cls.kind;owner=owner??cls.owner;
  insertRow(db,'incidents',{incidentId,workflowId,opId,jobId,attemptId,kind,detail,lastProgress,owner,dueAt,status:'open',createdAt:at,updatedAt:at});
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
  const fields={status};if(disposition!==undefined){fields.dispositionJson=json(disposition);}if(['applied','done'].includes(status)){fields.appliedAt=at;}
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
const SIGNAL_MUTABLE=new Set(['holderPid','token','value','expiresAt','at','workflowId']);
/** Update fields of an existing signal (only when its token matches, if `token` is given); returns true when a row changed. */
export function updateSignal(db,{scope,key,token=undefined,...fields}){
  for(const k of Object.keys(fields))need(SIGNAL_MUTABLE.has(k),`updateSignal cannot set ${k}`);
  const where={scope,key};if(token!==undefined)where.token=token;
  const set={...fields};if('value' in set){set.valueJson=json(set.value);delete set.value;}
  return updateRow(db,'signals',where,set).changes>0;
}
export function clearSignal(db,{scope,key,token=null}){
  return (token?db.prepare('DELETE FROM signals WHERE scope=? AND key=? AND token=?').run(scope,key,token):db.prepare('DELETE FROM signals WHERE scope=? AND key=?').run(scope,key)).changes>0;
}
/** settle_tails queue (replaces <ledger dir>/settle-tail/<job>.json). */
export function queueSettleTail(db,{attemptId,dueAt=null,at=nowMs()}){
  const a=db.prepare('SELECT workflow_id FROM op_attempts WHERE attempt_id=?').get(attemptId);need(a,`attempt ${attemptId} not found`);
  insertRow(db,'settle_tails',{attemptId,workflowId:a.workflow_id,state:'queued',dueAt,queuedAt:at},{orIgnore:true});
}
function updateSettleTail(db,{attemptId,state,lastError=undefined,dueAt=undefined,at=nowMs()}){
  const fields={state};if(lastError!==undefined){fields.lastError=lastError;}if(dueAt!==undefined){fields.dueAt=dueAt;}
  if(state==='running'){fields.startedAt=at;db.prepare('UPDATE settle_tails SET tries=tries+1 WHERE attempt_id=?').run(attemptId);}
  if(state==='done')fields.doneAt=at;
  return updateRow(db,'settle_tails',{attemptId},fields).changes>0;
}

// --- shared foundations, declarations, path transfers, record changes (A6) ------------------------------------------
const FOUNDATION_KIND_ENUM=new Set(['brand','grammar','layout-tree','shell','module','contract','other']);
/**
 * Upsert one foundations row. `kind` outside the table enum is stored as 'other'; `state` 'landed' is 'published'.
 * `detail` is the caller's full record (kept as JSON text: the table has no column for dependents and history).
 */
const detailText=detail=>{if(detail==null){return null;}return typeof detail==='string'?redactText(detail):JSON.stringify(redactData(detail));};
export function upsertFoundation(db,{name,kind='other',state,ownerWorkflow=null,version=null,detail=null,workRef=null,at=nowMs()}){
  const k=FOUNDATION_KIND_ENUM.has(kind)?kind:'other',st=state==='landed'?'published':state;
  const text=detailText(detail);
  db.prepare(`INSERT INTO foundations(name,kind,state,owner_workflow,version,detail,work_ref,updated_at) VALUES(?,?,?,?,?,?,?,?)
    ON CONFLICT(name) DO UPDATE SET kind=excluded.kind,state=excluded.state,owner_workflow=excluded.owner_workflow,version=excluded.version,
    detail=excluded.detail,work_ref=excluded.work_ref,updated_at=excluded.updated_at`).run(name,k,st,ownerWorkflow,version,text,workRef,at);
}
/** A workflow's foundation declaration (builds_none, detail as JSON text). */
export function declareFoundations(db,{workflowId,buildsNone,detail=null,at=nowMs()}){
  const text=detailText(detail);
  db.prepare('INSERT INTO foundation_declarations(workflow_id,builds_none,detail,at) VALUES(?,?,?,?) ON CONFLICT(workflow_id) DO UPDATE SET builds_none=excluded.builds_none,detail=excluded.detail,at=excluded.at')
    .run(workflowId,buildsNone?1:0,text,at);
}
/** One path_transfers row (the path's current ownership transfer); `detail` is the full transfer record. */
export function recordPathTransfer(db,{path:p,fromWorkflow=null,toWorkflow=null,bridgeId=null,state='applied',detail=null,at=nowMs()}){
  db.prepare(`INSERT INTO path_transfers(path,from_workflow,to_workflow,bridge_id,state,detail_json,at) VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(path) DO UPDATE SET from_workflow=excluded.from_workflow,to_workflow=excluded.to_workflow,bridge_id=excluded.bridge_id,
    state=excluded.state,detail_json=excluded.detail_json,at=excluded.at`).run(p,fromWorkflow,toWorkflow,bridgeId,state,json(detail),at);
}
/** One record_changes row (append-only history of a Work record's declared changes); `reason` may carry the entry as JSON. */
export function recordRecordChange(db,{changeId=`rc-${newToken().slice(0,16)}`,workflowId=null,recordId,recordPath=null,reason=null,by=null,at=nowMs()}){
  const wf=workflowId&&db.prepare('SELECT 1 FROM workflows WHERE workflow_id=?').get(workflowId)?workflowId:null;
  insertRow(db,'record_changes',{changeId,workflowId:wf,recordId,recordPath,reason:reason==null||typeof reason==='string'?reason:JSON.stringify(reason),by,at});
  return changeId;
}

// --- blob GC hooks (scripts/housekeeping/blob-gc.mjs; `dbOrLedger` is a db or an openLedger handle) ---------------------
/** Mark a blob archived in this ledger's index (the zip it now lives in: '<zip>!<entry>'). */
export function markBlobArchived(dbOrLedger,{sha256:sha,archivedAt=nowMs(),archiveRef}){
  const db=dbOrLedger.db??dbOrLedger;
  return db.prepare('UPDATE blobs SET archived_at=?,archive_ref=? WHERE sha256=?').run(archivedAt,archiveRef??null,sha).changes>0;
}
/**
 * Drop attempt_transcript_snapshots that are no longer needed: every snapshot of an attempt whose final transcript is
 * stored (op_attempts.transcript_sha), and any snapshot older than the retention of its attempt's verdict (pass: passMs,
 * anything else: failMs). Returns the number of rows deleted.
 */
function pruneAttemptSnapshots(dbOrLedger,{now=nowMs(),passMs,failMs}){
  const db=dbOrLedger.db??dbOrLedger;
  need(Number.isFinite(passMs)&&Number.isFinite(failMs),'pruneAttemptSnapshots needs passMs and failMs');
  const run=d=>d.prepare(`DELETE FROM attempt_transcript_snapshots WHERE snapshot_id IN (
      SELECT s.snapshot_id FROM attempt_transcript_snapshots s JOIN op_attempts a ON a.attempt_id=s.attempt_id
       WHERE a.transcript_sha IS NOT NULL OR s.at < ? - CASE WHEN a.verdict='pass' THEN ? ELSE ? END)`).run(now,passMs,failMs).changes;
  return dbOrLedger.transaction&&!dbOrLedger.transaction.active?.()?dbOrLedger.transaction(run):run(db);
}

// --- workflow purge (the one delete path: archive verified first, then one cascading DELETE) --------------------------
/** Upsert the workflow_purges record; the table CHECK refuses deleting/purged without approval and a verified archive. */
export function recordPurge(db,{workflowId,state,at=nowMs(),...fields}){
  const prior=db.prepare('SELECT 1 FROM workflow_purges WHERE workflow_id=?').get(workflowId);
  if(!prior)insertRow(db,'workflow_purges',{workflowId,state,createdAt:at,...fields});
  else updateRow(db,'workflow_purges',{workflowId},{state,...fields});
  return db.prepare('SELECT * FROM workflow_purges WHERE workflow_id=?').get(workflowId);
}
/**
 * Delete every row of a workflow: one DELETE on workflows, every workflow table cascading (DBTREE: FK ON DELETE CASCADE).
 * Only while its workflow_purges row is 'deleting' (the events/logs delete guards open for it then). Returns rows per table.
 */
export function deleteWorkflowRows(db,{workflowId}){
  need(db.prepare("SELECT state FROM workflow_purges WHERE workflow_id=?").get(workflowId)?.state==='deleting',`purge-not-deleting: ${workflowId} has no workflow_purges row in state deleting`,'STARCI_PURGE_NOT_DELETING');
  const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name<>'workflow_purges'").all().map(r=>r.name)
    .filter(t=>db.prepare(`PRAGMA table_info(${t})`).all().some(c=>c.name==='workflow_id'));
  const counts=Object.fromEntries(tables.map(t=>[t,Number(db.prepare(`SELECT count(*) n FROM ${t} WHERE workflow_id=?`).get(workflowId).n)]));
  db.prepare('DELETE FROM workflows WHERE workflow_id=?').run(workflowId);
  return counts;
}

/** Every typed write, for the handle's `write` namespace. */
const LEDGER_WRITES=Object.freeze({recordBlob,storeBlob,appendEvent,createWorkflow,ensureWorkflow,changeWorkflowPhase,updateWorkflow,insertGoal,recordGoalInput,
  createUnit,setUnitState,reopenUnit,raiseTryBudget,addUnitEdge,recordGraphVersion,enqueueJob,setJobStatus,updateJob,startAttempt,updateAttempt,endRejectedAttempt,writeContract,
  declareResource,acquireLease,renewLeases,releaseLeases,idempotent,recordFailedRequest,fileReport,markReportConsumed,recordCheckRun,recordArtifact,attachToReport,
  recordArtifactProof,citeBlob,recordTranscriptSnapshot,setAttemptTranscript,recordLlmUsage,recordAttemptUsage,markAttemptUsageUnavailable,recordKernelUsage,appendLog,setLogCursor,setCondition,openIncident,updateIncident,resolveIncident,
  postInbox,setInboxStatus,setInboxStatusByKey,updateGoalJson,openDecisionItem,updateDecisionItem,recordDecision,setSignal,updateSignal,clearSignal,queueSettleTail,recordJobResult,bindKernelJob,releaseKernelJob,recordPurge,deleteWorkflowRows,markBlobArchived,pruneAttemptSnapshots,upsertFoundation,declareFoundations,recordPathTransfer,recordRecordChange,updateSettleTail});

// initLedger + verifyLedger + the meta touch-ups of a fresh openLedger open; throws leaving the caller to close db.
const initAndVerifyLedger=(db,{file,now,sqliteVersion,journalMode,repoRoot,product,fixture})=>{const created=initLedger(db,{file,now,sqliteVersion:fixture?.sqliteVersion??sqliteVersion,journalMode,repoRoot,product,...(fixture?{ledgerId:fixture.ledgerId,blobRoot:fixture.blobRoot,fixtureMarker:fixture.marker}:{})});verifyLedger(db,{file,sqliteVersion});const meta=metaOf(db);if(!fixture){assertOperationalLedger(meta);}if(!fixture&&meta.sqlite_version!==sqliteVersion){db.prepare("UPDATE meta SET value=? WHERE key='sqlite_version'").run(sqliteVersion);}return created;};
// A new ledger enrols itself in machine.ledgers (repo_root from its meta); a refusal (temp file on the live registry) is fine.
const registerNewLedger=(db,created,{file,resolved,ledgerId})=>{if(!created){return;}const own=metaOf(db);if(own.repo_root){try{withMachine(m=>m.registerLedger({ledgerId,file:resolved,repoRoot:own.repo_root,product:own.product??null,schemaVersion:LEDGER_VERSION}));}catch{/* registry unavailable: resolved by name until it is */}}};
/**
 * The read-write handle. A new (empty) file is created from schema/runtime.sql; any other schema is refused (clean slate).
 * `checkpointer:true` is the one connection that checkpoints (the reconciler engine): wal_autocheckpoint=8000 and
 * handle.checkpoint() for the periodic PASSIVE checkpoint; every other connection runs wal_autocheckpoint=0.
 * `write.<fn>(args)` runs one typed write in its own transaction; inside handle.transaction(db=>…) call the exported
 * functions with that db. `fixture:{ledgerId,createdAt,blobRoot[,sqliteVersion]}` creates only a fresh sample that records the stated SQLite version (default the running one); its typed
 * mutations and later writable opens refuse. The clock is frozen and no registry binding is accepted.
 */
export function openLedger({file,now=Date.now,busyTimeoutMs=LEDGER_BUSY_TIMEOUT_MS,repoRoot=null,product=null,checkpointer=false,machine=null,fixture=null}={}){
  fixture=ledgerFixtureInit(fixture,{file,repoRoot,product,machine,mapped:typeof file==='string'&&repoRootOfFile.has(path.resolve(file)),checkpointer,now});
  if(fixture){fs.closeSync(fs.openSync(file,'wx'));now=()=>fixture.createdAt;}else if(typeof file==='string'&&fs.existsSync(file)){assertWritableFile(file,busyTimeoutMs);}
  const pragmas=checkpointer?{...LEDGER_PRAGMAS,wal_autocheckpoint:CHECKPOINTER_AUTOCHECKPOINT}:LEDGER_PRAGMAS;
  const {db,sqliteVersion,journalMode}=openDb({file,busyTimeoutMs,journalMode:'WAL',autoVacuum:true,label:'openLedger',pragmas});
  const resolved=path.resolve(file);
  let created=false;
  try{created=initAndVerifyLedger(db,{file,now,sqliteVersion,journalMode,repoRoot:repoRoot??repoRootOfFile.get(resolved)??null,product,fixture});}catch(error){try{db.close();}catch{}throw error;}
  const transaction=makeTransaction(db,'ledger',fixture),ledgerId=ledgerIdOf({db});
  registerNewLedger(db,created,{file,resolved,ledgerId});
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
  need(fs.existsSync(file),`openLedgerConnection needs an existing ledger: ${file}`);assertWritableFile(file,busyTimeoutMs);
  const {db,sqliteVersion}=openDb({file,busyTimeoutMs,journalMode:'WAL',label:'openLedgerConnection'});
  try{verifyLedger(db,{file,sqliteVersion});}catch(error){try{db.close();}catch{}throw error;}
  return db;
}

/**
 * Admission: in one ledger transaction, refuse on a durable path-lease overlap or a full repo resource, else move the job
 * ready → leased with its fencing token and write its leases. The ledger is registered on the machine registry first.
 */
export function reserveTwoPhase(ledger,machine,{job,leases=[],ttlMs=60000,canonicalOf=null,opSlots=null}={}){
  need(ledger?.transaction&&ledger?.db,'reserveTwoPhase needs a ledger handle');
  need(machine?.registerLedger,'reserveTwoPhase needs a machine handle');
  need(job?.jobId&&job?.workflowId,'Job identity is required');
  const merge=list=>{const byKey=new Map();for(const item of list){need(item?.resourceKey&&Number.isInteger(item.units)&&item.units>0,'Invalid resource request');const prev=byKey.get(item.resourceKey);byKey.set(item.resourceKey,{resourceKey:item.resourceKey,units:(prev?.units??0)+item.units,ttlMs:item.ttlMs??prev?.ttlMs??null});}return [...byKey.values()];};
  const repoNeeds=merge(leases);
  machine.registerLedger({file:ledger.path,ledgerId:ledger.ledgerId??ledgerIdOf(ledger)});
  return ledger.transaction(db=>{
    const at=ledger.now(),token=newToken();
    const existing=db.prepare('SELECT * FROM jobs WHERE job_id=?').get(job.jobId);
    need(existing,`job ${job.jobId} is not enqueued`,'STARCI_JOB_NOT_FOUND');
    need(existing.workflow_id===job.workflowId,'Reservation identity does not match the durable job');
    if(existing.kind!=='kernel'&&opSlots){
      const slots=workflowOpSlots(db,job.workflowId,{...opSlots,excludeJobId:job.jobId,holdingStatuses:OP_SLOT_HOLDING_STATUSES});
      if(!slots.ok)return {ok:false,reason:slots.reason,slots};
    }
    const resources=resourceAdmission(db,repoNeeds,{at,canonicalOf});
    if(!resources.ok)return resources;
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
