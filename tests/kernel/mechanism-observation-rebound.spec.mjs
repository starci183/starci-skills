// Nivo 2026-10-09: the settler re-ran the READ and document checks of the reported architecture.decide in the tree put back at the -2 path
// (all green), yet the settle was refused op-gate-tool-failed: the op-proof judged the kernel's runs of 2026-10-07 in the lost tree too, as a second
// subject whose receipt names a directory no root stands for. A run in the admitted tree and a later run in its rebound tree are one subject.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { mechanismObservations } from '../../scripts/kernel/mechanism-observation.mjs';
import { PLACEMENT_REBOUND } from '../../scripts/machine/placement-rebound.mjs';

const LOST = path.join(os.tmpdir(), 'starci-obs-wf'), STANDING = path.join(os.tmpdir(), 'starci-obs-wf-2');

test('the newest native run of a subject stands across a rebound placement, whichever tree it ran in', (t) => withLedger(t, ({ ledger }) => {
  seedWorkflow(ledger, { id: 'wf-o', goal: { revision: 1, markdown: '# o' }, jobs: [{ jobId: 'op-o', opId: 'architecture.decide', status: 'reported', payload: { opId: 'architecture.decide', owned_paths: [] } }] });
  const attemptId = ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get('op-o').attempt_id;
  const span = '0123456789abcdef';
  const run = (runner, subject, at) => ledger.db.prepare(`INSERT INTO check_runs(workflow_id,attempt_id,job_id,op_id,span_id,name,phase,runner,authority,exit_code,status,started_at,finished_at,cwd,summary_json,created_at)
    VALUES('wf-o',?,'op-o','architecture.decide',?,'read-knowledge','verify',?,'runtime',0,'pass',?,?,?,?,?)`)
    .run(attemptId, span, runner, at, at + 1, subject, JSON.stringify({ native: { schema: 'starci/read-digest@1', profile: 'code', project: null, subject, scopes: ['.'], stable: true, process: { status: 0 } } }), at);
  run('kernel', LOST, 1000);
  run('settler', STANDING, 2000);
  const context = { attemptId, roots: [STANDING], admittedAt: 0, primary: STANDING };
  assert.deepEqual(mechanismObservations(ledger.db, context).map((o) => o.native.subject).sort(), [LOST, STANDING].sort(), 'without a rebound the two trees are two subjects');
  ledger.transaction(() => ledger.appendEvent({ workflowId: 'wf-o', entityType: 'attempt', entityId: String(attemptId), attemptId, kind: PLACEMENT_REBOUND,
    payload: { jobId: 'op-o', attemptId, from: [LOST], to: STANDING, arm: 'rebind', reason: 'tree-reattached' } }));
  const observed = mechanismObservations(ledger.db, context);
  assert.equal(observed.length, 1);
  assert.equal(observed[0].native.subject, STANDING, 'the newest run, in the tree that stands, is the observation');
}));
