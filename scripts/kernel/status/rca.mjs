// rca — "why not, and which single change fixes the most?" (scripts/kernel/progress-rca.mjs rcaOf + actionsOf):
// the failed/blocked attempts read together and clustered by cause, and the RANKED candidate actions, each with its
// exact api command, expected effect, tier (light | heavy | proposal | supervisor) and whether the decision log
// already tried it. Present when the workflow stalls or an op failed >= allocation.progress.rca.minFailures times.
import { viewOf } from './view.mjs';

export default {
  key: 'rca',
  compute(ctx) {
    if (ctx.wf?.phase === 'finished' || ctx.wf?.archived_at) return null;
    const v = viewOf(ctx);
    return v.rca.trigger || v.rca.actions.length ? v.rca : null;
  },
  lines: (r) => [
    `rca ${r.id} (${r.trigger ?? 'no trigger'}): ${r.clusters.slice(0, 6).map((c) => `${c.cause} x${c.count}${c.open !== c.count ? `/${c.open} open` : ''}`).join(', ') || 'no failures'}`,
    ...r.actions.slice(0, 5).map((a) => `  action #${a.rank} [${a.tier}]${a.tried ? ` (tried ${a.tried.decision}: ${a.tried.status})` : ''} ${a.title}\n    run: ${a.command}\n    expect: ${a.expected}`),
  ],
};
