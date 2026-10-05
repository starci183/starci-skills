import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {sha256} from '../../engine/digest.mjs';
import {doctorInstallation} from '../../scripts/install/doctor.mjs';
import {doctor, init, main} from '../../scripts/install/install.mjs';
import {mkdtemp} from '../helpers/tmpdir.mjs';

const source = path.resolve(import.meta.dirname, '..', '..');
const sourcePackage = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));
const write = (root, relative, body) => {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, body);
};
const inventory = root => Object.fromEntries(fs.readdirSync(root, {recursive: true, withFileTypes: true})
  .filter(entry => entry.isFile()).map(entry => {
    const file = path.join(entry.parentPath, entry.name);
    return [path.relative(root, file).split(path.sep).join('/'), sha256(fs.readFileSync(file))];
  }).sort(([a], [b]) => a.localeCompare(b)));

function fixture(t, {dependency = false} = {}) {
  const repo = mkdtemp(t, 'starci-entry-');
  const target = path.join(repo, '.claude');
  const pkg = {...sourcePackage, dependencies: dependency ? {'fixture-dependency': '1.0.0'} : {}};
  write(target, 'package.json', JSON.stringify(pkg));
  write(target, 'scripts/cli/main.mjs', 'export function main() { return 0; }\n');
  write(target, 'scripts/kernel/cli.mjs', 'throw new Error("doctor must not execute the Kernel mutation entry");\n');
  write(target, 'scripts/reconciler/start.mjs', 'export const sqliteItem = () => ({id: "node-sqlite", status: "green", detail: "fixture capability"});\n');
  write(target, 'modules/fixture.yaml', 'fixture: valid\n');
  write(target, 'knowledge/fixture.yaml', 'fixture: valid\n');
  for (const file of ['scripts/checks/check-module-yaml.mjs', 'engine/yaml.mjs',
    'scripts/lib/walk.mjs', 'scripts/lib/is-main.mjs', 'scripts/api/fs/is-link-like.mjs',
    'scripts/lib/path-key.mjs', 'scripts/lib/fs-kind.mjs']) {
    write(target, file, fs.readFileSync(path.join(source, file)));
  }
  const expectedFiles = Object.fromEntries(Object.entries(inventory(target)).map(([file]) =>
    [file, sha256(fs.readFileSync(path.join(target, file), 'utf8').replace(/\r\n/g, '\n'))]));
  const entry = '.agents/skills/fixture/SKILL.md';
  write(repo, entry, '# Private doctor fixture entry\n');
  const files = {[entry]: sha256(fs.readFileSync(path.join(repo, entry)))};
  const manifest = {name: pkg.name, version: pkg.version, files: {...expectedFiles},
    installProtocol: {fixture: true}, hostSkills: {hashMode: 'sha256-bytes', files}};
  const input = {repo, target, manifest, packageManifest: pkg, expectedFiles, quick: false,
    excluded: relative => /(^|\/)private-local$/.test(relative),
    checkProtocol: value => { if (value.installProtocol?.fixture !== true) throw new Error('invalid fixture protocol'); },
    planEntries: () => ({files, write: []})};
  const logs = [];
  return {repo, target, input, manifest, logs, run: (deps = {}) => doctorInstallation(input, text => logs.push(text), deps)};
}

test('installer lifecycle installs only runtime dependencies in the physical projected host and preserves caller environment', t => {
  const repo = mkdtemp(t, 'starci-entry-'), target = path.join(repo, '.claude');
  const calls = [], errors = [], environment = {...Object.fromEntries(Object.entries(process.env)
    .filter(([name]) => !name.toUpperCase().startsWith('SOPS_AGE_'))), STARCI_ROLE: 'owner',
    ORCA_TERMINAL_HANDLE: 'fixture-caller', SOPS_AGE_KEY: 'fixture-original-inline'};
  let owner = null;
  const environmentBefore = {...environment};
  const deps = {env: environment, log: () => {}, error: text => errors.push(text), initialAge: {
    locks: {
      acquire: options => {
        assert.equal(options.ttlMs, null);
        owner = {token: 'doctor-fixture', pid: process.pid, host: os.hostname(), stale: false, ttlMs: null};
        return {ok: true, token: owner.token, owner};
      },
      owner: () => owner,
      release: ({token}) => { assert.equal(token, owner?.token); owner = null; return {ok: true, released: true}; },
    },
    runProgram: () => { assert.fail('dependency fixture reached AGE capture'); },
    resolveRealTool: () => { assert.fail('dependency fixture resolved a real tool'); },
    publish: () => { assert.fail('dependency fixture published credentials'); },
  }, runNpm: (args, options) => {
    calls.push({args, options});
    assert.equal(JSON.parse(fs.readFileSync(path.join(target, 'package.json'))).version, sourcePackage.version);
    assert.equal(fs.existsSync(path.join(target, '.starci-skills.json')), true);
    return {status: 0, stdout: 'fixture npm completed', stderr: ''};
  }};
  assert.equal(main(['init', '--dir', repo, '--no-bootstrap'], deps), 0, errors.join(String.fromCharCode(10)));
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args, ['install', '--prefix', target, '--omit=dev', '--no-save', '--package-lock=false', '--no-audit', '--no-fund']);
  assert.equal(calls[0].options.cwd, target); assert.equal(calls[0].options.env, environment);
  assert.deepEqual(environment, environmentBefore);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(target, 'package.json'))), sourcePackage);
  assert.equal(fs.existsSync(path.join(target, 'package-lock.json')), false);
  assert.equal(fs.existsSync(path.join(repo, 'AGENTS.md')), false);
  assert.equal(main(['update', '--dir', repo, '--no-bootstrap'], deps), 0);
  assert.equal(calls.length, 2);
  const after = inventory(repo);
  assert.equal(main(['doctor', '--dir', repo, '--quick'], deps), 0);
  assert.equal(calls.length, 2, 'read-only doctor must never install dependencies');
  assert.deepEqual(inventory(repo), after);
});

test('incomplete or refused dependency installs fail visibly and redirected targets are refused before projection', t => {
  const repo = mkdtemp(t, 'starci-entry-'), target = path.join(repo, '.claude');
  init({dir: repo, bootstrap: false, hosts: []}, () => {});
  for (const result of [{status: 1, stderr: 'fixture npm refusal'}, {status: null, signal: 'SIGTERM'},
    {status: null, error: {code: 'ENOENT', message: 'fixture runner missing'}}, {stdout: 'incomplete process'}]) {
    const errors = [], beforePackage = fs.readFileSync(path.join(target, 'package.json'));
    assert.equal(main(['update', '--dir', repo, '--no-bootstrap'], {
      log: () => {}, error: text => errors.push(text), runNpm: () => result,
    }), 1);
    assert.ok(errors.some(text => text.includes('runtime dependency installation failed')));
    assert.deepEqual(fs.readFileSync(path.join(target, 'package.json')), beforePackage);
  }
  const outside = path.join(repo, 'outside'); fs.mkdirSync(outside);
  write(outside, 'sentinel.txt', 'untouched fixture');
  fs.symlinkSync(outside, path.join(target, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  const manifest = fs.readFileSync(path.join(target, '.starci-skills.json')), outsideBefore = inventory(outside), errors = [];
  assert.equal(main(['update', '--dir', repo, '--no-bootstrap'], {
    log: () => {}, error: text => errors.push(text), runNpm: () => { assert.fail('redirected target reached npm'); },
  }), 1);
  assert.ok(errors.some(text => text.includes('redirected or not a directory')));
  assert.deepEqual(fs.readFileSync(path.join(target, '.starci-skills.json')), manifest);
  assert.deepEqual(inventory(outside), outsideBefore);
});

test('quick diagnosis uses the real installer custody without shipping contributor tests or changing the host', t => {
  const repo = mkdtemp(t, 'starci-entry-');
  init({dir: repo, bootstrap: false, hosts: [], force: false}, () => {});
  assert.equal(fs.existsSync(path.join(repo, '.claude/tests')), false);
  const before = inventory(repo), logs = [];
  assert.equal(doctor({dir: repo, quick: true}, text => logs.push(text)), 0);
  assert.deepEqual(inventory(repo), before);
  assert.ok(logs.some(text => text.includes('capabilities were not checked')));
  write(path.join(repo, '.claude'), 'scripts/cli/main.mjs', 'changed after installation\n');
  assert.ok(doctor({dir: repo, quick: true}, () => {}) > 0);
});

test('quick integrity cannot start a child check and still refuses payload drift', t => {
  const f = fixture(t); f.input.quick = true;
  const before = inventory(f.repo);
  assert.equal(f.run({runNode: () => { assert.fail('quick mode ran a child'); }}), 0);
  assert.deepEqual(inventory(f.repo), before);
  write(f.target, 'modules/fixture.yaml', 'fixture: changed\n');
  assert.ok(f.run({runNode: () => { assert.fail('invalid custody ran a child'); }}) > 0);
});

test('quick custody detects changed synthetic sample binary bytes despite equal UTF-8 decoding', t => {
  const f = fixture(t), relative = sourcePackage.files.find(file => file.startsWith('examples/.runtimes/') && file.endsWith('/runtime.sqlite'));
  const original = Buffer.from([0x80, 0x0d, 0x0a]), changed = Buffer.from([0x81, 0x0d, 0x0a]);
  assert.equal(original.toString('utf8'), changed.toString('utf8'));
  write(f.target, relative, original);
  f.manifest.files[relative] = f.input.expectedFiles[relative] = sha256(original);
  f.input.quick = true;
  const deps = {runNode: () => { assert.fail('quick binary custody started a child'); }};
  assert.equal(f.run(deps), 0);
  write(f.target, relative, changed);
  assert.ok(f.run(deps) > 0, 'different binary bytes refuse even when text decoding collides');
  assert.ok(f.logs.some(text => text.includes('payload changed since install')));
});

test('manifest, protocol and package identity failures stay red before installed checks', t => {
  for (const mutate of [f => {f.input.manifest = null;}, f => {f.manifest.installProtocol = {};},
    f => {f.manifest.version += '-different';}, f => {f.manifest.files = {};},
    f => {delete f.manifest.files['modules/fixture.yaml'];}]) {
    const f = fixture(t); mutate(f);
    assert.ok(f.run({runNode: () => { assert.fail('invalid installation ran a child'); }}) > 0);
  }
});

test('missing source entries and public discovery cannot pass a quick diagnostic', t => {
  for (const relative of ['scripts/cli/main.mjs', 'scripts/kernel/cli.mjs']) {
    const f = fixture(t); f.input.quick = true;
    fs.rmSync(path.join(f.target, relative));
    delete f.manifest.files[relative]; delete f.input.expectedFiles[relative];
    assert.ok(f.run() > 0);
  }
  const f = fixture(t); f.input.quick = true;
  f.input.planEntries = () => ({files: {}, write: []});
  assert.ok(f.run() > 0);
  f.input.planEntries = () => ({files: f.manifest.hostSkills.files, write: [{}]});
  assert.ok(f.run() > 0);
});

test('unsafe and excluded custody is refused before following or reading it', t => {
  for (const relative of ['../outside', 'C:/outside', 'scripts/../outside', 'private-local']) {
    const f = fixture(t); f.input.quick = true;
    f.manifest.files[relative] = '0'.repeat(64);
    const before = inventory(f.repo);
    assert.ok(f.run() > 0);
    assert.deepEqual(inventory(f.repo), before);
    assert.ok(f.logs.some(text => text.includes('custody')));
  }
});

test('full consumer diagnosis runs the actual shipped YAML checker and a bounded import probe with no tests directory', t => {
  const f = fixture(t), before = inventory(f.repo);
  assert.equal(f.run(), 0);
  assert.deepEqual(inventory(f.repo), before);
  assert.equal(fs.existsSync(path.join(f.target, 'tests')), false);
  assert.ok(f.logs.some(text => text.includes('2 parsed contracts')));
});

test('an installed parser failure stays red even when the edited bytes are honestly recorded', t => {
  const f = fixture(t);
  write(f.target, 'modules/fixture.yaml', 'fixture: [unclosed\n');
  const digest = sha256(fs.readFileSync(path.join(f.target, 'modules/fixture.yaml')));
  f.manifest.files['modules/fixture.yaml'] = digest; f.input.expectedFiles['modules/fixture.yaml'] = digest;
  assert.ok(f.run() > 0);
  assert.ok(f.logs.some(text => text.startsWith('FAIL installed YAML contracts')));
});

test('real dependency resolution rejects missing or hoisted packages and accepts only the physical declared install', t => {
  const f = fixture(t, {dependency: true});
  const packageBody = JSON.stringify({name: 'fixture-dependency', version: '1.0.0', type: 'module', exports: './main.mjs'});
  write(f.repo, 'node_modules/fixture-dependency/package.json', packageBody);
  write(f.repo, 'node_modules/fixture-dependency/main.mjs', 'export const loaded = true;\n');
  assert.ok(f.run() > 0);
  write(f.target, 'node_modules/fixture-dependency/package.json', packageBody);
  write(f.target, 'node_modules/fixture-dependency/main.mjs', 'export const loaded = true;\n');
  const before = inventory(f.repo);
  assert.equal(f.run(), 0);
  assert.deepEqual(inventory(f.repo), before);
  write(f.target, 'node_modules/fixture-dependency/package.json', packageBody.replace('1.0.0', '1.0.1'));
  assert.ok(f.run() > 0);
});

test('native failure, incomplete JSON and red SQLite capability are never a successful full diagnosis', t => {
  for (const result of [{status: null, error: {code: 'ETIMEDOUT'}}, {status: 1, stderr: 'fixture refusal'},
    {status: 0, stdout: 'not json'}, {status: 0, stdout: JSON.stringify({ok: true, files: 0, bad: []})}]) {
    const f = fixture(t);
    assert.ok(f.run({runNode: () => result}) > 0);
  }
  const f = fixture(t);
  write(f.target, 'scripts/reconciler/start.mjs', 'export const sqliteItem = () => ({id: "node-sqlite", status: "red", detail: "unsupported fixture SQLite"});\n');
  const digest = sha256(fs.readFileSync(path.join(f.target, 'scripts/reconciler/start.mjs')));
  f.manifest.files['scripts/reconciler/start.mjs'] = digest; f.input.expectedFiles['scripts/reconciler/start.mjs'] = digest;
  assert.ok(f.run() > 0);
});
