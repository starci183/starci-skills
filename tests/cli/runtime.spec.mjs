import assert from 'node:assert/strict';
import test from 'node:test';
import { CATALOG as catalog } from '../../packages/cli/src/catalog.generated.mjs';
import { main } from '../../scripts/cli/main.mjs';

test('runtime catalog resolves handler, cwd and json once', () => {
  let call;
  const code = main(['runtime', 'check', '--cwd', 'repo', '--json', '--quiet'], { catalog, cwd: 'base', runScript: (script, args, options) => { call = { script, args, options }; return 1; } });
  assert.equal(code, 1);
  assert.match(call.script, /scripts[\\/]checks[\\/]check-runtime\.mjs$/);
  assert.deepEqual(call.args, ['--json']);
  assert.match(call.options.cwd, /base[\\/]repo$/);
});

test('runtime validation enforces positionals and no-machine-output', () => {
  assert.equal(main(['runtime', 'validate'], { catalog, stderr: () => {}, runScript: () => 0 }), 2);
  assert.equal(main(['runtime', 'version', '--json'], { catalog, stderr: () => {}, runScript: () => 0 }), 2);
  let args;
  assert.equal(main(['runtime', 'install', '--force'], { catalog, runScript: (_script, value) => { args = value; return 0; } }), 0);
  assert.deepEqual(args, ['init', '--force']);
});
