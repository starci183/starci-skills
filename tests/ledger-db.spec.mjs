import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {LEDGER_SCHEMA,LEDGER_VERSION,ensureWorkflow,inspectLedger,ledgerFileFor,ledgerIdOf,openLedger,releaseTwoPhase,reserveTwoPhase} from '../engine/ledger-db.mjs';
import {MACHINE_SCHEMA,machineFileFor,openMachine} from '../engine/machine-db.mjs';
import {seedWorkflow} from './_ledger-fixture.mjs';

/**
 * The ledger DB contract (docs/ledger-db.md): schema, meta identity, WAL-by-default with a recorded DELETE
 * fallback, an open of an established ledger that writes nothing, the leases_match_job invariant, the event
 * hash chain, nested-transaction refusal, and two-phase reservation with ledger registration.
 */
const require=createRequire(import.meta.url);
const sha256=text=>crypto.createHash('sha256').update(text).digest('hex');
/** Every row's digest recomputes from its predecessor: sha256(prev_digest||event_id||kind||payload_json||created_at). */
const chainHolds=rows=>rows.every((row,i)=>(row.prev_digest??null)===(i?rows[i-1].digest:null)&&row.digest===sha256(`${row.prev_digest??''}${row.event_id}${row.kind}${row.payload_json??''}${row.created_at}`));
const temporary=()=>fs.mkdtempSync(path.join(os.tmpdir(),'starci-ledger-db-'));
/**
 * A v1 ledger exactly as it looked before the identity/anchor addendum: every §4 table except `meta`, and
 * `events.digest` with no default and no chain trigger — the shape a ledger built by an earlier agent
 * build (or any file that reached user_version=1 before this module carried `meta`) is stuck in.
 */
function preMetaLedgerFile(){
  const dir=temporary(),file=path.join(dir,'runtime.sqlite');
  const {DatabaseSync}=require('node:sqlite');
  const db=new DatabaseSync(file);
  db.exec(`
    CREATE TABLE workflows(workflow_id TEXT PRIMARY KEY, title TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      ledger_mode TEXT, source_roots_json TEXT, generation INTEGER NOT NULL DEFAULT 0,
      goal_identity TEXT, phase TEXT, finished_json TEXT, pin_digest TEXT, archived_at INTEGER);
    CREATE TABLE goals(goal_seq INTEGER PRIMARY KEY AUTOINCREMENT, workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id),
      revision INTEGER NOT NULL, goal_identity TEXT NOT NULL, markdown TEXT NOT NULL, json TEXT NOT NULL,
      amendment_json TEXT, created_at INTEGER NOT NULL, UNIQUE(workflow_id,revision));
    CREATE TABLE state_snapshots(snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT, checkpoint_id TEXT NOT NULL UNIQUE,
      workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id), generation INTEGER NOT NULL,
      goal_identity TEXT NOT NULL, state_json TEXT NOT NULL, events_head TEXT, created_at INTEGER NOT NULL);
    CREATE INDEX state_snapshots_lookup ON state_snapshots(workflow_id,generation,goal_identity,snapshot_id);
    CREATE TABLE events(seq INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT NOT NULL UNIQUE,
      workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id), generation INTEGER NOT NULL,
      entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, kind TEXT NOT NULL, payload_json TEXT,
      prev_digest TEXT, digest TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE INDEX events_entity ON events(workflow_id,entity_type,entity_id,seq);
    CREATE INDEX events_kind ON events(workflow_id,kind,seq);
    CREATE TABLE jobs(job_id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id), op_id TEXT,
      attempt INTEGER NOT NULL, generation INTEGER NOT NULL, kind TEXT NOT NULL, role TEXT, payload_json TEXT,
      status TEXT NOT NULL, priority_json TEXT, lease_token TEXT, worker_id TEXT, deadline INTEGER,
      result_json TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE INDEX jobs_queue ON jobs(status,kind,created_at,job_id);
    CREATE INDEX jobs_op ON jobs(workflow_id,op_id,attempt);
    CREATE TABLE resources(resource_key TEXT PRIMARY KEY, capacity INTEGER NOT NULL CHECK(capacity>=0));
    CREATE TABLE leases(resource_key TEXT NOT NULL, job_id TEXT NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
      workflow_id TEXT NOT NULL, op_id TEXT, attempt INTEGER NOT NULL, generation INTEGER NOT NULL,
      token TEXT NOT NULL, units INTEGER NOT NULL CHECK(units>0), acquired_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL, machine_ref TEXT, PRIMARY KEY(resource_key,job_id));
    CREATE INDEX leases_expiry ON leases(expires_at);
    CREATE TRIGGER leases_match_job BEFORE INSERT ON leases BEGIN
      SELECT RAISE(ABORT,'lease-identity-drift') WHERE NOT EXISTS(
        SELECT 1 FROM jobs j WHERE j.job_id=NEW.job_id AND j.workflow_id=NEW.workflow_id
          AND j.op_id IS NEW.op_id AND j.attempt=NEW.attempt AND j.generation=NEW.generation AND j.lease_token=NEW.token);
    END;
    CREATE TABLE budgets(scope_key TEXT PRIMARY KEY, limit_value INTEGER NOT NULL CHECK(limit_value>=0),
      used_value INTEGER NOT NULL DEFAULT 0 CHECK(used_value>=0), reserved_value INTEGER NOT NULL DEFAULT 0 CHECK(reserved_value>=0));
    CREATE TABLE budget_reservations(scope_key TEXT NOT NULL REFERENCES budgets(scope_key), job_id TEXT NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
      units INTEGER NOT NULL CHECK(units>0), PRIMARY KEY(scope_key,job_id));
    CREATE TABLE incidents(incident_id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL, op_id TEXT, attempts INTEGER NOT NULL DEFAULT 0,
      model_calls INTEGER NOT NULL DEFAULT 0, tokens INTEGER NOT NULL DEFAULT 0, elapsed_ms INTEGER NOT NULL DEFAULT 0,
      last_progress TEXT, status TEXT NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE reports(report_id INTEGER PRIMARY KEY AUTOINCREMENT, workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id),
      dispatch_id TEXT NOT NULL, op_id TEXT, attempt INTEGER, generation INTEGER, outcome TEXT NOT NULL,
      report_json TEXT NOT NULL, from_terminal TEXT, consumed_at INTEGER, created_at INTEGER NOT NULL, UNIQUE(workflow_id,dispatch_id));
    CREATE TABLE contracts(workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id), op_id TEXT NOT NULL, attempt INTEGER NOT NULL,
      dispatch_id TEXT, markdown TEXT NOT NULL, context_json TEXT, created_at INTEGER NOT NULL, PRIMARY KEY(workflow_id,op_id,attempt));
    CREATE TABLE checks(workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id), op_id TEXT NOT NULL, attempt INTEGER NOT NULL,
      checks_json TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(workflow_id,op_id,attempt));
    CREATE TABLE inbox(inbox_id INTEGER PRIMARY KEY AUTOINCREMENT, workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id),
      kind TEXT NOT NULL, key TEXT, payload_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
      disposition_json TEXT, created_at INTEGER NOT NULL, applied_at INTEGER);
    CREATE TABLE signals(scope TEXT NOT NULL, key TEXT NOT NULL, holder_pid INTEGER, token TEXT, value_json TEXT,
      at INTEGER NOT NULL, expires_at INTEGER, PRIMARY KEY(scope,key));
    CREATE TABLE runtime_loads(runtime TEXT PRIMARY KEY, loads_json TEXT NOT NULL, at INTEGER NOT NULL);
    CREATE TABLE inputs(workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id), key TEXT NOT NULL,
      goal_revision INTEGER NOT NULL, sha256 TEXT NOT NULL, size INTEGER NOT NULL, media_type TEXT,
      origin TEXT NOT NULL, bytes BLOB NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(workflow_id,key));
    CREATE TABLE migrations(source TEXT PRIMARY KEY, kind TEXT NOT NULL, rows_json TEXT NOT NULL, at INTEGER NOT NULL);
    PRAGMA user_version=1;
  `);
  const digest=text=>crypto.createHash('sha256').update(text).digest('hex');
  db.prepare('INSERT INTO workflows(workflow_id,title,created_at,updated_at,generation,goal_identity) VALUES(?,?,?,?,?,?)').run('wf','pre-addendum',1000,1000,1,'goal-1');
  const d1=digest('e1kdone{"x":1}1000');
  db.prepare('INSERT INTO events(event_id,workflow_id,generation,entity_type,entity_id,kind,payload_json,prev_digest,digest,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run('e1','wf',1,'workflow','wf','kdone','{"x":1}',null,d1,1000);
  db.close();
  return {dir,file,firstDigest:d1};
}

test('the ledger schema carries every contract table, the meta identity, the drift trigger, and version 1',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite')});
  assert.equal(ledger.schema,LEDGER_SCHEMA);assert.equal(LEDGER_VERSION,3);
  assert.equal(Number(ledger.db.prepare('PRAGMA user_version').get().user_version),3);
  assert.equal(ledger.db.prepare('PRAGMA auto_vacuum').get().auto_vacuum,2);
  assert.equal(Number(ledger.db.prepare('PRAGMA foreign_keys').get().foreign_keys),1);
  assert.equal(Number(ledger.db.prepare('PRAGMA synchronous').get().synchronous),1,'synchronous=NORMAL (LEDGER_PRAGMAS, owner ruling 2026-09-27: WAL commits without a per-commit fsync)');
  const names=ledger.db.prepare("SELECT name FROM sqlite_master WHERE type IN ('table','trigger','index')").all().map(row=>row.name);
  for(const table of ['meta','schema_migrations','workflows','lifecycle_changes','goals','work_units','op_attempts','events','jobs','resources','leases','incidents','reports','contracts','check_runs','inbox','signals','goal_inputs'])
    assert.ok(names.includes(table),`missing table ${table}`);
  assert.ok(names.includes('leases_match_job')&&names.includes('leases_match_job_update'),'the drift trigger covers INSERT and UPDATE');
  for(const index of ['ix_units_state','events_entity','events_kind','jobs_queue','jobs_op','leases_expiry'])assert.ok(names.includes(index),`missing index ${index}`);
  assert.match(ledger.ledgerId,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,'ledger_id is a randomUUID');
  assert.equal(ledgerIdOf(ledger),ledger.ledgerId);
  assert.equal(ledger.db.prepare("SELECT value FROM meta WHERE key='schema'").get().value,LEDGER_SCHEMA);
  assert.equal(Number(ledger.db.prepare("SELECT value FROM meta WHERE key='created_at'").get().value)>0,true);
  assert.equal(ledger.db.prepare("SELECT value FROM meta WHERE key='journal_mode'").get().value,ledger.journalMode.toLowerCase());
  ledger.close();
});

test('the machine schema carries ledgers, host leases and budgets at version 1',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const machine=openMachine({file:path.join(dir,'machine.sqlite')});
  assert.equal(machine.schema,MACHINE_SCHEMA);
  assert.equal(Number(machine.db.prepare('PRAGMA user_version').get().user_version),1);
  const names=machine.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>row.name);
  for(const table of ['ledgers','host_resources','host_leases','budgets','budget_reservations'])assert.ok(names.includes(table),`missing table ${table}`);
  assert.equal(machine.db.prepare('PRAGMA journal_mode').get().journal_mode,'wal');
  assert.ok(machineFileFor({LOCALAPPDATA:dir}).startsWith(dir));
  assert.ok(ledgerFileFor(dir).endsWith('runtime.sqlite'));
  assert.equal(ledgerFileFor(dir).includes('.starciwork'),false);
  machine.close();
});

test('journal_mode stays WAL with a 15s busy timeout and meta.journal_mode tracks the open',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'runtime.sqlite');
  const ledger=openLedger({file});
  assert.equal(ledger.journalMode,'WAL');
  assert.equal(Number(ledger.db.prepare('PRAGMA busy_timeout').get().timeout),15000);
  assert.equal(ledger.db.prepare("SELECT value FROM meta WHERE key='journal_mode'").get().value,'wal');
  ledger.close();
  const reopened=openLedger({file});
  assert.equal(reopened.journalMode,'WAL');
  assert.equal(reopened.db.prepare("SELECT value FROM meta WHERE key='journal_mode'").get().value,'wal');
  assert.equal(reopened.ledgerId,ledger.ledgerId,'reopening never touches the identity');
  reopened.close();
  const machine=openMachine({file:path.join(dir,'machine.sqlite')});
  assert.equal(Number(machine.db.prepare('PRAGMA busy_timeout').get().timeout),15000);
  machine.close();
});

test('ledger_id is minted once from meta, survives a move, and a rebuilt file at the old path does not inherit it',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const original=path.join(dir,'runtime.sqlite');
  const ledger=openLedger({file:original});
  const id=ledger.ledgerId;
  ledger.close();
  const moved=path.join(dir,'moved','runtime.sqlite');
  fs.mkdirSync(path.dirname(moved),{recursive:true});
  fs.renameSync(original,moved);
  const reopened=openLedger({file:moved});
  assert.equal(reopened.ledgerId,id,'the identity moved with the bytes, not the path');
  reopened.close();
  const fresh=openLedger({file:original});
  assert.notEqual(fresh.ledgerId,id,'a rebuilt file at the old path mints its own identity');
  fresh.close();
});

test('opening an established ledger takes no write lock: it opens and reads while another connection holds one',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'runtime.sqlite');
  const first=openLedger({file});first.ensureWorkflow({workflowId:'wf'});first.appendEvent({workflowId:'wf',entityType:'workflow',entityId:'wf',kind:'a'});first.close();
  const {DatabaseSync}=require('node:sqlite'),writer=new DatabaseSync(file,{timeout:0});
  writer.exec('BEGIN IMMEDIATE');
  try{
    const started=Date.now();
    const reader=openLedger({file,busyTimeoutMs:250});
    assert.ok(Date.now()-started<250,'the open never waited on the held write lock');
    assert.equal(reader.events({workflowId:'wf'}).length,2);
    reader.close();
  }finally{writer.exec('ROLLBACK');writer.close();}
});

test('a failed create rolls back and closes: no write lock outlives the throw',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'runtime.sqlite');
  const {DatabaseSync}=require('node:sqlite'),seed=new DatabaseSync(file);
  seed.exec('CREATE TABLE jobs(x)');seed.close();   // user_version 0, and the create's own CREATE TABLE jobs collides
  assert.throws(()=>openLedger({file}),/ledger-schema-refused/);
  const other=new DatabaseSync(file,{timeout:0});
  other.exec('BEGIN IMMEDIATE');other.exec('ROLLBACK');other.close();
  const check=new DatabaseSync(file,{readOnly:true});
  assert.equal(check.prepare('PRAGMA user_version').get().user_version,0,'the partial create rolled back');check.close();
});

test('a nested transaction is refused by name and the outer transaction still rolls back',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite')});
  ledger.ensureWorkflow({workflowId:'wf'});
  assert.throws(()=>ledger.transaction(()=>{ledger.appendEvent({workflowId:'wf',entityType:'workflow',entityId:'wf',kind:'a'});ledger.transaction(()=>{});}),/ledger-nested-transaction/);
  assert.equal(ledger.db.prepare("SELECT count(*) n FROM events WHERE kind='a'").get().n,0,'the outer transaction rolled back');
  ledger.close();
});

test('leases_match_job refuses a lease whose token, generation, attempt, op or workflow differ from its job',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite')});
  ledger.ensureWorkflow({workflowId:'wf'});
  ledger.write.createUnit({workflowId:'wf',unitId:'j1',opId:'op',subjectKey:'j1',goalRevision:1});
  ledger.enqueueJob({jobId:'j1',workflowId:'wf',unitId:'j1',opId:'op',tryNo:1,generation:2,kind:'op'});
  const insert=(patch={})=>{const row={resource_key:`r${Math.random()}`,job_id:'j1',workflow_id:'wf',op_id:'op',try_no:1,generation:2,token:'tok',...patch};return ledger.db.prepare('INSERT INTO leases(resource_key,job_id,workflow_id,op_id,try_no,generation,token,units,acquired_at,expires_at) VALUES(?,?,?,?,?,?,?,1,1,?)').run(row.resource_key,row.job_id,row.workflow_id,row.op_id,row.try_no,row.generation,row.token,Number.MAX_SAFE_INTEGER);};
  ledger.db.prepare("UPDATE jobs SET status='ready' WHERE job_id='j1'").run();
  ledger.db.prepare("UPDATE jobs SET status='leased',lease_token='tok' WHERE job_id='j1'").run();
  assert.equal(insert().changes,1,'a lease matching its job identity is admitted');
  for(const patch of [{token:'other'},{generation:1},{try_no:2},{op_id:'other'},{workflow_id:'other'}])
    assert.throws(()=>insert(patch),/lease-identity-drift/,JSON.stringify(patch));
  assert.throws(()=>ledger.db.prepare('UPDATE leases SET token=? WHERE job_id=?').run('other','j1'),/lease-identity-drift/,'UPDATE is guarded too');
  assert.equal(ledger.db.prepare('UPDATE leases SET expires_at=? WHERE job_id=?').run(2,'j1').changes,1,'non-identity updates pass');
  ledger.close();
});

test('appendEvent links each row to the previous digest through the writer, and a duplicate event_id throws',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite')});
  ledger.ensureWorkflow({workflowId:'wf'});
  for(const kind of ['a','b','c'])ledger.appendEvent({workflowId:'wf',entityType:'workflow',entityId:'wf',generation:1,kind,payload:{kind}});
  const rows=ledger.events({workflowId:'wf'});
  assert.equal(rows.length,4);assert.equal(rows[1].prev_digest,rows[0].digest);
  assert.equal(rows[2].prev_digest,rows[1].digest);assert.equal(rows[3].prev_digest,rows[2].digest);
  assert.ok(chainHolds(rows),'each digest is sha256(prev||event_id||kind||payload||created_at)');
  assert.equal(ledger.eventsHead('wf'),rows[3].digest);
  assert.equal(ledger.events({workflowId:'wf',since:rows[0].seq}).length,3,'events reads past a seq');
  const again=rows[1].event_id;
  assert.throws(()=>ledger.appendEvent({eventId:again,workflowId:'wf',entityType:'workflow',entityId:'wf',kind:'dup'}),/UNIQUE constraint failed: events.event_id/,'a duplicate is refused, never reported as written');
  assert.equal(ledger.events({workflowId:'wf'}).length,4);
  const inspect=inspectLedger({file:ledger.file});
  assert.throws(()=>inspect.db.exec('DELETE FROM events'),/readonly|attempt to write/i,'inspection cannot write');
  inspect.close();ledger.close();
});

test('two-phase reservation registers the ledger, leases the job with its repo leases, and release clears them',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const machine=openMachine({file:path.join(dir,'machine.sqlite')});
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite'),repoRoot:path.join(dir,'repo'),machine});
  assert.equal(machine.db.prepare('SELECT count(*) n FROM ledgers WHERE ledger_id=?').get(ledger.ledgerId).n,1,'opening with a machine registers the ledger');
  assert.equal(ledger.ledgerId,ledgerIdOf(ledger),'ledger_id comes from meta, not the path');
  ledger.ensureWorkflow({workflowId:'wf'});
  ledger.write.createUnit({workflowId:'wf',unitId:'j1',opId:'op',subjectKey:'j1',goalRevision:1});
  ledger.enqueueJob({jobId:'j1',workflowId:'wf',unitId:'j1',opId:'op',generation:1});
  ledger.db.prepare('INSERT INTO resources(resource_key,capacity) VALUES(?,?)').run('lane:x',1);
  const reserved=reserveTwoPhase(ledger,machine,{job:{jobId:'j1',workflowId:'wf'},leases:[{resourceKey:'lane:x',units:1}]});
  assert.equal(reserved.ok,true);assert.deepEqual(reserved.fencing,{'lane:x':1});
  assert.equal(ledger.getJob('j1').status,'leased');
  assert.equal(ledger.db.prepare("SELECT try_no FROM leases WHERE resource_key='lane:x'").get().try_no,1);
  const released=releaseTwoPhase(ledger,machine,{jobId:'j1',status:'cancelled'});
  assert.deepEqual(released,{ok:true,released:1});
  assert.equal(ledger.db.prepare('SELECT count(*) n FROM leases').get().n,0);
  assert.equal(ledger.getJob('j1').status,'cancelled');
  machine.close();ledger.close();
});

test('a refused two-phase reservation writes no ledger rows',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const machine=openMachine({file:path.join(dir,'machine.sqlite')});
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite'),machine});
  ledger.ensureWorkflow({workflowId:'wf'});
  ledger.write.createUnit({workflowId:'wf',unitId:'j2',opId:'op',subjectKey:'j2',goalRevision:1});
  ledger.enqueueJob({jobId:'j2',workflowId:'wf',unitId:'j2',opId:'op',generation:1});
  ledger.db.prepare('INSERT INTO resources(resource_key,capacity) VALUES(?,0)').run('lane:full');
  const before=ledger.db.prepare('SELECT count(*) n FROM events').get().n;
  const repo=reserveTwoPhase(ledger,machine,{job:{jobId:'j2',workflowId:'wf'},leases:[{resourceKey:'lane:full',units:1}]});
  assert.equal(repo.ok,false);assert.match(repo.reason,/capacity 0/);
  assert.equal(ledger.db.prepare("SELECT status FROM jobs WHERE job_id='j2'").get().status,'queued','a capacity refusal does not lease the job');
  assert.equal(ledger.db.prepare('SELECT count(*) n FROM events').get().n,before,'a capacity refusal appends no event');
  machine.close();ledger.close();
});

test('inspectLedger refuses a missing file, and reflects the identity and version a writer left behind',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  assert.throws(()=>inspectLedger({file:path.join(dir,'missing.sqlite')}),/existing file/);
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite')});const id=ledger.ledgerId;ledger.close();
  const inspect=inspectLedger({file:path.join(dir,'runtime.sqlite')});
  assert.equal(inspect.version,3);assert.equal(inspect.readOnly,true);assert.deepEqual(inspect.listJobs(),[]);
  assert.equal(inspect.ledgerId,id);assert.equal(inspect.ledgerId,ledgerIdOf(inspect));
  inspect.close();
});

test('openLedger refuses a pre-meta schema without changing its rows',t=>{
  const {dir,file,firstDigest}=preMetaLedgerFile();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const {DatabaseSync}=require('node:sqlite'),precheck=new DatabaseSync(file,{readOnly:true});
  assert.equal(precheck.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='meta'").get(),undefined,'confirms the fixture predates meta');
  precheck.close();
  assert.throws(()=>openLedger({file}),e=>e.code==='STARCI_LEDGER_SCHEMA_REFUSED');
  const after=new DatabaseSync(file,{readOnly:true});
  assert.deepEqual({...after.prepare('SELECT workflow_id,title FROM workflows').get()},{workflow_id:'wf',title:'pre-addendum'});
  assert.deepEqual({...after.prepare('SELECT event_id,digest FROM events').get()},{event_id:'e1',digest:firstDigest});
  assert.equal(after.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='meta'").get(),undefined);
  after.close();
});

test('raw event inserts without a digest are refused; the writer computes a valid hash chain',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite')});
  ensureWorkflow(ledger.db,{workflowId:'wf',at:1});
  assert.throws(()=>ledger.db.prepare('INSERT INTO events(event_id,workflow_id,entity_type,entity_id,generation,kind,payload_json,occurred_at,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
    .run('e1','wf','job','j1',1,'job-succeeded','{}',1000,1000),/events.digest/);
  ledger.appendEvent({eventId:'e1',workflowId:'wf',entityType:'job',entityId:'j1',generation:1,kind:'job-succeeded',payload:{opId:'op'},createdAt:1000});
  ledger.appendEvent({eventId:'e2',workflowId:'wf',entityType:'job',entityId:'j1',generation:1,kind:'job-failed',createdAt:2000});
  const rows=ledger.events({workflowId:'wf'});
  assert.equal(rows.length,3);
  assert.ok(chainHolds(rows),'the typed writer links every event');
  ledger.close();
});

test('inspectLedger exposes the same job and event read surface as openLedger',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite')});
  ledger.ensureWorkflow({workflowId:'wf'});
  ledger.enqueueJob({jobId:'j1',workflowId:'wf',kind:'kernel',generation:1});
  ledger.appendEvent({workflowId:'wf',entityType:'workflow',entityId:'wf',generation:1,kind:'started'});
  ledger.close();
  const inspect=inspectLedger({file:path.join(dir,'runtime.sqlite')});
  assert.equal(typeof inspect.listJobs,'function');assert.equal(typeof inspect.getJob,'function');assert.equal(typeof inspect.events,'function');
  assert.deepEqual(inspect.listJobs().map(item=>item.job_id),['j1']);
  assert.equal(inspect.getJob('j1').job_id,'j1');assert.equal(inspect.getJob('missing'),null);
  assert.equal(inspect.events({workflowId:'wf'}).length,3);
  inspect.close();
});

/**
 * jobs.status `awaiting_owner`: a try that ended asking the owner settles there (never `failed`). A fresh ledger carries it
 * in 0001-init.sql; a ledger created before it is upgraded in place on the writer's first open (writable_schema CHECK
 * relax + trigger recreate + job_transitions/ui_state_map rows + schema_migrations version 2), and stays valid.
 */
test('a ledger created before awaiting_owner is upgraded in place on the writer open',t=>{
  const dir=temporary(),file=path.join(dir,'runtime.sqlite');
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const seeded=openLedger({file});
  // An ask an older runtime settled `failed` (verdict awaiting-owner) and a real failure beside it.
  seedWorkflow(seeded,{id:'wf-old',jobs:[
    {jobId:'job-ask',opId:'brand.decide',status:'failed',result:{verdict:'awaiting-owner',askDispatchId:'ctx_old'}},
    {jobId:'job-red',opId:'code.write',status:'failed',result:{verdict:'fail'}}]});
  seeded.close();
  const {DatabaseSync}=require('node:sqlite');
  // Rewind it to the pre-awaiting_owner schema exactly as an older runtime wrote it.
  let raw=new DatabaseSync(file);
  raw.enableDefensive(false);
  const ddl=raw.prepare("SELECT sql FROM sqlite_master WHERE name='jobs'").get().sql;
  const cookie=raw.prepare('PRAGMA schema_version').get().schema_version;
  raw.exec('PRAGMA writable_schema=ON');
  raw.prepare("UPDATE sqlite_master SET sql=? WHERE type='table' AND name='jobs'").run(ddl.replace("'awaiting_owner',",''));
  raw.exec(`PRAGMA schema_version=${cookie+1}`);
  raw.exec('PRAGMA writable_schema=OFF');
  raw.exec("DELETE FROM job_transitions WHERE to_status='awaiting_owner'");
  raw.exec("DELETE FROM ui_state_map WHERE entity='job' AND native='awaiting_owner'");
  raw.exec('DELETE FROM schema_migrations WHERE version=2');
  raw.close();
  raw=new DatabaseSync(file);
  assert.ok(!raw.prepare("SELECT sql FROM sqlite_master WHERE name='jobs'").get().sql.includes('awaiting_owner'),'the rewound ledger refuses the status');
  raw.close();

  const ledger=openLedger({file});
  try{
    const db=ledger.db;
    assert.ok(db.prepare("SELECT sql FROM sqlite_master WHERE name='jobs'").get().sql.includes("'awaiting_owner'"));
    assert.deepEqual(db.prepare('SELECT version,name FROM schema_migrations ORDER BY version').all().map(r=>[r.version,r.name]),[[1,'0001-init'],[2,'0002-awaiting-owner']]);
    assert.equal(db.prepare("SELECT count(*) n FROM job_transitions WHERE to_status='awaiting_owner'").get().n,2);
    assert.equal(db.prepare("SELECT ui FROM ui_state_map WHERE entity='job' AND native='awaiting_owner'").get().ui,'waiting');
    assert.deepEqual(db.prepare("SELECT job_id,status FROM jobs ORDER BY job_id").all().map(r=>[r.job_id,r.status]),[['job-ask','awaiting_owner'],['job-red','failed']],'only the ask moves to the new status');
    assert.deepEqual(db.prepare("SELECT unit_id,state FROM work_units ORDER BY unit_id").all().map(r=>[r.unit_id,r.state]),[['job-ask','deciding'],['job-red','failed']]);
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
    assert.deepEqual(db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'jobs_%' ORDER BY name").all().map(r=>r.name),['jobs_enqueue_guard','jobs_release_leases','jobs_status_guard']);
  }finally{ledger.close();}
  // A second open changes nothing (idempotent); a fresh ledger already carries the status and is not migrated.
  const again=openLedger({file});
  try{assert.equal(again.db.prepare('SELECT count(*) n FROM schema_migrations').get().n,2);}finally{again.close();}
  const fresh=openLedger({file:path.join(dir,'fresh.sqlite')});
  try{assert.deepEqual(fresh.db.prepare('SELECT version FROM schema_migrations').all().map(r=>r.version),[1]);}finally{fresh.close();}
});

test('awaiting_owner is a settled status reached only from reported|deciding; a retry follows it and it spends no try',t=>{
  const dir=temporary(),file=path.join(dir,'runtime.sqlite');
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const ledger=openLedger({file});
  try{
    const db=ledger.db,at=Date.now();
    ledger.ensureWorkflow({workflowId:'wf-ask',title:'ask'});
    ledger.write.changeWorkflowPhase({workflowId:'wf-ask',to:'running',by:'test',reason:'seed'});
    ledger.write.createUnit({workflowId:'wf-ask',unitId:'u1',opId:'brand.decide',subjectKey:'s',goalRevision:1});
    const enqueue=(jobId,tryNo,retryOf=null)=>ledger.enqueueJob({jobId,workflowId:'wf-ask',unitId:'u1',opId:'brand.decide',tryNo,retryOf,kind:'op',generation:1,status:'queued',payload:{opId:'brand.decide'}});
    const walk=(jobId,to)=>{for(const status of ['ready','leased','running','reported',to])ledger.write.setJobStatus({jobId,to:status,reason:'test',at});};
    enqueue('t1',1);
    ledger.write.setJobStatus({jobId:'t1',to:'ready',reason:'test',at});
    assert.throws(()=>ledger.write.setJobStatus({jobId:'t1',to:'awaiting_owner',reason:'test',at}),/job-transition-refused/,'a ready job cannot settle awaiting_owner');
    ledger.write.setJobStatus({jobId:'t1',to:'leased',reason:'test',at});ledger.write.setJobStatus({jobId:'t1',to:'running',reason:'test',at});ledger.write.setJobStatus({jobId:'t1',to:'reported',reason:'test',at});
    ledger.write.setJobStatus({jobId:'t1',to:'awaiting_owner',reason:'test',at});
    assert.equal(db.prepare("SELECT status FROM jobs WHERE job_id='t1'").get().status,'awaiting_owner');
    assert.throws(()=>ledger.write.setJobStatus({jobId:'t1',to:'failed',reason:'test',at}),/job-transition-refused/,'awaiting_owner is terminal like failed');
    // Its retry follows it (retry_of names an awaiting_owner job); four failed tries after the ask fit a budget of five.
    enqueue('t2',2,'t1');walk('t2','failed');
    enqueue('t3',3,'t2');walk('t3','failed');
    enqueue('t4',4,'t3');walk('t4','failed');
    enqueue('t5',5,'t4');walk('t5','failed');
    enqueue('t6',6,'t5');walk('t6','failed');
    assert.throws(()=>enqueue('t7',7,'t6'),/unit-try-budget-exhausted/,'five spent tries (the ask spent none) exhaust the budget');
  }finally{ledger.close();}
});

test('recordAttemptUsage writes llm_usage rows and the attempt summary once; recordKernelUsage never repeats a turn_ref',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite')});
  ledger.ensureWorkflow({workflowId:'wf'});
  ledger.write.changeWorkflowPhase({workflowId:'wf',to:'running',by:'test',reason:'seed'});
  ledger.write.createUnit({workflowId:'wf',unitId:'u1',opId:'op',subjectKey:'u1',goalRevision:1});
  ledger.enqueueJob({jobId:'j1',workflowId:'wf',unitId:'u1',opId:'op',tryNo:1,generation:1,kind:'op'});
  for(const to of ['ready','leased'])ledger.write.setJobStatus({jobId:'j1',to,reason:'test'});
  const {attempt_id:attemptId}=ledger.write.startAttempt({workflowId:'wf',jobId:'j1',dispatchId:'ctx_usage',provider:'claude'});
  const row={model:'claude-opus-5-5',inputTokens:10,outputTokens:20,cacheReadTokens:300,cacheWriteTokens:40,reasoningTokens:5,turns:3,toolCalls:2,toolErrors:0,costUsd:null};
  assert.deepEqual(ledger.write.recordAttemptUsage({attemptId,rows:[row],sessions:[{session:'s1',matchedBy:'dispatch-id+task-id',where:'live'}]}),{recorded:true,rows:1});
  assert.deepEqual(JSON.parse(ledger.db.prepare("SELECT payload_json FROM events WHERE kind='attempt-usage-recorded'").get().payload_json).sessions,[{session:'s1',matchedBy:'dispatch-id+task-id',where:'live'}],'the event names the exact session link');
  assert.deepEqual(ledger.write.recordAttemptUsage({attemptId,rows:[row]}),{recorded:false,rows:0},'a second recording adds nothing');
  const a=ledger.getAttempt(attemptId);
  assert.equal(a.tokens_in,350,'tokens_in = fresh + cache read + cache write');assert.equal(a.tokens_out,20);assert.equal(a.cost_usd,null,'a row without a costUsd leaves cost NULL');assert.equal(a.usage_source,'cli-transcript');
  assert.equal(ledger.db.prepare("SELECT count(*) n FROM llm_usage WHERE attempt_id=?").get(attemptId).n,1);
  assert.equal(ledger.db.prepare("SELECT count(*) n FROM events WHERE kind='attempt-usage-recorded'").get().n,1);
  const args={workflowId:'wf',turnRef:'kernel:wf:s1@4',rows:[row],provider:'claude'};
  assert.equal(ledger.write.recordKernelUsage(args).recorded,true);
  assert.equal(ledger.write.recordKernelUsage(args).recorded,false,'the same turn_ref is never counted twice');
  assert.equal(ledger.db.prepare("SELECT count(*) n FROM llm_usage WHERE subject_type='kernel-turn'").get().n,1);
  ledger.close();
});

test('an older (user_version 1) ledger is migrated forward on the first writer open: backup, wider usage_source CHECK, usage_reason, recorded migration',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'runtime.sqlite');
  const seed=openLedger({file});
  // Put the file back to what 0001-init alone produced.
  seed.db.enableDefensive(false);
  seed.db.exec("PRAGMA writable_schema=ON;UPDATE sqlite_master SET sql=replace(sql,',''unavailable'')',')') WHERE name='op_attempts';PRAGMA writable_schema=OFF");
  seed.db.exec('ALTER TABLE op_attempts DROP COLUMN usage_reason;DELETE FROM schema_migrations WHERE version=3;PRAGMA user_version=1');
  seed.close();
  const old=inspectLedger({file});assert.equal(old.version,1);assert.equal(old.db.prepare("SELECT sql FROM sqlite_master WHERE name='op_attempts'").get().sql.includes("'unavailable'"),false);old.close();
  const ledger=openLedger({file});
  assert.equal(Number(ledger.db.prepare('PRAGMA user_version').get().user_version),3);
  assert.equal(ledger.db.prepare('SELECT status FROM schema_migrations WHERE version=3').get().status,'done');
  assert.equal(fs.existsSync(`${file}.pre-0003-usage-unavailable.bak`),true,'a VACUUM INTO backup precedes the migration');
  assert.equal(ledger.db.prepare("SELECT sql FROM sqlite_master WHERE name='op_attempts'").get().sql.includes("'unavailable'"),true);
  assert.ok(ledger.db.prepare('PRAGMA table_info(op_attempts)').all().some(c=>c.name==='usage_reason'));
  ledger.close();
  assert.doesNotThrow(()=>openLedger({file}).close(),'a second open migrates nothing');
});

test('markAttemptUsageUnavailable stores usage_source unavailable with its reason, never over a measured attempt, and a later measurement replaces it',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite')});
  ledger.ensureWorkflow({workflowId:'wf'});
  ledger.write.changeWorkflowPhase({workflowId:'wf',to:'running',by:'test',reason:'seed'});
  ledger.write.createUnit({workflowId:'wf',unitId:'u1',opId:'op',subjectKey:'u1',goalRevision:1});
  ledger.enqueueJob({jobId:'j1',workflowId:'wf',unitId:'u1',opId:'op',tryNo:1,generation:1,kind:'op'});
  for(const to of ['ready','leased'])ledger.write.setJobStatus({jobId:'j1',to,reason:'test'});
  const {attempt_id:attemptId}=ledger.write.startAttempt({workflowId:'wf',jobId:'j1',dispatchId:'ctx_u',provider:'devin'});
  assert.deepEqual(ledger.write.markAttemptUsageUnavailable({attemptId,reason:'no usage adapter for devin'}),{marked:true});
  assert.deepEqual(ledger.write.markAttemptUsageUnavailable({attemptId,reason:'no usage adapter for devin'}),{marked:false},'the same reason adds no event');
  let a=ledger.getAttempt(attemptId);assert.equal(a.usage_source,'unavailable');assert.equal(a.usage_reason,'no usage adapter for devin');assert.equal(a.tokens_in,null);
  ledger.write.recordAttemptUsage({attemptId,rows:[{model:'m',inputTokens:1,outputTokens:2,cacheReadTokens:0,cacheWriteTokens:0,turns:1}]});
  a=ledger.getAttempt(attemptId);assert.equal(a.usage_source,'cli-transcript');assert.equal(a.usage_reason,null);
  assert.deepEqual(ledger.write.markAttemptUsageUnavailable({attemptId,reason:'late'}),{marked:false},'a measured attempt is never marked');
  ledger.close();
});
