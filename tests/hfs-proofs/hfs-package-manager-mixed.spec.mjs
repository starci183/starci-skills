// proves: HFS_PACKAGE_MANAGER_MIXED@lite
// proves: HFS_PACKAGE_MANAGER_MIXED@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openHfs } from '../../scripts/hfs/slots.mjs';
import { checkHfsWithoutConfig } from '../../scripts/hfs/architecture/hfs.mjs';

const CODE = 'HFS_PACKAGE_MANAGER_MIXED';
const findings = (root) => checkHfsWithoutConfig(root).violations.filter((finding) => finding.ruleId === CODE);

function fixture(t, edition) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-proof-manager-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'hfs.json'), JSON.stringify({ hfs: 3, kind: 'app', project: 'proof', edition, sides: { be: { apps: [{ name: 'api', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } }));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ private: true, packageManager: 'npm@10.8.2' }));
  assert.equal(openHfs({ repoRoot: root }).repo.edition, edition);
  return root;
}

for (const edition of ['lite', 'full']) {
  test(`${CODE}@${edition}: the package manager field must name npm`, (t) => {
    const root = fixture(t, edition);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ packageManager: 'pnpm@9.0.0' }));
    const found = findings(root);
    assert.equal(found.length, 1);
    assert.equal(found[0].path, 'package.json');
    assert.match(found[0].message, /pnpm@9\.0\.0/);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ packageManager: 'npm@10.8.2' }));
    assert.deepEqual(findings(root), []);
  });

  test(`${CODE}@${edition}: another manager's lockfile contradicts the npm lock`, (t) => {
    const root = fixture(t, edition);
    fs.writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: {} }));
    fs.writeFileSync(path.join(root, 'yarn.lock'), '# yarn lockfile v1\n');
    assert.deepEqual(findings(root).map((finding) => finding.path), ['yarn.lock']);
    fs.rmSync(path.join(root, 'yarn.lock'));
    assert.deepEqual(findings(root), []);
  });
}
