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
  put(dir, '.husky/pre-push', 'exit 0\n');
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
  const at = (files) => checkRepo({ repoRoot: os.tmpdir(), declaration, files, tree: false }).findings.filter((finding) => finding.code === 'HFS_TOOL_CONFIG_LOCAL' || finding.code === 'HFS_FORBIDDEN_PRESENT').map((finding) => [finding.code, finding.path]);
  assert.deepEqual(at(['.eslintrc.json', '.eslintignore', 'eslint.config.js', '.prettierrc.json', 'jest.config.e2e.js']), [
    ['HFS_TOOL_CONFIG_LOCAL', '.eslintrc.json'], ['HFS_TOOL_CONFIG_LOCAL', '.eslintignore'], ['HFS_TOOL_CONFIG_LOCAL', 'eslint.config.js'],
    ['HFS_TOOL_CONFIG_LOCAL', '.prettierrc.json'], ['HFS_TOOL_CONFIG_LOCAL', 'jest.config.e2e.js'],
  ]);
  assert.deepEqual(at(['eslint.config.mjs', '.prettierrc', '.prettierignore', 'jest.config.js']), []);
  assert.deepEqual(at(['.env']), [['HFS_FORBIDDEN_PRESENT', '.env']], 'a forbidden slot that names no code of its own keeps HFS_FORBIDDEN_PRESENT');
});

test('a repository whose hfs.json is unreadable has no managed-file finding: the slot check reports the declaration', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-managed-none-'));
  made.push(dir);
  assert.deepEqual(await managedFindings({ repoRoot: dir, tracked: [], presets: PRESETS.be }), []);
});
