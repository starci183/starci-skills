import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { checkRepo } from '../../scripts/hfs/check.mjs';
import { renderTargets, runSync } from '../../packages/hfs/sync/index.mjs';
import { managedFindings } from '../../packages/hfs/sync/managed.mjs';
import { tsStrictFindings } from '../../packages/hfs/sync/ts-strict.mjs';
import { APP, PRESETS } from '../helpers/hfs-cli-fixture.mjs';

// The managed-file findings of `starci app check` (R05 HFS_MANAGED_FILE_DRIFT, R16 HFS_TOOL_CONFIG_LOCAL, R17
// HFS_RULE_OFF_WITHOUT_REPLACEMENT, R22 HFS_TS_STRICT): every code has a violating tree and a clean one. The app is synced and judged
// at its root: the root's managed files (package.json scripts, hooks, workflows, prettier) and each side's (be/, fe/).
const made = [];
test.after(() => { for (const dir of made) fs.rmSync(dir, { recursive: true, force: true }); });

const put = (dir, file, text) => {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  fs.writeFileSync(path.join(dir, file), text);
};
const read = (dir, file) => fs.readFileSync(path.join(dir, file), 'utf8');
/** An app whose fe side opts into a ui workspace package: the one place below a side a nested package.json may sit. */
const APP_WITH_PACKAGES = { ...APP, sides: { ...APP.sides, fe: { ...APP.sides.fe, optionalSlots: ['fe.package.ui'] } } };
const synced = async (declaration = APP) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-managed-'));
  made.push(dir);
  put(dir, 'hfs.json', JSON.stringify(declaration));
  assert.equal(await runSync(['--write'], { cwd: dir, out: () => {}, presets: PRESETS }), 0);
  execFileSync('git', ['init', '-q'], { cwd: dir });
  return dir;
};
const tracked = (dir) => {
  execFileSync('git', ['add', '-A', '-f'], { cwd: dir });
  return execFileSync('git', ['ls-files'], { cwd: dir, encoding: 'utf8' }).split('\n').filter(Boolean);
};
const findings = async (dir) => (await managedFindings({ repoRoot: dir, tracked: tracked(dir), presets: PRESETS })).map((finding) => [finding.code, finding.path]);

test('a synced app (its root, be/ and fe/) has no managed-file finding of any code', async () => {
  assert.deepEqual(await findings(await synced()), []);
});

test('HFS_MANAGED_FILE_DRIFT: an edited hook, .prettierignore or scripts block is drift, a deleted optional workflow is not', async () => {
  const dir = await synced();
  put(dir, '.husky/pre-push', `${read(dir, '.husky/pre-push')}echo extra\n`);
  put(dir, '.prettierignore', 'dist/\n');
  fs.rmSync(path.join(dir, '.github', 'workflows', 'e2e.yml'));
  const pkg = JSON.parse(read(dir, 'package.json'));
  pkg.scripts.lint = 'eslint . --no-inline-config';
  put(dir, 'package.json', JSON.stringify(pkg));
  assert.deepEqual((await findings(dir)).sort(), [['HFS_MANAGED_FILE_DRIFT', '.husky/pre-push'], ['HFS_MANAGED_FILE_DRIFT', '.prettierignore'], ['HFS_MANAGED_FILE_DRIFT', 'package.json']]);
});

test('HFS_COVERAGE_SCOPE_DRIFT (R204): the files that state the coverage scope are its render, and nothing else of them is judged by this code', async () => {
  const dir = await synced();
  // the jest scope, narrowed by hand to measure less
  put(dir, 'be/jest.config.js', read(dir, 'be/jest.config.js').replace('"service",', ''));
  // the Codecov paths of the project status
  put(dir, 'codecov.yml', read(dir, 'codecov.yml').replace('target: 100%', 'target: 80%'));
  // the Sonar coverage exclusions (an exclusion added by hand) and, apart from it, another Sonar line
  put(dir, 'sonar-project.properties', read(dir, 'sonar-project.properties').replace('sonar.coverage.exclusions=', 'sonar.coverage.exclusions=be/src/modules/**,'));
  assert.deepEqual((await findings(dir)).sort(), [['HFS_COVERAGE_SCOPE_DRIFT', 'be/jest.config.js'], ['HFS_COVERAGE_SCOPE_DRIFT', 'codecov.yml'], ['HFS_COVERAGE_SCOPE_DRIFT', 'sonar-project.properties']]);
  const other = await synced();
  put(other, 'sonar-project.properties', read(other, 'sonar-project.properties').replace('sonar.sourceEncoding=UTF-8', 'sonar.sourceEncoding=UTF-16'));
  assert.deepEqual(await findings(other), [['HFS_SONAR_CONFIG', 'sonar-project.properties']], 'a Sonar line that is not the coverage scope stays R11');
});

test('HFS_MANAGED_FILE_DRIFT: key order in package.json scripts and lines outside the scripts block are not drift', async () => {
  const dir = await synced();
  const pkg = JSON.parse(read(dir, 'package.json'));
  put(dir, 'package.json', JSON.stringify({ ...pkg, name: 'renamed', dependencies: { a: '1' }, scripts: Object.fromEntries(Object.entries(pkg.scripts).reverse()) }));
  assert.deepEqual(await findings(dir), []);
});

test('HFS_MANAGED_FILE_DRIFT: the root package.json owns the scripts of both sides (test:stack included); an app devDependency such as ajv is not drift, a changed test:stack is', async () => {
  const dir = await synced();
  const pkg = JSON.parse(read(dir, 'package.json'));
  assert.equal(pkg.scripts['test:stack'], 'starci app stack');
  put(dir, 'package.json', JSON.stringify({ ...pkg, devDependencies: { ajv: '^8.17.1' } }));
  assert.deepEqual(await findings(dir), []);
  put(dir, 'package.json', JSON.stringify({ ...pkg, devDependencies: { ajv: '^8.17.1' }, scripts: { ...pkg.scripts, 'test:stack': 'echo no' } }));
  assert.deepEqual(await findings(dir), [['HFS_MANAGED_FILE_DRIFT', 'package.json']]);
});

test('HFS_RULE_OFF_WITHOUT_REPLACEMENT: any edit of be/eslint.config.mjs (a rule off, a local plugin, an ignore) is one finding, not also drift', async () => {
  const dir = await synced();
  put(dir, 'be/eslint.config.mjs', 'import { loadHfs, starciBeConfig } from "@starci/eslint-canon-be"\n\nexport default [...(await starciBeConfig({ hfs: loadHfs(import.meta.url) })), { rules: { "starci-be/no-x": "off" } }]\n');
  assert.deepEqual(await findings(dir), [['HFS_RULE_OFF_WITHOUT_REPLACEMENT', 'be/eslint.config.mjs']]);
});

test('HFS_RULE_OFF_WITHOUT_REPLACEMENT: the rendered eslint.config.mjs, byte for byte and with CRLF line ends, is clean', async () => {
  const dir = await synced();
  put(dir, 'be/eslint.config.mjs', read(dir, 'be/eslint.config.mjs').replace(/\n/g, '\r\n'));
  assert.deepEqual(await findings(dir), []);
});

test('HFS_TS_STRICT: tsconfig.json is judged by flag, and a formatting-only difference is drift instead', async () => {
  const dir = await synced();
  const tsconfig = JSON.parse(read(dir, 'be/tsconfig.json'));
  put(dir, 'be/tsconfig.json', JSON.stringify(tsconfig));
  assert.deepEqual(await findings(dir), [['HFS_MANAGED_FILE_DRIFT', 'be/tsconfig.json']], 'same content, other bytes');
  put(dir, 'be/tsconfig.json', JSON.stringify({ ...tsconfig, compilerOptions: { ...tsconfig.compilerOptions, strict: false, noUncheckedIndexedAccess: false } }));
  assert.deepEqual(await findings(dir), [['HFS_TS_STRICT', 'be/tsconfig.json'], ['HFS_TS_STRICT', 'be/tsconfig.json']]);
});

test('HFS_TS_STRICT: the rendered be/tsconfig.json, build and e2e configs are clean', async () => {
  const dir = await synced();
  assert.deepEqual(await findings(dir), []);
  const expected = renderTargets(APP, PRESETS).find((target) => target.path === 'be/tsconfig.json').content;
  assert.deepEqual(tsStrictFindings(expected, expected), []);
});

test('HFS_TS_STRICT: tsStrictFindings names extends, options, program narrowing, aliases and unreadable text', () => {
  const expected = renderTargets(APP, PRESETS).find((target) => target.path === 'be/tsconfig.json').content;
  const aliases = JSON.parse(expected).compilerOptions.paths;
  const exclude = JSON.parse(expected).exclude;
  const flags = (actual) => tsStrictFindings(typeof actual === 'string' ? actual : JSON.stringify(actual), expected).map((finding) => finding.flag);
  assert.deepEqual(flags(expected), []);
  assert.deepEqual(flags({ extends: '@starci/tsconfig/nest.json', exclude, compilerOptions: { paths: aliases } }), ['extends']);
  assert.deepEqual(flags({ extends: '@starci/tsconfig/be.json', exclude, compilerOptions: { paths: aliases, noImplicitAny: false, target: 'ES5' } }).sort(), ['noImplicitAny', 'target']);
  assert.deepEqual(flags({ extends: '@starci/tsconfig/be.json', include: ['src'], exclude: ['x'], compilerOptions: { paths: aliases } }).sort(), ['exclude', 'include']);
  assert.deepEqual(flags({ extends: '@starci/tsconfig/be.json', exclude, compilerOptions: { paths: { ...aliases, '@x/*': ['./x/*'] } } }), ['paths']);
  assert.deepEqual(flags({ extends: '@starci/tsconfig/be.json', exclude, compilerOptions: { paths: { '@features/*': ['./src/features/*'] } } }), ['paths', 'paths']);
  assert.deepEqual(flags('{ not json'), ['parse']);
  assert.deepEqual(flags('[]'), ['parse']);
  // the template's exclude of the e2e tree is part of the file; dropping it is a finding
  assert.deepEqual(flags({ extends: '@starci/tsconfig/be.json', compilerOptions: { paths: aliases } }), ['exclude']);
  const [lowered, other] = tsStrictFindings(JSON.stringify({ extends: '@starci/tsconfig/be.json', exclude, compilerOptions: { paths: aliases, strict: false, module: 'commonjs' } }), expected);
  assert.match(lowered.message, /lowers strict/);
  assert.match(other.message, /sets module/);
});

test('HFS_TOOL_CONFIG_LOCAL: a local rule file and a configuration-swapping flag in a script or nested package.json are findings', async () => {
  const dir = await synced(APP_WITH_PACKAGES);
  put(dir, 'scripts/eslint-local.mjs', 'export default { meta: { type: "problem" }, create(context) { return {} } }\n');
  put(dir, 'scripts/lint.mjs', 'import { execSync } from "node:child_process"\nexecSync("npx eslint --no-eslintrc src")\n');
  put(dir, 'fe/packages/kit-ui/package.json', JSON.stringify({ name: 'kit', scripts: { lint: 'eslint -c other.mjs .', format: 'prettier --config other .' } }));
  assert.deepEqual((await findings(dir)).sort(), [['HFS_TOOL_CONFIG_LOCAL', 'fe/packages/kit-ui/package.json'], ['HFS_TOOL_CONFIG_LOCAL', 'fe/packages/kit-ui/package.json'], ['HFS_TOOL_CONFIG_LOCAL', 'scripts/eslint-local.mjs'], ['HFS_TOOL_CONFIG_LOCAL', 'scripts/lint.mjs']]);
});

test('HFS_TOOL_CONFIG_LOCAL: a script that mentions a rule-like object, or runs eslint and prettier plainly, is clean', async () => {
  const dir = await synced(APP_WITH_PACKAGES);
  put(dir, 'scripts/ok.mjs', 'export const rule = { meta: { docs: "x" } }\nexport const run = () => "eslint . && prettier --check ."\n');
  put(dir, 'fe/packages/kit-ui/package.json', JSON.stringify({ name: 'kit', scripts: { lint: 'eslint .', build: 'tsc -p tsconfig.json' } }));
  assert.deepEqual(await findings(dir), []);
});

test('HFS_TOOL_CONFIG_LOCAL: a tracked .eslintrc, .eslintignore or second eslint.config is reported through its forbidden slot, an untracked one is not', () => {
  const declaration = APP;
  const at = (files) => checkRepo({ repoRoot: os.tmpdir(), declaration, files, tree: false }).findings.filter((finding) => finding.code === 'HFS_TOOL_CONFIG_LOCAL' || finding.code === 'HFS_FORBIDDEN_PRESENT' || finding.code === 'HFS_PLAINTEXT_SECRET').map((finding) => [finding.code, finding.path]);
  assert.deepEqual(at(['be/.eslintrc.json', 'be/.eslintignore', 'be/eslint.config.js', 'be/.prettierrc.json', 'be/jest.config.e2e.js']), [
    ['HFS_TOOL_CONFIG_LOCAL', 'be/.eslintrc.json'], ['HFS_TOOL_CONFIG_LOCAL', 'be/.eslintignore'], ['HFS_TOOL_CONFIG_LOCAL', 'be/eslint.config.js'],
    ['HFS_TOOL_CONFIG_LOCAL', 'be/.prettierrc.json'], ['HFS_TOOL_CONFIG_LOCAL', 'be/jest.config.e2e.js'],
  ]);
  assert.deepEqual(at(['be/eslint.config.mjs', '.prettierrc', '.prettierignore', 'be/jest.config.js']), []);
  assert.deepEqual(at(['.env']), [['HFS_PLAINTEXT_SECRET', '.env']], 'a root .env stays forbidden: its slot names R06, so the finding carries that code instead of HFS_FORBIDDEN_PRESENT');
});

test('an app whose hfs.json is unreadable has no managed-file finding: the slot check reports the declaration', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-managed-none-'));
  made.push(dir);
  assert.deepEqual(await managedFindings({ repoRoot: dir, tracked: [], presets: PRESETS }), []);
});

// ----- the fe side: the same mechanism, the same codes -----

test('the fe side: HFS_RULE_OFF_WITHOUT_REPLACEMENT is any edit of fe/eslint.config.mjs or fe/stylelint.config.mjs, one finding each and never also drift; the renders, with LF or CRLF, are clean', async () => {
  const dir = await synced();
  put(dir, 'fe/eslint.config.mjs', 'import { loadHfs, starciFeConfig } from "@starci/eslint-canon-fe"\n\nexport default [...starciFeConfig({ hfs: loadHfs(import.meta.url) }), { rules: { "starci-fe/no-x": "off" } }]\n');
  put(dir, 'fe/stylelint.config.mjs', 'import { starciStylelintConfig } from "@starci/stylelint-canon"\n\nexport default { ...starciStylelintConfig(), rules: { "starci/no-important": null } }\n');
  assert.deepEqual((await findings(dir)).sort(), [['HFS_RULE_OFF_WITHOUT_REPLACEMENT', 'fe/eslint.config.mjs'], ['HFS_RULE_OFF_WITHOUT_REPLACEMENT', 'fe/stylelint.config.mjs']]);
  const clean = await synced();
  for (const file of ['fe/eslint.config.mjs', 'fe/stylelint.config.mjs']) put(clean, file, read(clean, file).replace(/\n/g, '\r\n'));
  assert.deepEqual(await findings(clean), []);
});

test('the fe side: HFS_TS_STRICT judges fe/tsconfig.json by flag (another preset, a compiler option, an alias, an added exclude); the render and a formatting-only change are clean or drift', async () => {
  const dir = await synced();
  const tsconfig = JSON.parse(read(dir, 'fe/tsconfig.json'));
  assert.deepEqual(tsconfig.exclude, ['node_modules']);
  const flags = (actual) => tsStrictFindings(JSON.stringify(actual), renderTargets(APP, PRESETS).find((target) => target.path === 'fe/tsconfig.json').content).map((finding) => finding.flag);
  assert.deepEqual(flags(tsconfig), []);
  assert.deepEqual(flags({ ...tsconfig, extends: '@starci/tsconfig/base.json' }), ['extends']);
  assert.deepEqual(flags({ ...tsconfig, compilerOptions: { strict: false, jsx: 'preserve' } }).sort(), ['jsx', 'strict']);
  assert.deepEqual(flags({ ...tsconfig, compilerOptions: { paths: { '@/*': ['./src/*'] } } }), ['paths'], 'the side config has no alias: each app declares its own in fe/apps/<app>/tsconfig.json');
  assert.deepEqual(flags({ ...tsconfig, exclude: ['node_modules', 'e2e'] }), ['exclude'], 'a front end narrows its program with nothing: there is no e2e tree to exclude');
  assert.deepEqual(flags({ ...tsconfig, include: ['**/*'] }), ['include']);
  put(dir, 'fe/tsconfig.json', JSON.stringify({ ...tsconfig, compilerOptions: { noUncheckedIndexedAccess: false } }));
  assert.deepEqual(await findings(dir), [['HFS_TS_STRICT', 'fe/tsconfig.json']]);
  put(dir, 'fe/tsconfig.json', JSON.stringify(tsconfig));
  assert.deepEqual(await findings(dir), [['HFS_MANAGED_FILE_DRIFT', 'fe/tsconfig.json']], 'same content, other bytes');
});

test('the root: HFS_MANAGED_FILE_DRIFT is an edited .prettierrc, .prettierignore or scripts block; key order and the rest of package.json (workspaces of fe/packages/* included) are not', async () => {
  const dir = await synced();
  put(dir, '.prettierrc', '{ "semi": false }\n');
  put(dir, '.prettierignore', 'dist/\n');
  const pkg = JSON.parse(read(dir, 'package.json'));
  put(dir, 'package.json', JSON.stringify({ ...pkg, scripts: { ...pkg.scripts, 'lint:e2e': 'eslint e2e' } }));
  assert.deepEqual((await findings(dir)).sort(), [['HFS_MANAGED_FILE_DRIFT', '.prettierignore'], ['HFS_MANAGED_FILE_DRIFT', '.prettierrc'], ['HFS_MANAGED_FILE_DRIFT', 'package.json']]);
  const fine = await synced();
  const parsed = JSON.parse(read(fine, 'package.json'));
  put(fine, 'package.json', JSON.stringify({ ...parsed, name: 'renamed', workspaces: ['fe/packages/*'], devDependencies: { a: '1' }, scripts: Object.fromEntries(Object.entries(parsed.scripts).reverse()) }));
  assert.deepEqual(await findings(fine), []);
});

test('HFS_TOOL_CONFIG_LOCAL is a local eslint rule, a stylelint plugin, a stylelint, eslint or prettier flag in a script or nested package.json, or a tool configuration key of a package.json', async () => {
  const dir = await synced(APP_WITH_PACKAGES);
  put(dir, 'scripts/eslint-local.mjs', 'export default { meta: { type: "problem" }, create(context) { return {} } }\n');
  put(dir, 'scripts/css-rule.mjs', 'import stylelint from "stylelint"\nexport default stylelint.createPlugin("x/y", () => () => {})\n');
  put(dir, 'scripts/lint-css.mjs', 'import { execSync } from "node:child_process"\nexecSync("npx stylelint --config other.json apps/**/*.css")\n');
  put(dir, 'fe/packages/kit-ui/package.json', JSON.stringify({ name: 'kit', scripts: { lint: 'eslint . --ignore-pattern e2e', css: 'stylelint "src/**/*.css" --ignore-path .none' }, prettier: '@starci/prettier-config', 'lint-staged': { '*.ts': 'eslint' } }));
  const found = (await findings(dir)).filter(([code]) => code === 'HFS_TOOL_CONFIG_LOCAL').map(([, file]) => file);
  assert.deepEqual([...new Set(found)].sort(), ['fe/packages/kit-ui/package.json', 'scripts/css-rule.mjs', 'scripts/eslint-local.mjs', 'scripts/lint-css.mjs']);
  assert.equal(found.filter((file) => file === 'fe/packages/kit-ui/package.json').length, 4, 'two flags and two configuration keys, one finding each');
  const root = await synced();
  const pkg = JSON.parse(read(root, 'package.json'));
  put(root, 'package.json', JSON.stringify({ ...pkg, eslintConfig: {}, jest: {} }));
  assert.deepEqual(await findings(root), [['HFS_TOOL_CONFIG_LOCAL', 'package.json'], ['HFS_TOOL_CONFIG_LOCAL', 'package.json']]);
});

test('plain tool commands, a createPlugin that is not stylelint and a rule-like object are not HFS_TOOL_CONFIG_LOCAL', async () => {
  const dir = await synced(APP_WITH_PACKAGES);
  put(dir, 'scripts/ok.mjs', 'export const rule = { meta: { docs: "x" } }\nexport const run = () => "eslint . && stylelint \\"**/*.css\\" && prettier --check ."\n');
  put(dir, 'fe/apps/web/src/editor.ts', 'export const createPlugin = (name: string) => ({ name })\nexport const plugin = createPlugin("mention")\n');
  put(dir, 'fe/packages/kit-ui/package.json', JSON.stringify({ name: 'kit', scripts: { dev: 'next dev', typecheck: 'tsc --noEmit --pretty false', lint: 'eslint src' } }));
  assert.deepEqual(await findings(dir), []);
});

test('the fe side: the forbidden tool files (.eslintrc, a second eslint or stylelint config, prettier configs, lint-staged, a turbo.json of its own) are HFS_TOOL_CONFIG_LOCAL through their slot, the managed and app-owned ones are not', () => {
  const at = (files) => checkRepo({ repoRoot: os.tmpdir(), declaration: APP, files, tree: false }).findings.filter((finding) => finding.code === 'HFS_TOOL_CONFIG_LOCAL' || finding.code === 'HFS_FORBIDDEN_PRESENT' || finding.code === 'HFS_PLAINTEXT_SECRET').map((finding) => [finding.code, finding.path]);
  const forbidden = ['.eslintrc.json', '.eslintignore', 'eslint.config.js', '.stylelintrc.json', '.stylelintignore', 'stylelint.config.cjs', '.prettierrc.json', 'prettier.config.js', '.lintstagedrc.json', 'lint-staged.config.mjs', 'turbo.json'].map((file) => `fe/${file}`);
  assert.deepEqual(at(forbidden).sort(), forbidden.map((file) => ['HFS_TOOL_CONFIG_LOCAL', file]).sort());
  assert.deepEqual(at(['fe/eslint.config.mjs', 'fe/stylelint.config.mjs', 'turbo.json', '.prettierrc', '.prettierignore', 'fe/apps/web/tsconfig.json']), []);
});
