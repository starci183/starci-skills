// proves: HFS_PLAINTEXT_SECRET@lite
// proves: HFS_PLAINTEXT_SECRET@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkRepo } from '../../scripts/hfs/check.mjs';

const code = 'HFS_PLAINTEXT_SECRET';
const envelope = JSON.stringify({ data: 'ENC[AES256_GCM,data:YWJj,iv:ZGVm,tag:Z2hp,type:str]', sops: { mac: 'ENC[AES256_GCM,data:YWJj,iv:ZGVm,tag:Z2hp,type:str]', age: [] } });

function judge(t, edition, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-proof-plaintext-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
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
  test(`${code} ${edition}: refuses an empty tracked env file and a fake sealed envelope`, t => {
    const violations = judge(t, edition, { '.env': '', '.starcistacks/dev/secrets/app.enc': 'not an encrypted envelope' });
    assert.deepEqual(violations.map(item => item.path).sort(), ['.env', '.starcistacks/dev/secrets/app.enc']);
    assert.ok(violations.every(item => item.level === 'error'));
    assert.ok(violations.some(item => item.pattern === 'sops-not-envelope'));
  });

  test(`${code} ${edition}: accepts an actual envelope shape and public configuration`, t => {
    assert.deepEqual(judge(t, edition, { '.starcistacks/dev/secrets/app.enc': envelope, 'be/src/modules/config/public.config.ts': "export const url = 'https://fixture.invalid';" }), []);
  });
}
