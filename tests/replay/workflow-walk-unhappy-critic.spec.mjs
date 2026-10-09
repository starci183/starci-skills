// An unhappy path of the walk of the two authentication workflows, on a judged leg (architecture.decide): it ends in exactly one owned next step and never in silence.
// Real: status, decide, enqueue, dispatch, report, the engine and its settler. Stubbed: the Orca binary, the Critic agent launch (verdict below the minimum), the op itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { seededWalk } from '../helpers/walk-seed.mjs';
import { ownedNext, startLeg } from '../helpers/walk-scenarios.mjs';
import { STANDINS } from '../helpers/walk-standins.mjs';

test('a failing Critic verdict is a Kernel item with no way to accept it; answering it fails the attempt and the retry is queued', async (t) => {
  const walk = await seededWalk(t, 'architecture.decide');
  const { jobId } = startLeg(walk, 'architecture.decide');
  const work = await STANDINS['architecture.decide']({ walk, jobId });
  assert.equal(walk.file(jobId, work.report, work.attach).status, 0);
  walk.engine({ op: 'architecture.decide', within: ['features/identity'], beauty: 3, passes: 1 });
  const next = ownedNext(walk, 'architecture.decide');
  assert.deepEqual(next.routed.map((route) => route.code), ['op-critic-verdict-failed']);
  assert.deepEqual(next.menu, [`job-decision:${jobId}`]);
  const item = walk.status().menu[0];
  assert.deepEqual(item.options.map((option) => option.choice), ['settle-fail', 'continue'], 'no option accepts a verdict the Critic failed');
  const answered = walk.world.cli('decide', ['--workflow', walk.world.wf, '--item', item.id, '--choice', 'settle-fail', '--reason', 'the critique is the retry brief']);
  assert.equal(answered.status, 0, answered.stderr || answered.stdout);
  const after = ownedNext(walk, 'architecture.decide');
  assert.deepEqual(after.jobs.map((job) => job.status), ['failed', 'queued'], 'the attempt failed and its retry is queued');
});
