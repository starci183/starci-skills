import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { checkRepo } from '../scripts/lib/hfs-check.mjs';
import { renderTargets, runSync } from '../packages/hfs/sync/index.mjs';
import { managedFindings } from '../packages/hfs/sync/managed.mjs';
import { tsStrictFindings } from '../packages/hfs/sync/ts-strict.mjs';
import { BE, FE, PRESETS } from './_hfs-cli-fixture.mjs';

// The managed-file findings of `hfs check` (R05 HFS_MANAGED_FILE_DRIFT, R16 HFS_TOOL_CONFIG_LOCAL, R17
// HFS_RULE_OFF_WITHOUT_REPLACEMENT, R22 HFS_TS_STRICT): every code has a violating tree and a clean one.
const made = [];
test.after(() => { for (const dir of made) fs.rmSync(dir, { recursive: true, force: true }); });

const put = (dir, file, text) => {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  fs.writeFileSync(path.join(dir, file), text);
};
const read = (dir, file) => fs.readFileSync(path.join(dir, file), 'utf8');
const synced = async (declaration = BE) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-managed-'));
  made.push(dir);
  put(dir, 'hfs.json', JSON.stringify(declaration));
  assert.equal(await runSync(['--write'], { cwd: dir, out: () => {}, presets: PRESETS[declaration.profile] }), 0);
  execFileSync('git', ['init', '-q'], { cwd: dir });
  return dir;
};
const tracked = (dir) => {
  execFileSync('git', ['add', '-A', '-f'], { cwd: dir });
  return execFileSync('git', ['ls-files'], { cwd: dir, encoding: 'utf8' }).split('\n').filter(Boolean);
};
const findings = async (dir) => (await managedFindings({ repoRoot: dir, tracked: tracked(dir), presets: PRESETS[JSON.parse(read(dir, 'hfs.json')).profile] })).map((finding) => [finding.code, finding.path]);

test('a synced back end and a synced front end have no managed-file finding of any code', async () => {
  assert.deepEqual(await findings(await synced(BE)), []);
  assert.deepEqual(await findings(await synced(FE)), []);
});

test('HFS_MANAGED_FILE_DRIFT: an edited hook, jest config, .prettierignore or scripts block is drift, a deleted optional workflow is not', async () => {
  const dir = await synced();
  put(dir, '.husky/pre-push', `${read(dir, '.husky/pre-push')}echo extra\n`);
  put(dir, 'jest.config.js', 'module.exports = {}\n');
  put(dir, '.prettierignore', 'dist/\n');
  fs.rmSync(path.join(dir, '.github', 'workflows', 'e2e.yml'));
  const pkg = JSON.parse(read(dir, 'package.json'));
  pkg.scripts.lint = 'eslint . --no-inline-config';
  put(dir, 'package.json', JSON.stringify(pkg));
  assert.deepEqual((await findings(dir)).sort(), [['HFS_MANAGED_FILE_DRIFT', '.husky/pre-push'], ['HFS_MANAGED_FILE_DRIFT', '.prettierignore'], ['HFS_MANAGED_FILE_DRIFT', 'jest.config.js'], ['HFS_MANAGED_FILE_DRIFT', 'package.json']]);
});

test('HFS_MANAGED_FILE_DRIFT: key order in package.json scripts and lines outside the scripts block are not drift', async () => {
  const dir = await synced();
  const pkg = JSON.parse(read(dir, 'package.json'));
  put(dir, 'package.json', JSON.stringify({ ...pkg, name: 'renamed', dependencies: { a: '1' }, scripts: Object.fromEntries(Object.entries(pkg.scripts).reverse()) }));
  assert.deepEqual(await findings(dir), []);
});

test('HFS_RULE_OFF_WITHOUT_REPLACEMENT: any edit of eslint.config.mjs (a rule off, a local plugin, an ignore) is one finding, not also drift', async () => {
  const dir = await synced();
  put(dir, 'eslint.config.mjs', 'import { loadHfs, starciBeConfig } from "@starci/eslint-canon-be"\n\nexport default [...(await starciBeConfig({ hfs: loadHfs(import.meta.url) })), { rules: { "starci-be/no-x": "off" } }]\n');
  assert.deepEqual(await findings(dir), [['HFS_RULE_OFF_WITHOUT_REPLACEMENT', 'eslint.config.mjs']]);
});

test('HFS_RULE_OFF_WITHOUT_REPLACEMENT: the rendered eslint.config.mjs, byte for byte and with CRLF line ends, is clean', async () => {
  const dir = await synced();
  put(dir, 'eslint.config.mjs', read(dir, 'eslint.config.mjs').replace(/\n/g, '\r\n'));
  assert.deepEqual(await findings(dir), []);
});

test('HFS_TS_STRICT: tsconfig.json is judged by flag, and a formatting-only difference is drift instead', async () => {
  const dir = await synced();
  const tsconfig = JSON.parse(read(dir, 'tsconfig.json'));
  put(dir, 'tsconfig.json', JSON.stringify(tsconfig));
  assert.deepEqual(await findings(dir), [['HFS_MANAGED_FILE_DRIFT', 'tsconfig.json']], 'same content, other bytes');
  put(dir, 'tsconfig.json', JSON.stringify({ ...tsconfig, compilerOptions: { ...tsconfig.compilerOptions, strict: false, noUncheckedIndexedAccess: false } }));
  assert.deepEqual(await findings(dir), [['HFS_TS_STRICT', 'tsconfig.json'], ['HFS_TS_STRICT', 'tsconfig.json']]);
});

test('HFS_TS_STRICT: the rendered tsconfig.json, build and e2e configs are clean', async () => {
  const dir = await synced();
  assert.deepEqual(await findings(dir), []);
  const expected = renderTargets(BE, PRESETS.be).find((target) => target.path === 'tsconfig.json').content;
  assert.deepEqual(tsStrictFindings(expected, expected), []);
});

test('HFS_TS_STRICT: tsStrictFindings names extends, options, program narrowing, aliases and unreadable text', () => {
  const expected = renderTargets(BE, PRESETS.be).find((target) => target.path === 'tsconfig.json').content;
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
  const dir = await synced();
  put(dir, 'scripts/eslint-local.mjs', 'export default { meta: { type: "problem" }, create(context) { return {} } }\n');
  put(dir, 'scripts/lint.mjs', 'import { execSync } from "node:child_process"\nexecSync("npx eslint --no-eslintrc src")\n');
  put(dir, 'packages/kit/package.json', JSON.stringify({ name: 'kit', scripts: { lint: 'eslint -c other.mjs .', format: 'prettier --config other .' } }));
  assert.deepEqual((await findings(dir)).sort(), [['HFS_TOOL_CONFIG_LOCAL', 'packages/kit/package.json'], ['HFS_TOOL_CONFIG_LOCAL', 'packages/kit/package.json'], ['HFS_TOOL_CONFIG_LOCAL', 'scripts/eslint-local.mjs'], ['HFS_TOOL_CONFIG_LOCAL', 'scripts/lint.mjs']]);
});

test('HFS_TOOL_CONFIG_LOCAL: a script that mentions a rule-like object, or runs eslint and prettier plainly, is clean', async () => {
  const dir = await synced();
  put(dir, 'scripts/ok.mjs', 'export const rule = { meta: { docs: "x" } }\nexport const run = () => "eslint . && prettier --check ."\n');
  put(dir, 'packages/kit/package.json', JSON.stringify({ name: 'kit', scripts: { lint: 'eslint .', build: 'tsc -p tsconfig.json' } }));
  assert.deepEqual(await findings(dir), []);
});

test('HFS_TOOL_CONFIG_LOCAL: a tracked .eslintrc, .eslintignore or second eslint.config is reported through its forbidden slot, an untracked one is not', () => {
  const declaration = { ...BE };
  const at = (files) => checkRepo({ repoRoot: os.tmpdir(), declaration, files, tree: false }).findings.filter((finding) => finding.code === 'HFS_TOOL_CONFIG_LOCAL' || finding.code === 'HFS_FORBIDDEN_PRESENT' || finding.code === 'HFS_PLAINTEXT_SECRET').map((finding) => [finding.code, finding.path]);
  assert.deepEqual(at(['.eslintrc.json', '.eslintignore', 'eslint.config.js', '.prettierrc.json', 'jest.config.e2e.js']), [
    ['HFS_TOOL_CONFIG_LOCAL', '.eslintrc.json'], ['HFS_TOOL_CONFIG_LOCAL', '.eslintignore'], ['HFS_TOOL_CONFIG_LOCAL', 'eslint.config.js'],
    ['HFS_TOOL_CONFIG_LOCAL', '.prettierrc.json'], ['HFS_TOOL_CONFIG_LOCAL', 'jest.config.e2e.js'],
  ]);
  assert.deepEqual(at(['eslint.config.mjs', '.prettierrc', '.prettierignore', 'jest.config.js']), []);
  assert.deepEqual(at(['.env']), [['HFS_PLAINTEXT_SECRET', '.env']], 'a root .env stays forbidden: its slot names R06, so the finding carries that code instead of HFS_FORBIDDEN_PRESENT');
});

test('a repository whose hfs.json is unreadable has no managed-file finding: the slot check reports the declaration', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-managed-none-'));
  made.push(dir);
  assert.deepEqual(await managedFindings({ repoRoot: dir, tracked: [], presets: PRESETS.be }), []);
});

// ----- the front end: the same mechanism, the same codes -----

test('a front end: HFS_RULE_OFF_WITHOUT_REPLACEMENT is any edit of eslint.config.mjs or stylelint.config.mjs, one finding each and never also drift; the renders, with LF or CRLF, are clean', async () => {
  const dir = await synced(FE);
  put(dir, 'eslint.config.mjs', 'import { loadHfs, starciFeConfig } from "@starci/eslint-canon-fe"\n\nexport default [...starciFeConfig({ hfs: loadHfs(import.meta.url) }), { rules: { "starci-fe/no-x": "off" } }]\n');
  put(dir, 'stylelint.config.mjs', 'import { starciStylelintConfig } from "@starci/stylelint-canon"\n\nexport default { ...starciStylelintConfig(), rules: { "starci/no-important": null } }\n');
  assert.deepEqual((await findings(dir)).sort(), [['HFS_RULE_OFF_WITHOUT_REPLACEMENT', 'eslint.config.mjs'], ['HFS_RULE_OFF_WITHOUT_REPLACEMENT', 'stylelint.config.mjs']]);
  const clean = await synced(FE);
  for (const file of ['eslint.config.mjs', 'stylelint.config.mjs']) put(clean, file, read(clean, file).replace(/\n/g, '\r\n'));
  assert.deepEqual(await findings(clean), []);
});

test('a front end: HFS_TS_STRICT judges the root tsconfig.json by flag (another preset, a compiler option, an alias, a dropped e2e exclusion); the render and a formatting-only change are clean or drift', async () => {
  const dir = await synced(FE);
  const tsconfig = JSON.parse(read(dir, 'tsconfig.json'));
  assert.deepEqual(tsconfig.exclude, ['node_modules', 'e2e', 'playwright.config.ts']);
  const flags = (actual) => tsStrictFindings(JSON.stringify(actual), renderTargets(FE, PRESETS.fe).find((target) => target.path === 'tsconfig.json').content).map((finding) => finding.flag);
  assert.deepEqual(flags(tsconfig), []);
  assert.deepEqual(flags({ ...tsconfig, extends: '@starci/tsconfig/base.json' }), ['extends']);
  assert.deepEqual(flags({ ...tsconfig, compilerOptions: { strict: false, jsx: 'preserve' } }).sort(), ['jsx', 'strict']);
  assert.deepEqual(flags({ ...tsconfig, compilerOptions: { paths: { '@/*': ['./src/*'] } } }), ['paths'], 'the root config has no alias: each app declares its own in apps/<app>/tsconfig.json');
  assert.deepEqual(flags({ ...tsconfig, exclude: ['node_modules'] }), ['exclude'], 'the e2e tree is excluded, so the default typecheck never includes it');
  assert.deepEqual(flags({ ...tsconfig, include: ['**/*'] }), ['include']);
  put(dir, 'tsconfig.json', JSON.stringify({ ...tsconfig, compilerOptions: { noUncheckedIndexedAccess: false } }));
  assert.deepEqual(await findings(dir), [['HFS_TS_STRICT', 'tsconfig.json']]);
  put(dir, 'tsconfig.json', JSON.stringify(tsconfig));
  assert.deepEqual(await findings(dir), [['HFS_MANAGED_FILE_DRIFT', 'tsconfig.json']], 'same content, other bytes');
});

test('a front end: HFS_MANAGED_FILE_DRIFT is an edited vitest.config.ts, tsconfig.e2e.json, .prettierrc, .prettierignore, hook or scripts block; an app-level vitest.config.ts, key order and the rest of package.json are not', async () => {
  const dir = await synced(FE);
  put(dir, 'vitest.config.ts', 'export default {}\n');
  put(dir, 'tsconfig.e2e.json', '{}\n');
  put(dir, '.prettierrc', '{ "semi": false }\n');
  put(dir, '.prettierignore', 'dist/\n');
  const pkg = JSON.parse(read(dir, 'package.json'));
  put(dir, 'package.json', JSON.stringify({ ...pkg, scripts: { ...pkg.scripts, 'lint:e2e': 'eslint e2e' } }));
  assert.deepEqual((await findings(dir)).sort(), [['HFS_MANAGED_FILE_DRIFT', '.prettierignore'], ['HFS_MANAGED_FILE_DRIFT', '.prettierrc'], ['HFS_MANAGED_FILE_DRIFT', 'package.json'], ['HFS_MANAGED_FILE_DRIFT', 'tsconfig.e2e.json'], ['HFS_MANAGED_FILE_DRIFT', 'vitest.config.ts']]);
  const fine = await synced(FE);
  put(fine, 'apps/web/vitest.config.ts', 'export default {}\n');
  const parsed = JSON.parse(read(fine, 'package.json'));
  put(fine, 'package.json', JSON.stringify({ ...parsed, name: 'renamed', workspaces: ['apps/*'], devDependencies: { a: '1' }, scripts: Object.fromEntries(Object.entries(parsed.scripts).reverse()) }));
  assert.deepEqual(await findings(fine), []);
});

test('a front end: HFS_TOOL_CONFIG_LOCAL is a local eslint rule, a stylelint plugin, a stylelint, eslint or prettier flag in a script or nested package.json, or a tool configuration key of a package.json', async () => {
  const dir = await synced(FE);
  put(dir, 'scripts/eslint-local.mjs', 'export default { meta: { type: "problem" }, create(context) { return {} } }\n');
  put(dir, 'scripts/css-rule.mjs', 'import stylelint from "stylelint"\nexport default stylelint.createPlugin("x/y", () => () => {})\n');
  put(dir, 'scripts/lint-css.mjs', 'import { execSync } from "node:child_process"\nexecSync("npx stylelint --config other.json apps/**/*.css")\n');
  put(dir, 'apps/web/package.json', JSON.stringify({ name: 'web', scripts: { lint: 'eslint . --ignore-pattern e2e', css: 'stylelint "src/**/*.css" --ignore-path .none' }, prettier: '@starci/prettier-config', 'lint-staged': { '*.ts': 'eslint' } }));
  const found = (await findings(dir)).filter(([code]) => code === 'HFS_TOOL_CONFIG_LOCAL').map(([, file]) => file);
  assert.deepEqual([...new Set(found)].sort(), ['apps/web/package.json', 'scripts/css-rule.mjs', 'scripts/eslint-local.mjs', 'scripts/lint-css.mjs']);
  assert.equal(found.filter((file) => file === 'apps/web/package.json').length, 4, 'two flags and two configuration keys, one finding each');
  const root = await synced(FE);
  const pkg = JSON.parse(read(root, 'package.json'));
  put(root, 'package.json', JSON.stringify({ ...pkg, eslintConfig: {}, jest: {} }));
  assert.deepEqual(await findings(root), [['HFS_TOOL_CONFIG_LOCAL', 'package.json'], ['HFS_TOOL_CONFIG_LOCAL', 'package.json']]);
});

test('a front end: plain tool commands, a createPlugin that is not stylelint and a rule-like object are not HFS_TOOL_CONFIG_LOCAL', async () => {
  const dir = await synced(FE);
  put(dir, 'scripts/ok.mjs', 'export const rule = { meta: { docs: "x" } }\nexport const run = () => "eslint . && stylelint \\"**/*.css\\" && prettier --check ."\n');
  put(dir, 'apps/web/src/editor.ts', 'export const createPlugin = (name: string) => ({ name })\nexport const plugin = createPlugin("mention")\n');
  put(dir, 'apps/web/package.json', JSON.stringify({ name: 'web', scripts: { dev: 'next dev', typecheck: 'tsc --noEmit --pretty false', lint: 'eslint src' } }));
  assert.deepEqual(await findings(dir), []);
});

test('a front end: the forbidden tool files (.eslintrc, a second eslint or stylelint config, prettier or vitest or jest configs, lint-staged) are HFS_TOOL_CONFIG_LOCAL through their slot, the managed and repository-owned ones are not', () => {
  const at = (files) => checkRepo({ repoRoot: os.tmpdir(), declaration: { ...FE }, files, tree: false }).findings.filter((finding) => finding.code === 'HFS_TOOL_CONFIG_LOCAL' || finding.code === 'HFS_FORBIDDEN_PRESENT' || finding.code === 'HFS_PLAINTEXT_SECRET').map((finding) => [finding.code, finding.path]);
  const forbidden = ['.eslintrc.json', '.eslintignore', 'eslint.config.js', '.stylelintrc.json', '.stylelintignore', 'stylelint.config.cjs', '.prettierrc.json', 'prettier.config.js', 'vitest.config.mjs', 'jest.config.js', '.lintstagedrc.json', 'lint-staged.config.mjs'];
  assert.deepEqual(at(forbidden).sort(), forbidden.map((file) => ['HFS_TOOL_CONFIG_LOCAL', file]).sort());
  assert.deepEqual(at(['eslint.config.mjs', 'stylelint.config.mjs', 'vitest.config.ts', 'vitest.setup.ts', 'playwright.config.ts', '.prettierrc', '.prettierignore', 'apps/web/vitest.config.ts', 'apps/web/tsconfig.json']), []);
});
