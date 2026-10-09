// StarCi 2026-10-09: di-758483cb (budget-overrun of a running attempt: "the job is running and still running") stayed open and on the Kernel's list after the
// job reported. The item of a running attempt lives while its job runs; the settler's measure of the settled attempt takes its place.
import test from 'node:test';
import assert from 'node:assert/strict';
import { liveFor } from '../../scripts/machine/decision-resolution.mjs';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';

const item = (jobId, key) => ({ kind: 'budget-overrun', entity: { type: 'job', id: jobId }, idempotencyKey: key });

test('the budget-overrun item of a running attempt closes when its job reports; the item of a settled attempt lives until a later try exists', (t) => withLedger(t, ({ ledger }) => {
  seedWorkflow(ledger, { id: 'wf-b', goal: { revision: 1, markdown: '# b' }, jobs: [
    { jobId: 'op-running', opId: 'brand.decide', status: 'running', payload: { opId: 'brand.decide', owned_paths: [] } },
    { jobId: 'op-reported', opId: 'brand.decide', status: 'reported', payload: { opId: 'brand.decide', owned_paths: [] } },
    { jobId: 'op-failed', opId: 'brand.decide', status: 'failed', payload: { opId: 'brand.decide', owned_paths: [] } }] });
  const running = (id) => item(id, `budget-overrun:wf-b:attempt-12-running`);
  assert.equal(liveFor(running('op-running'), null, ledger.db), true, 'a running attempt can only be let finish');
  assert.equal(liveFor(running('op-reported'), null, ledger.db), false, 'the job reported: the settler measures it, the running item is stale');
  assert.equal(liveFor(item('op-failed', 'budget-overrun:wf-b:attempt-9'), null, ledger.db), true, 'a settled attempt waits for the Kernel until a later try exists');
  assert.equal(liveFor(item('op-reported', 'budget-overrun:wf-b:attempt-9'), null, ledger.db), true, 'a reported job is not settled yet');
  assert.equal(liveFor(item('op-gone', 'budget-overrun:wf-b:attempt-1'), null, ledger.db), false, 'no such job: nothing to decide');
}));
