// land-lock.mjs - the land under the host lock: the heavy part of a land (scratch worktree, checks, fast-forward) runs while the host's one heavy-run
// lock (scripts/machine/host-lock.mjs, role coordinator) is held; a held lock refuses the land naming the holder, nothing is queued. A spec run takes no host
// lock unless deps.hostLock is given (a spec never touches the host's real lock).
import { withHostLock } from '../machine/host-lock.mjs';
import { isSpecRun } from '../lib/env.mjs';

/** landUnderHostLock(args, landLocked): landLocked(args) under the lock, or the typed refusal {ok:false, reason:'host-lock-held', owner, detail, hint}. */
export function landUnderHostLock(args, landLocked) {
  const { commits, env = process.env, deps = {} } = args;
  const lock = deps.hostLock ?? (isSpecRun(env) ? null : withHostLock);
  if (!lock) return landLocked(args);
  const out = lock({ role: 'coordinator', purpose: 'land', env }, () => landLocked(args));
  if (out?.ok === false && out.reason === 'held') {
    const o = out.owner ?? {};
    return { ok: false, commits, attempts: [], cleanup: { left: [] }, reason: 'host-lock-held', owner: o,
      detail: `the host lock is held by ${o.role ?? 'an unknown owner'}${o.purpose ? ` (${o.purpose})` : ''}${o.pid ? ` pid ${o.pid}` : ''}${o.since ? ` since ${o.since}` : ''}`,
      hint: 'another heavy host job holds the lock; land again once it finishes (a holder whose process died is taken over automatically); never delete the lock directory by hand' };
  }
  return out;
}
