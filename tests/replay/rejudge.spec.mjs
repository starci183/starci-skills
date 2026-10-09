// Replay of the Nivo sequence (registry: failed-leg-with-runtime-owed-blocker-cannot-be-rejudged): architecture.decide try 2 wrote its records and only its own Critic never
// started; it failed blocked (CRITIC_UNAVAILABLE), the runtime preserved the product, and the leg was about to spend a third 13M-token attempt. The failure router now admits a
// `rejudge` job instead: no worker is launched, the runtime restores the preserved product, its own Critic runs ONCE, and the leg settles on that verdict.
// Real: the engine, the Job controller (failed-no-step route, then the settler), the admission and READ proof, the tree and its git. Stubbed: Orca and the Critic agent launch.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadFixture, replayWorld } from '../helpers/replay-world.mjs';

const fixture = loadFixture('critic-held');
const [failed] = fixture.jobs;
const REF = `refs/heads/preserved/${fixture.workflow.id}/${failed.id}`;
const CRITIC = { op: failed.op, within: ['features/d1/sds'], maker: 'claude', critic: 'codex' };

/** The state the failed settle left: the product committed on the preserved ref and gone from the tree, and the event that names the ref. */
function preserve(world) {
  const { tree } = world;
  tree.git('checkout', '-q', '-b', `preserved/${world.wf}/${failed.id}`);
  tree.git('add', '-A');
  tree.git('commit', '-qm', `preserve ${world.wf}/${failed.id}: uncommitted work of its worktree`);
  tree.git('checkout', '-q', tree.branch);
  world.ledger((ledger) => ledger.transaction(() => ledger.appendEvent({ workflowId: world.wf, entityType: 'job', entityId: failed.id, kind: 'workflow-op-preserved', payload: { preservedRef: REF } })));
}
const rows = (world, sql, ...args) => world.ledger((ledger) => ledger.db.prepare(sql).all(...args));

test('a leg blocked only on a Critic that never started is re-judged by the runtime on its preserved product: no third op attempt, one Critic run, the leg settles on its verdict', (t) => {
  const world = replayWorld(t, fixture, { tree: true });
  preserve(world);
  const product = path.join(world.tree.dir, '.starciwork/features/d1/sds/rec-1/index.yaml');
  assert.equal(fs.existsSync(product), false, 'the failed settle took the product out of the tree');

  const out = world.engine({ controllers: ['job', 'workflow'], passes: 3, critic: { tree: world.tree.dir, ...CRITIC } });
  assert.equal(out.ok, true, JSON.stringify(out).slice(0, 400));

  const lineage = rows(world, "SELECT job_id, status, try_no FROM jobs WHERE retry_of=?", failed.id);
  assert.equal(lineage.length, 1, 'one next attempt of the lineage');
  assert.equal(lineage[0].status, 'succeeded', 'it settled on the runtime Critic verdict');
  assert.equal(rows(world, "SELECT status FROM jobs WHERE job_id=?", failed.id)[0].status, 'failed', 'the failed row is never mutated');
  assert.equal(rows(world, "SELECT count(*) n FROM events WHERE kind IN ('op-dispatched','dispatch-attested','worker-attested')").at(0).n, 0, 'no worker was launched: zero op tokens');
  const runs = rows(world, "SELECT payload_json FROM events WHERE kind='runtime-critic-run'").map((row) => JSON.parse(row.payload_json));
  assert.equal(runs.length, 1, 'the Critic ran once');
  assert.equal(runs[0].pass, true);
  assert.equal(fs.existsSync(product), true, 'the preserved product was restored onto the workflow tree');
  const steps = rows(world, "SELECT payload_json FROM events WHERE kind='failure-routed' AND entity_id=?", failed.id).map((row) => JSON.parse(row.payload_json));
  assert.deepEqual(steps.map((s) => [s.kind, s.route]), [['rejudge', 'rejudge-of-a-preserved-product']]);
  const admitted = rows(world, "SELECT payload_json FROM events WHERE kind='job-rejudge-admitted'").map((row) => JSON.parse(row.payload_json));
  assert.equal(admitted.length, 1, 'journalled once');
  assert.equal(admitted[0].of, failed.id);
  const status = world.status();
  const dependant = status.frontier.queued?.find((item) => item.jobId === 'job-2');
  assert.notEqual(dependant?.queuedBecause, 'dependency-failed', 'the dependant no longer waits on a failed leg');
});

test('bounded to one re-judgment per preserved digest, and refused with a typed code when its precondition does not hold', (t) => {
  const world = replayWorld(t, fixture, { tree: true });
  preserve(world);
  const first = world.cli('reconcile', ['--workflow', world.wf, '--job', failed.id, '--route-failure']);
  assert.equal(first.status, 0, `${first.stderr} ${first.stdout}`.slice(0, 900));
  assert.equal(first.json.step.kind, 'rejudge', JSON.stringify(rows(world, "SELECT payload_json FROM events WHERE kind='job-rejudge-refused'")));
  const events = rows(world, "SELECT payload_json FROM events WHERE kind='job-rejudge-admitted'");
  assert.equal(events.length, 1);

  const bare = replayWorld(t, fixture, { tree: true });
  const noRef = bare.cli('reconcile', ['--workflow', bare.wf, '--job', failed.id, '--route-failure']);
  assert.equal(noRef.json.step.kind, 'retry', 'with no preserved product the router takes the retry route');
  assert.equal(rows(bare, "SELECT count(*) n FROM events WHERE kind='job-rejudge-admitted'")[0].n, 0);
});
