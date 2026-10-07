// host-hold.mjs - the queued cause `host-resources-low` of starci kernel status: the host itself is short, so
// dispatch refuses the job as a typed wait (dispatch-gates.mjs refuseHostLimits) and no Kernel move can change that.
// Status asks the same two questions dispatch does, so a job dispatch would refuse never reads `ready` (actionable) and the
// watchdog never wakes the Kernel for a wait only the machine can end: the disk floor on the worst drive, and the RAM-aware
// throttle's admission of the job's op. Every status re-probes, so the job reads ready again once there is room.
import { hostResourcesFor } from '../machine/host-resources.mjs';
import { hostThrottle } from '../machine/ram-throttle.mjs';

const GB = (n) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(1) : '?');

const diskHold = (host) => ({
  queuedBecause: 'host-resources-low',
  blockedBy: { drive: host.drive ?? null, freeDiskGb: host.freeDiskGb ?? null, freeRamPct: host.freeRamPct ?? null },
  detail: `drive ${host.drive ?? '?'} has ${GB(host.freeDiskGb)} GB free, below allocation.resources.minFreeDiskGb ${host.thresholds?.minFreeDiskGb ?? '?'} GB; `
    + 'dispatch waits for room and the job reads ready again on its own - do not re-dispatch it by hand',
});

const ramHold = (host, admission) => ({
  queuedBecause: 'host-resources-low',
  blockedBy: { drive: host.drive ?? null, freeDiskGb: host.freeDiskGb ?? null, freeRamPct: host.freeRamPct ?? null },
  detail: `RAM ${GB(host.freeRamPct)}% free: ${admission.reason} - ${admission.detail}; dispatch waits for room and the job reads ready again on its own - do not re-dispatch it by hand`,
});

/**
 * The host-hold function of one status projection: opId -> {queuedBecause, blockedBy, detail} while the host is too short to
 * admit that op, else null. The disk probe is read once; the throttle once per op. A probe that throws holds nothing.
 */
export function hostHoldOf({ env = process.env, repo, workflowId, db, ledgerFile = null } = {}, { resources = hostResourcesFor, throttle = hostThrottle } = {}) {
  let host = null;
  try { host = resources({ env, repo }); } catch { return () => null; }
  const byOp = new Map();
  const admit = (op) => {
    try { return throttle({ op, workflowId, env, repo, db, ledgerFile })?.admission ?? null; } catch { return null; }
  };
  return (op) => {
    if (host?.lowDisk && !host.testContext) return diskHold(host);
    if (!byOp.has(op)) byOp.set(op, admit(op));
    const admission = byOp.get(op);
    return admission && admission.ok === false ? ramHold(host, admission) : null;
  };
}
