// proves: HFS_ROOT_ENTRY_FORBIDDEN@lite
// proves: HFS_ROOT_ENTRY_FORBIDDEN@full
// proves: HFS_ROOT_MARKDOWN_FORBIDDEN@lite
// proves: HFS_ROOT_MARKDOWN_FORBIDDEN@full
// proves: HFS_ROOT_SRC_FORBIDDEN_FE@lite
// proves: HFS_ROOT_SRC_FORBIDDEN_FE@full
// proves: HFS_SRC_LAYOUT_INVALID@lite
// proves: HFS_SRC_LAYOUT_INVALID@full
// proves: HFS_MODULE_TIER_INVALID@lite
// proves: HFS_MODULE_TIER_INVALID@full
// proves: HFS_WORK_IN_FE@lite
// proves: HFS_WORK_IN_FE@full
// proves: HFS_STACKS_IN_SIDE@lite
// proves: HFS_STACKS_IN_SIDE@full
// R01, the repository tree layout of the architecture machine (scripts/hfs/architecture/hfs.mjs): the root entries of a side and of the app, the back-end
// src/ and its module tiers, and the trees that belong to the app root alone (.starciwork, .starcistacks), in lite and in full. Each case lets the
// machine judge a hermetic app and compares the paths it names with the clean tree.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { archFixture, appDeclaration, runArch } from './helpers/hfs-arch-fixture.mjs';
import { checkHfsWithoutConfig } from '../runtime/scripts/hfs/architecture/hfs.mjs';
import { byCodeUnit } from '../runtime/scripts/lib/list.mjs';

const APP_ROOT = {
  '../.gitattributes': '* text=auto\n', '../.gitignore': 'node_modules\n', '../.github/workflows/ci.yml': 'name: ci\non: workflow_dispatch\n', '../.husky/pre-commit': 'npm run lint\n',
  '../package-lock.json': '{}\n', '../README.md': '# fixture\n', '../sonar-project.properties': 'sonar.projectKey=x\n', '../.starciwork/.keep': '',
};
const ROOT_FE = { ...APP_ROOT, 'eslint.config.mjs': 'export default [];\n', 'stylelint.config.mjs': 'export default {};\n' };
const APP_FE = Object.fromEntries(['next.config.ts', 'tsconfig.json', 'postcss.config.mjs'].map((name) => [`apps/web/${name}`, name.endsWith('.json') ? '{}\n' : 'export default {};\n']));
const ROOT_BE = { ...APP_ROOT, 'eslint.config.mjs': 'export default [];\n', 'tsconfig.build.json': '{}\n', '../.sops.yaml': 'creation_rules: []\n', '../.starcistacks/application-stacks.yaml': 'services: {}\n', 'jest.config.js': 'module.exports = {};\n', 'nest-cli.json': '{}\n' };
const SOURCE = 'export const value = 1;\n';

/** The files of a fixture of `edition`: the app hfs.json carries the edition. */
const declared = (profile, edition, files) => ({ '../hfs.json': `${JSON.stringify({ ...appDeclaration(profile, { apps: profile === 'be' ? [{ name: 'core', kind: 'api' }] : [{ name: 'web', kind: 'next' }] }), edition }, null, 2)}\n`, ...files });
const sideRun = (context, profile, edition, files) => runArch(archFixture(context, { profile, files: declared(profile, edition, files) }));
/** The app-root tree findings of the app whose fe side folder the fixture is. */
const rootRun = (context, edition, files) => checkHfsWithoutConfig(path.dirname(archFixture(context, { profile: 'fe', files: declared('fe', edition, files) })));
const paths = (report, code) => report.violations.filter((item) => item.ruleId === code).map((item) => item.path).sort(byCodeUnit);

for (const edition of ['lite', 'full']) {
  test(`${edition}: a root entry of a side that no slot names is refused, a clean side is accepted`, (context) => {
    assert.deepEqual(paths(sideRun(context, 'be', edition, { ...ROOT_BE, 'stray.txt': 'x\n' }), 'HFS_ROOT_ENTRY_FORBIDDEN'), ['stray.txt']);
    assert.deepEqual(paths(sideRun(context, 'be', edition, ROOT_BE), 'HFS_ROOT_ENTRY_FORBIDDEN'), []);
  });

  test(`${edition}: Markdown at the app root other than the README is refused, docs Markdown is accepted`, (context) => {
    assert.deepEqual(paths(rootRun(context, edition, { ...ROOT_FE, ...APP_FE, '../NOTES.md': '# notes\n' }), 'HFS_ROOT_MARKDOWN_FORBIDDEN'), ['NOTES.md']);
    assert.deepEqual(paths(rootRun(context, edition, { ...ROOT_FE, ...APP_FE, 'docs/notes.md': '# notes\n' }), 'HFS_ROOT_MARKDOWN_FORBIDDEN'), []);
  });

  test(`${edition}: a src tree at the root of the front-end side is refused, the back-end side keeps one`, (context) => {
    assert.deepEqual(paths(sideRun(context, 'fe', edition, { ...ROOT_FE, ...APP_FE, 'src/shared/util.ts': SOURCE }), 'HFS_ROOT_SRC_FORBIDDEN_FE'), ['src']);
    assert.deepEqual(paths(sideRun(context, 'be', edition, { ...ROOT_BE, 'src/modules/domain/alpha/alpha.service.ts': SOURCE }), 'HFS_ROOT_SRC_FORBIDDEN_FE'), []);
  });

  test(`${edition}: a back-end src child no slot knows is refused, the known children are accepted`, (context) => {
    assert.deepEqual(paths(sideRun(context, 'be', edition, { ...ROOT_BE, 'src/utils/x.ts': SOURCE, 'src/tests/helpers/y.ts': SOURCE }), 'HFS_SRC_LAYOUT_INVALID'), ['src/tests/helpers', 'src/utils']);
    assert.deepEqual(paths(sideRun(context, 'be', edition, { ...ROOT_BE, 'src/features/api/f/.keep': '', 'src/modules/domain/.keep': '', 'src/tests/world/.keep': '' }), 'HFS_SRC_LAYOUT_INVALID'), []);
  });

  test(`${edition}: a module tier no slot names is refused, the known tiers are accepted`, (context) => {
    assert.deepEqual(paths(sideRun(context, 'be', edition, { ...ROOT_BE, 'src/modules/bogus/alpha/index.ts': SOURCE }), 'HFS_MODULE_TIER_INVALID'), ['src/modules/bogus']);
    assert.deepEqual(paths(sideRun(context, 'be', edition, { ...ROOT_BE, 'src/modules/domain/alpha/index.ts': SOURCE, 'src/modules/platform/clock/index.ts': SOURCE }), 'HFS_MODULE_TIER_INVALID'), []);
  });

  test(`${edition}: a Work tree inside the front-end side is refused, the app root keeps it`, (context) => {
    assert.deepEqual(paths(sideRun(context, 'fe', edition, { ...ROOT_FE, ...APP_FE, '.starciwork/index.yaml': 'records: []\n' }), 'HFS_WORK_IN_FE'), ['.starciwork']);
    assert.deepEqual(paths(sideRun(context, 'fe', edition, { ...ROOT_FE, ...APP_FE }), 'HFS_WORK_IN_FE'), []);
  });

  test(`${edition}: a stack declaration inside a side is refused, the app root keeps it`, (context) => {
    assert.deepEqual(paths(sideRun(context, 'be', edition, { ...ROOT_BE, '.starcistacks/application-stacks.yaml': 'services: {}\n' }), 'HFS_STACKS_IN_SIDE'), ['.starcistacks']);
    assert.deepEqual(paths(sideRun(context, 'be', edition, ROOT_BE), 'HFS_STACKS_IN_SIDE'), []);
  });
}
