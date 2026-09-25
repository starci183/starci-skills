import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {LEDGER_SCHEMA,LEDGER_VERSION,MACHINE_SCHEMA,ensureWorkflow,inspectLedger,ledgerFileFor,ledgerIdOf,machineFileFor,openLedger,openMachine,releaseTwoPhase,reserveTwoPhase} from '../engine/ledger-db.mjs';

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
  assert.equal(ledger.schema,LEDGER_SCHEMA);assert.equal(LEDGER_VERSION,1);
  assert.equal(Number(ledger.db.prepare('PRAGMA user_version').get().user_version),1);
  assert.equal(ledger.autoVacuum,2);
  assert.equal(Number(ledger.db.prepare('PRAGMA foreign_keys').get().foreign_keys),1);
  assert.equal(Number(ledger.db.prepare('PRAGMA synchronous').get().synchronous),2,'synchronous=FULL');
  const names=ledger.db.prepare("SELECT name FROM sqlite_master WHERE type IN ('table','trigger','index')").all().map(row=>row.name);
  for(const table of ['meta','workflows','goals','state_snapshots','events','jobs','resources','leases','budgets','budget_reservations','incidents','reports','contracts','checks','inbox','signals','inputs'])
    assert.ok(names.includes(table),`missing table ${table}`);
  assert.ok(names.includes('leases_match_job')&&names.includes('leases_match_job_update'),'the drift trigger covers INSERT and UPDATE');
  for(const index of ['state_snapshots_lookup','events_entity','events_kind','jobs_queue','jobs_op','leases_expiry'])assert.ok(names.includes(index),`missing index ${index}`);
  assert.match(ledger.ledgerId,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,'ledger_id is a randomUUID');
  assert.equal(ledgerIdOf(ledger),ledger.ledgerId);
  assert.equal(ledger.db.prepare("SELECT value FROM meta WHERE key='schema'").get().value,LEDGER_SCHEMA);
  assert.equal(Number(ledger.db.prepare("SELECT value FROM meta WHERE key='created_at'").get().value)>0,true);
  assert.equal(ledger.db.prepare("SELECT value FROM meta WHERE key='journal_mode'").get().value,ledger.journalMode.toLowerCase());
  ledger.close();
});

test('the machine schema carries ledgers, ai resources, leases and budgets at version 1',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const machine=openMachine({file:path.join(dir,'machine.sqlite')});
  assert.equal(machine.schema,MACHINE_SCHEMA);
  assert.equal(Number(machine.db.prepare('PRAGMA user_version').get().user_version),1);
  const names=machine.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>row.name);
  for(const table of ['ledgers','resources','leases','budgets','budget_reservations'])assert.ok(names.includes(table),`missing table ${table}`);
  assert.equal(machine.journalMode,'WAL');
  assert.ok(machineFileFor({LOCALAPPDATA:dir}).startsWith(dir));
  assert.ok(ledgerFileFor(dir).endsWith(path.join('.starciwork','runtime.sqlite')));
  machine.close();
});

test('journal_mode defaults to WAL with a 15s busy timeout, an explicit DELETE is honored, and meta.journal_mode tracks the open',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'runtime.sqlite');
  const ledger=openLedger({file});
  assert.equal(ledger.journalMode,'WAL');
  assert.equal(Number(ledger.db.prepare('PRAGMA busy_timeout').get().timeout),15000);
  assert.equal(ledger.db.prepare("SELECT value FROM meta WHERE key='journal_mode'").get().value,'wal');
  ledger.close();
  const reopened=openLedger({file,journalMode:'DELETE'});
  assert.equal(reopened.journalMode,'DELETE');
  assert.equal(reopened.db.prepare("SELECT value FROM meta WHERE key='journal_mode'").get().value,'delete');
  assert.equal(reopened.ledgerId,ledger.ledgerId,'a mode change never touches the identity');
  reopened.close();
  assert.throws(()=>openLedger({file:path.join(dir,'x.sqlite'),journalMode:'weird'}),/Unsupported journal mode/);
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
  const first=openLedger({file});first.appendEvent({workflowId:'wf',entityType:'workflow',entityId:'wf',kind:'a'});first.close();
  const {DatabaseSync}=require('node:sqlite'),writer=new DatabaseSync(file,{timeout:0});
  writer.exec('BEGIN IMMEDIATE');
  try{
    const started=Date.now();
    const reader=openLedger({file,busyTimeoutMs:250});
    assert.ok(Date.now()-started<250,'the open never waited on the held write lock');
    assert.equal(reader.events({workflowId:'wf'}).length,1);
    reader.close();
  }finally{writer.exec('ROLLBACK');writer.close();}
});

test('a failed create rolls back and closes: no write lock outlives the throw',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'runtime.sqlite');
  const {DatabaseSync}=require('node:sqlite'),seed=new DatabaseSync(file);
  seed.exec('CREATE TABLE jobs(x)');seed.close();   // user_version 0, and the create's own CREATE TABLE jobs collides
  assert.throws(()=>openLedger({file}),/already exists/);
  const other=new DatabaseSync(file,{timeout:0});
  other.exec('BEGIN IMMEDIATE');other.exec('ROLLBACK');other.close();
  const check=new DatabaseSync(file,{readOnly:true});
  assert.equal(check.prepare('PRAGMA user_version').get().user_version,0,'the partial create rolled back');check.close();
});

test('a nested transaction is refused by name and the outer transaction still rolls back',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite')});
  assert.throws(()=>ledger.transaction(()=>{ledger.appendEvent({workflowId:'wf',entityType:'workflow',entityId:'wf',kind:'a'});ledger.transaction(()=>{});}),/ledger-nested-transaction/);
  assert.equal(ledger.db.prepare('SELECT count(*) n FROM events').get().n,0,'the outer transaction rolled back');
  const machine=openMachine({file:path.join(dir,'machine.sqlite')});
  assert.throws(()=>machine.transaction(()=>machine.transaction(()=>{})),/machine-nested-transaction/);
  machine.close();ledger.close();
});

test('leases_match_job refuses a lease whose token, generation, attempt, op or workflow differ from its job',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite')});
  ledger.enqueueJob({jobId:'j1',workflowId:'wf',opId:'op',attempt:1,generation:2,kind:'model'});
  const insert=(patch={})=>{const row={resource_key:`r${Math.random()}`,job_id:'j1',workflow_id:'wf',op_id:'op',attempt:1,generation:2,token:'tok',...patch};return ledger.db.prepare('INSERT INTO leases(resource_key,job_id,workflow_id,op_id,attempt,generation,token,units,acquired_at,expires_at) VALUES(?,?,?,?,?,?,?,1,1,?)').run(row.resource_key,row.job_id,row.workflow_id,row.op_id,row.attempt,row.generation,row.token,Number.MAX_SAFE_INTEGER);};
  ledger.db.prepare("UPDATE jobs SET status='leased',lease_token='tok' WHERE job_id='j1'").run();
  assert.equal(insert().changes,1,'a lease matching its job identity is admitted');
  for(const patch of [{token:'other'},{generation:1},{attempt:2},{op_id:'other'},{workflow_id:'other'}])
    assert.throws(()=>insert(patch),/lease-identity-drift/,JSON.stringify(patch));
  assert.throws(()=>ledger.db.prepare('UPDATE leases SET token=? WHERE job_id=?').run('other','j1'),/lease-identity-drift/,'UPDATE is guarded too');
  assert.equal(ledger.db.prepare('UPDATE leases SET expires_at=? WHERE job_id=?').run(1,'j1').changes,1,'non-identity updates pass');
  ledger.close();
});

test('appendEvent links each row to the previous digest through the table trigger, and a duplicate event_id throws',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite')});
  for(const kind of ['a','b','c'])ledger.appendEvent({workflowId:'wf',entityType:'workflow',entityId:'wf',generation:1,kind,payload:{kind}});
  const rows=ledger.events({workflowId:'wf'});
  assert.equal(rows.length,3);assert.equal(rows[0].prev_digest,null);
  assert.equal(rows[1].prev_digest,rows[0].digest);assert.equal(rows[2].prev_digest,rows[1].digest);
  assert.ok(chainHolds(rows),'each digest is sha256(prev||event_id||kind||payload||created_at)');
  assert.equal(ledger.eventsHead('wf'),rows[2].digest);
  assert.equal(ledger.events({workflowId:'wf',since:rows[0].seq}).length,2,'events reads past a seq');
  const again=rows[1].event_id;
  assert.throws(()=>ledger.appendEvent({eventId:again,workflowId:'wf',entityType:'workflow',entityId:'wf',kind:'dup'}),/UNIQUE constraint failed: events.event_id/,'a duplicate is refused, never reported as written');
  assert.equal(ledger.events({workflowId:'wf'}).length,3);
  const inspect=inspectLedger({file:ledger.file});
  assert.throws(()=>inspect.db.exec('DELETE FROM events'),/readonly|attempt to write/i,'inspection cannot write');
  inspect.close();ledger.close();
});

test('two-phase reservation registers the ledger, leases the job with its repo leases, and release clears them',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const machine=openMachine({file:path.join(dir,'machine.sqlite')});
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite'),machine});
  assert.equal(machine.db.prepare('SELECT count(*) n FROM ledgers WHERE ledger_id=?').get(ledger.ledgerId).n,1,'opening with a machine registers the ledger');
  assert.equal(ledger.ledgerId,ledgerIdOf(ledger),'ledger_id comes from meta, not the path');
  ledger.db.prepare('INSERT INTO resources(resource_key,capacity) VALUES(?,?)').run('lane:x',1);
  const reserved=reserveTwoPhase(ledger,machine,{job:{jobId:'j1',workflowId:'wf',opId:'op',generation:1,kind:'model'},leases:[{resourceKey:'lane:x',units:1}]});
  assert.equal(reserved.ok,true);assert.deepEqual(reserved.fencing,{'lane:x':1});
  assert.equal(ledger.getJob('j1').status,'leased');
  assert.equal(ledger.db.prepare("SELECT machine_ref FROM leases WHERE resource_key='lane:x'").get().machine_ref,null);
  const released=releaseTwoPhase(ledger,machine,{jobId:'j1',status:'succeeded'});
  assert.deepEqual(released,{ok:true,released:[]});
  assert.equal(ledger.db.prepare('SELECT count(*) n FROM leases').get().n,0);
  assert.equal(ledger.getJob('j1').status,'succeeded');
  machine.close();ledger.close();
});

test('a refused two-phase reservation writes no ledger rows',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const machine=openMachine({file:path.join(dir,'machine.sqlite')});
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite'),machine});
  const repo=reserveTwoPhase(ledger,machine,{job:{jobId:'j2',workflowId:'wf',generation:1,kind:'model'},leases:[{resourceKey:'lane:undeclared',units:1}]});
  assert.equal(repo.ok,false);assert.match(repo.reason,/no declared capacity/);
  assert.equal(ledger.db.prepare('SELECT count(*) n FROM jobs').get().n,0,'a repo-capacity refusal writes nothing');
  assert.equal(ledger.db.prepare('SELECT count(*) n FROM workflows').get().n,0,'the workflow row rolled back');
  machine.close();ledger.close();
});

test('inspectLedger refuses a missing file, and reflects the identity and version a writer left behind',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  assert.throws(()=>inspectLedger({file:path.join(dir,'missing.sqlite')}),/existing file/);
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite')});const id=ledger.ledgerId;ledger.close();
  const inspect=inspectLedger({file:path.join(dir,'runtime.sqlite')});
  assert.equal(inspect.version,1);assert.equal(inspect.readOnly,true);assert.deepEqual(inspect.listJobs(),[]);
  assert.equal(inspect.ledgerId,id);assert.equal(inspect.ledgerId,ledgerIdOf(inspect));
  inspect.close();
});

test('openLedger upgrades a schema file that predates meta, preserving every row and retrofitting the digest trigger',t=>{
  const {dir,file,firstDigest}=preMetaLedgerFile();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const {DatabaseSync}=require('node:sqlite'),precheck=new DatabaseSync(file,{readOnly:true});
  assert.equal(precheck.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='meta'").get(),undefined,'confirms the fixture predates meta');
  precheck.close();
  const ledger=openLedger({file});
  assert.match(ledger.ledgerId,/^[0-9a-f-]{36}$/i,'a fresh identity was minted for the file that never had one');
  assert.equal(ledger.db.prepare("SELECT value FROM meta WHERE key='schema'").get().value,LEDGER_SCHEMA);
  assert.equal(ledger.db.prepare("SELECT value FROM meta WHERE key='journal_mode'").get().value,ledger.journalMode.toLowerCase());
  assert.deepEqual({...ledger.db.prepare('SELECT workflow_id,title FROM workflows').get()},{workflow_id:'wf',title:'pre-addendum'},'the pre-existing workflow row is untouched');
  assert.deepEqual({...ledger.db.prepare('SELECT event_id,digest FROM events').get()},{event_id:'e1',digest:firstDigest},'the pre-existing event row is untouched');
  assert.ok(ledger.db.prepare("SELECT 1 FROM sqlite_master WHERE type='trigger' AND name='events_digest_chain'").get(),'the digest-chain trigger was retrofitted onto the old file');
  // reopening a second time (version already 1, meta already present) is a no-op, not a re-seed
  const ledgerId=ledger.ledgerId;ledger.close();
  const reopened=openLedger({file});
  assert.equal(reopened.ledgerId,ledgerId,'meta is seeded once; a second open never mints a new identity');
  reopened.close();
});

test('the events table computes its own hash chain even when an insert omits prev_digest and digest entirely',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite')});
  ensureWorkflow(ledger.db,{workflowId:'wf',at:1});
  // the exact shape of kernel/jobs.mjs's own INSERT: no prev_digest, no digest column at all
  ledger.db.prepare('INSERT INTO events(event_id,workflow_id,entity_type,entity_id,generation,kind,payload_json,created_at) VALUES(?,?,?,?,?,?,?,?)')
    .run('e1','wf','job','j1',1,'job-succeeded',JSON.stringify({opId:'op',attempt:1,result:null}),1000);
  ledger.db.prepare('INSERT INTO events(event_id,workflow_id,entity_type,entity_id,generation,kind,payload_json,created_at) VALUES(?,?,?,?,?,?,?,?)')
    .run('e2','wf','job','j1',1,'job-failed',null,2000);
  const rows=ledger.events({workflowId:'wf'});
  assert.equal(rows.length,2);
  assert.notEqual(rows[0].digest,'');assert.equal(rows[0].prev_digest,null);
  assert.notEqual(rows[1].digest,'');assert.equal(rows[1].prev_digest,rows[0].digest);
  assert.ok(chainHolds(rows),'the chain the trigger computed holds like any other');
  ledger.close();
});

test('inspectLedger exposes the same job and event read surface as openLedger',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite')});
  ledger.enqueueJob({jobId:'j1',workflowId:'wf',kind:'model',generation:1});
  ledger.appendEvent({workflowId:'wf',entityType:'workflow',entityId:'wf',generation:1,kind:'started'});
  ledger.close();
  const inspect=inspectLedger({file:path.join(dir,'runtime.sqlite')});
  assert.equal(typeof inspect.listJobs,'function');assert.equal(typeof inspect.getJob,'function');assert.equal(typeof inspect.events,'function');
  assert.deepEqual(inspect.listJobs().map(item=>item.job_id),['j1']);
  assert.equal(inspect.getJob('j1').job_id,'j1');assert.equal(inspect.getJob('missing'),null);
  assert.equal(inspect.events({workflowId:'wf'}).length,1);
  inspect.close();
});
