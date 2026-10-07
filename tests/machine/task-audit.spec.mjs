import assert from 'node:assert/strict';
import test from 'node:test';
import { auditTask, auditTasks, resultCodeText, taskFacts } from '../../scripts/machine/task-audit.mjs';
import { TASK_DEFINITIONS, registeredAction } from '../../scripts/machine/task-register.mjs';

const SYSTEM_ROOT = 'C:\\WINDOWS';
const HOME = 'C:\\Users\\Owner';
const SHIM = 'C:\\Users\\Owner\\.starci\\bin\\starci.cmd';
const current = (name) => registeredAction(name, { systemRoot: SYSTEM_ROOT, starci: SHIM });
const row = (name, over = {}) => ({ name, taskName: TASK_DEFINITIONS[name].taskName, state: 'Ready', nextRun: null, lastRun: null, lastResult: 0, action: current(name), ...over });
const audit = (name, taskRow, shimExists = true) => auditTask(name, taskRow, { shim: SHIM, shimExists, systemRoot: SYSTEM_ROOT });

test('the registered action is conhost, headless cmd and the shim with the task command, exactly as Task Scheduler prints it', () => {
  assert.equal(current('harness-app'), 'C:\\WINDOWS\\System32\\conhost.exe --headless "C:\\WINDOWS\\System32\\cmd.exe" /d /s /c ""C:\\Users\\Owner\\.starci\\bin\\starci.cmd" harness start"');
  assert.match(current('harness-tunnel'), /" harness start --tunnel"$/);
  assert.match(current('reconciler'), /" reconciler start"$/);
});

test('a task on today\'s action with its shim present is ok, ignoring case and spacing', () => {
  for (const name of Object.keys(TASK_DEFINITIONS)) {
    const found = audit(name, row(name, { action: `  ${current(name).toUpperCase().replace(' --HEADLESS', '   --headless')} ` }));
    assert.equal(found.ok, true, name);
    assert.deepEqual([found.problem, found.reason, found.fix], [null, null, null], name);
  }
});

test('the stale hand-made harness app action is red and names the register command', () => {
  const stale = 'C:\\Program Files\\nodejs\\node.exe server.mjs --serve-static';
  const found = audit('harness-app', row('harness-app', { action: stale }));
  assert.equal(found.ok, false);
  assert.equal(found.problem, 'action-stale');
  assert.match(found.reason, /Windows task 'StarCi Harness App' runs "C:\\Program Files\\nodejs\\node\.exe server\.mjs --serve-static" but a registration today writes "C:\\WINDOWS\\System32\\conhost\.exe/);
  assert.equal(found.fix, 'starci task register harness-app --apply');
});

test('a tunnel action that lost --tunnel is stale: the app command is not the tunnel command', () => {
  const found = audit('harness-tunnel', row('harness-tunnel', { action: current('harness-app') }));
  assert.equal(found.problem, 'action-stale');
});

test('a missing shim is red even when the action is the declared one, and the fix is runtime link', () => {
  const found = audit('reconciler', row('reconciler'), false);
  assert.equal(found.ok, false);
  assert.equal(found.problem, 'shim-missing');
  assert.match(found.reason, /per-user shim C:\\Users\\Owner\\\.starci\\bin\\starci\.cmd does not exist/);
  assert.equal(found.fix, 'starci runtime link');
});

test('a missing shim together with a stale action asks for the link first and the registration second', () => {
  const found = audit('harness-app', row('harness-app', { action: 'x' }), false);
  assert.deepEqual(found.problems, ['shim-missing', 'action-stale']);
  assert.equal(found.fix, 'starci runtime link, then starci task register harness-app --apply');
  assert.match(found.reason, /shim .* does not exist.*; Windows task .* runs "x"/);
});

test('an unregistered task and a disabled task are red with the register command', () => {
  const missing = audit('harness-tunnel', null);
  assert.deepEqual([missing.ok, missing.problem, missing.fix], [false, 'missing', 'starci task register harness-tunnel --apply']);
  assert.match(missing.reason, /'StarCi Harness Tunnel' is not registered/);
  const disabled = audit('reconciler', row('reconciler', { state: 'Disabled' }));
  assert.deepEqual([disabled.ok, disabled.problem, disabled.fix], [false, 'disabled', 'starci task register reconciler --apply']);
});

test('state and last result are one clause, with the result as hex', () => {
  assert.equal(resultCodeText(267011), '0x41303');
  assert.equal(resultCodeText(-2147024894), '0x80070002');
  assert.equal(resultCodeText(0), '0x0');
  assert.equal(resultCodeText(null), null);
  assert.equal(taskFacts({ state: 'Ready', lastResult: 267011 }), 'state Ready, last result 0x41303');
  assert.equal(taskFacts({ state: null, lastResult: null }), '');
});

test('auditTasks makes one list call with every known task name (spaces intact) and audits each from it', async () => {
  const calls = [];
  const result = await auditTasks({
    home: HOME, systemRoot: SYSTEM_ROOT, exists: (file) => { calls.push(['exists', file]); return true; },
    listScheduledTasks: (names) => {
      calls.push(['list', names]);
      return { status: 0, stdout: JSON.stringify([
        { taskName: 'StarCi Harness App', state: 'Ready', lastResult: 0, action: 'node.exe server.mjs --serve-static' },
        { taskName: 'starci-reconciler', state: 'Running', lastResult: 267009, action: current('reconciler') },
      ]) };
    },
  });
  assert.deepEqual(calls.filter(([kind]) => kind === 'list'), [['list', ['StarCi Harness App', 'StarCi Harness Tunnel', 'StarCi-Reconciler']]]);
  assert.deepEqual(calls.filter(([kind]) => kind === 'exists'), [['exists', SHIM]]);
  assert.equal(result.ok, true);
  assert.equal(result.audits['harness-app'].problem, 'action-stale');
  assert.equal(result.audits['harness-tunnel'].problem, 'missing');
  assert.equal(result.audits.reconciler.ok, true);
  assert.equal(result.audits.reconciler.state, 'Running');
});

test('an unreadable Task Scheduler is one unreadable answer, never a task verdict', async () => {
  const failed = await auditTasks({ home: HOME, systemRoot: SYSTEM_ROOT, exists: () => true, listScheduledTasks: () => ({ status: 1, stderr: 'access denied' }) });
  assert.equal(failed.ok, false);
  assert.match(failed.error, /could not query Task Scheduler: access denied/);
  assert.equal(failed.audits, undefined);
});
