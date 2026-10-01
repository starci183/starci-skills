import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkHfs, checkHfsWithoutConfig } from '../../scripts/hfs/architecture/hfs.mjs';
import { appDeclarationText, DEFAULT_APPS } from '../helpers/hfs-arch-fixture.mjs';
import { repositoryName } from '../../scripts/hfs/repo-identity.mjs';

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

/** A temp app (kind: app hfs.json at its root, the be side under be/) holding `files` (app-relative). */
const withFiles = (t, files) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hk-e2e-manual-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [file, content] of Object.entries({ 'hfs.json': appDeclarationText('be', { apps: DEFAULT_APPS.be }), ...files })) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }
  return root;
};
// The hooks, the root scripts, the workflows and the be side's jest configuration are the app root's (checkAppRoot); the
// default tsconfig is the be side's own (checkHfs over be/).
const inAutomaticGate = (root) => [
  ...checkHfsWithoutConfig(root).violations,
  ...checkHfs({ root: path.join(root, 'be'), kinds: ['backend'] }).violations.map(item => ({ ...item, path: `be/${item.path}` })),
].filter(item => item.ruleId === 'HFS_E2E_IN_AUTOMATIC_GATE')
  .map(item => `${item.path}: ${item.message.replace(item.path, '~').split('. ')[0].replace(/\.$/u, '')}`).sort();
const CLEAN_APP = {
  'be/src/tests/e2e/a.e2e-spec.ts': 'export {}',
  'be/tsconfig.json': JSON.stringify({ include: ['src/**/*'], exclude: ['src/tests/world/**', 'src/tests/integration/**', 'src/tests/e2e/**', 'src/tests/contract/**'] }),
  'be/jest.config.js': 'module.exports = { collectCoverageFrom: ["src/**/*.ts", "!src/tests/**"] }',
  'package.json': JSON.stringify({
    scripts: { typecheck: 'cd be && tsc --noEmit', 'typecheck:tests': 'cd be && tsc -p src/tests/tsconfig.json', 'test:unit': 'cd be && jest --selectProjects unit', 'test:integration': 'cd be && jest --selectProjects integration', 'test:e2e': 'cd be && jest --selectProjects e2e', 'test:contract': 'cd be && jest --selectProjects contract', 'lint:check': 'eslint . --ignore-pattern "src/tests/e2e/**"' },
    'lint-staged': { '*.ts': "eslint --fix --ignore-pattern 'src/tests/e2e/**'" },
  }),
  '.husky/pre-push': 'npm run lint && npm run test:unit\n',
  '.github/workflows/ci.yml': 'on:\n  push:\n    branches: [main]\njobs:\n  unit:\n    steps:\n      - run: npm run test:unit\n',
  '.github/workflows/e2e.yml': 'on:\n  workflow_dispatch:\njobs:\n  e2e:\n    steps:\n      - run: npm run test:e2e\n',
};

test('integration, e2e and contract stay out of hooks, default typecheck, coverage and automatic CI (manual-only ruling)', t => {
  assert.deepEqual(inAutomaticGate(withFiles(t, CLEAN_APP)), []);
  const dirty = withFiles(t, {
    ...CLEAN_APP,
    'be/tsconfig.json': JSON.stringify({ include: ['src/**/*'] }),
    'be/jest.config.js': 'module.exports = { collectCoverageFrom: ["src/**/*.ts"] }',
    'package.json': JSON.stringify({ scripts: { typecheck: 'cd be && tsc --noEmit && npm run typecheck:tests', 'test:ci': 'cd be && jest --coverage', 'test:affected': 'cd be && jest --selectProjects unit', 'test:unit': 'cd be && jest --selectProjects unit' } }),
    '.husky/pre-push': 'npm run typecheck && npm run test:e2e\n',
    '.github/workflows/ci.yml': 'on:\n  pull_request:\njobs:\n  e2e:\n    steps:\n      - run: npm run test:e2e\n',
  });
  assert.deepEqual(inAutomaticGate(dirty), [
    '.github/workflows/ci.yml: ~ runs e2e on push or pull_request',
    '.husky/pre-push: ~ runs integration, e2e or contract',
    'be/jest.config.js: collectCoverageFrom must exclude src/tests/** so no integration, e2e or contract file counts toward coverage',
    'be/tsconfig.json: The default tsconfig includes src/tests/{world,integration,e2e,contract}/**',
    'package.json: Script test:ci runs jest without --selectProjects unit and would run the integration, e2e or contract project',
    'package.json: Script typecheck is run by a husky hook and touches integration, e2e or contract',
  ]);
});

test('a worktree and its main checkout are one repository name', () => {
  assert.equal(repositoryName(path.resolve('examples', 'todo-app')), 'todo-app');
});
