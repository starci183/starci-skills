// Replay of the two stalls of 2026-10-09 on runtime 9ec024066 (registry: ready-job-never-dispatched-no-owner, grammar-context-reads-the-main-checkout-not-the-workflow-tree,
// run-fence-spends-pool-strikes-and-is-never-repaired, lineage-excludes-every-pool-of-the-tier): a ready job sat 15 minutes with nothing running and no problem line.
//   g (Nivo): worker-start of the ready architecture.decide retry was refused consumer_fenced three times (the Kernel terminal was not the coordinator Orca had bound to the
//       workflow Run; run-show named none), each refusal spent a pool strike, both pools were excluded and the admission answered no-eligible-candidate for ever.
//   h (StarCi): the ready interface.draw was refused grammar-context-missing on every push because the brand record a finished brand leg wrote lives in the workflow tree, while
//       the grammar context was resolved against the main checkout.
// Sequence of each: the world as the live ledger left it, the Kernel attests its READ, dispatch pushes (the Workflow controller's verb, run in the foreground), an engine restart.
// Real: dispatch-ready and its route and dispatch children (admission, pool strikes, grammar context, launch trust, the Run binder), the engine. Stubbed: the Orca binary (its
// worker-start refuses consumer_fenced until a run-use binds the Run, as the live host did) and nothing else; launch trust and the Devin quota seat are adopted for the world's roots.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { loadFixture, replayWorld } from '../helpers/replay-world.mjs';

const push = (world) => world.cli('dispatch-ready', ['--workflow', world.wf, '--foreground'], { timeout: 300_000 }).json;

/** The pushes of the g sequence until the retry is dispatched (at most four, the fourth being where the live host stood for ever). */
function fencedPushes(t) {
  const fixture = loadFixture('fenced-retry');
  const retry = fixture.jobs.find((job) => job.retryOf);
  const world = replayWorld(t, fixture, { tree: true, launch: true });
  world.env.STARCI_FAKE_ORCA_START_FENCED = '1';
  assert.equal(world.ack([retry.op]).status, 0, 'the Kernel attests its READ of the op');
  const results = [];
  for (let i = 0; i < 4 && !results.at(-1)?.dispatched; i += 1) results.push(push(world).results[0] ?? { dispatched: false, error: 'the push listed no job: nothing is ready for it' });
  return { world, results };
}

const shared = [];
const cleanups = [];
before(() => { shared.push(fencedPushes({ after: (fn) => cleanups.push(fn) })); });
after(() => { for (const fn of cleanups.reverse()) fn(); });

test('g: a worker-start refused consumer_fenced re-binds the Run, no pool is excluded, and the ready retry is dispatched', () => {
  const [{ world, results }] = shared;
  assert.equal(results.at(-1).dispatched, true, `the ready retry is dispatched (pushes: ${JSON.stringify(results.map((r) => r.error ?? r.dispatched))})`);
  assert.ok(results.length <= 2, 'within two pushes, not never');
  assert.ok(world.orca().runUses.length >= 1, 'the Run was re-bound to the Kernel terminal');
  const events = world.ledger((ledger) => ledger.db.prepare("SELECT kind, payload_json FROM events WHERE kind IN ('run-rebound','op-dispatched','route-decided') ORDER BY seq").all());
  assert.ok(events.some((e) => e.kind === 'run-rebound') && events.some((e) => e.kind === 'op-dispatched'));
  const excluded = events.filter((e) => e.kind === 'route-decided').flatMap((e) => JSON.parse(e.payload_json).lineageAdjust?.excluded ?? []);
  assert.deepEqual(excluded, [], 'no pool of the tier was excluded for the binding of the host');
  assert.equal(world.engine({ controllers: ['job', 'workflow'], passes: 1 }).ok, true, 'the engine restarts over the dispatched job');
});

// OPEN (registry: run-fence-repair-retries-a-released-attempt): the launch the re-bind retries inside the same dispatch meets its own released reservation
// (attempt-released at admission), is recorded as a refusal and strikes the pool (demoted, not excluded); the next push dispatches. The test carries todo until the
// retry takes a fresh reservation; the assertion is the exact one that fix must satisfy.
test('g: the first push dispatches the retry in the same call as the re-bind, and records no refusal', { todo: 'open: the retried launch meets its released reservation' }, () => {
  const [{ results }] = shared;
  assert.equal(results.length, 1, `dispatched on the first push, not after ${results.length}: ${JSON.stringify(results.map((r) => r.error ?? r.dispatched))}`);
});

test('h: a ready interface op whose brand record lives in the workflow tree passes the grammar context and goes on to launch', (t) => {
  const fixture = loadFixture('grammar-in-tree');
  const draw = fixture.jobs.find((job) => job.op === 'interface.draw');
  const world = replayWorld(t, fixture, { tree: true, launch: true });
  assert.equal(world.ack([draw.op]).status, 0);
  assert.equal(world.engine({ controllers: ['job', 'workflow'], passes: 1 }).ok, true);
  const [result] = push(world).results;
  assert.equal(result.jobId, draw.id);
  assert.doesNotMatch(String(result.error ?? ''), /grammar-context-missing/, `the push reads the brand record of the tree: ${result.error}`);
  assert.equal(typeof result.dispatched, 'boolean', 'the push went on to route and dispatch the job');
});
