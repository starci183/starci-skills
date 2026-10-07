// verb-lock.mjs - the one door a verb uses to run a heavy operation under the host lock (scripts/machine/host-lock.mjs),
// so the lock API can change in one place. A verb never calls the lock itself.
import { withHostLock as hostWithLock } from './host-lock.mjs';
import { allocationMs } from '../../engine/config.mjs';
import { retryAfterFailure } from '../lib/retry-budget.mjs';
import { sleep } from '../lib/sleep.mjs';

const LOCK_REFUSALS = new Set(['held', 'not-owner', 'bad-role']);
// The lock knows release, coordinator, lead and worker; the unrestricted owner seat locks as a coordinator.
const lockRole = (role) => (role === 'owner' ? 'coordinator' : role);

/** The retry budget of a verb that waits for a held host lock (modules/models/runtimes.yaml allocation.hostLock). */
export const hostLockRetryBudget = () => ({ intervalMs: allocationMs('hostLock.retryIntervalMs'), maxIntervalMs: allocationMs('hostLock.retryMaxIntervalMs'),
  deadlineMs: allocationMs('hostLock.retryDeadlineMs') });

async function attemptLock({ role, purpose, env, retry }, fn, deps, record, retries) {
  const result = await (deps.withHostLock ?? hostWithLock)({ role: lockRole(role), purpose, env }, fn);
  if (!(result?.ok === false && LOCK_REFUSALS.has(result.reason))) return { ok: true, locked: true, value: result };
  if (!retry || result.reason !== 'held') return retries.length ? { ...result, retries } : result;
  // A held lock is transient: the runtime retries on the budget's interval and names the reason of every attempt.
  const step = retryAfterFailure(retry, record, { now: (deps.now ?? Date.now)(), reason: 'lock-held' });
  const seen = [...retries, { attempt: step.attempts, reason: step.reason, owner: result.owner ?? null, delayMs: step.retry ? step.delayMs : null }];
  if (!step.retry) return { ...result, retries: seen, exhausted: step.exhausted };
  await (deps.sleep ?? sleep)(step.delayMs);
  return attemptLock({ role, purpose, env, retry }, fn, deps, { attempts: step.attempts, firstAt: step.firstAt }, seen);
}

/**
 * Run `fn` under the host lock: {ok: true, locked: true, value} when it ran, or the lock's own refusal
 * ({ok: false, reason: 'held' | 'not-owner' | 'bad-role', owner?}) when it did not. `fn`'s error propagates after the
 * lock is released. With `retry` (a retry budget, hostLockRetryBudget) a held lock is retried until the budget is spent; the refusal then
 * carries `retries` (one named entry per attempt) and `exhausted`.
 */
export async function underHostLock({ role, purpose, env, retry = null }, fn, deps = {}) {
  return attemptLock({ role, purpose, env, retry }, fn, deps, null, []);
}
