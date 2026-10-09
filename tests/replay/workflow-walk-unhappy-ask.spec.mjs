// An unhappy path of the walk of the two authentication workflows, on a late leg (work.author): it ends in exactly one owned next step and never in silence.
// Real: status, decide, enqueue, dispatch, report, the Job controller. Stubbed: the Orca binary, the op itself. The Workflow controller is not run: serving an ask to the owner
// starts the ask server, a detached process a spec must not leave behind.
import test from 'node:test';
import assert from 'node:assert/strict';
import { seededWalk } from '../helpers/walk-seed.mjs';
import { fileShape, ownedNext, startLeg } from '../helpers/walk-scenarios.mjs';

test('an op that asks the owner leaves the job awaiting the owner, the ask served by the runtime, and one owner-gate step', async (t) => {
  const walk = await seededWalk(t, 'work.author');
  const { jobId } = startLeg(walk, 'work.author');
  const filed = fileShape(walk, jobId, { outcome: 'ask', question: { text: 'Which session lifetime does sign-in keep?', options: ['15 minutes', '12 hours'], recommended: 1, recommendedReason: 'the product is a daily tool' } });
  assert.equal(filed.status, 0, filed.stderr);
  walk.engine({ op: 'work.author', passes: 1 });
  const next = ownedNext(walk, 'work.author');
  assert.deepEqual(next.jobs.map((job) => job.status), ['awaiting_owner']);
  assert.deepEqual(next.frontier, { state: 'ask-reserve', actionable: false }, 'the ask is consumed; serving it to the owner is a step of the runtime, not of the Kernel');
  assert.deepEqual(next.nextActions.map((action) => [action.kind, action.origin, action.op]), [['owner-gate', 'pending-ask', 'work.author']]);
  assert.deepEqual(next.menu, []);
});
