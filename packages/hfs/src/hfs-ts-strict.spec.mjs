// proves: HFS_TS_STRICT@lite
// proves: HFS_TS_STRICT@full
import test from 'node:test';
import assert from 'node:assert/strict';
import { tsStrictFindings } from '../sync/ts-strict.mjs';
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
  for (const relative of ['be/tsconfig.json', 'fe/tsconfig.json']) {
    test(`${edition}: lowering strict in ${relative} fails and the preset render passes`, async context => {
      const { root, findings } = synced(context, edition);
      const file = path.join(root, relative);
      const rendered = fs.readFileSync(file, 'utf8');
      const config = JSON.parse(rendered);
      assert.deepEqual(await findings(), []);
      fs.writeFileSync(file, JSON.stringify({
        ...config, compilerOptions: { ...config.compilerOptions, strict: false },
      }));
      const found = await findings();
      assert.deepEqual(found.map(finding => [finding.code, finding.path, finding.flag, finding.level]), [
        ['HFS_TS_STRICT', relative, 'strict', 'error'],
      ]);
      assert.match(found[0].message, /lowers strict/);
      fs.writeFileSync(file, rendered);
      assert.deepEqual(await findings(), []);
    });
  }
}

for (const edition of ['lite', 'full']) {
  test(`${edition}: ts-strict rejects a lowered compiler flag`, () => {
    const expected = JSON.stringify({ extends: '@starci/tsconfig/next.json', exclude: ['node_modules'] });
    const actual = JSON.stringify({ extends: '@starci/tsconfig/next.json', exclude: ['node_modules'], compilerOptions: { strict: false } });
    assert.equal(tsStrictFindings(actual, expected)[0].code, 'HFS_TS_STRICT');
  });
  test(`${edition}: ts-strict accepts the strict preset configuration`, () => {
    const expected = JSON.stringify({ extends: '@starci/tsconfig/next.json', exclude: ['node_modules'] });
    assert.deepEqual(tsStrictFindings(expected, expected), []);
  });
}
