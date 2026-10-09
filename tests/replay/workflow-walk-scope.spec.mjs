// The walk of the two authentication workflows, leg 2 of the approved order (request.analyze runs in the chat intake): a freshly approved goal, the Kernel starts it through its menu,
// scope.define is dispatched, worked by the scripted op, reported through the real `starci kernel report`, settled by the real engine (checks re-run, the runtime Critic with its stub
// verdict) and checkpointed. Real: status, decide, enqueue, the dispatch push, report, the engine and its settler, the work graph verb. Stubbed: the Orca binary, the Critic agent launch,
// and the op itself (tests/helpers/walk-standins.mjs writes what the contract's `writes` name).
import test from 'node:test';
import assert from 'node:assert/strict';
import { openWalk } from '../helpers/walk-world.mjs';
import { assertNextOffered, walkSettled } from '../helpers/walk-assert.mjs';

test('scope.define: offered to the Kernel at birth, settled green, its work graph v0 recorded and the next leg offered', async (t) => {
  const walk = openWalk(t);
  const start = walk.status();
  assert.deepEqual(start.menu.map((item) => item.subject.op), ['scope.define'], 'the first leg after the external intake leg is the only item');
  assert.equal(start.frontier.actionable, true);
  const out = await walkSettled(walk, 'scope.define');
  const critic = walk.events(['runtime-critic-run']).map((event) => JSON.parse(event.payload_json));
  assert.equal(critic.length, 1, 'the runtime ran the Critic once');
  assert.deepEqual([critic[0].outcome, critic[0].pass], ['verdict', true]);
  assert.equal(walk.world.ledger((ledger) => ledger.db.prepare('SELECT count(*) AS n FROM work_graph_versions').get().n), 1, 'work graph v0 is recorded by the op through the real verb');
  assert.ok(out.jobId);
  assertNextOffered(walk, 'scope.define');
});
