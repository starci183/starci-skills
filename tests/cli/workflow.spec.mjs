import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { CATALOG as catalog } from '../../packages/cli/src/catalog.generated.mjs';
import { main } from '../../scripts/cli/main.mjs';

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
