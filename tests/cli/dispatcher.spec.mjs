import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { main } from '../../packages/cli/src/main.mjs';
import { installRuntime, RUNTIME_VERSION } from '../../packages/cli/src/runtime-install.mjs';
import { locateRuntime } from '../../packages/cli/src/runtime-locate.mjs';

const global = [
  { name: 'json', type: 'boolean' },
  { name: 'cwd', type: 'string' },
  { name: 'quiet', type: 'boolean' },
  { name: 'help', type: 'boolean' },
  { name: 'edition', type: 'enum', enum: ['full'] },
];
const catalog = {
  global,
  groups: {
    app: { owner: '@starci/hfs', summary: 'app commands', verbs: {
      check: { group: 'app', verb: 'check', summary: 'check an app', flags: [], json: 'flag' },
    } },
    runtime: { owner: 'runtime', summary: 'runtime commands', verbs: {
      check: { group: 'runtime', verb: 'check', summary: 'check the runtime', flags: [], json: 'flag' },
      install: { group: 'runtime', verb: 'install', summary: 'install the runtime', flags: [{ name: 'force', type: 'boolean' }], json: 'none' },
    } },
  },
};
const retired = [{ spelling: 'starci api survey', use: 'starci kernel survey' }];
const capture = () => {
  const value = { out: '', err: '' };
  return { value, stdout: (text) => { value.out += text; }, stderr: (text) => { value.err += text; } };
};

test('help and completion are served without a runtime', async () => {
  const top = capture();
  assert.equal(await main(['help'], { ...top, catalog, retired, version: 'test' }), 0);
  assert.match(top.value.out, /Groups:/);
  const group = capture();
  assert.equal(await main(['runtime', '--help'], { ...group, catalog, retired }), 0);
  assert.match(group.value.out, /check\s+check the runtime/);
  const verb = capture();
  assert.equal(await main(['runtime', 'check', '--help'], { ...verb, catalog, retired }), 0);
  assert.match(verb.value.out, /check the runtime/);
  const completion = capture();
  assert.equal(await main(['completion', 'bash'], { ...completion, catalog, retired, completionFor: () => 'complete\n' }), 0);
  assert.equal(completion.value.out, 'complete\n');
});

test('app and runtime owners route through their injected seams', async () => {
  const app = capture();
  let appCall;
  assert.equal(await main(['--cwd', 'product', 'app', 'check', '--json'], {
    ...app, catalog, retired, cwd: path.resolve('base'),
    importHfs: async () => ({ main: async (argv, io) => { appCall = { argv, cwd: io.cwd }; return 1; } }),
  }), 1);
  assert.deepEqual(appCall.argv, ['check', '--json']);
  assert.equal(appCall.cwd, path.resolve('base', 'product'));

  const runtime = capture();
  let spawnCall;
  assert.equal(await main(['runtime', 'check', '--json'], {
    ...runtime, catalog, retired,
    locateRuntime: () => ({ root: path.resolve('runtime'), source: 'test' }),
    spawn: (command, args, options) => { spawnCall = { command, args, options }; return { status: 0 }; },
  }), 0);
  assert.match(spawnCall.args[0], /scripts[\\/]cli[\\/]main\.mjs$/);
  assert.deepEqual(spawnCall.args.slice(1), ['runtime', 'check', '--json']);
});

test('runtime install is in-process and never locates or spawns a runtime', async () => {
  const output = capture();
  let installCall;
  assert.equal(await main(['runtime', 'install', '--force'], {
    ...output, catalog, retired,
    installRuntime: (options) => { installCall = options; return 0; },
    locateRuntime: () => { throw new Error('must not locate'); },
    spawn: () => { throw new Error('must not spawn'); },
  }), 0);
  assert.equal(installCall.force, true);
});

test('runtime installer exposes npm/fetch and process seams without network access', () => {
  const home = path.resolve('fake-home');
  const cwd = path.resolve('fake-repo');
  const writes = [];
  let npmCall;
  let nodeCall;
  const code = installRuntime({ cwd, home }, {
    platform: 'linux',
    exists: (file) => file.endsWith(path.join('scripts', 'install', 'install.mjs')),
    mkdir: () => {},
    write: (file, text) => { writes.push({ file, text }); },
    chmod: () => {},
    runNpm: (args, options) => { npmCall = { args, options }; return { status: 0 }; },
    runNode: (args, options) => { nodeCall = { args, options }; return { status: 0 }; },
  });
  assert.equal(code, 0);
  assert.deepEqual(npmCall.args.slice(0, 3), ['install', '--prefix', path.join(home, '.starci', 'runtime')]);
  assert.equal(npmCall.args[3], `starci@${RUNTIME_VERSION}`);
  assert.equal(nodeCall.args[1], 'init');
  assert.ok(writes.some(({ file }) => file.endsWith(path.join('.starci', 'runtime.json'))));
  assert.ok(writes.some(({ file }) => file.endsWith(path.join('.starci', 'bin', 'starci'))));
});

test('removed and bad commands are refusals, while runtime absence is exit 3', async () => {
  const removedOutput = capture();
  assert.equal(await main(['api', 'survey'], { ...removedOutput, catalog, retired }), 2);
  assert.equal(removedOutput.value.err, 'starci: "starci api survey" was removed; use "starci kernel survey"\n');

  const unknown = capture();
  assert.equal(await main(['wat'], { ...unknown, catalog, retired }), 2);
  assert.match(unknown.value.err, /unknown group/);
  const edition = capture();
  assert.equal(await main(['app', 'check', '--edition', 'lite'], { ...edition, catalog, retired }), 2);
  assert.match(edition.value.err, /expects one of: full/);

  const absent = capture();
  assert.equal(await main(['runtime', 'check'], { ...absent, catalog, retired, locateRuntime: () => null }), 3);
  assert.equal(absent.value.err, 'starci: the runtime group "runtime" needs the StarCi runtime, which is not installed (run: starci runtime install)\n');
});

test('runtime locate order is env, user record, then upward .claude', () => {
  const cwd = path.resolve('a', 'b');
  const home = path.resolve('home');
  const envRoot = path.resolve('env-runtime');
  const userRoot = path.resolve('user-runtime');
  const localRoot = path.join(path.resolve('a'), '.claude');
  const entry = (root) => path.join(root, 'scripts', 'cli', 'main.mjs');
  const record = path.join(home, '.starci', 'runtime.json');
  const present = new Set([entry(envRoot), record, entry(userRoot), entry(localRoot)]);
  const deps = { cwd, home, exists: (file) => present.has(file), read: () => JSON.stringify({ root: userRoot }) };
  assert.equal(locateRuntime({ ...deps, env: { STARCI_RUNTIME: envRoot } }).source, 'STARCI_RUNTIME');
  present.delete(entry(envRoot));
  assert.equal(locateRuntime({ ...deps, env: {} }).root, userRoot);
  present.delete(entry(userRoot));
  assert.equal(locateRuntime({ ...deps, env: {} }).root, localRoot);
  present.delete(entry(localRoot));
  const embeddedRoot = path.resolve('embedded-runtime');
  present.add(entry(embeddedRoot));
  assert.equal(locateRuntime({ ...deps, env: {}, embeddedRoot }).source, 'embedded');
});
