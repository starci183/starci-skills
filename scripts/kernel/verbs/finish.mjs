// starci kernel finish: finalize an owner-approved workflow and release its kernel seat.
import { changeWorkflowPhase, resolveIncident, setInboxStatus, updateIncident } from '../../../engine/db/ledger.mjs';
import { getWorkflow } from './shared/rows.mjs';
import { requirePhase } from './shared/workflow-transitions.mjs';
import { kernelCustodyOf } from './shared/kernel-seat.mjs';
import { closeKernelTerminal, releaseKernelSeat, retainAfterEnd } from './shared/workflow-end.mjs';
import { handoverGateOf } from '../handover.mjs';
import { closeWorkflowDecisions } from '../../machine/decisions.mjs';
import { CHECKPOINT_EVENTS, finishWorkflow } from '../workflow-checkpoint.mjs';
import { workflowWorktreeOf } from '../../machine/workflow-tree.mjs';
import { withWorkflowLock } from '../../goal/workflow-lock.mjs';

export default {
  verb: 'finish',
  required: ['workflow'],
  kernelOnly: true,
  usageInCore: true,
  run({ ledger, args, repo, emit, internals }) {
    return withWorkflowLock({ db: ledger.db, ledger, env: process.env }, { workflowId: args.workflow }, (locked) => {
    const { FINAL_SETTLED } = internals;
  const db = ledger.db, workflowId = args.workflow, now = Date.now();
  const wf = getWorkflow(db, workflowId);
  if (!wf) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  const already = wf.phase === 'finished';
  // running -> finished only (DBTREE workflow_transitions): a paused or stopped workflow is resumed first.
  requirePhase(wf, ['running', 'finished'], 'finish');

  const openOperations = db.prepare(
    `SELECT job_id,status FROM jobs WHERE workflow_id=? AND kind<>'kernel' AND status NOT IN (${FINAL_SETTLED.map(() => '?').join(',')}) ORDER BY created_at,job_id`
  ).all(workflowId, ...FINAL_SETTLED);
  if (!already && openOperations.length) {
    throw Object.assign(new Error(`workflow ${workflowId} still has ${openOperations.length} unsettled operation(s)`), {
      code: 'workflow-open-jobs', openJobs: openOperations,
    });
  }
  // A workflow is done when the owner approved its handover: a handover-approved
  // event newer than the last business settle (scripts/kernel/handover.mjs
  // handoverGateOf). An archived workflow is the one existing way out.
  // An accepted revision must be planned, never silently disposed by finish.
  const pendingRevisions = db.prepare("SELECT inbox_id,payload_json FROM inbox WHERE workflow_id=? AND kind='goal-revision' AND status='pending' ORDER BY inbox_id").all(workflowId);
  if (!already && wf.archived_at == null && pendingRevisions.length) throw Object.assign(new Error(`workflow ${workflowId} still has an unapplied goal revision`), {
    code: 'handover-not-approved', pendingRevisions: pendingRevisions.map(row => row.inbox_id),
  });
  const handoverGate = already ? null : handoverGateOf(db, workflowId);
  if (handoverGate && !handoverGate.ok) {
    throw Object.assign(new Error(`workflow ${workflowId} cannot finish: ${handoverGate.reason}; run handover.review as the final leg and let the owner approve it (starci kernel status handover)`), {
      code: 'handover-not-approved', approvedSeq: handoverGate.approvedSeq ?? null, lastBusinessSettleSeq: handoverGate.lastBusinessSettleSeq ?? null,
    });
  }
  if (handoverGate?.via === 'handover-approved') {
    const approvedJob = db.prepare('SELECT * FROM jobs WHERE job_id=? AND workflow_id=?').get(handoverGate.approval.jobId, workflowId);
    if (!approvedJob) throw Object.assign(new Error('the handover approval has no bound job'), { code: 'handover-not-approved' });
    internals.handoverProofGate(db, approvedJob, repo);
  }
  const handoverFinish = handoverGate ? { via: handoverGate.via, approvedSeq: handoverGate.approvedSeq ?? null, answeredBy: handoverGate.approval?.answeredBy ?? null } : null;

  // The workflow's single land into main (WFWT, scripts/kernel/workflow-checkpoint.mjs finishWorkflow): the full gate,
  // the merge guard, review.verify of the exact head, the rebase, main fast-forwarded and pushed, the worktree marked
  // release-pending (part A's GC removes it and the workflow branch; the finish runs inside it and never removes it). A refusal keeps
  // the workflow running; the finish runs again once its cause is fixed.
  const wfCtx = locked;
  const land = !already && workflowWorktreeOf(wfCtx, workflowId) ? finishWorkflow(wfCtx, { workflowId }) : null;
  if (land && !land.ok) {
    throw Object.assign(new Error(`workflow ${workflowId} cannot finish: ${land.refusal.code} at ${land.refusal.step} - ${land.refusal.detail}`), {
      code: land.refusal.code, step: land.refusal.step, steps: land.steps,
    });
  }

  // Finish ≠ erase: goals/events/jobs history stays. Live Kernel custody does
  // not: release the singleton signal and settle its job before asking Orca
  // to close the exact terminal.
  const seat = kernelCustodyOf(db, workflowId), kernelTerminal = seat.terminal;
  let closed = 0, incidentsClosed = 0, kernelSignalsReleased = 0, kernelJobsSettled = 0, decisionsClosed = [];
  ledger.transaction(() => {
    for (const row of db.prepare("SELECT inbox_id FROM inbox WHERE workflow_id=? AND status NOT IN ('done','applied') ORDER BY inbox_id").all(workflowId)) {
      if (setInboxStatus(db, { inboxId: row.inbox_id, status: 'done', at: now })) closed++;
    }
    // H12: a finished workflow keeps no open incident (DBTREE workflows_close_incidents): each closes with its reason
    // (incidents.resolved_reason enum: workflow-ended; the trail keeps workflow-finished) before the phase moves.
    for (const row of db.prepare("SELECT incident_id, last_progress FROM incidents WHERE workflow_id=? AND status='open'").all(workflowId)) {
      updateIncident(db, { incidentId: row.incident_id, lastProgress: `${row.last_progress ?? ''} [resolved: workflow-finished]`, at: now });
      if (resolveIncident(db, { incidentId: row.incident_id, reason: 'workflow-ended', at: now })) incidentsClosed++;
    }
    // H12 for decisions: a finished workflow keeps no live Decision Item — each resolves by runtime (verb
    // workflow-finished); a leftover could never be decided and would keep being counted, escalated and digested.
    decisionsClosed = closeWorkflowDecisions(ledger, workflowId, { verb: 'workflow-finished', now });
    // running -> finished (workflow_transitions) with its lifecycle_changes row; already finished stays as it is.
    if (!already) changeWorkflowPhase(db, { workflowId, to: 'finished', by: `kernel:${workflowId}`, reason: 'workflow-finished', at: now,
      finished: { finishedAt: now, by: 'kernel-api', ...(handoverFinish ? { handover: handoverFinish } : {}) } });
    ({ kernelSignalsReleased, kernelJobsSettled } = releaseKernelSeat(db, workflowId, seat,
      { status: 'succeeded', result: { verdict: 'pass', reason: 'workflow-finished', at: now }, stamp: { finishedAt: now }, now }));
    if (land) ledger.appendEvent({ workflowId, entityType: 'workflow', entityId: workflowId, kind: CHECKPOINT_EVENTS.landed, payload: { head: land.head, main: land.main, repoRoot: land.repoRoot, steps: land.steps } });
    ledger.appendEvent({
      workflowId, entityType: 'workflow', entityId: workflowId,
      kind: 'workflow-finished', payload: { inboxClosed: closed, incidentsClosed, decisionsClosed, alreadyFinished: already, kernelSignalsReleased, kernelJobsSettled, kernelTerminal, ...(handoverFinish ? { handover: handoverFinish } : {}) },
    });
  });
  const retention = retainAfterEnd(db, now);

  const out = { ok: true, workflowId, phase: 'finished', inboxClosed: closed, incidentsClosed, decisionsClosed, alreadyFinished: already,
    kernelSignalsReleased, kernelJobsSettled, kernelTerminal, kernelTerminalCloseRequested: Boolean(kernelTerminal),
    retention, ...(handoverFinish ? { handover: handoverFinish } : {}), ...(land ? { landed: { head: land.head, releasePending: land.releasePending, steps: land.steps.map((st) => st.step) } } : {}) };
  emit(out, `workflow ${workflowId} finished${already ? ' (was already finished)' : ''} — inbox rows closed: ${closed}; decisions closed: ${decisionsClosed.length}; kernel signal released=${kernelSignalsReleased}, kernel job settled=${kernelJobsSettled}${kernelTerminal ? `, terminal ${kernelTerminal} close requested` : ''}; history preserved`, args.json);
  closeKernelTerminal(kernelTerminal, { owner: `kernel:${workflowId}:finish` });

    });
  },
};
