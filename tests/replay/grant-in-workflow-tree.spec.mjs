// Replay of the walk of the authentication workflows (premortem, backend.implement): a write grant is judged against the tree the workflow works in. The legs before a leg leave their
// directories in the workflow's own tree (a checkpoint lands on main when the workflow finishes), so a grant under such a directory is satisfiable; judging it against the main checkout
// refused `grant-parent-missing` for a directory the worker could write into, and the only way out (--new-module) declared a module that is not new.
// Real: `starci kernel enqueue` and the dispatch push as child processes over a world whose main checkout holds no be/ and whose workflow tree is an hfs app. Stubbed: the Orca binary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { openWalk } from '../helpers/walk-world.mjs';

const PATHS = '.starciwork/features/identity/impl/be/account,be/src/modules/domain/account';

test('a grant under a directory the workflow tree holds and the main checkout does not is satisfiable at enqueue and at dispatch', (t) => {
  const walk = openWalk(t);
  walk.ack('backend.implement');
  const queued = walk.enqueue('backend.implement', PATHS);
  assert.equal(queued.ok, true, `${queued.result?.stderr}`);
  const pushed = walk.dispatch();
  const [result] = pushed.json.results;
  assert.notEqual(result.refusal?.code, 'grant-parent-missing', `dispatch re-judges the grant against the workflow tree: ${result.error}`);
});

test('a grant under a directory no tree holds is still refused, naming the closest existing directory', (t) => {
  const walk = openWalk(t);
  walk.ack('backend.implement');
  const queued = walk.enqueue('backend.implement', '.starciwork/features/identity/impl/be/account,be/src/modules/nowhere/account');
  assert.equal(queued.ok, false);
  assert.equal(queued.result.json.reason ?? queued.result.json.code, 'grant-parent-missing');
  assert.match(queued.result.json.detail ?? queued.result.json.error, /be\/src\/modules\/nowhere/);
});
