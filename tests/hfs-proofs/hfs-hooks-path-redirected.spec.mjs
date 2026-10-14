// proves: HFS_HOOKS_PATH_REDIRECTED@lite
// proves: HFS_HOOKS_PATH_REDIRECTED@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { openHfs } from '../../scripts/hfs/slots.mjs';
import { checkHfsWithoutConfig } from '../../scripts/hfs/architecture/hfs.mjs';

const CODE = 'HFS_HOOKS_PATH_REDIRECTED';
const git = (root, ...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe', encoding: 'utf8' });

function fixture(t, edition) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-proof-hooks-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const declaration = { hfs: 3, kind: 'app', project: 'proof', edition, sides: { be: { apps: [{ name: 'api', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } };
  fs.writeFileSync(path.join(root, 'hfs.json'), JSON.stringify(declaration));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ private: true }));
  assert.equal(openHfs({ repoRoot: root }).repo.edition, edition);
  git(root, 'init', '-q');
  git(root, 'add', 'hfs.json', 'package.json');
  return root;
}

const findings = (root) => checkHfsWithoutConfig(root).violations.filter((finding) => finding.ruleId === CODE);

for (const edition of ['lite', 'full']) {
  test(`${CODE}@${edition}: a redirected clone reports its actual config and accepts the husky path`, (t) => {
    const root = fixture(t, edition);
    git(root, 'config', '--local', 'core.hooksPath', '.git/disabled-hooks');
    const found = findings(root);
    assert.equal(found.length, 1);
    assert.equal(found[0].path, '.git/config');
    assert.match(found[0].message, /\.git\/disabled-hooks/);
    git(root, 'config', '--local', 'core.hooksPath', '.husky/_');
    assert.deepEqual(findings(root), []);
    git(root, 'config', '--local', '--unset', 'core.hooksPath');
    assert.deepEqual(findings(root), []);
  });
}
