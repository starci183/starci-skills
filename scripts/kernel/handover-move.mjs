// handover-move.mjs — the handover step the runtime performs itself. A handover that is due, and a handover ask the owner answered approve or question
// (or a delegate answered approve, which never approves), each owe exactly one thing: handover.review enqueued again on the fixed handover evidence path.
// Nothing is judged, so the action carries its typed move (scripts/kernel/next-moves.mjs) and the Job controller performs it once per engine process
// (scripts/reconciler/mechanical-moves.mjs). An answer of feedback names a defect: which slice or record it concerns is the Kernel's judgment, so it
// stays on the menu (item handover-step) and yields no action here.
import { HANDOVER_OP } from './handover.mjs';
import { enqueueMove, withMove } from './next-moves.mjs';

const handoverPaths = (workflow) => `.starciwork/evidence/${workflow}.handover`;

/** Why the handover review is owed now: the answered ask it applies, or the due handover; null when nothing is owed or the Kernel judges it. */
function owedBy(handover) {
  if (handover?.state === 'answered' && handover.ask) {
    return handover.ask.decision === 'feedback' ? null : { round: handover.ask.dispatchId, what: `handover ask ${handover.ask.dispatchId} was answered ${handover.ask.decision ?? 'with no recognised option'}` };
  }
  // A failed review is retried by its own origin (failed-step-open); a second enqueue would run it twice.
  if (handover?.due && handover.jobStatus !== 'failed') return { round: handover.jobId ?? 'first', what: 'every approved leg settled and no current owner approval exists' };
  return null;
}

/** The next action that enqueues handover.review, or null. `round` keys the once-per-process bound: a later handover round is a new move. */
export function handoverReviewAction(handover, workflow) {
  const owed = owedBy(handover);
  if (!owed) return null;
  const paths = handoverPaths(workflow);
  return withMove({ kind: 'dispatch', origin: 'handover-review', op: HANDOVER_OP, paths, round: owed.round,
    reason: `${owed.what}: starci kernel enqueue --op ${HANDOVER_OP} --paths ${paths}, then route and dispatch it` }, enqueueMove(workflow, { op: HANDOVER_OP, paths }));
}
