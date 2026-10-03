// machine.sqlite worktree kinds: one Orca-owned worktree per Kernel workflow is the unit (owner decision WFWT). The per-op kind
// 'op' does not exist; 'workflow' (the Kernel's tree) and 'critic' (the draw critic's placement) do, and a row carries Orca's
// worktree id (orca_id, unique) and the workflow's last checkpoint (checkpoint_sha). 0001-init.sql is the only schema step.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MACHINE_VERSION, openMachine } from '../../engine/db/machine.mjs';

const tmpFile = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-machine-wt-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  return path.join(dir, 'machine.sqlite');
};
const row = (kind, p) => ({ path: p, kind, repo_root: path.resolve('/r'), created_at: 1 });
const insert = (db, r) => db.prepare('INSERT INTO worktrees(path,kind,repo_root,created_at) VALUES(?,?,?,?)').run(r.path, r.kind, r.repo_root, r.created_at);
const KINDS = ['workflow', 'critic', 'land-scratch', 'push-scratch', 'supervisor-staging', 'lane'];

test('a fresh machine.sqlite: the CHECK refuses the per-op kind, takes workflow and critic, orca_id is unique', (t) => {
  const m = openMachine({ file: tmpFile(t) });
  try {
    assert.equal(Number(m.db.prepare('PRAGMA user_version').get().user_version), MACHINE_VERSION);
    assert.deepEqual(m.db.prepare('SELECT version,name FROM schema_migrations ORDER BY version').all().map((r) => [r.version, r.name]), [[1, '0001-init'], [2, '0002-provider-reservations']]);
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
