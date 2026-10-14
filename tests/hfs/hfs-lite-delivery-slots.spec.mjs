// Delivery slots add optional product tooling without changing managed codegen, side placement or lite's infrastructure boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkAppRoot, trackedTreeView } from '../../scripts/hfs/architecture/hfs.mjs';
import { loadSlotManifest, openHfs } from '../../scripts/hfs/slots.mjs';
import { stacksFindings } from '../../scripts/hfs/rules/stacks.mjs';
import { renderTargets, writeTargets } from '../../packages/hfs/sync/index.mjs';

const declaration = edition => ({
  hfs: 3,
  kind: 'app',
  project: 'delivery',
  edition,
  sides: {
    be: { apps: [{ name: 'api', kind: 'api' }] },
    fe: { apps: [{ name: 'web', kind: 'next' }] },
  },
});
const manifest = loadSlotManifest();
const temporaryRoot = t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-lite-delivery-slots-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
};

test('delivery slots preserve full script ownership and the managed database workflow in both editions', () => {
  for (const edition of ['full', 'lite']) {
    const resolver = openHfs({ declaration: declaration(edition), manifest });
    const scriptSlot = edition === 'lite' ? 'app.scripts.delivery' : 'app.scripts';
    for (const [file, slot] of [
      ['deploy/compose.yaml', 'app.deploy'],
      ['deploy/production/Caddyfile', 'app.deploy'],
      ['.github/workflows/api-deploy.yml', 'app.ci-deploy'],
      ['.github/workflows/web-deploy.yml', 'app.ci-deploy'],
      ['.github/workflows/authorize-deploy-key.yml', 'app.ci-authorize-deploy-key'],
      ['.github/workflows/db-deploy.yml', 'app.ci-db'],
      ['scripts/env-sync.mjs', scriptSlot],
      ['scripts/with-secrets.mjs', scriptSlot],
      ['scripts/set-secrets.ps1', scriptSlot],
      ['scripts/build-api.mjs', scriptSlot],
      ['scripts/build-web.mjs', scriptSlot],
      ['scripts/codegen.mjs', 'app.scripts'],
    ]) {
      const classified = resolver.classifyPath(file);
      assert.deepEqual([classified.status, classified.slot, classified.tracking], ['owned', slot, 'tracked'], `${edition}: ${file}`);
    }
  }
});

test('lite delivery does not admit unrelated scripts, workflows or tooling inside either side', t => {
  const resolver = openHfs({ declaration: declaration('lite'), manifest });
  for (const file of [
    'scripts/deploy.mjs', 'scripts/env-sync.cjs', 'scripts/set-secrets.mjs', 'scripts/build-api.ps1',
    'scripts/ops/build-api.mjs', '.github/workflows/deploy.yml', '.github/workflows/api-deploy.yaml',
    '.github/workflows/authorize-deploy-key.yaml', '.github/workflows/release.yml',
    'be/deploy/compose.yaml', 'fe/deploy/compose.yaml', 'be/scripts/env-sync.mjs', 'fe/scripts/build-web.mjs',
  ]) assert.notEqual(resolver.classifyPath(file).status, 'owned', file);
  assert.deepEqual([resolver.classifyPath('.github/workflows/e2e.yml').status, resolver.classifyPath('.github/workflows/e2e.yml').slot], ['forbidden', 'app.ci-e2e']);
  const infrastructure = '.starcistacks/prod/infra/compose/compose.yaml';
  assert.deepEqual(stacksFindings({ repoRoot: temporaryRoot(t), files: [infrastructure], resolver }).map(item => [item.path, item.code]), [[infrastructure, 'HFS_STACKS_SHAPE']]);
});

test('deploy is an allowed optional app-root entry, while unrelated roots remain forbidden', t => {
  const root = temporaryRoot(t);
  for (const edition of ['full', 'lite']) {
    const resolver = openHfs({ declaration: declaration(edition), manifest });
    const tree = trackedTreeView(['deploy/compose.yaml', 'delivery/compose.yaml']);
    const violations = checkAppRoot({ root, resolver, tree }).violations;
    assert.deepEqual(violations.filter(item => item.ruleId === 'HFS_ROOT_ENTRY_FORBIDDEN').map(item => item.path), ['delivery'], edition);
    const required = resolver.requiredPaths().paths.map(item => item.path);
    assert.ok(!required.some(file => file.startsWith('deploy/')), `${edition}: delivery is optional`);
    assert.ok(!required.some(file => file.startsWith('scripts/build-')), `${edition}: delivery scripts are optional`);
  }
});

test('lite sync refreshes managed codegen and leaves authored delivery tooling intact', t => {
  const root = temporaryRoot(t);
  const files = {
    'deploy/compose.yaml': 'services: {}\n',
    'deploy/Caddyfile': 'localhost {\n  respond "OK"\n}\n',
    'deploy/app.env.example': 'APP_DOMAIN=example.invalid\n',
    'deploy/ops/restart.sh': '#!/bin/sh\nexit 0\n',
    '.github/workflows/api-deploy.yml': 'on: workflow_dispatch\n',
    '.github/workflows/authorize-deploy-key.yml': 'on: workflow_dispatch\n',
    'scripts/env-sync.mjs': 'export {};\n',
    'scripts/with-secrets.mjs': 'export {};\n',
    'scripts/set-secrets.ps1': 'Write-Output "example"\n',
    'scripts/build-api.mjs': 'export {};\n',
  };
  for (const [file, content] of Object.entries(files)) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  fs.writeFileSync(path.join(root, 'scripts/codegen.mjs'), 'export {};\n');
  const targets = renderTargets(declaration('lite'), { sonarExclusions: [] }, { manifest });
  const written = writeTargets(root, targets);
  assert.ok(written.includes('scripts/codegen.mjs'), 'the existing managed codegen target is refreshed');
  for (const [file, content] of Object.entries(files)) {
    assert.ok(!written.includes(file), `${file} is product-owned`);
    assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), content, file);
  }
  assert.equal(fs.readFileSync(path.join(root, 'scripts/codegen.mjs'), 'utf8'), targets.find(target => target.path === 'scripts/codegen.mjs').content);
});
