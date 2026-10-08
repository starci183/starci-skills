import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { CATALOG as catalog } from '../../packages/cli/src/catalog.generated.mjs';
import { main } from '../../scripts/cli/main.mjs';
import { INSPECTORS } from '../../scripts/cli/lib/debug-run.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('debug catalog resolves both handlers and their exact local flags', () => {
  const expected = {
    digest: ['child-timeout', 'repo', 'workflow'],
    run: ['child-timeout', 'repo', 'since-hours', 'token-spike', 'token-window'],
  };
  for (const [verb, flags] of Object.entries(expected)) {
    const command = catalog.groups.debug.verbs[verb];
    assert.equal(fs.existsSync(path.join(root, command.impl.script)), true, command.impl.script);
    assert.deepEqual(command.flags.map((flag) => flag.name).sort(), flags);
  }
});

test('debug run resolves only documented read-only inspectors', () => {
  let call;
  assert.equal(main(['debug', 'run', 'supervisor-status', '--json'], { catalog, runScript: (script, args) => { call = { script, args }; return 0; } }), 0);
  assert.match(call.script, /scripts[\\/]cli[\\/]lib[\\/]debug-run\.mjs$/);
  assert.deepEqual(call.args, ['supervisor-status', '--json']);
  assert.deepEqual(Object.keys(INSPECTORS), ['orca-status', 'runtime-status', 'supervisor-status', 'model-scorecard', 'core-watch']);
});

test('debug inspector options dispatch through the runtime seam', () => {
  const calls = [];
  const runScript = (script, args) => { calls.push({ script, args }); return 0; };
  assert.equal(main(['debug', 'run', 'model-scorecard', '--repo', 'one', '--repo', 'two', '--since-hours', '24'], { catalog, runScript }), 0);
  assert.equal(main(['debug', 'run', 'core-watch', '--child-timeout', '30', '--token-window', '5'], { catalog, runScript }), 0);
  assert.match(calls[0].script, /debug-run\.mjs$/);
  assert.deepEqual(calls[0].args, ['model-scorecard', '--repo', 'one', '--repo', 'two', '--since-hours', '24']);
  assert.equal(calls.length, 2);
});

test('debug run refuses missing, unknown and extra input', () => {
  assert.equal(main(['debug', 'run'], { catalog, stderr: () => {}, runScript: () => 0 }), 2);
  assert.equal(main(['debug', 'run', 'ledger'], { catalog, stderr: () => {}, runScript: () => 0 }), 2);
  assert.equal(main(['debug', 'run', 'orca-status', 'extra'], { catalog, stderr: () => {}, runScript: () => 0 }), 2);
});

test('debug pass and the caller flags are removed and refused', () => {
  const runScript = () => { throw new Error('a removed verb must not reach a script'); };
  assert.equal(main(['debug', 'pass', 'status'], { catalog, runScript, stderr: () => {} }), 2);
  assert.equal(main(['debug', 'run', 'orca-status', '--caller-lane', 'x'], { catalog, runScript, stderr: () => {} }), 2);
  assert.deepEqual(Object.keys(catalog.groups.debug.verbs), ['digest', 'run']);
});
