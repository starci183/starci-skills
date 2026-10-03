import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROOF_CODES, PROOF_EXIT, cleanEnv, installUnits, packagesChanged, provePackages, publishSet } from '../../scripts/gates/package-clean-test.mjs';
import { loadPins } from '../../scripts/gates/canon-pins.mjs';
import { spawnSync } from 'node:child_process';
import { withoutGitLocalEnv } from '../../scripts/lib/git.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';
import { tgz } from '../helpers/npm-tarball.mjs';
import { tarFiles } from '../../scripts/lib/tar-files.mjs';

// scripts/gates/package-clean-test.mjs: a published package proves itself from a clean install. The fixture packages
// install offline (npm_config_offline, one local file: dependency), so the spec needs no network.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
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

const gitIn = (dir, ...args) => { const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8', env: withoutGitLocalEnv(process.env), windowsHide: true }); assert.equal(r.status, 0, r.stderr); };

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

function packedFixture(t, { declared = true, locked = false, version = '1.0.0' } = {}) {
  const root = mkdtemp(t, 'starci-pkg-proof-fixture-');
  gitIn(root, 'init', '-q');
  for (const dir of ['consumer', 'dependency']) fs.mkdirSync(path.join(root, dir));
  fs.writeFileSync(path.join(root, 'consumer/package.json'), JSON.stringify({ name: '@starci/consumer', version: '1.0.0', scripts: { test: 'node --test' },
    ...(declared ? { dependencies: { '@starci/dependency': version } } : {}) }));
  fs.writeFileSync(path.join(root, 'dependency/package.json'), JSON.stringify({ name: '@starci/dependency', version: '1.0.0', main: 'index.js' }));
  fs.writeFileSync(path.join(root, 'dependency/index.js'), 'module.exports = 42;\n');
  if (locked) fs.writeFileSync(path.join(root, 'consumer/package-lock.json'), '{}\n');
  gitIn(root, 'add', 'consumer', 'dependency');
  return { root, packages: [{ name: '@starci/consumer', dir: 'consumer' }], sources: ['consumer', 'dependency'] };
}

const successfulNpm = { status: 0, error: null, timedOut: false, output: '' };

function packedSeams({ mutate = null, identity = null, linked = null } = {}) {
  const calls = [];
  const pack = (spec, destination) => {
    calls.push('pack');
    assert.equal(fs.existsSync(path.join(spec, 'untracked.js')), false);
    assert.equal(fs.existsSync(path.join(spec, 'node_modules')), false);
    const manifest = fs.readFileSync(path.join(spec, 'package.json'), 'utf8');
    const file = 'dependency.tgz';
    fs.writeFileSync(path.join(destination, file), tgz({ 'package/package.json': identity ?? manifest, 'package/index.js': fs.readFileSync(path.join(spec, 'index.js')) }));
    return { ok: true, file, detail: '' };
  };
  const npm = (args, { cwd }) => {
    calls.push(args[0]);
    const dir = path.join(cwd, 'node_modules/@starci/dependency');
    if (args[0] === 'install') {
      const spec = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')).dependencies['@starci/dependency'];
      assert.match(spec, /^file:.*\.tgz$/);
      fs.mkdirSync(path.dirname(dir), { recursive: true });
      if (linked) fs.symlinkSync(linked, dir, process.platform === 'win32' ? 'junction' : 'dir');
      else {
        for (const [file, body] of tarFiles(fs.readFileSync(spec.slice('file:'.length)))) {
          const target = path.join(dir, file.slice('package/'.length));
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, body);
        }
        mutate?.(dir);
      }
    } else {
      assert.equal(args[0], 'test');
      assert.equal(fs.lstatSync(dir).isDirectory(), true);
      assert.equal(fs.readFileSync(path.join(dir, 'index.js'), 'utf8'), 'module.exports = 42;\n');
    }
    return successfulNpm;
  };
  return { pack, npm, calls };
}

test('a declared unpublished local dependency installs its actual pack, without changing the source manifest', (t) => {
  const f = packedFixture(t);
  const original = fs.readFileSync(path.join(f.root, 'consumer/package.json'));
  fs.writeFileSync(path.join(f.root, 'dependency/untracked.js'), 'not packed');
  fs.mkdirSync(path.join(f.root, 'dependency/node_modules'), { recursive: true });
  const seams = packedSeams();
  const proof = provePackages(f.packages, { ...f, ...seams });
  assert.equal(proof.exit, PROOF_EXIT.green, JSON.stringify(proof.results));
  assert.deepEqual(seams.calls, ['pack', 'install', 'test']);
  assert.deepEqual(proof.results[0].localDependencies, [{ name: '@starci/dependency', version: '1.0.0', packedFiles: ['package/index.js', 'package/package.json'] }]);
  assert.deepEqual(fs.readFileSync(path.join(f.root, 'consumer/package.json')), original);
});

test('an install whose local dependency bytes differ from the pack is red before its test runs', (t) => {
  const f = packedFixture(t);
  const seams = packedSeams({ mutate: (dir) => fs.writeFileSync(path.join(dir, 'index.js'), 'borrowed output') });
  const proof = provePackages(f.packages, { ...f, ...seams });
  assert.equal(proof.exit, PROOF_EXIT.red);
  assert.equal(proof.results[0].code, PROOF_CODES.install);
  assert.match(proof.results[0].output, /differs from the candidate tarball/);
  assert.deepEqual(seams.calls, ['pack', 'install']);
});

test('a dependency linked back to its source cannot satisfy a clean packed install', (t) => {
  const f = packedFixture(t);
  const seams = packedSeams({ linked: path.join(f.root, 'dependency') });
  const proof = provePackages(f.packages, { ...f, ...seams });
  assert.equal(proof.exit, PROOF_EXIT.red);
  assert.match(proof.results[0].output, /missing or linked/);
  assert.deepEqual(seams.calls, ['pack', 'install']);
  assert.equal(fs.readFileSync(path.join(f.root, 'dependency/index.js'), 'utf8'), 'module.exports = 42;\n');
});

test('a tarball with another package identity refuses before install', (t) => {
  const f = packedFixture(t);
  const seams = packedSeams({ identity: '{"name":"@starci/other","version":"1.0.0"}' });
  const proof = provePackages(f.packages, { ...f, ...seams });
  assert.equal(proof.exit, PROOF_EXIT.red);
  assert.match(proof.results[0].output, /different package name or version/);
  assert.deepEqual(seams.calls, ['pack']);
});

test('a different declared version or a locked local substitution never changes the install contract', (t) => {
  for (const options of [{ version: '0.9.0' }, { locked: true }]) {
    const f = packedFixture(t, options);
    const original = fs.readFileSync(path.join(f.root, 'consumer/package.json'));
    const seams = packedSeams();
    const proof = provePackages(f.packages, { ...f, ...seams });
    assert.equal(proof.exit, options.locked ? PROOF_EXIT.unrun : PROOF_EXIT.red);
    assert.match(proof.results[0].output, options.locked ? /locked install/ : /declares.*candidate/);
    assert.deepEqual(seams.calls, []);
    assert.deepEqual(fs.readFileSync(path.join(f.root, 'consumer/package.json')), original);
    if (options.locked) assert.equal(fs.readFileSync(path.join(f.root, 'consumer/package-lock.json'), 'utf8'), '{}\n');
  }
});

test('an undeclared local sibling is never added to make its consumer test pass', (t) => {
  const f = packedFixture(t, { declared: false });
  let packs = 0;
  const proof = provePackages(f.packages, { ...f, pack: () => { packs += 1; throw new Error('undeclared pack'); }, npm: (args, { cwd }) => {
    assert.equal(JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')).dependencies, undefined);
    assert.equal(fs.existsSync(path.join(cwd, 'node_modules/@starci/dependency')), false);
    return args[0] === 'test' ? { ...successfulNpm, status: 1, output: 'ERR_MODULE_NOT_FOUND @starci/dependency' } : successfulNpm;
  } });
  assert.equal(proof.exit, PROOF_EXIT.red);
  assert.equal(proof.results[0].code, PROOF_CODES.test);
  assert.equal(packs, 0);
});

test('unpublished registry install failures retain E404 and ETARGET as red findings', (t) => {
  const f = packedFixture(t, { declared: false });
  for (const code of ['E404', 'ETARGET']) {
    const proof = provePackages(f.packages, { ...f, npm: () => ({ ...successfulNpm, status: 1, output: `npm error code ${code}\nunpublished candidate` }) });
    assert.equal(proof.exit, PROOF_EXIT.red);
    assert.equal(proof.results[0].code, PROOF_CODES.install);
    assert.match(proof.results[0].output, new RegExp(code));
  }
});
