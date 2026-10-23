// proves: HFS_EDITION_FORBIDDEN_PRESENT@lite
// Full intentionally permits the e2e world; the paired fixture below proves that exemption.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkRepo } from '../runtime/scripts/hfs/check.mjs';

for (const edition of ['lite', 'full']) {
  test(`HFS_EDITION_FORBIDDEN_PRESENT (${edition}): judge the edition's test infrastructure`, (t) => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-forbidden-edition-'));
    t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
    const declaration = {
      hfs: 3, kind: 'app', project: 'demo', edition,
      sides: { be: { apps: [{ name: 'api', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } },
    };
    const findings = () => checkRepo({ repoRoot, declaration, files: ['package.json'], tree: false }).findings
      .filter((finding) => finding.code === 'HFS_EDITION_FORBIDDEN_PRESENT');
    const pkg = { scripts: { test: 'jest --selectProjects unit', 'test:e2e': 'jest --selectProjects e2e' }, devDependencies: { testcontainers: '10.0.0' } };
    fs.writeFileSync(path.join(repoRoot, 'package.json'), JSON.stringify(pkg));
    if (edition === 'lite') {
      assert.deepEqual(findings().map(({ code, path: file, name, level }) => ({ code, file, name, level })), [
        { code: 'HFS_EDITION_FORBIDDEN_PRESENT', file: 'package.json', name: 'test:e2e', level: 'error' },
        { code: 'HFS_EDITION_FORBIDDEN_PRESENT', file: 'package.json', name: 'testcontainers', level: 'error' },
      ]);
    } else assert.deepEqual(findings(), [], 'full owns e2e infrastructure');

    fs.writeFileSync(path.join(repoRoot, 'package.json'), JSON.stringify({ scripts: { test: pkg.scripts.test }, devDependencies: { jest: '30.0.0' } }));
    assert.deepEqual(findings(), [], 'the unit run and its runner are legal in both editions');
  });
}
