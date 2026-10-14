// proves: HFS_COVERAGE_SCOPE_DRIFT@lite
// proves: HFS_COVERAGE_SCOPE_DRIFT@full
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

const mutations = [
  ['be/jest.config.js', text => text.replace('"service",', '')],
  ['codecov.yml', text => text.replace('target: 100%', 'target: 80%')],
  ['sonar-project.properties', text => text.replace('sonar.coverage.exclusions=', 'sonar.coverage.exclusions=be/src/modules/**,')],
];

for (const edition of ['lite', 'full']) {
  for (const [relative, mutate] of mutations) {
    test(`${edition}: changing coverage scope in ${relative} fails and its render passes`, async context => {
      const { root, findings } = synced(context, edition);
      const file = path.join(root, relative);
      const rendered = fs.readFileSync(file, 'utf8');
      assert.deepEqual(await findings(), []);
      const changed = mutate(rendered);
      assert.notEqual(changed, rendered);
      fs.writeFileSync(file, changed);
      const found = await findings();
      assert.deepEqual(found.map(finding => [finding.code, finding.path, finding.level]), [
        ['HFS_COVERAGE_SCOPE_DRIFT', relative, 'error'],
      ]);
      assert.match(found[0].message, /coverage scope derived from the slot manifest/);
      fs.writeFileSync(file, rendered);
      assert.deepEqual(await findings(), []);
    });
  }
}
