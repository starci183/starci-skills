// reported-jobs.mjs — what the job settler (scripts/kernel/settle/job-settle.mjs) handed to the Kernel: the reported jobs of
// a workflow and the ones that wait on the Kernel's decision. Pure SQL over an open ledger handle, so the decision queue
// (machine/decisions.mjs) reads it without importing the kernel.

/** The ledger event the settler records once per dispatch and reason when it hands a reported job to the Kernel. */
export const NEEDS_KERNEL_EVENT = 'job-settle-needs-kernel';
// A job whose op filed its report (api report moves it to reported) until a verdict settles it.
const LIVE = ['running', 'answering', 'effect_unknown', 'reported', 'deciding'];
/** Ops whose pass is an owner act, never a machine verdict. */
export const KERNEL_ONLY_OPS = Object.freeze(['handover.review']);
const parse = (text) => { try { return JSON.parse(text); } catch { return null; } };

/**
 * The reported jobs: a live op job of a not-archived workflow with a reports row for its
 * contract's dispatch, filed or consumed. Pure SQL over the ledger; the attempt's contract binds the dispatch. [{jobId, workflowId, op, attempt, status, workerId,
 * payload, dispatchId, outcome, consumedAt, filedAt, report}]
 */
export function reportedJobs(db, { workflowId = null, jobId = null } = {}) {
  const where = ["j.kind='op'", `j.status IN (${LIVE.map(() => '?').join(',')})`];
  const args = [...LIVE];
  if (workflowId) { where.push('j.workflow_id=?'); args.push(workflowId); }
  if (jobId) { where.push('j.job_id=?'); args.push(jobId); }
  return db.prepare(`SELECT j.job_id, j.workflow_id, j.op_id, j.try_no AS attempt, j.status, j.worker_id, j.payload_json, a.attempt_id,
      r.dispatch_id, r.outcome, r.consumed_at, r.created_at AS filed_at, r.report_json
    FROM jobs j
    JOIN op_attempts a ON a.job_id=j.job_id AND a.attempt_id=(SELECT max(x.attempt_id) FROM op_attempts x WHERE x.job_id=j.job_id)
    JOIN reports r ON r.attempt_id=a.attempt_id
    JOIN workflows w ON w.workflow_id=j.workflow_id AND w.phase<>'archived'
    WHERE ${where.join(' AND ')} ORDER BY r.created_at`).all(...args).map((r) => ({
    jobId: r.job_id, workflowId: r.workflow_id, op: r.op_id, attempt: r.attempt, attemptId: r.attempt_id, status: r.status, workerId: r.worker_id,
    payload: parse(r.payload_json) ?? {}, dispatchId: r.dispatch_id, outcome: r.outcome, consumedAt: r.consumed_at ?? null,
    filedAt: Number(r.filed_at), report: parse(r.report_json) ?? {},
  }));
}

/** The latest needs-kernel handover of a job's current dispatch, or null. */
export function kernelHandoverOf(db, item) {
  const row = db.prepare(`SELECT payload_json, created_at FROM events WHERE kind=? AND entity_id=? AND json_extract(payload_json,'$.dispatchId')=?
    ORDER BY seq DESC LIMIT 1`).get(NEEDS_KERNEL_EVENT, item.jobId, item.dispatchId);
  return row ? { ...(parse(row.payload_json) ?? {}), at: Number(row.created_at) } : null;
}

/**
 * What waits on the Kernel's decision in one workflow: reported jobs the settler handed over (needs-kernel) and the
 * owner-act ops it never settles (H1: every other outcome the settler settles itself). [{jobId, op, attempt, outcome, reason, ageMin, consumed}] oldest first. `ageMs` filters.
 */
export function kernelDecisionItems(db, workflowId, { now = Date.now(), ageMs = 0 } = {}) {
  return reportedJobs(db, { workflowId }).filter((it) => now - it.filedAt >= ageMs).flatMap((it) => {
    const handover = kernelHandoverOf(db, it);
    const ownerAct = KERNEL_ONLY_OPS.includes(it.op);
    if (!handover && !ownerAct) return [];
    return [{ jobId: it.jobId, op: it.op, attempt: it.attempt, outcome: it.outcome, dispatchId: it.dispatchId,
      reason: handover?.reason ?? 'owner-act',
      ...(handover?.detail ? { detail: handover.detail } : {}), ageMin: Math.round((now - it.filedAt) / 60_000), consumed: it.consumedAt != null }];
  });
}

