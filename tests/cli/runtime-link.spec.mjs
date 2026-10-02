import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { CATALOG } from '../../packages/cli/src/catalog.generated.mjs';
import { main } from '../../packages/cli/src/main.mjs';
import { installRuntime, RUNTIME_VERSION } from '../../packages/cli/src/runtime-install.mjs';
import { findRuntimeRoot, linkRuntime, RUNTIME_ROOT_FILES } from '../../packages/cli/src/runtime-link.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const capture = () => {
  const value = { out: '', err: '' };
  return { value, stdout: (text) => { value.out += text; }, stderr: (text) => { value.err += text; } };
};
const runtimeFiles = (root) => new Set(RUNTIME_ROOT_FILES.map((relative) => path.join(root, relative)));

test('the pinned runtime version matches the root package version', () => {
  const packageVersion = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).version;
  assert.equal(RUNTIME_VERSION, packageVersion);
});

test('runtime link writes the record and POSIX shim through injected seams', () => {
  const cwd = path.resolve('repo');
  const root = path.resolve(cwd, 'live-runtime');
  const home = path.resolve('fake-home');
  const present = runtimeFiles(root);
  const writes = new Map();
  const chmods = [];
  const output = capture();
  const code = linkRuntime({ cwd, home, root: 'live-runtime', json: true, ...output }, {
    exists: (file) => present.has(file),
    mkdir: () => {},
    write: (file, text) => writes.set(file, text),
    chmod: (file, mode) => chmods.push({ file, mode }),
    platform: 'linux',
    node: '/node/current',
  });

  const runtimeJson = path.join(home, '.starci', 'runtime.json');
  const shim = path.join(home, '.starci', 'bin', 'starci');
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(output.value.out), { root, runtimeJson, shim });
  assert.deepEqual(JSON.parse(writes.get(runtimeJson)), { root });
  assert.equal(writes.get(shim), `#!/bin/sh\nexec "/node/current" "${path.join(root, 'packages', 'cli', 'bin', 'starci.mjs')}" "$@"\n`);
  assert.deepEqual(chmods, [{ file: shim, mode: 0o755 }]);
  assert.equal(output.value.err, '');
});

test('runtime install and link use identical Windows shim text for the same runtime', () => {
  const home = path.resolve('fake-home');
  const cwd = path.resolve('repo');
  const root = path.join(home, '.starci', 'runtime', 'node_modules', 'starci');
  const installWrites = new Map();
  assert.equal(installRuntime({ cwd, home }, {
    platform: 'win32',
    node: 'C:\\node.exe',
    exists: (file) => file === path.join(root, 'scripts', 'install', 'install.mjs'),
    mkdir: () => {},
    write: (file, text) => installWrites.set(file, text),
    chmod: () => {},
    fetchRuntime: () => 0,
    runNode: () => 0,
  }), 0);

  const linkWrites = new Map();
  assert.equal(linkRuntime({ cwd, home, root, quiet: true, stderr: () => {} }, {
    platform: 'win32',
    node: 'C:\\node.exe',
    exists: (file) => runtimeFiles(root).has(file),
    mkdir: () => {},
    write: (file, text) => linkWrites.set(file, text),
    chmod: () => {},
  }), 0);
  assert.equal(linkWrites.get(path.join(home, '.starci', 'runtime.json')), installWrites.get(path.join(home, '.starci', 'runtime.json')));
  assert.equal(linkWrites.get(path.join(home, '.starci', 'bin', 'starci.cmd')), installWrites.get(path.join(home, '.starci', 'bin', 'starci.cmd')));
});

test('default discovery chooses the nearest checkout or .claude runtime', () => {
  const project = path.resolve('project');
  const cwd = path.join(project, 'apps', 'api');
  const near = path.join(project, '.claude');
  const far = path.resolve('.claude');
  const present = new Set([...runtimeFiles(near), ...runtimeFiles(far)]);
  assert.equal(findRuntimeRoot({ cwd, exists: (file) => present.has(file) }), near);
});

test('repeated human links are idempotent and print the two written paths', () => {
  const root = path.resolve('runtime');
  const home = path.resolve('fake-home');
  const writes = new Map();
  const deps = {
    exists: (file) => runtimeFiles(root).has(file),
    mkdir: () => {},
    write: (file, text) => writes.set(file, text),
    chmod: () => {},
    platform: 'linux',
  };
  const expected = `${path.join(home, '.starci', 'runtime.json')}\n${path.join(home, '.starci', 'bin', 'starci')}\n`;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const output = capture();
    assert.equal(linkRuntime({ root, home, ...output }, deps), 0);
    assert.equal(output.value.out, expected);
    assert.equal(output.value.err, '');
  }
  assert.equal(writes.size, 2);
});

test('invalid roots are refusals that name every missing runtime entry', () => {
  const output = capture();
  const cwd = path.resolve('repo');
  const root = path.resolve(cwd, 'not-runtime');
  assert.equal(linkRuntime({ cwd, root, ...output }, {
    exists: (file) => file.endsWith(path.join('scripts', 'cli', 'main.mjs')),
  }), 2);
  assert.match(output.value.err, /is not a StarCi runtime root/);
  assert.match(output.value.err, /packages[\\/]cli[\\/]bin[\\/]starci\.mjs/);
  assert.equal(output.value.out, '');
});

test('the dispatcher serves runtime link in-process with global output flags', async () => {
  const output = capture();
  let call;
  assert.equal(CATALOG.groups.runtime.verbs.link.json, 'flag');
  assert.deepEqual(CATALOG.groups.runtime.verbs.link.flags.map((flag) => flag.name), ['root']);
  assert.equal(await main(['--cwd', 'repo', 'runtime', 'link', '--root', '../runtime', '--json'], {
    ...output,
    catalog: CATALOG,
    cwd: path.resolve('base'),
    linkRuntime: (options) => { call = options; return 0; },
    locateRuntime: () => { throw new Error('must not locate'); },
    spawn: () => { throw new Error('must not spawn'); },
  }), 0);
  assert.equal(call.cwd, path.resolve('base', 'repo'));
  assert.equal(call.root, '../runtime');
  assert.equal(call.json, true);
});
