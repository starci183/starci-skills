// worker-depth.mjs — Orca's worker nesting depth as pure logic (no process, no Orca call).
//
// Orca nests every worker under the Dispatch that started it: the owner's chat is depth 0, a Kernel or the [Supervisor]
// 1, an op or a [Worker] 2, the draw critic 3. A worker-start deeper than the Orca app's depth setting is refused with
// nested_worker_depth_exceeded, and Orca exposes no read of that setting. The owner declares it as config.yaml
// orca.maxWorkerDepth (engine/config.mjs orcaSettings); scripts/agent/lib.mjs spawnAgent refuses a launch deeper than it
// before worker-start, and `start --check` compares it with a measured probe (scripts/agent/depth-probe.mjs).

import { terminalHandleOf } from './worker-accounting.mjs';

/** The runtime's refusal of a launch deeper than orca.maxWorkerDepth (modules/kernel/failure-codes.yaml). */
export const WORKER_DEPTH_EXCEEDED = 'worker-depth-exceeded';
/** Orca's own refusal of a nested worker-start past its depth setting. */
export const ORCA_DEPTH_ERROR = 'nested_worker_depth_exceeded';

/** The depth of a worker-show read (result.dispatch.depth), or null when the read carries none. */
export function dispatchDepthOf(show) {
  const d = show?.dispatch ?? show?.result?.dispatch ?? null;
  const n = Number(d?.depth);
  return d?.depth != null && Number.isInteger(n) && n >= 0 ? n : null;
}

/**
 * The depth a new worker will have: 1 under no runtime-launched parent (the owner's chat, a plain shell), else its
 * parent's depth + 1; null when the parent's depth is unknown (the preflight then proves nothing and Orca decides).
 */
export function launchDepth({ parentDispatch = null, parentDepth = null } = {}) {
  if (!parentDispatch) return 1;
  return Number.isInteger(parentDepth) ? parentDepth + 1 : null;
}

/** null when a worker at `depth` may start under `maxDepth`; else the typed refusal. */
export function depthVerdict({ depth, maxDepth }) {
  if (!Number.isInteger(depth) || !Number.isInteger(maxDepth) || depth <= maxDepth) return null;
  return { code: WORKER_DEPTH_EXCEEDED, depth, maxDepth,
    error: `the worker would start at depth ${depth}, deeper than orca.maxWorkerDepth ${maxDepth} (Orca refuses it with ${ORCA_DEPTH_ERROR}); launch it from a shallower coordinator or raise the Orca app's depth setting and orca.maxWorkerDepth together` };
}

/**
 * The Dispatch of the worker whose terminal is `handle`, from Orca's worker-list rows, or null (no row: the handle is
 * the owner's chat, a plain shell, or a worker outside the listing). The newest row wins (Orca lists newest first).
 */
export function dispatchOfTerminal(rows, handle) {
  if (!handle) return null;
  const row = (Array.isArray(rows) ? rows : []).find((r) => terminalHandleOf(r) === handle && r?.dispatchId);
  return row?.dispatchId ?? null;
}

/** Whether a start error is Orca's depth refusal. */
export const isOrcaDepthRefusal = (started) => [started?.errorCode, started?.error, started?.code].some((v) => String(v ?? '').includes(ORCA_DEPTH_ERROR));

/**
 * The configured depth against a measured probe: {status: 'match'|'mismatch'|'unmeasured', configured, measured, detail}.
 * `measured` is the deepest depth Orca started (the probe's maxStarted), set only when a deeper start was refused.
 */
export function compareMeasuredDepth({ configured, measured }) {
  if (!Number.isInteger(measured)) return { status: 'unmeasured', configured, measured: null, detail: `orca.maxWorkerDepth ${configured}; Orca's limit was not measured` };
  return measured === configured
    ? { status: 'match', configured, measured, detail: `orca.maxWorkerDepth ${configured} equals the measured Orca limit` }
    : { status: 'mismatch', configured, measured, detail: `orca.maxWorkerDepth ${configured} but Orca refused depth ${measured + 1} (its limit is ${measured}); set orca.maxWorkerDepth to the Orca app setting` };
}
