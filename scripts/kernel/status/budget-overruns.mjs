// budgetOverruns — the `starci kernel status` list of attempts that spent more tokens than the Op's declared budget
// (scripts/kernel/attempt-budget.mjs), settled red and waiting on the Kernel or still running past it (live: true): a happy error, answered by continuing once, replacing the
// agent or re-scoping the leg. Null (no field) when none does.
import { attemptBudget, budgetOverruns } from '../attempt-budget.mjs';

export default {
  key: 'budgetOverruns',
  compute(ctx) {
    if (ctx.wf?.phase === 'finished' || ctx.wf?.archived_at) return null;
    const rows = budgetOverruns(ctx.db, ctx.workflowId, { budget: attemptBudget().perAttempt });
    return rows.length ? rows : null;
  },
  lines: (rows) => rows.map((r) => `BUDGET-OVERRUN ${r.opId} attempt ${r.attemptId} (${r.jobId}, ${r.agent ?? '-'}): ${r.tokens.toLocaleString('en-US')} tokens over the budget of ${r.budget.toLocaleString('en-US')}; the job is ${r.jobStatus}${r.live ? ' (still running)' : ''}`),
};
