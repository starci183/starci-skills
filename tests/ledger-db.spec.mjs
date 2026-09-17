import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {ANCHOR_SCHEMA,LEDGER_SCHEMA,LEDGER_VERSION,MACHINE_SCHEMA,checkpointLedger,compactSnapshots,ensureWorkflow,eventsHead,inspectLedger,ledgerFileFor,ledgerIdOf,ledgerWorkflows,liveRows,machineFileFor,openLedger,openMachine,pruneRetiredGenerations,readAnchor,releaseTwoPhase,reserveTwoPhase,retireWorkflow,verifyAnchor,verifyChain,writeAnchor} from '../kernel/ledger-db.mjs';

/**
 * The ledger DB contract (docs/ledger-db.md): schema, meta identity, WAL-by-default with a recorded DELETE
 * fallback, the leases_match_job invariant, the event hash chain, nested-transaction refusal, two-phase
 * reservation against the machine arbiter, sweep of orphaned machine rows (guarded by meta.ledger_id, not a
 * path), the retention semantics ported from journal.mjs, and the §12 tracked anchor.
 */
const require=createRequire(import.meta.url);
const temporary=()=>fs.mkdtempSync(path.join(os.tmpdir(),'starci-ledger-db-'));
/**
 * A v1 ledger exactly as it looked before the identity/anchor addendum: every §4 table except `meta`, and
 * `events.digest` with no default and no chain trigger — the shape a ledger built by an earlier 1.0.4 agent
 * (or any file that reached user_version=1 before this module carried `meta`) is stuck in.
 */
function legacyLedgerFile(){
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
const snapshot=(ledger,{workflowId='wf',generation,checkpoint,body='{"x":1}'})=>{ensureWorkflow(ledger.db,{workflowId,at:1});ledger.db.prepare('INSERT INTO state_snapshots(checkpoint_id,workflow_id,generation,goal_identity,state_json,created_at) VALUES(?,?,?,?,?,?)').run(checkpoint,workflowId,generation,'goal',body,1);};
const job=(ledger,{jobId,workflowId='wf',generation,status='succeeded',kind='model'})=>{ledger.enqueueJob({jobId,workflowId,opId:'op',attempt:1,generation,kind,payload:{}});ledger.db.prepare('UPDATE jobs SET status=? WHERE job_id=?').run(status,jobId);ledger.appendEvent({eventId:`${jobId}:event`,workflowId,entityType:'job',entityId:jobId,generation,kind:'job-succeeded'});};
const lease=(ledger,{jobId,workflowId='wf',generation=1,resource='lane:x',token='tok'})=>{ledger.db.prepare("UPDATE jobs SET status='leased',lease_token=?,deadline=? WHERE job_id=?").run(token,Number.MAX_SAFE_INTEGER,jobId);ledger.db.prepare('INSERT INTO leases(resource_key,job_id,workflow_id,op_id,attempt,generation,token,units,acquired_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(resource,jobId,workflowId,'op',1,generation,token,1,1,Number.MAX_SAFE_INTEGER);};

test('the ledger schema carries every contract table, the meta identity, the drift trigger, and version 1',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite')});
  assert.equal(ledger.schema,LEDGER_SCHEMA);assert.equal(LEDGER_VERSION,1);
  assert.equal(Number(ledger.db.prepare('PRAGMA user_version').get().user_version),1);
  assert.equal(ledger.autoVacuum,2);
  assert.equal(Number(ledger.db.prepare('PRAGMA foreign_keys').get().foreign_keys),1);
  assert.equal(Number(ledger.db.prepare('PRAGMA synchronous').get().synchronous),2,'synchronous=FULL');
  const names=ledger.db.prepare("SELECT name FROM sqlite_master WHERE type IN ('table','trigger','index')").all().map(row=>row.name);
  for(const table of ['meta','workflows','goals','state_snapshots','events','jobs','resources','leases','budgets','budget_reservations','incidents','reports','contracts','checks','inbox','signals','runtime_loads','inputs','migrations'])
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

test('checkpointLedger truncates the WAL, and is reachable from the handle and as a standalone export',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite')});
  for(let n=0;n<20;n+=1)ledger.appendEvent({workflowId:'wf',entityType:'workflow',entityId:'wf',kind:`k${n}`});
  const first=ledger.checkpoint();
  assert.equal(first.ok,true);assert.equal(first.busy,false);
  assert.deepEqual(checkpointLedger(ledger),{ok:true,busy:false,logFrames:0,checkpointedFrames:0},'nothing left to checkpoint right after a truncate');
  assert.throws(()=>checkpointLedger({}),/checkpointLedger needs a ledger handle/);
  ledger.close();
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

test('the event hash chain verifies, and rewriting a payload breaks at its seq',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite')});
  for(const kind of ['a','b','c'])ledger.appendEvent({workflowId:'wf',entityType:'workflow',entityId:'wf',generation:1,kind,payload:{kind}});
  const rows=ledger.events({workflowId:'wf'});
  assert.equal(rows.length,3);assert.equal(rows[0].prev_digest,null);
  assert.equal(rows[1].prev_digest,rows[0].digest);assert.equal(rows[2].prev_digest,rows[1].digest);
  assert.equal(ledger.eventsHead('wf'),rows[2].digest);
  assert.deepEqual(verifyChain(ledger.db,{workflowId:'wf'}),{ok:true,checked:3,brokenAt:null});
  assert.equal(ledger.events({workflowId:'wf',since:rows[0].seq}).length,2,'events reads past a seq');
  ledger.db.prepare('UPDATE events SET payload_json=? WHERE seq=?').run('{"kind":"tampered"}',rows[1].seq);
  assert.deepEqual(verifyChain(ledger.db,{workflowId:'wf'}),{ok:false,checked:1,brokenAt:rows[1].seq});
  const inspect=inspectLedger({file:ledger.file});
  assert.equal(inspect.verifyChain({workflowId:'wf'}).ok,false);
  assert.throws(()=>inspect.db.exec('DELETE FROM events'),/readonly|attempt to write/i,'inspection cannot write');
  inspect.close();ledger.close();
});

test('two-phase reservation mirrors machine tokens into the ledger and releases them on release',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const machine=openMachine({file:path.join(dir,'machine.sqlite')});
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite'),machine});
  assert.equal(machine.db.prepare('SELECT count(*) n FROM ledgers WHERE ledger_id=?').get(ledger.ledgerId).n,1,'opening with a machine registers the ledger');
  assert.equal(ledger.ledgerId,ledgerIdOf(ledger),'ledger_id comes from meta, not the path');
  machine.setCapacity('ai/global',2);
  ledger.db.prepare('INSERT INTO resources(resource_key,capacity) VALUES(?,?)').run('lane:x',1);
  const reserved=reserveTwoPhase(ledger,machine,{job:{jobId:'j1',workflowId:'wf',opId:'op',generation:1,kind:'model'},
    leases:[{resourceKey:'lane:x',units:1}],machineNeeds:[{resourceKey:'ai/global',units:1}]});
  assert.equal(reserved.ok,true);assert.equal(reserved.tokens.length,1);
  const mirrored=ledger.db.prepare("SELECT * FROM leases WHERE resource_key='ai/global'").get();
  assert.equal(mirrored.machine_ref,reserved.tokens[0],'the paired ledger lease carries the machine token');
  assert.equal(ledger.getJob('j1').status,'leased');
  assert.equal(machine.db.prepare('SELECT count(*) n FROM leases').get().n,1);
  const released=releaseTwoPhase(ledger,machine,{jobId:'j1',status:'succeeded'});
  assert.equal(released.ok,true);assert.deepEqual(released.released,reserved.tokens);
  assert.equal(ledger.db.prepare('SELECT count(*) n FROM leases').get().n,0);
  assert.equal(machine.db.prepare('SELECT count(*) n FROM leases').get().n,0);
  assert.equal(ledger.getJob('j1').status,'succeeded');
  machine.close();ledger.close();
});

test('a failed two-phase reservation leaves no ledger rows and no machine rows',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const machine=openMachine({file:path.join(dir,'machine.sqlite')});
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite'),machine});
  machine.setCapacity('ai/global',1);machine.setCapacity('ai/tight',0);
  const result=reserveTwoPhase(ledger,machine,{job:{jobId:'j1',workflowId:'wf',generation:1,kind:'model'},
    machineNeeds:[{resourceKey:'ai/global',units:1},{resourceKey:'ai/tight',units:1}]});
  assert.equal(result.ok,false);assert.match(result.reason,/ai\/tight/);
  assert.equal(ledger.db.prepare('SELECT count(*) n FROM leases').get().n,0,'ledger leases rolled back');
  assert.equal(ledger.db.prepare('SELECT count(*) n FROM jobs').get().n,0,'the leased job rolled back');
  assert.equal(ledger.db.prepare('SELECT count(*) n FROM workflows').get().n,0,'the workflow row rolled back');
  assert.equal(machine.db.prepare('SELECT count(*) n FROM leases').get().n,0,'the taken machine token was released');
  const repo=reserveTwoPhase(ledger,machine,{job:{jobId:'j2',workflowId:'wf',generation:1,kind:'model'},leases:[{resourceKey:'lane:undeclared',units:1}]});
  assert.equal(repo.ok,false);assert.match(repo.reason,/no declared capacity/);
  assert.equal(ledger.db.prepare('SELECT count(*) n FROM jobs').get().n,0,'a repo-capacity refusal writes nothing');
  machine.close();ledger.close();
});

test('sweep removes expired machine rows and rows whose ledger no longer holds the paired lease',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const machine=openMachine({file:path.join(dir,'machine.sqlite')});
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite'),machine});
  machine.setCapacity('ai/global',10);
  const held=reserveTwoPhase(ledger,machine,{job:{jobId:'j1',workflowId:'wf',generation:1,kind:'model'},machineNeeds:[{resourceKey:'ai/global',units:1}]});
  const stale=reserveTwoPhase(ledger,machine,{job:{jobId:'j2',workflowId:'wf',generation:1,kind:'model'},machineNeeds:[{resourceKey:'ai/global',units:1}]});
  assert.ok(held.ok&&stale.ok);
  assert.deepEqual(machine.sweep(),{ok:true,expired:0,orphaned:0},'held reservations are kept');
  ledger.db.prepare('DELETE FROM leases WHERE job_id=?').run('j2');
  const swept=machine.sweep();
  assert.equal(swept.orphaned,1,'the orphan was reclaimed');
  assert.equal(machine.db.prepare('SELECT count(*) n FROM leases WHERE job_id=?').get('j2').n,0);
  assert.equal(machine.db.prepare('SELECT count(*) n FROM leases WHERE job_id=?').get('j1').n,1,'the still-held row stays');
  machine.db.prepare('UPDATE leases SET expires_at=?').run(1);
  assert.equal(machine.sweep().expired,1,'expired rows go too');
  machine.close();ledger.close();
});

test('sweep leaves an orphan alone when its registered path now holds a different ledger',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const machine=openMachine({file:path.join(dir,'machine.sqlite')});
  const ledgerFile=path.join(dir,'runtime.sqlite');
  const ledger=openLedger({file:ledgerFile,machine});
  machine.setCapacity('ai/global',10);
  const held=reserveTwoPhase(ledger,machine,{job:{jobId:'j1',workflowId:'wf',generation:1,kind:'model'},machineNeeds:[{resourceKey:'ai/global',units:1}]});
  assert.ok(held.ok);
  ledger.close();
  fs.rmSync(ledgerFile);
  const different=openLedger({file:ledgerFile});   // a fresh ledger, a fresh meta.ledger_id, at the same path
  different.close();
  const swept=machine.sweep();
  assert.equal(swept.orphaned,0,'a different ledger at the same path proves nothing about the old leases');
  assert.equal(machine.db.prepare('SELECT count(*) n FROM leases').get().n,1,'the row is left for its TTL, not wrongly released');
  machine.close();
});

test('bound compaction keeps the transition checkpoints and the latest save of the bound generation, and drops the generations before it',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite')});
  for(let n=1;n<=3;n+=1)snapshot(ledger,{generation:1,checkpoint:`save:wf:1:${n}`});
  snapshot(ledger,{generation:2,checkpoint:'bind:wf:2:seed'});
  snapshot(ledger,{generation:2,checkpoint:'transition:wf:2:t-1'});
  for(let n=1;n<=3;n+=1)snapshot(ledger,{generation:2,checkpoint:`save:wf:2:${n}`});
  snapshot(ledger,{generation:2,checkpoint:'transition:wf:2:t-2'});
  snapshot(ledger,{generation:2,checkpoint:'save:wf:2:latest'});
  const changed=compactSnapshots(ledger.db,{workflowId:'wf',generation:2,goalIdentity:'goal'});
  const rows=ledger.db.prepare('SELECT checkpoint_id,generation,length(state_json) body FROM state_snapshots ORDER BY snapshot_id').all();
  assert.deepEqual(rows.map(row=>[row.checkpoint_id,row.body>0]),[['bind:wf:2:seed',false],['transition:wf:2:t-1',false],['transition:wf:2:t-2',false],['save:wf:2:latest',true]]);
  assert.equal(ledger.db.prepare('SELECT count(*) n FROM state_snapshots WHERE generation=1').get().n,0,'a retired generation keeps nothing');
  assert.ok(changed>0);assert.equal(compactSnapshots(ledger.db,{workflowId:'wf',generation:2,goalIdentity:'goal'}),0,'idempotent');
  ledger.close();
});

test('unbound compaction takes each workflow\'s newest generation as bound and leaves other workflows\' live shape intact',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite')});
  snapshot(ledger,{workflowId:'a',generation:1,checkpoint:'save:a:1:1'});snapshot(ledger,{workflowId:'a',generation:2,checkpoint:'save:a:2:1'});snapshot(ledger,{workflowId:'a',generation:2,checkpoint:'save:a:2:2'});
  snapshot(ledger,{workflowId:'b',generation:5,checkpoint:'transition:b:5:x'});snapshot(ledger,{workflowId:'b',generation:5,checkpoint:'save:b:5:1'});
  compactSnapshots(ledger.db);
  const rows=ledger.db.prepare('SELECT workflow_id,checkpoint_id,length(state_json) body FROM state_snapshots ORDER BY snapshot_id').all();
  assert.deepEqual(rows.map(row=>[row.workflow_id,row.checkpoint_id,row.body>0]),[['a','save:a:2:2',true],['b','transition:b:5:x',false],['b','save:b:5:1',true]]);
  ledger.close();
});

test('retired generations lose their settled jobs and events; a leased or unsettled job keeps its rows whatever its generation',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite')});
  job(ledger,{jobId:'old-done',generation:1});job(ledger,{jobId:'old-failed',generation:1,status:'failed'});job(ledger,{jobId:'old-running',generation:1,status:'running'});
  job(ledger,{jobId:'old-leased',generation:1,status:'queued'});lease(ledger,{jobId:'old-leased',resource:'ai/global'});
  ledger.db.prepare("UPDATE jobs SET status='succeeded' WHERE job_id='old-leased'").run();
  job(ledger,{jobId:'current-done',generation:2});job(ledger,{jobId:'other-old',workflowId:'other',generation:1});
  ledger.appendEvent({eventId:'wf:workflow:1',workflowId:'wf',entityType:'workflow',entityId:'wf',generation:1,kind:'state-transition'});
  const pruned=ledger.retireGenerations({workflowId:'wf',generation:2});
  assert.deepEqual(pruned,{jobs:2,events:3},'two settled jobs of generation 1 and their events, plus the workflow event of generation 1');
  assert.deepEqual(ledger.listJobs().map(item=>item.job_id).sort(),['current-done','old-leased','old-running','other-old']);
  assert.deepEqual(ledger.events({workflowId:'wf'}).map(event=>event.entity_id).sort(),['current-done','old-leased','old-running']);
  assert.deepEqual(liveRows(ledger.db,'wf'),{leases:[{jobId:'old-leased',resource:'ai/global'}],jobs:[{jobId:'old-running',status:'running',generation:1}]});
  assert.equal(pruneRetiredGenerations(ledger.db,{workflowId:'wf',generation:2}).jobs,0,'idempotent');
  ledger.close();
});

test('inputs bind bytes by sha256: put returns a ledger:// ref, and a tampered row refuses to read',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite')});
  const put=ledger.inputs.put({workflowId:'wf',key:'1-brief.md',goalRevision:1,bytes:Buffer.from('hello'),origin:'C:/owner/brief.md',mediaType:'text/markdown'});
  assert.match(put.ref,/^ledger:\/\/inputs\/wf\/1-brief\.md#sha256=[a-f0-9]{64}$/);
  const got=ledger.inputs.get({workflowId:'wf',key:'1-brief.md'});
  assert.equal(Buffer.from(got.bytes).toString(),'hello');assert.equal(got.sha256,put.sha256);assert.equal(got.size,5);
  assert.equal(ledger.inputs.get({workflowId:'wf',key:'missing.md'}),null);
  assert.deepEqual(ledger.inputs.list({workflowId:'wf'}).map(row=>row.key),['1-brief.md']);
  const out=path.join(dir,'worker-inputs');
  const materialised=ledger.inputs.materialise({workflowId:'wf',key:'1-brief.md',dir:out});
  assert.equal(fs.readFileSync(materialised.file,'utf8'),'hello');
  ledger.db.prepare('UPDATE inputs SET bytes=? WHERE workflow_id=? AND key=?').run(Buffer.from('tampered'),'wf','1-brief.md');
  assert.throws(()=>ledger.inputs.get({workflowId:'wf',key:'1-brief.md'}),/input-digest-mismatch/,'a row whose bytes no longer hash to its sha256 refuses to read');
  assert.throws(()=>ledger.inputs.materialise({workflowId:'wf',key:'1-brief.md',dir:out}),/input-digest-mismatch/,'materialise is the same read path');
  ledger.close();
});

test('a workflow is retired whole only when nothing of it is live, and its workflows row goes with it',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite')});
  snapshot(ledger,{generation:1,checkpoint:'save:wf:1:1'});job(ledger,{jobId:'j1',generation:1});job(ledger,{jobId:'j2',generation:1,status:'queued'});
  ledger.inputs.put({workflowId:'wf',key:'1-brief.md',goalRevision:1,bytes:Buffer.from('hello'),origin:'C:/owner/brief.md'});
  lease(ledger,{jobId:'j2'});
  const refused=ledger.retireWorkflow('wf');
  assert.equal(refused.ok,false);assert.equal(refused.live.leases.length,1);assert.equal(ledger.db.prepare('SELECT count(*) n FROM jobs').get().n,2,'nothing removed');
  ledger.db.prepare('DELETE FROM leases WHERE job_id=?').run('j2');
  ledger.db.prepare("UPDATE jobs SET status='cancelled',lease_token=NULL,deadline=NULL WHERE job_id='j2'").run();
  const retired=ledger.retireWorkflow('wf');
  assert.equal(retired.ok,true);assert.equal(retired.removed.workflows,1,'the registration row goes too');
  assert.equal(retired.removed.inputs,1,'input rows go with the workflow');
  assert.equal(retired.removed.snapshots,1);assert.equal(retired.removed.jobs,2);assert.equal(retired.removed.events,2);
  assert.deepEqual(ledgerWorkflows(ledger.db),[]);
  assert.equal(retireWorkflow(ledger.db,'wf').ok,true,'retiring an absent workflow removes nothing and is not an error');
  ledger.close();
});

test('finished shared-store custody keeps one final state and only the latest exact receipt per runtime file',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite')});
  snapshot(ledger,{generation:2,checkpoint:'save:wf:2:old',body:'{"phase":"run"}'});snapshot(ledger,{generation:2,checkpoint:'save:wf:2:final',body:'{"phase":"done"}'});
  job(ledger,{jobId:'settled',generation:2});ledger.appendEvent({eventId:'workflow-history',workflowId:'wf',entityType:'workflow',entityId:'wf',generation:2,kind:'finished'});
  for(const [eventId,entityId,sum] of [['state-old','state.json','old'],['state-final','state.json','final'],['events-final','events.jsonl','events']])ledger.appendEvent({eventId,workflowId:'wf',entityType:'runtime-file',entityId,generation:2,kind:'runtime-file-written',payload:{relative:entityId,sha256:sum}});
  const retired=ledger.retireWorkflow('wf',{preserveRuntimeCustody:true});
  assert.equal(retired.ok,true);assert.deepEqual(retired.retained,{snapshots:1,runtimeFileReceipts:2,generation:2});
  assert.equal(ledger.listJobs().length,0);assert.deepEqual(ledger.events({workflowId:'wf'}).map(event=>event.event_id).sort(),['events-final','state-final']);
  assert.deepEqual(ledger.db.prepare('SELECT state_json FROM state_snapshots WHERE workflow_id=?').all('wf').map(row=>row.state_json),['{"phase":"done"}']);
  assert.equal(ledger.db.prepare('SELECT count(*) n FROM workflows WHERE workflow_id=?').get('wf').n,1,'the kept snapshot still references a registration');
  ledger.close();
});

test('inspectLedger refuses a missing file, and reflects the identity and version a writer left behind',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  assert.throws(()=>inspectLedger({file:path.join(dir,'missing.sqlite')}),/existing file/);
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite')});const id=ledger.ledgerId;ledger.close();
  const inspect=inspectLedger({file:path.join(dir,'runtime.sqlite')});
  assert.equal(inspect.version,1);assert.equal(inspect.readOnly,true);assert.deepEqual(inspect.workflows(),[]);
  assert.equal(inspect.ledgerId,id);assert.equal(inspect.ledgerId,ledgerIdOf(inspect));
  inspect.close();
});

test('the anchor is written atomically and read back exactly, one workflow at a time',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  assert.equal(readAnchor(dir),null,'nothing tracked yet');
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite')});
  const anchor=writeAnchor(dir,{ledgerId:ledger.ledgerId,workflowId:'wf',generation:1,checkpointId:'save:wf:1:1',eventsHead:'abc',seq:3});
  assert.equal(anchor.schema,ANCHOR_SCHEMA);assert.equal(anchor.ledgerId,ledger.ledgerId);
  const read=readAnchor(dir);
  assert.deepEqual(read.workflows.wf,{generation:1,checkpointId:'save:wf:1:1',eventsHead:'abc',seq:3,at:read.workflows.wf.at});
  assert.equal(fs.readdirSync(path.join(dir,'.starciwork')).some(name=>name.includes('.tmp')),false,'no leftover temp file after the atomic rename');
  writeAnchor(dir,{ledgerId:ledger.ledgerId,workflowId:'wf2',generation:5,checkpointId:'save:wf2:5:1'});
  assert.deepEqual(Object.keys(readAnchor(dir).workflows).sort(),['wf','wf2'],'writing a second workflow keeps the first');
  assert.throws(()=>writeAnchor(dir,{ledgerId:'not-the-tracked-ledger',workflowId:'wf3',generation:1,checkpointId:'save:wf3:1:1'}),/ledger-identity-mismatch/);
  ledger.close();
});

test('verifyAnchor: no tracked anchor is a legitimate first boot, and the three named refusals of §12',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite')});
  assert.deepEqual(verifyAnchor(ledger,dir),{ok:true,checked:0},'no tracked anchor at all');

  snapshot(ledger,{generation:1,checkpoint:'save:wf:1:1'});
  const head=ledger.appendEvent({workflowId:'wf',entityType:'workflow',entityId:'wf',generation:1,kind:'checkpoint'});
  writeAnchor(dir,{ledgerId:ledger.ledgerId,workflowId:'wf',generation:1,checkpointId:'save:wf:1:1',eventsHead:head.digest,seq:head.seq});
  assert.deepEqual(verifyAnchor(ledger,dir),{ok:true,checked:1},'the ledger holds exactly the anchored head');

  assert.deepEqual(verifyAnchor(null,dir),{ok:false,reason:'ledger-missing'},'a tracked anchor with no ledger at all');
  assert.deepEqual(verifyAnchor(undefined,dir),{ok:false,reason:'ledger-missing'});

  const other=openLedger({file:path.join(dir,'other.sqlite')});
  assert.deepEqual(verifyAnchor(other,dir),{ok:false,reason:'ledger-identity-mismatch'});
  other.close();

  ledger.db.prepare('DELETE FROM state_snapshots').run();
  assert.deepEqual(verifyAnchor(ledger,dir),{ok:false,reason:'ledger-behind-anchor',workflowId:'wf'},'the anchored generation has no snapshot any more');
  snapshot(ledger,{generation:1,checkpoint:'save:wf:1:1'});
  assert.deepEqual(verifyAnchor(ledger,dir),{ok:true,checked:1},'restoring the snapshot clears the refusal');

  ledger.db.prepare('UPDATE events SET digest=? WHERE workflow_id=?').run('tampered','wf');
  assert.deepEqual(verifyAnchor(ledger,dir),{ok:false,reason:'ledger-behind-anchor',workflowId:'wf'},'the anchored event digest is no longer there');
  ledger.close();
});

test('openLedger migrates a v1 file that predates meta, preserving every row and retrofitting the digest trigger',t=>{
  const {dir,file,firstDigest}=legacyLedgerFile();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
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
  assert.deepEqual(verifyChain(ledger.db,{workflowId:'wf'}),{ok:true,checked:2,brokenAt:null},'the chain the trigger computed verifies like any other');
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
