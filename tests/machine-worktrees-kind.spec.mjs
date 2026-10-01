// machine.sqlite worktree kinds. 0002-worktrees-no-workflow-kind removed the old per-workflow integration tree; then
// 0003-worktrees-workflow-orca made one Orca-owned worktree per Kernel workflow the unit (owner decision WFWT): the per-op
// kind 'op' is gone, 'workflow' (the Kernel's tree) and 'critic' (the draw critic's placement) are back, and a row carries
// Orca's worktree id (orca_id, unique) and the workflow's last checkpoint (checkpoint_sha). A fresh store runs 0001 then the
// forward files; an older store is migrated on the first writer open (engine/machine-db.mjs migrateMachine).
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
const KINDS = ['workflow', 'critic', 'land-scratch', 'push-scratch', 'supervisor-staging', 'lane'];

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

test('the forward migrations are 0002 then 0003, and the last one brings a store to the runtime version', () => {
  assert.deepEqual(MACHINE_MIGRATIONS.map((m) => [m.version, m.name]), [[2, '0002-worktrees-no-workflow-kind'], [3, '0003-worktrees-workflow-orca']]);
  assert.equal(MACHINE_VERSION, 3);
});

test('a fresh machine.sqlite runs 0001, 0002, 0003: the CHECK refuses the per-op kind, takes workflow and critic, orca_id is unique', (t) => {
  const m = openMachine({ file: tmpFile(t) });
  try {
    assert.equal(Number(m.db.prepare('PRAGMA user_version').get().user_version), 3);
    assert.equal(m.db.prepare('SELECT status FROM schema_migrations WHERE version=3').get()?.status, 'done');
    assert.throws(() => insert(m.db, row('op', path.resolve('/r/op'))), /CHECK constraint failed/);
    for (const kind of KINDS) insert(m.db, row(kind, path.resolve(`/r/${kind}`)));
    const set = m.db.prepare('UPDATE worktrees SET orca_id=? WHERE path=?');
    set.run('repo::/r/workflow', path.resolve('/r/workflow'));
    assert.throws(() => set.run('repo::/r/workflow', path.resolve('/r/critic')), /UNIQUE constraint failed/);
    set.run(null, path.resolve('/r/lane'));
    set.run(null, path.resolve('/r/push-scratch'));
    assert.doesNotMatch(m.db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='worktrees'").get().sql, /'op'/);
  } finally { m.close(); }
});

test('a user_version 1 store is migrated on the first writer open: workflow and op rows go, the rest stay, a second open changes nothing', (t) => {
  const file = tmpFile(t);
  v1Store(file, [row('workflow', path.resolve('/r/wf')), row('op', path.resolve('/r/op')), row('lane', path.resolve('/r/lane'))]);
  const m = openMachine({ file });
  try {
    assert.equal(Number(m.db.prepare('PRAGMA user_version').get().user_version), 3);
    assert.deepEqual(m.db.prepare('SELECT kind FROM worktrees ORDER BY kind').all().map((r) => r.kind), ['lane']);
    for (const [version, name] of [[2, '0002-worktrees-no-workflow-kind'], [3, '0003-worktrees-workflow-orca']]) {
      const migration = m.db.prepare('SELECT name,status,backup_path FROM schema_migrations WHERE version=?').get(version);
      assert.deepEqual([migration.name, migration.status], [name, 'done']);
      assert.ok(fs.existsSync(migration.backup_path), `the store is backed up before ${name}`);
    }
    assert.throws(() => insert(m.db, row('op', path.resolve('/r/op2'))), /CHECK constraint failed/);
    insert(m.db, row('workflow', path.resolve('/r/wf2')));
    assert.equal(m.db.prepare('PRAGMA quick_check').get().quick_check, 'ok');
    assert.ok(m.db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='view'").get().n > 0, 'the views over worktrees stay');
  } finally { m.close(); }
  const again = openMachine({ file });
  try {
    assert.equal(again.db.prepare('SELECT count(*) n FROM schema_migrations WHERE version=3').get().n, 1);
    assert.equal(again.db.prepare('SELECT count(*) n FROM worktrees').get().n, 2);
  } finally { again.close(); }
});
