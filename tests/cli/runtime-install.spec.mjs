import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { installRuntime, resolveNpmEntry } from '../../packages/cli/src/runtime-install.mjs';
import {init, update} from '../../scripts/install/install.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

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

test('offline runtime installation binds the real shim to the installed host and physical CLI/HFS dependency', { timeout: 60_000 }, async (t) => {
  const fixture = mkdtemp(t, 'starci-shim-home-');
  const home = path.join(fixture, 'home');
  const cwd = path.join(fixture, 'app');
  const cli = path.join(fixture, 'installed', 'node_modules', '@starci', 'cli');
  const hfs = path.join(cli, 'node_modules', '@starci', 'hfs');
  const root = path.resolve(import.meta.dirname, '..', '..');
  for (const [name, destination] of [['cli', cli], ['hfs', hfs]]) {
    const source = path.join(root, 'packages', name);
    fs.cpSync(source, destination, {
      recursive: true,
      filter: (file) => !path.relative(source, file).split(path.sep).includes('node_modules'),
    });
  }
  fs.mkdirSync(cwd, { recursive: true });
  const declaration = JSON.stringify({ hfs: 2, kind: 'app', project: 'installed-shim', sides: {
    be: { apps: [{ name: 'api', kind: 'api' }] },
    fe: { apps: [{ name: 'web', kind: 'next' }], reads: ['be/contracts/'] },
  } });
  fs.writeFileSync(path.join(cwd, 'hfs.json'), declaration);
  const runtimeRoot = path.join(home, '.starci', 'runtime', 'node_modules', 'starci');
  const installer = path.join(runtimeRoot, 'scripts', 'install', 'install.mjs');
  fs.mkdirSync(path.dirname(installer), { recursive: true });
  fs.writeFileSync(installer, 'export {};\n');
  const standaloneManifest = JSON.parse(fs.readFileSync(path.join(cli, 'package.json'), 'utf8'));
  standaloneManifest.version = '99.0.0-fixture';
  fs.writeFileSync(path.join(cli, 'package.json'), JSON.stringify(standaloneManifest));
  const installedCli = await import(pathToFileURL(path.join(cli, 'src', 'runtime-install.mjs')).href);
  const fetched = [];
  const calls = [];
  const runInstaller = args => {
    calls.push(args);
    (args[1] === 'init' ? init : update)({dir: cwd, bootstrap: false, hosts: []}, () => {});
    return {status: 0};
  };
  assert.equal(installedCli.installRuntime({ cwd, home, noBootstrap: true }, {
    fetchRuntime: ({packageSpec}) => { fetched.push(packageSpec); return {status: 0}; }, runNode: runInstaller,
  }), 0);
  assert.deepEqual(calls, [[installer, 'init', '--dir', cwd, '--no-bootstrap']]);
  assert.deepEqual(fetched, [`starci@${JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version}`]);
  const hostRuntime = path.join(cwd, '.claude');
  const record = path.join(home, '.starci', 'runtime.json');
  assert.deepEqual(JSON.parse(fs.readFileSync(record, 'utf8')), {root: hostRuntime});
  fs.mkdirSync(path.join(runtimeRoot, 'scripts', 'cli'), {recursive: true});
  fs.writeFileSync(path.join(runtimeRoot, 'scripts', 'cli', 'main.mjs'), 'throw new Error("download cache must not own host commands");\n');
  assert.equal(fs.existsSync(path.join(runtimeRoot, 'packages', 'hfs', 'src')), false);
  assert.equal(fs.existsSync(path.join(runtimeRoot, 'node_modules', '@starci', 'hfs')), false);
  assert.equal(fs.existsSync(path.join(cli, '..', 'hfs')), false);
  assert.equal(fs.lstatSync(hfs).isSymbolicLink(), false);
  const cliManifest = JSON.parse(fs.readFileSync(path.join(cli, 'package.json'), 'utf8'));
  const hfsManifest = JSON.parse(fs.readFileSync(path.join(hfs, 'package.json'), 'utf8'));
  assert.equal(hfsManifest.name, '@starci/hfs');
  assert.equal(hfsManifest.version, cliManifest.dependencies[hfsManifest.name]);
  const sourceHfs = createRequire(path.join(root, 'packages', 'hfs', 'package.json'));
  const privateHfs = createRequire(path.join(hfs, 'package.json'));
  for (const [name, version] of Object.entries(hfsManifest.dependencies ?? {})) {
    const manifestFile = (sourceHfs.resolve.paths(name) ?? [])
      .map((modules) => path.join(modules, ...name.split('/'), 'package.json')).find((file) => fs.existsSync(file));
    assert.ok(manifestFile, `offline fixture requires an actual installed ${name}@${version}`);
    const source = fs.realpathSync.native(path.dirname(manifestFile));
    const dependency = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));
    assert.equal(dependency.name, name);
    assert.equal(dependency.version, version);
    const destination = path.join(hfs, 'node_modules', ...name.split('/'));
    fs.cpSync(source, destination, {
      recursive: true,
      filter: (file) => !path.relative(source, file).split(path.sep).includes('node_modules'),
    });
    assert.equal(fs.lstatSync(destination).isSymbolicLink(), false);
    const entry = fs.realpathSync.native(privateHfs.resolve(name));
    const relative = path.relative(fs.realpathSync.native(destination), entry);
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), `${name} must resolve inside its private physical package`);
  }
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(?:STARCI_|ORCA_)/i.test(key) && !['NODE_OPTIONS', 'NODE_PATH'].includes(key)));
  Object.assign(env, { HOME: home, USERPROFILE: home, LOCALAPPDATA: path.join(fixture, 'local'), APPDATA: path.join(fixture, 'roaming') });
  const shim = path.join(home, '.starci', 'bin', process.platform === 'win32' ? 'starci.cmd' : 'starci');
  const invoke = (...args) => process.platform === 'win32'
    ? spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `"${shim}"`, ...args], { cwd, env, encoding: 'utf8', windowsHide: true, windowsVerbatimArguments: true, timeout: 30_000 })
    : spawnSync(shim, args, { cwd, env, encoding: 'utf8', timeout: 30_000 });
  const owned = invoke('app', 'explain', 'hfs.json', '--json');
  assert.equal(owned.status, 0, owned.stderr || String(owned.error ?? ''));
  const explained = JSON.parse(owned.stdout);
  assert.deepEqual([explained.path, explained.status, explained.slot], ['hfs.json', 'owned', 'app.declaration']);
  const hostManifest = JSON.parse(fs.readFileSync(path.join(hostRuntime, 'package.json')));
  for (const [name, version] of Object.entries(hostManifest.dependencies ?? {})) {
    const source = path.join(hfs, 'node_modules', ...name.split('/'));
    const identity = JSON.parse(fs.readFileSync(path.join(source, 'package.json')));
    assert.deepEqual([identity.name, identity.version], [name, version]);
    const destination = path.join(hostRuntime, 'node_modules', ...name.split('/'));
    fs.cpSync(source, destination, {recursive: true});
    assert.equal(fs.lstatSync(destination).isSymbolicLink(), false);
  }
  const runtimeVersion = hostManifest.version;
  const version = invoke('runtime', 'version');
  assert.equal(version.status, 0, version.stderr || String(version.error ?? ''));
  assert.equal(version.stdout.trim(), runtimeVersion);
  const locator = await import(pathToFileURL(path.join(cli, 'src', 'runtime-locate.mjs')).href);
  const binding = locator.locateRuntime({cwd, home, env, embeddedRoot: path.join(fixture, 'absent')});
  assert.deepEqual(binding, {root: hostRuntime, source: record});
  const rootOwner = await import(pathToFileURL(path.join(binding.root, 'engine', 'runtime-root.mjs')).href);
  const configOwner = await import(pathToFileURL(path.join(binding.root, 'engine', 'config.mjs')).href);
  assert.equal(rootOwner.skillRoot, hostRuntime);
  assert.equal(rootOwner.starciSourceRoot(env), cwd);
  assert.equal(configOwner.configRoot, hostRuntime);
  const configFile = path.join(hostRuntime, 'config.yaml');
  const originalConfig = fs.readFileSync(configFile, 'utf8');
  fs.writeFileSync(configFile, originalConfig + '\nspecs: {harness: true, unit: false, e2e: true}\n');
  assert.deepEqual(configOwner.specsSettings(configOwner.loadConfig()), {harness: true, unit: false, e2e: true});
  fs.writeFileSync(configFile, originalConfig);
  fs.rmSync(runtimeRoot, {recursive: true});
  const withoutCache = invoke('runtime', 'version');
  assert.equal(withoutCache.status, 0, withoutCache.stderr || String(withoutCache.error ?? ''));
  assert.equal(withoutCache.stdout.trim(), runtimeVersion);
  fs.mkdirSync(path.dirname(installer), {recursive: true});
  fs.writeFileSync(installer, 'export {};\n');
  assert.equal(installedCli.installRuntime({cwd, home, noBootstrap: true}, {
    fetchRuntime: () => ({status: 0}), runNode: runInstaller,
  }), 0);
  assert.deepEqual(calls[1], [installer, 'update', '--dir', cwd, '--no-bootstrap']);
  assert.deepEqual(JSON.parse(fs.readFileSync(record, 'utf8')), {root: hostRuntime});
  const afterUpdate = invoke('runtime', 'version');
  assert.equal(afterUpdate.status, 0, afterUpdate.stderr || String(afterUpdate.error ?? ''));
  assert.equal(afterUpdate.stdout.trim(), runtimeVersion);
  const unowned = invoke('app', 'explain', 'unowned.fixture', '--json');
  assert.equal(unowned.status, 1, unowned.stderr || String(unowned.error ?? ''));
  const refused = JSON.parse(unowned.stdout);
  assert.deepEqual([refused.path, refused.status, refused.code], ['unowned.fixture', 'no-slot', 'HFS_SLOT_UNDECLARED']);
  assert.equal(fs.readFileSync(path.join(cwd, 'hfs.json'), 'utf8'), declaration);
  assert.deepEqual(fs.readdirSync(cwd).sort(), ['.agents', '.claude', 'hfs.json']);
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
