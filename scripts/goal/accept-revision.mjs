// Accept one content-approved goal revision under the workflow's existing serialization boundary.
import { SETTLED_JOB_STATUSES, insertGoal, postInbox, recordJobResult, setJobStatus, setInboxStatus, updateWorkflow } from '../../engine/db/ledger.mjs';
import { withWorkflowLock } from './workflow-lock.mjs';

/** Load the current goal row and prove the revision may still be applied, or report it already applied. */
function revisableState({ ledger, workflowId, preview, approveRevision }) {
  const current = ledger.db.prepare('SELECT * FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1').get(workflowId);
  let currentJson = {};
  try { currentJson = JSON.parse(current?.json || '{}'); } catch { /* handled by revision check */ }
  if (current?.revision === preview.nextRevision && currentJson?.revision?.approvalToken === approveRevision) {
    return { alreadyApplied: true };
  }
  if (current?.revision !== preview.baseRevision || current.goal_identity !== preview.goalIdentity) {
    throw new Error(`stale revision preview for ${workflowId}: expected rev ${preview.baseRevision} and identity ${preview.goalIdentity}`);
  }
  const workflow = ledger.db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(workflowId);
  if (!workflow || workflow.phase === 'finished' || workflow.archived_at !== null) throw new Error(`workflow ${workflowId} is no longer revisable`);
  if (workflow.goal_identity && workflow.goal_identity !== preview.goalIdentity) throw new Error(`workflow ${workflowId} identity changed after preview`);
  const settledMarks = SETTLED_JOB_STATUSES.map(() => '?').join(',');
  const openNow = ledger.db.prepare(`SELECT job_id,op_id,status FROM jobs WHERE workflow_id=? AND kind<>'kernel' AND status NOT IN (${settledMarks}) ORDER BY job_id`)
    .all(workflowId, ...SETTLED_JOB_STATUSES);
  const unsafeNow = openNow.filter(job => job.status !== 'queued');
  if (unsafeNow.length) {
    const unsafeList = unsafeNow.map(job => `${job.job_id}:${job.status}`).join(', ');
    throw new Error(`cannot checkpoint revision ${preview.nextRevision}: operation effects are still possible (${unsafeList})`);
  }
  const leasedQueued = ledger.db.prepare(`SELECT l.job_id,l.resource_key FROM leases l JOIN jobs j ON j.job_id=l.job_id WHERE j.workflow_id=? AND j.kind<>'kernel' AND j.status='queued' ORDER BY l.job_id,l.resource_key`).all(workflowId);
  if (leasedQueued.length) {
    const leasedList = leasedQueued.map(row => `${row.job_id}:${row.resource_key}`).join(', ');
    throw new Error(`cannot checkpoint revision ${preview.nextRevision}: queued job lease drift (${leasedList})`);
  }
  return { alreadyApplied: false, workflow, openNow };
}

/** The revision record: supervisor-provisional under autopilot, else the owner-approved form. */
function revisionAmendment({ preview, approveRevision, revisionReason, approvedBy, supervisorProvenance, now }) {
  if (approvedBy) return {
    schema: 'starci/goal-revision-approval@1',
    source: 'supervisor-autopilot',
    baseRevision: preview.baseRevision,
    nextRevision: preview.nextRevision,
    baseGoalIdentity: preview.goalIdentity,
    approvalToken: approveRevision,
    reason: revisionReason,
    changed: preview.opChainDiff,
    // Not the owner's: the Supervisor revised the legs under autopilot; the owner may revert it.
    ownerApproval: null,
    supervisorApproval: supervisorProvenance,
    provisional: true,
    approvedAt: now,
  };
  return {
    schema: 'starci/goal-revision-approval@1',
    source: 'owner-approved-goal-entry',
    baseRevision: preview.baseRevision,
    nextRevision: preview.nextRevision,
    baseGoalIdentity: preview.goalIdentity,
    approvalToken: approveRevision,
    reason: revisionReason,
    changed: preview.opChainDiff,
    ownerApproval: {
      quote: 'ok',
      threadId: null,
      messageId: null,
      messageIdAvailability: 'unavailable-to-cli',
      assurance: 'conversation-context-not-authenticated',
    },
    approvedAt: now,
  };
}

/** Cancel each still-queued open job and record its supersession event with the revision lineage. */
function supersedeOpenJobs({ ledger, workflowId, workflow, openNow, preview, approveRevision, now }) {
  for (const job of openNow) {
    const result = {
      reason: 'goal-revision-superseded', effectState: 'none',
      baseRevision: preview.baseRevision, nextRevision: preview.nextRevision,
      approvalToken: approveRevision, at: now,
    };
    if (ledger.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(job.job_id)?.status === 'queued') {
      setJobStatus(ledger.db, { jobId: job.job_id, to: 'cancelled', reason: 'goal-revision-superseded', at: now });
      recordJobResult(ledger.db, { jobId: job.job_id, result, at: now });
    }
    ledger.appendEvent({
      workflowId: workflowId, entityType: 'job', entityId: job.job_id,
      generation: workflow.generation ?? 0, kind: 'job-superseded-by-goal-revision',
      payload: { opId: job.op_id, ...result }, createdAt: now,
    });
  }
}

/** Persist the accepted revision and explicitly supersede only its older pending revision notifications. */
export function acceptGoalRevision({ ledger, workflowId, preview, approveRevision, revisionBase, text, chain, derivedPlan,
  routingBias, revisionReason, approvedBy, supervisorProvenance, bridgeId, now }) {
  return withWorkflowLock({ ledger, db: ledger.db, env: process.env }, { workflowId }, () => {
    return ledger.transaction(() => {
      const state = revisableState({ ledger, workflowId, preview, approveRevision });
      if (state.alreadyApplied) return { alreadyApplied: true, supersededJobs: [] };
      const { workflow, openNow } = state;
      const amendment = revisionAmendment({ preview, approveRevision, revisionReason, approvedBy, supervisorProvenance, now });
      const nextJson = {
        ...revisionBase.json,
        derivedFrom: approvedBy ? 'supervisor-provisional-revision' : 'owner-approved-revision',
        opChain: chain,
        derivedPlan: derivedPlan,
        routing_bias: routingBias ?? revisionBase.json?.routing_bias ?? null,
        revision: amendment,
      };
      const supersededJobs = openNow.map(job => job.job_id);
      supersedeOpenJobs({ ledger, workflowId, workflow, openNow, preview, approveRevision, now });
      insertGoal(ledger.db, { workflowId: workflowId, revision: preview.nextRevision, goalIdentity: preview.goalIdentity, markdown: text, goal: nextJson,
        amendment, approvedBy: approvedBy ? 'supervisor' : 'owner', approvalRef: approveRevision ?? null, createdAt: now });
      if (!workflow.goal_identity) updateWorkflow(ledger.db, { workflowId: workflowId, goalIdentity: preview.goalIdentity, at: now });
      // Retain every revision and close only older unapplied revision notifications with explicit lineage.
      for (const row of ledger.db.prepare("SELECT inbox_id,payload_json FROM inbox WHERE workflow_id=? AND kind='goal-revision' AND status='pending' ORDER BY inbox_id").all(workflowId)) {
        const prior = JSON.parse(row.payload_json);
        if (!Number.isInteger(prior?.revision)) throw new Error(`unreadable pending goal revision for ${workflowId}`);
        if (prior.revision < preview.nextRevision) setInboxStatus(ledger.db, { inboxId: row.inbox_id, status: 'done',
          disposition: { action: 'goal-revision-superseded', revision: prior.revision, supersededByRevision: preview.nextRevision }, at: now });
      }
      postInbox(ledger.db, { workflowId: workflowId, kind: 'goal-revision', key: `${workflowId}:${preview.nextRevision}`, fromRef: approvedBy ? 'supervisor' : 'owner', createdAt: now, payload: {
          revision: preview.nextRevision,
          baseRevision: preview.baseRevision,
          goalIdentity: preview.goalIdentity,
          approvalToken: approveRevision,
          reason: revisionReason,
          opChain: preview.opChainDiff.after,
          supersededJobs,
          ...(approvedBy ? { approvedBy: 'supervisor', provisional: true, bridgeId } : {}),
          at: now,
        } });
      ledger.appendEvent({
        workflowId: workflowId,
        entityType: 'goal',
        entityId: workflowId,
        generation: workflow.generation ?? 0,
        kind: 'goal-revised',
        payload: {
          revision: preview.nextRevision,
          previousRevision: preview.baseRevision,
          goalIdentity: preview.goalIdentity,
          approvalToken: approveRevision,
          opChainDiff: preview.opChainDiff,
          supersededJobs,
          ...(approvedBy ? { approvedBy: 'supervisor', provisional: true, bridgeId } : {}),
          kernelResume: 'resurvey-pending-revision-inbox',
        },
        createdAt: now,
      });
      return { alreadyApplied: false, supersededJobs };
    });
  });
}
