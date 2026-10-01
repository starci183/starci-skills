import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { archFixture } from '../helpers/hfs-arch-fixture.mjs';
import { checkHfsWithoutConfig } from '../../scripts/hfs/architecture/hfs.mjs';

// R14 (HFS_DEP_VERSION_SKEW's rule): npm is the only package manager. The app-root check reports a `packageManager` field of
// the one package.json that names another manager, and another manager's lock file at the app root, as HFS_PACKAGE_MANAGER_MIXED.

const CODE = 'HFS_PACKAGE_MANAGER_MIXED';
/** The findings of CODE the app-root check reports over the app whose be side `side` is. */
const rootFindings = side => checkHfsWithoutConfig(path.dirname(side)).violations.filter(item => item.ruleId === CODE);
const manifest = packageManager => JSON.stringify({ name: 'fixture', private: true, ...(packageManager ? { packageManager } : {}) });

test('HFS_PACKAGE_MANAGER_MIXED: a packageManager other than npm in the app package.json is a finding at package.json', t => {
  const root = archFixture(t, { files: { '../package.json': manifest('pnpm@9.0.0') } });
  const hits = rootFindings(root);
  assert.equal(hits.length, 1, JSON.stringify(hits));
  assert.equal(hits[0].path, 'package.json');
});

test('HFS_PACKAGE_MANAGER_MIXED: another manager\'s lock file at the root is a finding at that file', t => {
  const root = archFixture(t, { files: { '../yarn.lock': '# yarn lockfile v1\n' } });
  assert.deepEqual(rootFindings(root).map(item => item.path), ['yarn.lock']);
});

test('HFS_PACKAGE_MANAGER_MIXED: npm as packageManager, or none, raises nothing', t => {
  for (const value of ['npm@10.8.2', undefined]) {
    const root = archFixture(t, { files: { '../package.json': manifest(value) } });
    assert.deepEqual(rootFindings(root), [], String(value));
  }
});
