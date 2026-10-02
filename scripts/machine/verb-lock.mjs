// verb-lock.mjs - the one door a verb uses to run a heavy operation under the host lock (scripts/machine/host-lock.mjs),
// so the lock API can change in one place. A verb never calls the lock itself.
import { withHostLock as hostWithLock } from './host-lock.mjs';

/**
 * Run `fn` under the host lock: {ok: true, locked: true, value} when it ran, or the lock's own refusal
 * ({ok: false, reason: 'held', owner}) when another run holds it. `fn`'s error propagates after the lock is released.
 */
export async function underHostLock({ role, purpose, env }, fn, deps = {}) {
  const result = await (deps.withHostLock ?? hostWithLock)({ role, purpose, env }, fn);
  if (result?.ok === false && result.reason === 'held') return result;
  return { ok: true, locked: true, value: result };
}
