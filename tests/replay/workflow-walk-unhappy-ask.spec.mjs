// An unhappy path of the walk of the two authentication workflows, on a late leg (work.author): it ends in exactly one owned next step and never in silence.
// Real: status, decide, enqueue, dispatch, report, the engine and the ask server. Stubbed: the Orca binary, the op itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { seededWalk } from '../helpers/walk-seed.mjs';
import { fileShape, ownedNext, startLeg } from '../helpers/walk-scenarios.mjs';

test('an op that asks the owner leaves the job awaiting the owner, the frontier awaiting-owner and one owner-gate step', async (t) => {
  const walk = await seededWalk(t, 'work.author');
  const { jobId } = startLeg(walk, 'work.author');
  const filed = fileShape(walk, jobId, { outcome: 'ask', question: { text: 'Which session lifetime does sign-in keep?', options: ['15 minutes', '12 hours'], recommended: 1, recommendedReason: 'the product is a daily tool' } });
  assert.equal(filed.status, 0, filed.stderr);
  assert.equal(walk.status().frontier.actionable, false, 'the filed ask is consumed and served by the runtime, not by the Kernel');
  walk.engine({ passes: 2, controllers: ['job', 'workflow'] });
  const next = ownedNext(walk, 'work.author');
  assert.deepEqual(next.jobs.map((job) => job.status), ['awaiting_owner']);
  assert.deepEqual(next.frontier, { state: 'awaiting-owner', actionable: false });
  assert.deepEqual(next.nextActions.map((action) => [action.kind, action.origin, action.op]), [['owner-gate', 'pending-ask', 'work.author']]);
  assert.deepEqual(next.menu, []);
});
