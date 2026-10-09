// StarCi 2026-10-09: op-work.author-c10c110700 was blocked on an SDS gap; the failure route (upstream-lands-first) queued op-work.author-ab81f9802d
// behind the architecture leg that cured it, and dispatch-ready then refused that very retry for 23 hours as "same-failing-shape (grant-too-narrow)":
// the guard and the route contradicted each other, and the Kernel menu offered only a widen for a gap that is not a narrow grant.
import test from 'node:test';
import assert from 'node:assert/strict';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { failedShapesOf, shapeOf } from '../../scripts/kernel/kernel-authority.mjs';
import { routedBehindUpstream, UPSTREAM_ROUTE } from '../../scripts/kernel/upstream-retry.mjs';

const WF = 'wf-upstream-retry';
const T0 = Date.now() - 3_600_000;
const payload = { opId: 'work.author', records: [], owned_paths: ['.starciwork/features/auth/impl'], params: { maxFiles: 12 } };
const step = { kind: 'retry', route: UPSTREAM_ROUTE, counted: false, upstream: 'architecture.decide', mode: 'landed', jobs: ['op-work.author-retry02'] };

function seed(ledger, result) {
  seedWorkflow(ledger, { id: WF, state: { phase: 'running', job: 'upstream' }, goalIdentity: 'g', goal: { revision: 0, identity: 'g', markdown: '# goal', json: {} }, jobs: [
    { jobId: 'op-work.author-failed1', unitId: 'op-work.author-failed1', opId: 'work.author', status: 'failed', createdAt: T0, dispatchedAt: T0 + 1000, updatedAt: T0 + 120_000, payload, result },
    { jobId: 'op-work.author-retry02', unitId: 'op-work.author-failed1', opId: 'work.author', status: 'queued', tryNo: 2, retryOf: 'op-work.author-failed1', createdAt: T0 + 200_000, payload }] });
  const attempt = ledger.db.prepare('SELECT attempt_id, dispatch_id FROM op_attempts WHERE job_id=?').get('op-work.author-failed1');
  ledger.db.prepare('INSERT INTO reports(workflow_id,attempt_id,dispatch_id,job_id,outcome,report_json,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?)')
    .run(WF, attempt.attempt_id, attempt.dispatch_id, 'op-work.author-failed1', 'blocked', JSON.stringify({ outcome: 'blocked', summary: 'the fix needs files outside the owned paths', blocker: { kind: 'shared-change', detail: 'the fix needs files outside the owned paths' } }), T0 + 60_000, T0 + 30_000);
}
const retryRow = (ledger) => ledger.db.prepare('SELECT * FROM jobs WHERE job_id=?').get('op-work.author-retry02');
const withPayload = (row) => ({ ...row, payload: JSON.parse(row.payload_json) });

test('a failed job routed to a retry behind its curing leg does not poison the shape of that retry', (t) => withLedger(t, (world) => {
  const { ledger } = world;
  seed(ledger, { verdict: 'blocked', nextStep: step });
  const retry = withPayload(retryRow(ledger));
  assert.equal(failedShapesOf(ledger.db, WF, retry).get(shapeOf(retry.op_id, retry.payload)), undefined, 'the retry is new work: its curing leg landed');
  ledger.close();
}));

test('a failed job with no such route still refuses the identical shape', (t) => withLedger(t, (world) => {
  const { ledger } = world;
  seed(ledger, { verdict: 'blocked' });
  const retry = withPayload(retryRow(ledger));
  const failed = failedShapesOf(ledger.db, WF, retry).get(shapeOf(retry.op_id, retry.payload));
  assert.equal(failed?.jobId, 'op-work.author-failed1');
  ledger.close();
}));

test('only a retry step on the upstream route counts', () => {
  assert.equal(routedBehindUpstream({ nextStep: step }), true);
  assert.equal(routedBehindUpstream({ nextStep: { ...step, route: 'gap-route' } }), false);
  assert.equal(routedBehindUpstream({ nextStep: { ...step, kind: 'none' } }), false);
  assert.equal(routedBehindUpstream(null), false);
});
