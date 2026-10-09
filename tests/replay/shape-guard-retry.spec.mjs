// Replay of the StarCi stall of 2026-10-09 (registry: shape-guard-refuses-the-retry-the-failure-route-queued): work.author was blocked, the failure route
// (upstream-lands-first) queued its retry behind the architecture leg that cures the blocker, that leg landed, and dispatch-ready then skipped the retry on every push
// for 23 hours as "same-failing-shape (grant-too-narrow)" of the job it was queued to replace. The guard and the route contradicted each other, and the Kernel menu
// offered only a widen for a gap that is no narrow grant. Sequence: the failure route's state, the engine restarts, the Kernel attests its READ, the dispatch push.
// Real: the Kernel verbs status and dispatch-ready (children: its route and dispatch steps run for real up to the launch), the shape guard, the report-text cause
// matcher, the menu builder, the engine. Stubbed: the Orca binary only, so the launch stops at the owner's launch-trust profile (the replay world adopts none).
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFixture, replayWorld } from '../helpers/replay-world.mjs';

const fixture = loadFixture('shape-guard');
const retry = fixture.jobs.find((job) => job.retryOf);
const failed = fixture.jobs.find((job) => job.id === retry.retryOf);

test('the retry the failure route queued behind its curing leg is dispatched, not skipped as the shape of the job it replaces', async (t) => {
  const { causesOf } = await import('../../scripts/kernel/progress-rca.mjs');
  const world = replayWorld(t, fixture, { tree: true });
  const cause = causesOf({ status: 'failed', result: failed.result, report: { outcome: failed.report.outcome, blocker: { kind: failed.report.blocker.kind, detail: 'the fix needs files outside the owned paths' } } });
  // The live job was read as a too-narrow grant by the words of its blocker; its typed kind (sds-gap) names an upstream record gap, which the route table repairs.
  assert.deepEqual(cause, ['record-gap'], `the typed blocker kind classifies the failed job (${cause.join(', ')})`);

  assert.equal(world.engine({ controllers: ['job', 'workflow'], passes: 1 }).ok, true, 'the engine restarts over the queued retry');
  const status = world.status();
  assert.deepEqual(status.progress.readyJobs, [retry.id], 'the retry is ready: its curing leg landed');
  assert.deepEqual(status.menu.map((item) => item.id).filter((id) => id.startsWith('shape-refused:')), [], 'the Kernel is not asked to widen a grant that is not narrow');

  assert.equal(world.ack([retry.op]).status, 0, 'the Kernel attests its READ of the op');
  const push = world.cli('dispatch-ready', ['--workflow', world.wf, '--foreground']);
  assert.equal(push.status, 0, push.stderr || push.stdout);
  const [result] = push.json.results;
  assert.equal(result.jobId, retry.id);
  assert.equal(result.skipped, undefined, `the guard did not skip it: ${result.skipped}`);
  assert.equal(typeof result.dispatched, 'boolean', 'the push went on to route and dispatch the job');
  assert.equal(result.refusal?.step ?? 'launch-trust', 'launch-trust', 'whatever stops it is the launch seam, not the guard');
});
