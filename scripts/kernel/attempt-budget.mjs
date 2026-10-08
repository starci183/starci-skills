// attempt-budget.mjs — an Op attempt measured against the token budget its role declares (modules/kernel/roles.yaml, op.tokenBudget).
// The measure is every token the models handled for the attempt: the llm_usage rows of the attempt (scripts/kernel/usage-record.mjs
// writes them when the attempt settles), input + output + cache read + cache write. An attempt whose usage is unavailable has no
// measure and is never counted over. An overrun that leaves its job waiting on the Kernel (settled red, no later try) is a happy
// error: `starci kernel status` lists it as budgetOverruns and the Workflow controller opens a Decision Item for the Kernel.
import { rolesContract } from '../machine/roles-contract.mjs';
import { parseJson } from '../lib/json.mjs';

/** The declared budget: {perAttempt, status}. */
export function attemptBudget(root) {
  const { tokenBudget } = rolesContract(root).roles.find((role) => role.id === 'op');
  return { perAttempt: Number(tokenBudget.perAttempt.default), status: tokenBudget.status };
}

const TOKENS = 'sum(COALESCE(u.input_tokens,0)+COALESCE(u.output_tokens,0)+COALESCE(u.cache_read_tokens,0)+COALESCE(u.cache_write_tokens,0))';

/** The attempts of a workflow whose measured tokens exceed `budget`: [{attemptId, jobId, opId, agent, tokens, budget, jobStatus, ownedPaths}]. */
export function attemptsOverBudget(db, workflowId, { budget = attemptBudget().perAttempt } = {}) {
  return db.prepare(`SELECT a.attempt_id AS attemptId, a.job_id AS jobId, a.op_id AS opId, a.agent AS agent, j.status AS jobStatus, j.payload_json AS payload, ${TOKENS} AS tokens
    FROM op_attempts a JOIN llm_usage u ON u.attempt_id=a.attempt_id AND u.subject_type='attempt' JOIN jobs j ON j.job_id=a.job_id
    WHERE a.workflow_id=? GROUP BY a.attempt_id HAVING ${TOKENS} > ? ORDER BY a.attempt_id`).all(workflowId, budget)
    .map(({ payload, ...row }) => ({ ...row, budget, ownedPaths: (parseJson(payload, {})?.owned_paths ?? []).map(String) }));
}

/** Whether the job of an overrun still waits on the Kernel: settled red (failed or awaiting the owner) and no later try of its unit. */
const waitsOnKernel = (db, row) => {
  if (!['failed', 'awaiting_owner'].includes(row.jobStatus)) return false;
  const job = db.prepare('SELECT unit_id, try_no FROM jobs WHERE job_id=?').get(row.jobId);
  return !db.prepare('SELECT 1 FROM jobs WHERE retry_of=? OR (unit_id IS NOT NULL AND unit_id=? AND try_no>?) LIMIT 1').get(row.jobId, job?.unit_id ?? null, job?.try_no ?? 0);
};

/** The overruns that wait on the Kernel's decision now. */
export const budgetOverruns = (db, workflowId, options) => attemptsOverBudget(db, workflowId, options).filter((row) => waitsOnKernel(db, row));
