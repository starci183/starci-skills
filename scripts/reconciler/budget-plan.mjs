// scripts/reconciler/budget-plan.mjs — an Op attempt over its token budget (scripts/kernel/attempt-budget.mjs) on the Kernel's ladder: the
// Workflow controller opens one Decision Item per overrun (starci kernel status budgetOverruns). It is a happy error with three options
// the Kernel's menu offers: continue once on the same route, replace the agent (a retry that demotes the over-budget pool), or re-scope
// the leg to half of its owned paths. Pure.
const quoted = (value) => `'${String(value).replaceAll("'", '')}'`;

/** The options of one overrun as Kernel commands; re-scope exists only for a leg that owns more than one path. */
export function budgetOptions(workflowId, row) {
  const retry = `starci kernel enqueue --workflow ${workflowId} --op ${row.opId} --retry-of ${row.jobId}`;
  const half = row.ownedPaths.slice(0, Math.ceil(row.ownedPaths.length / 2));
  const rescope = { key: 're-scope', verb: `${retry} --paths ${quoted(half.join(','))} --what 're-scope: over budget'`,
    title: `re-scope: retry on the first ${half.length} of ${row.ownedPaths.length} owned paths, the rest cut as a later leg`, recommended: false };
  return [
    { key: 'continue-once', verb: `${retry} --paths ${quoted(row.ownedPaths.join(','))} --what 'continue: over budget'`, title: 'continue once: retry on the same route with the same paths, the budget waived for this try', recommended: false },
    { key: 'replace', verb: `${retry} --paths ${quoted(row.ownedPaths.join(','))} --switch-agent --what 'replace: over budget'`, title: 'replace: retry with the same paths on another agent, the over-budget pool demoted for this try', recommended: true },
    ...(row.ownedPaths.length > 1 ? [rescope] : []),
  ];
}

/** One Kernel Decision Item per attempt over budget that waits on the Kernel. */
export function planBudgetOverruns(p) {
  for (const row of p.status?.budgetOverruns ?? []) {
    const tokens = row.tokens.toLocaleString('en-US');
    p.di({ kind: 'budget-overrun', subject: `attempt-${row.attemptId}`, entity: { type: 'job', id: row.jobId },
      summary: `budget-overrun ${row.opId} attempt ${row.attemptId}: ${tokens} tokens against a budget of ${row.budget.toLocaleString('en-US')} (${row.agent ?? 'agent unknown'}); the job is ${row.jobStatus}${row.live ? ' and still running: the retry options below are refused unit-in-flight until it settles' : ''}`,
      evidence: [`attempt ${row.attemptId} of ${row.jobId}`, row.live ? 'measured while the attempt runs, from its session file (the attempt-budget-overrun event)' : 'measured from the llm_usage rows of the attempt: input + output + cache read + cache write'],
      options: budgetOptions(p.workflowId, row), allowedVerbs: ['enqueue'] });
  }
}
