// The one retry budget. A transient refusal (a provider rate limit, a held lock, a resource floor, a host that did not answer)
// is retried by the runtime on an interval until its budget is spent, each attempt carrying the named reason it failed for;
// a spent budget is an escalation, never a silent loop. Pure: callers keep the state (a queue row, a job payload) and the clock.

const positive = (value) => Number.isFinite(value) && value > 0;

/**
 * The next step after attempt number `attempts` failed for `reason`.
 * budget: {intervalMs, maxIntervalMs = intervalMs (the interval doubles per attempt up to it), maxAttempts = unlimited, deadlineMs = unlimited since firstAt}.
 * A `retryAfterMs` the refusal itself named (a rate limit's own reset time) replaces the computed interval.
 * -> {retry, attempts, reason, delayMs, dueAt, firstAt, exhausted: null | 'attempts' | 'deadline'}
 */
export function nextRetry(budget, { attempts, firstAt = null, now, reason, retryAfterMs = null }) {
  if (typeof reason !== 'string' || !reason.trim()) throw new Error('a retry names the reason it failed for');
  if (!positive(budget?.intervalMs)) throw new Error('a retry budget declares a positive intervalMs');
  const maxIntervalMs = budget.maxIntervalMs ?? budget.intervalMs;
  const asked = Number(retryAfterMs);
  const delayMs = retryAfterMs !== null && Number.isFinite(asked) && asked >= 0 ? asked
    : Math.min(maxIntervalMs, budget.intervalMs * 2 ** Math.min(Math.max(attempts, 1) - 1, 30));
  const started = firstAt ?? now;
  let exhausted = null;
  if (Number.isFinite(budget.maxAttempts) && attempts >= budget.maxAttempts) exhausted = 'attempts';
  else if (Number.isFinite(budget.deadlineMs) && now + delayMs - started > budget.deadlineMs) exhausted = 'deadline';
  return { retry: exhausted === null, attempts, reason, delayMs, dueAt: exhausted === null ? now + delayMs : null, firstAt: started, exhausted };
}

/** The delay before attempt number `attempts` of a plain doubling backoff {minMs, maxMs}: the budget with no attempt or deadline bound. */
export const doublingDelay = (attempts, { minMs, maxMs }) => nextRetry({ intervalMs: minMs, maxIntervalMs: maxMs }, { attempts, now: 0, reason: 'backoff' }).delayMs;

/** The attempt that just failed, folded onto the record the caller kept ({attempts, firstAt} or null): the decision for it. */
export function retryAfterFailure(budget, record, { now, reason, retryAfterMs = null }) {
  return nextRetry(budget, { attempts: (Number(record?.attempts) || 0) + 1, firstAt: record?.firstAt ?? null, now, reason, retryAfterMs });
}
