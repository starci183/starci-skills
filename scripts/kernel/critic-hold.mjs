// critic-hold.mjs — a report that is blocked only because the independent Critic could not judge.
//
// An op that ran its Critic and met a hold (CRITIC_UNAVAILABLE, CRITIC_NO_INDEPENDENT_MEMBER, CRITIC_QUOTA_OUT, CRITIC_AUTHOR_UNKNOWN: the codes of
// modules/kernel/critic.yaml) filed `blocked` and had to name a blocker kind from the list of modules/models/kinds.yaml; none names a checker, so
// it chose `authority` (seen live on 2026-10-09) and the route table sent the owner a question only the runtime could answer.
// A Critic that could not start or answer is the runtime's: the proof is owed by the runtime, so the kind of such a report is `checker-unavailable`
// whatever the op chose (the one mapping every reader of the blocker uses), and its settle is a re-judgment by the runtime's own Critic.
const CHECKER_UNAVAILABLE = 'checker-unavailable';
const HOLD = /\bCRITIC_(?:UNAVAILABLE|NO_INDEPENDENT_MEMBER|QUOTA_OUT|AUTHOR_UNKNOWN)\b/;

/** The Critic hold code a blocked report's blocker names, or null. */
export function criticHoldOf(envelope) {
  if (envelope?.outcome !== 'blocked') return null;
  return HOLD.exec(String(envelope.blocker?.detail ?? ''))?.[0] ?? null;
}

/** The blocker kind the runtime reads from a report: `checker-unavailable` for a Critic hold, else the kind the op filed (null when none). */
export const effectiveBlockerKind = (envelope) => (criticHoldOf(envelope) ? CHECKER_UNAVAILABLE : envelope?.blocker?.kind ?? null);

/**
 * The settle verdict a report blocked on a Critic hold takes from the runtime's own Critic run over its product: 'pass' or 'fail' when a run produced a
 * verdict document, null otherwise (no run yet, or the run held). `runOf(db, jobId)` is runtimeCriticRunOf.
 */
export function rejudgedVerdictOf(db, envelope, jobId, runOf) {
  if (!criticHoldOf(envelope)) return null;
  const run = runOf(db, jobId);
  if (!run?.document) return null;
  return run.pass === true ? 'pass' : 'fail';
}
