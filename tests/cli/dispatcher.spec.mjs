import assert from 'node:assert/strict';
import fs from 'node:fs';
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

test('@starci/cli pins the exact @starci/hfs package version', () => {
  const cliPackage = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../packages/cli/package.json'), 'utf8'));
  const hfsPackage = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../packages/hfs/package.json'), 'utf8'));
  assert.equal(cliPackage.dependencies['@starci/hfs'], hfsPackage.version);
});

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

const passCatalog = {
  global,
  groups: {
    app: { owner: '@starci/hfs', summary: 'app commands', verbs: { check: { flags: [], json: 'flag' } } },
    runtime: { owner: 'runtime', summary: 'runtime commands', verbs: {
      check: { summary: 'check', flags: [{ name: 'only', type: 'string' }], positional: [{ name: 'check-arguments', variadic: true }], json: 'flag' },
      plain: { summary: 'plain', flags: [{ name: 'count', type: 'number' }, { name: 'tag', type: 'list' }], json: 'flag' },
    } },
  },
};
const runtimeCall = async (argv, extra = {}) => {
  const output = capture();
  let call = null;
  const code = await main(argv, {
    ...output, catalog: passCatalog, retired, cwd: path.resolve('base'),
    locateRuntime: () => ({ root: path.resolve('runtime') }),
    spawn: (command, args, options) => { call = { args: args.slice(1), cwd: options.cwd }; return { status: 0 }; },
    ...extra,
  });
  return { code, call, ...output.value };
};

test('-- passes everything after it through, and dispatcher flags land before it', async () => {
  const dashed = await runtimeCall(['runtime', 'check', '--json', '--only', 'x', '--', '--root', 'a b&c', '--help']);
  assert.equal(dashed.code, 0);
  assert.deepEqual(dashed.call.args, ['runtime', 'check', '--only', 'x', '--json', '--', '--root', 'a b&c', '--help']);
  const noRoom = await runtimeCall(['runtime', 'plain', '--', 'stray']);
  assert.equal(noRoom.code, 0);
  assert.deepEqual(noRoom.call.args, ['runtime', 'plain', '--', 'stray']);
});

test('option values: a dash value is allowed, a value that names a flag is a missing value, empty numbers are refused', async () => {
  assert.deepEqual((await runtimeCall(['runtime', 'check', '--only', '-x'])).call.args, ['runtime', 'check', '--only', '-x']);
  assert.deepEqual((await runtimeCall(['runtime', 'check', '--only=--json'])).call.args, ['runtime', 'check', '--only=--json']);
  const missing = await runtimeCall(['runtime', 'check', '--cwd', '--json']);
  assert.equal(missing.code, 2);
  assert.match(missing.err, /--cwd needs a value/);
  assert.equal((await runtimeCall(['runtime', 'check', '--cwd='])).code, 2);
  const empty = await runtimeCall(['runtime', 'plain', '--count=']);
  assert.equal(empty.code, 2);
  assert.match(empty.err, /--count expects a number/);
  assert.equal((await runtimeCall(['runtime', 'plain', '--tag', 'a', '--tag', 'b'])).code, 0);
  assert.match((await runtimeCall(['runtime', 'plain', '--count', '1', '--count', '2'])).err, /only once/);
  assert.match((await runtimeCall(['runtime', 'check', '--json=maybe'])).err, /expects true or false/);
});

test('help flags work in any position, stop at --, and help takes a group and verb', async () => {
  for (const argv of [['-h', 'runtime'], ['runtime', '-h'], ['--json', '--help'], ['help', 'runtime'], ['--quiet', 'help']]) {
    const result = await runtimeCall(argv);
    assert.equal(result.code, 0, argv.join(' '));
    assert.equal(result.call, null);
    assert.ok(result.out.length > 0);
  }
  assert.match((await runtimeCall(['help', 'runtime', 'check'])).out, /starci runtime check/);
  assert.equal((await runtimeCall(['help', 'nope'])).code, 2);
  assert.equal((await runtimeCall(['help', 'runtime', 'nope'])).code, 2);
  assert.equal((await runtimeCall(['completion', '--help'])).code, 0);
  const passed = await runtimeCall(['runtime', 'check', '--', '--help']);
  assert.equal(passed.out, '');
  assert.deepEqual(passed.call.args, ['runtime', 'check', '--', '--help']);
});

test('removed names are refused wherever the global flags sit, including the retired hfs bins', async () => {
  const withRetired = [
    { spelling: 'starci api survey', use: 'starci kernel survey' },
    { spelling: 'starci init', use: 'starci runtime install' },
    { spelling: 'hfs lint', use: 'starci app lint' },
    { spelling: 'starci-test-stack', use: 'starci app stack' },
  ];
  const refuse = async (argv) => {
    const output = capture();
    const code = await main(argv, {
      ...output, catalog: passCatalog, retired: withRetired,
      importHfs: async () => { throw new Error('must not execute'); },
      locateRuntime: () => { throw new Error('must not locate'); },
      spawn: () => { throw new Error('must not spawn'); },
    });
    return { code, err: output.value.err };
  };
  assert.deepEqual(await refuse(['--json', 'api', 'survey']), { code: 2, err: 'starci: "starci api survey --json" was removed; use "starci kernel survey --json"\n' });
  assert.deepEqual(await refuse(['--cwd', 'x', 'init']), { code: 2, err: 'starci: "starci init --cwd x" was removed; use "starci runtime install --cwd x"\n' });
  assert.deepEqual(await refuse(['hfs', 'lint', '--fix']), { code: 2, err: 'starci: "starci hfs lint --fix" was removed; use "starci app lint --fix"\n' });
  assert.deepEqual(await refuse(['starci-test-stack']), { code: 2, err: 'starci: "starci starci-test-stack" was removed; use "starci app stack"\n' });
});

test('a runtime child that cannot start or is killed is reported, never silently ok', async () => {
  const failed = await runtimeCall(['runtime', 'check'], { spawn: () => ({ error: Object.assign(new Error('boom'), { code: 'EACCES' }) }) });
  assert.equal(failed.code, 1);
  assert.match(failed.err, /cannot run the runtime: boom/);
  const killed = await runtimeCall(['runtime', 'check'], { spawn: () => ({ status: null, signal: 'SIGKILL' }) });
  assert.equal(killed.code, 1);
  assert.match(killed.err, /stopped on signal SIGKILL/);
  const thrown = await runtimeCall(['runtime', 'check'], { spawn: () => { throw new TypeError('bad argument'); } });
  assert.equal(thrown.code, 1);
  assert.match(thrown.err, /cannot run the runtime: bad argument/);
  const missingDirectory = await runtimeCall(['runtime', 'check', '--cwd', 'no-such-directory'], { spawn: () => ({ error: Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' }) }) });
  assert.equal(missingDirectory.code, 2);
  assert.match(missingDirectory.err, /is not a directory/);
});

test('a stale or corrupt runtime record falls through with a note and ends in exit 3, never a crash', async () => {
  const home = path.resolve('home');
  const record = path.join(home, '.starci', 'runtime.json');
  const locate = (content, env = {}) => {
    const skipped = [];
    const found = locateRuntime({ cwd: path.resolve('a'), home, env, skipped, embeddedRoot: path.resolve('none'),
      exists: (file) => file === record, read: () => content });
    return { found, skipped };
  };
  const stale = locate(JSON.stringify({ root: path.resolve('gone') }));
  assert.equal(stale.found, null);
  assert.match(stale.skipped[0], /stale record/);
  assert.match(locate('{not json').skipped[0], /not valid JSON/);
  assert.equal(locate('null').found, null);
  assert.equal(locate(JSON.stringify({ root: 42 })).found, null);
  assert.match(locate('{}', { STARCI_RUNTIME: path.resolve('bad') }).skipped[0], /STARCI_RUNTIME/);

  const output = capture();
  const code = await main(['runtime', 'check'], {
    ...output, catalog: passCatalog, retired,
    locateRuntime: ({ skipped }) => { skipped.push('runtime.json is stale'); return null; },
  });
  assert.equal(code, 3);
  assert.equal(output.value.err, 'starci: ignored: runtime.json is stale\nstarci: the runtime group "runtime" needs the StarCi runtime, which is not installed (run: starci runtime install)\n');
});
