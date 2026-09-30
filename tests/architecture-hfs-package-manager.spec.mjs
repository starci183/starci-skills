import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from './_hfs-arch-fixture.mjs';

// R14 (HFS_DEP_VERSION_SKEW's rule): npm is the only package manager. The machine reports a `packageManager` field that
// names another manager, and another manager's lock file at the root, as HFS_PACKAGE_MANAGER_MIXED.

const CODE = 'HFS_PACKAGE_MANAGER_MIXED';
const manifest = packageManager => JSON.stringify({ name: 'fixture-be', private: true, ...(packageManager ? { packageManager } : {}) });

test('HFS_PACKAGE_MANAGER_MIXED: a packageManager other than npm is a finding at package.json', t => {
  const root = archFixture(t, { files: { 'package.json': manifest('pnpm@9.0.0') } });
  const hits = findings(runArch(root), CODE);
  assert.equal(hits.length, 1, JSON.stringify(hits));
  assert.equal(hits[0].path, 'package.json');
});

test('HFS_PACKAGE_MANAGER_MIXED: another manager\'s lock file at the root is a finding at that file', t => {
  const root = archFixture(t, { files: { 'yarn.lock': '# yarn lockfile v1\n' } });
  assert.deepEqual(findings(runArch(root), CODE).map(item => item.path), ['yarn.lock']);
});

test('HFS_PACKAGE_MANAGER_MIXED: npm as packageManager, or none, raises nothing', t => {
  for (const value of ['npm@10.8.2', undefined]) {
    const root = archFixture(t, { files: { 'package.json': manifest(value) } });
    assert.deepEqual(findings(runArch(root), CODE), [], String(value));
  }
});
