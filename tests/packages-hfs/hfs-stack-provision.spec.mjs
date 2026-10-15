// proves: provision creates only the missing versioned secrets and configs, with values on stdin only, and scrubs docker failures.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { provisionRelease } from '../../packages/hfs/stack/provision.mjs';
import { configObjects, loadSealed } from '../../packages/hfs/stack/sealed.mjs';
import { makeApp, secretValues } from '../helpers/stack-release-fakes.mjs';

const apps = [];
const app = (options) => { const made = makeApp(options); apps.push(made); return made; };
after(() => apps.forEach((made) => made.dispose()));

const DIGEST = 'fedcba9876543210'.repeat(4);

function releaseOf(made) {
  const sealed = loadSealed(made.ctx(), made.config);
  return {
    releaseDigest: DIGEST,
    secrets: Object.entries(sealed.secrets).map(([key, entry]) => ({ key, runtimeName: entry.runtimeName })),
    configs: configObjects(made.config).map((item) => ({ logical: item.logical, name: item.name })),
  };
}

const dockerCalls = (made) => made.host.calls.filter((call) => call.command === 'docker');
const noSecretsIn = (text) => secretValues().forEach((value) => assert.ok(!text.includes(value), 'a secret value leaked'));

test('missing secrets and configs are created with the value on stdin and labels, nothing else', async () => {
  const made = app();
  const release = releaseOf(made);
  const result = await provisionRelease(made.ctx(), made.config, { release, execute: true });
  assert.equal(result.ok, true);
  assert.deepEqual(result.data, { created: release.secrets.length, kept: 0, configsCreated: 1 });
  assert.equal(made.host.state.secrets.size, release.secrets.length);
  const token = release.secrets.find((entry) => entry.key === 'TOKEN');
  const stored = made.host.state.secrets.get(token.runtimeName);
  assert.equal(stored.value, 'shared-token-value');
  assert.deepEqual(stored.labels, ['app.managed=true', 'app.key=TOKEN', `app.release=${DIGEST.slice(0, 16)}`]);
  const config = made.host.state.configs.get(release.configs[0].name);
  assert.equal(Buffer.from(config.value).toString('utf8'), 'routes: []\n');
  assert.deepEqual(config.labels, ['app.managed=true', `app.release=${DIGEST.slice(0, 16)}`]);
  noSecretsIn(JSON.stringify([result, dockerCalls(made).map((call) => call.args)]));
  assert.match(result.lines[0], /secrets created \d+, kept 0; configs created 1/u);
});

test('existing names are kept and nothing is created twice', async () => {
  const made = app();
  const release = releaseOf(made);
  await provisionRelease(made.ctx(), made.config, { release, execute: true });
  const before = made.host.state.created.length;
  const again = await provisionRelease(made.ctx(), made.config, { release, execute: true });
  assert.deepEqual(again.data, { created: 0, kept: release.secrets.length, configsCreated: 0 });
  assert.equal(made.host.state.created.length, before);
});

test('a dry run creates nothing and says what it would create', async () => {
  const made = app();
  const release = releaseOf(made);
  const result = await provisionRelease(made.ctx(), made.config, { release });
  assert.equal(made.host.state.created.length, 0);
  assert.equal(dockerCalls(made).some((call) => call.args[1] === 'create'), false);
  assert.match(result.lines[0], /^dry run: would create \d+ secrets \(.*TOKEN.*\), 1 configs; 0 kept$/u);
  noSecretsIn(result.lines.join('\n'));
});

test('the release record is read from a file when no object is given', async () => {
  const made = app();
  const releaseFile = path.join(made.root, 'release.json');
  fs.writeFileSync(releaseFile, JSON.stringify(releaseOf(made)));
  const result = await provisionRelease(made.ctx(), made.config, { releaseFile });
  assert.equal(result.data.created > 0, true);
});

test('a missing, unreadable or malformed release record is refused', async () => {
  const made = app();
  await assert.rejects(provisionRelease(made.ctx(), made.config, {}), (error) => error.code === 'STACK_RELEASE_MISSING');
  await assert.rejects(provisionRelease(made.ctx(), made.config, { releaseFile: path.join(made.root, 'absent.json') }), (error) => error.code === 'STACK_RELEASE_INVALID');
  await assert.rejects(provisionRelease(made.ctx(), made.config, { release: { releaseDigest: 'not-hex', secrets: [], configs: [] } }), (error) => error.code === 'STACK_RELEASE_INVALID');
  await assert.rejects(provisionRelease(made.ctx(), made.config, { release: { releaseDigest: DIGEST, secrets: {} } }), (error) => error.code === 'STACK_RELEASE_INVALID');
  await assert.rejects(provisionRelease(made.ctx(), made.config), (error) => error.code === 'STACK_RELEASE_MISSING');
});

test('a release naming a secret the custody no longer matches is stale', async () => {
  const made = app();
  const release = releaseOf(made);
  const changed = { ...release, secrets: release.secrets.map((entry) => (entry.key === 'TOKEN' ? { ...entry, runtimeName: 'app-token-v0000000000' } : entry)) };
  await assert.rejects(provisionRelease(made.ctx(), made.config, { release: changed, execute: true }), (error) => error.code === 'STACK_RELEASE_STALE' && error.message.includes('TOKEN') && error.message.includes('render the release again'));
  const unknown = { ...release, secrets: [...release.secrets, { key: 'GONE', runtimeName: 'app-gone-v1' }] };
  await assert.rejects(provisionRelease(made.ctx(), made.config, { release: unknown, execute: true }), (error) => error.code === 'STACK_RELEASE_STALE');
  assert.equal(made.host.state.created.length, 0);
});

test('a config name that matches no committed file is stale', async () => {
  const made = app();
  const release = releaseOf(made);
  const changed = { ...release, configs: [{ logical: 'routes', name: 'app-routes-c0000000000' }] };
  await assert.rejects(provisionRelease(made.ctx(), made.config, { release: changed, execute: true }), (error) => error.code === 'STACK_RELEASE_STALE');
  assert.equal(made.host.state.created.length, 0);
});

test('a failing secret create is reported with the value replaced and nothing leaks', async () => {
  const leaky = (args, call) => ({ status: 1, stdout: '', stderr: `rpc error: bad payload ${call.input} for ${args[args.length - 2]}\nsecond line` });
  const made = app({ overrides: { docker: { 'secret create': leaky } } });
  const release = releaseOf(made);
  await assert.rejects(provisionRelease(made.ctx(), made.config, { release, execute: true }), (error) => {
    assert.equal(error.code, 'STACK_PROVISION_FAILED');
    assert.equal(error.exit, 1);
    assert.ok(error.message.includes('[value]'));
    noSecretsIn(error.message);
    return true;
  });
});

test('a docker that cannot run, and a failing config create or listing, are failures', async () => {
  const unrunnable = app({ overrides: { docker: { 'secret create': () => ({ status: null, stdout: '', stderr: '', error: new Error('spawn docker ENOENT') }) } } });
  await assert.rejects(provisionRelease(unrunnable.ctx(), unrunnable.config, { release: releaseOf(unrunnable), execute: true }), (error) => error.code === 'STACK_PROVISION_FAILED' && error.message.includes('ENOENT'));
  const badConfig = app({ overrides: { docker: { 'config create': () => ({ status: 1, stdout: '', stderr: 'config refused' }) } } });
  await assert.rejects(provisionRelease(badConfig.ctx(), badConfig.config, { release: releaseOf(badConfig), execute: true }), (error) => error.code === 'STACK_PROVISION_FAILED' && error.message.includes('config refused') && error.message.includes('routes'));
  const badList = app({ overrides: { docker: { 'secret ls': () => ({ status: 1, stdout: '', stderr: 'permission denied' }) } } });
  await assert.rejects(provisionRelease(badList.ctx(), badList.config, { release: releaseOf(badList), execute: true }), (error) => error.code === 'STACK_PROVISION_FAILED' && error.message.includes('permission denied'));
  const noDocker = app({ overrides: { docker: { 'config ls': () => ({ status: null, stdout: '', stderr: '', error: new Error('no docker') }) } } });
  await assert.rejects(provisionRelease(noDocker.ctx(), noDocker.config, { release: releaseOf(noDocker), execute: true }), (error) => error.message.includes('no docker'));
});

test('a config whose file has CRLF line endings is created with LF; a binary config is created byte for byte', async () => {
  const crlf = String.fromCharCode(13, 10);
  const made = app();
  fs.writeFileSync(path.join(made.config.envDir, 'infra/swarm/routes.yml'), `routes: []${crlf}more: 1${crlf}`);
  const release = releaseOf(made);
  await provisionRelease(made.ctx(), made.config, { release, execute: true });
  assert.equal(Buffer.from(made.host.state.configs.get(release.configs[0].name).value).toString('utf8'), 'routes: []\nmore: 1\n');
  const binary = Buffer.from([0, 13, 10, 7]);
  const other = app();
  fs.writeFileSync(path.join(other.config.envDir, 'infra/swarm/routes.yml'), binary);
  const again = releaseOf(other);
  await provisionRelease(other.ctx(), other.config, { release: again, execute: true });
  assert.deepEqual(Buffer.from(other.host.state.configs.get(again.configs[0].name).value), binary);
});
