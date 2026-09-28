// api finish: finalize an owner-approved workflow and release its kernel seat.
import { getWorkflow } from '../api-lib/rows.mjs';
import { requirePhase } from '../api-lib/lifecycle.mjs';
import { kernelCustodyOf } from '../api-lib/kernel-seat.mjs';
import { handoverGateOf } from '../handover.mjs';

export default {
  verb: 'finish',
  required: ['workflow'],
  kernelOnly: true,
  usageInCore: true,
  run({ ledger, args, emit, internals }) {
    const { FINAL_SETTLED, releaseKernelSeat, closeHeldTasks, retainAfterEnd, closeKernelTerminal } = internals;
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
  const handoverGate = already ? null : handoverGateOf(db, workflowId);
  if (handoverGate && !handoverGate.ok) {
    throw Object.assign(new Error(`workflow ${workflowId} cannot finish: ${handoverGate.reason}; run handover.review as the final leg and let the owner approve it (api status handover)`), {
      code: 'handover-not-approved', approvedSeq: handoverGate.approvedSeq ?? null, lastBusinessSettleSeq: handoverGate.lastBusinessSettleSeq ?? null,
    });
  }
  const handoverFinish = handoverGate ? { via: handoverGate.via, approvedSeq: handoverGate.approvedSeq ?? null, answeredBy: handoverGate.approval?.answeredBy ?? null } : null;

  // Finish ≠ erase: goals/events/jobs history stays. Live Kernel custody does
  // not: release the singleton signal and settle its job before asking Orca
  // to close the exact terminal.
  const seat = kernelCustodyOf(db, workflowId), kernelTerminal = seat.terminal;
  let closed = 0, incidentsClosed = 0, kernelSignalsReleased = 0, kernelJobsSettled = 0;
  ledger.transaction(() => {
    db.prepare("UPDATE workflows SET phase='finished', finished_json=?, updated_at=? WHERE workflow_id=?")
      .run(JSON.stringify({ finishedAt: now, by: 'kernel-api', ...(handoverFinish ? { handover: handoverFinish } : {}) }), now, workflowId);
    closed = db.prepare("UPDATE inbox SET status='done', applied_at=? WHERE workflow_id=? AND status NOT IN ('done','applied')").run(now, workflowId).changes;
    // H12: a finished workflow keeps no open incident (DBTREE workflows_close_incidents).
    incidentsClosed = db.prepare("UPDATE incidents SET status='resolved', last_progress=COALESCE(last_progress,'')||?, updated_at=? WHERE workflow_id=? AND status='open'")
      .run(' [resolved: workflow-finished]', now, workflowId).changes;
    ({ kernelSignalsReleased, kernelJobsSettled } = releaseKernelSeat(db, workflowId, seat,
      { status: 'succeeded', result: { verdict: 'pass', reason: 'workflow-finished', at: now }, stamp: { finishedAt: now }, now }));
    ledger.appendEvent({
      workflowId, entityType: 'workflow', entityId: workflowId,
      kind: 'workflow-finished', payload: { inboxClosed: closed, incidentsClosed, alreadyFinished: already, kernelSignalsReleased, kernelJobsSettled, kernelTerminal, ...(handoverFinish ? { handover: handoverFinish } : {}) },
    });
  });
  const tasksClosed = closeHeldTasks(db, workflowId, kernelTerminal, now);
  const retention = retainAfterEnd(db, now);

  const out = { ok: true, workflowId, phase: 'finished', inboxClosed: closed, incidentsClosed, alreadyFinished: already,
    kernelSignalsReleased, kernelJobsSettled, kernelTerminal, kernelTerminalCloseRequested: Boolean(kernelTerminal),
    tasksClosed, retention, ...(handoverFinish ? { handover: handoverFinish } : {}) };
  emit(out, `workflow ${workflowId} finished${already ? ' (was already finished)' : ''} — inbox rows closed: ${closed}; kernel signal released=${kernelSignalsReleased}, kernel job settled=${kernelJobsSettled}${tasksClosed.length ? `, ${tasksClosed.length} open Task(s) closed` : ''}${kernelTerminal ? `, terminal ${kernelTerminal} close requested` : ''}; history preserved`, args.json);
  closeKernelTerminal(kernelTerminal, { owner: `kernel:${workflowId}:finish` });

  },
};
