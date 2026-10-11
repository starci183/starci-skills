// An unhappy path of the walk of the two authentication workflows, on a late leg (work.author): it ends in exactly one owned next step and never in silence.
// Real: status, decide, enqueue, dispatch, report, the engine, its settler and the failure router. Stubbed: the Orca binary, the Critic agent launch, the op itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { seededWalk } from '../helpers/walk-seed.mjs';
import { fileShape, ownedNext, startLeg } from '../helpers/walk-scenarios.mjs';

test('an op blocked on a record gap of its upstream (sds-gap) is routed to the repair of that upstream leg, with its own retry queued behind it', async (t) => {
  const walk = await seededWalk(t, 'work.author');
  const { jobId } = startLeg(walk, 'work.author');
  const filed = fileShape(walk, jobId, { outcome: 'blocked', blocker: { kind: 'sds-gap', detail: 'the session store owner is not declared by any sds record' } });
  assert.equal(filed.status, 0, filed.stderr);
  walk.engine({ op: 'work.author', passes: 2 });
  const next = ownedNext(walk, 'work.author');
  assert.deepEqual(next.jobs.map((job) => [job.status, job.try_no, job.retry_of === null]), [['failed', 1, true], ['queued', 2, false]], 'the failed try and its retry');
  assert.deepEqual(next.routed.map((route) => route.route), ['sds-gap-revises-the-design']);
  assert.deepEqual(next.nextActions.map((action) => [action.kind, action.op]), [['dispatch', 'architecture.decide'], ['wait', 'work.author']], 'the repair leg runs; the retry waits behind it');
  assert.deepEqual(next.menu, [], 'nothing waits on the Kernel: the runtime owns the repair');
  assert.deepEqual(next.incidents, []);
});
