import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkHfs } from '../scripts/checks/architecture/hfs.mjs';
import { repositoryName } from '../scripts/lib/repo-identity.mjs';

const tree = (t, files) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hk-test-kinds-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), '');
  }
  return root;
};
const retired = (root, kinds) => checkHfs({ root, kinds }).violations.filter(item => item.ruleId === 'HFS_TEST_KIND_RETIRED').map(item => item.path).sort();

test('the retired int-spec, harness and live test kinds are flagged; unit, integration, e2e and contract are not', t => {
  const root = tree(t, ['src/tests/e2e/checkout/flow.e2e-spec.ts', 'src/tests/world/global-setup.ts', 'src/tests/fixtures/data.json',
    'src/tests/integration/inbox/claim.integration-spec.ts', 'src/tests/contract/stripe/charge.contract-spec.ts',
    'src/modules/domain/cart/cart.service.spec.ts', 'src/modules/domain/cart/schema.int-spec.ts', 'src/tests/harness/world.ts',
    'src/tests/live/pay.e2e-spec.ts', 'src/tests/e2e/live/payos/hook.e2e-spec.ts', 'src/tests/e2e/lane.harness-spec.ts', 'src/tests/e2e/jest.config.js']);
  assert.deepEqual(retired(root, ['backend']), ['src/modules/domain/cart/schema.int-spec.ts', 'src/tests/e2e/jest.config.js',
    'src/tests/e2e/lane.harness-spec.ts', 'src/tests/e2e/live/payos/hook.e2e-spec.ts', 'src/tests/harness/world.ts', 'src/tests/live/pay.e2e-spec.ts']);
});

test('a frontend Playwright spec must be *.e2e-spec.ts and only one root playwright.config.ts exists', t => {
  const root = tree(t, ['e2e/flows/sign-in.e2e-spec.ts', 'e2e/flows/old.spec.ts', 'playwright.config.ts', 'e2e/playwright.config.ts']);
  assert.deepEqual(retired(root, ['frontend']), ['e2e/flows/old.spec.ts', 'e2e/playwright.config.ts']);
});

const withFiles = (t, files) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hk-e2e-manual-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }
  return root;
};
const inAutomaticGate = (root, kinds) => checkHfs({ root, kinds }).violations.filter(item => item.ruleId === 'HFS_E2E_IN_AUTOMATIC_GATE')
  .map(item => `${item.path}: ${item.message.replace(item.path, '~').split('. ')[0].replace(/\.$/u, '')}`).sort();
const CLEAN_BACKEND = {
  'src/tests/e2e/a.e2e-spec.ts': 'export {}',
  'tsconfig.json': JSON.stringify({ include: ['src/**/*'], exclude: ['src/tests/world/**', 'src/tests/integration/**', 'src/tests/e2e/**', 'src/tests/contract/**'] }),
  'jest.config.js': 'module.exports = { collectCoverageFrom: ["src/**/*.ts", "!src/tests/**"] }',
  'package.json': JSON.stringify({
    scripts: { typecheck: 'tsc --noEmit', 'typecheck:tests': 'tsc -p src/tests/tsconfig.json', 'test:unit': 'jest --selectProjects unit', 'test:integration': 'jest --selectProjects integration', 'test:e2e': 'jest --selectProjects e2e', 'test:contract': 'jest --selectProjects contract', 'lint:check': 'eslint . --ignore-pattern "src/tests/e2e/**"' },
    'lint-staged': { '*.ts': "eslint --fix --ignore-pattern 'src/tests/e2e/**'" },
  }),
  '.husky/pre-push': 'npm run lint:check && npm run test:unit\n',
  '.github/workflows/ci.yml': 'on:\n  push:\n    branches: [main]\njobs:\n  unit:\n    steps:\n      - run: npm run test:unit\n',
  '.github/workflows/e2e.yml': 'on:\n  workflow_dispatch:\njobs:\n  e2e:\n    steps:\n      - run: npm run test:e2e\n',
};

test('integration, e2e and contract stay out of hooks, default typecheck, coverage and automatic CI (manual-only ruling)', t => {
  assert.deepEqual(inAutomaticGate(withFiles(t, CLEAN_BACKEND), ['backend']), []);
  const dirty = withFiles(t, {
    ...CLEAN_BACKEND,
    'tsconfig.json': JSON.stringify({ include: ['src/**/*'] }),
    'jest.config.js': 'module.exports = { collectCoverageFrom: ["src/**/*.ts"] }',
    'package.json': JSON.stringify({ scripts: { typecheck: 'tsc --noEmit && npm run typecheck:tests', 'test:ci': 'jest --coverage', 'test:affected': 'jest --selectProjects unit', 'test:unit': 'jest --selectProjects unit' } }),
    '.husky/pre-push': 'npm run typecheck && npm run test:e2e\n',
    '.github/workflows/ci.yml': 'on:\n  pull_request:\njobs:\n  e2e:\n    steps:\n      - run: npm run test:e2e\n',
  });
  assert.deepEqual(inAutomaticGate(dirty, ['backend']), [
    '.github/workflows/ci.yml: ~ runs e2e on push or pull_request',
    '.husky/pre-push: ~ runs integration, e2e or contract',
    'jest.config.js: collectCoverageFrom must exclude src/tests/** so no integration, e2e or contract file counts toward coverage',
    'package.json: Script test:ci runs jest without --selectProjects unit and would run the integration, e2e or contract project',
    'package.json: Script typecheck is run by a husky hook and touches integration, e2e or contract',
    'tsconfig.json: The default tsconfig includes src/tests/{world,integration,e2e,contract}/**',
  ]);
});

test('a frontend root tsconfig must exclude e2e/**, and lint-staged must not run e2e', t => {
  const files = { 'e2e/flows/a.e2e-spec.ts': 'export {}', 'tsconfig.json': JSON.stringify({ compilerOptions: {} }), 'package.json': JSON.stringify({ 'lint-staged': { '*.ts': 'playwright test' } }) };
  assert.deepEqual(inAutomaticGate(withFiles(t, files), ['frontend']), [
    'package.json: lint-staged runs an integration, e2e or contract command',
    'tsconfig.json: The root tsconfig includes e2e/**',
  ]);
  assert.deepEqual(inAutomaticGate(withFiles(t, { ...files, 'tsconfig.json': JSON.stringify({ exclude: ['e2e/**'] }), 'package.json': '{}' }), ['frontend']), []);
});

test('a worktree and its main checkout are one repository name', () => {
  assert.equal(repositoryName(path.resolve('examples', 'todo-app-frontend')), 'todo-app-frontend');
});
