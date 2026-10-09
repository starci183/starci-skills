import assert from 'node:assert/strict';

import test from 'node:test';
import { CATALOG as catalog } from '../../packages/cli/src/catalog.generated.mjs';
import { main } from '../../scripts/cli/main.mjs';



test('workflow validation refuses missing required and unknown flags', () => {
  let err = '';
  assert.equal(main(['workflow', 'status'], { catalog, stderr: (text) => { err += text; }, runScript: () => 0 }), 2);
  assert.match(err, /missing required option --workflow/);
  assert.equal(main(['workflow', 'start', '--replace'], { catalog, stderr: () => {}, runScript: () => 0 }), 2);
});
