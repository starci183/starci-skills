import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { withDockerTransport } from '../../packages/hfs/stack/docker-transport.mjs';
import { fakeHost, fakeSops } from '../helpers/stack-fakes.mjs';
import { makeApp } from '../helpers/stack-remote-fakes.mjs';

const SEALED = { ops: 'ops', sshKey: 'vps-ssh-key', knownHosts: 'vps-known-hosts' };
const PEM = '-----BEGIN OPENSSH PRIVATE KEY-----\nSECRETKEYBODY\n-----END OPENSSH PRIVATE KEY-----\n';
const apps = [];
const sealedApp = () => {
  const app = makeApp({ deploy: { remote: { host: 'vps', sealed: SEALED } }, sealedFiles: true });
  apps.push(app);
  return app;
};
after(() => { for (const app of apps) app.cleanup(); });

const sops = (known = 'vps.example ssh-ed25519 AAAA') => fakeSops({ members: { ops: { VPS_HOST: 'vps.example', VPS_USER: 'deploy' } }, binary: { 'vps-ssh-key': PEM, 'vps-known-hosts': known } });

/** A context whose spawn records every call; `env` is the operator environment. */
function operator(env = {}) {
  const calls = [];
  const host = fakeHost();
  const errors = [];
  const ctx = host.ctx({ sops: sops(), env: { HOME: '/operator', ...env }, spawn: (command, args, options = {}) => { calls.push({ command, args, options }); return { status: 0, stdout: '', stderr: '' }; }, stderr: (text) => errors.push(text) });
  return { ctx, calls, errors };
}

test('on an operator machine docker children get a private HOME with an ssh config for the sealed session and DOCKER_HOST', async () => {
  const { config } = sealedApp();
  const { ctx, calls } = operator({ DOCKER_CONFIG: '/operator/.docker' });
  let seen;
  const result = await withDockerTransport(ctx, config, {}, async (inner) => {
    inner.spawn('docker', ['service', 'ls']);
    inner.spawn('ssh', ['x']);
    inner.spawn('docker', ['stack', 'config'], { env: { PATH: '/bin' } });
    seen = calls.map((call) => ({ command: call.command, env: call.options.env }));
    return 'done';
  });
  assert.equal(result, 'done');
  const [docker, other, minimal] = seen;
  assert.equal(docker.env.DOCKER_HOST, 'ssh://stack-vps');
  assert.equal(docker.env.DOCKER_CONFIG, '/operator/.docker');
  assert.notEqual(docker.env.HOME, '/operator');
  assert.equal(docker.env.USERPROFILE, docker.env.HOME);
  assert.equal(other.env, undefined, 'only docker children are redirected');
  assert.deepEqual(minimal.env, { PATH: '/bin' }, 'an explicit minimal environment is never widened');
  assert.equal(fs.existsSync(docker.env.HOME), false, 'the private HOME and the key are removed afterwards');
});

test('the ssh config names the account, the key file and the pinned known_hosts, and the key is not in any argument', async () => {
  const { config } = sealedApp();
  const { ctx, calls } = operator({ HOME: undefined });
  let configText = '';
  await withDockerTransport(ctx, config, {}, async (inner) => {
    inner.spawn('docker', ['info']);
    const env = calls[0].options.env;
    configText = fs.readFileSync(`${env.HOME}/.ssh/config`, 'utf8');
    assert.equal(Object.hasOwn(env, 'DOCKER_CONFIG'), false, 'no operator home: no docker config is guessed');
  });
  assert.match(configText, /Host stack-vps\n {2}HostName vps\.example\n {2}User deploy\n/u);
  assert.match(configText, /StrictHostKeyChecking yes/u);
  assert.match(configText, /IdentitiesOnly yes/u);
  assert.equal(JSON.stringify(calls).includes('SECRETKEYBODY'), false);
  assert.equal(configText.includes('SECRETKEYBODY'), false);
});

test('a missing known_hosts is announced on stderr (accept-new) and the session is still removed when the body throws', async () => {
  const { config } = sealedApp();
  const { ctx, errors, calls } = operator();
  const noKnown = Object.create(ctx, { sops: { value: sops('') } });
  let home = '';
  await assert.rejects(withDockerTransport(noKnown, config, {}, async (inner) => {
    inner.spawn('docker', ['info']);
    home = calls[0].options.env.HOME;
    throw new Error('boom');
  }), /boom/u);
  assert.match(errors.join(''), /accepted on first contact/u);
  assert.equal(fs.existsSync(home), false);
});

test('nothing changes in CI, with DOCKER_HOST, --ssh-cmd, STARCI_STACK_SEALED_SSH=0, no sealed declaration or missing sealed files', async () => {
  const { config } = sealedApp();
  const own = (ctx) => withDockerTransport(ctx, config, {}, async (inner) => inner === ctx);
  assert.equal(await own(operator({ GITHUB_ACTIONS: 'true' }).ctx), true);
  assert.equal(await own(operator({ DOCKER_HOST: 'ssh://elsewhere' }).ctx), true);
  assert.equal(await own(operator({ STARCI_STACK_SEALED_SSH: '0' }).ctx), true);
  const one = operator().ctx;
  assert.equal(await withDockerTransport(one, config, { sshCmd: 'ssh vps' }, async (inner) => inner === one), true);
  const plain = makeApp();
  apps.push(plain);
  const two = operator().ctx;
  assert.equal(await withDockerTransport(two, { ...plain.config, remote: { ...plain.config.remote, sealed: null } }, {}, async (inner) => inner === two), true);
  const noFiles = makeApp({ deploy: { remote: { host: 'vps', sealed: SEALED } } });
  apps.push(noFiles);
  const three = operator().ctx;
  assert.equal(await withDockerTransport(three, noFiles.config, {}, async (inner) => inner === three), true);
});

test('the operator docker config is found through USERPROFILE when there is no HOME (Windows)', async () => {
  const { config } = sealedApp();
  const { ctx, calls } = operator({ HOME: undefined, USERPROFILE: '/profile' });
  await withDockerTransport(ctx, config, {}, async (inner) => { inner.spawn('docker', ['info']); });
  assert.equal(calls[0].options.env.DOCKER_CONFIG.replaceAll(String.fromCodePoint(92), '/'), '/profile/.docker');
});

test('on win32 the key, known_hosts and the private ssh config are all restricted to the current user with icacls', async () => {
  const { config } = sealedApp();
  const { ctx, calls } = operator();
  await withDockerTransport({ ...ctx, platform: 'win32', username: 'op' }, config, {}, async () => {});
  const restricted = calls.filter((call) => call.command === 'icacls');
  assert.deepEqual(restricted.map((call) => call.args.slice(1)), [['/inheritance:r', '/grant:r', 'op:R'], ['/inheritance:r', '/grant:r', 'op:R'], ['/inheritance:r', '/grant:r', 'op:R'], ['/inheritance:r', '/grant:r', 'op:F']]);
  assert.ok(restricted[2].args[0].endsWith('config'));
});
