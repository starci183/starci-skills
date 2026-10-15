import test from 'node:test';
import assert from 'node:assert/strict';
import { convergeStack } from '../../packages/hfs/stack/converge.mjs';
import { fakeHost } from '../helpers/stack-fakes.mjs';
import { globalInspect, seedService, testConfig } from '../helpers/stack-fakes-B.mjs';

const config = testConfig();
const bad = (stderr) => ({ status: 1, stdout: '', stderr });

/** A host whose clock is the deploy start; `since` is one minute earlier. */
function setup(overrides) {
  const host = fakeHost({ overrides });
  const since = new Date(host.state.time - 60_000).toISOString();
  return { host, since, ctx: host.ctx() };
}

test('converges on the second agreeing observation, waiting 5 s between them', async () => {
  const { host, since, ctx } = setup();
  seedService(host, 'app_api', { replicas: 2 });
  seedService(host, 'app_web', { replicas: 1 });
  const start = host.state.time;
  const result = await convergeStack(ctx, config, { since });
  assert.equal(result.ok, true);
  assert.equal(host.state.time - start, 5000);
  assert.deepEqual(result.data, { services: ['app_api', 'app_web'], failed: [], pending: [] });
  assert.match(result.lines[0], /converge: app_api, app_web: desired replicas running, no failed task/u);
  const listing = host.calls.find((call) => call.args[0] === 'service' && call.args[1] === 'ls');
  assert.deepEqual(listing.args.slice(2), ['--filter', 'label=com.docker.stack.namespace=app', '--format', '{{.Name}}']);
});

test('a missing or malformed --since is refused', async () => {
  const { ctx } = setup();
  await assert.rejects(convergeStack(ctx, config), { code: 'STACK_CONVERGE_SINCE' });
  await assert.rejects(convergeStack(ctx, config, { since: 'yesterday' }), { code: 'STACK_CONVERGE_SINCE' });
});

test('an empty stack times out without real waiting and says so', async () => {
  const { host, since, ctx } = setup();
  const start = host.state.time;
  const result = await convergeStack(ctx, config, { since, timeoutSeconds: 12 });
  assert.equal(result.ok, false);
  assert.deepEqual(result.lines, ['converge: TIMEOUT', '  no service of stack app yet']);
  assert.ok(host.state.time - start >= 12_000);
});

test('fewer running replicas than desired is a timeout naming the service', async () => {
  const { host, since, ctx } = setup();
  seedService(host, 'app_api', { replicas: 2, running: 1 });
  const result = await convergeStack(ctx, config, { since, timeoutSeconds: 20 });
  assert.equal(result.ok, false);
  assert.deepEqual(result.data.pending, ['app_api: 1/2 running']);
  assert.deepEqual(result.lines, ['converge: TIMEOUT', '  app_api: 1/2 running']);
});

test('a service without tasks counts zero running', async () => {
  const { host, since, ctx } = setup();
  seedService(host, 'app_api', { replicas: 1, running: 0 });
  const result = await convergeStack(ctx, config, { since, timeoutSeconds: 6 });
  assert.deepEqual(result.data.pending, ['app_api: 0/1 running']);
});

test('a global service wants one running task', async () => {
  const { host, since, ctx } = setup({ docker: { 'service inspect': globalInspect } });
  seedService(host, 'app_agent', { replicas: 1 });
  assert.equal((await convergeStack(ctx, config, { since })).ok, true);
});

test('a rolled back update since the deploy began fails at once with its message', async () => {
  const { host, since, ctx } = setup();
  seedService(host, 'app_api', { update: { State: 'rollback_started', StartedAt: new Date(host.state.time).toISOString(), Message: 'update rolled back due to failure' } });
  const start = host.state.time;
  const result = await convergeStack(ctx, config, { since });
  assert.equal(result.ok, false);
  assert.equal(host.state.time, start);
  assert.deepEqual(result.lines, ['converge: FAILED', '  app_api: update rollback_started: update rolled back due to failure']);
  assert.deepEqual(result.data.failed, ['app_api: update rollback_started: update rolled back due to failure']);
});

test('a paused update without a message fails too', async () => {
  const { host, since, ctx } = setup();
  seedService(host, 'app_api', { update: { State: 'paused', StartedAt: new Date(host.state.time).toISOString() } });
  const result = await convergeStack(ctx, config, { since });
  assert.deepEqual(result.data.failed, ['app_api: update paused: ']);
});

test('an update that is still running is pending, an older or undated one is ignored', async () => {
  const { host, since, ctx } = setup();
  seedService(host, 'app_api', { update: { State: 'updating', StartedAt: new Date(host.state.time).toISOString() } });
  const running = await convergeStack(ctx, config, { since, timeoutSeconds: 6 });
  assert.deepEqual(running.data.pending, ['app_api: update in progress']);
  seedService(host, 'app_api', { update: { State: 'rollback_completed', StartedAt: new Date(host.state.time - 3_600_000).toISOString() } });
  assert.equal((await convergeStack(ctx, config, { since })).ok, true);
  seedService(host, 'app_api', { update: { State: 'rollback_completed' } });
  assert.equal((await convergeStack(ctx, config, { since })).ok, true);
});

test('a task that failed or was rejected since the deploy began fails the convergence with the Swarm error text', async () => {
  const { host, since, ctx } = setup();
  const now = new Date(host.state.time).toISOString();
  seedService(host, 'app_api', { tasks: [{ state: 'failed', timestamp: now, error: 'task: non-zero exit (1) | out of memory' }] });
  seedService(host, 'app_web', { tasks: [{ state: 'rejected', timestamp: now, error: 'no suitable node' }] });
  const result = await convergeStack(ctx, config, { since });
  assert.equal(result.ok, false);
  assert.deepEqual(result.data.failed, ['app_api: task failed: task: non-zero exit (1) | out of memory', 'app_web: task rejected: no suitable node']);
  assert.equal(result.lines[0], 'converge: FAILED');
});

test('a task that failed before the deploy began, or is merely shut down, is history', async () => {
  const { host, since, ctx } = setup();
  const old = new Date(host.state.time - 3_600_000).toISOString();
  seedService(host, 'app_api', { tasks: [{ state: 'failed', timestamp: old, error: 'old failure' }, { state: 'shutdown', timestamp: new Date(host.state.time).toISOString() }] });
  const result = await convergeStack(ctx, config, { since });
  assert.equal(result.ok, true);
});

test('a docker error inside an observation is a pending line, and the next observation can still converge', async () => {
  let failures = 2;
  const { host, since, ctx } = setup({ docker: { 'service ls': (args, call, h) => {
    if (failures > 0) { failures -= 1; return bad('Cannot connect to the Docker daemon'); }
    return { status: 0, stdout: [...h.state.services.keys()].map((name) => `${name}\n`).join(''), stderr: '' };
  } } });
  seedService(host, 'app_api');
  const result = await convergeStack(ctx, config, { since });
  assert.equal(result.ok, true);
  assert.equal(failures, 0);
});

test('a docker error that never clears times out and reports the error line, keeping the services seen so far', async () => {
  let calls = 0;
  const { host, since, ctx } = setup({ docker: { 'service inspect': (args) => {
    calls += 1;
    return calls === 1 ? { status: 0, stdout: JSON.stringify({ Name: args[2], Spec: { Mode: { Replicated: { Replicas: 1 } } } }), stderr: '' } : bad('daemon unreachable');
  } } });
  seedService(host, 'app_api');
  const result = await convergeStack(ctx, config, { since, timeoutSeconds: 15 });
  assert.equal(result.ok, false);
  assert.deepEqual(result.data.services, ['app_api']);
  assert.match(result.data.pending[0], /docker service inspect: daemon unreachable/u);
});

test('a zero timeout never observes', async () => {
  const { since, ctx } = setup();
  const result = await convergeStack(ctx, config, { since, timeoutSeconds: 0 });
  assert.deepEqual(result.lines, ['converge: TIMEOUT', '  not observed']);
});
