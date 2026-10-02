// worker-accounting.mjs — pure reads over Orca's worker accounting (orchestration worker-list rows, through
// scripts/api/orca/worker-list.mjs). Orca is the authority on which worker terminal is active, reclaimable or
// released, on each worker's liveness, and on the next action it needs; the runtime keeps no table of its own for
// that. Every consumer reads the same row fields through these helpers:
//   - releasePlan: what the GC "agents" collector does with a reclaimable worker (release it per Orca's literal
//     nextAction, or report why not);
//   - workerTerminalHandles: the terminals Orca accounts for as workers (the shells collector and the orca-tree check
//     leave them to Orca's accounting);
//   - worktreePathOf / activeWorkerOn: the lane-owner rule (an active worker whose worktree is the lane).
// Only Orca's own nextAction argv decides the action (owner rule: never write ourselves what Orca has). A SETTLED worker
// whose liveness Orca cannot verify (`unverifiable`) is released like any other: its terminal is Orca-reclaimable, and live
// smoke E1 showed worker-release leaves no agent process of the terminal (alpha5 item 1.6); a row with NO liveness verdict
// is still never acted on.
import { pathKey, sameOrUnder } from './path-key.mjs';

/** The terminal states that still hold a worker terminal Orca has not released. */
const HELD_TERMINAL_STATES = Object.freeze(['active', 'reclaimable', 'retained', 'release_pending', 'release_unknown']);

const livenessOf = (row) => row?.projection?.liveness?.verdict ?? null;
const nextActionOf = (row) => row?.projection?.nextAction ?? null;

/** The agent terminal handle of a worker-list row (resource first, then the Dispatch's). */
export const terminalHandleOf = (row) => row?.resource?.terminalHandle ?? row?.agentTerminalHandle ?? null;

/** The worktree path of a worker-list row: Orca's worktree id is `<repoId>::<path>`; the projection's workspace id the same. */
export function worktreePathOf(row) {
  const id = row?.resource?.worktreeId ?? row?.projection?.workspace?.id ?? null;
  if (!id) return null;
  const at = String(id).indexOf('::');
  return at >= 0 ? String(id).slice(at + 2) : String(id);
}

/** True when argv is exactly Orca's `orchestration worker-release --dispatch <dispatchId>` for this row. */
function isReleaseOf(argv, dispatchId) {
  if (!Array.isArray(argv) || !dispatchId) return false;
  const words = argv.map(String);
  const verb = words.indexOf('worker-release');
  const flag = words.indexOf('--dispatch');
  return verb >= 0 && words[verb - 1] === 'orchestration' && flag > verb && words[flag + 1] === dispatchId;
}

/**
 * The GC decision for each worker row. Pure. Returns [{dispatchId, runId, terminalHandle, terminalState, liveness,
 * verdict: 'release'|'refuse'|'keep', reason}]:
 *   release  reclaimable, liveness live, exited or unverifiable, and Orca's nextAction is worker-release of this Dispatch;
 *   refuse   reclaimable or release_unknown that cannot be released as is (no liveness verdict, another next
 *            action): reported every sweep, never touched;
 *   keep     every other state (active, retained, release_pending, released): Orca's own lifecycle.
 */
export function releasePlan(rows = []) {
  return rows.map((row) => {
    const base = { dispatchId: row?.dispatchId ?? null, runId: row?.runId ?? null, terminalHandle: terminalHandleOf(row),
      terminalState: row?.terminalState ?? null, liveness: livenessOf(row) };
    const next = nextActionOf(row);
    if (base.terminalState === 'release_unknown')
      return { ...base, verdict: 'refuse', reason: `Orca could not confirm the release of ${base.dispatchId} (release_unknown): ${next?.kind ?? 'no next action'}` };
    if (base.terminalState !== 'reclaimable') return { ...base, verdict: 'keep', reason: `terminal state ${base.terminalState ?? 'unknown'}` };
    if (!['live', 'exited', 'unverifiable'].includes(base.liveness))
      return { ...base, verdict: 'refuse', reason: `liveness ${base.liveness ?? 'missing'}: Orca gave no liveness verdict, so it is never acted on` };
    if (!isReleaseOf(next?.argv, base.dispatchId))
      return { ...base, verdict: 'refuse', reason: `Orca's next action is ${next?.kind ?? 'none'}, not worker-release of ${base.dispatchId}` };
    return { ...base, verdict: 'release', reason: `settled worker (${row?.workerState ?? 'unknown'}) whose terminal Orca holds as reclaimable` };
  });
}

/** The terminal handles Orca accounts for as workers it has not released. */
export function workerTerminalHandles(rows = []) {
  return new Set(rows.filter((r) => HELD_TERMINAL_STATES.includes(r?.terminalState)).map(terminalHandleOf).filter(Boolean));
}

/** The first active worker whose worktree is `lanePath` or inside it, or null. */
export function activeWorkerOn(rows = [], lanePath) {
  if (!lanePath) return null;
  const lane = pathKey(lanePath);
  return rows.find((r) => {
    if (r?.terminalState !== 'active') return false;
    const wt = worktreePathOf(r);
    return Boolean(wt) && sameOrUnder(pathKey(wt), lane);
  }) ?? null;
}

/** The distinct Orca Run ids, in first-seen order, of a list of values (nulls dropped). */
export const distinctRuns = (values = []) => [...new Set(values.filter(Boolean).map(String))];
