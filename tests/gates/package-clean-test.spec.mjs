import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROOF_CODES, PROOF_EXIT, cleanEnv, installUnits, packagesChanged, provePackages, publishSet } from '../../scripts/gates/package-clean-test.mjs';
import { loadPins } from '../../scripts/gates/canon-pins.mjs';
import { spawnSync } from 'node:child_process';
import { withoutGitLocalEnv } from '../../scripts/supervisor/land.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

// scripts/gates/package-clean-test.mjs: a published package proves itself from a clean install. The fixture packages
// install offline (npm_config_offline, one local file: dependency), so the spec needs no network.

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OFFLINE = { ...process.env, npm_config_offline: 'true' };

test('the publish set is every starci pin with a source, read from canon-pins.yaml', () => {
  const pins = Object.entries(loadPins(root).pins).filter(([, pin]) => pin.group === 'starci' && pin.source);
  assert.deepEqual(publishSet(root).map((p) => p.name).sort(), pins.map(([name]) => name).sort());
  assert.ok(publishSet(root).every((p) => fs.existsSync(path.join(root, p.dir, 'package.json'))));
});

test('the eslint canons install as members of the packages/ workspace; every other package stands alone', () => {
  const units = installUnits(publishSet(root), root);
  const ws = units.filter((u) => u.kind === 'workspace');
  assert.equal(ws.length, 1);
  assert.equal(path.relative(root, ws[0].dir).replaceAll('\\', '/'), 'packages');
  assert.deepEqual(ws[0].packages.map((p) => p.name).sort(), ['@starci/eslint-canon-be', '@starci/eslint-canon-fe']);
  assert.ok(units.filter((u) => u.kind === 'standalone').every((u) => u.packages.length === 1));
});

test('--changed picks the packages holding a changed file, and every member of a workspace whose manifest or lock changed', () => {
  const set = publishSet(root);
  const names = (files) => packagesChanged(files, set, root).map((p) => p.name).sort();
  assert.deepEqual(names(['packages/test-world/src/world.ts', 'scripts/gates/gate.mjs']), ['@starci/test-world']);
  assert.deepEqual(names(['packages/package-lock.json']), ['@starci/eslint-canon-be', '@starci/eslint-canon-fe']);
  assert.deepEqual(names(['packages/README.md', 'packages/fe-kit/x.ts']), []);
});

test('the clean environment drops what an enclosing npm run, NODE_PATH or a test runner would leak', () => {
  const env = cleanEnv({ PATH: 'p', NODE_PATH: 'x', INIT_CWD: 'y', npm_lifecycle_event: 'test', npm_package_name: 'n', npm_config_prefix: 'z', NODE_TEST_CONTEXT: 'child-v8', npm_config_cache: 'c' });
  assert.deepEqual(env, { PATH: 'p', npm_config_cache: 'c' });
});

const gitIn = (dir, ...args) => { const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8', env: withoutGitLocalEnv(), windowsHide: true }); assert.equal(r.status, 0, r.stderr); };

/**
 * A git work tree holding a dependency package and a consumer whose test imports it; `declare` adds it to the consumer's
 * devDependencies. Only the consumer's package.json and test are tracked: the proof copies tracked files only.
 */
function fixture(t, { declare, test: script = 'node --test', hoisted = false }) {
  const dir = mkdtemp(t, 'starci-pkg-proof-fixture-');
  gitIn(dir, 'init', '-q');
  const dep = path.join(dir, 'dep');
  fs.mkdirSync(dep);
  fs.writeFileSync(path.join(dep, 'package.json'), JSON.stringify({ name: 'fixture-dep', version: '1.0.0', type: 'module', main: 'index.js' }));
  fs.writeFileSync(path.join(dep, 'index.js'), 'export const answer = 42;\n');
  const pkg = path.join(dir, 'pkg');
  fs.mkdirSync(pkg);
  fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: 'fixture-pkg', version: '1.0.0', type: 'module', ...(script ? { scripts: { test: script } } : {}),
    ...(declare ? { devDependencies: { 'fixture-dep': `file:${dep.replaceAll('\\', '/')}` } } : {}) }));
  fs.writeFileSync(path.join(pkg, 'answer.test.mjs'), "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { answer } from 'fixture-dep';\ntest('answer', () => assert.equal(answer, 42));\n");
  // the incident's shape: a node_modules beside the source (a hoisted or junctioned install) that satisfies the import here
  if (hoisted) fs.cpSync(dep, path.join(pkg, 'node_modules', 'fixture-dep'), { recursive: true });
  gitIn(dir, 'add', 'pkg/package.json', 'pkg/answer.test.mjs');
  return { root: dir, packages: [{ name: 'fixture-pkg', dir: 'pkg' }] };
}

test('a package whose test imports an undeclared dependency is red on a clean install, even with a local node_modules that hides it', (t) => {
  const f = fixture(t, { declare: false, hoisted: true });
  const { exit, results } = provePackages(f.packages, { root: f.root, env: OFFLINE });
  assert.equal(exit, PROOF_EXIT.red, JSON.stringify(results));
  assert.equal(results[0].status, 'red');
  assert.equal(results[0].code, PROOF_CODES.test);
  assert.equal(results[0].install, 'npm install (no lockfile)');
  assert.match(results[0].output, /fixture-dep/);
});

test('the same package with the dependency declared is green', (t) => {
  const f = fixture(t, { declare: true });
  const { exit, results } = provePackages(f.packages, { root: f.root, env: OFFLINE });
  assert.equal(exit, PROOF_EXIT.green, JSON.stringify(results));
  assert.deepEqual(results.map((r) => [r.name, r.status, r.code]), [['fixture-pkg', 'green', null]]);
});

test('a package that declares no test script is red: a published package proves itself', (t) => {
  const f = fixture(t, { declare: true, test: null });
  const { exit, results } = provePackages(f.packages, { root: f.root, env: OFFLINE });
  assert.equal(exit, PROOF_EXIT.red);
  assert.equal(results[0].code, PROOF_CODES.noTest);
});

test('npm that cannot start is a proof that did not run (exit 2), never a pass', (t) => {
  const f = fixture(t, { declare: true });
  const npm = () => ({ status: null, error: new Error('spawn npm ENOENT'), timedOut: false, output: '' });
  const { exit, results } = provePackages(f.packages, { root: f.root, env: OFFLINE, npm });
  assert.equal(exit, PROOF_EXIT.unrun);
  assert.equal(results[0].code, PROOF_CODES.unrun);
});

test('an install that fails on the network is not run; one that fails on the manifest is red', (t) => {
  const f = fixture(t, { declare: true });
  const failing = (output) => () => ({ status: 1, error: null, timedOut: false, output });
  assert.equal(provePackages(f.packages, { root: f.root, npm: failing('npm error code ENOTFOUND\nnpm error network request failed') }).exit, PROOF_EXIT.unrun);
  const red = provePackages(f.packages, { root: f.root, npm: failing('npm error code EUSAGE\nnpm error `npm ci` can only install packages when your package.json and package-lock.json are in sync') });
  assert.equal(red.exit, PROOF_EXIT.red);
  assert.equal(red.results[0].code, PROOF_CODES.install);
});

test('a committed stub under a nested node_modules of the package comes along; an untracked file never does', (t) => {
  const f = fixture(t, { declare: true });
  const fixtures = path.join(f.root, 'pkg', 'fixtures');
  // a lint fixture's committed type stub (as packages/eslint/be/fixtures/typed/node_modules): tracked, so part of the package
  fs.mkdirSync(path.join(fixtures, 'node_modules', 'fixture-stub'), { recursive: true });
  fs.writeFileSync(path.join(fixtures, 'node_modules', 'fixture-stub', 'package.json'), JSON.stringify({ name: 'fixture-stub', version: '1.0.0', type: 'module', main: 'index.js' }));
  fs.writeFileSync(path.join(fixtures, 'node_modules', 'fixture-stub', 'index.js'), 'export const stub = 1;' + String.fromCharCode(10));
  fs.writeFileSync(path.join(fixtures, 'stub.test.mjs'), ["import test from 'node:test';", "import { stub } from 'fixture-stub';", "test('stub', () => { if (stub !== 1) throw new Error('stub'); });", ''].join(String.fromCharCode(10)));
  gitIn(f.root, 'add', '-f', 'pkg/fixtures');
  fs.writeFileSync(path.join(f.root, 'pkg', 'untracked.test.mjs'), ["import test from 'node:test';", "test('never copied', () => { throw new Error('an untracked file reached the proof'); });", ''].join(String.fromCharCode(10)));
  const { exit, results } = provePackages(f.packages, { root: f.root, env: OFFLINE });
  assert.equal(exit, PROOF_EXIT.green, JSON.stringify(results));
});

test('a package outside a git work tree is a proof that did not run', (t) => {
  const dir = mkdtemp(t, 'starci-pkg-proof-nogit-');
  fs.mkdirSync(path.join(dir, 'pkg'));
  fs.writeFileSync(path.join(dir, 'pkg', 'package.json'), JSON.stringify({ name: 'p', version: '1.0.0', scripts: { test: 'node --test' } }));
  const { exit, results } = provePackages([{ name: 'p', dir: 'pkg' }], { root: dir, env: OFFLINE });
  assert.equal(exit, PROOF_EXIT.unrun, JSON.stringify(results));
  assert.match(results[0].output, /not inside a git work tree/);
});
