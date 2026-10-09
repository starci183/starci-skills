import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { main } from '../../packages/cli/src/main.mjs';
import { installRuntime } from '../../packages/cli/src/runtime-install.mjs';
import { locateRuntime, ownRuntimeRoot } from '../../packages/cli/src/runtime-locate.mjs';

const global = [
  { name: 'json', type: 'boolean' },
  { name: 'cwd', type: 'string' },
  { name: 'quiet', type: 'boolean' },
  { name: 'help', type: 'boolean' },
  { name: 'edition', type: 'enum', enum: ['full', 'lite'] },
];
const catalog = {
  global,
  commands: ['explain'],
  groups: {
    app: { owner: '@starci/hfs', summary: 'app commands', verbs: {
      check: { group: 'app', verb: 'check', summary: 'check an app', flags: [], json: 'flag', editions: ['full'] },
    } },
    runtime: { owner: 'runtime', summary: 'runtime commands', verbs: {
      check: {
        group: 'runtime', verb: 'check', summary: 'check the runtime', flags: [],
        effect: 'host', roles: ['lead', 'owner'], conventions: ['run the scoped checks only'],
        exit: { 0: 'clean', 1: 'findings', 2: 'bad usage' }, json: 'flag',
      },
      install: { group: 'runtime', verb: 'install', summary: 'install the runtime', flags: [{ name: 'force', type: 'boolean' }], json: 'none' },
    } },
  },
};
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
  assert.equal(await main(['help'], { ...top, catalog, version: 'test' }), 0);
  assert.match(top.value.out, /Groups:/);
  const group = capture();
  assert.equal(await main(['runtime', '--help'], { ...group, catalog }), 0);
  assert.match(group.value.out, /check\s+\[host\] check the runtime/);
  const verb = capture();
  assert.equal(await main(['runtime', 'check', '--help'], { ...verb, catalog }), 0);
  assert.match(verb.value.out, /check the runtime/);
  assert.match(verb.value.out, /Effect: host\nRoles: lead, owner/);
  assert.match(verb.value.out, /Conventions:\n  - run the scoped checks only/);
  assert.match(verb.value.out, /Exit codes:/);
  const explain = capture();
  assert.equal(await main(['explain', 'runtime', 'check'], { ...explain, catalog }), 0);
  assert.match(explain.value.out, /Effect: host/);
  const unknown = capture();
  assert.equal(await main(['explain', 'runtime', 'nope'], { ...unknown, catalog }), 2);
  assert.match(unknown.value.err, /available: check, install/);
  const completion = capture();
  assert.equal(await main(['completion', 'bash'], { ...completion, catalog, completionFor: () => 'complete\n' }), 0);
  assert.equal(completion.value.out, 'complete\n');
});



test('runtime install is in-process and never locates or spawns a runtime', async () => {
  const output = capture();
  let installCall;
  assert.equal(await main(['runtime', 'install', '--force'], {
    ...output, catalog,
    installRuntime: (options) => { installCall = options; return 0; },
    locateRuntime: () => { throw new Error('must not locate'); },
    spawn: () => { throw new Error('must not spawn'); },
  }), 0);
  assert.equal(installCall.force, true);
});



test('bad commands are refusals, while runtime absence is exit 3', async () => {
  const unknown = capture();
  assert.equal(await main(['wat'], { ...unknown, catalog }), 2);
  assert.match(unknown.value.err, /unknown group/);
  const edition = capture();
  assert.equal(await main(['app', 'check', '--edition', 'lite'], { ...edition, catalog }), 2);
  assert.match(edition.value.err, /not available in the lite edition/);
  const badEdition = capture();
  assert.equal(await main(['app', 'check', '--edition', 'nope'], { ...badEdition, catalog }), 2);
  assert.match(badEdition.value.err, /expects one of: full, lite/);

  const absent = capture();
  assert.equal(await main(['runtime', 'check'], { ...absent, catalog, locateRuntime: () => null }), 3);
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
    ...output, catalog: passCatalog, cwd: path.resolve('base'),
    locateRuntime: () => ({ root: path.resolve('runtime') }),
    spawn: (command, args, options) => { call = { args: args.slice(1), cwd: options.cwd }; return { status: 0 }; },
    ...extra,
  });
  return { code, call, ...output.value };
};



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
    ...output, catalog: passCatalog,
    locateRuntime: ({ skipped }) => { skipped.push('runtime.json is stale'); return null; },
  });
  assert.equal(code, 3);
  assert.equal(output.value.err, 'starci: ignored: runtime.json is stale\nstarci: the runtime group "runtime" needs the StarCi runtime, which is not installed (run: starci runtime install)\n');
});

test('a located runtime that is not the checkout the CLI runs from is named once on stderr; the same root and a non-runtime install are silent', async () => {
  const own = path.resolve('checkout');
  const live = path.resolve('live-main');
  const foreign = await runtimeCall(['runtime', 'plain'], { locateRuntime: () => ({ root: live, source: 'record' }), ownRuntimeRoot: () => own });
  assert.equal(foreign.code, 0);
  assert.equal(foreign.err, `starci: running the runtime at ${live} (record), not this checkout's ${own}; set STARCI_RUNTIME=${own} to use the checkout\n`);
  assert.equal((await runtimeCall(['runtime', 'plain'], { locateRuntime: () => ({ root: own, source: 'STARCI_RUNTIME' }), ownRuntimeRoot: () => own })).err, '');
  assert.equal((await runtimeCall(['runtime', 'plain'], { locateRuntime: () => ({ root: live, source: 'record' }), ownRuntimeRoot: () => null })).err, '');
});

test('ownRuntimeRoot is the embedded checkout only when it has a runtime entry', () => {
  const root = path.resolve('embedded-runtime');
  const entry = path.join(root, 'scripts', 'cli', 'main.mjs');
  assert.equal(ownRuntimeRoot({ embeddedRoot: root, exists: (file) => file === entry }), root);
  assert.equal(ownRuntimeRoot({ embeddedRoot: root, exists: () => false }), null);
});
