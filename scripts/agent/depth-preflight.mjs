// The worker-depth preflight of an agent launch (scripts/agent/lib.mjs spawnAgent and startAgent).
import { orcaSettings } from '../../engine/orca-config.mjs';
import { loadConfig } from '../../engine/config.mjs';
import { workerShow } from '../api/orca/worker-show.mjs';
import { workerListAll } from '../api/orca/worker-list.mjs';
import { dispatchDepthOf, launchDepth, depthVerdict, dispatchOfTerminal } from '../lib/worker-depth.mjs';
import { bestEffortCall } from './best-effort-call.mjs';
import { launchedDispatchOf } from './launched-terminals.mjs';

/**
 * The depth preflight of one launch: {depth, limit, refusal|null}. `show` reads the parent's Dispatch (worker-show).
 * refusal is the typed step-'depth' receipt (effectState none) when the new worker would nest past the limit.
 */
export function depthPreflight({ parentDispatch = null, maxDepth = null, show = workerShow } = {}) {
  const limit = Number.isInteger(maxDepth) ? maxDepth : configuredMaxDepth();
  const parentDepth = parentDispatch ? dispatchDepthOf(bestEffortCall(() => show({ dispatch: parentDispatch }))) : null;
  const depth = launchDepth({ parentDispatch, parentDepth });
  const tooDeep = depthVerdict({ depth, maxDepth: limit });
  return { depth, limit, refusal: tooDeep ? { ok: false, step: 'depth', error: tooDeep.error, errorCode: tooDeep.code, code: 'worker-depth-exceeded',
    effectState: 'none', depth, maxDepth: limit, parentDispatch } : null };
}

/**
 * The Dispatch of the worker the entry terminal is, or null: the runtime's own record of what it launched
 * (launched-terminals.mjs; Orca's worker-list is scoped to the caller's bound Run and never lists the caller's own Dispatch
 * when it is nested), else Orca's active workers (worker-list, every page; right for a depth-1 entry). A Kernel, the [Supervisor] or a [Worker] started from a worker's terminal nests under that worker; started from the
 * owner's chat or a plain shell (no row), it is chat-rooted. A failed listing proves nothing (null).
 */
export function entryDispatchOf(entry, { list = () => workerListAll({ terminalState: 'active' }), launched = launchedDispatchOf } = {}) {
  if (!entry) return null;
  const recorded = launched(entry);
  if (recorded) return recorded;
  try {
    const listed = list();
    return listed?.ok ? dispatchOfTerminal(listed.workers, entry) : null;
  } catch { return null; }
}

// config.yaml orca.maxWorkerDepth; an unreadable or invalid owner config falls back to the default (start --check
// reports the config itself).
const configuredMaxDepth = () => { try { return orcaSettings(loadConfig()).maxWorkerDepth; } catch { return orcaSettings({}).maxWorkerDepth; } };
