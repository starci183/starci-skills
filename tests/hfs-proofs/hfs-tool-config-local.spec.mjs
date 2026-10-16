// proves: HFS_TOOL_CONFIG_LOCAL@lite
// proves: HFS_TOOL_CONFIG_LOCAL@full
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
  test(`${edition}: a tool config override fails and a plain lint command passes`, async context => {
    const { root, tracked, findings } = synced(context, edition);
    const relative = 'scripts/lint.mjs';
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    tracked.push(relative);
    fs.writeFileSync(file, 'export const lint = "eslint src";\n');
    assert.deepEqual(await findings(), []);
    fs.writeFileSync(file, 'export const lint = "eslint --config local.mjs src";\n');
    const found = await findings();
    assert.deepEqual(found.map(finding => [finding.code, finding.path, finding.level]), [
      ['HFS_TOOL_CONFIG_LOCAL', relative, 'error'],
    ]);
    assert.match(found[0].message, /--config/);
    fs.writeFileSync(file, 'export const lint = "eslint src";\n');
    assert.deepEqual(await findings(), []);
  });
}

for (const edition of ['lite', 'full']) {
  test(`${edition}: direct managed findings reject an override and accept the plain tool command`, async (context) => {
    const { root, tracked } = synced(context, edition);
    const relative = 'scripts/coverage-lint.mjs';
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    tracked.push(relative);
    fs.writeFileSync(file, 'export const lint = "eslint src";\n');
    assert.deepEqual(await managedFindings({ repoRoot: root, tracked, presets: PRESETS }), []);
    fs.writeFileSync(file, 'export const lint = "eslint --config local.mjs src";\n');
    assert.deepEqual((await managedFindings({ repoRoot: root, tracked, presets: PRESETS }))
      .map((finding) => [finding.code, finding.path]), [['HFS_TOOL_CONFIG_LOCAL', relative]]);
    fs.writeFileSync(file, 'export const lint = "eslint src";\n');
    assert.deepEqual(await managedFindings({ repoRoot: root, tracked, presets: PRESETS }), []);
  });
}
