import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Owner ruling 2026-09-23: "creds không có thì vẫn code, để dumb string vào, uat
// không làm thôi" - asking for a credential does not mean not doing the work.
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('a missing credential parks only live proof; build ops code on a placeholder', () => {
  const common = read('modules/ops/_common.yaml');
  assert.match(common, /A missing credential never stops building/);
  assert.match(common, /placeholder-<VAR_NAME>/);
  assert.match(common, /credentialPending: \[VAR_NAME/);
  assert.match(common, /a build op never reports\s+`blocked` `environment` for a credential/);
  const loop = read('modules/kernel/driver-loop.yaml');
  assert.match(loop, /A credential ask parks only the live-proof\s+legs/);
  assert.match(loop, /Build legs never wait\s+on it/);
  assert.doesNotMatch(loop, /A credential ask parks its requesters/);
  assert.match(read('modules/models/kinds.yaml'), /missing credential is not such a blocker for a build op/);
});
