import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { register } from 'node:module';
import { page, ReadCursorError, limitOf } from '../../ui/api/query.mjs';
import { handleDecisions } from '../../ui/api/routes/decisions.mjs';
import { handleLogs } from '../../ui/api/routes/logs.mjs';

const url = value => new URL(value, 'http://fixture');
function read(handler, store, pathname) {
  const response = { status: null, body: null, setHeader() {}, writeHead(status) { this.status = status; }, end(body) { this.body = body; } };
  assert.equal(handler({ method: 'GET', headers: {} }, response, store, url(pathname)), true);
  return { status: response.status, ...JSON.parse(response.body) };
}
// Only in-memory SQL projections are used. No engine opener, migration, live
// database, provider, child process or filesystem fixture is touched.
function fixture(t) {
  const machine = new DatabaseSync(':memory:'), ledger = new DatabaseSync(':memory:');
  t.after(() => { ledger.close(); machine.close(); });
  const di = `di_id TEXT,ledger_id TEXT,workflow_id TEXT,kind TEXT,decider TEXT,status TEXT,summary TEXT,entity_type TEXT,entity_id TEXT,opened_by TEXT,opened_at INTEGER,due_at INTEGER,escalations INTEGER,claim_by TEXT,claim_at INTEGER,claim_ttl_ms INTEGER,resolved_at INTEGER,options_json TEXT,allowed_verbs_json TEXT,evidence_json TEXT,payload_json TEXT,resolution_verb TEXT`;
  machine.exec(`CREATE TABLE sup_decision_items(${di});
    CREATE VIEW v_open_sup_decisions AS SELECT di_id,'waiting' AS ui,due_at FROM sup_decision_items;
    CREATE TABLE ask_requests(ask_id TEXT,ledger_id TEXT,workflow_id TEXT,di_id TEXT,channel TEXT,question TEXT,asked_at INTEGER,answered_at INTEGER,state TEXT);
    CREATE TABLE deliveries(delivery_id INTEGER,message_kind TEXT,message_ref TEXT,ledger_id TEXT,seat_id TEXT,channel TEXT,attempted_at INTEGER);
    CREATE TABLE sup_events(seq INTEGER,entity_id TEXT,kind TEXT,created_at INTEGER,payload_json TEXT);
    CREATE TABLE sup_decisions(di_id TEXT,decided_at INTEGER,decider TEXT,choice TEXT,result_json TEXT);
    CREATE TABLE ui_state_map(entity TEXT,native TEXT,ui TEXT,rule TEXT);`);
  ledger.exec(`CREATE TABLE decision_items(${di});
    CREATE VIEW v_decision_rows AS SELECT *,'waiting' AS ui,0 AS overdue FROM decision_items;
    CREATE TABLE decisions(decision_id TEXT,di_id TEXT,workflow_id TEXT,subject_type TEXT,subject_id TEXT,decided_at INTEGER,decider TEXT,choice TEXT,rationale TEXT,result_json TEXT);
    CREATE TABLE incidents(incident_id TEXT,workflow_id TEXT,kind TEXT);
    CREATE TABLE events(seq INTEGER,entity_id TEXT,kind TEXT,created_at INTEGER,payload_json TEXT);
    CREATE TABLE ui_state_map(entity TEXT,native TEXT,ui TEXT,rule TEXT);
    INSERT INTO ui_state_map VALUES('decision','resolved','done',NULL);
    CREATE TABLE v_timeline(seq INTEGER,source TEXT,workflow_id TEXT,attempt_id INTEGER,entity_id TEXT,kind TEXT,at INTEGER,detail TEXT);
    CREATE TABLE op_attempts(attempt_id INTEGER,job_id TEXT);
    CREATE TABLE v_op_history(attempt_id INTEGER,attempt_state TEXT,ui TEXT);
    CREATE TABLE v_checks(check_id TEXT,ui TEXT);`);
  const logs = `seq INTEGER PRIMARY KEY,ledger_id TEXT,at INTEGER,actor TEXT,controller TEXT,workflow_id TEXT,job_id TEXT,level TEXT,kind TEXT,msg TEXT,data_json TEXT,refs_json TEXT,trace_id TEXT,span_id TEXT`;
  machine.exec(`CREATE TABLE machine_logs(${logs}); CREATE VIRTUAL TABLE machine_logs_fts USING fts5(msg);`);
  ledger.exec(`CREATE TABLE logs(${logs}); CREATE VIRTUAL TABLE logs_fts USING fts5(msg);`);
  const row = { name: 'fixture', ledgerId: 'ledger-a' };
  const store = { machine: { db: machine }, stale: new Set(), projects: () => [row], ledger: project => ['fixture', 'ledger-a'].includes(project) ? { row, db: ledger } : null };
  return { machine, ledger, store };
}

test('native anchor paging survives inserts and rejects changed scope, deleted anchors and legacy cursors', () => {
  const initial = url('/api/decisions?project=fixture&limit=1');
  const rows = [{ id: 'same', store: 'machine', ledgerId: 'ledger-a' }, { id: 'same', store: 'ledger', ledgerId: 'ledger-a' }, { id: 'last', store: 'ledger', ledgerId: 'ledger-a' }];
  const first = page(rows, initial);
  const next = url(initial); next.searchParams.set('cursor', first.next);
  assert.deepEqual(page([{ id: 'new', store: 'machine' }, ...rows], next).rows, [rows[1]]);
  const changed = url(next); changed.searchParams.set('project', 'other');
  assert.throws(() => page(rows, changed), ReadCursorError);
  assert.throws(() => page(rows.slice(1), next), ReadCursorError);
  const legacy = url(initial); legacy.searchParams.set('cursor', '1');
  assert.throws(() => page(rows, legacy), ReadCursorError);
  assert.equal(limitOf(url('/api/logs?limit=1.9')), 1);
  assert.equal(limitOf(url('/api/logs?limit=900')), 200);
});

test('DI detail requires exact namespace; ambiguous deliveries and credential-unobserved asks are suppressed', t => {
  const { machine, ledger, store } = fixture(t);
  const insert = (db, table, summary) => db.prepare(`INSERT INTO ${table}(di_id,ledger_id,workflow_id,kind,decider,status,summary,opened_at,escalations) VALUES('same','ledger-a','wf','review','owner','open',?,10,0)`).run(summary);
  insert(machine, 'sup_decision_items', 'machine record'); insert(ledger, 'decision_items', 'ledger record');
  machine.exec(`INSERT INTO deliveries VALUES(1,'decision','same','ledger-a',NULL,'telegram',20);
    INSERT INTO ask_requests VALUES('unobserved','missing-ledger','wf',NULL,'telegram','must not escape',30,NULL,'open');
    INSERT INTO ask_requests VALUES('collision','ledger-a','wf','same','telegram','ambiguous text',40,NULL,'open');`);
  const beforeMachine = machine.prepare('SELECT total_changes() AS n').get().n, beforeLedger = ledger.prepare('SELECT total_changes() AS n').get().n;
  assert.equal(read(handleDecisions, store, '/api/decisions/same?project=fixture').error.code, 'AMBIGUOUS_DECISION');
  const exact = read(handleDecisions, store, '/api/decisions/same?project=fixture&store=ledger&ledger=ledger-a').data;
  assert.equal(exact.summary, 'ledger record'); assert.equal(exact.store, 'ledger'); assert.equal(exact.channel, null); assert.deepEqual(exact.history, []);
  const sup = read(handleDecisions, store, '/api/decisions/same?store=machine&ledger=ledger-a').data;
  assert.equal(sup.summary, 'machine record'); assert.equal(sup.project, 'fixture');
  const asks = read(handleDecisions, store, '/api/asks').data;
  assert.equal(asks.length, 2); assert.ok(asks.every(ask => ask.question === null && ask.contentSuppressed));
  assert.equal(read(handleDecisions, store, '/api/asks?project=fixture&wf=other').data.length, 0);
  assert.equal(machine.prepare('SELECT total_changes() AS n').get().n, beforeMachine);
  assert.equal(ledger.prepare('SELECT total_changes() AS n').get().n, beforeLedger);
});

test('logs bind source and filters, page append-only snapshots, and timeline uses native resolution identity', t => {
  const { machine, ledger, store } = fixture(t);
  machine.exec(`INSERT INTO machine_logs(seq,ledger_id,at,actor,workflow_id,level,kind,msg) VALUES(1,'ledger-a',100,'engine','wf','info','machine','machine text');`);
  ledger.exec(`INSERT INTO logs(seq,at,actor,workflow_id,level,kind,msg) VALUES(1,90,'op','wf','info','first','ledger first'),(2,80,'op','wf','warn','second','ledger second');
    INSERT INTO logs_fts(rowid,msg) VALUES(1,'ledger first'),(2,'ledger second');
    INSERT INTO decisions VALUES('resolution-native','di-native','wf','workflow','wf',95,'owner','approve','recorded',NULL);
    INSERT INTO v_timeline VALUES(99,'decision','wf',NULL,'wrong-subject','approve',95,NULL);`);
  const first = read(handleLogs, store, '/api/logs?project=fixture&limit=1');
  assert.equal(first.data[0].store, 'machine');
  ledger.exec(`INSERT INTO logs(seq,at,actor,workflow_id,level,kind,msg) VALUES(3,110,'op','wf','info','late','later append');`);
  const nextPath = `/api/logs?project=fixture&limit=1&cursor=${first.meta.next}`;
  assert.equal(read(handleLogs, store, nextPath).data[0].seq, 1);
  assert.throws(() => read(handleLogs, store, `${nextPath}&level=warn`), ReadCursorError);
  const exact = read(handleLogs, store, '/api/logs?source=ledger&project=fixture&id=1');
  assert.equal(exact.data[0].msg, 'ledger first'); assert.equal(exact.data.length, 1);
  assert.equal(read(handleLogs, store, '/api/logs?project=fixture&id=1').error.code, 'BAD_SCOPE');
  assert.equal(read(handleLogs, store, '/api/logs?source=ledger&project=fixture&q=second').data[0].seq, 2);
  const timeline = read(handleLogs, store, '/api/timeline?project=fixture&wf=wf&sources=decision').data;
  assert.equal(timeline.length, 1); assert.equal(timeline[0].key, 'ledger-a:decision:resolution-native');
  assert.equal(timeline[0].ui, 'done'); assert.equal(timeline[0].ref.id, 'di-native');
  assert.ok(timeline[0].ref.href.includes('store=ledger')); assert.ok(timeline[0].ref.href.includes('ledger=ledger-a'));
});

test('analytics separates reports and rejected closures from verdict settlements and never invents try one', async () => {
  register(new URL('../helpers/ui-typescript-loader.mjs', import.meta.url));
  const helpers = await import('../../ui/src/components/charts/analytics-data.ts');
  const base = { project: 'fixture', wf: 'wf', unit: 'unit', attempt: 1, dispatchedAt: 10, settledAt: null, verdict: null, endState: null, reportedAt: null, reportOutcome: null };
  const pass = { ...base, settledAt: 90, verdict: 'pass', endState: 'settled' };
  const reported = { ...base, reportedAt: 80, reportOutcome: 'pass' };
  const requeued = { ...base, settledAt: 70, endState: 'requeued' };
  const unknownEffect = { ...base, settledAt: 60, endState: 'effect-unknown' };
  assert.equal(helpers.attemptState(reported), 'settling');
  assert.equal(helpers.attemptState(requeued), 'retry');
  assert.equal(helpers.attemptState(unknownEffect), 'bad');
  assert.equal(helpers.isVerdictSettled({ ...base, verdict: 'pass' }), false);
  assert.equal(helpers.isVerdictSettled(requeued), false);
  assert.equal(helpers.isVerdictSettled(pass), true);
  assert.equal(helpers.throughput([pass, reported, requeued, unknownEffect], 0, 100).buckets.reduce((n, bucket) => n + bucket.settled, 0), 1);
  assert.equal(helpers.counts([pass, reported, requeued, unknownEffect]).total, 4);
  assert.equal(helpers.triesPerUnit([{ ...base, attempt: null }, { ...base, unit: 'other', attempt: 3 }]).has(1), false);
});
