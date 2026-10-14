// proves: HFS_DEP_VERSION_SKEW@lite
// proves: HFS_DEP_VERSION_SKEW@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openHfs } from '../../scripts/hfs/slots.mjs';
import { depFindings } from '../../scripts/hfs/rules/deps.mjs';

const CODE = 'HFS_DEP_VERSION_SKEW';
const WORKSPACE = 'fe/packages/ui/package.json';

function fixture(t, edition) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-proof-deps-'));
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  const files = new Set();
  const write = (file, value) => {
    fs.mkdirSync(path.dirname(path.join(repoRoot, file)), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, file), JSON.stringify(value));
    files.add(file);
  };
  write('hfs.json', { hfs: 3, kind: 'app', project: 'proof', edition, sides: { be: { apps: [{ name: 'api', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }], optionalSlots: ['fe.package.ui'] } } });
  const { repo } = openHfs({ repoRoot });
  assert.equal(repo.edition, edition);
  write('package.json', { private: true, workspaces: ['fe/packages/*'], dependencies: { 'left-pad': '1.3.0' } });
  return { write, check: () => depFindings({ repoRoot, files: [...files], repo }) };
}

for (const edition of ['lite', 'full']) {
  test(`${CODE}@${edition}: workspace declarations must use the same dependency version`, (t) => {
    const app = fixture(t, edition);
    app.write(WORKSPACE, { name: '@proof/ui', dependencies: { 'left-pad': '1.0.0' } });
    const [skew] = app.check();
    assert.equal(skew.code, CODE);
    assert.equal(skew.dependency, 'left-pad');
    assert.deepEqual(skew.versions.sort(), ['1.0.0', '1.3.0']);
    app.write(WORKSPACE, { name: '@proof/ui', dependencies: { 'left-pad': '1.3.0' } });
    assert.deepEqual(app.check(), []);
  });

  test(`${CODE}@${edition}: root overrides and declarations must agree`, (t) => {
    const app = fixture(t, edition);
    app.write('package.json', { dependencies: { 'left-pad': '1.3.0' }, overrides: { 'left-pad': '1.0.0' } });
    const [skew] = app.check();
    assert.equal(skew.code, CODE);
    assert.equal(skew.pinned, '1.0.0');
    assert.equal(skew.path, 'package.json');
    app.write('package.json', { dependencies: { 'left-pad': '1.3.0' }, overrides: { 'left-pad': '1.3.0' } });
    assert.deepEqual(app.check(), []);
  });

  test(`${CODE}@${edition}: a second installed copy must be removed from the lockfile`, (t) => {
    const app = fixture(t, edition);
    const packages = { '': {}, 'node_modules/left-pad': { version: '1.3.0' }, 'node_modules/other/node_modules/left-pad': { version: '1.0.0' } };
    app.write('package-lock.json', { lockfileVersion: 3, packages });
    const [skew] = app.check();
    assert.equal(skew.code, CODE);
    assert.equal(skew.path, 'package-lock.json');
    assert.equal(skew.lockPath, 'node_modules/other/node_modules/left-pad');
    delete packages['node_modules/other/node_modules/left-pad'];
    app.write('package-lock.json', { lockfileVersion: 3, packages });
    assert.deepEqual(app.check(), []);
  });
}
