// The walk of the two authentication workflows, leg 8, work.author (the legs before it - the draw and the end-of-flow provision ask - are settled rows of the seeded world). The write set
// the menu proposes carries the resource slots the contract declares, the scripted op authors the planned implementation record, the uat flow, its accounts and the identity resource,
// runs the READ and the document gate, files its report, and the real engine settles it: checks re-run in the tree, checkpoint committed.
// Real: status, decide, enqueue, dispatch, report, the engine and its settler, the document gate. Stubbed: the Orca binary, the Critic agent launch, the op itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { seededWalk } from '../helpers/walk-seed.mjs';
import { assertNextOffered, walkSettled } from '../helpers/walk-assert.mjs';

test('work.author: the proposed write set grants the resource slots, the leg settles green and backend.implement is offered', async (t) => {
  const walk = await seededWalk(t, 'work.author');
  const item = walk.menuItem('work.author');
  assert.match(item.options.find((option) => option.choice === 'enqueue-proposed').args.paths, /_resources\/identities/, 'the proposal grants the identity slot the uat flow resolves its accounts against');
  const out = await walkSettled(walk, 'work.author');
  assert.ok(out.jobId);
  assert.match(walk.world.tree.git('show', 'HEAD:.starciwork/_resources/identities/identity-demo/resource.yaml'), /identity\.demo/);
  assertNextOffered(walk, 'work.author');
});
