// scripts/reconciler/workqueue.mjs — the Kubernetes-style workqueue of the engine (DESIGN §7.4).
//
//   - dedupe by (controller, key): one machine.sqlite `engine_queue` row per pair (or, for a --once pass, one row of
//     an in-memory table: memoryRows());
//   - one in-flight reconcile per key: a key being reconciled is not handed out again; an add while it runs marks
//     it dirty, so it runs once more right after;
//   - exponential backoff on failure: backoff.minMs * 2^(attempts-1), capped at backoff.maxMs;
//   - per-controller concurrency: take(controller, limit) hands out at most `limit` minus the in-flight count.
// The rows persist across a restart (a failing key keeps its backoff); the in-flight set is this process's only.

/** The engine_queue rows of a machine handle: {get, put, remove, due, all}. A row is {controller, key, due_at, reason, tries, last_error}. */
export function machineRows(m) {
  return {
    get: (controller, key) => m.db.prepare('SELECT * FROM engine_queue WHERE controller=? AND key=?').get(controller, key) ?? null,
    put: (row) => { m.upsert('engine_queue', row, ['controller', 'key']); },
    remove: (controller, key) => { m.db.prepare('DELETE FROM engine_queue WHERE controller=? AND key=?').run(controller, key); },
    due: (controller, now, limit) => m.db.prepare('SELECT * FROM engine_queue WHERE controller=? AND due_at<=? ORDER BY due_at, key LIMIT ?').all(controller, now, limit),
    all: () => m.db.prepare('SELECT * FROM engine_queue').all(),
  };
}

/** The same rows in process memory (engine.mjs --once: a debugging pass never takes a live engine's queued keys). */
export function memoryRows() {
  const rows = new Map();
  const id = (controller, key) => `${controller}\u0000${key}`;
  return {
    get: (controller, key) => (rows.has(id(controller, key)) ? { ...rows.get(id(controller, key)) } : null),
    put: (row) => { rows.set(id(row.controller, row.key), { ...(rows.get(id(row.controller, row.key)) ?? {}), ...row }); },
    remove: (controller, key) => { rows.delete(id(controller, key)); },
    due: (controller, now, limit) => [...rows.values()].filter((r) => r.controller === controller && r.due_at <= now)
      .sort((a, b) => a.due_at - b.due_at || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)).slice(0, limit).map((r) => ({ ...r })),
    all: () => [...rows.values()].map((r) => ({ ...r })),
  };
}

export class WorkQueue {
  /** @param {{rows, now?: () => number, backoff?: {minMs, maxMs}}} options  rows: machineRows(m) | memoryRows() */
  constructor({ rows, now = Date.now, backoff = { minMs: 1000, maxMs: 300000 } }) {
    this.rows = rows;
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
    const cur = this.rows.get(controller, key);
    if (!cur) this.rows.put({ controller, key, due_at: at, reason, tries: 0, last_error: null });
    else if (!(Number(cur.tries) > 0)) this.rows.put({ controller, key, due_at: Math.min(Number(cur.due_at ?? at), at), reason });
    return true;
  }

  /** Up to `limit` due keys of `controller` not in flight, marked in flight. [{controller, key, reason, attempts}] */
  take(controller, limit = 1) {
    const running = this.inflightCount(controller);
    const room = Math.max(0, limit - running);
    if (!room) return [];
    const rows = this.rows.due(controller, this.now(), room + this.inflight.size);
    const out = [];
    for (const row of rows) {
      if (out.length >= room) break;
      const id = WorkQueue.id(controller, row.key);
      if (this.inflight.has(id)) continue;
      this.inflight.set(id, { controller, key: row.key, dirty: false });
      out.push({ controller, key: row.key, reason: row.reason, attempts: Number(row.tries) || 0 });
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
    if (flight?.dirty) this.rows.put({ controller, key, due_at: this.now(), tries: 0, last_error: null, reason: flight.dirtyReason ?? 'requeued' });
    else this.rows.remove(controller, key);
  }

  /**
   * The reconcile failed: attempts + 1, due after the backoff, or after error.retryAfterMs when the controller named
   * one (a known wait: a busy lock, a grace period). Returns the delay.
   */
  failed(controller, key, error, { delayMs = null } = {}) {
    const id = WorkQueue.id(controller, key);
    this.inflight.delete(id);
    const row = this.rows.get(controller, key);
    const attempts = (Number(row?.tries) || 0) + 1;
    const asked = Number(delayMs ?? error?.retryAfterMs);
    const delay = Number.isFinite(asked) && asked >= 0 ? asked : WorkQueue.backoffMs(attempts, this.backoff);
    const message = String(error?.message ?? error ?? 'failed').slice(0, 500);
    this.rows.put({ controller, key, due_at: this.now() + delay, tries: attempts, last_error: message, ...(row ? {} : { reason: 'backoff' }) });
    return delay;
  }

  /** Queue depth per controller: {controller: {queued, due, failing}}. */
  depth() {
    const out = {};
    const now = this.now();
    for (const row of this.rows.all()) {
      const d = (out[row.controller] ??= { queued: 0, due: 0, failing: 0 });
      d.queued += 1;
      if (row.due_at != null && row.due_at <= now) d.due += 1;
      if (Number(row.tries) > 0) d.failing += 1;
    }
    return out;
  }
}
