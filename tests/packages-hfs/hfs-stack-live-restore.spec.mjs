import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { prepareHost, doctorHost } from '../../packages/hfs/stack/prepare.mjs';
import { fakeHost } from '../helpers/stack-fakes.mjs';
import { fakeRunner, healthyTable, makeApp } from '../helpers/stack-fakes-C.mjs';

const app = makeApp();
after(() => app.cleanup());
const { config } = app;
const DAEMON = '{"log-driver":"json-file","live-restore":true}';
const ok = (stdout = '') => ({ status: 0, stdout, stderr: '' });
const NL = String.fromCharCode(10);

/** A manager with live-restore on, three running containers (two with a restart policy) and a daemon.json served by sudo. */
function setup({ dockerDown = false, daemon = DAEMON, comeBack = true, failStep = null, readFails = false } = {}) {
  const state = { restarted: false, written: null, polls: 0 };
  const containers = { api: 'always', worker: 'unless-stopped', tool: 'no' };
  const docker = {
    'info --format': (args, call, host) => {
      const format = args[args.indexOf('--format') + 1];
      if (format === '{{.LiveRestoreEnabled}}') return ok(`${host.state.liveRestore}${NL}`);
      if (format === '{{.ServerVersion}}') {
        state.polls += 1;
        return dockerDown && state.polls === 1 ? { status: 1, stdout: '', stderr: 'down' } : ok(`29.8.2${NL}`);
      }
      return ok(`${host.state.swarm.state} ${host.state.swarm.manager}${NL}`);
    },
    ps: () => ok(`${Object.keys(containers).join(NL)}${NL}`),
    inspect: (args) => {
      const format = args[args.indexOf('--format') + 1];
      const name = args.at(-1);
      if (format === '{{.HostConfig.RestartPolicy.Name}}') return ok(`${containers[name]}${NL}`);
      if (comeBack === 'none') return ok(`false${NL}`);
      return ok(`${comeBack || name !== 'worker' ? 'true' : 'false'}${NL}`);
    },
  };
  const host = fakeHost({ overrides: { docker } });
  host.state.liveRestore = true;
  for (const volume of config.volumes) host.state.volumes.add(volume);
  const table = {
    'sudo -n cat': () => (readFails ? { status: 1, stdout: '', stderr: 'denied' } : ok(daemon)),
    'sudo -n cp': () => (failStep === 'cp' ? { status: 1, stdout: '', stderr: 'no space' } : ok()),
    'sudo -n tee': () => ok(),
    'sudo -n systemctl': () => { host.state.liveRestore = false; return ok(); },
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
  assert.ok(result.lines.some((line) => line.startsWith('dry run: would back up daemon.json')));
  assert.equal(sudoCalls(run).length, 0);
});

test('--execute without --owner-approved is refused with exit 3 before anything changes', async () => {
  const { ctx, deps, run } = setup();
  await assert.rejects(prepareHost(ctx, config, { execute: true, fixLiveRestore: true }, deps), (error) => error.code === 'STACK_LIVE_RESTORE_UNAPPROVED' && error.exit === 3);
  assert.equal(sudoCalls(run).length, 0);
});

test('the approved fix backs up daemon.json, sets live-restore false, keeps other keys, restarts docker and lists the containers that came back', async () => {
  const { ctx, deps, run, state } = setup();
  const result = await prepareHost(ctx, config, fix, deps);
  const sudo = sudoCalls(run).map((entry) => entry.command);
  assert.ok(sudo[0].startsWith('sudo -n cat'));
  assert.ok(sudo.some((command) => command.startsWith('sudo -n cp -p') && command.includes('daemon.json.bak-')));
  assert.deepEqual(JSON.parse(state.written), { 'log-driver': 'json-file', 'live-restore': false });
  assert.ok(sudo.includes('sudo -n systemctl restart docker'));
  assert.ok(result.lines.some((line) => line.includes('containers with a restart policy back: api, worker')));
  assert.equal(result.data.liveRestore.changed, true);
  assert.deepEqual(result.data.liveRestore.missing, []);
  assert.ok(result.lines.includes('ok    docker live-restore is off'));
});

test('a container that does not come back within the wait is reported and fails the result', async () => {
  const { ctx, deps } = setup({ comeBack: false });
  const result = await prepareHost(ctx, config, fix, deps);
  assert.equal(result.ok, false);
  assert.ok(result.lines.some((line) => line.startsWith('FAIL  containers not back after 180 s: worker')));
  assert.deepEqual(result.data.liveRestore.back, ['api']);
});

test('the wait polls while docker itself is still down', async () => {
  const { ctx, deps, state } = setup({ dockerDown: true });
  const result = await prepareHost(ctx, config, fix, deps);
  assert.equal(result.data.liveRestore.changed, true);
  assert.ok(state.polls >= 2);
});

test('an already disabled live-restore is a no-op', async () => {
  const { ctx, deps, host, run } = setup();
  host.state.liveRestore = false;
  const result = await prepareHost(ctx, config, fix, deps);
  assert.ok(result.lines.includes('docker live-restore is already off: nothing to change'));
  assert.equal(sudoCalls(run).length, 0);
});

test('an unreadable or invalid daemon.json and a failing step stop the fix with a clear line', async () => {
  const unreadable = setup({ readFails: true });
  assert.ok((await prepareHost(unreadable.ctx, config, fix, unreadable.deps)).lines.some((line) => line.startsWith('FAIL  cannot read /etc/docker/daemon.json: denied')));
  const invalid = setup({ daemon: '{not json' });
  assert.ok((await prepareHost(invalid.ctx, config, fix, invalid.deps)).lines.some((line) => line.includes('is not valid JSON')));
  const noSpace = setup({ failStep: 'cp' });
  assert.ok((await prepareHost(noSpace.ctx, config, fix, noSpace.deps)).lines.some((line) => line.startsWith('FAIL  live-restore fix stopped at "sudo -n cp -p') && line.includes('no space')));
  const empty = setup({ daemon: '' });
  await prepareHost(empty.ctx, config, fix, empty.deps);
  assert.deepEqual(JSON.parse(empty.state.written), { 'live-restore': false });
});

test('when nothing comes back the line says none', async () => {
  const { ctx, deps } = setup({ comeBack: 'none' });
  const result = await prepareHost(ctx, config, fix, deps);
  assert.ok(result.lines.includes('containers with a restart policy back: none'));
  assert.deepEqual(result.data.liveRestore.back, []);
});
