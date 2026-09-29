import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { withLedger, seedWorkflow } from './_ledger-fixture.mjs';
import { stallFindings } from '../scripts/supervisor/stall.mjs';

const API = path.resolve(import.meta.dirname, '../scripts/kernel/api.mjs');
const WF = 'wf-supervisor-hold-spec';
const NOW = Date.now();
const MIN = 60_000;

function fixture(ledger, holds, extraJobs = []) {
  seedWorkflow(ledger, {
    id: WF, now: NOW - 120 * MIN, state: { phase: 'running' },
    goal: { json: { opChain: { legs: [{ op: 'backend.implement' }, { op: 'interface.implement' }, { op: 'handover.review' }],
      edges: [['backend.implement', 'handover.review'], ['interface.implement', 'handover.review']] } } },
    events: [
      { kind: 'op-dispatched', payload: { jobId: 'job-held' }, created_at: NOW - 90 * MIN },
      { kind: 'incident-raised', entityType: 'incident', entityId: 'inc-supervisor-hold',
        payload: { kind: 'supervisor-gate', holds, detail: 'runtime repair pending' }, created_at: NOW - 80 * MIN },
    ],
    jobs: [{ jobId: 'job-held', opId: 'backend.implement', status: 'queued', createdAt: NOW - 90 * MIN, updatedAt: NOW - 90 * MIN }, ...extraJobs]
      .map((job) => ({ ...job, payload: { opId: job.opId, owned_paths: [`.starciwork/evidence/${WF}.${job.opId}`] } })),
  });
  ledger.db.prepare("INSERT INTO incidents(incident_id,workflow_id,op_id,kind,owner,last_progress,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)")
    .run('inc-supervisor-hold', WF, 'backend.implement', 'runtime-defect', 'supervisor', '[supervisor-gate] runtime repair pending', 'open', NOW - 80 * MIN, NOW - 80 * MIN);
}

function status(repo) {
  const r = spawnSync(process.execPath, [API, 'status', '--repo', repo, '--workflow', WF, '--json'], {
    encoding: 'utf8', windowsHide: true, env: { ...process.env, STARCI_AUTOPILOT: 'off', STARCI_CONNECTORS_OFF: '1' },
  });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

for (const holds of [['*'], ['backend.implement', 'interface.implement']]) test(`supervisor gate ${holds.join(',')} holds queued and proposed dispatches without a stall wake`, (t) => withLedger(t, ({ repoRoot, ledger }) => {
  fixture(ledger, holds);
  const s = status(repoRoot);
  assert.equal(s.frontier.queued.find((q) => q.jobId === 'job-held').queuedBecause, 'supervisor-gate');
  assert.equal(s.frontier.state, 'supervisor-wait');
  assert.equal(s.frontier.actionable, false);
  assert.ok(s.nextActions.some((a) => a.kind === 'dispatch' && a.op === 'interface.implement' && a.heldBy?.incident === 'inc-supervisor-hold'));
  const found = stallFindings(ledger.db, { repo: repoRoot, now: NOW, stallMinutes: 30, frontierOf: () => s, kernelTurnOf: () => 'turn-idle' });
  assert.ok(found.some((f) => f.type === 'SUPERVISOR-WAIT' && f.workflowId === WF));
  assert.ok(!found.some((f) => f.type === 'STALLED' && f.workflowId === WF));
}));

test('a ready job outside a named supervisor gate remains actionable', (t) => withLedger(t, ({ repoRoot, ledger }) => {
  fixture(ledger, ['job-held'], [{ jobId: 'job-free', opId: 'interface.implement', status: 'queued', createdAt: NOW - 90 * MIN, updatedAt: NOW - 90 * MIN }]);
  const s = status(repoRoot);
  assert.equal(s.frontier.queued.find((q) => q.jobId === 'job-free').queuedBecause, 'ready');
  assert.equal(s.frontier.actionable, true);
  assert.ok(s.nextActions.some((a) => a.kind === 'dispatch' && a.jobId === 'job-free' && !a.heldBy));
}));
