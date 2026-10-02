import assert from 'node:assert/strict';
import test from 'node:test';
import { main } from '../../scripts/cli/main.mjs';

const catalog = { global: [{ name: 'json', type: 'boolean' }], groups: { supervisor: { owner: 'runtime', verbs: {
  status: { group: 'supervisor', verb: 'status', impl: { script: 'scripts/supervisor/start-supervisor.mjs', args: ['--status'] }, flags: [], json: 'flag' },
  start: { group: 'supervisor', verb: 'start', impl: { script: 'scripts/supervisor/start-supervisor.mjs' }, flags: [{ name: 'plan', type: 'boolean' }, { name: 'reason', type: 'string' }], json: 'flag' },
  stop: { group: 'supervisor', verb: 'stop', impl: { script: 'scripts/supervisor/start-supervisor.mjs', args: ['--stop'] }, flags: [], json: 'flag' },
} } } };

test('supervisor verbs resolve only the public status/start/stop modes', () => {
  const calls = [];
  const runScript = (script, args) => { calls.push({ script, args }); return 0; };
  assert.equal(main(['supervisor', 'status', '--json'], { catalog, runScript }), 0);
  assert.equal(main(['supervisor', 'start', '--plan', '--reason', 'check'], { catalog, runScript }), 0);
  assert.equal(main(['supervisor', 'stop'], { catalog, runScript }), 0);
  assert.deepEqual(calls.map((call) => call.args), [['--status', '--json'], ['--plan', '--reason', 'check'], ['--stop']]);
});

test('supervisor internal watchdog flags are refused', () => {
  assert.equal(main(['supervisor', 'start', '--replace'], { catalog, stderr: () => {}, runScript: () => 0 }), 2);
  assert.equal(main(['supervisor', 'start', '--restart'], { catalog, stderr: () => {}, runScript: () => 0 }), 2);
});
