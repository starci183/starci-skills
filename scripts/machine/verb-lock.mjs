// verb-lock.mjs - the one door a verb uses to run a heavy operation under the host lock (scripts/machine/host-lock.mjs),
// so the lock API can change in one place. A verb never calls the lock itself.
import { withHostLock as hostWithLock } from './host-lock.mjs';

const LOCK_REFUSALS = new Set(['held', 'not-owner', 'bad-role']);
// The lock knows release, coordinator, lead and worker; the unrestricted owner seat locks as a coordinator.
const lockRole = (role) => (role === 'owner' ? 'coordinator' : role);

/**
 * Run `fn` under the host lock: {ok: true, locked: true, value} when it ran, or the lock's own refusal
 * ({ok: false, reason: 'held' | 'not-owner' | 'bad-role', owner?}) when it did not. `fn`'s error propagates after the
 * lock is released.
 */
export async function underHostLock({ role, purpose, env }, fn, deps = {}) {
  const result = await (deps.withHostLock ?? hostWithLock)({ role: lockRole(role), purpose, env }, fn);
  if (result?.ok === false && LOCK_REFUSALS.has(result.reason)) return result;
  return { ok: true, locked: true, value: result };
}
