import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { renderTargets, writeTargets } from '../../packages/hfs/sync/index.mjs';
import { managedFindings } from '../../packages/hfs/sync/managed.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SWARM_INCLUDE = '!.starcistacks/*/infra/swarm/**';
const PRESETS = { sonarExclusions: [] };
const declaration = edition => ({
  hfs: 3, kind: 'app', project: 'swarm-demo', edition,
  sides: {
    be: { apps: [{ name: 'api', kind: 'api' }] },
    fe: { apps: [{ name: 'web', kind: 'next' }] },
  },
});
const drift = async root => (await managedFindings({ repoRoot: root, tracked: ['hfs.json', '.gitignore'], presets: PRESETS }))
  .filter(finding => finding.code === 'HFS_GITIGNORE_BLOCK_DRIFT');

for (const edition of ['full', 'lite']) {
  test(`${edition} sync tracks Swarm sources with the exact custody rules and restores their re-include`, async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `hfs-swarm-gitignore-${edition}-`));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const hfs = declaration(edition);
    fs.writeFileSync(path.join(root, 'hfs.json'), JSON.stringify(hfs));
    fs.writeFileSync(path.join(root, '.gitignore'), 'owner-scratch/\n');
    const targets = renderTargets(hfs, PRESETS);
    const target = targets.find(entry => entry.path === '.gitignore');
    const rules = parseYaml(fs.readFileSync(path.join(ROOT, 'modules/schemas/stacks-layout.yaml'), 'utf8')).custody.gitignoreRules;
    const lines = target.content.split('\n');
    const start = lines.indexOf(rules[0]);
    assert.deepEqual(lines.slice(start, start + rules.length), rules);
    assert.ok(rules.includes(SWARM_INCLUDE));
    assert.ok(rules.indexOf(SWARM_INCLUDE) < rules.indexOf('.starcistacks/*/infra/**/.env.*'));
    assert.equal(rules.at(-1), '!.starcistacks/**/*.enc');
    writeTargets(root, targets);
    assert.deepEqual(await drift(root), []);
    const file = path.join(root, '.gitignore');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(`${SWARM_INCLUDE}\n`, ''));
    const findings = await drift(root);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].path, '.gitignore');
    writeTargets(root, targets);
    assert.deepEqual(await drift(root), []);
    assert.ok(fs.readFileSync(file, 'utf8').endsWith('owner-scratch/\n'));
  });
}
