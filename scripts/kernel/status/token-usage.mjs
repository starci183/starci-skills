// usage — the `starci kernel status` token summary of the workflow: total, by op, by model, the Kernel's own and how many attempts are
// measured (scripts/kernel/usage-report.mjs). Null (no field) until any llm_usage row exists for the workflow.
import { tokenLine, usageOfWorkflow } from '../usage-report.mjs';

export default {
  key: 'usage',
  compute(ctx) {
    const u = usageOfWorkflow(ctx.db, ctx.workflowId);
    if (!u.total.tokens && !u.coverage.unavailable) return null;
    const rest = { ...u }; delete rest.workflowId;
    return rest;
  },
  lines: (u) => {
    const unavailable = u.coverage.unavailable ? `, ${u.coverage.unavailable} unavailable` : '';
    const ops = u.byOp.slice(0, 3).map((o) => `${o.opId} ${o.tokens.toLocaleString('en-US')}`).join(', ');
    const models = u.byModel.slice(0, 3).map((m) => `${m.model} ${m.tokens.toLocaleString('en-US')}`).join(', ');
    return [`TOKENS ${tokenLine(u.total)}; ${u.coverage.measured}/${u.coverage.attempts} attempts measured${unavailable}; kernel ${u.kernel.tokens.toLocaleString('en-US')}`
      + (ops ? `; top ops ${ops}` : '') + (models ? `; models ${models}` : '')];
  },
};
