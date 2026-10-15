import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { scaffoldApp } from '../../packages/hfs/scaffold/app.mjs';
import { renderRepo, runSync } from '../../packages/hfs/sync/index.mjs';
import { loadDeployConfig } from '../../packages/hfs/stack/config.mjs';
import { parseYaml } from '../../engine/yaml.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const PINS = parseYaml(fs.readFileSync(path.join(ROOT, 'knowledge', 'hfs', 'canon-pins.yaml'), 'utf8')).pins;
const PRESETS = { sonarExclusions: createRequire(import.meta.url)('../../packages/jest-preset/index.cjs').sonarExclusions() };
const GENERATED_TYPES = 'export type Database = { public: { Tables: Record<string, never> } };\n';
const fakeLock = (root) => {
  fs.writeFileSync(path.join(root, 'package-lock.json'), '{"name":"demo","lockfileVersion":3,"packages":{}}\n');
  return { ok: true };
};
const temps = [];
after(() => { for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true }); });

function scaffold(extra = {}) {
  const into = fs.mkdtempSync(path.join(os.tmpdir(), 'stack-registry-'));
  temps.push(into);
  const { root } = scaffoldApp({ name: 'demo', into, pins: PINS, presets: PRESETS, lock: fakeLock, emitTypes: () => GENERATED_TYPES, now: () => new Date('2026-10-02T12:34:56.000Z'), ...extra });
  return root;
}
const declarationFile = (root) => path.join(root, '.starcistacks', 'application-stacks.yaml');
const registryOf = (root) => parseYaml(fs.readFileSync(declarationFile(root), 'utf8')).environments.production.deploy.registry;

for (const edition of ['lite', 'full']) {
  test(`${edition}: the scaffold writes deploy.registry ghcr.io public by default and the deploy block loads`, () => {
    const root = scaffold({ edition });
    assert.deepEqual(registryOf(root), { host: 'ghcr.io', visibility: 'public' });
    assert.deepEqual(loadDeployConfig({ repoRoot: root, env: 'production' }).registry, { host: 'ghcr.io', visibility: 'public' });
  });

  test(`${edition}: --registry-visibility private is written, any other value is refused`, () => {
    const root = scaffold({ edition, registryVisibility: 'private' });
    assert.equal(registryOf(root).visibility, 'private');
    assert.throws(() => scaffold({ edition, registryVisibility: 'internal' }), (error) => error.code === 'HFS_SCAFFOLD_REGISTRY_VISIBILITY');
  });
}

test('the value belongs to the app: sync never lists the declaration and an app-edited private survives sync --write', async () => {
  const root = scaffold({ edition: 'lite' });
  const { targets } = await renderRepo(root, { presets: PRESETS, parseYaml });
  assert.equal(targets.some((target) => target.path.startsWith('.starcistacks/') && target.path.endsWith('application-stacks.yaml')), false);
  const file = declarationFile(root);
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('visibility: public', 'visibility: private'));
  const before = fs.readFileSync(file, 'utf8');
  const out = [];
  await runSync(['--write'], { cwd: root, out: (line) => out.push(line), presets: PRESETS, parseYaml });
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  assert.equal(registryOf(root).visibility, 'private');
});

test('the validator accepts public and private and rejects any other value', () => {
  const root = scaffold({ edition: 'lite' });
  const file = declarationFile(root);
  const original = fs.readFileSync(file, 'utf8');
  for (const value of ['private', 'public']) {
    fs.writeFileSync(file, original.replace('visibility: public', `visibility: ${value}`));
    assert.equal(loadDeployConfig({ repoRoot: root, env: 'production' }).registry.visibility, value);
  }
  for (const value of ['internal', 'PUBLIC', '"true"', 'none']) {
    fs.writeFileSync(file, original.replace('visibility: public', `visibility: ${value}`));
    assert.throws(() => loadDeployConfig({ repoRoot: root, env: 'production' }), /deploy\.registry\.visibility: must be one of public, private/u, value);
  }
});

for (const edition of ['lite', 'full']) {
  test(`${edition}: the scaffold ships .gitattributes that keep scripts and .starcistacks data LF`, () => {
    const text = fs.readFileSync(path.join(scaffold({ edition }), '.gitattributes'), 'utf8');
    for (const line of ['*.sh text eol=lf', '*.mjs text eol=lf', '.starcistacks/** text eol=lf', '.starcistacks/**/*.enc binary']) assert.ok(text.split(/\r?\n/u).includes(line), line);
  });
}
