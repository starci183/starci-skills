// attempt-live-usage.mjs — the token spend of an op attempt that is still running, measured against the budget of the Op role
// (modules/kernel/roles.yaml op.tokenBudget, scripts/kernel/attempt-budget.mjs). The usage rows of an attempt are written when it settles,
// so an overrun was seen only after the attempt ended. This pass runs on the poll that already snapshots the open attempts (every
// minute, scripts/kernel/transcripts.mjs): it reads the session file of each open attempt the way the settle hook does
// (usage-record.mjs, by the attempt's dispatch id), and the first reading past the budget records one `attempt-budget-overrun` event
// (ledger.write.recordAttemptOverrun, once per attempt). `starci kernel status` lists it as budgetOverruns with live: true and the
// Workflow controller opens the budget-overrun Decision Item for the Kernel; the rows written at settle replace the live reading.
import { attemptBudget } from './attempt-budget.mjs';
import { SESSION_LEAD_MS, attemptAgent, entriesOfAttempt, indexSessions, planAttemptUsage } from './usage-record.mjs';

const sumTokens = (rows) => rows.reduce((total, row) => total + (row.inputTokens ?? 0) + (row.outputTokens ?? 0) + (row.cacheReadTokens ?? 0) + (row.cacheWriteTokens ?? 0), 0);

/** The attempts that are running and have not been seen over budget yet. */
const watchedAttempts = (db) => db.prepare(`SELECT a.* FROM op_attempts a
  WHERE a.settled_at IS NULL AND a.end_state IS NULL AND a.terminal_closed_at IS NULL AND a.dispatched_at IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM events e WHERE e.attempt_id=a.attempt_id AND e.kind='attempt-budget-overrun')
    AND NOT EXISTS (SELECT 1 FROM llm_usage u WHERE u.subject_type='attempt' AND u.attempt_id=a.attempt_id)
  ORDER BY a.attempt_id`).all();

/**
 * One pass over a ledger's running attempts. `ledger` is the writable handle; `index` (the session index) and `extract` are seams
 * for specs. Returns {checked, measured, overruns: [{attemptId, tokens}]}.
 */
export function measureOpenAttempts(ledger, { now = Date.now(), budget = attemptBudget().perAttempt, index = null, env = process.env, home, archiveRoot = null, extract = undefined } = {}) {
  const open = watchedAttempts(ledger.db).filter((attempt) => attemptAgent(attempt));
  const out = { checked: open.length, measured: 0, overruns: [] };
  if (!open.length) return out;
  const sessions = index ?? indexSessions({ sinceMs: Math.min(...open.map((attempt) => attempt.dispatched_at)) - SESSION_LEAD_MS, env, ...(home ? { home } : {}), archiveRoot });
  for (const attempt of open) {
    const plan = planAttemptUsage(attempt, entriesOfAttempt(sessions, attempt), extract ? { extract } : {});
    if (!plan.ok) continue;
    out.measured += 1;
    const tokens = sumTokens(plan.rows);
    if (tokens > budget && ledger.write.recordAttemptOverrun({ attemptId: attempt.attempt_id, tokens, budget, at: now }).recorded) out.overruns.push({ attemptId: attempt.attempt_id, tokens });
  }
  return out;
}
