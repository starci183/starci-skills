// proves: HFS_E2E_IN_AUTOMATIC_GATE@lite
// proves: HFS_E2E_IN_AUTOMATIC_GATE@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkHfsWithoutConfig } from '../../scripts/hfs/architecture/hfs.mjs';

const examples = { lite: 'lite-app', full: 'ecommerce-app' };
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
  const declaration = fs.readFileSync(new URL(`../../examples/${examples[edition]}/hfs.json`, import.meta.url), 'utf8');
  for (const [relative, content] of Object.entries({ 'hfs.json': declaration, ...cleanFiles, ...files })) {
    const target = path.join(root, ...relative.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return root;
}

const automaticFindings = root => checkHfsWithoutConfig(root).violations
  .filter(item => item.ruleId === 'HFS_E2E_IN_AUTOMATIC_GATE');

for (const edition of ['lite', 'full']) {
  test(`${edition} passes unit-only automatic gates with manually dispatched e2e`, t => {
    assert.deepEqual(automaticFindings(appFixture(t, edition)), []);
  });

  test(`${edition} rejects e2e in an automatic hook`, t => {
    const root = appFixture(t, edition, { '.husky/pre-push': 'npm run test:e2e\n' });
    assert.ok(automaticFindings(root).some(item => item.ruleId === 'HFS_E2E_IN_AUTOMATIC_GATE'
      && item.path === '.husky/pre-push'));
  });

  test(`${edition} rejects e2e in a pull-request workflow`, t => {
    const root = appFixture(t, edition, {
      '.github/workflows/ci.yml': 'on:\n  pull_request:\njobs:\n  e2e:\n    steps:\n      - run: npm run test:e2e\n',
    });
    assert.ok(automaticFindings(root).some(item => item.ruleId === 'HFS_E2E_IN_AUTOMATIC_GATE'
      && item.path === '.github/workflows/ci.yml'));
  });
}
