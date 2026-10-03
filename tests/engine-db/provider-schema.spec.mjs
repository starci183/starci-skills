import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openMachine, openMachineReader, MACHINE_VERSION } from '../../engine/db/machine.mjs';
import { providerBudgetUsage } from '../../scripts/agent/provider-budget.mjs';

const fixture = (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-provider-schema-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const file = path.join(directory, 'machine.sqlite');
  const options = { file, env: { ...process.env, STARCI_TEST_MACHINE_FILE: file } };
  openMachine(options).close();
  const raw = new DatabaseSync(file);
  raw.exec("DROP TABLE provider_reservation_events; DROP TABLE provider_reservations; DELETE FROM schema_migrations WHERE version=2; PRAGMA user_version=1; INSERT INTO machine_meta VALUES('test-preserved','live-host-data');");
  raw.close();
  return options;
};

test('v1 readers remain read-only compatible; writer upgrade preserves host data and is idempotent', (t) => {
  const options = fixture(t), reader = openMachineReader(options);
  try {
    assert.equal(reader.db.prepare('PRAGMA user_version').get().user_version, 1);
    assert.equal(reader.db.prepare("SELECT value FROM machine_meta WHERE key='test-preserved'").get().value, 'live-host-data');
    assert.deepEqual(reader.providerReservations(), []);
    assert.equal(providerBudgetUsage('codex', 'a', options).observed, false);
    assert.equal(providerBudgetUsage('codex', 'a', options).running, null);
    assert.throws(() => reader.reserveProvider({ provider: 'codex', account: 'a', attemptId: 'x', role: 'worker', model: 'sol', maxParallel: 1 }), /read-only/);
  } finally { reader.close(); }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const machine = openMachine(options);
    try {
      assert.equal(machine.db.prepare('PRAGMA user_version').get().user_version, MACHINE_VERSION);
      assert.equal(machine.db.prepare("SELECT value FROM machine_meta WHERE key='test-preserved'").get().value, 'live-host-data');
      assert.equal(machine.db.prepare('SELECT count(*) n FROM schema_migrations WHERE version=2').get().n, 1);
      assert.equal(machine.db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    } finally { machine.close(); }
  }
});

test('a failed additive upgrade rolls back its new tables, journal and version', (t) => {
  const options = fixture(t), raw = new DatabaseSync(options.file);
  raw.exec('CREATE TABLE provider_reservation_events(existing INTEGER)');
  raw.close();
  assert.throws(() => openMachine(options), /already exists/);
  const check = new DatabaseSync(options.file, { readOnly: true });
  try {
    assert.equal(check.prepare('PRAGMA user_version').get().user_version, 1);
    assert.equal(check.prepare("SELECT count(*) n FROM sqlite_master WHERE name='provider_reservations'").get().n, 0);
    assert.equal(check.prepare('SELECT count(*) n FROM schema_migrations WHERE version=2').get().n, 0);
    assert.equal(check.prepare("SELECT value FROM machine_meta WHERE key='test-preserved'").get().value, 'live-host-data');
  } finally { check.close(); }
});

test('foreign and future versions remain refused without downgrading or discarding data', (t) => {
  const options = fixture(t), raw = new DatabaseSync(options.file);
  raw.exec('PRAGMA user_version=77'); raw.close();
  assert.throws(() => openMachine(options), /machine-schema-old/);
  assert.throws(() => openMachineReader(options), /machine-schema-old/);
  const check = new DatabaseSync(options.file, { readOnly: true });
  try { assert.equal(check.prepare('PRAGMA user_version').get().user_version, 77); } finally { check.close(); }
});
