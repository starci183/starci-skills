import assert from 'node:assert/strict';
import test from 'node:test';
import { scheduleList } from '../../scripts/api/schtasks/schedule-list.mjs';
import { scheduleQuery } from '../../scripts/api/schtasks/schedule-query.mjs';


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
