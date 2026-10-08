// mechanical-moves.mjs — the next actions of `starci kernel status` that need no judgment, performed by the Job controller in the
// workflow's name. Each action carries its typed move (scripts/kernel/retry-move.mjs, scripts/kernel/next-moves.mjs) and an origin the
// menu catalog classifies (modules/kernel/kernel-menu.yaml): the retry of a job whose gate resolved, whose owner wait filed no ask, whose
// ask was answered or whose provisional acceptance the owner re-opened; the enqueue of an approved leg that declares its write set, the
// rework of a red node, the re-run of a stale proof or attempt, the asset leg, the credential ask, the owner's redraw and the redo of a
// cut ordinal that does not reconcile with its landed seam. This runs the moves of the mechanical origins, once each per engine process,
// and hands a refused move to the Kernel as a Decision Item: retry-decision for a job nothing follows, move-refused for the rest (the
// retry's own bound is the unit's try budget, which `enqueue` enforces).
import { originOf } from '../kernel/kernel-menu.mjs';
import { commandLine } from '../machine/decision-resolution.mjs';
import { mapInOrder } from '../lib/in-order.mjs';
import { OPENED_BY } from './job-keys.mjs';

const attempted = new Map(); // `${ledgerId}:${key}` -> true while the move was made by this engine process
const RETRYABLE = new Set(['failed', 'awaiting_owner']);

/** The mechanical moves of a status projection: [{key, jobId, origin, op, verb, argv, move}]. A move a gate or a peer-wait holds is theirs to release. Pure. */
export function mechanicalMovesOf(status) {
  return (status?.nextActions ?? []).filter((action) => action.move && !action.heldBy && originOf(action)?.class === 'mechanical').map((action) => ({
    key: `${action.jobId ?? action.nodes?.[0] ?? action.op}:${action.origin}:${action.move.args['retry-of'] ?? action.round ?? ''}`, jobId: action.jobId ?? null, origin: action.origin, op: action.op,
    verb: action.move.verb, move: action.move,
    argv: Object.entries(action.move.args).flatMap(([flag, value]) => (value === true ? [`--${flag}`] : [`--${flag}`, String(value)])),
  }));
}

/** The Decision Item of a refused move that follows no failed job: the Kernel sees the refusal and the command that was refused. */
function moveRefusedDecision(move, reason, { ledgerId, workflowId, settings, now }) {
  const command = commandLine(move.move, 'repo');
  return { schema: 'starci/decision-item@1', kind: 'move-refused', idempotencyKey: `move-refused:${move.key}`, decider: 'kernel', ledger: ledgerId, workflowId,
    entity: { type: move.jobId ? 'job' : 'workflow', id: move.jobId ?? workflowId },
    summary: `${move.origin} ${move.op}: the runtime's move was refused (${String(reason).slice(0, 200)}); change what the refusal names and run it again, or take another way`,
    evidence: [{ ref: `origin:${move.origin}` }, ...(move.jobId ? [{ ref: `job:${move.jobId}` }] : [])],
    options: [{ key: 'run-move-again', verb: command.replace(' --repo repo', ''), title: `run the refused ${move.verb} again` }],
    allowedVerbs: settings.allowedVerbs, dueAt: now + settings.decisionDueMs, escalateTo: 'supervisor', openedBy: OPENED_BY, openedAt: now };
}

/**
 * Performs each mechanical move not yet made. `deps`: {facts(jobId), refused(facts, reason), workflowId, settings: {allowedVerbs, decisionDueMs}}.
 * A refused move opens retry-decision when its job failed and nothing follows it, move-refused otherwise. Returns [{jobId, origin, ok}].
 */
export async function runMechanicalMoves(ctx, ledgerId, status, deps) {
  const due = mechanicalMovesOf(status).filter((move) => !attempted.has(`${ledgerId}:${move.key}`));
  return mapInOrder(due, async (move) => {
    attempted.set(`${ledgerId}:${move.key}`, true);
    const result = await ctx.api(ledgerId, move.verb, move.argv);
    const ok = result?.ok !== false;
    if (!ok) await openRefused(ctx, ledgerId, move, `the ${move.origin} move was refused: ${String(result?.error ?? result?.stderr ?? 'no reason').slice(0, 200)}`, deps);
    return { jobId: move.jobId, origin: move.origin, ok };
  });
}

async function openRefused(ctx, ledgerId, move, reason, deps) {
  const facts = move.jobId ? deps.facts(move.jobId) : null;
  if (facts && RETRYABLE.has(facts.status)) return ctx.openDecision(deps.refused(facts, reason));
  return ctx.openDecision(moveRefusedDecision(move, reason, { ledgerId, workflowId: deps.workflowId, settings: deps.settings, now: ctx.now() }));
}
