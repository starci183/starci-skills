import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { connectCi, disconnectCi, lfOnly, remoteDocker, shellQuote, sshRunner, withOwnerTransport, withRunner } from '../../packages/hfs/stack/remote.mjs';
import { fakeHost, fakeSops } from '../helpers/stack-fakes.mjs';
import { shellWords } from '../helpers/stack-remote-fakes.mjs';

const KEY_BODY = 'SECRETKEYBODY';
const PEM = `-----BEGIN OPENSSH PRIVATE KEY-----\n${KEY_BODY}\n-----END OPENSSH PRIVATE KEY-----\n`;
const KNOWN = 'vps.example ssh-ed25519 AAAAC3NzaC1lZDI1NTE5';
const temps = [];
const tempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stack-'));
  temps.push(dir);
  return dir;
};
after(() => { for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true }); });

const sealedConfig = (sealed = { ops: 'ops', sshKey: 'vps-ssh-key', knownHosts: 'vps-known-hosts' }) => ({
  stack: 'shop', secretsDir: '/nowhere/secrets', remote: { host: 'vps', releasesBase: null, sealed },
});
const aliasConfig = () => sealedConfig(null);
const ownerSops = (extra = {}) => fakeSops({
  members: { ops: { VPS_HOST: 'vps.example', VPS_USER: 'deploy' } },
  binary: { 'vps-ssh-key': PEM, 'vps-known-hosts': KNOWN },
  ...extra,
});
const ownerCtx = (host, sops, env = {}) => host.ctx({ sops, env: { STARCI_STACK_SEALED_SSH: '1', ...env } });
const answer = (stdout = '', status = 0) => ({ status, stdout, stderr: '' });

test('lfOnly removes every carriage return', () => {
  assert.equal(lfOnly('set -o pipefail\r\necho hi\r\n'), 'set -o pipefail\necho hi\n');
  assert.equal(lfOnly('plain'), 'plain');
});

test('shellQuote single-quotes a value and survives an apostrophe', () => {
  assert.equal(shellQuote('a b'), "'a b'");
  assert.equal(shellQuote("it's"), String.raw`'it'\''s'`);
  assert.deepEqual(shellWords(`docker ${shellQuote("it's")} ${shellQuote('')}`), ['docker', "it's", '']);
});

test('shellQuote refuses NUL and line breaks', () => {
  for (const value of ['a\0b', 'a\nb', 'a\rb']) {
    assert.throws(() => shellQuote(value), (error) => error.code === 'STACK_REMOTE_ARGUMENT' && error.exit === 2);
  }
});

test('remoteDocker runs docker with quoted arguments', () => {
  const seen = [];
  const result = remoteDocker((command) => { seen.push(command); return answer('x'); }, ['volume', 'inspect', 'a b']);
  assert.deepEqual(seen, ["docker 'volume' 'inspect' 'a b'"]);
  assert.equal(result.stdout, 'x');
});

test('alias mode runs the command as one ssh argument against the configured alias', () => {
  const host = fakeHost({ overrides: { ssh: () => answer('done\n') } });
  const run = sshRunner(host.ctx(), aliasConfig(), { sshCmd: null });
  assert.deepEqual(run('echo a\r\necho b'), { status: 0, stdout: 'done\n', stderr: '' });
  assert.deepEqual(host.calls[0].args, ['-T', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', 'vps', 'echo a\necho b']);
  assert.deepEqual(run.notes, []);
  run.cleanup();
});

test('alias mode is the default when no options are given and passes stdin through lfOnly', () => {
  const host = fakeHost({ overrides: { ssh: () => answer() } });
  const run = sshRunner(host.ctx({ env: { STARCI_STACK_SEALED_SSH: '0' } }), sealedConfig());
  run('cat', { input: 'a\r\nb' });
  assert.equal(host.calls[0].input, 'a\nb');
  run('true');
  assert.equal(host.calls[1].input, undefined);
});

test('the sealed flag is ignored when no sealed members are declared', () => {
  const host = fakeHost({ overrides: { ssh: () => answer() } });
  sshRunner(ownerCtx(host, undefined), aliasConfig())('true');
  assert.equal(host.calls[0].args.at(-2), 'vps');
});

test('--ssh-cmd splits on whitespace and runs without a shell', () => {
  const host = fakeHost({ overrides: { ssh: () => answer('ok') } });
  const run = sshRunner(host.ctx(), aliasConfig(), { sshCmd: '  ssh   -p 2222 vps ' });
  assert.equal(run('uptime').stdout, 'ok');
  assert.deepEqual(host.calls[0].args, ['-p', '2222', 'vps', 'uptime']);
  assert.throws(() => sshRunner(host.ctx(), aliasConfig(), { sshCmd: ' \t ' }), (error) => error.code === 'STACK_REMOTE_SSH_CMD');
});

test('--ssh-cmd wins over the sealed session', () => {
  const host = fakeHost({ overrides: { ssh: () => answer() } });
  const sops = { decrypt: () => assert.fail('not used'), decryptBinary: () => assert.fail('not used') };
  sshRunner(ownerCtx(host, sops), sealedConfig(), { sshCmd: 'ssh vps' })('true');
  assert.equal(host.calls[0].args[0], 'vps');
});

test('a spawn error becomes status 127 and a missing status becomes 1', () => {
  const failing = { env: {}, spawn: () => ({ error: new Error('ENOENT'), status: null, stdout: '', stderr: '' }) };
  const result = sshRunner(failing, aliasConfig())('true');
  assert.equal(result.status, 127);
  assert.match(result.stderr, /cannot run ssh: ENOENT/u);
  const killed = { env: {}, spawn: () => ({ status: null, stdout: '', stderr: 'killed' }) };
  assert.equal(sshRunner(killed, aliasConfig())('true').status, 1);
});

test('the owner-machine session writes a private key and known_hosts, pins the host and cleans up', () => {
  let seen = null;
  const host = fakeHost({
    overrides: {
      ssh: (args) => {
        const keyFile = args[args.indexOf('-i') + 1];
        const knownFile = args.find((arg) => arg.startsWith('UserKnownHostsFile=')).slice(19);
        seen = { keyFile, knownFile, key: fs.readFileSync(keyFile, 'utf8'), known: fs.readFileSync(knownFile, 'utf8') };
        if (process.platform !== 'win32') seen.mode = fs.statSync(keyFile).mode & 0o777;
        return answer('remote ok');
      },
    },
  });
  const sops = ownerSops({ binary: { 'vps-ssh-key': PEM.replaceAll('\n', '\r\n'), 'vps-known-hosts': `${KNOWN}\r\n` } });
  const run = sshRunner(ownerCtx(host, sops), sealedConfig());
  assert.equal(run('uptime').stdout, 'remote ok');
  assert.equal(seen.key, PEM);
  assert.equal(seen.known, `${KNOWN}\n`);
  if (process.platform !== 'win32') assert.equal(seen.mode, 0o600);
  const args = host.calls[0].args;
  assert.ok(args.includes('StrictHostKeyChecking=yes'));
  for (const option of ['IdentitiesOnly=yes', 'BatchMode=yes', 'ConnectTimeout=20']) assert.ok(args.includes(option));
  assert.equal(args.at(-2), 'deploy@vps.example');
  assert.equal(args.at(-1), 'uptime');
  assert.deepEqual(run.notes, []);
  run.cleanup();
  assert.equal(fs.existsSync(path.dirname(seen.keyFile)), false);
  run.cleanup();
  assert.ok(!JSON.stringify(host.calls).includes(KEY_BODY));
});

test('on win32 the sealed key and known_hosts lose their inherited ACL and are granted to the current user only, so Windows OpenSSH accepts the key', () => {
  const icacls = [];
  const host = fakeHost({ overrides: { ssh: () => answer(), icacls: (args) => { icacls.push({ args, key: fs.existsSync(args[0]) }); return answer(); } } });
  const ctx = ownerCtx(host, ownerSops(), {});
  const run = sshRunner({ ...ctx, platform: 'win32', username: 'Op Erator' }, sealedConfig());
  run('uptime');
  const keyFile = host.calls.find((call) => call.command === 'ssh').args.find((arg, index, all) => all[index - 1] === '-i');
  const knownFile = host.calls.find((call) => call.command === 'ssh').args.find((arg) => arg.startsWith('UserKnownHostsFile=')).slice(19);
  assert.deepEqual(icacls.map((entry) => entry.args), [[keyFile, '/inheritance:r', '/grant:r', 'Op Erator:R'], [knownFile, '/inheritance:r', '/grant:r', 'Op Erator:R']]);
  assert.ok(icacls.every((entry) => entry.key), 'the file exists when its ACL is set');
  run.cleanup();
  assert.deepEqual(icacls.at(-1).args, [keyFile, '/inheritance:r', '/grant:r', 'Op Erator:F'], 'cleanup re-grants write so the key can be overwritten');
  assert.equal(JSON.stringify(host.calls).includes(KEY_BODY), false);
});

test('on win32 the username comes from os.userInfo() when the context names none; other platforms never call icacls', () => {
  const icacls = [];
  const host = fakeHost({ overrides: { ssh: () => answer(), icacls: (args) => { icacls.push(args); return answer(); } } });
  const win = { ...ownerCtx(host, ownerSops(), {}), platform: 'win32', username: undefined };
  sshRunner(win, sealedConfig())('true');
  assert.equal(icacls[0].at(-1), `${os.userInfo().username}:R`);
  icacls.length = 0;
  for (const platform of ['linux', 'darwin']) sshRunner({ ...ownerCtx(host, ownerSops(), {}), platform }, sealedConfig())('true');
  assert.deepEqual(icacls, []);
});

test('a failing icacls refuses the session and leaves no key behind', () => {
  const host = fakeHost({ overrides: { ssh: () => answer(), icacls: () => ({ status: 5, stdout: '', stderr: 'Access is denied.' + String.fromCharCode(10) + 'more' }) } });
  const before = fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith('stack-ssh-'));
  assert.throws(() => sshRunner({ ...ownerCtx(host, ownerSops(), {}), platform: 'win32', username: 'op' }, sealedConfig())('true'), (error) => error.code === 'STACK_REMOTE_ACL' && error.message.includes('Access is denied.') && !error.message.includes(KEY_BODY));
  assert.equal(host.calls.some((call) => call.command === 'ssh'), false);
  const leaked = fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith('stack-ssh-') && !before.includes(name));
  for (const name of leaked) fs.rmSync(path.join(os.tmpdir(), name), { recursive: true, force: true });
  assert.deepEqual(leaked, [], 'the temp directory with the key was removed');
});

test('without known_hosts content the owner session says accept-new is used', () => {
  const host = fakeHost({ overrides: { ssh: () => answer() } });
  const run = sshRunner(ownerCtx(host, ownerSops({ binary: { 'vps-ssh-key': PEM, 'vps-known-hosts': '\n' } })), sealedConfig());
  run('true');
  assert.ok(host.calls[0].args.includes('StrictHostKeyChecking=accept-new'));
  assert.equal(run.notes.length, 1);
  assert.match(run.notes[0], /accept-new/u);
  run.cleanup();
});

test('JSON envelopes around the sealed binary members are unwrapped', () => {
  const seen = [];
  const host = fakeHost({
    overrides: {
      ssh: (args) => {
        seen.push(
          fs.readFileSync(args[args.indexOf('-i') + 1], 'utf8'),
          fs.readFileSync(args.find((arg) => arg.startsWith('UserKnownHostsFile=')).slice(19), 'utf8'),
        );
        return answer();
      },
    },
  });
  const cases = [
    [JSON.stringify({ data: PEM }), JSON.stringify({ knownHosts: KNOWN }), PEM, `${KNOWN}\n`],
    [JSON.stringify({ privateKey: PEM }), JSON.stringify({ known_hosts: KNOWN }), PEM, `${KNOWN}\n`],
    [`{"other": 1, "pem": ${JSON.stringify(PEM)} PRIVATE KEY`, '{ not json', `{"other": 1, "pem": ${JSON.stringify(PEM)} PRIVATE KEY\n`, '{ not json\n'],
    [`{"x": 1} PRIVATE KEY`, '{"x": 1}', '{"x": 1} PRIVATE KEY\n', '{"x": 1}\n'],
  ];
  for (const [key, known, wantKey, wantKnown] of cases) {
    const run = sshRunner(ownerCtx(host, ownerSops({ binary: { 'vps-ssh-key': key, 'vps-known-hosts': known } })), sealedConfig());
    run('true');
    run.cleanup();
    assert.deepEqual(seen.splice(0), [wantKey, wantKnown]);
  }
});

test('a missing or unreadable sealed member is a refusal that names the member only', () => {
  const host = fakeHost();
  const base = ownerSops();
  const missing = (patch) => () => sshRunner(ownerCtx(host, { ...base, ...patch }), sealedConfig());
  assert.throws(missing({ decrypt: () => { throw new Error('sops could not decrypt ops.enc'); } }), (error) => error.code === 'STACK_REMOTE_SEALED' && /member ops/u.test(error.message));
  assert.throws(missing({ decryptBinary: (file) => { throw new Error(`no ${path.basename(file)}`); } }), (error) => error.code === 'STACK_REMOTE_SEALED' && /vps-ssh-key/u.test(error.message));
  assert.throws(missing({ decryptBinary: (file) => { if (file.includes('known')) throw new Error('gone'); return PEM; } }), (error) => error.code === 'STACK_REMOTE_SEALED' && /vps-known-hosts/u.test(error.message));
});

test('ops must hold a clean VPS_HOST and VPS_USER', () => {
  const host = fakeHost();
  const open = (ops) => () => sshRunner(ownerCtx(host, ownerSops({ members: { ops } })), sealedConfig());
  const invalid = (error) => error.code === 'STACK_REMOTE_OPS';
  assert.throws(open({ VPS_USER: 'deploy' }), invalid);
  assert.throws(open({ VPS_HOST: 'vps.example' }), invalid);
  assert.throws(open({ VPS_HOST: 'vps example', VPS_USER: 'deploy' }), invalid);
  assert.throws(open({ VPS_HOST: 'vps.example', VPS_USER: '-oProxyCommand=x' }), invalid);
  assert.throws(open({ VPS_HOST: 'vps.example', VPS_USER: 'dep;loy' }), invalid);
});

test('a sealed ssh key that is not a PEM private key is refused without printing it', () => {
  const host = fakeHost();
  const sops = ownerSops({ binary: { 'vps-ssh-key': 'not-a-key-SECRETKEYBODY', 'vps-known-hosts': KNOWN } });
  assert.throws(() => sshRunner(ownerCtx(host, sops), sealedConfig()), (error) => error.code === 'STACK_REMOTE_KEY' && !error.message.includes(KEY_BODY));
});

test('withOwnerTransport selects the sealed session only on an operator machine with all members present', () => {
  const dir = tempDir();
  const config = { ...sealedConfig(), secretsDir: dir };
  const ctx = { env: { HOME: 'x' }, spawn: () => answer(), get sops() { return assert.fail('the seam must not be opened'); } };
  assert.equal(withOwnerTransport(ctx, config), ctx);
  fs.writeFileSync(path.join(dir, 'ops.enc'), '');
  fs.writeFileSync(path.join(dir, 'vps-ssh-key.enc'), '');
  assert.equal(withOwnerTransport(ctx, config, {}), ctx);
  fs.writeFileSync(path.join(dir, 'vps-known-hosts.enc'), '');
  const owner = withOwnerTransport(ctx, config, { sshCmd: null });
  assert.notEqual(owner, ctx);
  assert.equal(owner.env.STARCI_STACK_SEALED_SSH, '1');
  assert.equal(owner.env.HOME, 'x');
  assert.equal(ctx.env.STARCI_STACK_SEALED_SSH, undefined);
  assert.equal(owner.spawn, ctx.spawn);
});

test('withOwnerTransport leaves CI, --ssh-cmd, an explicit flag and undeclared sealed members alone', () => {
  const dir = tempDir();
  for (const slug of ['ops', 'vps-ssh-key', 'vps-known-hosts']) fs.writeFileSync(path.join(dir, `${slug}.enc`), '');
  const config = { ...sealedConfig(), secretsDir: dir };
  const unchanged = (ctx, cfg, options) => assert.equal(withOwnerTransport(ctx, cfg, options), ctx);
  unchanged({ env: { GITHUB_ACTIONS: 'true' } }, config);
  unchanged({ env: {} }, config, { sshCmd: 'ssh vps' });
  unchanged({ env: { STARCI_STACK_SEALED_SSH: '0' } }, config);
  unchanged({ env: {} }, { ...config, remote: { ...config.remote, sealed: null } });
});

test('withRunner uses deps.ssh, passes the notes and cleans up even when the body throws', async () => {
  const cleaned = [];
  const run = Object.assign(() => answer(), { notes: ['a note'], cleanup: () => cleaned.push(1) });
  const value = await withRunner({ env: {} }, aliasConfig(), {}, { ssh: run }, (given, notes) => { assert.equal(given, run); return notes; });
  assert.deepEqual(value, ['a note']);
  await assert.rejects(withRunner({ env: {} }, aliasConfig(), {}, { ssh: run }, () => { throw new Error('boom'); }), /boom/u);
  assert.equal(cleaned.length, 2);
  const bare = () => answer();
  assert.deepEqual(await withRunner({ env: {} }, aliasConfig(), {}, { ssh: bare }, (_run, notes) => notes), []);
});

test('withRunner opens the real ssh runner by default and removes the sealed session when the body throws', async () => {
  const keyFiles = [];
  const host = fakeHost({ overrides: { ssh: (args) => { keyFiles.push(args[args.indexOf('-i') + 1]); return answer(); } } });
  const dir = tempDir();
  for (const slug of ['ops', 'vps-ssh-key', 'vps-known-hosts']) fs.writeFileSync(path.join(dir, `${slug}.enc`), '');
  const config = { ...sealedConfig(), secretsDir: dir };
  const ctx = host.ctx({ sops: ownerSops(), env: {} });
  await assert.rejects(withRunner(ctx, config, { sshCmd: null }, {}, (run) => { run('true'); throw new Error('stop'); }), /stop/u);
  assert.equal(keyFiles.length, 1);
  assert.equal(fs.existsSync(path.dirname(keyFiles[0])), false);
  const alias = await withRunner(host.ctx(), aliasConfig(), {}, {}, (run) => run('true'));
  assert.equal(alias.status, 0);
});

const ciEnv = (home, extra = {}) => ({
  GITHUB_ACTIONS: 'true', HOME: home, GITHUB_ENV: path.join(home, 'github-env'),
  VPS_SSH_KEY: PEM.replaceAll('\n', '\r\n'), VPS_KNOWN_HOSTS: `${KNOWN}\r\n`, VPS_HOST: 'vps.example', VPS_USER: 'deploy', ...extra,
});
const refusalCode = (code) => (error) => error.code === code && error.exit === 2;

test('connectCi writes the pinned key, known_hosts, ssh config and DOCKER_HOST', async () => {
  const home = tempDir();
  const host = fakeHost();
  const result = await connectCi(host.ctx({ env: ciEnv(home) }), aliasConfig(), { execute: true });
  assert.equal(result.ok, true);
  const ssh = path.join(home, '.ssh');
  assert.equal(fs.readFileSync(path.join(ssh, 'deploy_key'), 'utf8'), PEM);
  assert.equal(fs.readFileSync(path.join(ssh, 'known_hosts'), 'utf8'), `${KNOWN}\n`);
  if (process.platform !== 'win32') {
    assert.equal(fs.statSync(path.join(ssh, 'deploy_key')).mode & 0o777, 0o600);
    assert.equal(fs.statSync(path.join(ssh, 'known_hosts')).mode & 0o777, 0o644);
  }
  const config = fs.readFileSync(path.join(ssh, 'config'), 'utf8');
  for (const line of ['Host vps', 'HostName vps.example', 'User deploy', 'IdentityFile ~/.ssh/deploy_key', 'StrictHostKeyChecking yes', 'BatchMode yes', 'ConnectTimeout 20',
    'ServerAliveInterval 30', 'ControlMaster auto', 'ControlPath ~/.ssh/cm-%C', 'ControlPersist 15m']) assert.ok(config.includes(line), line);
  assert.equal(fs.readFileSync(path.join(home, 'github-env'), 'utf8'), 'DOCKER_HOST=ssh://vps\n');
  assert.ok(!JSON.stringify(result).includes(KEY_BODY));
  assert.deepEqual(result.data, { host: 'vps', files: ['deploy_key', 'known_hosts', 'config'] });
});

test('connectCi without execute writes nothing and says what it would write', async () => {
  const home = tempDir();
  const result = await connectCi(fakeHost().ctx({ env: ciEnv(home) }), aliasConfig());
  assert.equal(result.ok, true);
  assert.ok(result.lines.every((line) => line.startsWith('dry run: would write')));
  assert.equal(result.lines.length, 4);
  assert.deepEqual(fs.readdirSync(home), []);
  assert.ok(!JSON.stringify(result).includes(KEY_BODY));
});

test('connectCi refuses outside GitHub Actions and without its inputs', async () => {
  const home = tempDir();
  const ctx = (extra) => fakeHost().ctx({ env: ciEnv(home, extra) });
  await assert.rejects(connectCi(ctx({ GITHUB_ACTIONS: 'false' }), aliasConfig(), { execute: true }), refusalCode('STACK_CONNECT_CI_ONLY'));
  await assert.rejects(connectCi(ctx({ HOME: '' }), aliasConfig(), { execute: true }), refusalCode('STACK_CONNECT_NO_HOME'));
  await Promise.all(['VPS_SSH_KEY', 'VPS_KNOWN_HOSTS', 'VPS_HOST', 'VPS_USER'].map((name) => assert.rejects(
    connectCi(ctx({ [name]: '' }), aliasConfig(), { execute: true }),
    (error) => error.code === 'STACK_CONNECT_MISSING' && error.message.includes(name),
  )));
  await assert.rejects(connectCi(ctx({ GITHUB_ENV: '' }), aliasConfig(), { execute: true }), refusalCode('STACK_CONNECT_NO_GITHUB_ENV'));
  assert.deepEqual(fs.readdirSync(home), []);
});

test('connectCi refuses a malformed host, user or key without printing the key', async () => {
  const home = tempDir();
  const ctx = (extra) => fakeHost().ctx({ env: ciEnv(home, extra) });
  const invalid = refusalCode('STACK_CONNECT_INVALID');
  await assert.rejects(connectCi(ctx({ VPS_HOST: 'a b' }), aliasConfig(), { execute: true }), invalid);
  await assert.rejects(connectCi(ctx({ VPS_USER: '-x' }), aliasConfig(), { execute: true }), invalid);
  await assert.rejects(connectCi(ctx({ VPS_USER: 'a\nb' }), aliasConfig(), { execute: true }), invalid);
  await assert.rejects(connectCi(ctx({ VPS_SSH_KEY: `plain ${KEY_BODY}` }), aliasConfig(), { execute: true }), (error) => invalid(error) && !error.message.includes(KEY_BODY));
});

test('disconnectCi closes the control master, removes the deploy key and tolerates a failing ssh', async () => {
  const home = tempDir();
  fs.mkdirSync(path.join(home, '.ssh'));
  fs.writeFileSync(path.join(home, '.ssh', 'deploy_key'), PEM);
  const host = fakeHost({ overrides: { ssh: () => answer('', 255) } });
  const result = await disconnectCi(host.ctx({ env: ciEnv(home) }), aliasConfig(), { execute: true });
  assert.equal(result.ok, true);
  assert.deepEqual(host.calls[0].args, ['-O', 'exit', 'vps']);
  assert.equal(fs.existsSync(path.join(home, '.ssh', 'deploy_key')), false);
  const again = await disconnectCi(host.ctx({ env: ciEnv(home) }), aliasConfig(), { execute: true });
  assert.equal(again.ok, true);
});

test('disconnectCi without execute changes nothing and refuses outside CI', async () => {
  const home = tempDir();
  fs.mkdirSync(path.join(home, '.ssh'));
  fs.writeFileSync(path.join(home, '.ssh', 'deploy_key'), PEM);
  const host = fakeHost();
  const result = await disconnectCi(host.ctx({ env: ciEnv(home) }), aliasConfig());
  assert.match(result.lines[0], /^dry run: would run ssh -O exit vps/u);
  assert.equal(host.calls.length, 0);
  assert.equal(fs.existsSync(path.join(home, '.ssh', 'deploy_key')), true);
  await assert.rejects(disconnectCi(host.ctx({ env: { HOME: home } }), aliasConfig(), { execute: true }), refusalCode('STACK_CONNECT_CI_ONLY'));
});
