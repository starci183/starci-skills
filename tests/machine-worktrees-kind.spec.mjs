// machine.sqlite 0002-worktrees-no-workflow-kind: the per-workflow worktree is removed, so worktrees.kind no longer accepts
// 'workflow'. A fresh store runs 0001 then the forward files; a store a user_version 1 runtime wrote is migrated on the first
// writer open (engine/machine-db.mjs migrateMachine): its 'workflow' rows are deleted, every other row is kept, and the CHECK
// refuses the kind from then on.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { INIT_SQL_FILE, MACHINE_MIGRATIONS, MACHINE_SCHEMA, MACHINE_VERSION, openMachine } from '../engine/machine-db.mjs';

const require = createRequire(import.meta.url);
const tmpFile = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-machine-wt-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  return path.join(dir, 'machine.sqlite');
};
const row = (kind, p) => ({ path: p, kind, repo_root: path.resolve('/r'), created_at: 1 });
const insert = (db, r) => db.prepare('INSERT INTO worktrees(path,kind,repo_root,created_at) VALUES(?,?,?,?)').run(r.path, r.kind, r.repo_root, r.created_at);

/** The file a user_version 1 runtime wrote: 0001-init as it is, its meta and schema_migrations row, one row of each kind given. */
function v1Store(file, rows) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(file);
  db.exec('PRAGMA page_size=4096; PRAGMA auto_vacuum=INCREMENTAL; PRAGMA journal_mode=WAL;');
  db.exec(fs.readFileSync(INIT_SQL_FILE, 'utf8'));
  db.prepare("INSERT INTO machine_meta(key,value) VALUES('schema',?)").run(MACHINE_SCHEMA);
  db.prepare("INSERT INTO schema_migrations(version,name,sql_sha256,started_at,finished_at,status) VALUES(1,'0001-init','x',1,1,'done')").run();
  for (const r of rows) insert(db, r);
  db.exec('PRAGMA user_version=1');
  db.close();
}

test('the forward migration is 0002 and the version it brings a store to is the runtime version', () => {
  assert.deepEqual(MACHINE_MIGRATIONS.map((m) => [m.version, m.name]), [[2, '0002-worktrees-no-workflow-kind']]);
  assert.equal(MACHINE_VERSION, 2);
});

test('a fresh machine.sqlite runs 0001 then 0002: the worktrees CHECK refuses the removed workflow kind', (t) => {
  const m = openMachine({ file: tmpFile(t) });
  try {
    assert.equal(Number(m.db.prepare('PRAGMA user_version').get().user_version), 2);
    assert.equal(m.db.prepare('SELECT status FROM schema_migrations WHERE version=2').get()?.status, 'done');
    assert.throws(() => insert(m.db, row('workflow', path.resolve('/r/wf'))), /CHECK constraint failed/);
    for (const kind of ['op', 'land-scratch', 'push-scratch', 'supervisor-staging', 'lane']) insert(m.db, row(kind, path.resolve(`/r/${kind}`)));
    assert.doesNotMatch(m.db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='worktrees'").get().sql, /'workflow'/);
  } finally { m.close(); }
});

test('a user_version 1 store is migrated on the first writer open: workflow rows go, the rest stay, and a second open changes nothing', (t) => {
  const file = tmpFile(t);
  v1Store(file, [row('workflow', path.resolve('/r/wf')), row('op', path.resolve('/r/op')), row('lane', path.resolve('/r/lane'))]);
  const m = openMachine({ file });
  try {
    assert.equal(Number(m.db.prepare('PRAGMA user_version').get().user_version), 2);
    assert.deepEqual(m.db.prepare('SELECT kind FROM worktrees ORDER BY kind').all().map((r) => r.kind), ['lane', 'op']);
    const migration = m.db.prepare('SELECT name,status,backup_path FROM schema_migrations WHERE version=2').get();
    assert.deepEqual([migration.name, migration.status], ['0002-worktrees-no-workflow-kind', 'done']);
    assert.ok(fs.existsSync(migration.backup_path), 'the store is backed up before the migration');
    assert.throws(() => insert(m.db, row('workflow', path.resolve('/r/wf2'))), /CHECK constraint failed/);
    assert.equal(m.db.prepare('PRAGMA quick_check').get().quick_check, 'ok');
    assert.ok(m.db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='view'").get().n > 0, 'the views over worktrees stay');
  } finally { m.close(); }
  const again = openMachine({ file });
  try {
    assert.equal(again.db.prepare('SELECT count(*) n FROM schema_migrations WHERE version=2').get().n, 1);
    assert.equal(again.db.prepare('SELECT count(*) n FROM worktrees').get().n, 2);
  } finally { again.close(); }
});
