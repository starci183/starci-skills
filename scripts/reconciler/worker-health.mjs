// worker-health.mjs — the Job controller's deterministic worker-health probe (owner-driven, 2026-09-28).
//
// Five fe-canon Devin op workers sat at "Reached free model rate limit ... Send a message to retry" and nothing knew:
// liveness only proved the process alive and the terminal connected. Every probe (Job controller key `health:all`,
// every job.yaml health.everyMs) reads ONE `orca terminal list` (preview, lastOutputAt, connected, agentIdentity) and
// classifies each live op job's worker - never an LLM:
//
//   working              lastOutputAt advanced since the last probe (nothing to do; the stall memory resets)
//   rate-limited         preview /rate limit|Send a message to retry|Upgrade to .* for higher limits/i: wait for the
//                        reset hint, else backoff 30s -> 5min with jitter, then send "Retry: continue your task from
//                        where you stopped."; a provider-rate-limited row for the Resource controller; DI after 30 min
//   done-without-report  preview /Worked for .* done|Press enter to continue/ and no filed report: nudge "File your
//                        report now with api report"; after 10 min -> api reconcile --dead-worker --settle-failed (the
//                        failed-no-report path, whose salvage continues from the worker's commits)
//   idle-at-prompt       no output for idleMs (5 min) and no filed report: nudge "Continue your task, or file your
//                        report with api report if done." at most maxIdleNudges (2), then a DI
//   dead                 terminal gone (not listed nor shown) or exited: left to the dead-worker step (api status deadWorkerJobs)
//
// Nudges are staggered: at most one send per staggerMs (15 s) across all workers. The memory of each job (last output
// seen, nudges, backoff) lives in the engine process (a restart only re-arms the clocks). planHealth is pure.

export const RATE_LIMITED = /rate[- ]?limit|Send a message to retry|Upgrade to .* for higher limits/i;
export const DONE_NO_REPORT = /Worked for .* done|Press enter to continue/i;
export const NUDGE = Object.freeze({
  retry: 'Retry: continue your task from where you stopped.',
  idle: 'Continue your task, or file your report with api report if done.',
  report: 'File your report now with api report',
});
export const HEALTH_DEFAULTS = Object.freeze({
  everyMs: 30_000, idleMs: 300_000, maxIdleNudges: 2, staggerMs: 15_000, backoffMinMs: 30_000, backoffMaxMs: 300_000,
  rateLimitDecisionMs: 1_800_000, doneNudgeEveryMs: 180_000, doneFailAfterMs: 600_000, idleNudgeEveryMs: 300_000,
});

/** The reset hint of a rate-limit screen in ms from now ("resets in 5 minutes", "try again in 30s", "retry after 2h"), or null. */
export function resetHintMs(text) {
  const m = /(?:reset|resets|try again|retry|available)\s+(?:in|after)\s+(\d+(?:\.\d+)?)\s*(s|sec|secs|seconds?|m|min|mins|minutes?|h|hr|hours?)\b/i.exec(String(text ?? ''));
  if (!m) return null;
  const n = Number(m[1]), u = m[2].toLowerCase();
  return Math.round(n * (u.startsWith('h') ? 3_600_000 : u.startsWith('m') ? 60_000 : 1000));
}

/** Classify one worker. Pure. `mem` is the job's probe memory ({lastOutputAt, ...}); `term` the orca terminal row or null. */
export function classifyWorker(term, { mem = {}, reportFiled = false, now = Date.now(), settings = HEALTH_DEFAULTS } = {}) {
  // Orca reports a product-worktree terminal orphaned and disconnected while its agent still runs: only a missing
  // terminal or one with an exit cause is dead (the dead-worker step proves it).
  if (!term || term.exitCause) return { state: 'dead' };
  const preview = String(term.preview ?? '');
  const out = Number(term.lastOutputAt) || null;
  if (RATE_LIMITED.test(preview)) return { state: 'rate-limited', resetMs: resetHintMs(preview) };
  if (!reportFiled && DONE_NO_REPORT.test(preview)) return { state: 'done-without-report' };
  if (out && (mem.lastOutputAt == null || out > mem.lastOutputAt)) return { state: 'working', lastOutputAt: out };
  const since = out ?? mem.seenAt ?? now;
  if (!reportFiled && now - since > settings.idleMs) return { state: 'idle-at-prompt', idleMs: now - since };
  return { state: 'working', lastOutputAt: out };
}

/**
 * The next memory and the action for one worker. Pure. Actions: {kind: 'send', text} | {kind: 'fail-no-report'} |
 * {kind: 'decision', why} | null. `rand` is the jitter source.
 */
export function planHealth(c, { mem = {}, now = Date.now(), settings = HEALTH_DEFAULTS, rand = Math.random } = {}) {
  const m = { ...mem, state: c.state, seenAt: mem.seenAt ?? now };
  if (c.state === 'working' || c.state === 'dead') {
    return { mem: { lastOutputAt: c.lastOutputAt ?? mem.lastOutputAt ?? null, seenAt: now, state: c.state }, action: null };
  }
  if (c.state !== mem.state) { m.since = now; m.nudges = 0; m.lastNudgeAt = null; m.backoffMs = null; m.decided = false; }
  const since = m.since ?? now;
  if (c.state === 'rate-limited') {
    if (now - since > settings.rateLimitDecisionMs && !m.decided) return { mem: { ...m, decided: true }, action: { kind: 'decision', why: `rate-limited for ${Math.round((now - since) / 60_000)} min` } };
    const wait = c.resetMs != null ? c.resetMs
      : Math.min(settings.backoffMaxMs, (m.backoffMs ?? settings.backoffMinMs / 2) * 2) * (1 + 0.2 * rand());
    if (m.nextAt == null) return { mem: { ...m, nextAt: now + wait, backoffMs: c.resetMs != null ? m.backoffMs : Math.min(settings.backoffMaxMs, (m.backoffMs ?? settings.backoffMinMs / 2) * 2) }, action: null };
    if (now < m.nextAt) return { mem: m, action: null };
    return { mem: { ...m, nextAt: null, nudges: (m.nudges ?? 0) + 1, lastNudgeAt: now }, action: { kind: 'send', text: NUDGE.retry } };
  }
  if (c.state === 'done-without-report') {
    if (now - since > settings.doneFailAfterMs) return { mem: { ...m, failed: true }, action: m.failed ? null : { kind: 'fail-no-report' } };
    if (m.lastNudgeAt != null && now - m.lastNudgeAt < settings.doneNudgeEveryMs) return { mem: m, action: null };
    return { mem: { ...m, nudges: (m.nudges ?? 0) + 1, lastNudgeAt: now }, action: { kind: 'send', text: NUDGE.report } };
  }
  // idle-at-prompt
  if ((m.nudges ?? 0) >= settings.maxIdleNudges) {
    if (m.lastNudgeAt != null && now - m.lastNudgeAt >= settings.idleNudgeEveryMs && !m.decided) return { mem: { ...m, decided: true }, action: { kind: 'decision', why: `idle at its prompt after ${m.nudges} nudge(s)` } };
    return { mem: m, action: null };
  }
  if (m.lastNudgeAt != null && now - m.lastNudgeAt < settings.idleNudgeEveryMs) return { mem: m, action: null };
  return { mem: { ...m, nudges: (m.nudges ?? 0) + 1, lastNudgeAt: now }, action: { kind: 'send', text: NUDGE.idle } };
}
