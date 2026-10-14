// proves: HFS_LITE_SECRET_CUSTODY@lite
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkRepo } from '../../scripts/hfs/check.mjs';

const code = 'HFS_LITE_SECRET_CUSTODY';
const envelope = JSON.stringify({ data: 'ENC[AES256_GCM,data:YWJj,iv:ZGVm,tag:Z2hp,type:str]', sops: { mac: 'ENC[AES256_GCM,data:YWJj,iv:ZGVm,tag:Z2hp,type:str]', age: [] } });

function judge(t, edition, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-proof-lite-custody-'));
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

test(`${code} lite: refuses a root env path and a sealed file outside its custody home`, t => {
  const violations = judge(t, 'lite', { '.env.example': 'PUBLIC_VALUE=fixture', 'backup.enc': envelope });
  assert.deepEqual(violations.map(item => item.path).sort(), ['.env.example', 'backup.enc']);
  assert.ok(violations.every(item => item.level === 'error'));
});

test(`${code} lite: accepts sealed values under the one starcistacks secret home`, t => {
  assert.deepEqual(judge(t, 'lite', { '.starcistacks/dev/secrets/app.enc': envelope }), []);
});

test(`${code} full: the catalog exempts the same otherwise violating custody paths`, t => {
  assert.deepEqual(judge(t, 'full', { '.env.example': 'PUBLIC_VALUE=fixture', 'backup.enc': envelope }), []);
});
