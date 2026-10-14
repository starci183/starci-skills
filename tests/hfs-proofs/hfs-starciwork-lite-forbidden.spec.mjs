// proves: HFS_STARCIWORK_LITE_FORBIDDEN@lite
// Full retains Work features; the paired fixture below proves that exemption.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { checkRepo } from '../../scripts/hfs/check.mjs';
import { withoutGitLocalEnv } from '../../scripts/lib/git.mjs';

for (const edition of ['lite', 'full']) {
  test(`HFS_STARCIWORK_LITE_FORBIDDEN (${edition}): judge tracked and local Work leftovers`, (t) => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-work-boundary-'));
    t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
    execFileSync('git', ['-C', repoRoot, 'init', '-q'], { env: withoutGitLocalEnv(process.env), stdio: 'ignore' });
    const declaration = {
      hfs: 3, kind: 'app', project: 'demo', edition,
      sides: { be: { apps: [{ name: 'api', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } },
    };
    const feature = '.starciwork/features/orders/index.yaml';
    const allowed = ['.starciwork/.gitignore', '.starciwork/workspace.yaml', '.starciwork/brand/index.yaml'];
    for (const file of [...allowed, feature]) {
      fs.mkdirSync(path.dirname(path.join(repoRoot, file)), { recursive: true });
      fs.writeFileSync(path.join(repoRoot, file), file.endsWith('.yaml') ? '{}\n' : '');
    }
    const findings = (files, tree = false) => checkRepo({ repoRoot, declaration, files, tree }).findings
      .filter((finding) => finding.code === 'HFS_STARCIWORK_LITE_FORBIDDEN');
    const tracked = findings([...allowed, feature]);
    if (edition === 'lite') {
      assert.deepEqual(tracked.map(({ code, path: file, level }) => ({ code, file, level })), [{
        code: 'HFS_STARCIWORK_LITE_FORBIDDEN', file: feature, level: 'error',
      }]);
      const untracked = findings(allowed, true);
      assert.deepEqual(untracked.map(({ code, path: file }) => ({ code, file })), [{
        code: 'HFS_STARCIWORK_LITE_FORBIDDEN', file: '.starciwork/features',
      }], 'removing a leftover from the index must not hide the local forbidden tree');
    } else assert.deepEqual(tracked, [], 'full retains the feature tree');

    fs.rmSync(path.join(repoRoot, '.starciwork', 'features'), { recursive: true, force: true });
    assert.deepEqual(findings(allowed, true), [], 'workspace metadata and brand evidence remain legal');
  });
}
