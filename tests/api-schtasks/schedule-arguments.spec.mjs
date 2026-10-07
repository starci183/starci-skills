import assert from 'node:assert/strict';
import test from 'node:test';
import { scheduleList } from '../../scripts/api/schtasks/schedule-list.mjs';
import { scheduleQuery } from '../../scripts/api/schtasks/schedule-query.mjs';
import { scheduleRegister } from '../../scripts/api/schtasks/schedule-register.mjs';

// `powershell -Command <script> <arg>...` joins the trailing arguments into the command text, so 'StarCi Harness Tunnel'
// reached the script as three tokens ("A positional parameter cannot be found that accepts argument 'Harness'").
// The arguments now reach the script as one single-quoted array on its first line.

const capture = () => {
  const calls = [];
  const run = (program, argv, options) => { calls.push({ program, argv, options }); return { status: 0, stdout: '' }; };
  return { calls, run };
};
const commandOf = (call) => call.argv[call.argv.indexOf('-Command') + 1];

test('task names with spaces reach the list script as single-quoted array elements, not as trailing arguments', () => {
  const { calls, run } = capture();
  scheduleList(['StarCi Harness App', 'StarCi Harness Tunnel', 'StarCi-Reconciler'], { run });
  const command = commandOf(calls[0]);
  assert.equal(command.split('\n')[0], "$Arguments = @('StarCi Harness App', 'StarCi Harness Tunnel', 'StarCi-Reconciler')");
  assert.equal(calls[0].argv.at(-1), command, 'the command is the last argument: nothing follows it for PowerShell to join');
  assert.match(command, /\$Arguments -contains \$_\.TaskName/);
  assert.doesNotMatch(command, /param\(/);
});

test('a single quote in a task name is doubled inside its literal', () => {
  const { calls, run } = capture();
  scheduleQuery("Owner's 'Task'", { run });
  const command = commandOf(calls[0]);
  assert.equal(command.split('\n')[0], "$Arguments = @('Owner''s ''Task''')");
  assert.match(command, /Get-ScheduledTask -TaskName \$Arguments\[0\]/);
});

test('an empty list and a registration define an empty $Arguments array and keep the reviewed script verbatim', () => {
  const { calls, run } = capture();
  scheduleList([], { run });
  scheduleRegister('Write-Output registered', { run });
  assert.equal(commandOf(calls[0]).split('\n')[0], '$Arguments = @()');
  assert.equal(commandOf(calls[1]), '$Arguments = @()\nWrite-Output registered');
});

test('the runner keeps its fixed PowerShell flags and bounded timeout', () => {
  const { calls, run } = capture();
  scheduleQuery('StarCi-Reconciler', { run, timeout: 1234 });
  assert.deepEqual(calls[0].argv.slice(0, 5), ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command']);
  assert.equal(calls[0].options.timeout, 1234);
  assert.equal(calls[0].options.windowsHide, true);
});
