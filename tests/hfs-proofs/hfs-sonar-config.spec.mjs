// proves: HFS_SONAR_CONFIG@lite
// proves: HFS_SONAR_CONFIG@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renderTargets, writeTargets } from '../../packages/hfs/sync/index.mjs';
import { managedFindings } from '../../packages/hfs/sync/managed.mjs';
import { APP, PRESETS } from '../helpers/hfs-cli-fixture.mjs';

const synced = (context, edition) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-proof-'));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const declaration = structuredClone(APP);
  declaration.edition = edition;
  if (edition === 'lite') declaration.sides.be.connections = [
    { name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'schema', provider: 'supabase' },
  ];
  fs.writeFileSync(path.join(root, 'hfs.json'), JSON.stringify(declaration));
  const targets = renderTargets(declaration, PRESETS);
  writeTargets(root, targets);
  const tracked = ['hfs.json', ...targets.map(target => target.path)];
  return { root, tracked, findings: () => managedFindings({ repoRoot: root, tracked, presets: PRESETS }) };
};

for (const edition of ['lite', 'full']) {
  test(`${edition}: changing a noncoverage Sonar setting fails and its render passes`, async context => {
    const { root, findings } = synced(context, edition);
    const file = path.join(root, 'sonar-project.properties');
    const rendered = fs.readFileSync(file, 'utf8');
    assert.deepEqual(await findings(), []);
    const changed = rendered.replace('sonar.sourceEncoding=UTF-8', 'sonar.sourceEncoding=UTF-16');
    assert.notEqual(changed, rendered);
    fs.writeFileSync(file, changed);
    assert.deepEqual((await findings()).map(finding => [finding.code, finding.path, finding.level]), [
      ['HFS_SONAR_CONFIG', 'sonar-project.properties', 'error'],
    ]);
    fs.writeFileSync(file, rendered);
    assert.deepEqual(await findings(), []);
  });
}

// Direct checker calls also expose these real mutation cases to the coverage proof analysis.
for (const edition of ['lite', 'full']) {
  test(`${edition}: an injected Sonar host URL is invalid and restoring its render passes`, async context => {
    const { root, tracked } = synced(context, edition);
    const input = { repoRoot: root, tracked, presets: PRESETS };
    const file = path.join(root, 'sonar-project.properties');
    const rendered = fs.readFileSync(file, 'utf8');
    assert.deepEqual((await managedFindings(input)).map(finding => finding.code), []);
    fs.writeFileSync(file, `${rendered}sonar.host.url=https://sonar.example.test\n`);
    assert.deepEqual((await managedFindings(input)).map(finding => finding.code), ['HFS_SONAR_CONFIG']);
    fs.writeFileSync(file, rendered);
    assert.deepEqual((await managedFindings(input)).map(finding => finding.code), []);
  });
}
