// An unhappy path of the walk of the two authentication workflows, on a late leg (work.author): it ends in exactly one owned next step and never in silence.
// Real: status, decide, enqueue, dispatch, the engine and the Job controller's dead-worker recovery. Stubbed: the Orca binary (the worker's terminal is gone).
import test from 'node:test';
import assert from 'node:assert/strict';
import { seededWalk } from '../helpers/walk-seed.mjs';
import { startLeg } from '../helpers/walk-scenarios.mjs';

test('a worker that dies mid-attempt is requeued on the same attempt by the Job controller, without a business try spent', async (t) => {
  const walk = await seededWalk(t, 'work.author');
  const { jobId } = startLeg(walk, 'work.author');
  walk.world.env.STARCI_FAKE_ORCA_MODE = 'dead-terminal';
  const before = walk.status();
  assert.deepEqual([before.frontier.state, before.frontier.deadWorkerJobs], ['worker-dead', [jobId]]);
  assert.equal(before.frontier.actionable, false, 'the runtime settles it, not the Kernel');
  walk.engine({ passes: 1, controllers: ['job', 'workflow'] });
  const requeued = walk.events(['dead-worker-requeued']).map((event) => JSON.parse(event.payload_json));
  assert.equal(requeued.length >= 1, true, 'the Job controller requeued the dead worker');
  assert.equal(requeued[0].attemptConsumed, false);
  assert.equal(walk.job(jobId).try_no, 1, 'no business try was spent');
  assert.deepEqual(walk.status().menu, [], 'nothing waits on the Kernel');
});
