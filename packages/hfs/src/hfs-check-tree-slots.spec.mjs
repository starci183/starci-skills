// proves: HFS_SLOT_REQUIRED_MISSING@lite
// proves: HFS_SLOT_REQUIRED_MISSING@full
// proves: HFS_MIN_INSTANCES@lite
// proves: HFS_MIN_INSTANCES@full
// proves: HFS_REQUIRED_FILE_MISSING@lite
// proves: HFS_REQUIRED_FILE_MISSING@full
// proves: HFS_UNTRACKED_ROOT_ENTRY@lite
// proves: HFS_UNTRACKED_ROOT_ENTRY@full
// proves: HFS_EMPTY_DIR@lite
// proves: HFS_EMPTY_DIR@full
// proves: HFS_GHOST_TREE@lite
// proves: HFS_GHOST_TREE@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkRepo as checkRepoWith, checkRepository as checkRepositoryWith } from '../runtime/scripts/hfs/check.mjs';
import { loadSlotManifest } from '../runtime/scripts/hfs/slots.mjs';
import { APP, TWO_FE_APPS, cleanup, gitAdd, installTypeScript, writeCleanRepo } from './helpers/hfs-cli-fixture.mjs';

const SLOT_REQUIRED_MISSING = 'HFS_SLOT_REQUIRED_MISSING';
const MIN_INSTANCES = 'HFS_MIN_INSTANCES';
const REQUIRED_FILE_MISSING = 'HFS_REQUIRED_FILE_MISSING';
const UNTRACKED_ROOT_ENTRY = 'HFS_UNTRACKED_ROOT_ENTRY';
const EMPTY_DIR = 'HFS_EMPTY_DIR';
const GHOST_TREE = 'HFS_GHOST_TREE';

const manifest = loadSlotManifest();
const checkRepo = (options) => checkRepoWith({ ...options, manifest });
const checkRepository = (options) => checkRepositoryWith({ ...options, manifest });
const made = [];
const repoOf = (declaration, edition, mutate) => {
  const dir = writeCleanRepo({ ...declaration, edition });
  made.push(dir);
  if (mutate) mutate(dir);
  return installTypeScript(gitAdd(dir));
};
test.after(() => cleanup(made));

const put = (dir, relative, text = 'export {};\n') => {
  const target = path.join(dir, ...relative.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
};
const drop = (dir, relative) => fs.rmSync(path.join(dir, ...relative.split('/')), { recursive: true, force: true });
const mkdir = (dir, relative) => fs.mkdirSync(path.join(dir, ...relative.split('/')), { recursive: true });
const only = (result, code) => result.findings.filter((f) => f.code === code);

for (const edition of ['lite', 'full']) {
  test(`${edition} violating: a missing required file is ${SLOT_REQUIRED_MISSING}, per slot and per app of a side with several apps`, () => {
    const be = checkRepo({ repoRoot: repoOf(APP, edition, (dir) => drop(dir, '.nvmrc')) });
    assert.equal(be.ok, false);
    const [rootFile] = only(be, SLOT_REQUIRED_MISSING);
    assert.equal(rootFile.path, '.nvmrc');
    assert.equal(rootFile.slot, 'app.tool-config');

    const fe = checkRepo({ repoRoot: repoOf(TWO_FE_APPS, edition, (dir) => drop(dir, 'fe/apps/admin/src/app/global-error.tsx')) });
    const [perApp] = only(fe, SLOT_REQUIRED_MISSING);
    assert.equal(only(fe, SLOT_REQUIRED_MISSING).length, 1);
    assert.equal(perApp.app, 'admin');
    assert.equal(perApp.slot, 'fe.app.next');

    const feature = checkRepo({ repoRoot: repoOf(APP, edition, (dir) => drop(dir, 'be/src/features/api/orders/index.ts')) });
    assert.deepEqual(only(feature, SLOT_REQUIRED_MISSING).map((f) => f.path), ['be/src/features/api/orders/index.ts']);
  });

  test(`${edition} valid: every required file and instance tracked leaves ${SLOT_REQUIRED_MISSING} and ${MIN_INSTANCES} silent`, () => {
    for (const declaration of [APP, TWO_FE_APPS]) {
      const result = checkRepo({ repoRoot: repoOf(declaration, edition) });
      assert.deepEqual(only(result, SLOT_REQUIRED_MISSING), []);
      assert.deepEqual(only(result, MIN_INSTANCES), []);
    }
  });

  test(`${edition} violating: a be side without a feature is ${MIN_INSTANCES}`, () => {
    const result = checkRepo({ repoRoot: repoOf(APP, edition, (dir) => drop(dir, 'be/src/features')) });
    const [finding] = only(result, MIN_INSTANCES);
    assert.equal(finding.slot, 'be.feature');
    assert.equal(finding.min, 1);
    assert.equal(finding.count, 0);
  });

  test(`${edition} violating: the machine reports a feature without its index as ${REQUIRED_FILE_MISSING}`, () => {
    const dir = repoOf(APP, edition, (d) => put(d, 'be/src/modules/domain/order/a.ts'));
    const result = checkRepository({ repoRoot: dir });
    const [finding] = only(result, REQUIRED_FILE_MISSING);
    assert.equal(result.ok, false);
    assert.equal(finding.level, 'error');
    assert.equal(finding.source, 'machine');
    assert.equal(finding.path, 'be/src/modules/domain/order/index.ts');
    assert.equal(result.machine.status, 'ran');
  });

  test(`${edition} valid: a clean app is clean to the machine, with no ${REQUIRED_FILE_MISSING}`, () => {
    for (const declaration of [APP, TWO_FE_APPS]) {
      const result = checkRepository({ repoRoot: repoOf(declaration, edition) });
      assert.deepEqual(only(result, REQUIRED_FILE_MISSING), []);
    }
  });

  test(`${edition} violating: an empty directory is ${EMPTY_DIR}, the topmost one however many sit below it`, () => {
    const dir = repoOf(APP, edition, (d) => { mkdir(d, 'be/src/modules/business/a/b'); mkdir(d, 'be/src/modules/business/c'); });
    const found = only(checkRepo({ repoRoot: dir }), EMPTY_DIR);
    assert.deepEqual(found.map((f) => [f.path, f.below]), [['be/src/modules/business', 3]]);
    assert.equal(found[0].level, 'error');
  });

  test(`${edition} valid: one file below makes a chain not empty, and ignored slots are not reported for ${EMPTY_DIR}`, () => {
    const chain = repoOf(APP, edition, (d) => { mkdir(d, 'be/src/modules/x/y/z'); put(d, 'be/src/modules/kept/deep/er/file.ts'); });
    assert.deepEqual(only(checkRepo({ repoRoot: chain }), EMPTY_DIR).map((f) => f.path), ['be/src/modules/x']);
    const ignored = repoOf(APP, edition, (d) => { mkdir(d, 'be/dist/empty'); mkdir(d, 'node_modules/pkg/empty'); mkdir(d, 'coverage/lcov'); });
    const result = checkRepo({ repoRoot: ignored });
    assert.deepEqual(only(result, EMPTY_DIR), []);
    assert.deepEqual(only(result, GHOST_TREE), []);
  });

  test(`${edition} violating: an empty directory beside a lookalike sibling is ${GHOST_TREE} (business / bussiness)`, () => {
    const dir = repoOf(APP, edition, (d) => { put(d, 'be/src/modules/business/a.ts'); mkdir(d, 'be/src/modules/bussiness'); mkdir(d, 'be/src/modules/platform-extras'); });
    const result = checkRepo({ repoRoot: dir });
    const ghosts = only(result, GHOST_TREE);
    assert.equal(ghosts.length, 1, 'platform-extras is far from every sibling');
    assert.deepEqual([ghosts[0].path, ghosts[0].of, ghosts[0].distance], ['be/src/modules/bussiness', 'be/src/modules/business', 1]);
    assert.ok(only(result, EMPTY_DIR).some((f) => f.path === 'be/src/modules/bussiness'), 'the ghost is also an empty directory');
  });

  test(`${edition} valid: lookalike siblings that both hold files are not a ${GHOST_TREE}`, () => {
    const dir = repoOf(APP, edition, (d) => { put(d, 'be/src/modules/order/a.ts'); put(d, 'be/src/modules/ordr/a.ts'); mkdir(d, 'be/src/modules/orderXYZ'); });
    assert.deepEqual(only(checkRepo({ repoRoot: dir }), GHOST_TREE), []);
  });

  test(`${edition} violating: an entry git neither tracks nor ignores is ${UNTRACKED_ROOT_ENTRY}`, () => {
    const dir = repoOf(APP, edition);
    put(dir, 'nul');
    put(dir, 'scratch/notes.txt');
    put(dir, 'be/dist/main.js');
    put(dir, '.gitignore', 'ignored-by-git.txt\n');
    put(dir, 'ignored-by-git.txt');
    const result = checkRepo({ repoRoot: dir });
    assert.deepEqual(only(result, UNTRACKED_ROOT_ENTRY).map((f) => f.path).sort(), ['nul', 'scratch']);
    assert.equal(result.ok, false);
  });

  test(`${edition} valid: a clean app has no ${UNTRACKED_ROOT_ENTRY} and the tree checks skip an explicit file list`, () => {
    assert.deepEqual(only(checkRepo({ repoRoot: repoOf(APP, edition) }), UNTRACKED_ROOT_ENTRY), []);
    const dir = repoOf(APP, edition, (d) => mkdir(d, 'be/src/modules/business'));
    const result = checkRepo({ repoRoot: dir, files: ['hfs.json'], declaration: { ...APP, edition } });
    assert.deepEqual(only(result, EMPTY_DIR), []);
  });
}
