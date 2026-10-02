import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import { installRuntime, resolveNpmEntry, RUNTIME_VERSION } from '../../packages/cli/src/runtime-install.mjs';

const fakeInstall = ({ cwd = path.resolve('fake-repo'), home = path.resolve('fake-home'), ...deps } = {}) => {
  const installRoot = path.join(home, '.starci', 'runtime');
  const installer = path.join(installRoot, 'node_modules', 'starci', 'scripts', 'install', 'install.mjs');
  return {
    cwd,
    home,
    installRoot,
    installer,
    deps: {
      exists: (file) => file === installer,
      mkdir: () => {},
      write: () => {},
      chmod: () => {},
      ...deps,
    },
  };
};

test('npm entry resolution honors npm_execpath before the Node layouts', () => {
  const node = path.resolve('node-env', 'bin', 'node');
  const npmEntry = path.resolve('custom-npm', 'bin', 'npm-cli.js');
  const probed = [];
  assert.equal(resolveNpmEntry({
    execPath: node,
    env: { npm_execpath: npmEntry },
    exists: (candidate) => { probed.push(candidate); return candidate === npmEntry; },
  }), npmEntry);
  assert.deepEqual(probed, [npmEntry]);
});

test('npm entry resolution probes the Windows layout beside node.exe', () => {
  const node = path.resolve('node-win', 'node.exe');
  const npmEntry = path.join(path.dirname(node), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  assert.equal(resolveNpmEntry({ execPath: node, env: {}, exists: (candidate) => candidate === npmEntry }), npmEntry);
});

test('npm entry resolution probes the POSIX prefix lib layout', () => {
  const prefix = path.resolve('node-prefix');
  const node = path.join(prefix, 'bin', 'node');
  const npmEntry = path.join(prefix, 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js');
  assert.equal(resolveNpmEntry({ execPath: node, env: {}, exists: (candidate) => candidate === npmEntry }), npmEntry);
});

test('npm entry resolution returns null when no npm-cli.js exists', () => {
  assert.equal(resolveNpmEntry({ execPath: path.resolve('node-none', 'node'), env: {}, exists: () => false }), null);
});

test('runtime install spawns Node with npm and installer argument arrays without a shell', () => {
  const npmEntry = path.resolve('node-current', 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const calls = [];
  const fixture = fakeInstall({
    resolveNpmEntry: () => npmEntry,
    spawn: (command, args, options) => { calls.push({ command, args, options }); return { status: 0 }; },
  });

  assert.equal(installRuntime({ cwd: fixture.cwd, home: fixture.home }, fixture.deps), 0);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].command, process.execPath);
  assert.deepEqual(calls[0].args, [npmEntry, 'install', '--prefix', fixture.installRoot, `starci@${RUNTIME_VERSION}`]);
  assert.equal(calls[0].options.shell, false);
  assert.equal(calls[1].command, process.execPath);
  assert.deepEqual(calls[1].args, [fixture.installer, 'init', '--dir', fixture.cwd]);
  assert.equal(calls[1].options.shell, false);
});

test('a missing npm entry names every probe and tells the user how to proceed', () => {
  const errors = [];
  const nodeDirectory = path.dirname(process.execPath);
  const fixture = fakeInstall({ env: {}, resolveNpmEntry: () => null });
  assert.equal(installRuntime({ cwd: fixture.cwd, home: fixture.home, stderr: (text) => errors.push(text) }, fixture.deps), 1);
  const message = errors.join('');
  assert.match(message, /cannot find npm-cli\.js/);
  assert.ok(message.includes(path.join(nodeDirectory, 'node_modules', 'npm', 'bin', 'npm-cli.js')));
  assert.ok(message.includes(path.join(path.dirname(nodeDirectory), 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js')));
  assert.match(message, /Install npm alongside Node\.js or set npm_execpath/);
});

test('npm and runtime installer spawn errors and signals are printed', async (t) => {
  for (const [name, result, expected] of [
    ['spawn error', { error: new Error('spawn EINVAL') }, /failed to start: spawn EINVAL/],
    ['signal', { status: null, signal: 'SIGTERM' }, /stopped on signal SIGTERM/],
  ]) {
    await t.test(`npm ${name}`, () => {
      const errors = [];
      const fixture = fakeInstall({ runNpm: () => result });
      assert.equal(installRuntime({ cwd: fixture.cwd, home: fixture.home, stderr: (text) => errors.push(text) }, fixture.deps), 1);
      assert.match(errors.join(''), expected);
      assert.match(errors.join(''), /npm install/);
    });

    await t.test(`runtime installer ${name}`, () => {
      const errors = [];
      const fixture = fakeInstall({ runNpm: () => ({ status: 0 }), runNode: () => result });
      assert.equal(installRuntime({ cwd: fixture.cwd, home: fixture.home, stderr: (text) => errors.push(text) }, fixture.deps), 1);
      assert.match(errors.join(''), expected);
      assert.match(errors.join(''), /runtime installer/);
    });
  }
});

test('the npm entry resolved on this host executes through the current Node binary', (t) => {
  const npmEntry = resolveNpmEntry();
  if (!npmEntry) {
    t.skip('no npm-cli.js exists at npm_execpath or either Node installation layout on this host');
    return;
  }
  const result = spawnSync(process.execPath, [npmEntry, '--version'], {
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^\d+\.\d+\.\d+/);
});
