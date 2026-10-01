// why-record.mjs — the one writer of op_attempts.why_json. Every path that ends an attempt without a passing verdict
// (settle fail/blocked/ask, a refused launch, a dead worker, a reconcile requeue, a cancel) calls recordWhy inside its own
// transaction, after the attempt's end columns and its settle_json are written, so the stored explanation matches the row.
import { updateAttempt } from '../../engine/db/ledger.mjs';
import { computeWhy } from './why.mjs';

/**
 * Compute and store the why of an attempt. Returns the why (null for a pass or a running attempt: nothing stored).
 * A failure to explain never blocks the settle it rides on: it is returned as {error}, and the caller records the event.
 */
export function recordWhy(db, attemptId, { at = Date.now() } = {}) {
  if (attemptId == null) return null;
  try {
    const row = db.prepare('SELECT * FROM op_attempts WHERE attempt_id=?').get(attemptId);
    if (!row) return null;
    const why = computeWhy(db, row);
    if (why) updateAttempt(db, { attemptId, whyJson: why, at });
    return why;
  } catch (error) {
    return { error: String(error?.message ?? error).slice(0, 300) };
  }
}
