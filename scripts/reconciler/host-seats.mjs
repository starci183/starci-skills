// host-seats.mjs — Host seat state classification and the hold policy of a Kernel seat.
import { holdSummary } from '../kernel/start-hold.mjs';
import { RECOVERY_REFUSAL, recoveryItemOpen } from '../kernel/launch-held-item.mjs';

/** The seat state a watchdog action puts the seat in (DESIGN 9.4). Pure. */
export function seatStateOf(action) {
  if (['finished', 'archived'].includes(action)) return 'vacant';
  if (['restart-needed', 'agent-exit-unconfirmed', 'terminal-unverified', 'terminal-unreadable'].includes(action)) return 'suspect';
  if (['restarted', 'rotated'].includes(action)) return 'reserving';
  if (action === 'start-held') return 'quarantined';
  if (['restart-failed', 'restart-blocked', 'kernel-terminal-close-failed'].includes(action)) return 'replacing';
  if (action === 'host-unavailable') return 'hostOutage';
  if (['queued-input', 'staged-input'].includes(action)) return 'inputPending';
  if (action === 'interactive-gate') return 'gated';
  return 'live';
}

/**
 * Why the Host leaves a Kernel seat alone this pass, or null: a quarantined seat for holdMs (unless the runtime now running is not the
 * one that quarantined it: a record with no revision is older, and a changed runtime gets a probation pass), a restart the watchdog
 * answered restart-blocked (no sender terminal to launch from) for blockedRetryMs. Pure.
 */
export function seatHold(rec, now, s, rev = null) {
  const sameRuntime = !rev || rec.quarantinedRev === rev;
  if (rec.state === 'quarantined' && sameRuntime && now - rec.since < s.holdMs) return { ok: true, quarantined: true };
  if (rec.lastAction === 'restart-blocked' && now - rec.lastAt < s.blockedRetryMs) return { ok: true, held: 'restart-blocked', retryInMs: s.blockedRetryMs - (now - rec.lastAt) };
  return null;
}

/**
 * The Decision Item of a quarantined Kernel seat, opened once per quarantine: more replacements than the hour allows, or a launch
 * held for a cause it repeats (`hold`: the cause, its count and the evidence kernel/start-hold.mjs read from the ledger).
 */
export async function seatQuarantine(ctx, { key, rec, next, ledgerId, workflowId, action, now, hold = null }, { di }) {
  if (rec.state === 'quarantined') return;
  // The recovery's own Supervisor item owns a refused launch recovery; the hold still counts it, a second item is not opened.
  if (hold?.step === RECOVERY_REFUSAL && recoveryItemOpen(ctx.stateDb, workflowId)) return;
  await ctx.openDecision(di({
    kind: 'seat-unrecoverable', ledger: ledgerId, workflowId, entity: { type: 'seat', id: key }, idempotencyKey: `seat-unrecoverable:${key}:${now}`,
    summary: hold ? `${workflowId}: ${holdSummary(hold)}; the Kernel seat is quarantined` : `${workflowId}: the Kernel seat was replaced ${next.restarts.length} times in an hour; quarantined`,
    evidence: [{ ref: `action:${action}` }, ...(hold ? [{ ref: `hold:${JSON.stringify(hold).slice(0, 1500)}` }] : [])],
    options: [{ key: 'reopen', verb: `starci reconciler reopen ${key}`, recommended: true }], allowedVerbs: ['reopen'],
  }));
}
