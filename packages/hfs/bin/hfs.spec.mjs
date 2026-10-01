// The clean-install proof of @starci/hfs (scripts/gates/package-clean-test.mjs runs `npm test` in a copy of this folder with
// nothing installed): the CLI's whole static module graph loads from the published folders alone - hfs declares no
// dependency, so any bare import here would fail - and a call with no verb prints the usage and refuses with exit 2.
import test from 'node:test';
import assert from 'node:assert/strict';
import { main } from './hfs.mjs';

test('the hfs CLI loads with no installed dependency and refuses a missing verb with its usage', async () => {
  let err = '';
  const code = await main([], { stdout: () => {}, stderr: (s) => { err += s; } });
  assert.equal(code, 2);
  assert.match(err, /^hfs check /m);
  assert.match(err, /^hfs scaffold app <name>/m);
});
