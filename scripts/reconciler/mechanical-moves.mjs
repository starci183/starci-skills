// mechanical-moves.mjs — the next actions of `starci kernel status` that need no judgment, performed by the Job controller in the
// workflow's name: the retry of a job whose gate resolved, whose owner wait filed no ask, whose ask was answered or whose provisional
// acceptance the owner re-opened. Each action carries its typed move (scripts/kernel/retry-move.mjs) and an origin the menu catalog
// classifies (modules/kernel/kernel-menu.yaml); this runs the moves of the mechanical origins, once each, and hands a refused move to the
// Kernel as the retry-decision Decision Item (the retry's own bound is the unit's try budget, which `enqueue` enforces).
import { originOf } from '../kernel/kernel-menu.mjs';
import { mapInOrder } from '../lib/in-order.mjs';

const attempted = new Map(); // `${ledgerId}:${jobId}:${origin}` -> true while the move was made by this engine process

/** The mechanical moves of a status projection: [{key, jobId, origin, verb, argv}]. Pure. */
export function mechanicalMovesOf(status) {
  return (status?.nextActions ?? []).filter((action) => action.move && originOf(action)?.class === 'mechanical').map((action) => ({
    key: `${action.jobId}:${action.origin}`, jobId: action.jobId, origin: action.origin, verb: action.move.verb,
    argv: Object.entries(action.move.args).flatMap(([flag, value]) => (value === true ? [`--${flag}`] : [`--${flag}`, String(value)])),
  }));
}

/**
 * Performs each mechanical move not yet made. `deps`: {facts(jobId), refused(facts, reason)} build the retry-decision item of a move the
 * verb refused. Returns [{jobId, origin, ok, refused?}].
 */
export async function runMechanicalMoves(ctx, ledgerId, status, deps) {
  const due = mechanicalMovesOf(status).filter((move) => !attempted.has(`${ledgerId}:${move.key}`));
  return mapInOrder(due, async (move) => {
    attempted.set(`${ledgerId}:${move.key}`, true);
    const result = await ctx.api(ledgerId, move.verb, move.argv);
    const ok = result?.ok !== false;
    const facts = ok ? null : deps.facts(move.jobId);
    if (facts) await ctx.openDecision(deps.refused(facts, `the ${move.origin} retry was refused: ${String(result?.error ?? result?.stderr ?? 'no reason').slice(0, 200)}`));
    return { jobId: move.jobId, origin: move.origin, ok };
  });
}
