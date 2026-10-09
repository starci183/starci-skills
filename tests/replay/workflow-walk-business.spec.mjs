// The walk of the two authentication workflows: leg 3, business.decide (requirement and rule records). The legs before it are settled rows and committed checkpoints of the seeded world (tests/helpers/walk-seed.mjs); the leg itself runs
// through the real chain: menu item answered with `decide`, dispatch push, the scripted op, the real `starci kernel report`, the real engine and settler, the checkpoint.
// Real: status, decide, enqueue, dispatch, report, the engine and its settler. Stubbed: the Orca binary, the Critic agent launch, the op itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { seededWalk } from '../helpers/walk-seed.mjs';
import { assertNextOffered, walkSettled } from '../helpers/walk-assert.mjs';

test('business.decide: offered on the menu, settled green through the real chain and the next leg offered', async (t) => {
  const walk = await seededWalk(t, 'business.decide');
  assert.ok(walk.menuItem('business.decide'), 'business.decide is the leg the menu offers');
  const out = await walkSettled(walk, 'business.decide');
  assert.ok(out.jobId);
  assert.deepEqual(walk.world.ledger((ledger) => ledger.db.prepare("SELECT status FROM jobs WHERE op_id='business.decide'").all().map((row) => row.status)), ['succeeded']);
  assertNextOffered(walk, 'business.decide');
});
