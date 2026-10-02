import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { main } from '../../scripts/cli/main.mjs';

const catalog = { global: [{ name: 'cwd', type: 'string' }, { name: 'json', type: 'boolean' }], groups: { workflow: {
  owner: 'runtime', verbs: {
    define: { group: 'workflow', verb: 'define', impl: { script: 'scripts/goal/define-goal.mjs' }, flags: [{ name: 'text', type: 'string', required: true }], json: 'flag' },
    start: { group: 'workflow', verb: 'start', impl: { script: 'scripts/kernel/start-workflow.mjs' }, flags: [], json: 'flag' },
    status: { group: 'workflow', verb: 'status', impl: { script: 'scripts/kernel/cli.mjs', args: ['status'] }, flags: [{ name: 'workflow', type: 'string', required: true }], json: 'flag' },
    stop: { group: 'workflow', verb: 'stop', impl: { script: 'scripts/kernel/cli.mjs', args: ['archive'] }, flags: [{ name: 'workflow', type: 'string', required: true }, { name: 'reason', type: 'string', required: true }], json: 'flag' },
  },
} } };

test('workflow catalog resolves fixed kernel verbs', () => {
  let call;
  const code = main(['workflow', 'status', '--workflow', 'wf-1', '--json'], { catalog, runScript: (script, args, options) => { call = { script, args, options }; return 0; } });
  assert.equal(code, 0);
  assert.match(call.script, /scripts[\\/]kernel[\\/]cli\.mjs$/);
  assert.deepEqual(call.args, ['status', '--workflow', 'wf-1', '--json']);
});

test('workflow validation refuses missing required and unknown flags', () => {
  let err = '';
  assert.equal(main(['workflow', 'status'], { catalog, stderr: (text) => { err += text; }, runScript: () => 0 }), 2);
  assert.match(err, /missing required option --workflow/);
  assert.equal(main(['workflow', 'start', '--replace'], { catalog, stderr: () => {}, runScript: () => 0 }), 2);
});
