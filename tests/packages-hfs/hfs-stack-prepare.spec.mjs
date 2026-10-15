import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { doctorHost, prepareHost } from '../../packages/hfs/stack/prepare.mjs';
import { fakeHost } from '../helpers/stack-fakes.mjs';
import { fakeRunner, healthyTable, makeApp } from '../helpers/stack-remote-fakes.mjs';

const app = makeApp();
after(() => app.cleanup());
const { config } = app;

const bad = (stderr = 'boom') => ({ status: 1, stdout: '', stderr });

/** A fake manager with both volumes present, plus the runner and a context that never touches the real tools. */
function setup({ table = healthyTable(), docker = {}, env = {}, volumes = true } = {}) {
  const host = fakeHost({ overrides: { docker } });
  if (volumes) for (const volume of config.volumes) host.state.volumes.add(volume);
  const run = fakeRunner(host, table);
  return { host, run, deps: { ssh: run }, ctx: host.ctx({ env }) };
}

const dockerCalls = (run, word) => run.commands.filter((entry) => entry.command.startsWith('docker') && entry.command.includes(`'${word}'`));
const marked = (result, mark) => result.lines.filter((line) => line.startsWith(mark));

test('prepare on a healthy manager passes every check and changes nothing', async () => {
  const { ctx, deps, run } = setup();
  const result = await prepareHost(ctx, config, undefined, deps);
  assert.equal(result.ok, true);
  assert.deepEqual(marked(result, 'FAIL'), []);
  for (const text of ['docker daemon reachable (29.8.2)', 'linux/x86_64', 'swarm active, this node is a manager', 'single-manager swarm', 'volume shop-data', 'volume shop-cache',
    'disk: 50 GB free under /var/lib/docker', 'releases directory /srv/shop is writable']) assert.ok(result.lines.includes(`ok    ${text}`), text);
  assert.deepEqual(result.data.created, []);
  assert.equal(result.data.swarmInitialized, false);
  assert.equal(result.data.checks.every((check) => check.ok), true);
  assert.equal(dockerCalls(run, 'create').length + dockerCalls(run, 'init').length, 0);
});

test('prepare with every option given still only reads on a healthy manager', async () => {
  const { ctx, deps } = setup();
  const result = await prepareHost(ctx, config, { execute: true, initSwarm: false, sshCmd: null }, deps);
  assert.equal(result.ok, true);
});

test('prepare reports an unreachable daemon and runs no effect even with execute and init approved', async () => {
  const { ctx, deps, run, host } = setup({ docker: { 'info --format': () => bad('Cannot connect') }, env: { STARCI_SWARM_INIT_APPROVED: '1' }, volumes: false });
  const result = await prepareHost(ctx, config, { execute: true, initSwarm: true }, deps);
  assert.equal(result.ok, false);
  assert.deepEqual(result.lines, ['FAIL  docker daemon not reachable']);
  assert.equal(dockerCalls(run, 'create').length + dockerCalls(run, 'init').length, 0);
  assert.equal(host.state.inits.length, 0);
});

test('prepare flags an unsupported platform, a swarm that is not active and several nodes, and still runs every check', async () => {
  const { ctx, deps, host } = setup();
  host.state.platform = 'linux/aarch64';
  host.state.swarm = { state: 'inactive', manager: false };
  host.state.nodes = 3;
  const result = await prepareHost(ctx, config, {}, deps);
  assert.equal(result.ok, false);
  assert.ok(result.lines.includes('FAIL  unsupported platform linux/aarch64'));
  assert.ok(result.lines.some((line) => line.startsWith("FAIL  swarm is 'inactive' (manager: false)")));
  assert.ok(result.lines.includes('ok    swarm has 3 nodes: review quorum and placement before relying on it'));
  assert.ok(result.lines.includes('ok    releases directory /srv/shop is writable'));
});

test('prepare in a dry run lists the missing volumes and creates nothing', async () => {
  const { ctx, deps, run, host } = setup({ volumes: false });
  const result = await prepareHost(ctx, config, { execute: false }, deps);
  assert.equal(result.ok, false);
  assert.deepEqual(marked(result, 'dry run'), ['dry run: would create volume shop-data', 'dry run: would create volume shop-cache']);
  assert.ok(result.lines.includes('FAIL  volume shop-data missing (prepare creates it)'));
  assert.equal(dockerCalls(run, 'create').length, 0);
  assert.equal(host.state.volumes.size, 0);
});

test('prepare --execute creates only the missing external volumes', async () => {
  const { ctx, deps, host } = setup({ volumes: false });
  host.state.volumes.add('shop-cache');
  const result = await prepareHost(ctx, config, { execute: true }, deps);
  assert.equal(result.ok, true);
  assert.deepEqual(result.data.created, ['shop-data']);
  assert.ok(result.lines.includes('created volume shop-data'));
  assert.ok(result.lines.includes('ok    volume shop-data'));
  assert.deepEqual([...host.state.volumes].sort((a, b) => a.localeCompare(b)), ['shop-cache', 'shop-data']);
});

test('prepare reports a volume the daemon refused to create', async () => {
  const { ctx, deps } = setup({ volumes: false, docker: { 'volume create': () => bad('permission denied') } });
  const result = await prepareHost(ctx, config, { execute: true }, deps);
  assert.equal(result.ok, false);
  assert.ok(result.lines.includes('FAIL  cannot create volume shop-data: permission denied'));
  assert.deepEqual(result.data.created, []);
});

test('prepare fails on low or unreadable disk space', async () => {
  const low = await prepareHost(setup().ctx, config, {}, setup({ table: healthyTable({ freeKb: 5 * 1_048_576 }) }).deps);
  assert.equal(low.ok, false);
  assert.ok(low.lines.includes('FAIL  disk: only 5 GB free under /var/lib/docker'));
  const tables = [{ ...healthyTable(), 'df -Pk': () => bad('df: error') }, { ...healthyTable(), 'df -Pk': () => ({ status: 0, stdout: '/\nFilesystem only\n', stderr: '' }) }];
  const results = await Promise.all(tables.map((table) => prepareHost(setup().ctx, config, {}, setup({ table }).deps)));
  for (const result of results) assert.ok(result.lines.includes('FAIL  disk: cannot read the free space'));
});

test('prepare checks the releases directory exists and is writable by the deploy user', async () => {
  const missing = await prepareHost(setup().ctx, config, {}, setup({ table: healthyTable({ directory: 'missing' }) }).deps);
  assert.ok(missing.lines.includes('FAIL  releases directory /srv/shop is missing (create it once, owned by the deploy user)'));
  const readonly = await prepareHost(setup().ctx, config, {}, setup({ table: healthyTable({ directory: 'readonly' }) }).deps);
  assert.ok(readonly.lines.includes('FAIL  releases directory /srv/shop is not writable by the deploy user'));
  assert.equal(readonly.ok, false);
});

test('the releases directory defaults to /srv/<stack> and honours releasesBase', async () => {
  const seen = [];
  const table = { ...healthyTable(), 'elif [ ! -w': (command) => { seen.push(command); return { status: 0, stdout: 'writable\n', stderr: '' }; } };
  const { ctx, deps } = setup({ table });
  const plain = { ...config, remote: { ...config.remote, releasesBase: null } };
  const custom = { ...config, remote: { ...config.remote, releasesBase: '/opt/releases' } };
  assert.ok((await prepareHost(ctx, plain, {}, deps)).lines.includes('ok    releases directory /srv/shop is writable'));
  assert.ok((await prepareHost(ctx, custom, {}, deps)).lines.includes('ok    releases directory /opt/releases is writable'));
  assert.ok(seen[0].includes("'/srv/shop'") && seen[1].includes("'/opt/releases'"));
});

test('swarm init without the owner approval is refused with exit 3 before anything runs', async () => {
  const { ctx, deps, run, host } = setup();
  host.state.swarm = { state: 'inactive', manager: false };
  await assert.rejects(prepareHost(ctx, config, { execute: true, initSwarm: true }, deps), (error) => error.code === 'STACK_SWARM_INIT_UNAPPROVED' && error.exit === 3);
  await assert.rejects(prepareHost(setup({ env: { STARCI_SWARM_INIT_APPROVED: 'yes' } }).ctx, config, { execute: true, initSwarm: true }, deps), (error) => error.exit === 3);
  assert.equal(run.commands.length, 0);
  assert.equal(host.state.inits.length, 0);
});

test('swarm init runs once, with the approval, on an inactive swarm', async () => {
  const { ctx, deps, host } = setup({ env: { STARCI_SWARM_INIT_APPROVED: '1' } });
  host.state.swarm = { state: 'inactive', manager: false };
  const result = await prepareHost(ctx, config, { execute: true, initSwarm: true }, deps);
  assert.equal(result.ok, true);
  assert.equal(result.data.swarmInitialized, true);
  assert.deepEqual(host.state.inits, [[]]);
  assert.ok(result.lines.some((line) => line.startsWith('SWARM INITIALIZED.')));
  assert.ok(result.lines.includes('ok    swarm active, this node is a manager'));
});

test('swarm init passes a valid advertise address and refuses a malformed one', async () => {
  const env = { STARCI_SWARM_INIT_APPROVED: '1', STARCI_ADVERTISE_ADDR: '10.0.0.5:2377' };
  const { ctx, deps, host } = setup({ env });
  host.state.swarm = { state: 'inactive', manager: false };
  await prepareHost(ctx, config, { execute: true, initSwarm: true }, deps);
  assert.deepEqual(host.state.inits, [['--advertise-addr', '10.0.0.5:2377', '--listen-addr', '127.0.0.1:2377']]);
  const hostile = setup({ env: { ...env, STARCI_ADVERTISE_ADDR: '10.0.0.5; rm -rf /' } });
  await assert.rejects(prepareHost(hostile.ctx, config, { execute: true, initSwarm: true }, hostile.deps), (error) => error.code === 'STACK_SWARM_ADVERTISE_ADDR' && error.exit === 2);
  assert.equal(hostile.run.commands.length, 0);
});

test('an active swarm is never re-initialized', async () => {
  const { ctx, deps, host, run } = setup({ env: { STARCI_SWARM_INIT_APPROVED: '1' } });
  const result = await prepareHost(ctx, config, { execute: true, initSwarm: true }, deps);
  assert.ok(result.lines.includes('swarm already active: nothing to initialize (never re-initialized)'));
  assert.equal(result.data.swarmInitialized, false);
  assert.equal(host.state.inits.length, 0);
  assert.equal(dockerCalls(run, 'init').length, 0);
});

test('swarm init in a dry run needs no approval and runs nothing', async () => {
  const { ctx, deps, host, run } = setup();
  host.state.swarm = { state: 'inactive', manager: false };
  const result = await prepareHost(ctx, config, { execute: false, initSwarm: true }, deps);
  assert.ok(result.lines.includes('dry run: would run docker swarm init (needs --execute and --owner-approved)'));
  assert.equal(host.state.inits.length, 0);
  assert.equal(dockerCalls(run, 'init').length, 0);
  assert.equal(result.ok, false);
  const active = await prepareHost(setup().ctx, config, { initSwarm: true }, setup().deps);
  assert.ok(active.lines.includes('swarm already active: nothing to initialize (never re-initialized)'));
});

test('a failing swarm init is reported and the checks still run', async () => {
  const { ctx, deps, host } = setup({ env: { STARCI_SWARM_INIT_APPROVED: '1' }, docker: { 'swarm init': () => bad('init refused\nsecond line') } });
  host.state.swarm = { state: 'inactive', manager: false };
  const result = await prepareHost(ctx, config, { execute: true, initSwarm: true }, deps);
  assert.equal(result.ok, false);
  assert.ok(result.lines.includes('FAIL  docker swarm init failed: init refused'));
  assert.equal(result.data.swarmInitialized, false);
  assert.ok(result.lines.includes('ok    linux/x86_64'));
});

test('notes of the transport are part of the output', async () => {
  const { ctx, run } = setup();
  const noted = Object.assign((command) => run(command), { notes: ['owner session note'] });
  assert.equal((await prepareHost(ctx, config, {}, { ssh: noted })).lines[0], 'owner session note');
  assert.equal((await doctorHost(ctx, config, {}, { ssh: noted })).lines[0], 'owner session note');
});

test('prepare and doctor reach the manager through the ssh alias by default', async () => {
  const sshArgs = [];
  let run;
  const host = fakeHost({ overrides: { ssh: (args) => { sshArgs.push(args); return run(args.at(-1)); } } });
  for (const volume of config.volumes) host.state.volumes.add(volume);
  run = fakeRunner(host, healthyTable());
  const ctx = host.ctx({ env: {} });
  const prepared = await prepareHost(ctx, config);
  const doctored = await doctorHost(ctx, config);
  assert.equal(prepared.ok, true);
  assert.equal(doctored.ok, true);
  assert.ok(sshArgs.length > 10 && sshArgs.every((args) => args.at(-2) === 'vps'));
});

test('doctor lists services, counts managed objects and reads the release pointers', async () => {
  const { ctx, deps, host, run } = setup();
  host.state.services.set('shop_api', {});
  host.state.services.set('shop_web', {});
  host.state.secrets.set('shop-token-v1', { labels: ['shop.managed=true'], value: 'TOPSECRET' });
  host.state.secrets.set('other-token', { labels: [], value: 'TOPSECRET' });
  host.state.configs.set('shop-routes-v1', { labels: ['shop.managed=true'], value: 'x' });
  const result = await doctorHost(ctx, config, undefined, deps);
  assert.equal(result.ok, true);
  for (const text of ['services of stack shop: 2', 'managed secrets: 1, configs: 1', 'release current: 0123456789abcdef', 'release previous: fedcba9876543210']) {
    assert.ok(result.lines.includes(`ok    ${text}`), text);
  }
  assert.ok(result.lines.includes('      shop_api'));
  assert.deepEqual(result.data.releases, { current: '0123456789abcdef', previous: 'fedcba9876543210' });
  assert.equal(result.data.services, 2);
  assert.equal(result.data.secrets, 1);
  assert.equal(result.data.configs, 1);
  const effects = run.commands.filter((entry) => /^docker '(secret|config|volume|swarm|stack)' '(create|rm|init|deploy)'/u.test(entry.command));
  assert.deepEqual(effects, []);
  assert.ok(!JSON.stringify(result).includes('TOPSECRET'));
});

test('doctor shows a missing pointer as none and refuses an unexpected pointer value', async () => {
  const none = await doctorHost(setup().ctx, config, {}, setup({ table: healthyTable({ current: null, previous: null }) }).deps);
  assert.ok(none.lines.includes('ok    release current: none'));
  assert.ok(none.lines.includes('ok    release previous: none'));
  assert.deepEqual(none.data.releases, { current: null, previous: null });
  const odd = await doctorHost(setup().ctx, config, {}, setup({ table: healthyTable({ current: 'not-a-digest' }) }).deps);
  assert.equal(odd.ok, false);
  assert.ok(odd.lines.includes('FAIL  release current names an unexpected value'));
});

test('doctor reports a service listing that fails and stops after an unreachable daemon', async () => {
  const failing = await doctorHost(setup().ctx, config, {}, setup({ docker: { 'service ls': () => bad() } }).deps);
  assert.equal(failing.ok, false);
  assert.ok(failing.lines.includes('FAIL  cannot list the services of stack shop'));
  assert.equal(failing.data.services, 0);
  const down = await doctorHost(setup().ctx, config, {}, setup({ docker: { 'info --format': () => bad() } }).deps);
  assert.deepEqual(down.lines, ['FAIL  docker daemon not reachable']);
  assert.equal(down.ok, false);
  assert.deepEqual(down.data.releases, { current: null, previous: null });
});

test('--owner-approved replaces the approval variable for the one-time swarm init', async () => {
  const { ctx, deps, host } = setup();
  host.state.swarm = { state: 'inactive', manager: false };
  const result = await prepareHost(ctx, config, { execute: true, initSwarm: true, ownerApproved: true }, deps);
  assert.equal(host.state.inits.length, 1);
  assert.equal(result.data.swarmInitialized, true);
});

test('prepare --execute creates the releases directory and installs age with passwordless sudo, once', async () => {
  const table = { 'elif [ ! -w': () => ({ status: 0, stdout: 'missing\n', stderr: '' }), 'command -v age': () => bad('', 1), 'sudo -n mkdir': () => ({ status: 0, stdout: '', stderr: '' }), 'sudo -n apt-get': () => ({ status: 0, stdout: '', stderr: '' }), ...withoutAgeAndDirectory() };
  const { ctx, deps, run } = setup({ table });
  const result = await prepareHost(ctx, config, { execute: true }, deps);
  assert.ok(result.lines.includes('created /srv/shop owned by the deploy user'));
  assert.ok(result.lines.includes('installed age on the manager'));
  assert.ok(run.commands.some((entry) => entry.command.startsWith('sudo -n mkdir -p') && entry.command.includes('chown "$(id -un)"')));
});

test('prepare --execute reports sudo refusals instead of hiding them', async () => {
  const refused = () => bad('sudo: a password is required');
  const table = { 'elif [ ! -w': () => ({ status: 0, stdout: 'missing\n', stderr: '' }), 'command -v age': () => bad('', 1), 'sudo -n mkdir': refused, 'sudo -n apt-get': refused, ...withoutAgeAndDirectory() };
  const { ctx, deps } = setup({ table });
  const result = await prepareHost(ctx, config, { execute: true }, deps);
  assert.equal(result.ok, false);
  assert.ok(result.lines.some((line) => line.startsWith('FAIL  cannot create /srv/shop: sudo: a password is required')));
  assert.ok(result.lines.some((line) => line.startsWith('FAIL  cannot install age: sudo: a password is required')));
});

function withoutAgeAndDirectory() {
  const base = healthyTable();
  delete base['command -v age'];
  delete base['elif [ ! -w'];
  return base;
}

test('the swarm control port listens where STARCI_SWARM_LISTEN_ADDR says, and a hostile value is refused', async () => {
  const env = { STARCI_SWARM_INIT_APPROVED: '1', STARCI_ADVERTISE_ADDR: '10.0.0.5', STARCI_SWARM_LISTEN_ADDR: '0.0.0.0:2377' };
  const { ctx, deps, host } = setup({ env });
  host.state.swarm = { state: 'inactive', manager: false };
  await prepareHost(ctx, config, { execute: true, initSwarm: true }, deps);
  assert.deepEqual(host.state.inits, [['--advertise-addr', '10.0.0.5', '--listen-addr', '0.0.0.0:2377']]);
  const hostile = setup({ env: { ...env, STARCI_SWARM_LISTEN_ADDR: '0.0.0.0; id' } });
  await assert.rejects(prepareHost(hostile.ctx, config, { execute: true, initSwarm: true }, hostile.deps), (error) => error.code === 'STACK_SWARM_LISTEN_ADDR');
});
