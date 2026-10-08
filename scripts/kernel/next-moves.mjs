// next-moves.mjs — the typed moves of the next actions the runtime performs for the Kernel. A move is `starci kernel enqueue` with the
// arguments the ledger already fixes: the plan leg's own write set, the records that declare artwork slots, the job a rerun repeats. The
// projection (scripts/kernel/graph-projection.mjs, verbs/shared/status-decor.mjs) attaches the move to a next action of a mechanical
// origin; the Job controller (scripts/reconciler/mechanical-moves.mjs) runs it once. An action whose move cannot be built is no longer
// mechanical: it takes the judgment origin its catalog row names (modules/kernel/kernel-menu.yaml `fallback`) and the Kernel's menu holds it.
import { menuCatalog } from './kernel-menu.mjs';
import { retryMoveOf } from './retry-move.mjs';

const csv = (list) => (Array.isArray(list) ? list.map(String).filter(Boolean).join(',') : String(list ?? ''));

/** The enqueue move of an op on a write set, or null when the write set is empty. `rest` holds the optional flags (`retry-of`, `params`, `reopen`, ...). */
export function enqueueMove(workflow, { op, paths, ...rest }) {
  const owned = csv(paths);
  if (!op || !owned) return null;
  const args = { workflow, op, paths: owned };
  for (const [flag, value] of Object.entries(rest)) if (value != null && value !== '') args[flag] = String(value);
  return { verb: 'enqueue', args };
}

/**
 * The move that runs a settled job's unit again: a failed or awaiting-owner job is retried (`--retry-of`), a succeeded one is reopened with
 * the reason (a passed unit runs again only on an explicit reopen, engine/admission.mjs admitUnitTry). Null when the job has no write set.
 */
export function rerunMoveOf(row, { op = row?.op_id, reason }) {
  const move = retryMoveOf(row, { op });
  if (!move) return null;
  if (row.status !== 'succeeded') return move;
  const args = { ...move.args, reopen: reason };
  delete args['retry-of'];
  return { verb: move.verb, args };
}

/** The write set each plan leg declares: Map(op -> csv). An op that two legs carry, or a leg without paths, has no entry (the Kernel derives it). */
export function legPathsOf(goalJsonText) {
  let legs;
  try { legs = JSON.parse(goalJsonText ?? '{}')?.derivedPlan?.legs; } catch { return new Map(); }
  if (!Array.isArray(legs)) return new Map();
  const count = new Map();
  for (const leg of legs) if (leg?.op) count.set(String(leg.op), (count.get(String(leg.op)) ?? 0) + 1);
  return new Map(legs.filter((leg) => leg?.op && count.get(String(leg.op)) === 1 && csv(leg.paths)).map((leg) => [String(leg.op), csv(leg.paths)]));
}

/** The judgment origin a mechanical origin falls back to when no move can be built (its own id when the catalog names none). */
export const fallbackOriginOf = (origin) => menuCatalog().origins.find((row) => row.id === origin)?.fallback ?? origin;

/** The action with its move; without one, the action with the judgment origin it falls back to. */
export const withMove = (action, move) => (move ? { ...action, move } : { ...action, origin: fallbackOriginOf(action.origin) });
