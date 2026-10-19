// Owning-package behavior proof: synthetic custody and injected tools never reach a real provider.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openSealedSession } from '../stack/remote.mjs';
import { withDockerTransport } from '../stack/docker-transport.mjs';
import { dbMigrateMain } from '../db/migrate.mjs';
import { stackMain } from '../stack/cli.mjs';
import { parseTargetBinding, bindStackTarget, assertBoundCustody } from '../stack/target-binding.mjs';

const STACK = { kind: 'docker-swarm', environment: 'staging', stack: 'fixture', host: 'host.example', user: 'ops', port: 22 };
const LINKED = { kind: 'supabase-db', mode: 'linked', environment: 'staging', projectRef: 'abcdefghijklmnopqrst' };
const stamp = '20261018000000_base.sql';

function files(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-native-binding-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (name, value) => { const file = path.join(root, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); };
  return { root, write };
}

test('a wrong sealed account stops before opening a key, writing session files or invoking a tool', () => {
  let keyReads = 0, tools = 0;
  const ctx = { env: {}, spawn: () => { tools += 1; }, sops: {
    decrypt: () => ({ VPS_HOST: 'other.example', VPS_USER: 'ops' }), decryptBinary: () => { keyReads += 1; throw new Error('unexpected private key open'); },
  } };
  assert.throws(() => openSealedSession(ctx, { remote: { sealed: { ops: 'ops', sshKey: 'key', knownHosts: 'known' } }, secretsDir: 'synthetic', nativeTarget: STACK }), /differs from the accepted native target/);
  assert.equal(keyReads, 0);
  assert.equal(tools, 0);
});

test('a bound private Docker session pins the accepted SSH port and closes its owned temporary files', async t => {
  const f = files(t), secretsDir = path.join(f.root, 'secrets');
  for (const member of ['ops', 'key', 'known']) f.write(`secrets/${member}.enc`, 'synthetic envelope');
  const calls = [], env = { HOME: f.root, PATH: '' };
  const ctx = { env, platform: 'linux', sshPath: 'ssh', stderr: () => {},
    spawn: (file, args, options) => { calls.push({ file, args, options }); return { status: 0, stdout: '', stderr: '' }; },
    sops: { decrypt: () => ({ VPS_HOST: STACK.host, VPS_USER: STACK.user }),
      decryptBinary: file => file.endsWith('key.enc') ? 'synthetic PRIVATE KEY' : 'host.example ssh-ed25519 synthetic' },
  };
  const config = bindStackTarget(ctx, { repoRoot: f.root, env: 'staging', stack: 'fixture', secretsDir,
    remote: { sealed: { ops: 'ops', sshKey: 'key', knownHosts: 'known' } }, verify: { http: [] } }, STACK);
  let temporaryHome;
  await withDockerTransport(ctx, config, {}, async bound => {
    bound.spawn('docker', ['info']);
    const ssh = calls.find(call => call.file === 'ssh' && call.args.includes('-MNf'));
    assert.ok(ssh);
    assert.equal(ssh.args[ssh.args.indexOf('-p') + 1], '22');
    temporaryHome = ssh.options.env.HOME;
    assert.match(fs.readFileSync(path.join(temporaryHome, '.ssh/config'), 'utf8'), /\n  Port 22\n/);
  });
  assert.ok(calls.some(call => call.file === 'ssh' && call.args.includes('exit')));
  assert.equal(fs.existsSync(temporaryHome), false);
});

test('only a bound stack tool boundary removes AGE aliases while preserving lazy custody and explicit tool options', async t => {
  const f = files(t);
  f.write('hfs.json', JSON.stringify({ kind: 'app', project: 'fixture', edition: 'lite' }));
  f.write('.starcistacks/staging/stack.yml', 'services: {}\n');
  f.write('.starcistacks/application-stacks.yaml', JSON.stringify({ environments: { staging: {
    runtime: 'docker-swarm', composeFiles: ['stack.yml'], deploy: { stack: 'fixture',
      remote: { sealed: { ops: 'ops', sshKey: 'key', knownHosts: 'known' } } },
  } } }));
  for (const name of ['ops', 'key', 'known']) f.write(`.starcistacks/staging/secrets/${name}.enc`, 'synthetic envelope');
  const inherited = { sops_age_key: 'synthetic-age', SOPS_AGE_KEY_FILE: 'synthetic-key-file', HOME: f.root, PATH: '' };
  const calls = [];
  let custodyReads = 0;
  const sops = { decrypt: () => { custodyReads += 1; assert.equal(inherited.sops_age_key, 'synthetic-age'); return { VPS_HOST: STACK.host, VPS_USER: STACK.user }; },
    decryptBinary: file => file.endsWith('key.enc') ? 'synthetic PRIVATE KEY' : 'host.example ssh-ed25519 synthetic' };
  const spawn = (file, args, options) => { calls.push({ file, args, options }); return { status: 0, stdout: '', stderr: '' }; };
  const io = { cwd: f.root, env: inherited, platform: 'linux', sshPath: 'ssh', stdout: () => {}, stderr: () => {}, spawn, sops,
    importer: async () => ({ verifyStack: async ctx => {
      assert.equal(ctx.env, inherited);
      assert.equal(ctx.sops, sops);
      assert.equal(Object.hasOwn(ctx, 'sops'), false);
      ctx.spawn('docker', ['info']);
      ctx.spawn('implicit-tool', []);
      ctx.spawn('explicit-tool', [], { input: 'public-input', background: true,
        env: { SoPs_AgE_KeY: 'synthetic-explicit-age', PUBLIC_VALUE: 'kept' } });
      return { ok: true, lines: [], data: {} };
    } }) };
  assert.equal(await stackMain(['verify', '--env', 'staging', '--target-binding', JSON.stringify(STACK)], io), 0);
  assert.ok(custodyReads > 0);
  assert.ok(calls.some(call => call.file === 'ssh' && call.args.includes('exit')));
  assert.ok(calls.every(call => !Object.keys(call.options.env).some(key => /^SOPS_/i.test(key))));
  const explicit = calls.find(call => call.file === 'explicit-tool').options;
  assert.equal(explicit.input, 'public-input');
  assert.equal(explicit.background, true);
  assert.equal(explicit.env.PUBLIC_VALUE, 'kept');
  assert.equal(inherited.sops_age_key, 'synthetic-age');
  calls.length = 0;
  assert.equal(await stackMain(['verify', '--env', 'staging'], io), 0);
  assert.ok(calls.some(call => call.options.env?.sops_age_key === 'synthetic-age'));
});

test('a native stack binding refuses ambient Docker routing and preserves explicitly selected native verification', t => {
  const f = files(t), config = { repoRoot: f.root, env: 'staging', stack: 'fixture', secretsDir: f.root,
    remote: { sealed: { ops: 'ops', sshKey: 'key', knownHosts: 'known' } }, verify: { http: [] } };
  for (const name of ['ops', 'key', 'known']) f.write(`${name}.enc`, 'synthetic');
  assert.throws(() => bindStackTarget({ env: { DOCKER_HOST: 'ssh://other.example' } }, config, STACK));
  const selected = { ...config, verify: { http: [{ method: 'POST' }], exec: [{ command: ['declared-command'] }] } };
  assert.deepEqual(bindStackTarget({ env: {} }, selected, STACK).verify, selected.verify);
});

test('losing a declared sealed member after admission cannot select ambient Docker', async t => {
  const f = files(t);
  let calls = 0, bodyCalls = 0;
  const ctx = { env: {}, platform: 'linux', spawn: () => { calls += 1; }, sops: { decrypt: () => { throw new Error('synthetic missing custody'); } } };
  await assert.rejects(withDockerTransport(ctx, { nativeTarget: STACK, secretsDir: f.root,
    remote: { host: 'unrelated-alias', sealed: { ops: 'missing', sshKey: 'key', knownHosts: 'known' } } }, {},
  async () => { bodyCalls += 1; }), /cannot open the sealed member/);
  assert.equal(calls, 0);
  assert.equal(bodyCalls, 0);
});

test('a bound custody path cannot traverse a directory junction outside its app', t => {
  const f = files(t);
  f.write('outside/member.enc', 'synthetic envelope');
  fs.mkdirSync(path.join(f.root, 'app'));
  fs.symlinkSync(path.join(f.root, 'outside'), path.join(f.root, 'app', 'secrets'), 'junction');
  assert.throws(() => assertBoundCustody(path.join(f.root, 'app'), path.join(f.root, 'app', 'secrets', 'member.enc')));
});

async function linked(t, declaration, endpoint = LINKED, env = {}, options = {}) {
  const f = files(t), calls = [], opens = [];
  f.write('hfs.json', JSON.stringify({ kind: 'app', project: 'fixture', edition: 'lite' }));
  f.write(`supabase/migrations/${stamp}`, 'select 1;');
  f.write('node_modules/supabase/dist/supabase.js', '// synthetic installed launcher');
  f.write('supabase/.temp/project-ref', LINKED.projectRef);
  if (options.pooler !== undefined) f.write('supabase/.temp/pooler-url', options.pooler);
  f.write('supabase/.env', 'PGSERVICE=synthetic-project-service\nPGSSLCERT=synthetic-project-cert\n');
  f.write('.env', 'PGPASSWORD=synthetic-project-password\n');
  f.write('.starcistacks/application-stacks.yaml', `database:\n  baseline: base\n  projectRef: ${LINKED.projectRef}\n${declaration}`);
  if (options.password) f.write('.starcistacks/staging/secrets/database.enc', 'PASSWORD=ENC[synthetic]\n');
  let stdout = '', stderr = '';
  const code = await dbMigrateMain(['--linked', '--target-binding', JSON.stringify(endpoint), '--json', ...(options.execute ? ['--execute'] : [])], {
    cwd: f.root, env, stdout: text => { stdout += text; }, stderr: text => { stderr += text; },
    sops: { decrypt: file => { opens.push(file); if (options.password) return { PASSWORD: options.password }; throw new Error('unexpected custody open'); } },
    stackIo: { spawn: (...args) => { calls.push(args); if (options.respond) return options.respond(...args); throw new Error('unexpected native CLI'); } },
  });
  return { code, calls, opens, stdout, stderr, root: f.root };
}

test('a bound linked target with no declared sealed password cannot fall back to CLI login', async t => {
  const result = await linked(t, '');
  assert.equal(result.code, 2);
  assert.equal(result.calls.length, 0);
  assert.equal(result.opens.length, 0);
});

test('a bound linked target rejects an ambient password before it can shadow declared custody', async t => {
  const result = await linked(t, '  password: {env: staging, member: database, key: PASSWORD}\n', LINKED,
    { SUPABASE_DB_PASSWORD: 'synthetic-value' });
  assert.equal(result.code, 2);
  assert.equal(result.calls.length, 0);
  assert.equal(result.opens.length, 0);
  assert.ok(!`${result.stdout}${result.stderr}`.includes('synthetic-value'));
});

test('bound linked history uses the declared password and explicit native profile with machine output', async t => {
  const password = 'synthetic-private-input';
  const result = await linked(t, '  password: {env: staging, member: database, key: PASSWORD}\n', LINKED, {}, {
    password, respond: () => ({ status: 0, stdout: JSON.stringify({ migrations: [{ local: stamp.slice(0, 14), remote: stamp.slice(0, 14), time: 'public timestamp' }], message: 'Migrations listed' }), stderr: '' }),
  });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.calls.length, 1);
  const [file, argv, options] = result.calls[0];
  assert.equal(file, process.execPath);
  assert.equal(argv[argv.indexOf('--profile') + 1], 'supabase');
  assert.equal(argv[argv.indexOf('--output-format') + 1], 'json');
  assert.equal(options.env.PGPASSWORD, password);
  assert.equal(options.env.SUPABASE_DB_PASSWORD, undefined);
  assert.ok(argv.includes('--db-url'));
  assert.ok(!argv.includes('--linked'));
  assert.equal(argv[argv.indexOf('--db-url') + 1], `postgresql://postgres@db.${LINKED.projectRef}.supabase.co:5432/postgres?sslmode=require`);
  assert.equal(options.cwd, argv[argv.indexOf('--workdir') + 1]);
  assert.notEqual(options.cwd, result.root);
  assert.equal(fs.existsSync(options.cwd), false);
  assert.ok(!argv.includes(password));
  assert.ok(!`${result.stdout}${result.stderr}`.includes(password));
  assert.equal(JSON.parse(result.stdout).done, true);
});

test('bound linked commands use clean public scratch and the declared password across history, repair and push', async t => {
  let marked = false;
  const scratchDirectories = [];
  const password = 'synthetic-selected-password', cached = 'synthetic-unused-cache-password';
  const result = await linked(t, '  password: {env: staging, member: database, key: PASSWORD}\n', LINKED,
    { STARCI_DB_ARMED: '1', pgservice: 'synthetic-service', PGSSLCERT: 'synthetic-cert', pgpassword: 'synthetic-shadow',
      supabase_access_token: 'synthetic-management-token', sops_age_key: 'synthetic-age', ORCA_TERMINAL_HANDLE: 'synthetic-terminal' }, {
      password, execute: true, pooler: `postgresql://postgres.${LINKED.projectRef}:${cached}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
      respond: (_file, argv, options) => {
        const dir = argv[argv.indexOf('--workdir') + 1];
        scratchDirectories.push(dir);
        assert.equal(options.cwd, dir);
        assert.deepEqual(fs.readdirSync(dir), ['supabase']);
        assert.deepEqual(fs.readdirSync(path.join(dir, 'supabase')).sort(), ['config.toml', 'migrations']);
        assert.equal(options.env.PGPASSWORD, password);
        assert.equal(options.env.ORCA_TERMINAL_HANDLE, 'synthetic-terminal');
        for (const key of Object.keys(options.env)) {
          if (/^(?:PG|SUPABASE_|SOPS_)/i.test(key)) assert.ok(['PGPASSWORD', 'SUPABASE_ENV'].includes(key));
        }
        assert.equal(argv[argv.indexOf('--db-url') + 1], `postgresql://postgres.${LINKED.projectRef}@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require`);
        assert.ok(!argv.includes('--linked'));
        if (argv.includes('repair')) marked = true;
        return { status: 0, stdout: argv.includes('list') ? JSON.stringify({ migrations: marked ? [{ local: stamp.slice(0, 14), remote: stamp.slice(0, 14) }] : [] }) : '{}', stderr: '' };
      },
    });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.calls.length, 5);
  assert.equal(JSON.parse(result.stdout).executed, true);
  assert.ok(scratchDirectories.every(dir => !fs.existsSync(dir)));
  assert.ok(!`${result.stdout}${result.stderr}`.includes(cached));
});

for (const pooler of [
  'postgresql://postgres.otherprojectrefhere@aws-0-us-east-1.pooler.supabase.com:5432/postgres',
  `postgresql://postgres.${LINKED.projectRef}@unrelated.example:5432/postgres`,
  `postgresql://postgres.${LINKED.projectRef}@aws-0-us-east-1.pooler.supabase.com:5432/postgres?service=other`,
]) {
  test('a bound linked cache outside the selected tenant/domain/options refuses before custody and tools', async t => {
    const result = await linked(t, '  password: {env: staging, member: database, key: PASSWORD}\n', LINKED, {}, { pooler, password: 'synthetic-value' });
    assert.equal(result.code, 2);
    assert.equal(result.opens.length, 0);
    assert.equal(result.calls.length, 0);
  });
}

test('malformed bound migration history cannot become an empty database plan', async t => {
  const result = await linked(t, '  password: {env: staging, member: database, key: PASSWORD}\n', LINKED, {}, {
    password: 'synthetic-private-input', respond: () => ({ status: 0, stdout: JSON.stringify({ migrations: [{}] }), stderr: '' }),
  });
  assert.equal(result.code, 1);
  assert.equal(result.calls.length, 1);
  assert.ok(result.calls[0][1].includes('list'));
});

test('a bound database selector cannot be switched from linked to a URL or carry undeclared fields', async t => {
  const result = await linked(t, '', { ...LINKED, mode: 'url-env', urlEnv: 'DATABASE_URL', host: 'db.example', port: 5432, database: 'postgres', user: 'postgres' });
  assert.equal(result.code, 2);
  assert.equal(result.calls.length, 0);
  assert.throws(() => parseTargetBinding(JSON.stringify({ ...STACK, shell: 'arbitrary' }), 'docker-swarm'));
  assert.throws(() => parseTargetBinding(JSON.stringify({ ...LINKED, projectRef: 'shortprojectref' }), 'supabase-db'));
});
