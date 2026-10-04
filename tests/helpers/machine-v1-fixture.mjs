import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { INIT_SQL_FILE, isUnderTempDir } from '../../engine/db/machine.mjs';

/** Restore a private current-schema fixture to genuine v1 while retaining its seeded host rows. */
export function restoreMachineV1Fixture(file, { meta = {} } = {}) {
  assert.equal(isUnderTempDir(file), true, 'legacy fixture reconstruction is restricted to a private temp file');
  let raw, original;
  try {
    raw = new DatabaseSync(file);
    original = new DatabaseSync(':memory:');
    original.exec(fs.readFileSync(INIT_SQL_FILE, 'utf8'));
    const signalDdl = original.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='sup_signals'").get().sql;
    const signals = raw.prepare('SELECT * FROM sup_signals ORDER BY scope,key').all();
    assert.equal(raw.prepare('SELECT COUNT(*) n FROM provider_reservations').get().n, 0, 'the prior-schema fixture cannot discard live or unknown reservations');
    assert.equal(raw.prepare('SELECT COUNT(*) n FROM provider_reservation_events').get().n, 0, 'the prior-schema fixture cannot discard reservation history');
    raw.exec('BEGIN IMMEDIATE');
    try {
      raw.exec('ALTER TABLE sup_signals RENAME TO sup_signals_current_fixture;');
      raw.exec(signalDdl);
      raw.exec('INSERT INTO sup_signals(scope,key,holder_pid,token,value_json,at,expires_at) SELECT scope,key,holder_pid,token,value_json,at,expires_at FROM sup_signals_current_fixture; DROP TABLE sup_signals_current_fixture;');
      raw.exec('DROP TABLE provider_reservation_events; DROP TABLE provider_reservations; DELETE FROM schema_migrations WHERE version>=2; PRAGMA user_version=1;');
      const seed = raw.prepare('INSERT INTO machine_meta(key,value) VALUES(?,?)');
      for (const [key, value] of Object.entries(meta)) seed.run(key, value);
      raw.exec('COMMIT');
    } catch (error) { raw.exec('ROLLBACK'); throw error; }
    assert.deepEqual(raw.prepare('SELECT * FROM sup_signals ORDER BY scope,key').all(), signals);
    assert.deepEqual(raw.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map(row => row.version), [1]);
    assert.throws(() => raw.prepare("INSERT INTO sup_signals(scope,key,at) VALUES('core-debug-enabled','refused-v1',0)").run(), /CHECK constraint failed/);
  } finally { original?.close(); raw?.close(); }
}
