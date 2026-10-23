// proves: HFS_SERVICE_PLACEMENT@lite
// proves: HFS_SERVICE_PLACEMENT@full
// proves: HFS_IMAGE_UNPINNED@lite
// proves: HFS_IMAGE_UNPINNED@full
// proves: HFS_SERVICE_STACK_DECLARATION@lite
// proves: HFS_SERVICE_STACK_DECLARATION@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { serviceFindings } from '../runtime/scripts/hfs/rules/services.mjs';

const STACK_FILE = '.starcistacks/application-stacks.yaml';
const TEMP_PREFIX = path.join(os.tmpdir(), 'hfs-services-coverage-');
const APPS = [{ name: 'core', kind: 'api' }, { name: 'billing', kind: 'worker' }];

function stack({ image = 'demo/core:1.2.3', billingRole = 'service' } = {}) {
  return [
    'components:',
    '  core:',
    `    image: ${image}`,
    '    role: service',
    '  billing:',
    '    image: demo/billing:2.3.4',
    `    role: ${billingRole}`,
    '',
  ].join('\n');
}

function findings(t, edition, contents, code) {
  const repoRoot = fs.mkdtempSync(TEMP_PREFIX);
  assert.ok(path.resolve(repoRoot).startsWith(TEMP_PREFIX));
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  for (const [file, text] of Object.entries(contents)) {
    const target = path.join(repoRoot, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }
  const repo = { edition, sides: { be: { apps: APPS } } };
  return serviceFindings({ repoRoot, files: Object.keys(contents), repo })
    .filter((finding) => finding.code === code).map((finding) => finding.code);
}

for (const edition of ['lite', 'full']) {
  test(`${edition} HFS_SERVICE_PLACEMENT rejects a second service root`, (t) => {
    assert.deepEqual(findings(t, edition, {
      'services/billing/Dockerfile': 'FROM node:24.0.0\n',
    }, 'HFS_SERVICE_PLACEMENT'), ['HFS_SERVICE_PLACEMENT']);
  });

  test(`${edition} HFS_SERVICE_PLACEMENT accepts app images and shared package ownership`, (t) => {
    assert.deepEqual(findings(t, edition, {
      'be/apps/core/Dockerfile': 'FROM node:24.0.0\n',
      'fe/apps/web/Dockerfile': 'FROM node:24.0.0\n',
      'package.json': '{}\n',
      'fe/packages/ui/package.json': '{}\n',
    }, 'HFS_SERVICE_PLACEMENT'), []);
  });

  test(`${edition} HFS_IMAGE_UNPINNED rejects a moving service image`, (t) => {
    assert.deepEqual(findings(t, edition, {
      [STACK_FILE]: stack({ image: 'demo/core:latest' }),
    }, 'HFS_IMAGE_UNPINNED'), ['HFS_IMAGE_UNPINNED']);
  });

  test(`${edition} HFS_IMAGE_UNPINNED accepts exact versions for every component`, (t) => {
    assert.deepEqual(findings(t, edition, {
      [STACK_FILE]: stack(),
    }, 'HFS_IMAGE_UNPINNED'), []);
  });

  test(`${edition} HFS_SERVICE_STACK_DECLARATION rejects a service with a stateful role`, (t) => {
    assert.deepEqual(findings(t, edition, {
      [STACK_FILE]: stack({ billingRole: 'stateful' }),
    }, 'HFS_SERVICE_STACK_DECLARATION'), ['HFS_SERVICE_STACK_DECLARATION']);
  });

  test(`${edition} HFS_SERVICE_STACK_DECLARATION accepts every declared app as a service component`, (t) => {
    assert.deepEqual(findings(t, edition, {
      [STACK_FILE]: stack(),
    }, 'HFS_SERVICE_STACK_DECLARATION'), []);
  });
}
