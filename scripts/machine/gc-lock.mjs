// gc-lock.mjs — the host lock `gc`: one GC apply at a time (the Supervisor's GC tick, blob-gc, the reconciler GC controller).
import { withSupervisor } from './home.mjs';
import { pidAlive } from '../../engine/db/machine.mjs';
import { sleepSync } from '../lib/sleep-sync.mjs';

const GC_LOCK = 'gc';
/**
 * The host lock `gc` (machine.sqlite host_locks, ttl staleMs): an apply run (the tick, a hand-run `gc.mjs --apply`,
 * blob-gc, the reconciler GC controller) holds it so two never overlap. {ok, release()} | {ok:false, holder: {holder,
 * pid, at}}. A lock past its ttl, or whose holder process is gone, is taken over; a busy one is polled for waitMs.
 */
export function acquireGcLock({ env = process.env, holder = 'gc', waitMs = 0, staleMs = 3_600_000, pollMs = 250 } = {}) {
  const started = Date.now();
  for (;;) {
    const r = withSupervisor((m) => {
      const got = m.acquireHostLock({ name: GC_LOCK, holder, ttlMs: staleMs });
      if (got.ok || pidAlive(got.holder?.holder_pid)) return got;
      m.releaseHostLock({ name: GC_LOCK, force: true });
      return m.acquireHostLock({ name: GC_LOCK, holder, ttlMs: staleMs });
    }, { env });
    if (r.ok) {
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        try { withSupervisor((m) => m.releaseHostLock({ name: GC_LOCK }), { env }); } catch { /* expires by its ttl */ }
      };
      return { ok: true, release };
    }
    if (Date.now() - started >= waitMs) return { ok: false, holder: { holder: r.holder?.holder ?? null, pid: r.holder?.holder_pid ?? null, at: r.holder?.started_at ? new Date(r.holder.started_at).toISOString() : null } };
    sleepSync(pollMs);
  }
}
