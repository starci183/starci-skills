import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { openMachine, openMachineReader, MACHINE_VERSION } from '../../engine/db/machine.mjs';
import { providerBudgetUsage } from '../../scripts/agent/provider-budget.mjs';

const fixture = t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-provider-schema-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const file = path.join(directory, 'machine.sqlite');
  return { directory, file, env: { ...process.env, STARCI_TEST_MACHINE_FILE: file } };
};
const persistent = options => fs.readdirSync(options.directory).filter(name => !name.endsWith('-shm')).sort()
  .map(name => [name, createHash('sha256').update(fs.readFileSync(path.join(options.directory, name))).digest('hex')]);
const current = t => { const options = fixture(t); openMachine(options).close(); return options; };

test('current reservation readers observe zero use and cannot write', t => {
  const options = fixture(t), writer = openMachine(options);
  try {
    // Hold the real writer so auxiliary-file lifecycle cannot masquerade as a reader mutation.
    assert.equal(fs.existsSync(options.file+'-wal'), true);
    const before = persistent(options), reader = openMachineReader(options);
    try {
      assert.equal(reader.db.prepare('PRAGMA user_version').get().user_version, MACHINE_VERSION);
      assert.equal(reader.db.prepare('PRAGMA query_only').get().query_only, 1);
      assert.deepEqual(reader.providerReservations(), []);
      assert.equal(providerBudgetUsage('codex', 'a', options).observed, true);
      assert.equal(providerBudgetUsage('codex', 'a', options).running, 0);
      assert.throws(() => reader.reserveProvider({ provider: 'codex', account: 'a', attemptId: 'x', role: 'worker', model: 'sol', maxParallel: 1 }), /read.?only/i);
      assert.equal(reader.db.prepare('SELECT total_changes() n').get().n, 0);
    } finally { reader.close(); }
    assert.deepEqual(persistent(options), before);
  } finally { writer.close(); }
});

test('missing current provider tables/index and removed CHECK refuse before persistent effects', t => {
  const mutations = [
    raw => raw.exec('DROP TABLE provider_reservation_events; DROP TABLE provider_reservations;'),
    raw => raw.exec('DROP INDEX provider_reservations_active;'),
    raw => {
      const ddl = name => raw.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(name).sql;
      const table = ddl('provider_reservations'), index = ddl('provider_reservations_active'), events = ddl('provider_reservation_events');
      assert.match(table, /CHECK\(slots=1\)/);
      raw.exec('DROP TABLE provider_reservation_events; DROP TABLE provider_reservations;');
      raw.exec(table.replace('CHECK(slots=1)', '')+';'+index+';'+events+';');
    },
  ];
  for (const mutate of mutations) {
    const options = current(t), raw = new DatabaseSync(options.file);
    try { mutate(raw); } finally { raw.close(); }
    const before = persistent(options);
    assert.throws(() => openMachineReader(options), /machine-schema-old.*missing or changed/);
    assert.throws(() => openMachine(options), /machine-schema-old.*missing or changed/);
    assert.deepEqual(persistent(options), before);
  }
});

test('a failed fresh init rolls back every table, metadata, journal and version', t => {
  const options = fixture(t), prepare = DatabaseSync.prototype.prepare;
  let ddlApplied = false;
  const mocked = t.mock.method(DatabaseSync.prototype, 'prepare', function (sql, ...args) {
    if (sql.startsWith('INSERT INTO schema_migrations(')) {
      ddlApplied = Boolean(prepare.call(this, "SELECT 1 FROM sqlite_master WHERE name='provider_reservations'").get());
      throw Error('fixture current-init journal fault');
    }
    return prepare.call(this, sql, ...args);
  });
  try { assert.throws(() => openMachine(options), /fixture current-init journal fault/); }
  finally { mocked.mock.restore(); }
  assert.equal(ddlApplied, true, 'failure follows real current DDL');
  const check = new DatabaseSync(options.file, { readOnly: true });
  try {
    assert.equal(check.prepare('PRAGMA user_version').get().user_version, 0);
    assert.equal(check.prepare("SELECT count(*) n FROM sqlite_master WHERE name NOT GLOB 'sqlite_*'").get().n, 0);
  } finally { check.close(); }
  openMachine(options).close();
});

test('retired, foreign, future and unversioned populated stores refuse without changing data', t => {
  for (const identity of [0, 1, 2, 77, 'foreign']) {
    const options = current(t), raw = new DatabaseSync(options.file);
    try {
      raw.prepare("INSERT INTO machine_meta VALUES('test-preserved','live-host-data')").run();
      if (identity === 'foreign') raw.prepare("UPDATE machine_meta SET value='foreign/schema@1' WHERE key='schema'").run();
      else raw.exec('PRAGMA user_version='+identity);
      raw.exec('PRAGMA journal_mode=DELETE;');
    } finally { raw.close(); }
    const before = persistent(options);
    assert.throws(() => openMachine(options), /machine-schema-old/);
    assert.throws(() => openMachineReader(options), /machine-schema-old/);
    assert.deepEqual(persistent(options), before, 'refusal cannot switch journal mode or write facts');
    const check = new DatabaseSync(options.file, { readOnly: true });
    try { assert.equal(check.prepare("SELECT value FROM machine_meta WHERE key='test-preserved'").get().value, 'live-host-data'); }
    finally { check.close(); }
  }
});

test('an unversioned populated store whose table resembles SQLite names is not initialized', t => {
  const options = fixture(t), raw = new DatabaseSync(options.file);
  try { raw.exec("CREATE TABLE sqliteXforeign(value TEXT); INSERT INTO sqliteXforeign VALUES('preserved-data');"); }
  finally { raw.close(); }
  const before = persistent(options);
  assert.throws(() => openMachine(options), /machine-schema-old.*no machine_meta/);
  assert.throws(() => openMachineReader(options), /machine-schema-old.*no machine_meta/);
  assert.deepEqual(persistent(options), before);
  const check = new DatabaseSync(options.file, { readOnly: true });
  try {
    assert.equal(check.prepare('PRAGMA user_version').get().user_version, 0);
    assert.equal(check.prepare('SELECT value FROM sqliteXforeign').get().value, 'preserved-data');
    assert.equal(check.prepare("SELECT count(*) n FROM sqlite_master WHERE name='machine_meta'").get().n, 0);
  } finally { check.close(); }
});

test('a first initializer that wins before BEGIN keeps its journal and host rows', t => {
  const options = fixture(t), exec = DatabaseSync.prototype.exec;
  let winner = null;
  const mocked = t.mock.method(DatabaseSync.prototype, 'exec', function (sql, ...args) {
    if (sql === 'BEGIN IMMEDIATE' && winner === null) {
      winner = {};
      const other = openMachine(options);
      try {
        other.setService({ name: 'first-initializer', kind: 'http', state: 'healthy', port: 41001 });
        winner.journal = other.db.prepare('SELECT * FROM schema_migrations ORDER BY version').all();
        winner.services = other.db.prepare('SELECT * FROM services').all();
      } finally { other.close(); }
    }
    return exec.call(this, sql, ...args);
  });
  let current;
  try {
    current = openMachine(options);
    assert.equal(current.db.prepare('PRAGMA user_version').get().user_version, MACHINE_VERSION);
    assert.deepEqual(current.db.prepare('SELECT * FROM schema_migrations ORDER BY version').all(), winner.journal);
    assert.deepEqual(current.db.prepare('SELECT * FROM services').all(), winner.services);
    assert.equal(winner.journal.length, 1, 'one actual init, with no adoption/rewrite by the waiting connection');
    assert.equal(current.db.prepare('PRAGMA auto_vacuum').get().auto_vacuum, 2);
  } finally { current?.close(); mocked.mock.restore(); }
});
