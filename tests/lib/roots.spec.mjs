// roots.mjs: every root has one resolver, and when two trees hold the same record the tree the work happens in wins, then the main checkout.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runtimeTree, runtimeState, tempRoot, invocationDir, treesInOrder, workDirsInOrder, workDirHolding, workRecordPath, toolSearchDirs, WORK_DIR_NAME } from '../../scripts/lib/roots.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';

const twoTrees = (t) => {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-roots-')));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const tree = path.join(base, 'workflow-tree');
  const repo = path.join(base, 'main-checkout');
  for (const dir of [tree, repo]) fs.mkdirSync(path.join(dir, WORK_DIR_NAME, 'brand'), { recursive: true });
  return { base, tree, repo };
};
const put = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, WORK_DIR_NAME, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, WORK_DIR_NAME, rel), text); };

test('runtime tree and state: the tree is the module location and the state dir follows it, never a record', () => {
  assert.equal(runtimeTree, skillRoot);
  assert.equal(runtimeState(), path.join(skillRoot, '.runtime'));
  const clone = path.resolve(os.tmpdir(), 'starci-roots-clone');
  assert.equal(runtimeState(clone), path.join(clone, '.runtime'));
});

test('temp root and invocation dir: the temp root is the one owner, the invocation dir is the injected cwd or the process one', () => {
  assert.equal(tempRoot({ env: { STARCI_TEMP_ROOT: path.join(os.tmpdir(), 'starci-roots-temp') }, config: null }), path.join(os.tmpdir(), 'starci-roots-temp'));
  assert.equal(invocationDir(), path.resolve(process.cwd()));
  assert.equal(invocationDir({ cwd: os.tmpdir() }), path.resolve(os.tmpdir()));
});

test('trees are tried workflow tree first, then the main checkout, once each', (t) => {
  const { tree, repo } = twoTrees(t);
  assert.deepEqual(treesInOrder({ tree, repo }), [tree, repo]);
  assert.deepEqual(treesInOrder({ tree: null, repo }), [repo]);
  assert.deepEqual(treesInOrder({ tree: repo, repo }), [repo]);
  assert.deepEqual(workDirsInOrder({ tree, repo }), [path.join(tree, WORK_DIR_NAME), path.join(repo, WORK_DIR_NAME)]);
});

test('a record held by both trees is read from the workflow tree; one held only by the main checkout from it', (t) => {
  const { tree, repo } = twoTrees(t);
  put(tree, 'brand/index.yaml', 'tree');
  put(repo, 'brand/index.yaml', 'main');
  put(repo, 'brand/only-main.yaml', 'main-only');
  const brand = workRecordPath('brand/index.yaml', { tree, repo });
  assert.equal(brand, path.join(tree, WORK_DIR_NAME, 'brand', 'index.yaml'));
  assert.equal(fs.readFileSync(brand, 'utf8'), 'tree');
  const onlyMain = workRecordPath('brand/only-main.yaml', { tree, repo });
  assert.equal(fs.readFileSync(onlyMain, 'utf8'), 'main-only');
  assert.equal(workRecordPath('brand/index.yaml', { tree: null, repo }), path.join(repo, WORK_DIR_NAME, 'brand', 'index.yaml'));
});

test('a record held by neither tree names the main checkout path; a predicate picks the first tree that satisfies it', (t) => {
  const { tree, repo } = twoTrees(t);
  assert.equal(workRecordPath('brand/missing.yaml', { tree, repo }), path.join(repo, WORK_DIR_NAME, 'brand', 'missing.yaml'));
  put(tree, 'brand/index.yaml', 'tree');
  put(repo, 'brand/index.yaml', 'main');
  const holdsMain = (dir) => fs.readFileSync(path.join(dir, 'brand', 'index.yaml'), 'utf8') === 'main';
  assert.equal(workDirHolding(holdsMain, { tree, repo }), path.join(repo, WORK_DIR_NAME));
  assert.equal(workDirHolding(() => true, { tree, repo }), path.join(tree, WORK_DIR_NAME));
});

test('tool lookups: the tree the work happens in and the project come first, the runtime install is always last', (t) => {
  const { tree, repo } = twoTrees(t);
  assert.deepEqual(toolSearchDirs([null, tree, repo], '/runtime'), [tree, repo, '/runtime']);
  assert.deepEqual(toolSearchDirs([], '/runtime'), ['/runtime']);
  assert.equal(toolSearchDirs([tree]).at(-1), runtimeTree);
});
