import assert from 'node:assert/strict';
import test from 'node:test';
import { main } from '../../scripts/cli/main.mjs';
import { INSPECTORS } from '../../scripts/cli/lib/debug-run.mjs';

const catalog = { global: [{ name: 'json', type: 'boolean' }], groups: { debug: { owner: 'runtime', verbs: {
  run: { group: 'debug', verb: 'run', impl: { script: 'scripts/cli/lib/debug-run.mjs' }, positional: [{ name: 'inspector', required: true, enum: Object.keys(INSPECTORS) }], flags: [], json: 'flag' },
} } } };

test('debug run resolves only documented read-only inspectors', () => {
  let call;
  assert.equal(main(['debug', 'run', 'supervisor-status', '--json'], { catalog, runScript: (script, args) => { call = { script, args }; return 0; } }), 0);
  assert.match(call.script, /scripts[\\/]cli[\\/]lib[\\/]debug-run\.mjs$/);
  assert.deepEqual(call.args, ['supervisor-status', '--json']);
  assert.deepEqual(Object.keys(INSPECTORS), ['orca-status', 'runtime-status', 'supervisor-status']);
});

test('debug run refuses missing, unknown and extra input', () => {
  assert.equal(main(['debug', 'run'], { catalog, stderr: () => {}, runScript: () => 0 }), 2);
  assert.equal(main(['debug', 'run', 'ledger'], { catalog, stderr: () => {}, runScript: () => 0 }), 2);
  assert.equal(main(['debug', 'run', 'orca-status', 'extra'], { catalog, stderr: () => {}, runScript: () => 0 }), 2);
});
