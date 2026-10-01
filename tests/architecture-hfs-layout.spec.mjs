import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from './_hfs-arch-fixture.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkHfsWithoutConfig, checkRepoPresentation } from '../scripts/checks/architecture/hfs.mjs';

// The tree rules of the HFS machine (knowledge/hfs/README.md) over a side folder of an app, judged as the root it was when products
// were split in two repositories: HFS_APPS_REQUIRED, HFS_APP_LAYOUT_INVALID, HFS_ROOT_ENTRY_MISSING, HFS_ROOT_ENTRY_FORBIDDEN,
// HFS_ROOT_SRC_FORBIDDEN_FE, HFS_SRC_LAYOUT_INVALID; and over the app root (checkAppRoot): HFS_PACKAGE_MANAGER_MIXED and
// HFS_ROOT_MARKDOWN_FORBIDDEN. The app-root entries (README, CI, hooks, the one package.json and lock, .starciwork) are the root's.
const APP_ROOT = {
  '../.gitattributes': '* text=auto\n', '../.gitignore': 'node_modules\n', '../.github/workflows/ci.yml': 'name: ci\non: workflow_dispatch\n', '../.husky/pre-commit': 'npm run lint\n',
  '../package-lock.json': '{}\n', '../README.md': '# fixture\n', '../sonar-project.properties': 'sonar.projectKey=x\n', '../.starciwork/.keep': '',
};
const ROOT_FE = { ...APP_ROOT, 'eslint.config.mjs': 'export default [];\n', 'stylelint.config.mjs': 'export default {};\n' };
const APP_FE = Object.fromEntries(['next.config.ts', 'tsconfig.json', 'postcss.config.mjs'].map(name => [`apps/web/${name}`, name.endsWith('.json') ? '{}\n' : 'export default {};\n']));
const ROOT_BE = { ...APP_ROOT, 'eslint.config.mjs': 'export default [];\n', 'tsconfig.build.json': '{}\n', '../.sops.yaml': 'creation_rules: []\n', '../.starcistacks/application-stacks.yaml': 'services: {}\n', 'jest.config.js': 'module.exports = {};\n', 'nest-cli.json': '{}\n' };
const run = (t, profile, files) => runArch(archFixture(t, { profile, files }));
/** The app-root tree findings over the app whose side folder `side` is. */
const rootRun = (t, files) => checkHfsWithoutConfig(path.dirname(archFixture(t, { profile: 'fe', files })));
const ids = (report, id) => findings(report, id).map(item => item.path).sort();

test('HFS_APPS_REQUIRED: a side with no apps/ directory is a finding; one application under apps/ is not', t => {
  const none = run(t, 'fe', { 'apps/web/src/app/.keep': null, 'src/.keep': '' });
  assert.deepEqual(ids(none, 'HFS_APPS_REQUIRED'), ['apps']);
  assert.deepEqual(ids(run(t, 'fe', { ...ROOT_FE, ...APP_FE }), 'HFS_APPS_REQUIRED'), []);
});

test('HFS_APP_LAYOUT_INVALID: a front-end app without next.config.ts or postcss.config.mjs, and a back-end app without main.ts, are findings; a complete app is not', t => {
  const fe = run(t, 'fe', { ...ROOT_FE, 'apps/web/next.config.ts': 'export default {};\n' });
  assert.deepEqual(ids(fe, 'HFS_APP_LAYOUT_INVALID'), ['apps/web']);
  assert.match(findings(fe, 'HFS_APP_LAYOUT_INVALID')[0].message, /postcss\.config\.mjs/);
  const be = run(t, 'be', { ...ROOT_BE, 'apps/core/src/main.ts': null });
  assert.deepEqual(ids(be, 'HFS_APP_LAYOUT_INVALID'), ['apps/core']);
  assert.deepEqual(ids(run(t, 'fe', { ...ROOT_FE, ...APP_FE }), 'HFS_APP_LAYOUT_INVALID'), []);
});

test('HFS_ROOT_ENTRY_MISSING: a side without its required root entries names each; one holding them all names none', t => {
  const bare = run(t, 'fe', {});
  assert.ok(ids(bare, 'HFS_ROOT_ENTRY_MISSING').includes('eslint.config.mjs'));
  assert.ok(ids(bare, 'HFS_ROOT_ENTRY_MISSING').includes('stylelint.config.mjs'));
  assert.ok(!ids(bare, 'HFS_ROOT_ENTRY_MISSING').includes('README.md'), 'the README is the app root\'s, never a side\'s');
  assert.deepEqual(ids(run(t, 'fe', { ...ROOT_FE, ...APP_FE }), 'HFS_ROOT_ENTRY_MISSING'), []);
});

test('HFS_ROOT_ENTRY_FORBIDDEN: an fe side entry that is a test file or directory is FE_NO_TESTS, not a second finding; another stray entry is a finding, and the be side keeps its jest config', t => {
  const fe = run(t, 'fe', { ...ROOT_FE, ...APP_FE, 'vitest.config.ts': 'export default {};\n', 'playwright.config.ts': 'export default {};\n', 'e2e/flows/a.ts': 'export {};\n', 'stray.txt': 'x\n' });
  assert.deepEqual(ids(fe, 'HFS_ROOT_ENTRY_FORBIDDEN'), ['stray.txt']);
  assert.deepEqual(ids(run(t, 'be', { ...ROOT_BE, 'stray.txt': 'x\n' }), 'HFS_ROOT_ENTRY_FORBIDDEN'), ['stray.txt']);
});

test('HFS_ROOT_SRC_FORBIDDEN_FE: an fe side with a src/ tree is a finding; the be side has one', t => {
  assert.deepEqual(ids(run(t, 'fe', { ...ROOT_FE, ...APP_FE, 'src/shared/util.ts': 'export const a = 1;\n' }), 'HFS_ROOT_SRC_FORBIDDEN_FE'), ['src']);
  assert.deepEqual(ids(run(t, 'fe', { ...ROOT_FE, ...APP_FE }), 'HFS_ROOT_SRC_FORBIDDEN_FE'), []);
  assert.deepEqual(ids(run(t, 'be', { ...ROOT_BE, 'src/modules/domain/alpha/alpha.service.ts': 'export const a = 1;\n' }), 'HFS_ROOT_SRC_FORBIDDEN_FE'), []);
});

test('HFS_SRC_LAYOUT_INVALID: a back-end src/ child other than features, modules and tests, and a tests/ child other than world, fixtures, integration, e2e and contract, are findings', t => {
  const bad = run(t, 'be', { ...ROOT_BE, 'src/utils/x.ts': 'export const a = 1;\n', 'src/tests/helpers/y.ts': 'export const b = 1;\n', 'src/features/f/.keep': '', 'src/modules/domain/.keep': '' });
  assert.deepEqual(ids(bad, 'HFS_SRC_LAYOUT_INVALID'), ['src/tests/helpers', 'src/utils']);
  const good = run(t, 'be', { ...ROOT_BE, 'src/features/f/.keep': '', 'src/modules/domain/.keep': '', 'src/tests/world/.keep': '', 'src/tests/integration/.keep': '', 'src/tests/e2e/.keep': '', 'src/tests/contract/.keep': '', 'src/tests/fixtures/.keep': '', 'src/tests/tsconfig.json': '{}\n' });
  assert.deepEqual(ids(good, 'HFS_SRC_LAYOUT_INVALID'), [], 'src/tests/tsconfig.json is the file be.tool-config owns there');
  const stray = run(t, 'be', { ...ROOT_BE, 'src/features/f/.keep': '', 'src/modules/domain/.keep': '', 'src/tests/jest.json': '{}\n' });
  assert.deepEqual(ids(stray, 'HFS_SRC_LAYOUT_INVALID'), ['src/tests/jest.json']);
});

test('HFS_PACKAGE_MANAGER_MIXED: a yarn or pnpm lockfile at the app root, and a packageManager other than npm, are findings; npm alone is not', t => {
  const lock = rootRun(t, { ...ROOT_FE, ...APP_FE, '../yarn.lock': '\n', '../pnpm-workspace.yaml': 'packages: []\n' });
  assert.deepEqual(ids(lock, 'HFS_PACKAGE_MANAGER_MIXED'), ['pnpm-workspace.yaml', 'yarn.lock']);
  const manager = rootRun(t, { ...ROOT_FE, ...APP_FE, '../package.json': JSON.stringify({ name: 'fixture', private: true, packageManager: 'pnpm@9.0.0' }) });
  assert.deepEqual(ids(manager, 'HFS_PACKAGE_MANAGER_MIXED'), ['package.json']);
  const npm = rootRun(t, { ...ROOT_FE, ...APP_FE, '../package.json': JSON.stringify({ name: 'fixture', private: true, packageManager: 'npm@10.9.0' }) });
  assert.deepEqual(ids(npm, 'HFS_PACKAGE_MANAGER_MIXED'), []);
});

test('HFS_ROOT_MARKDOWN_FORBIDDEN: an app-root Markdown file other than README.md is a finding; README.md and docs/ Markdown of a side are not', t => {
  const bad = rootRun(t, { ...ROOT_FE, ...APP_FE, '../NOTES.md': '# notes\n', '../CHANGELOG.md': '# log\n' });
  assert.deepEqual(ids(bad, 'HFS_ROOT_MARKDOWN_FORBIDDEN'), ['CHANGELOG.md', 'NOTES.md']);
  const good = rootRun(t, { ...ROOT_FE, ...APP_FE, 'docs/notes.md': '# notes\n' });
  assert.deepEqual(ids(good, 'HFS_ROOT_MARKDOWN_FORBIDDEN'), []);
});

// The app layout, the root allowlist and the tests/ children are read from the slots (knowledge/hfs/slots.yaml), not from a list in the check.
const MIGRATE_APPS = [{ name: 'core', kind: 'api' }, { name: 'migrate', kind: 'migrate' }];
const CORE_FILES = {};
const withMigrate = (t, files) => runArch(archFixture(t, { profile: 'be', apps: MIGRATE_APPS, declaration: { connections: [{ name: 'primary', envPrefix: 'PRIMARY' }] }, files: { ...ROOT_BE, ...CORE_FILES, ...files } }));

test('HFS_APP_LAYOUT_INVALID: a migrate app needs only main.ts (no app.module.ts); an api app still needs app.module.ts', t => {
  const migrate = withMigrate(t, { 'apps/migrate/src/main.ts': 'void 0;\n' });
  assert.deepEqual(ids(migrate, 'HFS_APP_LAYOUT_INVALID'), []);
  const incomplete = withMigrate(t, { 'apps/migrate/src/migrate.options.ts': 'export {};\n' });
  assert.deepEqual(ids(incomplete, 'HFS_APP_LAYOUT_INVALID'), ['apps/migrate']);
  assert.match(findings(incomplete, 'HFS_APP_LAYOUT_INVALID')[0].message, /main\.ts/);
  assert.doesNotMatch(findings(incomplete, 'HFS_APP_LAYOUT_INVALID')[0].message, /app\.module\.ts/);
  const api = withMigrate(t, { 'apps/migrate/src/main.ts': 'void 0;\n', 'apps/core/src/app.module.ts': null });
  assert.deepEqual(ids(api, 'HFS_APP_LAYOUT_INVALID'), ['apps/core']);
  assert.match(findings(api, 'HFS_APP_LAYOUT_INVALID')[0].message, /app\.module\.ts/);
});

test('HFS_ROOT_ENTRY_FORBIDDEN: contracts/ (slot be.contract.graphql) is a be side entry; an entry no slot names is still a finding', t => {
  const declaration = { optionalSlots: ['be.contract.graphql'] };
  const report = runArch(archFixture(t, { profile: 'be', declaration, files: { ...ROOT_BE, ...CORE_FILES, 'contracts/core/schema.graphql': 'type Query { a: Int }\n', 'stray/x.txt': 'x\n' } }));
  assert.deepEqual(ids(report, 'HFS_ROOT_ENTRY_FORBIDDEN'), ['stray']);
});

test('HFS_README_DEVELOPMENT_INCOMPLETE: the Development section shows the managed scripts (npm test), not a literal test:unit', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-hfs-readme-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const readme = commands => `# ${path.basename(root)}\n\nA fixture.\n\n## Overview\n\nx\n\n## Stack\n\nx\n\n## Repository layout\n\nx\n\n## Development\n\n\`\`\`\n${commands.join('\n')}\n\`\`\`\n`;
  const judged = commands => {
    fs.writeFileSync(path.join(root, 'README.md'), readme(commands));
    fs.writeFileSync(path.join(root, '.gitattributes'), '* text=auto\n');
    return checkRepoPresentation({ root }).violations.filter(item => item.ruleId === 'HFS_README_DEVELOPMENT_INCOMPLETE');
  };
  const managed = ['npm ci', 'npm run typecheck', 'npm run lint', 'npm run build', 'npm test'];
  assert.deepEqual(judged(managed), []);
  assert.equal(judged(['npm ci', 'npm run typecheck', 'npm run lint', 'npm run build', 'npm run test:unit']).length, 1, 'test:unit is not a managed script');
  assert.equal(judged(managed.slice(0, 4)).length, 1, 'a missing test command is a finding');
  assert.deepEqual(judged(['npm install', 'npm run typecheck', 'npm run lint', 'npm run build', 'npm run test']), []);
});
