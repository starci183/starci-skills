import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkHfs } from '../scripts/checks/architecture/hfs.mjs';
import { repositoryName } from '../scripts/lib/repo-identity.mjs';

const tree = (t, files) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-test-kinds-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), '');
  }
  return root;
};
const retired = (root, kinds) => checkHfs({ root, kinds }).violations.filter(item => item.ruleId === 'HFS_TEST_KIND_RETIRED').map(item => item.path).sort();

test('the retired integration and harness test kinds are flagged; unit and e2e are not', t => {
  const root = tree(t, ['src/tests/e2e/checkout/flow.e2e-spec.ts', 'src/tests/e2e/setup/global-setup.ts', 'src/tests/fixtures/data.json',
    'src/modules/domain/cart/cart.service.spec.ts', 'src/modules/domain/cart/schema.int-spec.ts', 'src/tests/harness/world.ts',
    'src/tests/integration/db.ts', 'src/tests/e2e/lane.harness-spec.ts', 'src/tests/e2e/jest.config.js']);
  assert.deepEqual(retired(root, ['backend']), ['src/modules/domain/cart/schema.int-spec.ts', 'src/tests/e2e/jest.config.js',
    'src/tests/e2e/lane.harness-spec.ts', 'src/tests/harness/world.ts', 'src/tests/integration/db.ts']);
});

test('a frontend Playwright spec must be *.e2e-spec.ts and only one root playwright.config.ts exists', t => {
  const root = tree(t, ['e2e/flows/sign-in.e2e-spec.ts', 'e2e/flows/old.spec.ts', 'playwright.config.ts', 'e2e/playwright.config.ts']);
  assert.deepEqual(retired(root, ['frontend']), ['e2e/flows/old.spec.ts', 'e2e/playwright.config.ts']);
});

test('a worktree and its main checkout are one repository name', () => {
  assert.equal(repositoryName(path.resolve('examples', 'todo-app-frontend')), 'todo-app-frontend');
});
