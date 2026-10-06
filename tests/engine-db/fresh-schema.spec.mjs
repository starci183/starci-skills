// Fresh stores carry the executed schema. Existing current host journals remain historical evidence;
// unsupported versions are refused instead of being discarded or downgraded.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { LEDGER_VERSION, openLedger, openLedgerReader, openLedgerConnection, ledgerFileFor, PROJECTS_ROOT_ENV, TEST_REGISTRY_ENV } from '../../engine/db/ledger.mjs';
import { slashPath } from '../fixtures/win-path.mjs';
import { MACHINE_VERSION, openMachine } from '../../engine/db/machine.mjs';

const require = createRequire(import.meta.url);
const SCHEMA_DIR = path.resolve(import.meta.dirname, '..', '..', 'engine', 'db', 'schema');

const tmp = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-fresh-schema-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  return dir;
};
const columns = (db, table) => db.prepare(`SELECT name FROM pragma_table_info('${table}')`).all().map((r) => r.name);
const views = (db) => db.prepare("SELECT name FROM sqlite_master WHERE type='view' ORDER BY name").all().map((r) => r.name);
const common = (db, version) => {
  assert.equal(Number(db.prepare('PRAGMA user_version').get().user_version), version);
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
  for (const view of views(db)) assert.doesNotThrow(() => db.prepare(`SELECT * FROM ${view} LIMIT 1`).all(), `${view} answers`);
};

test('each store has exactly one schema file', () => {
  assert.deepEqual(fs.readdirSync(SCHEMA_DIR).sort(), ['machine.sql', 'runtime.sql']);
});

test('a fresh machine.sqlite has the columns, kinds and views the runtime queries need', (t) => {
  const m = openMachine({ file: path.join(tmp(t), 'machine.sqlite') });
  try {
    common(m.db, MACHINE_VERSION);
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

const SAMPLE = Object.freeze({ ledgerId: '00000000-0000-4000-8000-000000000001', createdAt: 1767225600000, blobRoot: 'artifacts' });
const INIT_FILE = path.join(SCHEMA_DIR, 'runtime.sql');
const initSql = fs.readFileSync(INIT_FILE, 'utf8');
const logicalTables = (db) => db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
  .map((row) => row.name).filter((name) => !name.startsWith('logs_fts_'));
const sortedRows = (db, table) => db.prepare(`SELECT * FROM ${table}`).all().map((row) => JSON.stringify(Object.values(row))).sort();
const catalogs = [...initSql.matchAll(/^INSERT OR IGNORE INTO (\w+) VALUES/gm)].map((match) => match[1]);

test('a fresh basic sample keeps canonical schema/catalogs, frozen metadata and zero operational rows', (t) => {
  const dir = tmp(t), file = path.join(dir, 'runtime.sqlite');
  const baseline = openLedger({ file: path.join(tmp(t), 'runtime.sqlite') });
  const sample = openLedger({ file, fixture: SAMPLE, checkpointer: true });
  try {
    common(sample.db, LEDGER_VERSION);
    assert.deepEqual(sample.db.prepare("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all(),
      baseline.db.prepare("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all());
    const meta = sample.meta();
    assert.equal(meta.ledger_id, SAMPLE.ledgerId);
    assert.equal(meta.created_at, String(SAMPLE.createdAt));
    assert.equal(meta.blob_root, SAMPLE.blobRoot);
    assert.equal(meta.fixture, 'starci/basic-runtime-fixture@1');
    assert.equal(meta.repo_root, undefined);
    assert.equal(meta.product, undefined);
    assert.equal(meta.sqlite_version, sample.db.prepare('SELECT sqlite_version() AS version').get().version);
    for (const table of logicalTables(sample.db)) {
      if (catalogs.includes(table)) assert.deepEqual(sortedRows(sample.db, table), sortedRows(baseline.db, table), `${table} keeps the canonical seed`);
      else if (table !== 'meta') assert.equal(Number(sample.db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n), 0, `${table} has no history`);
    }
    assert.notEqual(baseline.ledgerId, SAMPLE.ledgerId);
    assert.throws(() => sample.transaction(() => assert.fail('sample transaction ran')), /ledger-fixture-read-only/);
    assert.throws(() => sample.appendEvent({}), /ledger-fixture-read-only/);
    assert.throws(() => sample.write.createWorkflow({}), /ledger-fixture-read-only/);
    const checkpoint = sample.checkpoint();
    assert.equal(checkpoint.busy, 0);
    assert.equal(checkpoint.log, checkpoint.checkpointed);
  } finally { sample.close(); baseline.close(); }
  for (const suffix of ['-wal', '-shm']) assert.equal(fs.existsSync(file + suffix), false, `closed sample has no ${suffix}`);
  const copied = path.join(tmp(t), 'runtime.sqlite');
  fs.copyFileSync(file, copied, fs.constants.COPYFILE_EXCL);
  const reader = openLedgerReader(copied);
  try { common(reader, LEDGER_VERSION); assert.equal(reader.prepare('PRAGMA query_only').get().query_only, 1); }
  finally { reader.close(); }
  const bytes = fs.readFileSync(copied), entries = fs.readdirSync(path.dirname(copied));
  assert.throws(() => openLedger({ file: copied }), /ledger-fixture-read-only/);
  assert.throws(() => openLedgerConnection(copied), /ledger-fixture-read-only/);
  assert.throws(() => openLedger({ file: copied, machine: { registerLedger() { assert.fail('sample registered'); } } }), /ledger-fixture-read-only/);
  assert.deepEqual(fs.readFileSync(copied), bytes, 'writable refusal preserves the copied main bytes');
  assert.deepEqual(fs.readdirSync(path.dirname(copied)), entries, 'writable refusal creates no WAL or SHM');
});

test('fixture input refuses live bindings, real IDs, nonportable metadata and existing targets before file creation', (t) => {
  const dir = tmp(t), file = path.join(dir, 'runtime.sqlite');
  const options = { file, fixture: SAMPLE, checkpointer: true };
  const mutations = [
    { fixture: { ...SAMPLE, ledgerId: '59fc204d-3c77-4a40-af62-34f3940d5d2f' } },
    { fixture: { ...SAMPLE, ledgerId: SAMPLE.ledgerId.toUpperCase().replace('0001', '000A') } },
    { fixture: { ...SAMPLE, createdAt: 0 } }, { fixture: { ...SAMPLE, createdAt: 1.5 } }, { fixture: { ...SAMPLE, createdAt: Number.MAX_SAFE_INTEGER } },
    { fixture: { ...SAMPLE, extra: true } }, { fixture: {} }, { fixture: false },
    { fixture: { ...SAMPLE, sqliteVersion: 3 } }, { fixture: { ...SAMPLE, sqliteVersion: 'latest' } },
    ...['', '/artifacts', slashPath('C', 'artifacts'), '../artifacts', 'artifacts/..', 'artifacts\\nested', 'artifacts/', ' artifacts', 'artifacts?private', 'a\u0000b', 'a\rb', 'a\nb'].map((blobRoot) => ({ fixture: { ...SAMPLE, blobRoot } })),
    { repoRoot: dir }, { product: 'test-product' }, { machine: { registerLedger() { assert.fail('machine registration reached'); } } },
    { now: () => SAMPLE.createdAt }, { checkpointer: false }, { file: path.join(dir, 'other.sqlite') },
  ];
  for (const mutation of mutations) {
    assert.throws(() => openLedger({ ...options, ...mutation }), /ledger-fixture-refused/);
    assert.deepEqual(fs.readdirSync(dir), [], 'invalid input creates no file, sidecar or registry');
  }
  fs.writeFileSync(file, '');
  assert.throws(() => openLedger(options), /ledger-fixture-refused/);
  assert.equal(fs.statSync(file).size, 0, 'an existing empty file is not adopted');
  assert.deepEqual(fs.readdirSync(dir), ['runtime.sqlite']);
});

test('a fixture records the SQLite version it states; a version newer than the running SQLite is refused', (t) => {
  const pinned = path.join(tmp(t), 'runtime.sqlite');
  const sample = openLedger({ file: pinned, fixture: { ...SAMPLE, sqliteVersion: '3.51.3' }, checkpointer: true });
  try { assert.equal(sample.meta().sqlite_version, '3.51.3'); } finally { sample.close(); }
  const reader = openLedgerReader(pinned);
  try { assert.equal(reader.prepare("SELECT value FROM meta WHERE key='sqlite_version'").get().value, '3.51.3'); } finally { reader.close(); }
  const newer = path.join(tmp(t), 'runtime.sqlite');
  assert.throws(() => openLedger({ file: newer, fixture: { ...SAMPLE, sqliteVersion: '99.0.0' }, checkpointer: true }), /ledger-sqlite-downgrade/);
});

test('ordinary initialization still accepts an empty file and reopens its unchanged project identity', (t) => {
  const file = path.join(tmp(t), 'runtime.sqlite');
  fs.writeFileSync(file, '');
  const first = openLedger({ file, now: () => SAMPLE.createdAt, busyTimeoutMs: 50 });
  let identity;
  try { common(first.db, LEDGER_VERSION); identity = first.ledgerId; assert.equal(first.meta().fixture, undefined); }
  finally { first.close(); }
  const second = openLedger({ file, busyTimeoutMs: 50 });
  try { common(second.db, LEDGER_VERSION); assert.equal(second.ledgerId, identity); assert.equal(second.meta().created_at, String(SAMPLE.createdAt)); }
  finally { second.close(); }
});

test('fixture initialization refuses a cached real-project path and reserved identity on the ordinary route', (t) => {
  const dir = tmp(t), repository = path.join(dir, 'project');
  fs.mkdirSync(repository);
  const file = ledgerFileFor(repository, { env: { ...process.env, [PROJECTS_ROOT_ENV]: path.join(dir, 'projects'), [TEST_REGISTRY_ENV]: path.join(dir, 'machine.sqlite') } });
  assert.throws(() => openLedger({ file, fixture: SAMPLE, checkpointer: true }), /ledger-fixture-refused.*cached project path/);
  assert.equal(fs.existsSync(file), false);
  assert.equal(fs.existsSync(path.join(dir, 'machine.sqlite')), false);
  const reserved = path.join(dir, SAMPLE.ledgerId, 'runtime.sqlite');
  assert.throws(() => openLedger({ file: reserved }), /ledger-fixture-refused.*reserved/);
  assert.equal(fs.existsSync(path.dirname(reserved)), false);
});
