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
//                        report now with starci kernel report"; after 10 min -> starci kernel reconcile --dead-worker --settle-failed (the
//                        failed-no-report path, whose salvage continues from the worker's commits)
//   idle-at-prompt       no output for idleMs (5 min) and no filed report: nudge "Continue your task, or file your
//                        report with starci kernel report if done." at most maxIdleNudges (2), then a DI
//   dead                 terminal gone (not listed nor shown) or exited, or the settler's sweep set the job condition
//                        LeaseLive=False: starci kernel reconcile --dead-worker --settle-failed at once, once per job (H14: a dead
//                        worker is settled within one probe, never left waiting for the Kernel's next turn)
//
// Nudges are staggered: at most one send per staggerMs (15 s) across all workers. The memory of each job (last output
// seen, nudges, backoff) lives in the engine process (a restart only re-arms the clocks). planHealth is pure.

const RATE_LIMITED = /rate[- ]?limit|Send a message to retry|Upgrade to .* for higher limits/i;
const DONE_NO_REPORT = /Worked for .* done|Press enter to continue/i;
const RESET_HINT_TERMS = '(?:reset|resets|try again|retry|available)';
const RESET_HINT_WAIT = String.raw`\s+(?:in|after)\s+`;
const RESET_HINT_UNITS = ['s', 'sec', 'secs', 'seconds?', 'm', 'min', 'mins', 'minutes?', 'h', 'hr', 'hours?'].join('|');
const RESET_HINT_DURATION = String.raw`(\d+(?:\.\d+)?)\s*(${RESET_HINT_UNITS})\b`;
const RESET_HINT = new RegExp(RESET_HINT_TERMS + RESET_HINT_WAIT + RESET_HINT_DURATION, 'i');
export const NUDGE = Object.freeze({
  retry: 'Retry: continue your task from where you stopped.',
  idle: 'Continue your task, or file your report with starci kernel report if done.',
  report: 'File your report now with starci kernel report',
});
export const HEALTH_DEFAULTS = Object.freeze({
  everyMs: 30_000, idleMs: 300_000, maxIdleNudges: 2, staggerMs: 15_000, backoffMinMs: 30_000, backoffMaxMs: 300_000,
  rateLimitDecisionMs: 1_800_000, rateLimitWaitMs: 300_000, doneNudgeEveryMs: 180_000, doneFailAfterMs: 600_000, idleNudgeEveryMs: 300_000,
});

/** The reset hint of a rate-limit screen in ms from now ("resets in 5 minutes", "try again in 30s", "retry after 2h"), or null. */
export function resetHintMs(text) {
  const m = RESET_HINT.exec(String(text ?? ''));
  if (!m) return null;
  const n = Number(m[1]), u = m[2].toLowerCase();
  let multiplier = 1000;
  if (u.startsWith('h')) multiplier = 3_600_000;
  else if (u.startsWith('m')) multiplier = 60_000;
  return Math.round(n * multiplier);
}

/** Classify one worker. Pure. `mem` is the job's probe memory ({lastOutputAt, ...}); `term` the orca terminal row or null. */
export function classifyWorker(term, { mem = {}, reportFiled = false, leaseLost = false, now = Date.now(), settings = HEALTH_DEFAULTS } = {}) {
  if (leaseLost) return { state: 'dead', why: 'lease-lost' };
  // Orca reports a workflow-worktree terminal orphaned and disconnected while its agent still runs: only a missing
  // terminal or one with an exit cause is dead (the dead-worker step proves it).
  if (!term || term.exitCause) return { state: 'dead', why: term ? `exited: ${term.exitCause}` : 'terminal gone' };
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
 * {kind: 'dead-worker', why} | {kind: 'decision', why} | null. `rand` is the jitter source.
 */
export function planHealth(c, { mem = {}, now = Date.now(), settings = HEALTH_DEFAULTS, rand = Math.random } = {}) {
  const m = { ...mem, state: c.state, seenAt: mem.seenAt ?? now };
  if (c.state === 'dead') {
    // H14: the dead-worker reconcile runs from the probe itself, once per job (a failed one is retried by the next probe
    // only after the Job controller's own dead-worker step has had its turn: reconciledAt holds it for one idleMs).
    if (mem.state === 'dead' && mem.reconciledAt != null && now - mem.reconciledAt < settings.idleMs) return { mem, action: null };
    return { mem: { lastOutputAt: mem.lastOutputAt ?? null, seenAt: now, state: 'dead', reconciledAt: now }, action: { kind: 'dead-worker', why: c.why ?? 'dead' } };
  }
  if (c.state === 'working') {
    return { mem: { lastOutputAt: c.lastOutputAt ?? mem.lastOutputAt ?? null, seenAt: now, state: c.state }, action: null };
  }
  if (c.state !== mem.state) { m.since = now; m.nudges = 0; m.lastNudgeAt = null; m.backoffMs = null; m.decided = false; }
  const since = m.since ?? now;
  if (c.state === 'rate-limited') return planRateLimited(c, m, { now, settings, rand, since });
  if (c.state === 'done-without-report') return planDoneWithoutReport(m, { now, settings, since });
  return planIdleAtPrompt(m, { now, settings });
}

function planRateLimited(c, m, { now, settings, rand, since }) {
  // A reset further away than the wait budget is a quota window, not a pause: the job moves to the next eligible member
  // (failed-no-report: the lineage demotes this pool, the retry resumes from the preserved work).
  if (c.resetMs != null && c.resetMs > settings.rateLimitWaitMs) return { mem: { ...m, switched: true }, action: m.switched ? null : { kind: 'fail-no-report', why: `rate limit resets in ${Math.round(c.resetMs / 60_000)} min, beyond the ${Math.round(settings.rateLimitWaitMs / 60_000)} min wait budget` } };
  if (now - since > settings.rateLimitDecisionMs && !m.decided) return { mem: { ...m, decided: true }, action: { kind: 'decision', why: `rate-limited for ${Math.round((now - since) / 60_000)} min` } };
  const backoffMsOf = () => Math.min(settings.backoffMaxMs, (m.backoffMs ?? settings.backoffMinMs / 2) * 2);
  const wait = c.resetMs != null ? c.resetMs : backoffMsOf() * (1 + 0.2 * rand());
  if (m.nextAt == null) {
    const backoffMs = c.resetMs != null ? m.backoffMs : backoffMsOf();
    return { mem: { ...m, nextAt: now + wait, backoffMs }, action: null };
  }
  if (now < m.nextAt) return { mem: m, action: null };
  return { mem: { ...m, nextAt: null, nudges: (m.nudges ?? 0) + 1, lastNudgeAt: now }, action: { kind: 'send', text: NUDGE.retry } };
}

function planDoneWithoutReport(m, { now, settings, since }) {
  if (now - since > settings.doneFailAfterMs) return { mem: { ...m, failed: true }, action: m.failed ? null : { kind: 'fail-no-report' } };
  if (m.lastNudgeAt != null && now - m.lastNudgeAt < settings.doneNudgeEveryMs) return { mem: m, action: null };
  return { mem: { ...m, nudges: (m.nudges ?? 0) + 1, lastNudgeAt: now }, action: { kind: 'send', text: NUDGE.report } };
}

function planIdleAtPrompt(m, { now, settings }) {
  // idle-at-prompt
  if ((m.nudges ?? 0) >= settings.maxIdleNudges) {
    if (m.lastNudgeAt != null && now - m.lastNudgeAt >= settings.idleNudgeEveryMs && !m.decided) return { mem: { ...m, decided: true }, action: { kind: 'decision', why: `idle at its prompt after ${m.nudges} nudge(s)` } };
    return { mem: m, action: null };
  }
  if (m.lastNudgeAt != null && now - m.lastNudgeAt < settings.idleNudgeEveryMs) return { mem: m, action: null };
  return { mem: { ...m, nudges: (m.nudges ?? 0) + 1, lastNudgeAt: now }, action: { kind: 'send', text: NUDGE.idle } };
}
