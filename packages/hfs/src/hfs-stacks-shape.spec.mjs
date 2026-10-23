// proves: HFS_STACKS_SHAPE@lite
// proves: HFS_STACKS_SHAPE@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkRepo } from '../runtime/scripts/hfs/check.mjs';

const code = 'HFS_STACKS_SHAPE';
const declarationText = `schema: starci/application-stacks@1
services:
  sonar:
    provider: sonarqube
    mode: local
    stack:
      owner: host
      root: .claude/ext/sonar
`;

function judge(t, edition, invalid) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-proof-stacks-shape-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const files = {
    '.starcistacks/application-stacks.yaml': invalid ? declarationText.replace('owner: host', 'owner: repository') : declarationText,
    '.starcistacks/dev/environment.json': '{}',
    ...(invalid ? { '.starcistacks/DESIGN.md': '# misplaced design' } : {}),
  };
  for (const [file, content] of Object.entries(files)) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  const declaration = { hfs: 3, kind: 'app', project: 'fixture', edition, sides: { be: { apps: [{ name: 'core', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } };
  const report = checkRepo({ repoRoot: root, declaration, files: Object.keys(files), tree: false });
  assert.equal(report.profile, 'app', 'the fixture declaration was accepted');
  return report.findings.filter(item => item.code === code);
}

for (const edition of ['lite', 'full']) {
  test(`${code} ${edition}: refuses misplaced files and a non-host local Sonar`, t => {
    const violations = judge(t, edition, true);
    assert.deepEqual(violations.map(item => item.path).sort(), ['.starcistacks/DESIGN.md', '.starcistacks/application-stacks.yaml']);
    assert.ok(violations.some(item => /not owned by the host/.test(item.message)));
  });

  test(`${code} ${edition}: accepts the standard tree and host-owned Sonar`, t => {
    assert.deepEqual(judge(t, edition, false), []);
  });
}
