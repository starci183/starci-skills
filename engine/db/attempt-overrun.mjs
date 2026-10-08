// attempt-overrun.mjs — the ledger write of the live budget measure (scripts/kernel/attempt-live-usage.mjs): an attempt still running that
// has spent more tokens than its budget. Called inside the ledger's transaction with its db, like the other typed writers.
import { appendEvent } from './ledger.mjs';

const ATTEMPT_OVERRUN_EVENT = 'attempt-budget-overrun';

/**
 * One 'attempt-budget-overrun' event, once per attempt (the first reading past the budget). The attempt's llm_usage rows are written when
 * it settles and replace this measure. Returns {recorded}.
 */
export function recordAttemptOverrun(db, { attemptId, tokens, budget, at = Date.now() }) {
  const a = db.prepare('SELECT * FROM op_attempts WHERE attempt_id=?').get(attemptId);
  if (!a) throw Object.assign(new Error(`attempt ${attemptId} not found`), { code: 'STARCI_ATTEMPT_NOT_FOUND' });
  if (db.prepare('SELECT 1 FROM events WHERE attempt_id=? AND kind=? LIMIT 1').get(attemptId, ATTEMPT_OVERRUN_EVENT)) return { recorded: false };
  appendEvent(db, { workflowId: a.workflow_id, entityType: 'attempt', entityId: String(attemptId), attemptId, spanId: a.span_id, kind: ATTEMPT_OVERRUN_EVENT,
    payload: { attemptId, jobId: a.job_id, opId: a.op_id, agent: a.agent ?? null, tokens, budget, live: true }, createdAt: at });
  return { recorded: true };
}
