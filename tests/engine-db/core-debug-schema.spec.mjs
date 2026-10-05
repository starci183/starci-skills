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
