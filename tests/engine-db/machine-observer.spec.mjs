import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { openMachine, openMachineReader, openMachineObserver, MACHINE_VERSION } from '../../engine/db/machine.mjs';

const QUERY = "SELECT value FROM machine_meta WHERE key='observer-sentinel'";
const READ_METHODS = ['budgets', 'hostLeases', 'latestMetrics', 'listLedgers', 'logs', 'poolBackoff', 'providerHealth', 'quotas', 'seats', 'services', 'throttleState'];
const outboxOf = (file) => `${file}.outbox.jsonl`;
const temporary = (t, close = () => {}) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-machine-observer-'));
  t.after(() => { close(); fs.rmSync(directory, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }); });
  return directory;
};
const fixture = (t, version = MACHINE_VERSION) => {
  let writer;
  const directory = temporary(t, () => writer?.close()), file = path.join(directory, 'machine.sqlite');
  const options = { file, env: { ...process.env, STARCI_TEST_MACHINE_FILE: file } };
  writer = openMachine(options);
  writer.db.prepare('INSERT INTO machine_meta(key,value) VALUES(?,?)').run('observer-sentinel', 'preserved');
  writer.registerLedger({ ledgerId: 'observer-fixture', name: 'observer-fixture', repoRoot: directory, file: path.join(directory, 'runtime.sqlite') });
  if (version !== MACHINE_VERSION) writer.db.exec('PRAGMA user_version='+version);
  return { directory, file, options, writer };
};

function snapshot({ directory, file }) {
  const db = new DatabaseSync(file, { readOnly: true });
  let database;
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    database = {
      version: db.prepare('PRAGMA user_version').get().user_version,
      journal: db.prepare('PRAGMA journal_mode').get().journal_mode,
      meta: db.prepare('SELECT * FROM machine_meta ORDER BY key').all(),
      counts: tables.map(({ name }) => [name, db.prepare(`SELECT count(*) n FROM ${JSON.stringify(name)}`).get().n]),
      logs: db.prepare('SELECT * FROM machine_logs ORDER BY seq').all(),
    };
  } finally { db.close(); }
  const files = fs.readdirSync(directory).sort();
  // SQLite's shared-memory lock bytes are volatile coordination; persistent DB, WAL and all other bytes must agree.
  const bytes = files.filter((name) => name !== `${path.basename(file)}-shm`).map((name) =>
    [name, crypto.createHash('sha256').update(fs.readFileSync(path.join(directory, name))).digest('hex')]);
  return { database, files, bytes };
}

function corruption(t, { failures = Infinity, stage = 'get' } = {}) {
  const original = DatabaseSync.prototype.prepare;
  let attempts = 0;
  const fail = () => { if (attempts++ < failures) throw Object.assign(Error('database disk image is malformed'), { errcode: 11 }); };
  t.mock.method(DatabaseSync.prototype, 'prepare', function (sql, ...args) {
    if (sql === QUERY && stage === 'prepare') fail();
    const statement = original.call(this, sql, ...args);
    if (sql !== QUERY || stage !== 'get') return statement;
    return new Proxy(statement, {
      get(target, property) {
        const value = Reflect.get(target, property, target);
        if (property === 'get') return (...params) => { fail(); return value.apply(target, params); };
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  });
  return () => attempts;
}

function diagnostics(t) {
  const chunks = [], write = process.stderr.write;
  t.mock.method(process.stderr, 'write', function (chunk, ...args) { chunks.push(String(chunk)); return write.call(this, chunk, ...args); });
  return () => chunks.join('');
}

const persistentError = (fn, where) => {
  let error;
  assert.throws(fn, (caught) => { error = caught; return caught.code === 'STARCI_MACHINE_CORRUPT'; });
  assert.match(error.where, where);
  assert.equal(error.retries, 3);
  assert.deepEqual(error.quickCheck, ['ok']);
  return error;
};

test('an absent observer store remains absent without creating directories', (t) => {
  const directory = temporary(t), file = path.join(directory, 'absent', 'machine.sqlite');
  assert.equal(openMachineObserver({ file }), null);
  assert.deepEqual(fs.readdirSync(directory), []);
});

for (const version of [MACHINE_VERSION]) {
  test(`observer validates machine v${version}, reads registry and exposes no mutation API`, (t) => {
    const current = fixture(t, version), before = snapshot(current), observer = openMachineObserver(current.options);
    try {
      assert.equal(observer.readOnly, true);
      assert.equal(observer.file, current.file);
      assert.equal(observer.path, current.file);
      assert.equal(observer.schema, 'starci/machine@1');
      assert.equal(observer.db.prepare('PRAGMA query_only').get().query_only, 1);
      assert.equal(observer.db.prepare('SELECT total_changes() n').get().n, 0);
      assert.equal(observer.db.prepare(QUERY).get().value, 'preserved');
      assert.equal(observer.listLedgers()[0].ledgerId, 'observer-fixture');
      assert.deepEqual(Object.keys(observer).filter((key) => typeof observer[key] === 'function').sort(), [...READ_METHODS, 'close'].sort());
      assert.throws(() => observer.db.exec("INSERT INTO machine_meta(key,value) VALUES('forbidden','write')"), /read.?only/i);
    } finally { observer.close(); }
    assert.deepEqual(snapshot(current), before);
    assert.equal(fs.existsSync(outboxOf(current.file)), false);
  });
}

test('all typed UI observation reads return seeded operational projections without persistent effects', (t) => {
  const current = fixture(t), { writer } = current, at = Date.now();
  writer.setService({ name: 'observer-service', kind: 'http', state: 'healthy', probe: { ok: true } });
  writer.upsertSeat({ seatId: 'observer-seat', role: 'supervisor', state: 'live', agent: 'codex', model: 'fixture-model' });
  writer.setProviderHealth({ provider: 'codex', status: 'healthy', detail: { observed: true } });
  writer.log({ actor: 'reconciler', kind: 'observer.read', msg: 'seeded compatibility observation', data: { fixture: true } });
  writer.recordMetrics({ kind: 'progress', ledgerId: 'observer-fixture', workflowId: 'observer-workflow', data: { observed: true } });
  writer.setThrottle({ mode: 'normal', writer: 'observer-fixture', priorities: { foreground: 1 } });
  writer.setPoolBackoff({ pool: 'observer-pool', untilAt: at + 60_000, strikes: 1, reason: 'fixture' });
  writer.setQuota({ provider: 'codex', window: 'fixture', used: 1, limitValue: 10, resetAt: at + 60_000, source: 'fixture' });
  writer.insert('host_resources', { resource_key: 'observer-resource', capacity: 2 });
  writer.insert('host_leases', { resource_key: 'observer-resource', token: 'observer-token', ledger_id: 'observer-fixture',
    workflow_id: 'observer-workflow', job_id: 'observer-job', units: 1, acquired_at: at, expires_at: at + 60_000 });
  writer.setBudget({ scopeKey: 'observer-budget', limitValue: 10, window: 'fixture' });
  const before = snapshot(current), observer = openMachineObserver(current.options), reader = openMachineReader(current.options);
  const argumentsFor = {
    latestMetrics: [{ kind: 'progress', ledgerId: 'observer-fixture', workflowId: 'observer-workflow' }],
    listLedgers: [{ state: 'active' }], logs: [{ actor: 'reconciler', kind: 'observer.*', search: 'compatibility', limit: 10 }],
  };
  try {
    for (const name of READ_METHODS) {
      const args = argumentsFor[name] ?? [], actual = observer[name](...args);
      assert.deepEqual(actual, reader[name](...args), name);
      if (Array.isArray(actual)) assert.equal(actual.length, 1, `${name} reads the seeded row`);
      else assert.ok(actual, `${name} reads the seeded row`);
    }
    assert.deepEqual(observer.poolBackoff('observer-pool'), reader.poolBackoff('observer-pool'));
    assert.equal(observer.latestMetrics({ kind: 'missing' }), null);
    assert.deepEqual(observer.logs({ actor: 'reconciler', kind: 'missing' }), []);
    assert.equal(observer.services()[0].lastProbe.ok, true);
    assert.equal(observer.throttleState().priorities.foreground, 1);
    assert.equal(observer.db.prepare('SELECT total_changes() n').get().n, 0);
  } finally { observer.close(); reader.close(); }
  assert.deepEqual(snapshot(current), before);
  assert.equal(fs.existsSync(outboxOf(current.file)), false);
});

test('observer refuses an unsupported schema version without changing its data', (t) => {
  const current = fixture(t), raw = new DatabaseSync(current.file);
  raw.exec('PRAGMA user_version=77'); raw.close();
  const before = snapshot(current);
  assert.throws(() => openMachineObserver(current.options), (error) => error.code === 'STARCI_MACHINE_SCHEMA_OLD');
  assert.deepEqual(snapshot(current), before);
});

test('actual NOTADB opening fails visibly without persisting an observer incident', (t) => {
  const directory = temporary(t), file = path.join(directory, 'machine.sqlite'), bytes = Buffer.from('not a database: preserve these bytes');
  fs.writeFileSync(file, bytes);
  const output = diagnostics(t);
  assert.throws(() => openMachineObserver({ file }), (error) =>
    error.code === 'STARCI_MACHINE_CORRUPT' && error.where === 'open' && error.retries === 2 && error.quickCheck[0].startsWith('quick_check failed:'));
  assert.match(output(), /INCIDENT.*machine-db-corrupt/);
  assert.deepEqual(fs.readFileSync(file), bytes);
  assert.deepEqual(fs.readdirSync(directory), ['machine.sqlite']);
});

for (const stage of ['prepare', 'get']) {
  test(`persistent observer ${stage} corruption preserves database and filesystem`, (t) => {
    const current = fixture(t), before = snapshot(current), observer = openMachineObserver(current.options);
    const attempts = corruption(t, { stage }), output = diagnostics(t);
    try { persistentError(() => observer.db.prepare(QUERY).get(), new RegExp(`^${stage} `)); }
    finally { observer.close(); }
    assert.equal(attempts(), 4);
    assert.match(output(), /INCIDENT.*machine-db-corrupt/);
    assert.deepEqual(snapshot(current), before);
    assert.equal(fs.existsSync(outboxOf(current.file)), false);
  });
}

test('transient observer corruption reopens, returns real data and closes without a recovery write', (t) => {
  const current = fixture(t), before = snapshot(current), observer = openMachineObserver(current.options);
  const attempts = corruption(t, { failures: 1 }), output = diagnostics(t);
  try {
    assert.equal(observer.db.prepare(QUERY).get().value, 'preserved');
    assert.equal(attempts(), 2);
    assert.equal(observer.recovered.length, 1);
    assert.equal(observer.recovered[0].retries, 1);
    assert.match(observer.recovered[0].where, /^get /);
    assert.match(output(), /transient SQLITE_CORRUPT recovered/);
    assert.equal(observer.db.prepare('SELECT total_changes() n').get().n, 0);
  } finally { observer.close(); }
  assert.deepEqual(snapshot(current), before);
  assert.equal(fs.existsSync(outboxOf(current.file)), false);
});

test('operational reader persistent corruption still records an incident on the real store', (t) => {
  const current = fixture(t), before = snapshot(current), reader = openMachineReader(current.options);
  corruption(t);
  try { persistentError(() => reader.db.prepare(QUERY).get(), /^get /); }
  finally { reader.close(); }
  const after = snapshot(current);
  assert.equal(after.database.logs.length, before.database.logs.length + 1);
  assert.equal(after.database.logs.at(-1).kind, 'machine-db.corrupt');
  assert.equal(after.database.logs.at(-1).level, 'error');
  assert.equal(after.database.version, before.database.version);
  assert.deepEqual(after.database.meta, before.database.meta);
  assert.equal(fs.existsSync(outboxOf(current.file)), false);
});

test('operational reader recovered close still defers one recovery notice', (t) => {
  const current = fixture(t), before = snapshot(current), reader = openMachineReader(current.options);
  corruption(t, { failures: 1 });
  assert.equal(reader.db.prepare(QUERY).get().value, 'preserved');
  assert.equal(reader.recovered.length, 1);
  reader.close(); reader.close();
  const notices = fs.readFileSync(outboxOf(current.file), 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(notices.length, 1);
  assert.equal(notices[0].op, 'log');
  assert.equal(notices[0].args[0][0].kind, 'machine-db.corrupt-recovered');
  assert.deepEqual(snapshot(current).database, before.database);
});

test('operational reader actual NOTADB opening still defers its persistent incident', (t) => {
  const directory = temporary(t), file = path.join(directory, 'machine.sqlite'), bytes = Buffer.from('not a database: operational incident');
  fs.writeFileSync(file, bytes);
  assert.throws(() => openMachineReader({ file }), (error) => error.code === 'STARCI_MACHINE_CORRUPT' && typeof error.deferred === 'string');
  assert.deepEqual(fs.readFileSync(file), bytes);
  const notice = JSON.parse(fs.readFileSync(outboxOf(file), 'utf8').trim());
  assert.equal(notice.op, 'log');
  assert.equal(notice.args[0][0].kind, 'machine-db.corrupt');
});

test('observer refuses retired identities without persistent writes or outbox', t => {
  for (const version of [1, 2]) {
    const current = fixture(t, version), before = snapshot(current);
    assert.throws(() => openMachineObserver(current.options), /machine-schema-old/);
    assert.deepEqual(snapshot(current), before);
    assert.equal(fs.existsSync(outboxOf(current.file)), false);
  }
});
