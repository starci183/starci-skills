// land-lock.mjs - the land's one exclusive step under the host lock. A land runs its gate (scratch worktree, checks, specs) with NO host lock:
// lands already serialize on the land queue (acquireLand, machine.sqlite), and the gate only touches its own scratch. The host's one heavy-run lock
// (scripts/machine/host-lock.mjs, role coordinator, purpose land) is held for the publish alone: the fast-forward of main, the grammar rebuild and the
// push, which mutate the shared checkout. A held lock is waited for (bounded, a holder that died is taken over) and then refused as a typed
// `host-lock-held` result naming the holder. A spec run takes no host lock unless deps.hostLock is given (a spec never touches the host's real lock).
import { withHostLock } from '../machine/host-lock.mjs';
import { isSpecRun } from '../lib/env.mjs';
import { sleepSync } from '../lib/sleep-sync.mjs';

const LOCK_WAIT_MS = 600_000;
const LOCK_POLL_MS = 2000;

const holderText = (o) => `the host lock is held by ${o.role ?? 'an unknown owner'}${o.purpose ? ` (${o.purpose})` : ''}${o.pid ? ` pid ${o.pid}` : ''}${o.since ? ` since ${o.since}` : ''}`;

/** The typed refusal of a run whose lock stayed held: {ok:false, reason:'host-lock-held', owner, detail, hint, waitedMs}. */
const heldRefusal = (owner, waitedMs) => ({ ok: false, reason: 'host-lock-held', owner: owner ?? {}, waitedMs,
  detail: `${holderText(owner ?? {})}; waited ${Math.round(waitedMs / 1000)}s for it`,
  hint: 'another heavy host job holds the lock; run again once it finishes (a land that waited here published nothing: main did not move; a holder whose process died is taken over automatically); never delete the lock directory by hand' });

/**
 * underHostLockWaiting({role, purpose, env, deps}, work): `work()` under the host lock (default role coordinator, purpose land), or the typed refusal. A held lock is polled every
 * LOCK_POLL_MS up to deps.hostLockWaitMs (default LOCK_WAIT_MS); `work` runs once, only with the lock held. Seams: deps.hostLock (replaces
 * withHostLock), deps.sleep, deps.now.
 */
export function underHostLockWaiting({ role = 'coordinator', purpose = 'land', env = process.env, deps = {} }, work) {
  const lock = deps.hostLock ?? (isSpecRun(env) ? null : withHostLock);
  if (!lock) return work();
  const sleep = deps.sleep ?? sleepSync;
  const now = deps.now ?? Date.now;
  const waitMs = deps.hostLockWaitMs ?? LOCK_WAIT_MS;
  const started = now();
  for (;;) {
    const out = lock({ role, purpose, env }, work);
    if (!(out?.ok === false && out.reason === 'held')) return out;
    const waited = now() - started;
    if (waited >= waitMs) return heldRefusal(out.owner, waited);
    sleep(Math.min(LOCK_POLL_MS, waitMs - waited));
  }
}
