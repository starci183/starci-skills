// wake-budget.mjs — what a Kernel wake spent against the per-wake budget of modules/kernel/roles.yaml (kernel.wakeBudget). The numbers
// are the usage rows the runtime already records (llm_usage kernel-turn rows, scripts/kernel/usage-record.mjs) cut at the Kernel's
// wake events: a wake owns the rows recorded after it and up to the next wake. Rows land when the usage sweep runs, so the newest
// wake may still be short; a wake over budget is a departure of the Kernel (the digest reports it).
import { rolesContract } from '../machine/roles-contract.mjs';

const WAKE_EVENT = 'kernel-woken';

/** The per-wake budget {turns, tokens} of the Kernel role. */
export const wakeBudget = () => rolesContract().roles.find((role) => role.id === 'kernel').wakeBudget.perWake;

/** The newest `limit` wakes of a workflow with what each spent: [{at, turns, tokens}] oldest first. */
export function wakeUsageOf(db, workflowId, { limit = 20 } = {}) {
  const wakes = db.prepare('SELECT created_at AS at FROM events WHERE workflow_id=? AND kind=? ORDER BY seq DESC LIMIT ?').all(workflowId, WAKE_EVENT, limit).reverse().map((row) => Number(row.at));
  if (!wakes.length) return [];
  const rows = db.prepare(`SELECT at, COALESCE(turns,0) AS turns, COALESCE(input_tokens,0)+COALESCE(output_tokens,0)+COALESCE(cache_read_tokens,0) AS tokens
    FROM llm_usage WHERE workflow_id=? AND subject_type='kernel-turn' AND at>? ORDER BY at`).all(workflowId, wakes[0]);
  return wakes.map((at, index) => {
    const end = wakes[index + 1] ?? Infinity;
    const own = rows.filter((row) => Number(row.at) > at && Number(row.at) <= end);
    return { at, turns: own.reduce((sum, row) => sum + Number(row.turns), 0), tokens: own.reduce((sum, row) => sum + Number(row.tokens), 0) };
  });
}

/** The wakes that spent more turns or tokens than the budget. */
export const exceededWakes = (wakes, budget) => wakes.filter((wake) => wake.turns > budget.turns || wake.tokens > budget.tokens);
