// proves: HFS_MONO_WORKSPACES@lite
// proves: HFS_MONO_WORKSPACES@full
// proves: HFS_MONO_FE_WORKSPACE@lite
// proves: HFS_MONO_FE_WORKSPACE@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { monorepoFindings } from '../../scripts/hfs/rules/monorepo.mjs';

const pins = parseYaml(fs.readFileSync(new URL('../../knowledge/hfs/canon-pins.yaml', import.meta.url), 'utf8')).pins;
const appTemplate = fs.readFileSync(new URL('../../packages/hfs/templates/fe/app/package.json.tpl', import.meta.url), 'utf8');
const taskGraphTemplate = fs.readFileSync(new URL('../../packages/hfs/templates/app/task-graph/turbo.json', import.meta.url), 'utf8');
const ROOT_MANIFEST = 'package.json';
const APP_MANIFEST = 'fe/apps/web/package.json';
const PACKAGE_MANIFEST = 'fe/packages/ui/package.json';

function fixture(t, edition, mutate) {
  const repo = {
    hfs: 3, kind: 'app', edition, project: 'demo',
    sides: { be: { apps: [{ name: 'core', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } },
  };
  const documents = {
    'hfs.json': repo,
    [ROOT_MANIFEST]: {
      name: 'demo', private: true, workspaces: ['fe/apps/*', 'fe/packages/*'],
      packageManager: 'npm@11.6.2', devDependencies: { turbo: pins.turbo.version },
    },
    'package-lock.json': { name: 'demo', lockfileVersion: 3, requires: true, packages: {} },
    'turbo.json': taskGraphTemplate,
    [APP_MANIFEST]: {
      name: '@demo/web', private: true, dependencies: { '@demo/ui': '*' },
      scripts: { build: 'next build', dev: 'next dev', lint: 'starci app lint --workspace .', start: 'next start', typecheck: 'tsc --noEmit' },
    },
    [PACKAGE_MANIFEST]: {
      name: '@demo/ui', private: true,
      scripts: { build: 'tsc -p tsconfig.build.json', typecheck: 'tsc --noEmit', lint: 'starci app lint --workspace .' },
    },
    'be/nest-cli.json': {
      monorepo: true, root: 'apps/core', sourceRoot: 'apps/core/src',
      projects: { core: { type: 'application', root: 'apps/core', sourceRoot: 'apps/core/src' } },
    },
  };
  if (mutate) mutate(documents);
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-monorepo-coverage-'));
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  for (const [file, value] of Object.entries(documents)) {
    const absolute = path.join(repoRoot, ...file.split('/'));
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    let text = typeof value === 'string' ? value : `${JSON.stringify(value)}\n`;
    // add-app binds packageJson to the edition-matched workspace manifest this way.
    if (file === APP_MANIFEST && typeof value !== 'string') text = appTemplate.replace('{{packageJson}}', text.trimEnd());
    fs.writeFileSync(absolute, text);
  }
  return { repoRoot, files: Object.keys(documents), repo };
}

for (const edition of ['lite', 'full']) {
  test(`${edition} accepts a valid root manifest and private front-end app and package workspaces`, (t) => {
    assert.deepEqual(monorepoFindings(fixture(t, edition)), []);
  });

  test(`${edition} rejects invalid root workspaces, package manager and missing turbo`, (t) => {
    const mutations = [
      (files) => { files[ROOT_MANIFEST].workspaces = ['fe/packages/*']; },
      (files) => { files[ROOT_MANIFEST].workspaces.reverse(); },
      (files) => { files[ROOT_MANIFEST].packageManager = 'npm@^11'; },
      (files) => { delete files[ROOT_MANIFEST].packageManager; },
      (files) => { delete files[ROOT_MANIFEST].devDependencies.turbo; },
    ];
    for (const mutate of mutations) {
      const findings = monorepoFindings(fixture(t, edition, mutate));
      assert.deepEqual(findings.map(({ code }) => code), ['HFS_MONO_WORKSPACES']);
      assert.deepEqual(findings.map(({ path: file }) => file), [ROOT_MANIFEST]);
    }
  });

  test(`${edition} rejects invalid front-end workspace manifests`, (t) => {
    const mutations = [
      (files) => { files[APP_MANIFEST] = '{'; },
      (files) => { files[APP_MANIFEST].name = 'web'; },
      (files) => { files[APP_MANIFEST].private = false; },
      (files) => { files[APP_MANIFEST].scripts.lint = 'eslint .'; },
      (files) => { files[APP_MANIFEST].scripts.test = 'jest'; },
      (files) => { files[PACKAGE_MANIFEST].private = false; },
      (files) => { delete files[PACKAGE_MANIFEST].scripts.build; },
      (files) => { files[PACKAGE_MANIFEST].scripts.lint = 'eslint src'; },
    ];
    for (const mutate of mutations) {
      const findings = monorepoFindings(fixture(t, edition, mutate));
      assert.deepEqual(findings.map(({ code }) => code), ['HFS_MONO_FE_WORKSPACE']);
      assert.ok(findings.every(({ path: file }) => [APP_MANIFEST, PACKAGE_MANIFEST].includes(file)));
    }
  });
}
