// Package-entry behavior proof: every database/tool result is injected; no CLI, Docker or real database is reached.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { main } from './main.mjs';
import { writeDbTypes } from '../emit/db-types.mjs';
import { supabaseSpawn } from '../runtime/scripts/api/supabase/lib.mjs';

const FIRST = '20261018000000_base.sql';
const NEXT = '20261018000001_caption.sql';
const CONFIG = 'project_id = "local-fixture"\n[db]\nport = 55432\n[db.migrations]\nenabled = true\n';
const good = (migrations, dryRun) => ({ status: 0, stdout: JSON.stringify({ migrations, dryRun, upToDate: migrations.length === 0, seeds: [], roles: [] }), stderr: '' });

function fixture(t, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-local-db-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (file, text) => { const dest = path.join(root, file); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, text); };
  write('hfs.json', JSON.stringify({ kind: 'app', edition: 'lite' }));
  write('supabase/config.toml', CONFIG);
  write(`supabase/migrations/${FIRST}`, 'select 1;\n');
  write(`supabase/migrations/${NEXT}`, 'select 2;\n');
  let applied = false;
  let decrypts = 0;
  const calls = [];
  const env = { PATH: '', STARCI_DB_ARMED: '1', ...options.env };
  const spawn = (file, args, runOptions) => {
    const call = { file, args, options: runOptions };
    calls.push(call);
    const dry = args.includes('--dry-run');
    const answer = options.respond?.({ call, index: calls.length, dry, applied, write });
    if (answer !== undefined) return answer;
    const pending = applied || options.current ? [] : [NEXT];
    if (!dry) applied = true;
    return good(pending, dry);
  };
  const invoke = async (args = [], json = true) => {
    let stdout = '', stderr = '';
    const code = await main(['db', 'migrate', '--local', ...(json ? ['--json'] : []), ...args], {
      cwd: root, env,
      stdout: (text) => { stdout += text; }, stderr: (text) => { stderr += text; },
      sops: { decrypt: () => { decrypts += 1; throw new Error('must not decrypt'); } },
      stackIo: { spawn },
    });
    return { code, stdout, stderr, data: stdout.startsWith('{') ? JSON.parse(stdout) : null };
  };
  return { root, write, calls, env, invoke, decrypts: () => decrypts };
}

test('local preview uses the real app entry, exact workdir and SQL-only dry run without database custody', async (t) => {
  const f = fixture(t);
  f.write('.starcistacks/application-stacks.yaml', 'database: deliberately invalid linked custody\n');
  const result = await f.invoke();
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(result.data.pending, [NEXT]);
  assert.equal(result.data.executed, false);
  assert.equal(result.data.done, false);
  assert.equal(f.decrypts(), 0);
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.calls[0].args, ['db', 'push', '--local', '--skip-vault', '--workdir', f.root, '--output-format', 'json', '--dry-run']);
  assert.equal(f.calls[0].options.cwd, f.root);
  assert.deepEqual(fs.readdirSync(f.root).sort(), ['.starcistacks', 'hfs.json', 'supabase']);
});

test('armed local execute applies one ordered suffix then proves current history and repeat is a no-op', async (t) => {
  const f = fixture(t);
  const result = await f.invoke(['--execute']);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.data.executed, true);
  assert.deepEqual(result.data.pushed, [NEXT]);
  assert.equal(f.calls.length, 4);
  assert.equal(f.calls.filter((call) => call.args.includes('--yes')).length, 1);
  for (const call of f.calls) {
    assert.ok(call.args.includes('--local') && call.args.includes('--skip-vault'));
    assert.equal(call.options.cwd, f.root);
    for (const forbidden of ['--linked', '--db-url', 'repair', 'reset', '--include-all', '--include-seed', '--include-roles']) assert.ok(!call.args.includes(forbidden));
  }
  assert.equal(f.decrypts(), 0);
  const repeated = await f.invoke(['--execute']);
  assert.equal(repeated.code, 0, repeated.stderr);
  assert.equal(repeated.data.executed, false);
  assert.equal(f.calls.filter((call) => call.args.includes('--yes')).length, 1);
});

test('an already-current local preview is a no-op even with ambient auto-yes', async (t) => {
  const f = fixture(t, { current: true, env: { SUPABASE_YES: 'true' } });
  const result = await f.invoke();
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.data.done, true);
  assert.equal(result.data.executed, false);
  assert.equal(f.calls.length, 1);
  assert.ok(f.calls[0].args.includes('--dry-run'));
});

test('a bound local target checks the effective project and port before any database child', async t => {
  const f = fixture(t);
  f.write('node_modules/supabase/dist/supabase.js', '// synthetic installed launcher');
  const binding = { kind: 'supabase-db', mode: 'local', environment: 'development', localProject: 'other-project', port: 55432 };
  assert.equal((await f.invoke(['--target-binding', JSON.stringify(binding)])).code, 2);
  assert.equal(f.calls.length, 0);
  binding.localProject = 'local-fixture';
  binding.port = 55433;
  assert.equal((await f.invoke(['--target-binding', JSON.stringify(binding)])).code, 2);
  assert.equal(f.calls.length, 0);
});

test('the same local binding cannot bypass the existing database arming requirement', async t => {
  const f = fixture(t, { env: { STARCI_DB_ARMED: undefined } });
  f.write('node_modules/supabase/dist/supabase.js', '// synthetic installed launcher');
  const binding = { kind: 'supabase-db', mode: 'local', environment: 'development', localProject: 'local-fixture', port: 55432 };
  const result = await f.invoke(['--target-binding', JSON.stringify(binding), '--execute']);
  assert.equal(result.code, 3);
  assert.equal(f.calls.length, 0);
});

test('a bound local preview pins the installed launcher, builtin profile and legacy loopback routing', async t => {
  const f = fixture(t, { env: { supabase_access_token: 'synthetic-token', pgservice: 'synthetic-service', SOPS_AGE_KEY: 'synthetic-key' } });
  f.write('node_modules/supabase/dist/supabase.js', '// synthetic installed launcher');
  const binding = { kind: 'supabase-db', mode: 'local', environment: 'development', localProject: 'local-fixture', port: 55432 };
  const result = await f.invoke(['--target-binding', JSON.stringify(binding)]);
  assert.equal(result.code, 0, result.stderr);
  const call = f.calls[0];
  assert.equal(call.file, process.execPath);
  assert.equal(call.args[0], path.join(f.root, 'node_modules/supabase/dist/supabase.js'));
  assert.equal(call.args[call.args.indexOf('--profile') + 1], 'supabase');
  assert.equal(call.options.env.SUPABASE_SERVICES_HOSTNAME, '127.0.0.1');
  assert.equal(call.options.env.SUPABASE_EXPERIMENTAL_STACK, '0');
  assert.equal(call.options.env.supabase_access_token, undefined);
  assert.equal(call.options.env.pgservice, undefined);
  assert.equal(call.options.env.SOPS_AGE_KEY, undefined);
});

test('a bound local target refuses an experimental backend before invoking its installed tool', async t => {
  const f = fixture(t);
  f.write('node_modules/supabase/dist/supabase.js', '// synthetic installed launcher');
  f.write('supabase/config.toml', `${CONFIG}[experimental]\nstack = true\n`);
  const binding = { kind: 'supabase-db', mode: 'local', environment: 'development', localProject: 'local-fixture', port: 55432 };
  assert.equal((await f.invoke(['--target-binding', JSON.stringify(binding)])).code, 2);
  assert.equal(f.calls.length, 0);
});

for (const args of [['--linked'], ['--url-env', 'LOCAL_DATABASE']]) {
  test(`local target excludes ${args[0]} before any child`, async (t) => {
    const f = fixture(t);
    assert.equal((await f.invoke(args)).code, 2);
    assert.equal(f.calls.length, 0);
  });
}

test('execute without existing database arming refuses before any child', async (t) => {
  const f = fixture(t, { env: { STARCI_DB_ARMED: '' } });
  assert.equal((await f.invoke(['--execute'])).code, 3);
  assert.equal(f.calls.length, 0);
});

const encryptedCases = [
  ['base secret', (f) => f.write('supabase/config.toml', `${CONFIG}[auth]\njwt_secret = "encrypted:synthetic-sensitive"\n`)],
  ['unused remote secret', (f) => f.write('supabase/config.toml', `${CONFIG}[remotes.unused.auth]\njwt_secret = "encrypted:synthetic-sensitive"\n`)],
  ['TOML escaped marker', (f) => f.write('supabase/config.toml', `${CONFIG}[auth]\njwt_secret = "\\u0065ncrypted:synthetic-sensitive"\n`)],
  ['environment marker', (f) => { f.env.AUTH_INPUT = 'encrypted:synthetic-sensitive'; }],
  ['dotenv marker', (f) => f.write('supabase/.env', 'AUTH_INPUT=encrypted:synthetic-sensitive\n')],
  ['dotenv expansion', (f) => f.write('.env', 'PART=encryp\nAUTH_INPUT=${PART}ted:synthetic-sensitive\n')],
  ['dotenv escape', (f) => f.write('.env', 'AUTH_INPUT="encryp\\ted:synthetic-sensitive"\n')],
];
for (const [name, prepare] of encryptedCases) {
  test(`${name} is held before any child or decryption`, async (t) => {
    const f = fixture(t);
    prepare(f);
    const result = await f.invoke(['--execute']);
    assert.equal(result.code, 2);
    assert.equal(f.calls.length, 0);
    assert.equal(f.decrypts(), 0);
    assert.ok(!`${result.stdout}${result.stderr}`.includes('synthetic-sensitive'));
  });
}

test('literal dotenv lookup and effective nonsecret overrides follow selected file precedence', async (t) => {
  const f = fixture(t, { env: { SUPABASE_ENV: 'staging' } });
  f.write('.env', 'SUPABASE_PROJECT_ID=root-default\nSUPABASE_DB_MIGRATIONS_ENABLED=false\n');
  f.write('supabase/.env.staging.local', 'SUPABASE_PROJECT_ID="selected-local"\nSUPABASE_DB_PORT=55433\nSUPABASE_DB_MIGRATIONS_ENABLED=true\n');
  const result = await f.invoke([], false);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /local project selected-local/);
  f.env.SUPABASE_PROJECT_ID = 'ambient-local';
  assert.match((await f.invoke([], false)).stdout, /local project ambient-local/);
  f.env.SUPABASE_DB_MIGRATIONS_ENABLED = 'false';
  const before = f.calls.length;
  assert.equal((await f.invoke()).code, 2);
  assert.equal(f.calls.length, before);
});

for (const [name, prepare] of [
  ['disabled TOML migrations', (f) => f.write('supabase/config.toml', CONFIG.replace('enabled = true', 'enabled = false'))],
  ['effective invalid port', (f) => { f.env.SUPABASE_DB_PORT = 'invalid'; }],
  ['unresolved project id', (f) => { f.env.SUPABASE_PROJECT_ID = 'env(MISSING_PROJECT)'; }],
  ['unsafe environment selector', (f) => { f.env.SUPABASE_ENV = '../../other'; }],
  ['malformed TOML', (f) => f.write('supabase/config.toml', '[auth\nsynthetic-sensitive')],
  ['duplicate migration stamp', (f) => f.write('supabase/migrations/20261018000000_other.sql', 'select 3;\n')],
  ['invalid migration UTC', (f) => f.write('supabase/migrations/20261301000000_bad.sql', 'select 3;\n')],
  ['legacy init skipped by upstream', (f) => f.write('supabase/migrations/20200101000000_init.sql', 'select 3;\n')],
  ['nested legacy init skip', (f) => f.write('supabase/migrations/20200101000000_contract_20200101000000_init.sql', 'select 3;\n')],
  ['nonregular SQL input', (f) => fs.mkdirSync(path.join(f.root, 'supabase/migrations/20261018000002_directory.sql'))],
]) {
  test(`${name} refuses before any child`, async (t) => {
    const f = fixture(t);
    prepare(f);
    const result = await f.invoke(['--execute']);
    assert.equal(result.code, 2);
    assert.equal(f.calls.length, 0);
    assert.ok(!result.stderr.includes('synthetic-sensitive'));
  });
}

for (const [name, answer] of [
  ['unknown history refusal', { status: 1, stdout: '', stderr: 'synthetic-sensitive' }],
  ['earlier history gap refusal', { status: 1, stdout: '', stderr: 'synthetic-sensitive' }],
  ['unavailable local stack', { status: null, error: Object.assign(new Error('synthetic-sensitive'), { code: 'ENOENT' }) }],
  ['empty stdout', { status: 0, stdout: '', stderr: '' }],
  ['malformed stdout', { status: 0, stdout: 'synthetic-sensitive', stderr: '' }],
  ['error envelope', { status: 0, stdout: JSON.stringify({ _tag: 'Error', error: 'synthetic-sensitive' }), stderr: '' }],
  ['unknown pending migration', good(['20261018000002_unknown.sql'], true)],
  ['reordered pending migrations', good([NEXT, FIRST], true)],
  ['nonsuffix pending migration', good([FIRST], true)],
  ['inconsistent upToDate', { status: 0, stdout: JSON.stringify({ migrations: [NEXT], dryRun: true, upToDate: true, seeds: [], roles: [] }) }],
  ['unexpected seed', { status: 0, stdout: JSON.stringify({ migrations: [NEXT], dryRun: true, upToDate: false, seeds: ['seed.sql'], roles: [] }) }],
  ['unexpected roles', { status: 0, stdout: JSON.stringify({ migrations: [NEXT], dryRun: true, upToDate: false, seeds: [], roles: ['roles.sql'] }) }],
]) {
  test(`${name} is red and never applies or retries linked`, async (t) => {
    const f = fixture(t, { respond: () => answer });
    const result = await f.invoke(['--execute']);
    assert.equal(result.code, 1);
    assert.equal(f.calls.length, 1);
    assert.ok(f.calls[0].args.includes('--dry-run'));
    assert.ok(!`${result.stdout}${result.stderr}`.includes('synthetic-sensitive'));
  });
}

test('config drift after preview stops before the mutating call', async (t) => {
  const f = fixture(t, { respond: ({ index, write }) => { if (index === 1) write('supabase/config.toml', CONFIG.replace('55432', '55434')); } });
  assert.equal((await f.invoke(['--execute'])).code, 1);
  assert.equal(f.calls.length, 1);
});

test('migration drift during apply remains red without repair or reset', async (t) => {
  const f = fixture(t, { respond: ({ dry, write }) => { if (!dry) write(`supabase/migrations/${NEXT}`, 'select 99;\n'); } });
  assert.equal((await f.invoke(['--execute'])).code, 1);
  assert.equal(f.calls.length, 3);
});

test('a noncurrent final history is red after actual apply', async (t) => {
  const f = fixture(t, { respond: ({ index }) => index === 4 ? good([NEXT], true) : undefined });
  assert.equal((await f.invoke(['--execute'])).code, 1);
  assert.equal(f.calls.length, 4);
});

test('a changed pending suffix before apply is held without mutating', async (t) => {
  const f = fixture(t, { respond: ({ index }) => index === 2 ? good([], true) : undefined });
  assert.equal((await f.invoke(['--execute'])).code, 1);
  assert.equal(f.calls.length, 2);
  assert.ok(f.calls.every((call) => call.args.includes('--dry-run')));
});

test('apply failure remains red and makes no automatic repair', async (t) => {
  const f = fixture(t, { respond: ({ dry }) => dry ? undefined : { status: 1, stdout: '', stderr: 'synthetic-sensitive' } });
  const result = await f.invoke(['--execute']);
  assert.equal(result.code, 1);
  assert.equal(f.calls.length, 3);
  assert.ok(!result.stderr.includes('synthetic-sensitive'));
});

for (const [name, actual] of [['widened', [FIRST, NEXT]], ['shrunk', []]]) {
  test(`${name} apply result cannot certify work outside the exact reviewed pending plan`, async (t) => {
    const f = fixture(t, { respond: ({ dry }) => dry ? undefined : good(actual, false) });
    const result = await f.invoke(['--execute']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /^starci app db migrate: DB_FINAL_MISMATCH:/);
    assert.equal(f.calls.length, 3);
    assert.equal(f.calls.filter((call) => call.args.includes('--yes')).length, 1);
    assert.ok(!result.stdout);
    assert.ok(!result.stderr.includes(FIRST));
    assert.ok(!result.stderr.includes(NEXT));
  });
}

test('a migration changing during final preview cannot receive a green verdict', async (t) => {
  const f = fixture(t, { respond: ({ index, write }) => { if (index === 4) write(`supabase/migrations/${NEXT}`, 'select 99;\n'); } });
  assert.equal((await f.invoke(['--execute'])).code, 1);
  assert.equal(f.calls.length, 4);
});

test('test environment excludes dotenv local files exactly as the pinned CLI does', async (t) => {
  const f = fixture(t, { env: { SUPABASE_ENV: 'test' } });
  f.write('supabase/.env.local', 'AUTH_INPUT=encrypted:not-selected\n');
  assert.equal((await f.invoke()).code, 0);
  assert.equal(f.calls.length, 1);
});

test('legacy linked preview keeps its declared baseline path', async (t) => {
  const f = fixture(t);
  f.write('.starcistacks/application-stacks.yaml', 'database:\n  baseline: base\n  projectRef: abcdefghijklmnopqrst\n');
  f.write('supabase/.temp/project-ref', 'abcdefghijklmnopqrst\n');
  const calls = [];
  const code = await main(['db', 'migrate', '--linked', '--json'], {
    cwd: f.root, env: { SUPABASE_DB_PASSWORD: 'synthetic-password' }, stdout: () => {}, stderr: () => {},
    stackIo: { spawn: (_file, args) => { calls.push(args); return { status: 0, stdout: JSON.stringify({ migrations: [{ local: '20261018000000', remote: '20261018000000' }, { local: '20261018000001', remote: '' }] }), stderr: '' }; } },
  });
  assert.equal(code, 0);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].includes('--linked'));
  assert.ok(!calls[0].includes('--local'));
});

test('Windows API owner uses Node plus installed npm launcher and preserves literal arguments/options', () => {
  const root = path.resolve('fixture with spaces');
  const launcher = path.join(root, 'node_modules', 'supabase', 'dist', 'supabase.js');
  const env = { PATH: '' };
  const args = ['db', 'query', 'select \'$literal & value\';', '--local'];
  const calls = [];
  supabaseSpawn(root, args, { env, timeout: 1234, platform: 'win32', exists: (file) => file === launcher, run: (...call) => { calls.push(call); return { status: 0 }; } });
  assert.deepEqual(calls, [[process.execPath, [launcher, ...args], { cwd: root, encoding: 'utf8', env, timeout: 1234, windowsHide: true }]]);
});

test('API owner preserves native overrides and local/PATH executable discovery', () => {
  const root = path.resolve('fixture');
  for (const options of [
    { supabase: 'owned-supabase.exe', expected: 'owned-supabase.exe', exists: () => true },
    { expected: path.join(root, 'node_modules', '.bin', 'supabase.exe') },
    { env: { PATH: 'tool-directory' }, expected: path.join('tool-directory', 'supabase.exe') },
  ]) {
    const { expected, ...settings } = options;
    const calls = [];
    supabaseSpawn(root, ['db', 'query'], { env: { PATH: '' }, platform: 'win32', ...settings, exists: settings.exists ?? ((file) => file === expected), run: (file, args) => { calls.push([file, args]); return { status: 0 }; } });
    assert.deepEqual(calls, [[expected, ['db', 'query']]]);
  }
});

test('API owner refuses Windows shims without starting a shell', () => {
  for (const supabase of ['supabase.cmd', 'supabase.bat']) {
    let calls = 0;
    const result = supabaseSpawn('/fixture', [], { supabase, run: () => { calls += 1; } });
    assert.equal(result.error.code, 'ENOEXEC');
    assert.equal(calls, 0);
  }
});

test('emitter refuses stale same-head gaps before generation or writing and stamps matching real output', (t) => {
  const f = fixture(t);
  const target = path.join(f.root, 'supabase/types/database.types.ts');
  const calls = [];
  const stale = (_file, args) => { calls.push(args); return { status: 0, stdout: JSON.stringify({ migrations: [{ local: '', remote: '20261018000001' }] }), stderr: '' }; };
  assert.throws(() => writeDbTypes({ root: f.root, run: stale }), { code: 'HFS_EMIT_DB_TYPES_STALE' });
  assert.equal(calls.length, 1);
  assert.equal(fs.existsSync(target), false);
  const run = (_file, args) => ({ status: 0, stdout: args[0] === 'migration' ? JSON.stringify({ migrations: [{ local: '20261018000000', remote: '20261018000000' }, { local: '20261018000001', remote: '20261018000001' }] }) : 'export type Database = {};\n', stderr: '' });
  assert.equal(writeDbTypes({ root: f.root, run }).changed, true);
  assert.match(fs.readFileSync(target, 'utf8'), /^\/\/ migrations-sha256: [a-f0-9]{64}\nexport type Database = \{\};\n$/);
  assert.equal(writeDbTypes({ root: f.root, run }).changed, false);
});
