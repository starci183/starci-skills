// attempt-budget.mjs — an Op attempt measured against the token budget its role declares (modules/kernel/roles.yaml, op.tokenBudget).
// The measure is every token the models handled for the attempt: the llm_usage rows of the attempt (scripts/kernel/usage-record.mjs
// writes them when the attempt settles), input + output + cache read + cache write. An attempt whose usage is unavailable has no
// measure and is never counted over. An overrun that leaves its job waiting on the Kernel (settled red, no later try) is a happy
// error: `starci kernel status` lists it as budgetOverruns and the Workflow controller opens a Decision Item for the Kernel.
// An attempt still running is measured by the live pass (attempt-live-usage.mjs): its first reading past the budget is an
// `attempt-budget-overrun` event, listed with live: true until the attempt settles and its usage rows replace the reading.
import { rolesContract } from '../machine/roles-contract.mjs';
import { parseJson } from '../lib/json.mjs';

/** The declared budget: {perAttempt, status}. */
export function attemptBudget(root) {
  const { tokenBudget } = rolesContract(root).roles.find((role) => role.id === 'op');
  return { perAttempt: Number(tokenBudget.perAttempt.default), status: tokenBudget.status };
}

const TOKENS = 'sum(COALESCE(u.input_tokens,0)+COALESCE(u.output_tokens,0)+COALESCE(u.cache_read_tokens,0)+COALESCE(u.cache_write_tokens,0))';

const withPaths = (budget, live) => ({ payload, ...row }) => ({ ...row, budget, live, ownedPaths: (parseJson(payload, {})?.owned_paths ?? []).map(String) });

/** The attempts still running that the live pass saw past the budget (their usage rows do not exist yet): the same row shape with live: true. */
function liveOverBudget(db, workflowId, budget) {
  return db.prepare(`SELECT a.attempt_id AS attemptId, a.job_id AS jobId, a.op_id AS opId, a.agent AS agent, j.status AS jobStatus, j.payload_json AS payload,
      (SELECT json_extract(e.payload_json,'$.tokens') FROM events e WHERE e.attempt_id=a.attempt_id AND e.kind='attempt-budget-overrun' ORDER BY e.seq LIMIT 1) AS tokens
    FROM op_attempts a JOIN jobs j ON j.job_id=a.job_id
    WHERE a.workflow_id=? AND a.settled_at IS NULL AND a.end_state IS NULL
      AND NOT EXISTS (SELECT 1 FROM llm_usage u WHERE u.subject_type='attempt' AND u.attempt_id=a.attempt_id)
    ORDER BY a.attempt_id`).all(workflowId).filter((row) => Number(row.tokens) > budget).map(withPaths(budget, true));
}

/**
 * The attempts of a workflow whose measured tokens exceed `budget`: [{attemptId, jobId, opId, agent, tokens, budget, jobStatus, ownedPaths, live}].
 * A settled attempt is measured by its usage rows; a running one by the live pass's reading (live: true).
 */
export function attemptsOverBudget(db, workflowId, { budget = attemptBudget().perAttempt } = {}) {
  const settled = db.prepare(`SELECT a.attempt_id AS attemptId, a.job_id AS jobId, a.op_id AS opId, a.agent AS agent, j.status AS jobStatus, j.payload_json AS payload, ${TOKENS} AS tokens
    FROM op_attempts a JOIN llm_usage u ON u.attempt_id=a.attempt_id AND u.subject_type='attempt' JOIN jobs j ON j.job_id=a.job_id
    WHERE a.workflow_id=? GROUP BY a.attempt_id HAVING ${TOKENS} > ? ORDER BY a.attempt_id`).all(workflowId, budget).map(withPaths(budget, false));
  return [...settled, ...liveOverBudget(db, workflowId, budget)];
}

/** Whether the job of an overrun waits on the Kernel: still running past the budget, or settled red (failed or awaiting the owner) with no later try of its unit. */
const waitsOnKernel = (db, row) => {
  if (row.live) return true;
  if (!['failed', 'awaiting_owner'].includes(row.jobStatus)) return false;
  const job = db.prepare('SELECT unit_id, try_no FROM jobs WHERE job_id=?').get(row.jobId);
  return !db.prepare('SELECT 1 FROM jobs WHERE retry_of=? OR (unit_id IS NOT NULL AND unit_id=? AND try_no>?) LIMIT 1').get(row.jobId, job?.unit_id ?? null, job?.try_no ?? 0);
};

/** The overruns that wait on the Kernel's decision now. */
export const budgetOverruns = (db, workflowId, options) => attemptsOverBudget(db, workflowId, options).filter((row) => waitsOnKernel(db, row));
