// The walk of the two authentication workflows, leg 9, backend.implement, and the unhappy path a late leg meets first on a host without an installed toolchain: the op writes the module and
// its spec, runs the gate the contract orders, the gate cannot run (exit 2), and the op reports `blocked` with the typed kind `environment` (never done on a gate that did not run).
// The runtime owns the next step: the verdict is blocked, the failure is routed by the table to the owner (`environment-needs-the-user`), and the workflow reads awaiting-owner.
// Real: status, decide, enqueue (the write grant is judged against the workflow tree), dispatch, report, the engine, the failure router. Stubbed: the Orca binary, the op itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { seededWalk } from '../helpers/walk-seed.mjs';
import { walkLeg } from '../helpers/walk-legs.mjs';

test('backend.implement blocked on the environment ends in exactly one owned step: the owner gate', async (t) => {
  const walk = await seededWalk(t, 'backend.implement');
  const out = await walkLeg(walk, 'backend.implement', { within: ['features/identity'] });
  assert.equal(out.steps.find((step) => step.step === 'enqueue(decide)').ok, true, 'the grant under the workflow tree is accepted at enqueue');
  assert.equal(out.steps.find((step) => step.step === 'dispatch').ok, true);
  assert.equal(out.steps.find((step) => step.step === 'report').ok, true, 'the blocked report is filed');
  assert.equal(out.status, 'failed');
  const settled = walk.events(['job-settle-settled']).map((event) => JSON.parse(event.payload_json));
  assert.deepEqual(settled.map((event) => [event.verdict, event.via]), [['blocked', 'report-blocked']]);
  walk.engine({ passes: 2, controllers: ['job', 'workflow'] });
  const status = walk.status();
  assert.equal(status.frontier.state, 'awaiting-owner');
  assert.deepEqual(status.nextActions.map((action) => [action.kind, action.origin, action.op]), [['owner-gate', 'owner-gate', 'backend.implement']]);
  assert.deepEqual(status.menu, [], 'nothing waits on the Kernel');
});
