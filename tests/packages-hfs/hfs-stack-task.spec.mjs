import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { runTask } from '../../packages/hfs/stack/task.mjs';
import { fakeHost } from '../helpers/stack-fakes.mjs';
import { fakeRunner, makeApp } from '../helpers/stack-remote-fakes.mjs';

const TASKS = {
  'seed-media': { service: 'api', command: ['node', 'be/dist/apps/cli/src/main.js', 'seed-media', 'upload'] },
  'seed-modules': { service: 'api', command: ['node', 'be/dist/apps/cli/src/main.js', 'seed-modules', 'run'] },
};
const app = makeApp({ deploy: { tasks: TASKS } });
after(() => app.cleanup());
const { config } = app;

const ok = (stdout = '') => ({ status: 0, stdout, stderr: '' });
const SERVICE_LABEL = 'label=com.docker.swarm.service.name=';

const psRunning = (args, _call, host) => {
  const service = args.find((arg) => arg.startsWith(SERVICE_LABEL)).slice(SERVICE_LABEL.length);
  return ok(host.state.tasks.filter((task) => task.service === service && task.state === 'running').map((task) => `${task.container}\n`).join(''));
};

/** A manager with one running api task; `exec` records the commands run inside it. */
function manager({ exec } = {}) {
  const executed = [];
  const host = fakeHost({ overrides: { docker: { 'ps -q': psRunning } } });
  host.state.tasks.push({ id: 'shop_api.1', service: 'shop_api', state: 'running', container: 'c0ffee12', desired: 'running', timestamp: '' });
  host.state.exec = exec ?? ((command, task) => { executed.push({ command, task }); return ok('uploaded 3 files\n'); });
  const run = fakeRunner(host);
  return { host, run, executed, deps: { ssh: run }, ctx: host.ctx() };
}

const undeclared = (error) => error.code === 'STACK_TASK_UNDECLARED' && error.exit === 2;

test('without --execute a declared task is a dry run naming what would run, and nothing reaches the manager', async () => {
  const m = manager();
  const result = await runTask(m.ctx, config, { name: 'seed-media' }, m.deps);
  assert.equal(result.ok, true);
  assert.deepEqual(result.lines, ['dry run: would run task seed-media (node be/dist/apps/cli/src/main.js seed-media upload) in the running api task (add --execute)']);
  assert.deepEqual(result.data, { name: 'seed-media', status: null });
  assert.equal(m.run.commands.length, 0);
});

test('--execute runs the declared command inside the running task of the declared service and relays stdout', async () => {
  const m = manager();
  const result = await runTask(m.ctx, config, { name: 'seed-modules', execute: true }, m.deps);
  assert.equal(result.ok, true);
  assert.deepEqual(m.executed, [{ command: TASKS['seed-modules'].command, task: 'c0ffee12' }]);
  assert.deepEqual(result.lines, ['uploaded 3 files']);
  assert.deepEqual(result.data, { name: 'seed-modules', status: 0 });
});

test('a non-zero exit fails with the first stderr line only', async () => {
  const m = manager({ exec: () => ({ status: 4, stdout: 'partial\n', stderr: 'upload failed: bucket unreachable\nstack trace' }) });
  const result = await runTask(m.ctx, config, { name: 'seed-media', execute: true }, m.deps);
  assert.equal(result.ok, false);
  assert.deepEqual(result.lines, ['partial', 'FAIL  task seed-media exited 4: upload failed: bucket unreachable']);
  assert.deepEqual(result.data, { name: 'seed-media', status: 4 });
});

test('no running task of the service is a failure with exit 1', async () => {
  const m = manager();
  m.host.state.tasks = [];
  await assert.rejects(runTask(m.ctx, config, { name: 'seed-media', execute: true }, m.deps), (error) => error.code === 'STACK_TASK_NO_TASK' && error.exit === 1 && /shop_api/u.test(error.message));
  assert.equal(m.executed.length, 0);
});

test('no name or an unknown name lists the declared tasks and is refused with STACK_TASK_UNDECLARED', async () => {
  for (const name of [undefined, 'seed-nothing', 'Seed-Media', 'seed media', '__proto__', 'x'.repeat(80)]) {
    const m = manager();
    await assert.rejects(runTask(m.ctx, config, { name, execute: true }, m.deps), (error) => undeclared(error) && /declared tasks: seed-media, seed-modules/u.test(error.message), String(name));
    assert.equal(m.run.commands.length, 0);
  }
});

test('an environment without tasks refuses every name', async () => {
  const bare = makeApp();
  try {
    const m = manager();
    await assert.rejects(runTask(m.ctx, bare.config, { name: 'seed-media' }, m.deps), (error) => undeclared(error) && /declares no deploy\.tasks/u.test(error.message));
  } finally {
    bare.cleanup();
  }
});

test('extra arguments are refused: the command is the declaration', async () => {
  const m = manager();
  await assert.rejects(runTask(m.ctx, config, { name: 'seed-media', args: ['--all'], execute: true }, m.deps), (error) => error.code === 'STACK_USAGE');
  assert.equal(m.run.commands.length, 0);
});
