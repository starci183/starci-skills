// effect-unknown-item.mjs - the promise of the SLA catalogue code EFFECT_UNKNOWN_STUCK (modules/reconciler/sla.yaml): "starci kernel reconcile, then a Decision Item".
// A job whose launch had an unknown effect is fenced and never forced (a worker may have started). The Job controller reconciles it on every pass; once the job has stood
// in effect_unknown past the SLA bound the Supervisor, the named owner, gets ONE Decision Item for it (idempotent per job), closed with the job.

const OPENED_BY = 'job-controller';

/** The Supervisor's runtime-defect item for a job stuck in effect_unknown. Pure. */
export function effectUnknownDecision(f, ledgerId, { now, settings }) {
  const minutes = Math.round((now - f.updatedAt) / 60_000);
  return {
    schema: 'starci/decision-item@1', kind: 'runtime-defect', idempotencyKey: `effect-unknown:${f.jobId}`, decider: 'supervisor', ledger: ledgerId, workflowId: f.workflowId,
    entity: { type: 'job', id: f.jobId },
    summary: `${f.op} ${f.jobId} has had an unknown launch effect for ${minutes} min: the reconcile cannot prove whether its worker started; verify the Dispatch in Orca, then release or settle the job`,
    evidence: [{ ref: `job:${f.jobId}` }, { ref: 'hold:effect-unknown' }], allowedVerbs: ['reconcile'], dueAt: now + settings.decisionDueMs, escalateTo: 'owner', openedBy: OPENED_BY, openedAt: now,
  };
}

/** The item of a step, as the fields to merge into its result: none unless the step is the effect-unknown reconcile and the SLA bound is spent. */
export async function effectUnknownItem(ctx, ledgerId, f, s, settings) {
  if (s.kind !== 'effect-unknown' || ctx.now() - f.updatedAt <= settings.sla.EFFECT_UNKNOWN_STUCK) return {};
  return { decision: await ctx.openDecision(effectUnknownDecision(f, ledgerId, { now: ctx.now(), settings })) };
}
