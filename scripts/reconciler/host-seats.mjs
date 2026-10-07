// host-seats.mjs — Host seat state classification and the hold policy of a Kernel seat.

/** The seat state a watchdog action puts the seat in (DESIGN 9.4). Pure. */
export function seatStateOf(action) {
  if (['finished', 'archived'].includes(action)) return 'vacant';
  if (['restart-needed', 'agent-exit-unconfirmed', 'terminal-unverified', 'terminal-unreadable'].includes(action)) return 'suspect';
  if (action === 'restarted') return 'reserving';
  if (['restart-failed', 'restart-blocked', 'kernel-terminal-close-failed'].includes(action)) return 'replacing';
  if (action === 'host-unavailable') return 'hostOutage';
  if (['queued-input', 'staged-input'].includes(action)) return 'inputPending';
  if (action === 'interactive-gate') return 'gated';
  return 'live';
}

/**
 * Why the Host leaves a Kernel seat alone this pass, or null: a quarantined seat for holdMs, a restart the watchdog answered
 * restart-blocked (no sender terminal to launch from) for blockedRetryMs. Pure.
 */
export function seatHold(rec, now, s) {
  if (rec.state === 'quarantined' && now - rec.since < s.holdMs) return { ok: true, quarantined: true };
  if (rec.lastAction === 'restart-blocked' && now - rec.lastAt < s.blockedRetryMs) return { ok: true, held: 'restart-blocked', retryInMs: s.blockedRetryMs - (now - rec.lastAt) };
  return null;
}
