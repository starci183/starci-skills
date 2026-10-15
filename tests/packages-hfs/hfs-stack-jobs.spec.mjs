import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { runJobs } from '../../packages/hfs/stack/jobs.mjs';
import { fakeHost } from '../helpers/stack-fakes.mjs';
import { fakeRunner, makeApp } from '../helpers/stack-remote-fakes.mjs';

const app = makeApp();
after(() => app.cleanup());
const { config } = app;

const ok = (stdout = '') => ({ status: 0, stdout, stderr: '' });
const failed = (stderr, status = 1) => ({ status, stdout: '', stderr });
const SERVICE_LABEL = 'label=com.docker.swarm.service.name=';

/** `docker ps -q --filter label=com.docker.swarm.service.name=<service>` answered strictly from the fake task list. */
const psRunning = (args, _call, host) => {
  const service = args.find((arg) => arg.startsWith(SERVICE_LABEL)).slice(SERVICE_LABEL.length);
  const running = host.state.tasks.filter((task) => task.service === service && task.state === 'running');
  return ok(running.map((task) => `${task.container}\n`).join(''));
};

/** A manager with one running api task; `exec` records the commands run inside it. */
function manager({ docker = {}, exec } = {}) {
  const executed = [];
  const host = fakeHost({ overrides: { docker: { 'ps -q': psRunning, ...docker } } });
  host.state.tasks.push(
    { id: 'shop_api.1', service: 'shop_api', state: 'running', container: 'c0ffee12', desired: 'running', timestamp: '' },
    { id: 'shop_web.1', service: 'shop_web', state: 'running', container: 'deadbeef', desired: 'running', timestamp: '' },
  );
  host.state.exec = exec ?? ((command, task) => { executed.push({ command, task }); return ok('row one\nrow two\n'); });
  const run = fakeRunner(host);
  return { host, run, executed, deps: { ssh: run }, ctx: host.ctx() };
}

const refusedArgument = (error) => error.code === 'STACK_JOBS_ARGUMENT' && error.exit === 2;

test('a deploy block without jobs is refused', async () => {
  const bare = makeApp({ deploy: { jobs: null } });
  try {
    const m = manager();
    await assert.rejects(runJobs(m.ctx, bare.config, { action: 'stats' }, m.deps), (error) => error.code === 'STACK_JOBS_UNDECLARED' && error.exit === 2);
  } finally {
    bare.cleanup();
  }
});

test('the read-only actions run the declared job command inside the running task of the declared service', async () => {
  await Promise.all(['stats', 'failed', 'open', 'watchdog'].map(async (action) => {
    const m = manager();
    const result = await runJobs(m.ctx, config, { action, args: [], execute: false, sshCmd: null }, m.deps);
    assert.equal(result.ok, true, action);
    assert.deepEqual(m.executed, [{ command: ['node', 'cli.js', 'jobs', action], task: 'c0ffee12' }]);
    assert.deepEqual(result.lines, ['row one', 'row two']);
    assert.deepEqual(result.data, { action, status: 0 });
  }));
});

test('failed and open take an optional row count', async () => {
  const m = manager();
  await runJobs(m.ctx, config, { action: 'failed', args: ['5'] }, m.deps);
  await runJobs(m.ctx, config, { action: 'open', args: ['720'] }, m.deps);
  assert.deepEqual(m.executed.map((entry) => entry.command.slice(3)), [['failed', '5'], ['open', '720']]);
});

test('the default action is stats and the default transport is the ssh alias', async () => {
  let route;
  const m = manager();
  const host = fakeHost({ overrides: { docker: { 'ps -q': psRunning }, ssh: (args) => route(args.at(-1)) } });
  host.state.tasks.push(m.host.state.tasks[0]);
  host.state.exec = (command) => ok(`ran ${command.at(-1)}\n`);
  route = fakeRunner(host);
  const result = await runJobs(host.ctx(), config);
  assert.deepEqual(result.lines, ['ran stats']);
  assert.equal(host.calls[0].args.at(-2), 'vps');
});

test('malformed actions and arguments are refused before anything runs', async () => {
  const cases = [
    { action: 'drop-table' }, { action: undefined, args: ['x'] }, { action: 'stats', args: ['1'] }, { action: 'watchdog', args: ['1'] },
    { action: 'failed', args: ['1', '2'] }, { action: 'failed', args: ['abc'] }, { action: 'failed', args: ['0'] }, { action: 'open', args: ['721'] },
    { action: 'open', args: ['1; rm -rf /'] }, { action: 'retry', args: [] }, { action: 'retry', args: ['a', 'b'] }, { action: 'retry', args: ['a b'] },
    { action: 'retry', args: ['$(id)'] }, { action: 'retry', args: ['x'.repeat(65)] }, { action: 'retry-failed', args: ['x'] },
    { action: 'retry-failed', args: ['0'] }, { action: 'retry-failed', args: ['721'] }, { action: 'retry-failed', args: ['1', '2'] },
  ];
  await Promise.all(cases.map(async (options) => {
    const m = manager();
    await assert.rejects(runJobs(m.ctx, config, { ...options, execute: true }, m.deps), refusedArgument, JSON.stringify(options));
    assert.equal(m.run.commands.length, 0);
  }));
});

test('retry without --execute is a dry run and runs nothing on the manager', async () => {
  const m = manager();
  const one = await runJobs(m.ctx, config, { action: 'retry', args: ['out-123'] }, m.deps);
  const many = await runJobs(m.ctx, config, { action: 'retry-failed', args: ['24'], execute: false }, m.deps);
  assert.equal(one.ok, true);
  assert.deepEqual(one.lines, ['dry run: would run jobs retry out-123 in the running api task (add --execute)']);
  assert.deepEqual(one.data, { action: 'retry', status: null });
  assert.match(many.lines[0], /^dry run: would run jobs retry-failed 24 /u);
  assert.equal(m.run.commands.length, 0);
});

test('retry and retry-failed with --execute run the job command with the validated arguments', async () => {
  const m = manager();
  const one = await runJobs(m.ctx, config, { action: 'retry', args: ['Out-123'], execute: true }, m.deps);
  await runJobs(m.ctx, config, { action: 'retry-failed', args: [], execute: true }, m.deps);
  await runJobs(m.ctx, config, { action: 'retry-failed', args: ['48'], execute: true }, m.deps);
  assert.deepEqual(m.executed.map((entry) => entry.command.slice(3)), [['retry', 'Out-123'], ['retry-failed'], ['retry-failed', '48']]);
  assert.deepEqual(one.data, { action: 'retry', status: 0 });
});

test('no running task of the service is a failure with exit 1', async () => {
  const m = manager();
  m.host.state.tasks = m.host.state.tasks.filter((task) => task.service !== 'shop_api');
  await assert.rejects(runJobs(m.ctx, config, { action: 'stats' }, m.deps), (error) => error.code === 'STACK_JOBS_NO_TASK' && error.exit === 1 && /shop_api/u.test(error.message) && /none is running/u.test(error.message));
  m.host.state.tasks.push({ id: 'shop_api.2', service: 'shop_api', state: 'failed', container: 'dead', desired: 'running', timestamp: '' });
  await assert.rejects(runJobs(m.ctx, config, { action: 'stats' }, m.deps), (error) => error.code === 'STACK_JOBS_NO_TASK');
  assert.equal(m.executed.length, 0);
});

test('a docker ps that fails reports its first error line', async () => {
  const m = manager({ docker: { 'ps -q': () => failed('Cannot connect\nsecond') } });
  await assert.rejects(runJobs(m.ctx, config, { action: 'stats' }, m.deps), (error) => error.code === 'STACK_JOBS_NO_TASK' && /Cannot connect/u.test(error.message) && !/second/u.test(error.message));
});

test('a failing job command makes the result not ok and relays the first error line', async () => {
  const m = manager({ exec: () => ({ status: 3, stdout: 'partial\n', stderr: 'job failed: queue unreachable\nstack' }) });
  const result = await runJobs(m.ctx, config, { action: 'failed' }, m.deps);
  assert.equal(result.ok, false);
  assert.deepEqual(result.lines, ['partial', 'FAIL  jobs failed exited 3: job failed: queue unreachable']);
  assert.deepEqual(result.data, { action: 'failed', status: 3 });
});

test('the notes of the transport lead the output', async () => {
  const m = manager();
  const noted = Object.assign((command) => m.run(command), { notes: ['owner session note'] });
  const result = await runJobs(m.ctx, config, { action: 'stats' }, { ssh: noted });
  assert.equal(result.lines[0], 'owner session note');
});
