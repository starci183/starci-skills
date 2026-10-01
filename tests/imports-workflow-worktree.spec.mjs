// IMPORTS_BROKEN_AFTER_MOVE scans the workflow's own worktree (part A's registry), where every slice's green work is
// checkpointed - not a per-op worktree (deleted) and not the live checkout. A workflow with no open worktree scans nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { importTreesOf, importsBrokenOf } from '../scripts/kernel/api-status/imports.mjs';

const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
};
const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
const fakeDb = { prepare: () => ({ get: () => null }) };

test('the scanned tree is the workflow worktree the registry names; none open scans nothing', (t) => {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-imports-wf-')));
  t.after(() => fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const tree = path.join(base, 'wf-tree');
  fs.mkdirSync(tree);
  git(tree, 'init', '-q', '-b', 'wf-wf-imports');
  write(tree, 'fe/src/page.ts', "import { t } from './i18n/request';\nexport const page = t;\n");
  git(tree, 'add', '-A');
  git(tree, '-c', 'user.name=spec', '-c', 'user.email=spec@x', 'commit', '-qm', 'a slice moved i18n away');
  const worktreeOf = (id) => (id === 'wf-imports' ? { workflowId: id, path: tree, repoRoot: path.join(base, 'app') } : null);

  assert.deepEqual(importTreesOf(fakeDb, { workflowId: 'wf-imports', worktreeOf }), [{ path: tree, kind: 'workflow', repoRoot: path.join(base, 'app') }]);
  assert.deepEqual(importTreesOf(fakeDb, { workflowId: 'wf-none', worktreeOf }), [], 'a workflow with no open worktree scans nothing');

  const broken = importsBrokenOf({ db: fakeDb, workflowId: 'wf-imports', repo: base, worktreeOf });
  assert.equal(broken?.code, 'IMPORTS_BROKEN_AFTER_MOVE');
  assert.equal(broken.count, 1);
  assert.deepEqual(broken.trees.map((x) => x.kind), ['workflow']);
  assert.deepEqual(broken.brokenFiles, ['app/fe/src/page.ts'], 'importers are named as owned paths of the app');
  assert.equal(broken.blocksNextWave, true, 'no repoint unit is queued');
  assert.equal(importsBrokenOf({ db: fakeDb, workflowId: 'wf-none', repo: base, worktreeOf }), null);
});
