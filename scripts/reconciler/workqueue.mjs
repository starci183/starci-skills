// scripts/reconciler/workqueue.mjs — the Kubernetes-style workqueue of the engine (DESIGN §7.4).
//
//   - dedupe by (controller, key): one `queue` row (reconciler.sqlite) per pair;
//   - one in-flight reconcile per key: a key being reconciled is not handed out again; an add while it runs marks
//     it dirty, so it runs once more right after;
//   - exponential backoff on failure: backoff.minMs * 2^(attempts-1), capped at backoff.maxMs;
//   - per-controller concurrency: take(controller, limit) hands out at most `limit` minus the in-flight count.
// The rows persist across a restart (a failing key keeps its backoff); the in-flight set is this process's only.
export class WorkQueue {
  /** @param {{db, now?: () => number, backoff?: {minMs, maxMs}}} options */
  constructor({ db, now = Date.now, backoff = { minMs: 1000, maxMs: 300000 } }) {
    this.db = db;
    this.now = now;
    this.backoff = backoff;
    this.inflight = new Map(); // `${controller}\u0000${key}` -> {controller, key, dirty}
  }

  static id(controller, key) { return `${controller}\u0000${key}`; }

  /** Delay after `attempts` failures. Pure. */
  static backoffMs(attempts, { minMs = 1000, maxMs = 300000 } = {}) {
    const n = Math.max(1, Number(attempts) || 1);
    return Math.min(maxMs, minMs * 2 ** Math.min(n - 1, 30));
  }

  /**
   * Queue (controller, key), due at `dueAt` (default now). An existing row keeps the earlier due time, except a row
   * in backoff (attempts > 0), which keeps its backoff. A key in flight is marked dirty instead.
   */
  add(controller, key, { reason = null, dueAt = null } = {}) {
    if (typeof key !== 'string' || !key) return false;
    const at = Number.isFinite(dueAt) ? dueAt : this.now();
    const flight = this.inflight.get(WorkQueue.id(controller, key));
    if (flight) { flight.dirty = true; flight.dirtyReason = reason; return true; }
    this.db.prepare(`INSERT INTO queue(controller,key,due_at,reason,attempts,last_error) VALUES(?,?,?,?,0,NULL)
      ON CONFLICT(controller,key) DO UPDATE SET
        due_at=CASE WHEN queue.attempts>0 THEN queue.due_at ELSE MIN(queue.due_at, excluded.due_at) END,
        reason=CASE WHEN queue.attempts>0 THEN queue.reason ELSE excluded.reason END`).run(controller, key, at, reason);
    return true;
  }

  /** Up to `limit` due keys of `controller` not in flight, marked in flight. [{controller, key, reason, attempts}] */
  take(controller, limit = 1) {
    const running = this.inflightCount(controller);
    const room = Math.max(0, limit - running);
    if (!room) return [];
    const rows = this.db.prepare('SELECT controller, key, reason, attempts FROM queue WHERE controller=? AND due_at<=? ORDER BY due_at, key LIMIT ?')
      .all(controller, this.now(), room + this.inflight.size);
    const out = [];
    for (const row of rows) {
      if (out.length >= room) break;
      const id = WorkQueue.id(controller, row.key);
      if (this.inflight.has(id)) continue;
      this.inflight.set(id, { controller, key: row.key, dirty: false });
      out.push({ controller, key: row.key, reason: row.reason, attempts: Number(row.attempts) || 0 });
    }
    return out;
  }

  inflightCount(controller) {
    let n = 0;
    for (const f of this.inflight.values()) if (f.controller === controller) n += 1;
    return n;
  }

  /** The reconcile of (controller, key) succeeded: forget the row, unless an add arrived meanwhile (run again now). */
  done(controller, key) {
    const id = WorkQueue.id(controller, key);
    const flight = this.inflight.get(id);
    this.inflight.delete(id);
    if (flight?.dirty) {
      this.db.prepare('UPDATE queue SET due_at=?, attempts=0, last_error=NULL, reason=? WHERE controller=? AND key=?').run(this.now(), flight.dirtyReason ?? 'requeued', controller, key);
    } else this.db.prepare('DELETE FROM queue WHERE controller=? AND key=?').run(controller, key);
  }

  /**
   * The reconcile failed: attempts + 1, due after the backoff, or after error.retryAfterMs when the controller named
   * one (a known wait: a busy lock, a grace period). Returns the delay.
   */
  failed(controller, key, error, { delayMs = null } = {}) {
    const id = WorkQueue.id(controller, key);
    this.inflight.delete(id);
    const row = this.db.prepare('SELECT attempts FROM queue WHERE controller=? AND key=?').get(controller, key);
    const attempts = (Number(row?.attempts) || 0) + 1;
    const asked = Number(delayMs ?? error?.retryAfterMs);
    const delay = Number.isFinite(asked) && asked >= 0 ? asked : WorkQueue.backoffMs(attempts, this.backoff);
    const message = String(error?.message ?? error ?? 'failed').slice(0, 500);
    this.db.prepare(`INSERT INTO queue(controller,key,due_at,reason,attempts,last_error) VALUES(?,?,?,?,?,?)
      ON CONFLICT(controller,key) DO UPDATE SET due_at=excluded.due_at, attempts=excluded.attempts, last_error=excluded.last_error`)
      .run(controller, key, this.now() + delay, 'backoff', attempts, message);
    return delay;
  }

  /** Queue depth per controller: {controller: {queued, due, failing}}. */
  depth() {
    const out = {};
    for (const row of this.db.prepare('SELECT controller, COUNT(*) AS n, SUM(CASE WHEN due_at<=? THEN 1 ELSE 0 END) AS due, SUM(CASE WHEN attempts>0 THEN 1 ELSE 0 END) AS failing FROM queue GROUP BY controller').all(this.now())) {
      out[row.controller] = { queued: Number(row.n), due: Number(row.due) || 0, failing: Number(row.failing) || 0 };
    }
    return out;
  }
}
