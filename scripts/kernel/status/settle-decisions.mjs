// settleDecisions — what waits on the Kernel's settle decision (owner ruling settle-runtime-service, 2026-09-28). The
// runtime settles every green report itself (scripts/kernel/settle/job-settle.mjs); each item here is a reported job it
// handed over as needs-kernel-decision - a blocked/failed/ask/partial outcome, or a done report whose declared checks
// it could not re-verify (reason, detail) - consumed or not. The Kernel decides these FIRST, before its ranked actions.
import { kernelDecisionItems } from '../settle/job-settle.mjs';

export default {
  key: 'settleDecisions',
  compute(ctx) {
    if (ctx.wf?.phase === 'finished' || ctx.wf?.archived_at) return null;
    const items = kernelDecisionItems(ctx.db, ctx.workflowId, { now: ctx.now ?? Date.now() });
    return items.length ? items : null;
  },
  lines: (items) => [`NEEDS-KERNEL-DECISION ${items.length} (decide first; the runtime settles green reports): ${items.slice(0, 10)
    .map((i) => `${i.jobId} ${i.op} ${i.outcome} [${i.reason}] ${i.ageMin}m`).join('; ')}${items.length > 10 ? '; ...' : ''}`],
};
