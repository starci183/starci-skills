import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyStack } from '../../packages/hfs/stack/verify.mjs';
import { fakeHost } from '../helpers/stack-fakes.mjs';
import { fakeFetch, psRunning, seedService, testConfig } from '../helpers/stack-swarm-fakes.mjs';

const http = (extra) => ({ name: 'live', url: 'https://api.example.test/healthz', method: 'GET', body: null, status: 200, json: null, contains: null, retry: false, ...extra });
const exec = (extra) => ({ name: 'watchdog', service: 'api', command: ['app', 'jobs', 'watchdog'], stdout: null, ...extra });
const withChecks = (checks) => testConfig({ verify: { http: [], exec: [], ...checks } });

function setup(routes = {}) {
  const host = fakeHost({ overrides: { docker: { 'ps -q': psRunning } } });
  const net = fakeFetch(routes);
  return { host, net, ctx: host.ctx({ fetch: net.fetch }) };
}

test('a declared journey passes on status, json fields and contains', async () => {
  const { net, ctx } = setup({ 'https://api.example.test/healthz': { status: 200, body: { status: 'ok', n: 2, nested: { a: [1] } } } });
  const config = withChecks({ http: [http({ json: { status: 'ok', nested: { a: [1] } }, contains: '"n":2' })] });
  const result = await verifyStack(ctx, config);
  assert.equal(result.ok, true);
  assert.deepEqual(result.lines, ['PASS  live  200']);
  assert.deepEqual(result.data, { checks: [{ name: 'live', ok: true }] });
  assert.equal(net.calls[0].init.method, 'GET');
  assert.equal(net.calls[0].init.body, undefined);
  assert.ok(net.calls[0].init.signal instanceof AbortSignal);
});

test('a POST sends only the declared body', async () => {
  const body = '{"query":"{__typename}"}';
  const { net, ctx } = setup({ 'https://api.example.test/graphql': { status: 200, body: { data: { __typename: 'Query' } } } });
  const check = http({ name: 'graphql', url: 'https://api.example.test/graphql', method: 'POST', body, contains: '__typename' });
  const result = await verifyStack(ctx, withChecks({ http: [check] }));
  assert.equal(result.ok, true);
  assert.equal(net.calls[0].init.method, 'POST');
  assert.equal(net.calls[0].init.body, body);
  assert.deepEqual(net.calls[0].init.headers, { 'content-type': 'application/json' });
});

test('a wrong status, json value, non-json body or missing text fails with a reason and without retrying', async () => {
  const start = fakeHost().state.time;
  const answers = {
    'https://h.test/status': { status: 503, body: 'down' },
    'https://h.test/json': { status: 200, body: { status: 'degraded' } },
    'https://h.test/html': { status: 200, body: '<html>' },
    'https://h.test/null': { status: 200, body: 'null' },
    'https://h.test/text': { status: 200, body: { other: 1 } },
  };
  const { host, ctx } = setup(answers);
  const checks = [
    http({ name: 'status', url: 'https://h.test/status' }),
    http({ name: 'json', url: 'https://h.test/json', json: { status: 'ok' } }),
    http({ name: 'html', url: 'https://h.test/html', json: { status: 'ok' } }),
    http({ name: 'null', url: 'https://h.test/null', json: { status: 'ok' } }),
    http({ name: 'text', url: 'https://h.test/text', contains: 'needle' }),
  ];
  const result = await verifyStack(ctx, withChecks({ http: checks }));
  assert.equal(result.ok, false);
  assert.deepEqual(result.lines, [
    'FAIL  status  HTTP 503',
    'FAIL  json  body.status is not the declared value',
    'FAIL  html  body is not JSON',
    'FAIL  null  body.status is not the declared value',
    'FAIL  text  no needle in the answer',
  ]);
  assert.equal(host.state.time, start);
});

test('a retrying journey is retried every 6 s until it passes, without real waiting', async () => {
  const { host, ctx } = setup({ 'https://api.example.test/healthz': (init, attempt) => ({ status: attempt < 3 ? 503 : 200, body: {} }) });
  const start = host.state.time;
  const result = await verifyStack(ctx, withChecks({ http: [http({ retry: true })] }), { retrySeconds: 60 });
  assert.equal(result.ok, true);
  assert.equal(host.state.time - start, 12_000);
});

test('a retrying journey gives up when the retry window elapsed, a request error is reported', async () => {
  const { host, ctx } = setup({ 'https://api.example.test/healthz': () => new Error('The operation was aborted due to timeout') });
  const start = host.state.time;
  const result = await verifyStack(ctx, withChecks({ http: [http({ retry: true })] }), { retrySeconds: 10 });
  assert.deepEqual(result.lines, ['FAIL  live  The operation was aborted due to timeout']);
  assert.equal(host.state.time - start, 12_000);
});

test('skipPublic skips every journey and skipInternal every task check', async () => {
  const { host, net, ctx } = setup();
  const config = withChecks({ http: [http()], exec: [exec()] });
  const result = await verifyStack(ctx, config, { skipPublic: true, skipInternal: true });
  assert.deepEqual(result, { ok: true, lines: [], data: { checks: [] } });
  assert.equal(net.calls.length, 0);
  assert.equal(host.calls.length, 0);
});

test('an exec check needs a running task, then exit 0 and the declared stdout shape', async () => {
  const { host, ctx } = setup();
  seedService(host, 'app_api');
  host.state.exec = (command, task) => {
    assert.equal(task, 'app_api.1');
    return { status: 0, stdout: '3 12\n', stderr: '' };
  };
  const config = withChecks({ exec: [exec({ stdout: String.raw`^\d+ \d+\r?\n?$` }), exec({ name: 'plain' })] });
  const result = await verifyStack(ctx, config, { skipPublic: true });
  assert.equal(result.ok, true);
  assert.deepEqual(result.lines, ['PASS  a api task is running on this manager  app_api.1', 'PASS  watchdog  3 12', 'PASS  plain  ok']);
  const ps = host.calls.filter((call) => call.args[0] === 'ps');
  assert.equal(ps.length, 1);
  assert.deepEqual(ps[0].args, ['ps', '-q', '--filter', 'label=com.docker.swarm.service.name=app_api', '--filter', 'status=running']);
  assert.deepEqual(host.calls.find((call) => call.args[0] === 'exec').args, ['exec', 'app_api.1', 'app', 'jobs', 'watchdog']);
});

test('an exec check fails on a non-zero exit or on output that does not match', async () => {
  const { host, ctx } = setup();
  seedService(host, 'app_api');
  host.state.exec = (command) => (command[1] === 'crash' ? { status: 3, stdout: '', stderr: 'boom' } : { status: 0, stdout: 'nope', stderr: '' });
  const config = withChecks({ exec: [exec({ name: 'crash', command: ['app', 'crash'] }), exec({ name: 'shape', stdout: String.raw`^\d+$` })] });
  const result = await verifyStack(ctx, config, { skipPublic: true });
  assert.equal(result.ok, false);
  assert.deepEqual(result.lines.slice(1), ['FAIL  crash  exit 3', String.raw`FAIL  shape  stdout does not match ^\d+$`]);
});

test('without a running task the check fails once and the commands are not tried', async () => {
  const { host, ctx } = setup();
  seedService(host, 'app_api', { replicas: 1, running: 0 });
  const config = withChecks({ exec: [exec(), exec({ name: 'second' })] });
  const result = await verifyStack(ctx, config, { skipPublic: true });
  assert.deepEqual(result.lines, ['FAIL  a api task is running on this manager  no running container of app_api on the daemon']);
  assert.equal(host.calls.some((call) => call.args[0] === 'exec'), false);
});

test('each service gets its own running-task check', async () => {
  const { host, ctx } = setup();
  seedService(host, 'app_api');
  seedService(host, 'app_worker');
  host.state.exec = () => ({ status: 0, stdout: '', stderr: '' });
  const config = withChecks({ exec: [exec(), exec({ name: 'queue', service: 'worker' })] });
  const result = await verifyStack(ctx, config, { skipPublic: true });
  assert.deepEqual(result.data.checks.map((check) => check.name), ['a api task is running on this manager', 'watchdog', 'a worker task is running on this manager', 'queue']);
  assert.equal(result.ok, true);
});

test('with nothing declared verification passes, options default', async () => {
  const { ctx } = setup();
  assert.deepEqual(await verifyStack(ctx, withChecks({})), { ok: true, lines: [], data: { checks: [] } });
});
