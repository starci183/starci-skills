import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { openLedger, openLedgerReader, recordCheckRun } from '../../engine/db/ledger.mjs';
import { openMachineObserver, providerReservations, providerReservationUsage, MACHINE_VERSION } from '../../engine/db/machine.mjs';
import { admissionReservation, admissionView, attemptAdmission } from '../../ui/api/admission-read.mjs';
import { workflowCheckpoint, workflowLand } from '../../ui/api/land-read.mjs';
import { pipelineOf } from '../../ui/api/pipeline.mjs';
import { handleSystem } from '../../ui/api/routes/system.mjs';
import { handleAttempt } from '../../ui/api/routes/attempt.mjs';
import { handleWork } from '../../ui/api/routes/work.mjs';
import { handleDecisions } from '../../ui/api/routes/decisions.mjs';
import { search } from '../../ui/api/routes/meta.mjs';
import { sendJson } from '../../ui/api/envelope.mjs';
import { openUiDb } from '../../ui/api/db.mjs';
import { bindProvenance } from '../../ui/api/provenance.mjs';
import { ledgerSearchHit, machineSearchHit } from '../../ui/api/search-read.mjs';
import { topicsOf, related } from '../../ui/api/live-read.mjs';
import { contract, healthz } from '../../ui/api/routes/meta.mjs';

const stamp = 1_800_000_000_000;
const head = 'a'.repeat(40), later = 'b'.repeat(40);
const receipt = (fields = {}) => ({ id: 'receipt-1', fence: 1, attemptId: 'op:scope:launch', provider: 'codex', account: 'primary', model: 'model-a',
  role: 'op', state: 'live', slots: 1, maxParallel: 4, scope: { scopeId: 'scope' }, createdAt: stamp, updatedAt: stamp + 10,
  quota: { authority: 'cli', auth: 'authenticated', state: 'available', fresh: true, observedAt: stamp - 10,
    expiresAt: stamp + 100, windows: [{ id: 'weekly', usedPercent: null, resetsAt: null, observedAt: stamp - 10, windowMinutes: 10080 }] }, ...fields });

function saveReceipt(machine, value) {
  machine.db.prepare(`INSERT INTO provider_reservations(fence,id,attempt_id,provider,account,model,role,scope_json,state,slots,max_parallel,quota_json,created_at,updated_at,released_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(value.fence, value.id, value.attemptId, value.provider, value.account, value.model, value.role,
    JSON.stringify(value.scope), value.state, value.slots, value.maxParallel, JSON.stringify(value.quota), value.createdAt, value.updatedAt, value.releasedAt ?? null);
}
function readStore(fixture) {
  const machine = fixture.track(openMachineObserver({ file: fixture.machineFile }));
  const reader = fixture.track(openLedgerReader(fixture.ledgerFile));
  const row = { name: 'fixture', ledgerId: fixture.ledger.db.prepare("SELECT value FROM meta WHERE key='ledger_id'").get().value,
    repoRoot: fixture.repoRoot, file: fixture.ledgerFile };
  return { machine, stale: new Set(), projects: () => [row], ledger: project => project === row.name ? { row, db: reader } : null,
    forEachLedger: fn => [{ result: fn({ row, db: reader }) }] };
}
async function request(handler, store, pathname, { method = 'GET', etag = null } = {}) {
  const response = { headers: {}, status: null, body: null, setHeader(key, value) { this.headers[key] = value; },
    writeHead(status) { this.status = status; }, end(body) { this.body = body ?? null; } };
  await handler({ method, headers: etag ? { 'if-none-match': etag } : {} }, response, store, new URL(pathname, 'http://fixture'));
  return { ...response, json: response.body ? JSON.parse(response.body) : null };
}
function addContract(ledger, attemptId, admission) {
  const attempt = ledger.db.prepare('SELECT * FROM op_attempts WHERE attempt_id=?').get(attemptId);
  ledger.transaction(db => db.prepare('INSERT INTO contracts(attempt_id,workflow_id,job_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?)')
    .run(attemptId, attempt.workflow_id, attempt.job_id, 'fixture contract', JSON.stringify({ managed: { admission } }), stamp));
}

function observerEvidence(fixture) {
  const db = fixture.machine.db;
  const schema = db.prepare('SELECT type,name,sql FROM sqlite_master ORDER BY type,name').all();
  const files = fs.readdirSync(fixture.root, { recursive: true }).sort();
  return {
    version: db.prepare('PRAGMA user_version').get().user_version,
    journal: db.prepare('PRAGMA journal_mode').get().journal_mode,
    schema,
    rows: schema.filter(row => row.type === 'table').map(({ name }) =>
      [name, db.prepare(`SELECT * FROM ${JSON.stringify(name)}`).all().map(row => JSON.stringify(row)).sort()]),
    files,
    // Shared-memory lock bytes coordinate live connections; DB, WAL and every other file must remain identical.
    bytes: files.filter(name => !name.endsWith('-shm') && fs.statSync(path.join(fixture.root, name)).isFile())
      .map(name => [name, crypto.createHash('sha256').update(fs.readFileSync(path.join(fixture.root, name))).digest('hex')]),
  };
}

function registryCorruption(t, { stage = 'all', failures = Infinity } = {}) {
  const original = DatabaseSync.prototype.prepare, query = 'SELECT * FROM ledgers WHERE state=? ORDER BY name';
  let attempts = 0;
  const fail = () => { if (attempts++ < failures) throw Object.assign(Error('private registry corruption'), { errcode: 11 }); };
  const mocked = t.mock.method(DatabaseSync.prototype, 'prepare', function (sql, ...args) {
    if (sql === query && stage === 'prepare') fail();
    const statement = original.call(this, sql, ...args);
    if (sql !== query || stage !== 'all') return statement;
    return new Proxy(statement, {
      get(target, property) {
        const value = Reflect.get(target, property, target);
        if (property === 'all') return (...params) => { fail(); return value.apply(target, params); };
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  });
  return { attempts: () => attempts, restore: () => mocked.mock.restore() };
}

const observedHealth = (req, res, store) => { bindProvenance(req, store); healthz(req, res, store); };

test('current captured evidence is historical and unknown retains capacity for all five roles', t => withLedger(t, fixture => {
  assert.equal(fixture.machine.db.prepare('PRAGMA user_version').get().user_version, MACHINE_VERSION);
  assert.deepEqual(admissionView(fixture.machine.db), { observed: true, running: 0, unknown: 0, reservations: [] });
  ['kernel', 'op', 'supervisor', 'worker', 'critic'].forEach((role, i) => saveReceipt(fixture.machine,
    receipt({ role, id: `receipt-${i}`, fence: i + 1, attemptId: `launch-${i}`, state: i === 3 ? 'unknown' : i === 4 ? 'released' : 'live' })));
  const view = admissionView(fixture.machine.db);
  assert.equal(view.observed, true);
  assert.equal(view.running, 4);
  assert.equal(view.unknown, 1);
  assert.deepEqual(new Set(view.reservations.map(row => row.role)), new Set(['kernel', 'op', 'supervisor', 'worker', 'critic']));
  assert.equal(view.reservations[0].quota.fresh, true); // Captured in the past, never recalculated into current permission.
  assert.equal(view.reservations[0].quota.windows[0].usedPercent, null);
  assert.equal(view.reservations[0].releasedAt, null);
  assert.equal(view.reservations[0].quota.windows[0].resetsAt, null);
  assert.equal(Object.hasOwn(view.reservations[0].quota, 'normalAdmission'), false);
  const unavailable = admissionReservation(receipt({ quota: { fresh: 'true', auth: null, state: null, observedAt: 'invalid', expiresAt: null } }));
  assert.equal(unavailable.quota.fresh, null);
  assert.equal(unavailable.quota.observedAt, null);
  assert.equal(unavailable.quota.expiresAt, null);
  assert.equal(admissionReservation(receipt({ createdAt: 'invalid' })), null);
  assert.equal(admissionReservation(receipt({ updatedAt: null })), null);
}));

test('Attempt admission uses its immutable contract; identity or fence mismatch cannot attach a current receipt', t => withLedger(t, fixture => {
  seedWorkflow(fixture.ledger, { id: 'wf', jobs: [{ jobId: 'job', opId: 'backend.implement', status: 'running', payload: { managed: { admission: { receipt: receipt({ id: 'mutable-job-receipt' }) } } } }] });
  const captured = receipt();
  saveReceipt(fixture.machine, captured);
  addContract(fixture.ledger, 1, { selected: { model: 'model-a' }, receipt: captured });
  let result = attemptAdmission(fixture.ledger.db, fixture.machine.db, 1);
  assert.equal(result.source, 'contract');
  assert.equal(result.capturedReceipt.id, captured.id);
  assert.equal(result.receipt.id, captured.id);
  fixture.machine.db.prepare('UPDATE provider_reservations SET fence=2 WHERE id=?').run(captured.id);
  result = attemptAdmission(fixture.ledger.db, fixture.machine.db, 1);
  assert.equal(result.receipt, null);
  assert.equal(result.capturedReceipt.fence, 1);
  fixture.machine.db.prepare('UPDATE provider_reservations SET fence=1,model=? WHERE id=?').run('model-other', captured.id);
  assert.equal(attemptAdmission(fixture.ledger.db, fixture.machine.db, 1).receipt, null);
}));

test('workflow land prefers the current event, binds workflow/repository and distinguishes an unproven Attempt head', t => withLedger(t, fixture => {
  seedWorkflow(fixture.ledger, { id: 'wf', jobs: [{ jobId: 'job', status: 'succeeded', result: { verdict: 'pass' }, dispatchedAt: stamp, updatedAt: stamp + 100 }], events: [
    { kind: 'workflow-checkpoint', entityType: 'job', entityId: 'job', at: stamp + 50, payload: { sha: head } },
    { kind: 'workflow-landed', at: stamp + 200, payload: { head, repoRoot: fixture.repoRoot, steps: [{ step: 'push', ok: true, pushed: false, skipped: 'no-origin' }] } },
    { kind: 'workflow-landed', at: stamp + 300, payload: { head: later, repoRoot: `${fixture.repoRoot}-foreign`, steps: [] } },
  ] });
  fixture.ledger.transaction(db => db.prepare('UPDATE op_attempts SET repo_root=?,head_sha=? WHERE attempt_id=1').run(fixture.repoRoot, head));
  const raw = fixture.ledger.db.prepare('SELECT * FROM op_attempts WHERE attempt_id=1').get();
  let land = workflowLand(fixture.ledger.db, raw);
  assert.equal(land.scope, 'workflow');
  assert.equal(land.source, 'workflow-landed');
  assert.equal(land.result, 'landed');
  assert.equal(land.pushed, false);
  assert.equal(land.branch, null);
  assert.equal(land.attemptAssociation, 'head-match');
  assert.equal(land.checkpoint.sha, head);
  land = workflowLand(fixture.ledger.db, { ...raw, job_id: 'another-job', head_sha: later });
  assert.equal(land.attemptAssociation, 'unproven');
  assert.equal(workflowLand(fixture.ledger.db, { ...raw, workflow_id: 'foreign-workflow' }), null);
}));

test('successful operation checkpoint remains observable before workflow land and excludes later job dispatch evidence', t => withLedger(t, async fixture => {
  seedWorkflow(fixture.ledger, { id: 'wf', jobs: [{ jobId: 'job', status: 'succeeded', result: { verdict: 'pass' }, dispatchedAt: stamp, updatedAt: stamp + 100 }], events: [
    { kind: 'workflow-checkpoint', entityType: 'job', entityId: 'job', at: stamp + 50, payload: { sha: head } },
    { kind: 'workflow-checkpoint', entityType: 'job', entityId: 'job', at: stamp + 200, payload: { sha: later } },
  ] });
  fixture.ledger.transaction(db => db.prepare('UPDATE op_attempts SET repo_root=? WHERE attempt_id=1').run(fixture.repoRoot));
  const raw = fixture.ledger.db.prepare('SELECT * FROM op_attempts WHERE attempt_id=1').get();
  assert.deepEqual(workflowCheckpoint(fixture.ledger.db, raw), { sha: head, at: stamp + 50, committed: null, scope: null, files: null });
  assert.equal(workflowLand(fixture.ledger.db, raw), null);
  const detail = (await request(handleAttempt, readStore(fixture), '/api/attempts/fixture/1')).json.data;
  assert.deepEqual(detail.checkpoint, { sha: head, at: stamp + 50, committed: null, scope: null, files: null });
  assert.equal(detail.land, null);
}));

test('Attempt endpoint retains an exact recorded checkpoint while settlement and workflow land remain pending', t => withLedger(t, async fixture => {
  seedWorkflow(fixture.ledger, { id: 'wf', jobs: [{ jobId: 'pending-job', status: 'running', dispatchedAt: stamp }], events: [
    { kind: 'workflow-checkpoint', entityType: 'job', entityId: 'pending-job', at: stamp + 50,
      payload: { sha: head, kind: 'workflow-checkpoint', attemptId: 1, dispatchId: 'seed:pending-job', committed: true,
        scope: ['be/'], files: ['be/checkpoint.ts'] } },
  ] });
  const detail = (await request(handleAttempt, readStore(fixture), '/api/attempts/fixture/1')).json.data;
  assert.equal(detail.verdict, null);
  assert.equal(detail.settledAt, null);
  assert.deepEqual(detail.checkpoint, { sha: head, at: stamp + 50, committed: true, scope: ['be/'], files: ['be/checkpoint.ts'] });
  assert.equal(detail.land, null);
}));

test('repository identity matches recorded casing and follows native platform case rules', t => withLedger(t, fixture => {
  seedWorkflow(fixture.ledger, { id: 'wf', events: [{ kind: 'workflow-landed', at: stamp,
    payload: { head, repoRoot: fixture.repoRoot, steps: [] } }] });
  const attempt = { workflow_id: 'wf', repo_root: fixture.repoRoot, head_sha: head };
  const land = workflowLand(fixture.ledger.db, attempt);
  assert.equal(land?.source, 'workflow-landed');
  assert.equal(land?.attemptAssociation, 'head-match');
  const differentCase = workflowLand(fixture.ledger.db, { ...attempt, repo_root: fixture.repoRoot.toUpperCase() });
  if (process.platform === 'win32') {
    assert.equal(differentCase?.source, 'workflow-landed');
    assert.equal(differentCase?.attemptAssociation, 'head-match');
  } else assert.equal(differentCase, null);
}));

test('read routes project observed/requested models, actual numeric retry IDs, runtime checks and unknown resource/health states', t => withLedger(t, async fixture => {
  seedWorkflow(fixture.ledger, { id: 'wf', jobs: [
    { jobId: 'first-job', unitId: 'unit', opId: 'backend.implement', status: 'failed', result: { verdict: 'fail' }, dispatchedAt: stamp, updatedAt: stamp + 100 },
    { jobId: 'retry-job', unitId: 'unit', opId: 'backend.implement', tryNo: 2, status: 'running', retryOf: 'first-job', dispatchedAt: stamp + 200 },
  ] });
  fixture.ledger.transaction(db => {
    db.prepare('UPDATE op_attempts SET request_model=?,model=?,attested_at=?,terminal_closed_at=? WHERE attempt_id=2').run('requested', 'observed', stamp + 210, stamp + 220);
    for (const [runner, authority, exitCode, name] of [['op', 'declared', 0, 'claimed'], ['kernel', 'runtime', 0, 'measured'], ['settler', 'runtime', null, 'unmeasured']]) {
      recordCheckRun(db, { attemptId: 2, name, phase: 'verify', runner, authority, status: 'pass', exitCode, createdAt: stamp + 215 });
    }
  });
  fixture.machine.db.prepare('INSERT INTO quotas(provider,window,used,limit_value,observed_at) VALUES(?,?,?,?,?)').run('codex', 'weekly', null, null, stamp);
  const store = readStore(fixture);
  const attempt = (await request(handleAttempt, store, '/api/attempts/fixture/2')).json.data;
  assert.equal(attempt.requestedModel, 'requested');
  assert.equal(attempt.model, 'observed');
  assert.equal(attempt.modelAuthority, 'attested');
  assert.equal(attempt.checksPass, 1);
  assert.equal(attempt.retry.retryOf.id, '1');
  assert.equal(attempt.retry.retryOf.href, '#/a/fixture/1');
  assert.equal((await request(handleAttempt, store, '/api/attempts/fixture/1')).json.data.retry.next.id, '2');
  const resource = (await request(handleSystem, store, '/api/resources')).json.data;
  assert.equal(resource.quotas[0].ui, 'unknown');
  assert.equal(resource.throttle.ui, 'unknown');
  assert.deepEqual(resource.admission, { observed: true, running: 0, unknown: 0, reservations: [] });
  assert.equal((await request(handleWork, store, '/api/workers')).json.data.health.ui, 'unknown');
  assert.equal((await request(handleSystem, store, '/api/health')).json.data.ui, 'unknown');
  const headResponse = await request(handleSystem, store, '/api/resources', { method: 'HEAD' });
  assert.equal(headResponse.status, 200);
  assert.equal(headResponse.body, null);
  assert.equal(store.machine.db.prepare('PRAGMA query_only').get().query_only, 1);
  assert.equal(store.machine.db.prepare('SELECT total_changes() AS n').get().n, 0);
  assert.equal(store.ledger('fixture').db.prepare('SELECT total_changes() AS n').get().n, 0);
}));

test('exact planner instances are unbound from base-op records and work graph colors follow current scoped jobs', t => withLedger(t, fixture => {
  seedWorkflow(fixture.ledger, { id: 'wf', goal: { json: { opChain: { legs: [{ seq: 1, op: 'backend.implement', instance: 'one' }, { seq: 2, op: 'backend.implement', instance: 'two' }], edges: [['backend.implement#one', 'backend.implement#two']] } } },
    jobs: [{ jobId: 'job', unitId: 'unit', opId: 'backend.implement', status: 'running', payload: { owned_paths: ['be/source'] } }] });
  const graph = { nodes: [{ id: 'node', title: 'Node', ownedPaths: ['be/source'] }], edges: [] };
  fixture.ledger.transaction(db => db.prepare('INSERT INTO work_graph_versions(workflow_id,version,event,graph_json,diff_json,colors_json,reason,author_op,digest,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run('wf', 1, 'draw', JSON.stringify(graph), '{}', JSON.stringify({ node: 'green' }), 'fixture graph', 'work.draw', 'fixture-digest', stamp));
  const pipe = pipelineOf(fixture.ledger.db, 'fixture', 'wf');
  assert.deepEqual(pipe.edges, [{ from: 'backend.implement#one', to: 'backend.implement#two' }]);
  assert.deepEqual(pipe.legs.slice(0, 2).map(leg => leg.attempts.length), [0, 0]);
  assert.equal(pipe.legs[2].op, 'backend.implement');
  assert.equal(pipe.legs[2].attempts.length, 1);
  assert.equal(pipe.legs[2].attempts[0].dispatchSeq, 1);
  assert.equal(pipe.legs[2].attempts[0].endedAt, null);
  assert.equal(pipe.progress.total, 2);
  assert.deepEqual(pipe.progress.byStatus, { planned: 2 });
  assert.equal(pipe.workGraph.nodes[0].color, 'yellow');
}));

test('search uses recorded Attempt state instead of inventing healthy status', t => withLedger(t, async fixture => {
  seedWorkflow(fixture.ledger, { id: 'wf', jobs: [{ jobId: 'job', opId: 'backend.implement', status: 'failed', result: { verdict: 'fail' } }] });
  const result = await request(search, readStore(fixture), '/api/search?q=backend.implement');
  const hit = result.json.data.hits.find(row => row.kind === 'attempt' && row.id === '1');
  assert.ok(hit);
  assert.equal(hit.ui, 'bad');
}));

test('ETag changes on stale/provenance/next changes while GET/HEAD remain read-only cache operations', async () => {
  const route = options => (req, res) => sendJson(req, res, { value: 'unchanged', apiToken: 'secret-fixture-value' }, options);
  const first = await request(route({ sources: [{ db: 'fixture', rel: 'rows' }] }), null, '/');
  const same = await request(route({ sources: [{ db: 'fixture', rel: 'rows' }] }), null, '/', { etag: first.headers.ETag });
  assert.equal(same.status, 304);
  for (const options of [{ sources: [{ db: 'fixture', rel: 'rows' }], stale: ['fixture'] }, { sources: [{ db: 'fixture', rel: 'other' }] }, { sources: [{ db: 'fixture', rel: 'rows' }], next: 'next-page' }]) {
    const changed = await request(route(options), null, '/', { etag: first.headers.ETag });
    assert.equal(changed.status, 200);
    assert.notEqual(changed.headers.ETag, first.headers.ETag);
  }
  assert.doesNotMatch(first.body, /secret-fixture-value/);
});

function registerFixture(fixture) {
  const ledgerId = fixture.ledger.db.prepare("SELECT value FROM meta WHERE key='ledger_id'").get().value;
  fixture.machine.registerLedger({ ledgerId, name: 'fixture', repoRoot: fixture.repoRoot, file: fixture.ledgerFile });
  return ledgerId;
}

test('retired machine identity cannot become an authoritative UI read store', t => withLedger(t, fixture => {
  fixture.machine.db.exec('PRAGMA user_version=1;');
  const before = observerEvidence(fixture);
  assert.throws(() => readStore(fixture), /machine-schema-old/);
  assert.deepEqual(observerEvidence(fixture), before);
  assert.equal(fs.existsSync(fixture.machineFile+'.outbox.jsonl'), false);
}));

test('current reservation readers and UI GET/HEAD map recorded holds with no normal-read writes', t => withLedger(t, async fixture => {
  const reserved = fixture.machine.reserveProvider({ provider: 'codex', account: 'primary', attemptId: 'native-observed-launch',
    role: 'worker', model: 'model-a', maxParallel: 2, scope: { scopeId: 'native-scope' }, quota: receipt().quota });
  assert.equal(reserved.ok, true);
  fixture.machine.markProviderReservation({ id: reserved.reservation.id, fence: reserved.reservation.fence,
    attemptId: reserved.reservation.attemptId, state: 'unknown', launchIdentity: 'fixture-launch', hostRequestId: 'fixture-request' });
  const counts = () => ['machine_logs', 'provider_reservations', 'provider_reservation_events']
    .map(table => fixture.machine.db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n);
  const before = counts(), store = readStore(fixture);
  const native = providerReservations(store.machine, { activeOnly: true });
  assert.equal(native.length, 1);
  assert.equal(native[0].amountUnit, 'concurrent-launch');
  assert.equal(native[0].state, 'unknown');
  assert.equal(providerReservationUsage(store.machine, { provider: 'codex', account: 'primary' }).running, 1);
  const view = admissionView(store.machine.db);
  assert.equal(view.running, 1);
  assert.equal(view.unknown, 1);
  assert.equal(view.reservations[0].id, native[0].id);
  assert.equal(view.reservations[0].fence, native[0].fence);
  assert.equal(view.reservations[0].attemptId, native[0].attemptId);
  assert.equal(view.reservations[0].quota.observedAt, receipt().quota.observedAt);
  assert.equal(view.reservations[0].releasedAt, null);
  const response = await request(handleSystem, store, '/api/resources');
  assert.deepEqual(response.json.data.admission, view);
  const headResponse = await request(handleSystem, store, '/api/resources', { method: 'HEAD' });
  assert.equal(headResponse.status, 200);
  assert.equal(headResponse.body, null);
  assert.equal(store.machine.db.prepare('PRAGMA query_only').get().query_only, 1);
  assert.equal(store.machine.db.prepare('SELECT total_changes() AS n').get().n, 0);
  store.machine.close();
  assert.deepEqual(counts(), before);
  assert.equal(fixture.machine.db.prepare('PRAGMA user_version').get().user_version, MACHINE_VERSION);
  assert.equal(fs.existsSync(`${fixture.machineFile}.outbox.jsonl`), false);
}));

test('concurrent request scopes retain independent partial-read provenance and verified UUID/alias fanout', t => withLedger(t, async fixture => {
  const ledgerId = registerFixture(fixture);
  const store = fixture.track(openUiDb({ env: { ...process.env, STARCI_MACHINE_DB: fixture.machineFile } }));
  const failed = store.request(), successful = store.request();
  let complete;
  const resumed = new Promise(resolve => { complete = resolve; });
  const failure = (async () => {
    assert.equal(failed.forEachLedger(() => { throw Error('private filesystem detail'); })[0].error, 'READ_FAILED');
    await resumed;
    return failed.sourcesOf([{ db: 'fixture', rel: 'v_units' }]);
  })();
  const success = (async () => {
    assert.equal(successful.ledger('fixture').row.ledgerId, ledgerId);
    assert.equal(successful.ledger(ledgerId).db, successful.ledger('fixture').db);
    assert.equal(successful.forEachLedger(({ db }) => db.prepare('PRAGMA query_only').get().query_only)[0].result, 1);
    complete();
    return successful.sourcesOf([{ db: ledgerId, rel: 'v_units' }]);
  })();
  const [unavailable, available] = await Promise.all([failure, success]);
  assert.equal(unavailable[0].availability, 'unavailable');
  assert.equal(unavailable[0].code, 'READ_FAILED');
  assert.deepEqual([...failed.stale], ['fixture']);
  assert.equal(available[0].availability, 'available');
  assert.equal(available[0].ledgerId, ledgerId);
  assert.deepEqual([...successful.stale], []);
  assert.doesNotMatch(JSON.stringify(unavailable), /private filesystem detail/);
  const response = await request(contract, store.request(), '/api/contract');
  assert.equal(response.json.data.projects[0].ledgerId, ledgerId);
  assert.equal(response.json.data.projects[0].id, 'fixture');
  assert.equal(response.json.data.projects[0].availability, 'available');
  assert.equal(successful.ledger(ledgerId).db.prepare('SELECT total_changes() AS n').get().n, 0);
}));

test('missing and unsupported registered sources remain disclosed without paths, migrations or guessed zero health', t => withLedger(t, async fixture => {
  const ledgerId = registerFixture(fixture);
  fixture.machine.registerLedger({ ledgerId: '00000000-0000-4000-8000-000000000001', name: 'missing', repoRoot: `${fixture.repoRoot}-missing`, file: `${fixture.ledgerFile}.missing` });
  fixture.ledger.db.exec('PRAGMA user_version=999');
  const store = fixture.track(openUiDb({ env: { ...process.env, STARCI_MACHINE_DB: fixture.machineFile } }));
  const scope = store.request();
  const result = await request((req, res, db) => { bindProvenance(req, db); healthz(req, res, db); }, scope, '/healthz');
  assert.equal(result.status, 503);
  assert.equal(result.json.data.dbs.ledgers.fixture, false);
  assert.equal(result.json.data.dbs.ledgers.missing, false);
  const sources = result.json.meta.sources;
  assert.equal(sources.find(source => source.ledgerId === ledgerId).availability, 'unsupported');
  assert.equal(sources.find(source => source.name === 'missing').availability, 'missing');
  assert.doesNotMatch(result.body, /runtime\.sqlite|ledger-schema-refused|repo_root/);
  assert.equal(fixture.ledger.db.prepare('PRAGMA user_version').get().user_version, 999);
}));

test('UI observer actual NOTADB opening reports generic unavailable provenance without changing bytes or creating an outbox', t => withLedger(t, async fixture => {
  const file = path.join(fixture.machineHome, 'corrupt.sqlite'), bytes = Buffer.from('not a database: private UI observation fixture');
  fs.writeFileSync(file, bytes);
  const before = observerEvidence(fixture);
  const store = fixture.track(openUiDb({ env: { ...process.env, STARCI_MACHINE_DB: file } }));
  const response = await request(observedHealth, store.request(), '/healthz');
  assert.equal(response.status, 503);
  assert.equal(response.json.data.ok, false);
  assert.equal(response.json.data.dbs.machine, false);
  assert.ok(response.json.meta.sources.some(source => source.db === 'machine' && source.availability === 'unavailable' && source.code === 'DB_UNAVAILABLE'));
  assert.deepEqual(response.json.meta.stale, ['machine']);
  assert.doesNotMatch(response.body, /corrupt\.sqlite|private UI|machine-db-corrupt|quick_check/);
  store.close();
  assert.deepEqual(fs.readFileSync(file), bytes);
  assert.equal(fs.existsSync(`${file}.outbox.jsonl`), false);
  assert.deepEqual(observerEvidence(fixture), before);
}));

for (const stage of ['prepare', 'all']) {
  test(`UI observer persistent registry ${stage} corruption retains request-local failure without incident, schema or file writes`, t => withLedger(t, async fixture => {
    const ledgerId = registerFixture(fixture), before = observerEvidence(fixture);
    const store = fixture.track(openUiDb({ env: { ...process.env, STARCI_MACHINE_DB: fixture.machineFile } }));
    const failed = store.request(), fault = registryCorruption(t, { stage });
    assert.deepEqual(failed.projects(), []);
    assert.equal(fault.attempts(), 4);
    assert.equal(failed.sourcesOf([{ db: 'machine', rel: 'ledgers' }])[0].code, 'READ_FAILED');
    fault.restore();
    const unavailable = await request(observedHealth, failed, '/healthz');
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.json.data.dbs.machine, false);
    assert.equal(unavailable.json.data.dbs.ledgers.fixture, true);
    assert.ok(unavailable.json.meta.sources.some(source => source.db === 'machine' && source.availability === 'unavailable' && source.code === 'READ_FAILED'));
    assert.doesNotMatch(unavailable.body, /private registry|machine-db-corrupt|machine\.sqlite|quick_check/);
    const healthy = store.request(), available = await request(observedHealth, healthy, '/healthz');
    assert.equal(available.status, 200);
    assert.equal(available.json.data.ok, true);
    assert.equal(healthy.ledger('fixture').row.ledgerId, ledgerId);
    assert.equal(healthy.ledger(ledgerId).db, healthy.ledger('fixture').db);
    assert.deepEqual([...failed.stale], ['machine']);
    assert.deepEqual([...healthy.stale], []);
    assert.equal(healthy.machine.db.prepare('SELECT total_changes() AS n').get().n, 0);
    store.close();
    assert.equal(fs.existsSync(`${fixture.machineFile}.outbox.jsonl`), false);
    assert.deepEqual(observerEvidence(fixture), before);
  }));
}

test('UI observer transient registry corruption returns verified UUID data and closes without persisting recovery', t => withLedger(t, async fixture => {
  const ledgerId = registerFixture(fixture), before = observerEvidence(fixture);
  const store = fixture.track(openUiDb({ env: { ...process.env, STARCI_MACHINE_DB: fixture.machineFile } }));
  const scope = store.request(), fault = registryCorruption(t, { failures: 1 });
  const response = await request(observedHealth, scope, '/healthz');
  assert.equal(response.status, 200);
  assert.equal(response.json.data.dbs.ledgers.fixture, true);
  assert.equal(fault.attempts(), 2);
  assert.equal(scope.projects()[0].ledgerId, ledgerId);
  assert.equal(scope.ledger(ledgerId).db, scope.ledger('fixture').db);
  assert.equal(scope.machine.readOnly, true);
  assert.equal(scope.machine.db.prepare('PRAGMA query_only').get().query_only, 1);
  assert.equal(scope.machine.db.prepare('SELECT total_changes() AS n').get().n, 0);
  assert.equal(scope.ledger(ledgerId).db.prepare('SELECT total_changes() AS n').get().n, 0);
  assert.equal(scope.machine.recovered.length, 1);
  assert.equal(scope.machine.recovered[0].retries, 1);
  assert.match(scope.machine.recovered[0].where, /^all SELECT \* FROM ledgers/);
  assert.deepEqual(response.json.meta.stale, []);
  fault.restore();
  store.close();
  assert.equal(fs.existsSync(`${fixture.machineFile}.outbox.jsonl`), false);
  assert.deepEqual(observerEvidence(fixture), before);
}));

test('source read clocks preserve 304 while source evidence time and availability invalidate it', async () => {
  const source = { db: 'fixture', rel: 'events', ledgerId: 'ledger-uuid', at: stamp, availability: 'available' };
  const first = await request((req, res) => sendJson(req, res, { value: 1 }, { sources: [{ ...source, readAt: stamp + 1 }] }), null, '/');
  const unchanged = await request((req, res) => sendJson(req, res, { value: 1 }, { sources: [{ ...source, readAt: stamp + 999 }] }), null, '/', { etag: first.headers.ETag });
  assert.equal(unchanged.status, 304);
  for (const changed of [{ ...source, at: stamp + 1 }, { ...source, availability: 'unavailable', code: 'READ_FAILED' }]) {
    const response = await request((req, res) => sendJson(req, res, { value: 1 }, { sources: [changed] }), null, '/', { etag: first.headers.ETag });
    assert.equal(response.status, 200);
  }
});

test('search resolves actual dispatch and indexed artifact SHA, preserves duplicate workflow Unit scope and unsupported targets', t => withLedger(t, async fixture => {
  seedWorkflow(fixture.ledger, { id: 'wf-one', jobs: [{ jobId: 'native-job', unitId: 'shared-unit', opId: 'backend.implement', status: 'running' }] });
  seedWorkflow(fixture.ledger, { id: 'wf-two', jobs: [{ jobId: 'other-job', unitId: 'shared-unit', opId: 'backend.implement', status: 'failed', result: { verdict: 'fail' } }] });
  const row = { name: 'fixture', ledgerId: 'ledger-uuid' }, db = fixture.ledger.db;
  const job = ledgerSearchHit(db, row, { kind: 'job', id: 'native-job', workflow_id: 'wf-one', title: 'Native job' });
  assert.equal(job.matched.id, 'native-job');
  assert.equal(job.ref.id, '1');
  assert.equal(job.href, '#/a/fixture/1');
  const dispatch = db.prepare('SELECT dispatch_id FROM op_attempts WHERE attempt_id=1').get().dispatch_id;
  assert.equal(ledgerSearchHit(db, row, { kind: 'dispatch', id: dispatch, workflow_id: 'wf-one' }).ref.id, '1');
  const unitOne = ledgerSearchHit(db, row, { kind: 'unit', id: 'shared-unit', workflow_id: 'wf-one' });
  const unitTwo = ledgerSearchHit(db, row, { kind: 'unit', id: 'shared-unit', workflow_id: 'wf-two' });
  assert.notDeepEqual(unitOne.matched, unitTwo.matched);
  assert.notEqual(unitOne.href, unitTwo.href);
  const artifactSha = 'c'.repeat(64);
  fixture.ledger.transaction(inner => {
    inner.prepare('INSERT INTO blobs(sha256,bytes,media_type,file_uri,created_at) VALUES(?,?,?,?,?)').run(artifactSha, 1, 'text/plain', 'fixture-blob-not-read', stamp);
    inner.prepare('INSERT INTO job_artifacts(workflow_id,attempt_id,role,kind,name,sha256,bytes,media_type,origin,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
      .run('wf-one', 1, 'other', 'file', 'artifact-proof', artifactSha, 1, 'text/plain', 'op', stamp);
  });
  const artifact = ledgerSearchHit(db, row, { kind: 'artifact', id: '1', workflow_id: 'wf-one', title: 'artifact-proof' });
  assert.equal(artifact.matched.id, '1');
  assert.equal(artifact.ref.id, artifactSha);
  assert.equal(artifact.href, `/api/blob/${artifactSha}`);
  assert.equal(ledgerSearchHit(db, row, { kind: 'artifact', id: '1', workflow_id: 'wf-two' }).ref, null);
  assert.equal(machineSearchHit(fixture.machine.db, { kind: 'unrecognized', id: 'native-id' }).href, null);
  const result = await request(search, readStore(fixture), '/api/search?q=shared-unit');
  assert.equal(result.json.data.hits.filter(hit => hit.matched.kind === 'unit').length, 2);
  assert.equal(result.json.data.limit, 40);
  assert.equal(result.json.data.truncated, false);
}));

test('workflow and Attempt invalidations accept ledger UUID aliases and include machine receipt changes', () => {
  const projects = [{ name: 'fixture', ledgerId: 'ledger-uuid' }], store = { projects: () => projects };
  assert.deepEqual(topicsOf(store, new URL('http://fixture/api/live?topics=wf:ledger-uuid:one,attempt:fixture:1')), ['wf:ledger-uuid:one', 'attempt:fixture:1']);
  for (const topic of ['wf:ledger-uuid:one', 'attempt:fixture:1']) {
    assert.equal(related(topic, 'fixture:attempts', projects), true);
    assert.equal(related(topic, 'machine:data_version', projects), true);
    assert.equal(related(topic, 'machine:provider_reservations', projects), true);
    assert.equal(related(topic, 'other:attempts', projects), false);
  }
  assert.equal(topicsOf(store, new URL('http://fixture/api/live?topics=wf:unknown:one')), null);
});

test('identical machine and ledger DI IDs retain native namespaces and suppress credential summaries', t => withLedger(t, async fixture => {
  const ledgerId = registerFixture(fixture);
  seedWorkflow(fixture.ledger, { id: 'wf' });
  const di = ['di-same', 'credential:entity:error:head', '{}', 'credential-missing', 'owner', 'raw-credential-fixture', 'open', 'fixture', stamp, '{}'];
  fixture.machine.transaction(db => db.prepare('INSERT INTO sup_decision_items(di_id,idempotency_key,key_parts_json,kind,decider,summary,status,opened_by,opened_at,payload_json) VALUES(?,?,?,?,?,?,?,?,?,?)').run(...di));
  fixture.ledger.transaction(db => db.prepare('INSERT INTO decision_items(di_id,idempotency_key,key_parts_json,kind,decider,summary,status,opened_by,opened_at,payload_json,workflow_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(...di, 'wf'));
  const native = { id: 'di-same', title: 'raw-credential-fixture' };
  const machine = machineSearchHit(fixture.machine.db, { ...native, kind: 'sup-decision' });
  const ledger = ledgerSearchHit(fixture.ledger.db, { name: 'fixture', ledgerId }, { ...native, kind: 'decision', workflow_id: 'wf' });
  assert.equal(machine.ref.store, 'machine');
  assert.equal(ledger.ref.store, 'ledger');
  assert.equal(ledger.ref.ledgerId, ledgerId);
  assert.notEqual(machine.href, ledger.href);
  assert.match(ledger.href, /store=ledger&ledger=/);
  assert.equal(machine.title, 'credential-missing');
  assert.equal(ledger.title, 'credential-missing');
  const response = await request(search, readStore(fixture), '/api/search?q=di-same');
  assert.equal(response.json.data.hits.filter(hit => hit.kind === 'di').length, 2);
  assert.doesNotMatch(response.body, /raw-credential-fixture/);
}));

test('Overview attention preserves actual DI content, lifecycle, decider and colliding native scopes without read effects', t => withLedger(t, async fixture => {
  const ledgerId = registerFixture(fixture), now = Date.now(), openedAt = now - 60_000, dueAt = now - 1;
  const otherRoot = path.join(fixture.root, 'other-repo'), otherFile = path.join(fixture.root, 'other-runtime.sqlite');
  fs.mkdirSync(path.join(otherRoot, '.starciwork'), { recursive: true });
  const other = fixture.track(openLedger({ file: otherFile, repoRoot: otherRoot }));
  fixture.machine.registerLedger({ ledgerId: other.ledgerId, name: 'other', repoRoot: otherRoot, file: otherFile });
  seedWorkflow(fixture.ledger, { id: 'wf-one' });
  seedWorkflow(other, { id: 'wf-two' });
  const insert = `INSERT INTO decision_items(di_id,idempotency_key,key_parts_json,kind,decider,summary,status,opened_by,opened_at,due_at,payload_json,workflow_id)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`;
  fixture.ledger.transaction(db => {
    db.prepare(insert).run('di-shared', 'build:entity:error:head', '{}', 'settle-nongreen', 'kernel', 'Resolve the build evidence mismatch.', 'claimed', 'fixture', openedAt, dueAt, '{}', 'wf-one');
    db.prepare(insert).run('di-credential', 'credential:entity:error:head', '{}', 'credential-missing', 'owner', 'opaque-sensitive-ledger-summary', 'open', 'fixture', openedAt, dueAt, '{}', 'wf-one');
  });
  other.transaction(db => db.prepare(insert).run('di-shared', 'rollout:entity:error:head', '{}', 'worker-question', 'owner', 'Choose the rollout boundary.', 'escalated', 'fixture', openedAt, dueAt, '{}', 'wf-two'));
  fixture.machine.transaction(db => {
    const machineInsert = `INSERT INTO sup_decision_items(di_id,idempotency_key,key_parts_json,kind,decider,summary,status,opened_by,opened_at,due_at,payload_json,ledger_id,workflow_id)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    db.prepare(machineInsert).run('di-shared', 'host:entity:error:head', '{}', 'runtime-defect', 'owner', 'Approve host readiness recovery.', 'open', 'fixture', openedAt, dueAt, '{}', ledgerId, 'wf-one');
    db.prepare(machineInsert).run('di-credential', 'credential:entity:error:head', '{}', 'credential-missing', 'supervisor', 'opaque-sensitive-machine-summary', 'claimed', 'fixture', openedAt, dueAt, '{}', null, null);
    db.prepare('INSERT INTO invariant_violations(code,severity,entity,ledger_id,workflow_id,violated_at) VALUES(?,?,?,?,?,?)')
      .run('READINESS_UNKNOWN', 'warn', 'fixture', ledgerId, 'wf-one', openedAt);
  });
  const store = fixture.track(openUiDb({ env: { ...process.env, STARCI_MACHINE_DB: fixture.machineFile } }));
  const scope = store.request(), before = observerEvidence(fixture);
  const response = await request(handleWork, scope, '/api/workers?project=fixture');
  assert.equal(response.status, 200);
  const attention = response.json.data.attention, shared = attention.filter(item => item.ref.id === 'di-shared');
  assert.equal(shared.length, 3);
  assert.deepEqual(new Set(shared.map(item => item.detail.summary)), new Set(['Resolve the build evidence mismatch.', 'Choose the rollout boundary.', 'Approve host readiness recovery.']));
  assert.deepEqual(new Set(shared.map(item => item.detail.status)), new Set(['claimed', 'escalated', 'open']));
  assert.equal(new Set(shared.map(item => item.ref.href)).size, 3);
  for (const item of shared) {
    const target = new URL(item.ref.href.slice(1), 'http://fixture');
    assert.equal(target.searchParams.get('store'), item.scope.store);
    assert.equal(target.searchParams.get('ledger'), item.scope.ledgerId);
    assert.equal(target.searchParams.get('project'), item.detail.project);
    assert.equal(item.ref.store, item.scope.store);
    assert.equal(item.ref.ledgerId, item.scope.ledgerId);
    assert.equal(item.who, item.scope.decider);
    const detail = await request(handleDecisions, scope, `/api/decisions/${item.ref.id}?${target.searchParams}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.json.data.summary, item.detail.summary);
    assert.equal(detail.json.data.status, item.detail.status);
    assert.equal(detail.json.data.wf, item.detail.workflow);
    assert.equal(detail.json.data.decider, item.who);
  }
  const credentialRows = attention.filter(item => item.ref.id === 'di-credential');
  assert.equal(credentialRows.length, 2);
  assert.ok(credentialRows.every(item => item.detail.summary === 'Credential content hidden.'));
  assert.doesNotMatch(response.body, /opaque-sensitive-(?:ledger|machine)-summary/);
  const violation = attention.find(item => item.ref.kind === 'violation');
  assert.equal(violation.reason.code, 'READINESS_UNKNOWN');
  assert.equal(violation.who, 'controller');
  assert.equal(violation.detail, undefined);
  assert.equal(response.json.data.counts.ownerDecisions, 2);
  assert.equal(response.json.data.counts.violationsOpen, 1);
  assert.equal(response.json.data.coverage.workflows.registered, 2);
  for (const workflow of response.json.data.workflows) {
    const item = attention.find(item => item.ref.store === 'ledger' && item.ref.ledgerId === workflow.ledgerId && item.ref.id === workflow.onIt.ref.id);
    assert.ok(item);
    assert.deepEqual(workflow.onIt.ref, item.ref);
  }
  const workflowDetail = await request(handleWork, scope, '/api/workflows/fixture/wf-one');
  assert.doesNotMatch(workflowDetail.body, /opaque-sensitive-(?:ledger|machine)-summary/);
  assert.equal(workflowDetail.json.data.blockedBy.find(item => item.ref.id === 'di-shared').reason.raw, 'Resolve the build evidence mismatch.');
  assert.equal(workflowDetail.json.data.blockedBy.find(item => item.ref.id === 'di-credential').reason.raw, 'Credential content hidden.');
  for (const blocker of workflowDetail.json.data.blockedBy.filter(item => item.ref.kind === 'di')) {
    assert.equal(blocker.ref.store, 'ledger');
    assert.equal(blocker.ref.ledgerId, ledgerId);
    assert.equal(new URL(blocker.ref.href.slice(1), 'http://fixture').searchParams.get('ledger'), ledgerId);
  }
  const headResponse = await request(handleWork, scope, '/api/workers', { method: 'HEAD' });
  assert.equal(headResponse.status, 200);
  assert.equal(headResponse.body, null);
  assert.equal(scope.machine.db.prepare('SELECT total_changes() AS n').get().n, 0);
  for (const row of scope.projects()) assert.equal(scope.ledger(row.ledgerId).db.prepare('SELECT total_changes() AS n').get().n, 0);
  assert.deepEqual(observerEvidence(fixture), before);
}));

test('Overview attention keeps native severity separate from an escalated Decision Item deadline', t => withLedger(t, async fixture => {
  registerFixture(fixture);
  seedWorkflow(fixture.ledger, { id: 'wf' });
  const now = Date.now(), fields = ['di-future', 'future:entity:error:head', '{}', 'runtime-defect', 'supervisor', 'Escalation needs review.', 'escalated', 'fixture', now - 60_000, now + 60_000, '{}', 2];
  fixture.machine.transaction(db => db.prepare(`INSERT INTO sup_decision_items(di_id,idempotency_key,key_parts_json,kind,decider,summary,status,opened_by,opened_at,due_at,payload_json,escalations)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(...fields));
  fixture.ledger.transaction(db => db.prepare(`INSERT INTO decision_items(di_id,idempotency_key,key_parts_json,kind,decider,summary,status,opened_by,opened_at,due_at,payload_json,escalations,workflow_id)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(...fields, 'wf'));
  const store = readStore(fixture), prepare = DatabaseSync.prototype.prepare;
  // Inject native severity at the read boundary while retaining verified schema and recorded dates.
  t.mock.method(DatabaseSync.prototype, 'prepare', function (sql, ...args) {
    const statement = prepare.call(this, sql, ...args);
    if (!sql.includes('v_open_sup_decisions')) return statement;
    return new Proxy(statement, { get(target, property) {
      const value = Reflect.get(target, property, target);
      if (property === 'all') return (...params) => value.apply(target, params).map(row => row.di_id === 'di-future' ? { ...row, ui: 'bad' } : row);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
  });
  const response = await request(handleWork, store, '/api/workers');
  const items = response.json.data.attention;
  assert.equal(items.length, 2);
  assert.ok(items.every(item => item.ui === 'bad'));
  assert.ok(items.every(item => item.detail.status === 'escalated'));
  assert.ok(items.every(item => item.reason.code === 'DECISION_OPEN'));
  assert.equal(new Set(items.map(item => item.scope.store)).size, 2);
}));

test('Overview attention remains a host-wide capped preview while owner totals include every open item', t => withLedger(t, async fixture => {
  registerFixture(fixture);
  seedWorkflow(fixture.ledger, { id: 'wf' });
  const now = Date.now();
  fixture.ledger.transaction(db => {
    const insert = db.prepare(`INSERT INTO decision_items(di_id,idempotency_key,key_parts_json,kind,decider,summary,status,opened_by,opened_at,due_at,payload_json,workflow_id)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (let i = 0; i < 12; i++) insert.run(`di-preview-${i}`, `question:entity:error:head-${i}`, '{}', 'worker-question', 'owner', `Question ${i}`, 'open', 'fixture', now - 60_000 + i, now - 1, '{}', 'wf');
  });
  const response = await request(handleWork, readStore(fixture), '/api/workers?project=unrelated');
  assert.equal(response.status, 200);
  assert.equal(response.json.data.attention.length, 10);
  assert.equal(response.json.data.counts.ownerDecisions, 12);
  assert.deepEqual(response.json.data.attention.map(item => item.ref.id), Array.from({ length: 10 }, (_, i) => `di-preview-${i}`));
}));
