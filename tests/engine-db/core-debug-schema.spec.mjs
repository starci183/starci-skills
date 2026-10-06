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
const signalDdl = db => db.prepare("SELECT sql FROM sqlite_master WHERE name='sup_signals'").get().sql;
function temporary(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'core-debug-schema-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  return { directory, file: path.join(directory, 'machine.sqlite') };
}
const persistentBytes = directory => fs.readdirSync(directory).filter(name => !name.endsWith('-shm')).sort()
  .map(name => [name, digest(fs.readFileSync(path.join(directory, name)))]);

test('existing current v3 renamed SQL preserves signals, seats and unknown provider custody', t => {
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
    // Genuine current constraints survive SQLite's rename spelling.
    raw.exec('ALTER TABLE sup_signals RENAME TO saved_signals; ALTER TABLE saved_signals RENAME TO sup_signals;');
    before = { signals: signalRows(raw), ddl: signalDdl(raw), seats: raw.prepare('SELECT * FROM seats').all(),
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

const SUPERVISOR_ONLY = "CHECK(scope IN ('supervisor-enabled','supervisor-busy'))";

/** A store shaped like an older host: narrow signal CHECK, user_version 2, and a table the current schema no longer has. */
function olderShape(t, mutate = () => {}) {
  const fixture = temporary(t), machine = openMachine({ file: fixture.file });
  try { machine.setSupSignal({ scope: 'supervisor-enabled', key: 'main', holderPid: 321, token: 'held-token', value: { enabled: false }, expiresAt: 987654321 }); }
  finally { machine.close(); }
  const raw = new DatabaseSync(fixture.file);
  try {
    const ddl = signalDdl(raw).replace(/CHECK\(scope IN \([^)]*\)\)/, SUPERVISOR_ONLY);
    assert.doesNotMatch(ddl, /core-debug-enabled/);
    raw.exec(ddl.replace('sup_signals', 'older_signals')+'; INSERT INTO older_signals SELECT * FROM sup_signals; DROP TABLE sup_signals; ALTER TABLE older_signals RENAME TO sup_signals;');
    raw.exec('CREATE TABLE inventory_snapshots(id INTEGER PRIMARY KEY); PRAGMA user_version=2;');
    mutate(raw);
    raw.exec('PRAGMA journal_mode=DELETE');
  } finally { raw.close(); }
  return fixture;
}

test('a fresh store accepts the core-debug scopes from its one init DDL', t => {
  const { file } = temporary(t), machine = openMachine({ file });
  try {
    assert.equal(machine.db.prepare('PRAGMA user_version').get().user_version, MACHINE_VERSION);
    assert.match(signalDdl(machine.db), /core-debug-enabled.*core-debug-diagnostics/s);
    machine.setSupSignal({ scope: 'core-debug-enabled', key: 'core-debug', token: 't', value: { enabled: true } });
    assert.equal(machine.supSignal('core-debug-enabled', 'core-debug').token, 't');
  } finally { machine.close(); }
});

test('an older-shape store is refused unchanged by writer and reader', t => {
  const fixture = olderShape(t), options = { file: fixture.file }, before = persistentBytes(fixture.directory);
  assert.throws(() => openMachine(options), error => error.code === 'STARCI_MACHINE_SCHEMA_OLD' && /not the current schema/.test(error.message) && /replace it with a fresh store/.test(error.message));
  assert.deepEqual(persistentBytes(fixture.directory), before);
  assert.throws(() => openMachineReader(options), error => error.code === 'STARCI_MACHINE_SCHEMA_OLD');
  assert.deepEqual(persistentBytes(fixture.directory), before);
  const check = new DatabaseSync(fixture.file, { readOnly: true });
  try {
    assert.equal(check.prepare('PRAGMA user_version').get().user_version, 2);
    assert.equal(check.prepare("SELECT 1 FROM sqlite_master WHERE name='sup_signals_v3'").get(), undefined);
    assert.doesNotMatch(signalDdl(check), /core-debug-enabled/);
  } finally { check.close(); }
});

test('stores that differ from the current schema in any one way are refused unchanged', t => {
  const mutations = [
    ['older host shape', () => {}, true],
    ['missing index', raw => raw.exec('DROP INDEX ix_land_queue_state'), false],
    ['missing view', raw => raw.exec('DROP VIEW v_engine_health'), false],
    ['extra index', raw => raw.exec('CREATE INDEX extra_signal_index ON sup_signals(token)'), false],
    ['extra trigger', raw => raw.exec('CREATE TRIGGER extra_signal_trigger AFTER INSERT ON sup_signals BEGIN SELECT 1; END'), false],
    ['extra view', raw => raw.exec('CREATE VIEW extra_signal_view AS SELECT * FROM sup_signals'), false],
  ];
  for (const [name, mutate, keepOlder] of mutations) {
    const fixture = keepOlder ? olderShape(t, mutate) : (() => { const f = temporary(t); openMachine({ file: f.file }).close();
      const raw = new DatabaseSync(f.file); try { mutate(raw); raw.exec('PRAGMA journal_mode=DELETE'); } finally { raw.close(); } return f; })();
    const before = persistentBytes(fixture.directory);
    assert.throws(() => openMachine({ file: fixture.file }), /machine-schema-old/, name);
    assert.throws(() => openMachineReader({ file: fixture.file }), /machine-schema-old/, name);
    assert.deepEqual(persistentBytes(fixture.directory), before, name);
  }
});
