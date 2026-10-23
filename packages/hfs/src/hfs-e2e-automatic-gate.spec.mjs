// proves: HFS_E2E_IN_AUTOMATIC_GATE@lite
// proves: HFS_E2E_IN_AUTOMATIC_GATE@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkHfsWithoutConfig } from '../runtime/scripts/hfs/architecture/hfs.mjs';

const CODE = 'HFS_E2E_IN_AUTOMATIC_GATE';
const cleanFiles = {
  'package.json': JSON.stringify({
    private: true,
    scripts: {
      'test:unit': 'jest --selectProjects unit',
      'test:e2e': 'jest --selectProjects e2e',
    },
  }),
  '.husky/pre-push': 'npm run test:unit\n',
  '.github/workflows/ci.yml': 'on:\n  push:\n    branches: [main]\njobs:\n  unit:\n    steps:\n      - run: npm run test:unit\n',
  '.github/workflows/e2e.yml': 'on:\n  workflow_dispatch:\njobs:\n  e2e:\n    steps:\n      - run: npm run test:e2e\n',
};

function appFixture(t, edition, files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-e2e-gate-proof-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const declaration = JSON.stringify({
    hfs: 3, kind: 'app', project: 'proof', edition,
    sides: { be: { apps: [{ name: 'api', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } },
  });
  for (const [relative, content] of Object.entries({ 'hfs.json': declaration, ...cleanFiles, ...files })) {
    const target = path.join(root, ...relative.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return root;
}

const automaticFindings = root => checkHfsWithoutConfig(root).violations
  .filter(item => item.ruleId === CODE);

for (const edition of ['lite', 'full']) {
  test(`${edition} passes unit-only automatic gates with manually dispatched e2e`, t => {
    assert.deepEqual(automaticFindings(appFixture(t, edition)), []);
  });

  test(`${edition} rejects e2e in an automatic hook (HFS_E2E_IN_AUTOMATIC_GATE)`, t => {
    const root = appFixture(t, edition, { '.husky/pre-push': 'npm run test:e2e\n' });
    assert.ok(automaticFindings(root).some(item => item.ruleId === CODE && item.path === '.husky/pre-push'));
  });

  test(`${edition} rejects e2e in a pull-request workflow (HFS_E2E_IN_AUTOMATIC_GATE)`, t => {
    const root = appFixture(t, edition, {
      '.github/workflows/ci.yml': 'on:\n  pull_request:\njobs:\n  e2e:\n    steps:\n      - run: npm run test:e2e\n',
    });
    assert.ok(automaticFindings(root).some(item => item.ruleId === CODE && item.path === '.github/workflows/ci.yml'));
  });
}
