// Fresh stores carry the executed schema steps. Supported host upgrades preserve existing state;
// unsupported versions are refused instead of being discarded or downgraded.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { LEDGER_VERSION, openLedger } from '../../engine/db/ledger.mjs';
import { MACHINE_VERSION, openMachine } from '../../engine/db/machine.mjs';

const require = createRequire(import.meta.url);
const MIGRATIONS = path.resolve(import.meta.dirname, '..', '..', 'engine', 'db', 'migrations');

const tmp = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-fresh-schema-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  return dir;
};
const columns = (db, table) => db.prepare(`SELECT name FROM pragma_table_info('${table}')`).all().map((r) => r.name);
const views = (db) => db.prepare("SELECT name FROM sqlite_master WHERE type='view' ORDER BY name").all().map((r) => r.name);
const common = (db, version, journal = [[1, '0001-init']]) => {
  assert.equal(Number(db.prepare('PRAGMA user_version').get().user_version), version);
  assert.deepEqual(db.prepare('SELECT version,name FROM schema_migrations ORDER BY version').all().map((r) => [r.version, r.name]), journal);
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
  for (const view of views(db)) assert.doesNotThrow(() => db.prepare(`SELECT * FROM ${view} LIMIT 1`).all(), `${view} answers`);
};

test('runtime keeps its init schema; machine carries provider receipts and core maintenance signals', () => {
  assert.deepEqual(fs.readdirSync(path.join(MIGRATIONS, 'runtime')), ['0001-init.sql']);
  assert.deepEqual(fs.readdirSync(path.join(MIGRATIONS, 'machine')).sort(), ['0001-init.sql', '0002-provider-reservations.sql', '0003-core-debug-signals.sql']);
});

test('a fresh machine.sqlite has the columns, kinds and views the runtime queries need', (t) => {
  const m = openMachine({ file: path.join(tmp(t), 'machine.sqlite') });
  try {
    common(m.db, MACHINE_VERSION, [[1, '0001-init'], [2, '0002-provider-reservations'], [3, '0003-core-debug-signals']]);
    assert.deepEqual(columns(m.db, 'terminals'), ['handle', 'title', 'role', 'opened_at', 'closed_at', 'close_verified_at', 'closed_by']);
    const worktrees = columns(m.db, 'worktrees');
    for (const column of ['path', 'kind', 'orca_id', 'checkpoint_sha', 'release_pending_at', 'removed_at']) assert.ok(worktrees.includes(column), `worktrees.${column}`);
    const ddl = m.db.prepare("SELECT sql FROM sqlite_master WHERE name='worktrees'").get().sql;
    assert.match(ddl, /'workflow','critic','land-scratch'/);
    assert.doesNotMatch(ddl, /'op'/);
    for (const view of ['v_seats', 'v_leaks', 'v_search_ids']) assert.ok(views(m.db).includes(view), view);
  } finally { m.close(); }
});

test('a fresh runtime.sqlite has the columns and views the runtime queries need', (t) => {
  const l = openLedger({ file: path.join(tmp(t), 'runtime.sqlite') });
  try {
    common(l.db, LEDGER_VERSION);
    const attempts = columns(l.db, 'op_attempts');
    for (const column of ['usage_source', 'usage_reason', 'why_json']) assert.ok(attempts.includes(column), `op_attempts.${column}`);
    assert.ok(columns(l.db, 'v_op_history').includes('why_json'));
    for (const view of ['v_attempt_state', 'v_op_history', 'v_decision_rows', 'v_blocking', 'v_open_work']) assert.ok(views(l.db).includes(view), view);
  } finally { l.close(); }
});

test('a file at another user_version is refused, never migrated', (t) => {
  const dir = tmp(t);
  const { DatabaseSync } = require('node:sqlite');
  const machine = path.join(dir, 'machine.sqlite');
  openMachine({ file: machine }).close();
  const rm = new DatabaseSync(machine);
  rm.exec('PRAGMA user_version=4');
  rm.close();
  assert.throws(() => openMachine({ file: machine }), /machine-schema-old/);
  const ledger = path.join(dir, 'runtime.sqlite');
  openLedger({ file: ledger }).close();
  const rl = new DatabaseSync(ledger);
  rl.exec('PRAGMA user_version=5');
  rl.close();
  assert.throws(() => openLedger({ file: ledger }), /ledger-schema-refused/);
});
