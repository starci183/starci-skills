import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { openMachine, openMachineReader, MACHINE_VERSION } from '../../engine/db/machine.mjs';

const migrations = path.resolve(import.meta.dirname, '../../engine/db/migrations/machine');
const digest = text => createHash('sha256').update(text).digest('hex');
const signalRows = db => db.prepare('SELECT * FROM sup_signals ORDER BY scope,key').all();
const journal = db => db.prepare('SELECT * FROM schema_migrations ORDER BY version').all();
const tables = db => db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
const signalDdl = db => db.prepare("SELECT sql FROM sqlite_master WHERE name='sup_signals'").get().sql;

function temporary(t, close = () => {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'core-debug-schema-'));
  t.after(() => { close(); fs.rmSync(directory, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }); });
  return { directory, file: path.join(directory, 'machine.sqlite') };
}

function legacy(t, version) {
  let raw;
  const current = temporary(t, () => raw?.close());
  raw = new DatabaseSync(current.file);
  raw.exec('PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; PRAGMA foreign_keys=ON;');
  for (const [step, name] of [[1, '0001-init'], [2, '0002-provider-reservations']].slice(0, version)) {
    const sql = fs.readFileSync(path.join(migrations, `${name}.sql`), 'utf8');
    raw.exec(sql);
    raw.prepare("INSERT INTO schema_migrations(version,name,runtime_rev,sql_sha256,started_at,finished_at,status) VALUES(?,?,?,?,1,2,'done')")
      .run(step, name, 'legacy-fixture', digest(sql));
  }
  raw.prepare('INSERT INTO machine_meta(key,value) VALUES(?,?)').run('schema', 'starci/machine@1');
  raw.prepare('INSERT INTO machine_meta(key,value) VALUES(?,?)').run('core-schema-sentinel', 'preserved-host-data');
  raw.exec(`PRAGMA user_version=${version}`);
  const insert = raw.prepare('INSERT INTO sup_signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES(?,?,?,?,?,?,?)');
  insert.run('supervisor-enabled', 'main', 123, 'main-token', JSON.stringify({ enabled: true, by: 'owner' }), 10, null);
  insert.run('supervisor-enabled', 'core-debug', 456, 'other-key-token', JSON.stringify({ enabled: false }), 11, 999999);
  insert.run('supervisor-busy', 'held-terminal', null, null, null, 12, 888888);
  raw.prepare("INSERT INTO seats(seat_id,role,state,terminal_handle,detail_json) VALUES('supervisor','supervisor','booting','held-native-terminal',?)")
    .run(JSON.stringify({ token: 'held-seat-token', expiresAt: 999999, value: { state: 'launch-unknown', dispatch: 'held-native-dispatch' } }));
  if (version === 2) raw.prepare("INSERT INTO provider_reservations(id,attempt_id,provider,account,model,role,state,max_parallel,created_at,updated_at) VALUES('preserved-unknown','old-attempt','codex','fixture','gpt-6.1-sol','supervisor','unknown',1,13,14)").run();
  return { ...current, raw, options: { file: current.file, env: { ...process.env, STARCI_TEST_MACHINE_FILE: current.file } } };
}

function persistentBytes(directory) {
  return fs.readdirSync(directory).filter(name => !name.endsWith('-shm')).sort()
    .map(name => [name, digest(fs.readFileSync(path.join(directory, name)))]);
}

for (const version of [1, 2]) {
  test(`a genuine v${version} reader preserves schema, journal, signal rows and persistent bytes`, t => {
    const fixture = legacy(t, version), beforeBytes = persistentBytes(fixture.directory);
    const beforeRows = signalRows(fixture.raw), beforeJournal = journal(fixture.raw), beforeDdl = signalDdl(fixture.raw);
    const reader = openMachineReader(fixture.options);
    try {
      assert.equal(reader.db.prepare('PRAGMA query_only').get().query_only, 1);
      assert.equal(reader.db.prepare('PRAGMA user_version').get().user_version, version);
      assert.equal(reader.db.prepare('SELECT total_changes() n').get().n, 0);
      assert.deepEqual(signalRows(reader.db), beforeRows);
      assert.deepEqual(journal(reader.db), beforeJournal);
      assert.equal(signalDdl(reader.db), beforeDdl);
      assert.equal(reader.supSignal('core-debug-enabled', 'core-debug'), null);
      assert.throws(() => reader.setSupSignal({ scope: 'core-debug-enabled', key: 'core-debug', value: { enabled: true } }), /read.?only/i);
    } finally { reader.close(); }
    assert.deepEqual(persistentBytes(fixture.directory), beforeBytes);
  });

  test(`a v${version} writer preserves every legacy signal column and provider custody while upgrading once`, t => {
    const fixture = legacy(t, version), beforeRows = signalRows(fixture.raw);
    const providerRows = version === 2 ? fixture.raw.prepare('SELECT * FROM provider_reservations').all() : [];
    const seatRows = fixture.raw.prepare('SELECT * FROM seats').all();
    let firstJournal;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const machine = openMachine(fixture.options);
      try {
        assert.equal(machine.db.prepare('PRAGMA user_version').get().user_version, MACHINE_VERSION);
        assert.equal(machine.db.prepare("SELECT value FROM machine_meta WHERE key='core-schema-sentinel'").get().value, 'preserved-host-data');
        assert.deepEqual(signalRows(machine.db), beforeRows);
        assert.deepEqual(machine.db.prepare('SELECT * FROM provider_reservations').all(), providerRows);
        assert.deepEqual(machine.db.prepare('SELECT * FROM seats').all(), seatRows);
        const rows = journal(machine.db);
        assert.deepEqual(rows.map(r => [r.version, r.name]), [[1, '0001-init'], [2, '0002-provider-reservations'], [3, '0003-core-debug-signals']]);
        assert.equal(rows[2].sql_sha256, digest(fs.readFileSync(path.join(migrations, '0003-core-debug-signals.sql'))));
        if (firstJournal) assert.deepEqual(rows, firstJournal); else firstJournal = rows;
        assert.equal(machine.db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
        assert.deepEqual(machine.db.prepare('PRAGMA foreign_key_check').all(), []);
      } finally { machine.close(); }
    }
  });

  test(`a v${version} journal fault rolls back copied signals, preceding upgrades and schema version`, t => {
    const fixture = legacy(t, version);
    fixture.raw.exec("CREATE TRIGGER refuse_core_journal BEFORE INSERT ON schema_migrations WHEN NEW.version=3 BEGIN SELECT RAISE(ABORT,'fixture core migration journal fault'); END;");
    const beforeRows = signalRows(fixture.raw), beforeJournal = journal(fixture.raw), beforeDdl = signalDdl(fixture.raw), beforeTables = tables(fixture.raw);
    assert.throws(() => openMachine(fixture.options), /fixture core migration journal fault/);
    assert.equal(fixture.raw.prepare('PRAGMA user_version').get().user_version, version);
    assert.deepEqual(signalRows(fixture.raw), beforeRows);
    assert.deepEqual(journal(fixture.raw), beforeJournal);
    assert.equal(signalDdl(fixture.raw), beforeDdl);
    assert.deepEqual(tables(fixture.raw), beforeTables);
    assert.equal(fixture.raw.prepare("SELECT value FROM machine_meta WHERE key='core-schema-sentinel'").get().value, 'preserved-host-data');
    assert.equal(fixture.raw.prepare("SELECT count(*) n FROM sqlite_master WHERE name='sup_signals_v3'").get().n, 0);
  });
}

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
