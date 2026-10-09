// Two unhappy paths of the walk of the two authentication workflows in one sequence, on a late leg (work.author): the runtime revision changes while the op runs, and the engine restarts
// between the report and its settle. The report still settles, and the Kernel owes its re-read of the one file it reads, later.
// Real: status, decide, enqueue, dispatch, report, the engine (three separate processes), its settler and the revision notice. Stubbed: the Orca binary, the Critic agent launch, the op itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { seededWalk } from '../helpers/walk-seed.mjs';
import { startLeg } from '../helpers/walk-scenarios.mjs';
import { STANDINS } from '../helpers/walk-standins.mjs';

test('the report of an op admitted under an older runtime revision settles in a restarted engine, and the Kernel owes only the file it reads', async (t) => {
  const walk = await seededWalk(t, 'work.author');
  const { jobId } = startLeg(walk, 'work.author');
  const work = await STANDINS['work.author']({ walk, jobId });
  walk.world.reviseRuntime({ 'docs/notes.md': 'a docs-only revision\n' }, 'docs-only revision');
  walk.world.reviseRuntime({ 'modules/ops/ops/work.author.yaml': 'id: work.author\nrevised: true\n' }, 'revision of the op contract');
  assert.equal(walk.file(jobId, work.report, work.attach).status, 0);
  walk.engine({ controllers: ['workflow'], passes: 1 });
  assert.equal(walk.job(jobId).status, 'reported', 'a workflow-only engine process settles nothing');
  walk.engine({ op: 'work.author', passes: 1 });
  assert.equal(walk.job(jobId).status, 'succeeded', 'a fresh engine process settles the filed report');
  const recorded = walk.events(['settle-revision-recorded']).map((event) => JSON.parse(event.payload_json));
  assert.equal(recorded.length, 1);
  assert.notEqual(recorded[0].admitted, recorded[0].judged, 'the attempt was admitted under one revision and judged under another');
  const status = walk.status();
  assert.equal(status.revisionNotice.state, 'owed');
  assert.deepEqual(status.revisionNotice.files, ['modules/ops/ops/work.author.yaml'], 'only the file the Kernel reads is owed; the docs-only revision costs nothing');
  assert.ok(status.kernelRev.deferred, 'the re-read is deferred, not forced on a Kernel with work in flight');
});
