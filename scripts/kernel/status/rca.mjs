// rca — "why not, and which single change fixes the most?" (scripts/kernel/progress-rca.mjs rcaOf + actionsOf):
// the failed/blocked attempts read together and clustered by cause, and the RANKED candidate actions, each with its
// exact api command, expected effect, tier (light | heavy | proposal | supervisor) and whether the decision log
// already tried it (the JSON carries them; the text shows the clusters, and the menu is the only actionable section). Present when the workflow stalls or an op failed >= allocation.progress.rca.minFailures times.
import { viewOf } from '../verbs/shared/status-view.mjs';

export default {
  key: 'rca',
  compute(ctx) {
    if (ctx.wf?.phase === 'finished' || ctx.wf?.archived_at) return null;
    const v = viewOf(ctx);
    return v.rca.trigger || v.rca.actions.length ? v.rca : null;
  },
  lines: (r) => {
    const clusters = r.clusters.slice(0, 6)
      .map((c) => `${c.cause} x${c.count}` + (c.open !== c.count ? `/${c.open} open` : ''))
      .join(', ') || 'no failures';
    return [`rca ${r.id} (${r.trigger ?? 'no trigger'}): ${clusters}`];
  },
};
