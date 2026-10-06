import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { openMachine, openMachineReader, MACHINE_VERSION } from '../../engine/db/machine.mjs';

const digest = text => createHash('sha256').update(text).digest('hex');
const signalRows = db => db.prepare('SELECT * FROM sup_signals ORDER BY scope,key').all();
const journal = db => db.prepare('SELECT * FROM schema_migrations ORDER BY version').all();
const signalDdl = db => db.prepare("SELECT sql FROM sqlite_master WHERE name='sup_signals'").get().sql;
function temporary(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'core-debug-schema-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  return { directory, file: path.join(directory, 'machine.sqlite') };
}
const persistentBytes = directory => fs.readdirSync(directory).filter(name => !name.endsWith('-shm')).sort()
  .map(name => [name, digest(fs.readFileSync(path.join(directory, name)))]);

test('existing current v3 renamed SQL and historical journal preserve signals, seats and unknown provider custody', t => {
  const fixture = temporary(t), options = { file: fixture.file }, machine = openMachine(options);
  try {
    machine.setSupSignal({ scope: 'supervisor-enabled', key: 'core-debug', token: 'supervisor-token', value: { enabled: false }, expiresAt: 999999 });
    machine.setSupSignal({ scope: 'core-debug-enabled', key: 'core-debug', token: 'core-token', value: { enabled: true } });
    machine.db.prepare("INSERT INTO seats(seat_id,role,state,terminal_handle,detail_json) VALUES('supervisor','supervisor','booting','held-native-terminal',?)")
      .run(JSON.stringify({ token: 'held-seat-token', value: { state: 'launch-unknown', dispatch: 'held-native-dispatch' } }));
    const reserved = machine.reserveProvider({ provider: 'codex', account: 'fixture', attemptId: 'held-attempt', role: 'supervisor', model: 'gpt-6.1-sol', maxParallel: 1 });
    assert.equal(reserved.ok, true);
    assert.equal(machine.markProviderReservation({ id: reserved.reservation.id, fence: reserved.reservation.fence, state: 'unknown' }).ok, true);
  } finally { machine.close(); }
  const raw = new DatabaseSync(fixture.file);
  let before;
  try {
    // Genuine current constraints survive SQLite's rename spelling; journal hashes describe earlier authored SQL.
    raw.exec('ALTER TABLE sup_signals RENAME TO saved_signals; ALTER TABLE saved_signals RENAME TO sup_signals; DELETE FROM schema_migrations;');
    for (const version of [1, 2, 3]) raw.prepare("INSERT INTO schema_migrations(version,name,runtime_rev,sql_sha256,started_at,finished_at,status) VALUES(?,?,?,?,1,2,'done')")
      .run(version, 'recorded-host-step-'+version, 'earlier-host-runtime', String(version).repeat(64));
    before = { signals: signalRows(raw), journal: journal(raw), ddl: signalDdl(raw), seats: raw.prepare('SELECT * FROM seats').all(),
      providers: raw.prepare('SELECT * FROM provider_reservations').all(), events: raw.prepare('SELECT * FROM provider_reservation_events').all() };
    assert.match(before.ddl, /CREATE TABLE "sup_signals"/);
  } finally { raw.close(); }
  const heldWriter = openMachine(options);
  try {
    // SQLite may create WAL auxiliaries on read-only open; snapshot the coherent, already-open store.
    assert.equal(fs.existsSync(fixture.file+'-wal'), true);
    const bytes = persistentBytes(fixture.directory), reader = openMachineReader(options);
    try {
      assert.equal(reader.db.prepare('PRAGMA user_version').get().user_version, MACHINE_VERSION);
      assert.equal(reader.db.prepare('PRAGMA query_only').get().query_only, 1);
      assert.equal(reader.db.prepare('SELECT total_changes() n').get().n, 0);
      assert.deepEqual(journal(reader.db), before.journal);
      assert.deepEqual(signalRows(reader.db), before.signals);
      assert.equal(signalDdl(reader.db), before.ddl);
      assert.throws(() => reader.setSupSignal({ scope: 'core-debug-enabled', key: 'core-debug', value: {} }), /read.?only/i);
      assert.equal(reader.db.prepare('SELECT total_changes() n').get().n, 0);
    } finally { reader.close(); }
    assert.deepEqual(persistentBytes(fixture.directory), bytes);
  } finally { heldWriter.close(); }
  for (let pass = 0; pass < 2; pass++) {
    const writer = openMachine(options);
    try {
      assert.deepEqual(journal(writer.db), before.journal);
      assert.deepEqual(signalRows(writer.db), before.signals);
      assert.equal(signalDdl(writer.db), before.ddl);
      assert.deepEqual(writer.db.prepare('SELECT * FROM seats').all(), before.seats);
      assert.deepEqual(writer.db.prepare('SELECT * FROM provider_reservations').all(), before.providers);
      assert.deepEqual(writer.db.prepare('SELECT * FROM provider_reservation_events').all(), before.events);
      assert.equal(writer.providerReservationUsage({ provider: 'codex', account: 'fixture' }).running, 1);
      assert.equal(writer.db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
      assert.deepEqual(writer.db.prepare('PRAGMA foreign_key_check').all(), []);
    } finally { writer.close(); }
  }
});

test('fresh core diagnostics are separate from Supervisor signals and unsupported scopes roll back atomically', t => {
  const { file } = temporary(t), machine = openMachine({ file });
  try {
    machine.setSupSignal({ scope: 'supervisor-enabled', key: 'core-debug', token: 'supervisor-token', value: { enabled: false }, expiresAt: 9999 });
    const supervisor = machine.supSignal('supervisor-enabled', 'core-debug');
    machine.setSupSignal({ scope: 'core-debug-enabled', key: 'core-debug', token: 'core-token', value: { enabled: true } });
    machine.setSupSignal({ scope: 'core-debug-diagnostics', key: 'core-debug', value: { fixes: { alert: { state: 'fixing', lane: 'owning-lane' } }, lastPassAt: 22 } });
    assert.deepEqual(machine.supSignal('supervisor-enabled', 'core-debug'), supervisor);
    assert.equal(machine.supSignal('core-debug-enabled', 'core-debug').token, 'core-token');
    assert.equal(machine.supSignal('core-debug-diagnostics', 'core-debug').value.fixes.alert.lane, 'owning-lane');
    const before = signalRows(machine.db);
    assert.throws(() => machine.transaction(() => {
      machine.setSupSignal({ scope: 'core-debug-enabled', key: 'core-debug', token: 'obsolete-token', value: { enabled: false } });
      machine.setSupSignal({ scope: 'unregistered-debug-scope', key: 'core-debug', value: {} });
    }), /CHECK constraint failed/);
    assert.deepEqual(signalRows(machine.db), before);
  } finally { machine.close(); }
});

const hostRows = db => db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
  .filter(row => row.name !== 'schema_migrations')
  .map(row => [row.name, db.prepare('SELECT * FROM "'+row.name.replaceAll('"', '""')+'"').all()
    .map(values => JSON.stringify(Object.values(values))).sort()]);

function versionTwo(t) {
  const fixture = temporary(t), options = { file: fixture.file, now: () => 1234 }, machine = openMachine(options);
  try {
    machine.setSupSignal({ scope: 'supervisor-enabled', key: 'main', holderPid: 321, token: 'held-supervisor-token',
      value: '{ "enabled": false, "unknown": "preserved" }', expiresAt: 987654321 });
    machine.setSupSignal({ scope: 'supervisor-busy', key: 'held-ticket', holderPid: null, token: null, value: null, expiresAt: null });
    machine.db.prepare("INSERT INTO seats(seat_id,role,state,terminal_handle,detail_json) VALUES('supervisor','supervisor','booting','held-native-terminal',?)")
      .run(JSON.stringify({ token: 'held-seat-token', state: 'launch-unknown', dispatch: 'held-native-dispatch' }));
    machine.setService({ name: 'preserved-service', kind: 'http', state: 'healthy', pid: 654, port: 41001 });
    machine.db.prepare("INSERT INTO land_queue(ticket_id,commit_sha,requested_by,state,enqueued_at,busy_holder) VALUES('held-ticket','held-commit','pid:321','running',22,'held-owner')").run();
    const reserved = machine.reserveProvider({ provider: 'codex', account: 'fixture', attemptId: 'held-attempt',
      role: 'supervisor', model: 'gpt-6.1-sol', maxParallel: 1 });
    assert.equal(reserved.ok, true);
    assert.equal(machine.markProviderReservation({ id: reserved.reservation.id, fence: reserved.reservation.fence, state: 'unknown' }).ok, true);
  } finally { machine.close(); }
  const raw = new DatabaseSync(fixture.file);
  try {
    const ddl = signalDdl(raw).replace(/CHECK\(scope IN \([^)]*\)\)/, "CHECK(scope IN ('supervisor-enabled','supervisor-busy'))");
    assert.doesNotMatch(ddl, /core-debug-enabled/);
    // The fixture carries the historical v2 CHECK and journals; no production migration helper constructs it.
    raw.exec(ddl.replace('sup_signals', 'fixture_v2_signals')+'; INSERT INTO fixture_v2_signals SELECT * FROM sup_signals; '+
      'DROP TABLE sup_signals; ALTER TABLE fixture_v2_signals RENAME TO sup_signals; DELETE FROM schema_migrations;');
    for (const [version, name] of [[1, '0001-init'], [2, '0002-provider-reservations']])
      raw.prepare("INSERT INTO schema_migrations(version,name,runtime_rev,sql_sha256,started_at,finished_at,status) VALUES(?,?,?,?,1,2,'done')")
        .run(version, name, 'recorded-v2-runtime', digest('historical-v2-step-'+version));
    raw.exec('PRAGMA user_version=2');
  } finally { raw.close(); }
  return { ...fixture, options };
}
const physicalObjects = db => db.prepare("SELECT type,name,sql FROM sqlite_master WHERE name NOT GLOB 'sqlite_*' ORDER BY type,name").all();

test('recognized v2 writer migration preserves every host row, seven signal columns and historical journals', t => {
  const fixture = versionTwo(t), raw = new DatabaseSync(fixture.file, { readOnly: true });
  let before;
  try { before = { rows: hostRows(raw), signals: signalRows(raw), journal: journal(raw) }; }
  finally { raw.close(); }
  const machine = openMachine(fixture.options);
  try {
    assert.equal(machine.db.prepare('PRAGMA user_version').get().user_version, MACHINE_VERSION);
    assert.deepEqual(hostRows(machine.db), before.rows);
    assert.deepEqual(signalRows(machine.db), before.signals);
    assert.deepEqual(machine.db.prepare('PRAGMA table_info(sup_signals)').all().map(row => row.name),
      ['scope', 'key', 'holder_pid', 'token', 'value_json', 'at', 'expires_at']);
    const history = journal(machine.db);
    assert.deepEqual(history.slice(0, -1), before.journal);
    assert.equal(history.length, before.journal.length+1);
    assert.equal(history.at(-1).version, MACHINE_VERSION);
    assert.equal(history.at(-1).name, '0003-core-debug-signals');
    assert.equal(history.at(-1).runtime_rev, machine.db.prepare("SELECT value FROM machine_meta WHERE key='runtime_rev'").get().value);
    assert.match(history.at(-1).sql_sha256, /^[0-9a-f]{64}$/);
    assert.equal(history.at(-1).started_at, 1234);
    assert.equal(history.at(-1).finished_at, 1234);
    assert.equal(history.at(-1).status, 'done');
    assert.equal(machine.providerReservationUsage({ provider: 'codex', account: 'fixture' }).running, 1);
    assert.equal(machine.supSignal('core-debug-enabled', 'core-debug'), null, 'migration does not invent maintenance enablement');
    machine.setSupSignal({ scope: 'core-debug-enabled', key: 'core-debug', token: 'new-core-token', value: { enabled: true } });
    machine.setSupSignal({ scope: 'core-debug-diagnostics', key: 'core-debug', value: { lastPassAt: 22 } });
    assert.deepEqual(signalRows(machine.db).filter(row => row.scope.startsWith('supervisor-')), before.signals);
    assert.equal(machine.db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    assert.deepEqual(machine.db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { machine.close(); }
});

test('v2 readers refuse without migration or persistent writes', t => {
  const fixture = versionTwo(t), held = new DatabaseSync(fixture.file);
  try {
    const rows = hostRows(held), history = journal(held), ddl = signalDdl(held), bytes = persistentBytes(fixture.directory);
    assert.throws(() => openMachineReader(fixture.options), /machine-schema-old.*user_version 2/);
    assert.deepEqual(persistentBytes(fixture.directory), bytes);
    assert.deepEqual(hostRows(held), rows);
    assert.deepEqual(journal(held), history);
    assert.equal(signalDdl(held), ddl);
    assert.equal(held.prepare('PRAGMA user_version').get().user_version, 2);
  } finally { held.close(); }
});

test('v2 migration refuses missing, changed and extra physical objects before effects', t => {
  const mutations = [
    raw => raw.exec('DROP INDEX ix_land_queue_state'),
    raw => raw.exec('DROP INDEX provider_reservations_active'),
    raw => raw.exec('DROP VIEW v_engine_health'),
    raw => {
      const ddl = signalDdl(raw).replace('CHECK(value_json IS NULL OR json_valid(value_json))', '');
      raw.exec('DROP TABLE sup_signals; '+ddl+';');
    },
    raw => raw.exec("CREATE TABLE extension(value TEXT); INSERT INTO extension VALUES('preserved-extension')"),
    raw => raw.exec('CREATE INDEX extra_signal_index ON sup_signals(token)'),
    raw => raw.exec('CREATE TRIGGER extra_signal_trigger AFTER INSERT ON sup_signals BEGIN SELECT 1; END'),
    raw => raw.exec('CREATE VIEW extra_signal_view AS SELECT * FROM sup_signals'),
    raw => raw.exec('CREATE TABLE extra_signal_fk(scope TEXT,key TEXT,FOREIGN KEY(scope,key) REFERENCES sup_signals(scope,key))'),
  ];
  for (const mutate of mutations) {
    const fixture = versionTwo(t), raw = new DatabaseSync(fixture.file);
    let before;
    try {
      mutate(raw);
      raw.exec('PRAGMA journal_mode=DELETE');
      before = { rows: hostRows(raw), journal: journal(raw), objects: physicalObjects(raw) };
    } finally { raw.close(); }
    const bytes = persistentBytes(fixture.directory);
    assert.throws(() => openMachine(fixture.options), /machine-schema-old.*(?:missing or changed|unexpected)/);
    assert.deepEqual(persistentBytes(fixture.directory), bytes, 'refusal cannot switch journal mode or persist facts');
    const check = new DatabaseSync(fixture.file, { readOnly: true });
    try {
      assert.equal(check.prepare('PRAGMA user_version').get().user_version, 2);
      assert.deepEqual(hostRows(check), before.rows);
      assert.deepEqual(journal(check), before.journal);
      assert.deepEqual(physicalObjects(check), before.objects);
    } finally { check.close(); }
  }
});

test('a migrated v3 writer reopens idempotently without adopting journals or changing host state', t => {
  const fixture = versionTwo(t), first = openMachine(fixture.options);
  let before;
  try { before = { rows: hostRows(first.db), journal: journal(first.db), objects: physicalObjects(first.db) }; }
  finally { first.close(); }
  for (let pass = 0; pass < 2; pass++) {
    const current = openMachine(fixture.options);
    try {
      assert.equal(current.db.prepare('PRAGMA user_version').get().user_version, MACHINE_VERSION);
      assert.deepEqual(hostRows(current.db), before.rows);
      assert.deepEqual(journal(current.db), before.journal);
      assert.deepEqual(physicalObjects(current.db), before.objects);
      assert.equal(before.journal.filter(row => row.version === MACHINE_VERSION).length, 1);
    } finally { current.close(); }
  }
});

test('v2 migration journal conflict rolls back copied rows, rebuilt DDL and version atomically', t => {
  const fixture = versionTwo(t), raw = new DatabaseSync(fixture.file);
  let before;
  try {
    raw.prepare("INSERT INTO schema_migrations(version,name,runtime_rev,sql_sha256,started_at,finished_at,status) VALUES(3,'held-conflicting-history','recorded-runtime',?,3,4,'done')")
      .run(digest('preserved-conflicting-record'));
    before = { rows: hostRows(raw), journal: journal(raw), objects: physicalObjects(raw) };
  } finally { raw.close(); }
  // The real journal uniqueness constraint fails after copy/drop/rename, without a production fault-injection seam.
  assert.throws(() => openMachine(fixture.options), /UNIQUE constraint failed: schema_migrations.version/);
  const check = new DatabaseSync(fixture.file, { readOnly: true });
  try {
    assert.equal(check.prepare('PRAGMA user_version').get().user_version, 2);
    assert.deepEqual(hostRows(check), before.rows);
    assert.deepEqual(journal(check), before.journal);
    assert.deepEqual(physicalObjects(check), before.objects);
    assert.equal(check.prepare("SELECT 1 FROM sqlite_master WHERE name='sup_signals_v3'").get(), undefined);
    assert.equal(check.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  } finally { check.close(); }
});

test('a v2 migration winner before BEGIN owns one journal while the waiting writer preserves its state', t => {
  const fixture = versionTwo(t), exec = DatabaseSync.prototype.exec;
  let winner = null;
  const mocked = t.mock.method(DatabaseSync.prototype, 'exec', function (sql, ...args) {
    if (sql === 'BEGIN IMMEDIATE' && winner === null) {
      winner = {};
      const other = openMachine(fixture.options);
      try { winner = { rows: hostRows(other.db), journal: journal(other.db), objects: physicalObjects(other.db) }; }
      finally { other.close(); }
    }
    return exec.call(this, sql, ...args);
  });
  let current;
  try {
    current = openMachine(fixture.options);
    assert.notEqual(winner, null);
    assert.equal(current.db.prepare('PRAGMA user_version').get().user_version, MACHINE_VERSION);
    assert.deepEqual(hostRows(current.db), winner.rows);
    assert.deepEqual(journal(current.db), winner.journal);
    assert.deepEqual(physicalObjects(current.db), winner.objects);
    assert.equal(winner.journal.filter(row => row.version === MACHINE_VERSION).length, 1);
  } finally { current?.close(); mocked.mock.restore(); }
});
