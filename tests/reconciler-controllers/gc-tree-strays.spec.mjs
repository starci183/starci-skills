// The GC controller's key gc:tree-strays: an untracked file in the root of a live workflow tree that no job owns (the file named `0` that blocked a settle on
// 2026-10-09 and that nothing collected). The plan is the default (shadow); an active controller removes it, journals it, and touches nothing tracked, ignored,
// hidden, a directory, a path a live job owns or a file younger than the min age.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createGcController } from '../../scripts/reconciler/controllers/gc.mjs';
import { fakeCtx } from '../../scripts/reconciler/testing.mjs';

const git = (cwd, ...args) => { const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8', windowsHide: true }); assert.equal(r.status, 0, r.stderr); };
const OLD = Date.now() - 3_600_000;

function tree(t) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-strays-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  git(dir, 'init', '-q');
  fs.writeFileSync(path.join(dir, '.gitignore'), 'ignored.log\n');
  fs.writeFileSync(path.join(dir, 'tracked.txt'), 'kept\n');
  git(dir, 'add', '-A'); git(dir, 'commit', '-qm', 'base');
  const put = (name, text = 'x\n', age = OLD) => { const file = path.join(dir, name); fs.writeFileSync(file, text); fs.utimesSync(file, new Date(age), new Date(age)); return file; };
  return { dir, put };
}
const controller = (dir, owned = []) => createGcController({ workflowTrees: async () => [{ workflowId: 'wf-1', path: dir, repo: dir }], ownedPaths: async () => owned,
  recordRun: async (run) => { controller.runs.push(run); return 1; }, settings: { treeStraysEveryMs: 1 } });
controller.runs = [];
const ctxOf = (mode, logs) => { const ctx = fakeCtx({ mode, controller: 'gc', now: () => Date.now(), ledgers: [] }); const log = ctx.log; ctx.log = (kind, text, data) => { logs.push({ kind, text, data }); return log?.(kind, text, data); }; return ctx; };

test('the controller lists the key; in shadow mode it plans and removes nothing', async (t) => {
  const { dir, put } = tree(t);
  const stray = put('0');
  const c = controller(dir);
  assert.ok((await c.list()).includes('gc:tree-strays'));
  const logs = [];
  const out = await c.reconcile('gc:tree-strays', ctxOf('shadow', logs));
  assert.deepEqual([out.trees, out.strays, out.applied], [1, 1, false]);
  assert.equal(fs.existsSync(stray), true, 'the plan is the default: nothing is removed');
  assert.equal(logs.filter((l) => l.kind === 'reconciler.would').length, 1);
});

test('active: the stray is removed and journalled; tracked, ignored, hidden, owned, young and large files and directories stay', async (t) => {
  const { dir, put } = tree(t);
  const stray = put('0'), owned = put('report.out'), young = put('young.out', 'x\n', Date.now()), hidden = put('.scratch'), ignored = put('ignored.log'), big = put('big.out', 'x'.repeat(2_000_000));
  fs.mkdirSync(path.join(dir, 'a-directory')); fs.writeFileSync(path.join(dir, 'a-directory', 'f.txt'), 'x\n');
  const logs = [];
  controller.runs = [];
  const out = await controller(dir, ['report.out']).reconcile('gc:tree-strays', ctxOf('active', logs));
  assert.deepEqual([out.strays, out.applied], [1, true]);
  assert.equal(fs.existsSync(stray), false, 'the stray file is gone');
  for (const kept of [owned, young, hidden, ignored, big, path.join(dir, 'tracked.txt'), path.join(dir, 'a-directory', 'f.txt')]) assert.equal(fs.existsSync(kept), true, kept);
  const journal = logs.find((l) => l.kind === 'reconciler.gc.tree-strays');
  assert.deepEqual(journal.data.items, [{ name: '0', ok: true }]);
  assert.equal(controller.runs[0].items[0].collector, 'gc-tree-strays');
  assert.equal(controller.runs[0].items[0].action, 'removed');
});

test('a file that became tracked between the plan and the removal is not removed', async (t) => {
  const { dir, put } = tree(t);
  put('late.out');
  const { removeStrays, strayFilesOf } = await import('../../scripts/machine/tree-strays.mjs');
  const plan = strayFilesOf({ tree: dir, now: Date.now(), minAgeMs: 1, maxBytes: 1000 });
  git(dir, 'add', 'late.out');
  assert.deepEqual(removeStrays(dir, plan).map((r) => r.ok), [false]);
  assert.equal(fs.existsSync(path.join(dir, 'late.out')), true);
});
