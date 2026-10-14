import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { scaffoldApp, scaffoldWorkSeeds } from '../../packages/hfs/scaffold/app.mjs';
import { upgradeEdition } from '../../packages/hfs/upgrade/index.mjs';
import { checkWorkFiles } from '../../scripts/work/validate/work-hygiene.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';
import { PRESETS, FORMATTED } from '../helpers/hfs-cli-fixture.mjs';

const lock = () => ({ ok: true });
const scaffold = (into, name, edition) => scaffoldApp({ name, into, edition, presets: PRESETS, lock,
  emitTypes: () => 'export interface Database { public: { Tables: Record<string, never> } }\n' });
const workFiles = (root) => !fs.existsSync(path.join(root, '.starciwork')) ? [] : fs.readdirSync(path.join(root, '.starciwork'), { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.yaml'))
  .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/'));
const hygiene = (root) => {
  const result = checkWorkFiles({ repo: root, files: workFiles(root) });
  assert.equal(result.ok, true, JSON.stringify(result.findings));
  return result;
};

test('both editions scaffold a workspace while only full carries the Work catalog and feature', (t) => {
  const into = mkdtemp(t, 'hfs-work-seeds-');
  for (const edition of ['full', 'lite']) {
    const created = scaffold(into, `work-${edition}`, edition);
    assert.ok(created.files.includes('.starciwork/.gitignore'));
    assert.ok(created.files.includes('.starciwork/workspace.yaml'));
    assert.equal(created.files.includes('.starciwork/index.yaml'), edition === 'full');
    assert.equal(created.files.includes('.starciwork/features/system-health/index.yaml'), edition === 'full');
    assert.ok(!created.files.includes('.starciwork/features/index.yaml'));
    assert.ok(fs.existsSync(path.join(created.root, 'be/src/features/api/system-health/transport/http/live.controller.ts')));
    if (edition === 'full') {
      for (const seed of scaffoldWorkSeeds(`work-${edition}`)) assert.equal(fs.readFileSync(path.join(created.root, seed.path), 'utf8'), seed.content);
    } else {
      assert.deepEqual(fs.readdirSync(path.join(created.root, '.starciwork')).sort(), ['.gitignore', 'workspace.yaml']);
      const workspace = scaffoldWorkSeeds('work-lite').find((file) => file.path === '.starciwork/workspace.yaml');
      assert.equal(fs.readFileSync(path.join(created.root, workspace.path), 'utf8'), workspace.content);
    }
    hygiene(created.root);
  }
});

test('upgrading a lite app without Work adds the full workspace, catalog and feature and passes hygiene', async (t) => {
  const into = mkdtemp(t, 'hfs-work-upgrade-');
  const { root } = scaffold(into, 'reseed-lite', 'lite');
  fs.rmSync(path.join(root, '.starciwork'), { recursive: true });
  assert.equal(fs.existsSync(path.join(root, '.starciwork')), false);
  const plan = await upgradeEdition({ root, to: 'full', plan: true, presets: PRESETS });
  for (const seed of scaffoldWorkSeeds('reseed-lite')) assert.ok(plan.some((step) => step.path === seed.path));
  await upgradeEdition({ root, to: 'full', presets: PRESETS, prettier: FORMATTED, lock });
  for (const seed of scaffoldWorkSeeds('reseed-lite')) assert.equal(fs.readFileSync(path.join(root, seed.path), 'utf8'), seed.content);
  hygiene(root);
});

test('upgrade preserves the lite workspace id and authored repo roles while adding the full Work catalog', async (t) => {
  const into = mkdtemp(t, 'hfs-work-workspace-');
  const { root } = scaffold(into, 'workspace-lite', 'lite');
  const workspace = path.join(root, '.starciwork/workspace.yaml');
  fs.writeFileSync(workspace, fs.readFileSync(workspace, 'utf8').replace('id: workspace-lite\n', 'id: durable-workspace\n') + '  - role: docs\n    name: docs\n');
  const before = fs.readFileSync(workspace);
  const plan = await upgradeEdition({ root, to: 'full', plan: true, presets: PRESETS });
  assert.ok(plan.every((step) => step.path !== '.starciwork/workspace.yaml'));
  assert.ok(plan.some((step) => step.path === '.starciwork/index.yaml'));
  await upgradeEdition({ root, to: 'full', presets: PRESETS, prettier: FORMATTED, lock });
  assert.deepEqual(fs.readFileSync(workspace), before);
  hygiene(root);
});

test('upgrade preserves a legacy lite authored catalog and feature bytes without adding another catalog', async (t) => {
  const into = mkdtemp(t, 'hfs-work-authored-');
  const { root } = scaffold(into, 'authored-lite', 'lite');
  // A pre-ruling lite app still migrates without overwriting its owner-authored full Work records.
  for (const seed of scaffoldWorkSeeds('authored-lite')) {
    fs.mkdirSync(path.dirname(path.join(root, seed.path)), { recursive: true });
    fs.writeFileSync(path.join(root, seed.path), seed.content);
  }
  const catalog = path.join(root, '.starciwork/index.yaml');
  fs.appendFileSync(catalog, '# Owner-authored orientation stays in this catalog.\n');
  const before = new Map(workFiles(root).map((file) => [file, fs.readFileSync(path.join(root, file))]));
  const plan = await upgradeEdition({ root, to: 'full', plan: true, presets: PRESETS });
  assert.ok(plan.every((step) => !step.path.startsWith('.starciwork/') || step.path === '.starciwork/.gitignore'));
  await upgradeEdition({ root, to: 'full', presets: PRESETS, prettier: FORMATTED, lock });
  for (const [file, bytes] of before) assert.deepEqual(fs.readFileSync(path.join(root, file)), bytes);
  hygiene(root);
});

test('a missing catalog is filled while an existing authored system-health feature remains untouched', async (t) => {
  const into = mkdtemp(t, 'hfs-work-partial-');
  const { root } = scaffold(into, 'partial-lite', 'lite');
  const feature = path.join(root, '.starciwork/features/system-health/index.yaml');
  const seed = scaffoldWorkSeeds('partial-lite').find((file) => file.path.endsWith('system-health/index.yaml'));
  fs.mkdirSync(path.dirname(feature), { recursive: true });
  fs.writeFileSync(feature, seed.content);
  fs.appendFileSync(feature, '# Owner-authored feature orientation.\n');
  const before = fs.readFileSync(feature);
  const plan = await upgradeEdition({ root, to: 'full', plan: true, presets: PRESETS });
  assert.ok(plan.some((step) => step.path === '.starciwork/index.yaml'));
  assert.ok(plan.every((step) => step.path !== '.starciwork/workspace.yaml'));
  assert.ok(plan.every((step) => step.path !== '.starciwork/features/system-health/index.yaml'));
  await upgradeEdition({ root, to: 'full', presets: PRESETS, prettier: FORMATTED, lock });
  assert.deepEqual(fs.readFileSync(feature), before);
  hygiene(root);
});
