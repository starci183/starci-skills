// scripts/reconciler/owns.mjs — which controller owns each concern (DESIGN §7.9; modules/reconciler/reconciler.yaml
// concerns). The engine's ctx.owns(concern) and boot.mjs --status read it. The old loops that asked
// reconcilerOwns(concern) before each duty were deleted on 2026-09-28 (owner ruling "on an error, delete it outright": the reconciler
// is the only loop; rollback is git revert, not a dormant fallback), and so were reconcilerOwns and yieldTo.

/** concern -> owning controller. The CONCERNS of the reconciler contract (LANES shared contract). */
export const CONCERN_OWNER = Object.freeze({
  'job.settle': 'job', 'job.worker': 'job', 'job.dispatch': 'job', 'job.consume-check': 'job', 'job.close-verify': 'job',
  'host.kernel-seat': 'host', 'host.supervisor-seat': 'host', 'host.services': 'host', 'host.orca': 'host', 'host.processes': 'host', 'host.ledger-health': 'host',
  'resource.throttle': 'resource', 'resource.quota': 'resource',
  'gc.sweep': 'gc', 'gc.housekeeping': 'gc',
  'workflow.stall-wake': 'workflow', 'workflow.progress': 'workflow', 'workflow.ask-repark': 'workflow',
  'workers.owed': 'workers', 'workers.push': 'workers', 'workers.deps': 'workers', 'notify.owner': 'workers',
  'learning.tick': 'learning',
  'sla.report': 'workflow',
});
export const CONCERNS = Object.freeze(Object.keys(CONCERN_OWNER));
