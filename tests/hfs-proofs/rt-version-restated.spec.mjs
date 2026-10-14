// proves: RT_VERSION_RESTATED@lite
// proves: RT_VERSION_RESTATED@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { withoutGitLocalEnv } from '../../scripts/lib/git.mjs';
import { checkVersionPinOnce } from '../../scripts/checks/check-version-pin-once.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const git = (cwd, args) => {
  const result = spawnSync('git', args, { cwd, env: withoutGitLocalEnv(process.env), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
};
const fixture = (t, edition, doc) => {
  const root = mkdtemp(t, `starci-pin-proof-${edition}-`);
  fs.mkdirSync(path.join(root, 'docs'));
  fs.mkdirSync(path.join(root, 'knowledge/hfs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'hfs.json'), JSON.stringify({ hfs: 3, kind: 'app', project: 'proof', edition, sides: { be: { apps: [{ name: 'api', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } }));
  fs.writeFileSync(path.join(root, 'knowledge/hfs/canon-pins.yaml'), 'pins:\n  "@starci/grammar":\n    version: "0.8.2"\n');
  fs.writeFileSync(path.join(root, 'docs/setup.md'), doc);
  git(root, ['init', '-q']);
  git(root, ['add', '.']);
  return root;
};

for (const edition of ['lite', 'full']) {
  test(`${edition}: tracked documentation cannot repeat the canon package version`, (t) => {
    const findings = checkVersionPinOnce(fixture(t, edition, 'Install @starci/grammar@0.8.2.\n'));
    assert.deepEqual(findings.map((f) => [f.code, f.path]), [['RT_VERSION_RESTATED', 'docs/setup.md:1']]);
    assert.match(findings[0].message, /canon-pins\.yaml/);
  });

  test(`${edition}: documentation that refers to the canon pin passes`, (t) => {
    assert.deepEqual(checkVersionPinOnce(fixture(t, edition, 'Install the pinned @starci/grammar from knowledge/hfs/canon-pins.yaml.\n')), []);
  });
}
