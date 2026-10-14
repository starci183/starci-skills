// proves: HFS_MANAGED_FILE_DRIFT@lite HFS_MANAGED_FILE_DRIFT@full
// proves: HFS_SYNC_TEMPLATE_MISSING@lite HFS_SYNC_TEMPLATE_MISSING@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { loadSlotManifest } from '../../scripts/hfs/slots.mjs';
import { checkTargets, renderTargets, targetsOf, writeTargets } from '../../packages/hfs/sync/index.mjs';
import { managedFindings } from '../../packages/hfs/sync/managed.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const MANIFEST = loadSlotManifest();
const PRESETS = { sonarExclusions: [] };
const MANAGED = ['.editorconfig', '.gitattributes', '.github/dependabot.yml', '.nvmrc'];

function declaration(edition) {
  const folder = edition === 'lite' ? 'lite-app' : 'shape-slot';
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', folder, 'hfs.json'), 'utf8'));
}

function singleSlot(group) {
  return { ...MANIFEST, slots: [{ id: 'app.test', profiles: ['app'], path: '.github/dependabot.yml', managedBy: group, liteManagedBy: group }] };
}

function listedTemplate(group, edition, candidates) {
  const targets = targetsOf('app', { edition, manifest: singleSlot(group), hasTemplate: candidate => candidates.includes(candidate) });
  return targets.find(target => target.slot === 'app.test').template;
}

for (const edition of ['lite', 'full']) {
  const group = edition === 'lite' ? 'skeleton-lite' : 'skeleton';

  test(`${edition} skeleton resolution tries dotted paths only after existing undotted templates`, () => {
    const undotted = `app/${group}/github/dependabot.yml`;
    const common = `common/${group}/github/dependabot.yml`;
    const dotted = `app/${group}/.github/dependabot.yml`;
    const commonDotted = `common/${group}/.github/dependabot.yml`;
    assert.equal(listedTemplate(group, edition, [undotted, common, dotted]), undotted);
    assert.equal(listedTemplate(group, edition, [common, dotted]), common);
    assert.equal(listedTemplate(group, edition, [dotted]), dotted);
    assert.equal(listedTemplate(group, edition, [commonDotted]), commonDotted);
    assert.throws(() => listedTemplate(group, edition, []), { code: 'HFS_SYNC_TEMPLATE_MISSING' });
    assert.throws(() => listedTemplate('tool-config', edition, ['app/tool-config/.github/dependabot.yml']), { code: 'HFS_SYNC_TEMPLATE_MISSING' });
    assert.equal(listedTemplate('tool-config', edition, ['common/tool-config/github/dependabot.yml']), 'common/tool-config/github/dependabot.yml');
  });

  test(`${edition} manages the tool dotfiles and Dependabot while preserving project SOPS configuration`, async t => {
    const hfs = declaration(edition);
    const targets = renderTargets(hfs, PRESETS, { manifest: MANIFEST });
    const managed = targets.filter(target => MANAGED.includes(target.path));
    assert.deepEqual(managed.map(target => target.path).sort(), MANAGED);
    assert.ok(managed.every(target => target.mode === 'file' && target.scope === 'app'));
    assert.equal(targets.some(target => target.path === '.sops.yaml'), false);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-c04-managed-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    fs.writeFileSync(path.join(dir, 'hfs.json'), JSON.stringify(hfs));
    const sops = 'creation_rules: []\n# project-owned configuration\n';
    fs.writeFileSync(path.join(dir, '.sops.yaml'), sops);
    const tracked = ['hfs.json', '.sops.yaml', ...targets.map(target => target.path)];
    const findings = async () => (await managedFindings({ repoRoot: dir, tracked, manifest: MANIFEST, presets: PRESETS })).map(finding => [finding.code, finding.path]);

    writeTargets(dir, targets);
    assert.deepEqual(await findings(), []);
    for (const target of managed) fs.appendFileSync(path.join(dir, target.path), '# edited locally\n');
    assert.deepEqual((await findings()).sort(), MANAGED.map(file => ['HFS_MANAGED_FILE_DRIFT', file]));
    writeTargets(dir, targets);
    assert.deepEqual(await findings(), []);
    assert.ok(checkTargets(dir, targets).every(result => result.status === 'ok'));
    assert.equal(fs.readFileSync(path.join(dir, '.sops.yaml'), 'utf8'), sops);
  });

  test(`${edition} renders dependency updates for npm, GitHub Actions and every app Dockerfile`, () => {
    const targets = renderTargets(declaration(edition), PRESETS, { manifest: MANIFEST });
    const content = file => targets.find(target => target.path === file).content;
    const dependabot = parseYaml(content('.github/dependabot.yml'));
    assert.equal(dependabot.version, 2);
    assert.deepEqual(dependabot.updates.map(update => update['package-ecosystem']), ['npm', 'github-actions', 'docker']);
    assert.ok(dependabot.updates.every(update => update.schedule.interval === 'weekly'));
    assert.equal(dependabot.updates[0].directory, '/');
    assert.equal(dependabot.updates[1].directory, '/');
    assert.deepEqual(dependabot.updates[2].directories, ['/be/apps/*', '/fe/apps/*']);
    const ci = parseYaml(content('.github/workflows/ci.yml'));
    const node = ci.jobs.ci.steps.find(step => step.uses?.startsWith('actions/setup-node@'));
    assert.equal(content('.nvmrc').trim(), String(node.with['node-version']));
    assert.match(content('.editorconfig'), /^end_of_line = lf$/m);
    assert.match(content('.gitattributes'), /^\* text=auto eol=lf$/m);
    assert.match(content('.gitattributes'), /^\*\.enc binary$/m);
  });
}
