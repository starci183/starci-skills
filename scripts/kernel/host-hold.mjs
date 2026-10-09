// host-hold.mjs - the queued cause `host-resources-low` of starci kernel status: the host itself is short, so
// dispatch refuses the job as a typed wait (dispatch-gates.mjs refuseHostLimits) and no Kernel move can change that.
// Status asks the same two questions dispatch does, so a job dispatch would refuse never reads `ready` (actionable) and the
// watchdog never wakes the Kernel for a wait only the machine can end: the disk floor on the worst drive, and the RAM-aware
// throttle's admission of the job's op. Every status re-probes, so the job reads ready again once there is room.
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { readOpManifest } from '../lib/op-shared.mjs';
import { hostResourcesFor } from '../machine/host-resources.mjs';
import { hostThrottle } from '../machine/ram-throttle.mjs';
import { hostCapabilityGaps } from './host-capabilities.mjs';

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
 * The hold `host-tool-missing` of an op whose declared host capability this host lacks (host-capabilities.mjs): dispatch refuses the same fact
 * prerequisite-unmet, so status never reads the job ready and no Kernel wake is spent on a wait only the host's owner can end. Null when the
 * host has every capability the op declares, or the manifest cannot be read.
 */
function capabilityHold(op, repo) {
  let gaps = [];
  try { gaps = hostCapabilityGaps({ brief: readOpManifest(path.join(skillRoot, 'modules', 'ops', 'ops', `${op}.yaml`)), dirs: [repo] }); } catch { return null; }
  if (!gaps.length) return null;
  return { queuedBecause: 'host-tool-missing', blockedBy: { code: gaps[0].code, missing: gaps.flatMap((gap) => gap.missing) },
    detail: `${gaps[0].code}: ${gaps.map((gap) => gap.why).join('; ')}; ${gaps.map((gap) => gap.fix).join('; ')}. The Supervisor owns the host; the job reads ready again once the tool resolves - do not re-dispatch it by hand` };
}

/**
 * The host-hold function of one status projection: opId -> {queuedBecause, blockedBy, detail} while the host is too short to
 * admit that op, else null. The disk probe is read once; the throttle once per op. A probe that throws holds nothing.
 */
export function hostHoldOf({ env = process.env, repo, workflowId, db, ledgerFile = null } = {}, { resources = hostResourcesFor, throttle = hostThrottle } = {}) {
  const held = new Map();
  const capability = (op) => { if (!held.has(op)) held.set(op, capabilityHold(op, repo)); return held.get(op); };
  let host = null;
  try { host = resources({ env, repo }); } catch { return capability; }
  const byOp = new Map();
  const admit = (op) => {
    try { return throttle({ op, workflowId, env, repo, db, ledgerFile })?.admission ?? null; } catch { return null; }
  };
  return (op) => {
    if (host?.lowDisk && !host.testContext) return diskHold(host);
    if (!byOp.has(op)) byOp.set(op, admit(op));
    const admission = byOp.get(op);
    return admission?.ok === false ? ramHold(host, admission) : capability(op);
  };
}
