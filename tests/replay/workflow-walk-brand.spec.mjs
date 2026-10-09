// The walk of the two authentication workflows: leg 5, brand.decide (brand record, settled layout tree and its synthetic captures through the real layout-tree verbs). The legs before it are settled rows and committed checkpoints of the seeded world (tests/helpers/walk-seed.mjs); the leg itself runs
// through the real chain: menu item answered with `decide`, dispatch push, the scripted op, the real `starci kernel report`, the real engine and settler, the checkpoint.
// Real: status, decide, enqueue, dispatch, report, the engine and its settler. Stubbed: the Orca binary, the Critic agent launch, the op itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { seededWalk } from '../helpers/walk-seed.mjs';
import { assertNextOffered, walkSettled } from '../helpers/walk-assert.mjs';

test('brand.decide: offered on the menu, settled green through the real chain and the next leg offered', async (t) => {
  const walk = await seededWalk(t, 'brand.decide');
  assert.ok(walk.menuItem('brand.decide'), 'brand.decide is the leg the menu offers');
  const out = await walkSettled(walk, 'brand.decide');
  assert.ok(out.jobId);
  const brand = walk.world.tree.git('show', 'HEAD:.starciwork/brand/index.yaml');
  assert.match(brand, /sources:/, 'the brand record declares the CSS its tokens come from: the next leg\'s grammar context reads it');
  assertNextOffered(walk, 'brand.decide');
});
