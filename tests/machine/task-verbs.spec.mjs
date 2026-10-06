import assert from 'node:assert/strict';
import test from 'node:test';
import { taskRegister } from '../../scripts/machine/task-register.mjs';
import { taskList, taskShow } from '../../scripts/machine/task-show.mjs';

const ctx = (name, args = {}) => ({ args, positionals: name == null ? [] : [name], env: {}, cwd: process.cwd(), role: 'owner' });

test('task register prints reviewable scripts for both runtime tasks without changing the host', async () => {
  let calls = 0;
  const registerScheduledTask = () => { calls += 1; return { status: 0 }; };
  const tunnel = await taskRegister(ctx('harness-tunnel'), { registerScheduledTask });
  const reconciler = await taskRegister(ctx('reconciler'), { registerScheduledTask });

  assert.equal(calls, 0);
  assert.match(tunnel.text, /Register-ScheduledTask -TaskName 'StarCi Harness Tunnel'/);
  assert.match(tunnel.text, /harness start --tunnel/);
  assert.match(tunnel.text, /New-ScheduledTaskTrigger -AtLogOn/);
  assert.match(tunnel.text, /RestartCount 999/);
  assert.match(reconciler.text, /Register-ScheduledTask -TaskName 'StarCi-Reconciler'/);
  assert.match(reconciler.text, /reconciler start/);
  assert.match(reconciler.text, /RepetitionInterval \(New-TimeSpan -Minutes 5\)/);
  for (const script of [tunnel.text, reconciler.text]) {
    assert.match(script, /GetFolderPath\('UserProfile'\)/);
    assert.doesNotMatch(script, /[A-Za-z]:[\\/](?:Users|starci|src)[\\/]/i);
  }
});

test('task register --apply makes exactly one injected registration call', async () => {
  const calls = [];
  const result = await taskRegister(ctx('reconciler', { apply: true }), {
    platform: 'win32', registerScheduledTask: (script, options) => { calls.push({ script, options }); return { status: 0, stdout: 'registered StarCi-Reconciler' }; },
  });
  assert.equal(result.code, 0);
  assert.equal(result.data.applied, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0].script, /Register-ScheduledTask/);
  assert.deepEqual(calls[0].options, { env: {} });
});

test('task show maps a canned query payload to starci/task-show@1', async () => {
  const payload = { taskName: 'StarCi-Reconciler', state: 'Ready', nextRun: '2026-10-03T10:00:00.0000000+07:00',
    lastRun: '2026-10-03T09:55:00.0000000+07:00', lastResult: 0, action: 'starci.cmd reconciler start' };
  const result = await taskShow(ctx('reconciler'), {
    queryScheduledTask: (taskName) => ({ status: 0, stdout: JSON.stringify({ ...payload, taskName }) }),
  });
  assert.equal(result.code, 0);
  assert.deepEqual(result.data, { schema: 'starci/task-show@1', ok: true, name: 'reconciler', ...payload });
  assert.match(result.text, /state: Ready/);
  assert.match(result.text, /last result: 0/);
});

test('task list maps only registered known tasks from one injected list call', async () => {
  let calls = 0;
  const result = await taskList(ctx(), {
    listScheduledTasks: (names) => {
      calls += 1;
      assert.deepEqual(names, ['StarCi Harness Tunnel', 'StarCi-Reconciler']);
      return { status: 0, stdout: JSON.stringify([{ taskName: 'StarCi Harness Tunnel', state: 'Running', nextRun: null,
        lastRun: '2026-10-03T09:00:00Z', lastResult: 0, action: 'starci.cmd harness start --tunnel' }]) };
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.code, 0);
  assert.equal(result.data.schema, 'starci/task-list@1');
  assert.deepEqual(result.data.tasks.map((task) => task.name), ['harness-tunnel']);
});

test('unknown task names are usage errors and make no calls', async () => {
  let calls = 0;
  const deps = {
    registerScheduledTask: () => { calls += 1; },
    queryScheduledTask: () => { calls += 1; },
  };
  assert.equal((await taskRegister(ctx('other'), deps)).code, 2);
  assert.equal((await taskShow(ctx('other'), deps)).code, 2);
  assert.equal(calls, 0);
});

test('task register --apply refuses a host that is not Windows and never calls the scheduler', async () => {
  let called = false;
  const result = await taskRegister({ positionals: ['reconciler'], args: { apply: true }, env: {} }, { platform: 'linux', registerScheduledTask: () => { called = true; return { ok: true }; } });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /not-windows/);
  assert.equal(called, false);
});
