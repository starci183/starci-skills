import { setJobStatus, updateAttempt } from '../../../engine/ledger-db.mjs';
import { recordWhy } from '../why-record.mjs';
import { DISPATCHES, requirePhase } from './lifecycle.mjs';

/**
 * The leased → running move, compare-and-set (H9): the job must still be leased under this dispatch's own
 * token in a workflow that dispatches. An archive, drop or reconcile that took the job while its worker was
 * starting wins; the launch is abandoned instead of resurrecting a cancelled job.
 */
export function markRunning(db, { job, jobId, reserve, worker, payload, now }) {
  const wf = db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(job.workflow_id);
  requirePhase(wf, DISPATCHES, 'dispatch');
  const row = db.prepare('SELECT status, lease_token FROM jobs WHERE job_id=?').get(jobId);
  if (row?.status !== 'leased' || row.lease_token !== reserve.leaseToken) {
    throw Object.assign(new Error(`job ${jobId} is no longer leased by this dispatch (now ${row?.status ?? 'gone'})`), { code: 'dispatch-lease-lost', status: row?.status ?? null });
  }
  setJobStatus(db, { jobId, to: 'running', reason: 'dispatched', expect: 'leased', at: now, workerId: worker, payload });
}

/** Run the running transaction; when the job or workflow moved on meanwhile, stop the started worker and refuse. */
export function runningOrAbandon(commit, { ledger, db, job, jobId, op, dispatchId, attemptId = null, emit, args, abandon }) {
  try { return commit(); }
  catch (error) {
    if (!['dispatch-lease-lost', 'workflow-not-accepting-work', 'workflow-finished', 'workflow-archived'].includes(error?.code)) throw error;
    let cleanup = null;
    try { cleanup = abandon(); } catch (e) { cleanup = { error: String(e?.message ?? e) }; }
    try {
      ledger.transaction(() => {
        if (attemptId != null) { updateAttempt(db, { attemptId, endState: 'cancelled' }); recordWhy(db, attemptId); }
        ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: jobId, kind: 'dispatch-abandoned',
          payload: { op, dispatch: dispatchId, code: error.code, status: error.status ?? null, phase: error.phase ?? null } });
      });
    } catch { /* the refusal stands; events refuse an archived workflow */ }
    emit({ ok: false, jobId, op, refused: error.code, error: error.message, cleanup },
      `dispatch ABANDONED for ${jobId} (${op}): ${error.message}; the started worker was stopped`, args.json);
    process.exit(1);
  }
}
