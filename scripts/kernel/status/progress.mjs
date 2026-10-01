// progress — "am I progressing toward the goal?" (scripts/kernel/progress-rca.mjs progressOf): units that passed
// their gates, units/hour, legs done, running vs allowed parallelism, queued-ready, ETA and the stall verdict.
// The Kernel reads it first on every wake (modules/kernel/driver-loop.yaml progress); the Supervisor backstops it.
import { progressLine } from '../progress-rca.mjs';
import { viewOf } from '../verbs/shared/status-view.mjs';

export default {
  key: 'progress',
  compute(ctx) {
    if (ctx.wf?.phase === 'finished' || ctx.wf?.archived_at) return null;
    return viewOf(ctx).progress;
  },
  lines: (p) => [progressLine(p)],
};
