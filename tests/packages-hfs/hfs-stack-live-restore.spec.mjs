import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { prepareHost, doctorHost } from '../../packages/hfs/stack/prepare.mjs';
import { startOrder, snapshotContainers } from '../../packages/hfs/stack/live-restore.mjs';
import { fakeHost } from '../helpers/stack-fakes.mjs';
import { fakeRunner, healthyTable, makeApp } from '../helpers/stack-remote-fakes.mjs';

const app = makeApp();
after(() => app.cleanup());
const baseConfig = app.config;
const NL = String.fromCharCode(10);
const ok = (stdout = '') => ({ status: 0, stdout, stderr: '' });
const fail = (stderr) => ({ status: 1, stdout: '', stderr });
const DAEMON = '{"log-driver":"json-file","live-restore":true}';

const INGRESS = {
  verify: [{ host: 'app.example', path: '/health', status: 200 }],
  upstreams: [{ hosts: ['app.example', 'api.example', 'gone.example', 'old.example'] }],
  drop: ['old.example'],
};
const config = { ...baseConfig, ingress: INGRESS };

/** The containers of a small compose project plus an edge proxy; `label` is the inspect line of each. */
const CONTAINERS = [
  { name: 'shop-edge-1', project: 'edge', service: 'proxy', depends: '', restart: 'unless-stopped', image: 'traefik:v3' },
  { name: 'shop-web-1', project: 'shop', service: 'web', depends: 'api:service_started:false', restart: 'unless-stopped', image: 'shop/web' },
  { name: 'shop-api-1', project: 'shop', service: 'api', depends: 'db:service_healthy:true,cache:service_started:false', restart: 'unless-stopped', image: 'shop/api' },
  { name: 'shop-cache-1', project: 'shop', service: 'cache', depends: '', restart: 'unless-stopped', image: 'redis:7' },
  { name: 'shop-db-1', project: 'shop', service: 'db', depends: '', restart: 'unless-stopped', image: 'postgres:16' },
  { name: 'tool', project: '', service: '', depends: '', restart: 'no', image: 'alpine' },
];

/** A manager whose docker restart stops every container; `autoBack` lists those the restart policy starts again, `stuck` those that cannot start. */
function setup({ autoBack = [], stuck = [], daemon = DAEMON, readFails = false, failStep = null, dockerDown = false, hostAfter = 200, hostBefore = 200 } = {}) {
  const state = { running: new Set(CONTAINERS.map((item) => item.name)), written: null, polls: 0, started: [], restarted: false, hostAfter, hostBefore };
  const byName = new Map(CONTAINERS.map((item) => [item.name, item]));
  const docker = {
    'info --format': (args, call, host) => {
      const format = args[args.indexOf('--format') + 1];
      if (format === '{{.LiveRestoreEnabled}}') return ok(`${host.state.liveRestore}${NL}`);
      if (format === '{{.ServerVersion}}') {
        state.polls += 1;
        return dockerDown && state.restarted && state.polls < 3 ? fail('down') : ok(`29.8.2${NL}`);
      }
      if (format === '{{.OSType}}/{{.Architecture}}') return ok(`${host.state.platform}${NL}`);
      return ok(`${host.state.swarm.state} ${host.state.swarm.manager}${NL}`);
    },
    ps: () => ok(`${[...state.running].join(NL)}${NL}`),
    inspect: (args) => {
      const format = args[args.indexOf('--format') + 1];
      const name = args.at(-1);
      if (format === '{{.State.Running}}') return ok(`${state.running.has(name)}${NL}`);
      const item = byName.get(name);
      return ok(`/${item.name}|${item.project}|${item.service}|${item.depends}|${item.restart}|${item.image}${NL}`);
    },
    start: (args) => {
      const name = args.at(-1);
      if (stuck.includes(name)) return fail(`cannot start ${name}`);
      state.running.add(name);
      state.started.push(name);
      return ok(`${name}${NL}`);
    },
  };
  const host = fakeHost({ overrides: { docker } });
  host.state.liveRestore = true;
  for (const volume of baseConfig.volumes) host.state.volumes.add(volume);
  const table = {
    'sudo -n cat': () => (readFails ? fail('denied') : ok(daemon)),
    'sudo -n cp': () => (failStep === 'cp' ? fail('no space') : ok()),
    'sudo -n tee': () => ok(),
    'sudo -n systemctl': () => {
      state.restarted = true;
      state.polls = 0;
      host.state.liveRestore = false;
      state.running = new Set(autoBack);
      return ok();
    },
    curl: () => ok(String(state.restarted ? state.hostAfter : state.hostBefore)),
    ...healthyTable(),
  };
  const inner = fakeRunner(host, table);
  const run = (command, options) => {
    if (command.startsWith('sudo -n tee') && options?.input) state.written = options.input;
    return inner(command, options);
  };
  run.commands = inner.commands;
  return { host, run, state, ctx: host.ctx({ env: {} }), deps: { ssh: run } };
}

const fix = { execute: true, fixLiveRestore: true, ownerApproved: true };
const sudoCalls = (run) => run.commands.filter((entry) => entry.command.startsWith('sudo'));

test('doctor reports live-restore as a failing check, with the command that fixes it', async () => {
  const { ctx, deps } = setup();
  const result = await doctorHost(ctx, config, {}, deps);
  assert.equal(result.ok, false);
  assert.ok(result.lines.some((line) => line.startsWith('FAIL  docker live-restore is enabled') && line.includes('--fix-live-restore --owner-approved --execute')));
});

test('without --execute the fix is only announced, and nothing is written or restarted', async () => {
  const { ctx, deps, run } = setup();
  const result = await prepareHost(ctx, config, { fixLiveRestore: true }, deps);
  assert.ok(result.lines.some((line) => line.startsWith('dry run: would snapshot the running containers')));
  assert.equal(sudoCalls(run).length, 0);
});

test('--execute without --owner-approved is refused with exit 3 before anything changes', async () => {
  const { ctx, deps, run } = setup();
  await assert.rejects(prepareHost(ctx, config, { execute: true, fixLiveRestore: true }, deps), (error) => error.code === 'STACK_LIVE_RESTORE_UNAPPROVED' && error.exit === 3);
  assert.equal(sudoCalls(run).length, 0);
});

test('after the restart every snapshotted container is started in order: databases, then applications, the edge last', async () => {
  const { ctx, deps, run, state } = setup();
  const result = await prepareHost(ctx, config, fix, deps);
  const sudo = sudoCalls(run).map((entry) => entry.command);
  assert.ok(sudo.some((command) => command.startsWith('sudo -n cp -p') && command.includes('daemon.json.bak-')));
  assert.deepEqual(JSON.parse(state.written), { 'log-driver': 'json-file', 'live-restore': false });
  assert.ok(sudo.includes('sudo -n systemctl restart docker'));
  const position = (name) => state.started.indexOf(name);
  assert.ok(position('shop-db-1') < position('shop-api-1') && position('shop-cache-1') < position('shop-api-1'), 'compose dependencies first');
  assert.ok(position('shop-api-1') < position('shop-web-1'), 'api before web');
  assert.ok(Math.max(position('shop-web-1'), position('tool')) < position('shop-edge-1'), 'edge proxy last');
  assert.ok(Math.max(position('shop-db-1'), position('shop-cache-1')) < Math.min(position('shop-api-1'), position('shop-web-1'), position('tool')), 'infrastructure before applications');
  assert.equal(result.ok, true);
  assert.equal(result.data.liveRestore.changed, true);
  assert.deepEqual(result.data.liveRestore.missing, []);
  assert.ok(result.lines.includes('snapshot: 6 running container(s), 3 public host(s) in the baseline'));
  assert.ok(result.lines.includes('ok    all 3 public host(s) answer as before the restart'));
});

test('containers the restart policy brought back are not started twice', async () => {
  const { ctx, deps, state } = setup({ autoBack: ['shop-db-1', 'shop-cache-1', 'shop-api-1', 'shop-web-1', 'tool', 'shop-edge-1'] });
  const result = await prepareHost(ctx, config, fix, deps);
  assert.deepEqual(state.started, []);
  assert.equal(result.ok, true);
});

test('a container that cannot start fails the result and is named loudly', async () => {
  const { ctx, deps } = setup({ stuck: ['shop-web-1'] });
  const result = await prepareHost(ctx, config, fix, deps);
  assert.equal(result.ok, false);
  assert.ok(result.lines.some((line) => line.startsWith('FAIL  cannot start shop-web-1')));
  assert.ok(result.lines.some((line) => line.startsWith('FAIL  CONTAINERS STILL DOWN after the restart: shop-web-1')));
  assert.deepEqual(result.data.liveRestore.missing, ['shop-web-1']);
});

test('a public host that answers differently from the baseline fails the result', async () => {
  const { ctx, deps } = setup({ hostAfter: 502 });
  const result = await prepareHost(ctx, config, fix, deps);
  assert.equal(result.ok, false);
  assert.ok(result.lines.some((line) => line.startsWith('FAIL  PUBLIC HOSTS STILL DOWN against the pre-restart baseline: app.example, api.example, gone.example')));
  assert.deepEqual(result.data.liveRestore.hostsDown, ['app.example', 'api.example', 'gone.example']);
});

test('a host that was already down before the restart is not blamed on it', async () => {
  const { ctx, deps } = setup({ hostBefore: 502, hostAfter: 502 });
  const result = await prepareHost(ctx, config, fix, deps);
  assert.equal(result.ok, true);
});

test('the wait polls while docker itself is still down', async () => {
  const { ctx, deps, state } = setup({ dockerDown: true });
  const result = await prepareHost(ctx, config, fix, deps);
  assert.equal(result.data.liveRestore.changed, true);
  assert.ok(state.polls >= 3);
});

test('without a declared ingress there is no host baseline, and the containers are still recovered', async () => {
  const { ctx, deps, state } = setup();
  const result = await prepareHost(ctx, baseConfig, fix, deps);
  assert.equal(state.started.length, 6);
  assert.ok(result.lines.includes('snapshot: 6 running container(s), 0 public host(s) in the baseline'));
  assert.ok(!result.lines.some((line) => line.includes('answer as before')));
});

test('an already disabled live-restore is a no-op', async () => {
  const { ctx, deps, host, run } = setup();
  host.state.liveRestore = false;
  const result = await prepareHost(ctx, config, fix, deps);
  assert.ok(result.lines.includes('docker live-restore is already off: nothing to change'));
  assert.equal(sudoCalls(run).length, 0);
});

test('an unreadable or invalid daemon.json and a failing step stop the fix before the restart', async () => {
  const unreadable = setup({ readFails: true });
  assert.ok((await prepareHost(unreadable.ctx, config, fix, unreadable.deps)).lines.some((line) => line.startsWith('FAIL  cannot read /etc/docker/daemon.json: denied')));
  const invalid = setup({ daemon: '{not json' });
  assert.ok((await prepareHost(invalid.ctx, config, fix, invalid.deps)).lines.some((line) => line.includes('is not valid JSON')));
  const noSpace = setup({ failStep: 'cp' });
  const result = await prepareHost(noSpace.ctx, config, fix, noSpace.deps);
  assert.ok(result.lines.some((line) => line.startsWith('FAIL  live-restore fix stopped at "sudo -n cp -p') && line.includes('no space')));
  assert.equal(noSpace.state.restarted, false);
  const empty = setup({ daemon: '' });
  await prepareHost(empty.ctx, config, fix, empty.deps);
  assert.deepEqual(JSON.parse(empty.state.written), { 'live-restore': false });
});

test('startOrder keeps compose dependencies inside a group and survives a dependency cycle and an unknown dependency', () => {
  const entry = (name, service, depends, image = 'app') => ({ name, project: 'p', service, depends, restart: '', image });
  const cycle = startOrder([entry('a', 'a', ['b']), entry('b', 'b', ['a']), entry('c', 'c', ['missing'])]);
  assert.deepEqual(cycle.map((item) => item.name).sort(), ['a', 'b', 'c']);
  const chain = startOrder([entry('web', 'web', ['api']), entry('api', 'api', [])]);
  assert.deepEqual(chain.map((item) => item.name), ['api', 'web']);
});

test('snapshotContainers reads name, project, service, dependencies, restart policy and image', () => {
  const { run } = setup();
  const snapshot = snapshotContainers(run);
  const api = snapshot.find((item) => item.name === 'shop-api-1');
  assert.deepEqual(api, { name: 'shop-api-1', project: 'shop', service: 'api', depends: ['db', 'cache'], restart: 'unless-stopped', image: 'shop/api' });
  assert.deepEqual(snapshot.find((item) => item.name === 'tool').depends, []);
});

test('a snapshot line with missing fields still yields a container; when nothing comes back the report says none', async () => {
  const solo = (command) => (command.includes("'ps'") ? ok('solo' + NL) : ok('/solo' + NL));
  assert.deepEqual(snapshotContainers(solo), [{ name: 'solo', project: '', service: '', depends: [], restart: '', image: '' }]);
  const { ctx, deps } = setup({ stuck: CONTAINERS.map((item) => item.name) });
  const result = await prepareHost(ctx, config, fix, deps);
  assert.ok(result.lines.includes('containers back (0 of 6): none'));
  assert.equal(result.ok, false);
});
