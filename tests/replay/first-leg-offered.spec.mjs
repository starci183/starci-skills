// Replay of the pre-mortem finding 1 (premortem/a9-all-legs): a freshly approved goal with no job offered an EMPTY Kernel menu, `frontier.actionable=false` and the state
// `orphaned-frontier`: `approvedLegActions` returned while no leg had a job, so nothing offered the first leg and only the Kernel prompt ("each planned op with no job row gets one")
// started the flow. With the wake rules of alpha.9 (a seat is woken only while its menu holds an item) a workflow whose Kernel yielded before enqueuing stood still, told to nobody.
// Sequence: the real status of a new workflow offers the first leg exactly like a later one; the Kernel attests and decides it; the leg behind it waits.
// Real: the Kernel verbs status, kernel-ack-rev and decide as child processes, the plan read from the ledger, the engine (a fresh process). Stubbed: the Orca binary only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFixture, replayWorld } from '../helpers/replay-world.mjs';

const legs = (menu) => menu.filter((item) => item.kind === 'leg-ready').map((item) => item.id);
const jobsOf = (world) => world.ledger((ledger) => ledger.db.prepare("SELECT op_id, status, payload_json FROM jobs WHERE kind='op' ORDER BY created_at").all().map((row) => ({ op: row.op_id, status: row.status, paths: JSON.parse(row.payload_json).owned_paths })));

test('a new workflow with no job offers its first approved leg, and the leg the chat intake runs is never one', (t) => {
  const world = replayWorld(t, loadFixture('first-leg'), { tree: true });
  const status = world.status();
  assert.deepEqual(legs(status.menu), ['leg-ready:scope.define:approved-leg-open'], 'the first leg the workflow dispatches is on the menu, request.analyze is not');
  assert.equal(status.frontier.actionable, true, 'so the watchdog has a menu item to wake the Kernel for');
  assert.notEqual(status.frontier.state, 'orphaned-frontier');
  const item = status.menu[0];
  assert.match(item.subject.attest, /--digest <readToken>/, 'the READ attestation is taught in the form a Kernel can run: it writes no file, so --read-manifest <file> is no instruction for it');
  assert.doesNotMatch(item.question, /read-manifest/);
  assert.deepEqual(item.options.map((option) => option.choice), ['enqueue-leg', 'none-fits'], 'the escape is free text; scope.define writes no feature family, so there is no proposal');
});

test('the Kernel enqueues the first leg from the menu, and the leg behind it waits for it', (t) => {
  const world = replayWorld(t, loadFixture('first-leg'), { tree: true });
  assert.equal(world.ack(['scope.define']).status, 0);
  const answered = world.cli('decide', ['--workflow', world.wf, '--item', 'leg-ready:scope.define:approved-leg-open', '--choice', 'enqueue-leg', '--text', '.starciwork/features/own-1', '--reason', 'the scope']);
  assert.equal(answered.status, 0, answered.stderr || answered.stdout);
  assert.deepEqual(jobsOf(world).map((job) => [job.op, job.status, job.paths]), [['scope.define', 'queued', ['.starciwork/features/own-1']]]);
  assert.deepEqual(world.status().menu.map((item) => item.id), [], 'the first leg has its job and the business leg behind it waits for it');
});

test('a first leg whose write set the plan declares is the Job controller\'s move: the engine enqueues it with no Kernel turn', (t) => {
  const fixture = loadFixture('first-leg');
  fixture.plan.legs = fixture.plan.legs.map((leg) => (leg.op === 'scope.define' ? { ...leg, paths: ['.starciwork/features/own-1'] } : leg));
  const world = replayWorld(t, fixture, { tree: true });
  assert.deepEqual(world.status().menu, [], 'a declared write set is not a judgment');
  assert.equal(world.engine({ controllers: ['job', 'workflow'], passes: 1, unbound: true }).ok, true);
  assert.deepEqual(jobsOf(world).map((job) => [job.op, job.paths]), [['scope.define', ['.starciwork/features/own-1']]], 'the first leg has its job');
});

test('between two legs, with no op job open, the Job controller still lists the workflow and enqueues the declared next leg', (t) => {
  const fixture = loadFixture('first-leg');
  fixture.plan.legs = fixture.plan.legs.map((leg) => (leg.op === 'business.decide' ? { ...leg, paths: ['.starciwork/features/own-1/br'] } : leg));
  fixture.jobs = [{ id: 'job-1', op: 'scope.define', status: 'succeeded', owned: ['own-1'] }];
  const world = replayWorld(t, fixture, { tree: true });
  assert.deepEqual(world.status().menu, []);
  assert.equal(world.engine({ controllers: ['job', 'workflow'], passes: 1, unbound: true }).ok, true);
  assert.deepEqual(jobsOf(world).filter((job) => job.op === 'business.decide').map((job) => job.paths), [['.starciwork/features/own-1/br']], 'the settled leg left no live op job, yet the next leg got its job');
});

const endFixture = (legs, jobs = [{ id: 'job-1', op: 'scope.define', status: 'succeeded', owned: ['own-1'] }]) => {
  const fixture = loadFixture('first-leg');
  fixture.plan.legs = [{ op: 'request.analyze' }, ...legs.map((op) => ({ op })), { op: 'handover.review' }];
  fixture.plan.edges = [['request.analyze', legs[0]], ...legs.slice(1).map((op, index) => [legs[index], op]), [legs.at(-1), 'handover.review']];
  fixture.jobs = jobs;
  return fixture;
};

test('every leg settled, the chat-intake leg has no job: the handover is due and the engine enqueues handover.review', (t) => {
  const world = replayWorld(t, endFixture(['scope.define']), { tree: true });
  const status = world.status();
  assert.equal(status.handover.due, true, 'request.analyze is settled before the workflow exists: it never holds the handover back');
  assert.equal(status.frontier.state, 'handover-due');
  assert.equal(world.engine({ controllers: ['job', 'workflow'], passes: 1, unbound: true }).ok, true);
  assert.deepEqual(jobsOf(world).map((job) => [job.op, job.paths]).filter(([op]) => op === 'handover.review'), [['handover.review', ['.starciwork/evidence/wf-1.handover']]], 'the final leg has its job with no Kernel turn');
});

test('a test leg the specs switches defer is enqueued by the engine, settles deferred, and neither it nor the leg behind it holds the flow', (t) => {
  const world = replayWorld(t, endFixture(['scope.define', 'e2e.verify']), { tree: true });
  assert.deepEqual(world.status().menu, [], 'a deferred leg is no judgment: its write set is never used');
  assert.equal(world.engine({ controllers: ['job', 'workflow'], passes: 1, unbound: true }).ok, true);
  assert.deepEqual(jobsOf(world).filter((job) => job.op === 'e2e.verify').map((job) => job.status), ['cancelled'], 'the deferral is recorded by the leg\'s own enqueue');
  const status = world.status();
  assert.equal(status.handover.due, true, 'a deferred test leg counts as settled for the handover');
  assert.equal(status.frontier.actionable, false);
  assert.equal(status.frontier.state, 'handover-due');
  assert.equal(world.engine({ controllers: ['job', 'workflow'], passes: 1, unbound: true }).ok, true);
  assert.equal(jobsOf(world).filter((job) => job.op === 'handover.review').length, 1, 'and the handover leg follows by itself');
});
