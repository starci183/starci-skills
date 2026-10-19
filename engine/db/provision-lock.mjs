// The machine writer owns compare-and-release of an observed dead provisioning executor.
import { pidAlive } from '../../scripts/lib/pid-alive.mjs';

/**
 * Release only the exact observed provisioning lock after its PID is absent. A live reused PID
 * conservatively holds the target. The caller may resume only the same persisted operation's
 * read-only reconciliation; absence proves neither remote rollback nor absence of provider effects.
 */
export function releaseObservedProvisionLock(m, { observed, holder }) {
  if (!observed?.name?.startsWith('provision:') || observed.holder !== holder || observed.state === 'released'
    || pidAlive(observed.holder_pid)) return false;
  return m.transaction(db => db.prepare("UPDATE host_locks SET state='released',heartbeat_at=? WHERE name=? AND holder_pid=? AND holder=? AND started_at=? AND heartbeat_at=? AND expires_at=? AND state=?")
    .run(m.now(), observed.name, observed.holder_pid, observed.holder, observed.started_at, observed.heartbeat_at, observed.expires_at, observed.state).changes === 1);
}

/** Renew only this provisioning operation's exact holder, including inside one shared process. */
export function renewProvisionLock(m, { name, holder, ttlMs, pid = process.pid }) {
  if (!name?.startsWith('provision:') || typeof holder !== 'string' || !Number.isSafeInteger(ttlMs) || ttlMs < 1) return false;
  const at = m.now();
  return m.db.prepare("UPDATE host_locks SET heartbeat_at=?,expires_at=? WHERE name=? AND holder_pid=? AND holder=? AND state<>'released'")
    .run(at, at + ttlMs, name, pid, holder).changes === 1;
}

/** Release only the exact provisioning holder; unrelated native host locks keep their own policy. */
export function releaseProvisionLock(m, { name, holder, pid = process.pid }) {
  if (!name?.startsWith('provision:') || typeof holder !== 'string') return false;
  return m.db.prepare("UPDATE host_locks SET state='released',heartbeat_at=? WHERE name=? AND holder_pid=? AND holder=? AND state<>'released'")
    .run(m.now(), name, pid, holder).changes === 1;
}
