// The walk of the two authentication workflows: leg 4, architecture.decide (contracts, integrations, design components), judged by the runtime Critic. The legs before it are settled rows and committed checkpoints of the seeded world (tests/helpers/walk-seed.mjs); the leg itself runs
// through the real chain: menu item answered with `decide`, dispatch push, the scripted op, the real `starci kernel report`, the real engine and settler, the checkpoint.
// Real: status, decide, enqueue, dispatch, report, the engine and its settler. Stubbed: the Orca binary, the Critic agent launch, the op itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { seededWalk } from '../helpers/walk-seed.mjs';
import { assertNextOffered, walkSettled } from '../helpers/walk-assert.mjs';

test('architecture.decide: offered on the menu, settled green through the real chain and the next leg offered', async (t) => {
  const walk = await seededWalk(t, 'architecture.decide');
  assert.ok(walk.menuItem('architecture.decide'), 'architecture.decide is the leg the menu offers');
  const out = await walkSettled(walk, 'architecture.decide');
  assert.ok(out.jobId);
  const critic = walk.events(['runtime-critic-run']).map((event) => JSON.parse(event.payload_json));
  assert.deepEqual(critic.map((run) => [run.op, run.pass]), [['architecture.decide', true]], 'the runtime ran the Critic itself and it passed');
  assertNextOffered(walk, 'architecture.decide');
});
