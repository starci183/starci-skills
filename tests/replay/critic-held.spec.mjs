// Replay of the Nivo stall of 2026-10-09 (registry: critic-hold-filed-as-owner-authority): architecture.decide try 2 finished its records and only its own Critic did
// not start (CRITIC_UNAVAILABLE); it filed `blocked` with the closest kind it had, `authority`, and the route table sent the owner a question only the runtime could answer.
// The leg failed, the dependent work.author held `dependency-failed`, the menu was empty and nobody was woken.
// Real: the engine, the Job controller (failed-no-step route), the settler, the route table, the work tree. Stubbed: Orca and the Critic agent launch (fake-critic-orca through criticSeams).
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFixture, replayWorld } from '../helpers/replay-world.mjs';
import { admitReported } from '../helpers/replay-admit.mjs';
import { MIN, NOW, digest, job, snapshot, status, workflow } from '../helpers/debug-digest-fixture.mjs';
import { criticHoldOf, effectiveBlockerKind } from '../../scripts/kernel/critic-hold.mjs';

test('a failed leg whose Critic could not start is the runtime\'s: it is retried by its own route, never put to the owner, and its dependant waits on that retry', (t) => {
  const fixture = loadFixture('critic-held');
  const world = replayWorld(t, fixture, { tree: true });
  assert.equal(world.engine({ controllers: ['job', 'workflow'], passes: 2 }).ok, true);
  const state = world.ledger((ledger) => ({
    routed: ledger.db.prepare("SELECT payload_json FROM events WHERE kind='failure-routed' AND entity_id='job-1'").all().map((row) => JSON.parse(row.payload_json)),
    incidents: ledger.db.prepare("SELECT count(*) n FROM events WHERE kind='incident-raised'").get().n,
    retry: ledger.db.prepare("SELECT job_id, status FROM jobs WHERE retry_of='job-1'").all(),
  }));
  assert.equal(state.incidents, 0, 'no owner-gate incident');
  assert.deepEqual(state.routed.map((step) => [step.kind, step.route, step.shape.blocker]), [['retry', 'checker-unavailable-is-the-runtimes', 'checker-unavailable']]);
  assert.equal(state.retry.length, 1, 'one retry carries the critique forward');
  const status = world.status();
  const [held] = status.frontier.queued.filter((item) => item.jobId === 'job-2');
  assert.notEqual(held.queuedBecause, 'dependency-failed', 'the dependant no longer waits on a failed leg nobody owns');
  assert.equal(held.blockedBy.job, state.retry[0].job_id);
});

test('a report blocked on a Critic hold that is still unsettled is judged by the runtime\'s own Critic and settles on its verdict', (t) => {
  const fixture = loadFixture('critic-held-reported');
  const [job] = fixture.jobs;
  const world = replayWorld(t, fixture, { tree: true, admit: admitReported });
  assert.equal(world.ack([job.op]).status, 0);
  const out = world.engine({ controllers: ['job'], passes: 1, critic: { tree: world.tree.dir, op: job.op, within: ['features/d1/sds'], maker: 'claude', critic: 'codex' } });
  assert.equal(out.ok, true);
  const state = world.ledger((ledger) => ({
    status: ledger.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(job.id).status,
    runs: ledger.db.prepare("SELECT payload_json FROM events WHERE kind='runtime-critic-run'").all().map((row) => JSON.parse(row.payload_json)),
    incidents: ledger.db.prepare("SELECT count(*) n FROM events WHERE kind='incident-raised'").get().n,
  }));
  assert.equal(state.runs.length, 1, 'the runtime ran the Critic once');
  assert.equal(state.runs[0].pass, true);
  assert.equal(state.status, 'succeeded', 'the finished work is kept: no third attempt');
  assert.equal(state.incidents, 0);
  assert.deepEqual(world.status().menu.map((item) => item.id).filter((id) => id.includes(job.id)), []);
});

test('the digest names a failed leg that nothing owns: dependants held dependency-failed, no incident, item, retry or menu entry', () => {
  const failed = job({ jobId: 'op-arch-1', opId: 'architecture.decide', status: 'failed', updatedAt: NOW - 59 * MIN });
  const held = { jobId: 'op-author-1', opId: 'work.author', queuedBecause: 'dependency-failed', blockedBy: { op: 'architecture.decide', job: 'op-arch-1' }, detail: 'declared --after job is failed' };
  const wf = workflow({ jobs: [failed], status: status({ menu: [], frontier: { state: 'engaged', actionable: false, openOperations: 1, queued: [held] } }) });
  const d = digest(snapshot({ workflows: [wf] }));
  const [problem] = d.problems.filter((p) => p.code === 'leg-unowned');
  assert.deepEqual([problem.params.op, problem.params.jobId, problem.params.waiting, problem.params.min], ['architecture.decide', 'op-arch-1', 1, 59]);
  const owned = workflow({ jobs: [failed], decisions: [{ id: 'di-1', kind: 'retry-decision', decider: 'kernel', status: 'open', jobId: 'op-arch-1' }], status: wf.status });
  assert.deepEqual(digest(snapshot({ workflows: [owned] })).problems.filter((p) => p.code === 'leg-unowned'), [], 'an item that names the leg owns it');
});

test('the blocker the runtime reads is the checker, whatever kind the op chose: only a Critic hold is rewritten', () => {
  const held = { outcome: 'blocked', blocker: { kind: 'authority', detail: 'CRITIC_UNAVAILABLE: the independent Critic (decision-critic, exit 3) did not start' } };
  assert.equal(criticHoldOf(held), 'CRITIC_UNAVAILABLE');
  assert.equal(effectiveBlockerKind(held), 'checker-unavailable');
  assert.equal(effectiveBlockerKind({ outcome: 'blocked', blocker: { kind: 'authority', detail: 'the goal does not say which provider to use' } }), 'authority');
  assert.equal(effectiveBlockerKind({ outcome: 'done', blocker: { kind: 'authority', detail: 'CRITIC_UNAVAILABLE' } }), 'authority', 'a report that is not blocked keeps its kind');
});
