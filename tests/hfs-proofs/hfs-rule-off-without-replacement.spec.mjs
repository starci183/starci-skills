// proves: HFS_RULE_OFF_WITHOUT_REPLACEMENT@lite
// proves: HFS_RULE_OFF_WITHOUT_REPLACEMENT@full
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
  for (const relative of ['be/eslint.config.mjs', 'fe/eslint.config.mjs', 'fe/stylelint.config.mjs']) {
    test(`${edition}: a rule override in ${relative} fails and its canon render passes`, async context => {
      const { root, findings } = synced(context, edition);
      const file = path.join(root, relative);
      const rendered = fs.readFileSync(file, 'utf8');
      assert.deepEqual(await findings(), []);
      fs.writeFileSync(file, `${rendered}\nexport const rules = { "local/rule": "off" };\n`);
      const found = await findings();
      assert.deepEqual(found.map(finding => [finding.code, finding.path, finding.level]), [
        ['HFS_RULE_OFF_WITHOUT_REPLACEMENT', relative, 'error'],
      ]);
      assert.match(found[0].message, /rule can be off or redefined/);
      fs.writeFileSync(file, rendered);
      assert.deepEqual(await findings(), []);
    });
  }
}

for (const edition of ['lite', 'full']) {
  for (const relative of ['be/eslint.config.mjs', 'fe/eslint.config.mjs', 'fe/stylelint.config.mjs']) {
    test(`${edition}: direct managed findings reject ${relative} overrides and accept its factory render`, async (context) => {
      const { root, tracked } = synced(context, edition);
      const file = path.join(root, relative);
      const rendered = fs.readFileSync(file, 'utf8');
      assert.deepEqual(await managedFindings({ repoRoot: root, tracked, presets: PRESETS }), []);
      fs.writeFileSync(file, `${rendered}\nexport const rules = { "local/rule": "off" };\n`);
      assert.deepEqual((await managedFindings({ repoRoot: root, tracked, presets: PRESETS }))
        .map((finding) => [finding.code, finding.path]), [['HFS_RULE_OFF_WITHOUT_REPLACEMENT', relative]]);
      fs.writeFileSync(file, rendered);
      assert.deepEqual(await managedFindings({ repoRoot: root, tracked, presets: PRESETS }), []);
    });
  }
}
