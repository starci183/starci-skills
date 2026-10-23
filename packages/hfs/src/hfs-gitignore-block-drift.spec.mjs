// proves: HFS_GITIGNORE_BLOCK_DRIFT@lite
// proves: HFS_GITIGNORE_BLOCK_DRIFT@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renderTargets, writeTargets } from '../sync/index.mjs';
import { managedFindings } from '../sync/managed.mjs';
import { APP, PRESETS } from './helpers/hfs-cli-fixture.mjs';

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
  test(`${edition}: a changed managed ignore block fails and its render passes`, async context => {
    const { root, findings } = synced(context, edition);
    const file = path.join(root, '.gitignore');
    const rendered = fs.readFileSync(file, 'utf8');
    assert.deepEqual(await findings(), []);
    const changed = rendered.replace('node_modules/\n', '');
    assert.notEqual(changed, rendered);
    fs.writeFileSync(file, changed);
    const found = await findings();
    assert.deepEqual(found.map(finding => [finding.code, finding.path, finding.level]), [
      ['HFS_GITIGNORE_BLOCK_DRIFT', '.gitignore', 'error'],
    ]);
    assert.match(found[0].message, /managed block of \.gitignore is not its render/);
    fs.writeFileSync(file, `# application ignores\nlocal-notes/\n${rendered}\n.idea/\n`);
    assert.deepEqual(await findings(), []);
  });
}

// Direct checker calls also expose these real mutation cases to the coverage proof analysis.
for (const edition of ['lite', 'full']) {
  test(`${edition}: a missing managed ignore block is invalid and restoring its render passes`, async context => {
    const { root, tracked } = synced(context, edition);
    const input = { repoRoot: root, tracked, presets: PRESETS };
    const file = path.join(root, '.gitignore');
    const rendered = fs.readFileSync(file, 'utf8');
    assert.deepEqual((await managedFindings(input)).map(finding => finding.code), []);
    fs.writeFileSync(file, '# application ignores\nlocal-notes/\n');
    assert.deepEqual((await managedFindings(input)).map(finding => finding.code), ['HFS_GITIGNORE_BLOCK_DRIFT']);
    fs.writeFileSync(file, rendered);
    assert.deepEqual((await managedFindings(input)).map(finding => finding.code), []);
  });
}
