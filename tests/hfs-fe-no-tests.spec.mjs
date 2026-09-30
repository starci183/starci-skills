import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkRepo } from '../scripts/lib/hfs-check.mjs';
import { feNoTestsFindings, isFeTestPath } from '../scripts/lib/hfs-rules/fe-no-tests.mjs';

// FE_NO_TESTS (R97): a front-end repository has no tests by standard, and no exception.
const FE = { hfs: 1, profile: 'fe', project: 'demo', apps: [{ name: 'web', kind: 'next' }] };

const tree = (t, files) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-fe-no-tests-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), typeof content === 'string' ? content : JSON.stringify(content));
  }
  return dir;
};
const pathsOf = (findings) => findings.map((finding) => finding.path).sort();

test('FE_NO_TESTS: a spec, an e2e file, a test directory and a test-tool file anywhere are findings, scripts/ included', (t) => {
  const files = [
    'apps/web/src/components/leaves/Text/index.spec.tsx', 'apps/web/src/modules/api/client.test.ts', 'e2e/flows/sign-in.e2e-spec.ts',
    'e2e/support/backend-double.ts', 'apps/web/src/__tests__/a.ts', 'apps/web/src/__mocks__/next-intl.ts', 'apps/web/src/test-support/mock-result.ts', 'scripts/check-i18n.spec.mjs', 'vitest.config.ts', 'apps/web/vitest.setup.ts',
    'playwright.config.ts', 'jest.config.js', 'tsconfig.e2e.json', '.github/workflows/e2e.yml',
  ];
  const findings = feNoTestsFindings({ repoRoot: tree(t, {}), files });
  assert.deepEqual(pathsOf(findings), [...files].sort());
  assert.ok(findings.every((finding) => finding.code === 'FE_NO_TESTS' && finding.level === 'error'));
});

test('FE_NO_TESTS: files that only look like tests are not findings (latest.ts, protest.ts, api-spec.md, the app source and the managed configuration)', (t) => {
  const files = [
    'apps/web/src/modules/api/latest.ts', 'apps/web/src/modules/protest.ts', 'docs/guides/api-spec.md', 'apps/web/src/app/[locale]/page.tsx',
    'scripts/check-quality.mjs', 'eslint.config.mjs', 'stylelint.config.mjs', 'turbo.json', 'tsconfig.json', 'apps/web/next.config.ts', 'e2e-notes.md',
  ];
  assert.deepEqual(feNoTestsFindings({ repoRoot: tree(t, {}), files }), []);
  for (const file of files) assert.equal(isFeTestPath(file), false, file);
});

test('FE_NO_TESTS: a test script and a test dependency in any package.json are findings, one per script and dependency', (t) => {
  const root = { name: 'demo', scripts: { test: 'vitest run', 'test:ci': 'node --test scripts/', pretest: 'npm run codegen', 'test:e2e': 'playwright test', build: 'next build' }, devDependencies: { vitest: '3.2.7', '@testing-library/react': '16.0.0', jsdom: '29.0.0', typescript: '6.0.3' } };
  const app = { name: 'web', scripts: { unit: 'jest --runInBand' }, dependencies: { next: '16.1.6' }, peerDependencies: { '@playwright/test': '1.63.0' } };
  const findings = feNoTestsFindings({ repoRoot: tree(t, { 'package.json': root, 'apps/web/package.json': app }), files: ['package.json', 'apps/web/package.json'] });
  const messages = findings.map((finding) => finding.message.split(' ').slice(0, 3).join(' '));
  assert.equal(findings.length, 4 + 3 + 1 + 1, JSON.stringify(messages));
  assert.ok(findings.some((finding) => finding.path === 'apps/web/package.json' && /script unit is a test script/.test(finding.message)));
  assert.ok(findings.some((finding) => /devDependencies names @testing-library\/react/.test(finding.message)));
  assert.ok(!findings.some((finding) => /typescript|next build|next\b.*dependency/.test(finding.message)));
});

test('FE_NO_TESTS: a package.json with only build and lint scripts and no test dependency is clean', (t) => {
  const manifest = { name: 'demo', scripts: { build: 'next build', lint: 'eslint . --max-warnings=0', typecheck: 'tsc --noEmit', 'lint:fix': 'hfs lint --fix' }, devDependencies: { typescript: '6.0.3', eslint: '9.18.0' }, dependencies: { next: '16.1.6', react: '19.2.3' } };
  assert.deepEqual(feNoTestsFindings({ repoRoot: tree(t, { 'package.json': manifest }), files: ['package.json'] }), []);
});

test('hfs check of a front end reports a test file once, as FE_NO_TESTS, and not as an undeclared slot', (t) => {
  const files = ['apps/web/src/components/leaves/Text/index.spec.tsx', 'e2e/flows/sign-in.e2e-spec.ts', 'vitest.config.ts', 'scripts/a.spec.mjs'];
  const result = checkRepo({ repoRoot: tree(t, {}), declaration: FE, files, tree: false });
  const forTests = result.findings.filter((finding) => files.includes(finding.path));
  assert.deepEqual(forTests.map((finding) => finding.code), ['FE_NO_TESTS', 'FE_NO_TESTS', 'FE_NO_TESTS', 'FE_NO_TESTS']);
  assert.equal(result.findings.find((finding) => finding.code === 'FE_NO_TESTS').titleVi.length > 0, true, 'the finding carries its Vietnamese why');
});

test('hfs check of a front end without a test file has no FE_NO_TESTS finding, and a back end is not judged by it', (t) => {
  const clean = checkRepo({ repoRoot: tree(t, {}), declaration: FE, files: ['apps/web/src/app/[locale]/page.tsx', 'scripts/check-quality.mjs'], tree: false });
  assert.equal(clean.findings.some((finding) => finding.code === 'FE_NO_TESTS'), false);
  const backend = { hfs: 1, profile: 'be', project: 'demo', apps: [{ name: 'core', kind: 'api' }, { name: 'migrate', kind: 'migrate' }] };
  const be = checkRepo({ repoRoot: tree(t, {}), declaration: backend, files: ['src/features/orders/application/place-order.service.spec.ts', 'jest.config.js'], tree: false });
  assert.equal(be.findings.some((finding) => finding.code === 'FE_NO_TESTS'), false);
});
