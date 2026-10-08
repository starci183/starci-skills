// scripts/reconciler/workqueue.mjs — the Kubernetes-style workqueue of the engine (DESIGN §7.4).
//
//   - dedupe by (controller, key): one machine.sqlite `engine_queue` row per pair (or, for a --once pass, one row of
//     an in-memory table: memoryRows());
//   - one in-flight reconcile per key: a key being reconciled is not handed out again; an add while it runs marks
//     it dirty, so it runs once more right after;
//   - exponential backoff on failure: backoff.minMs * 2^(attempts-1), capped at backoff.maxMs;
//   - per-controller concurrency: take(controller, limit) hands out at most `limit` minus the in-flight count.
//   - the backoff is the one retry budget (scripts/lib/retry-budget.mjs): each failure records its named reason on the row; a key that
//     spent backoff.maxAttempts parks (due_at NULL) and runs again only when a new event adds it.
// The rows persist across a restart (a failing key keeps its backoff); the in-flight set is this process's only.

import { nextRetry, retryAfterFailure } from '../lib/retry-budget.mjs';

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
    put: (row) => { rows.set(id(row.controller, row.key), { ...rows.get(id(row.controller, row.key)), ...row }); },
    remove: (controller, key) => { rows.delete(id(controller, key)); },
    due: (controller, now, limit) => [...rows.values()].filter((r) => r.controller === controller && r.due_at != null && r.due_at <= now)
      .sort((a, b) => {
        const dueOrder = a.due_at - b.due_at;
        if (dueOrder) return dueOrder;
        if (a.key < b.key) return -1;
        if (a.key > b.key) return 1;
        return 0;
      }).slice(0, limit).map((r) => ({ ...r })),
    all: () => [...rows.values()].map((r) => ({ ...r })),
  };
}

/** The engine log row of failed attempt `attempts`, or null when it is not logged (attempts at powers of two and the attempt that spent the budget are). */
export function failureLog({ controller, key, attempts, delayMs, error }) {
  const spent = delayMs === null;
  if (!spent && !Number.isInteger(Math.log2(attempts))) return null;
  const head = spent ? `${controller} ${key} spent its retry budget after ${attempts} attempts and is parked until a new event names it`
    : `${controller} ${key} failed (attempt ${attempts}, retry in ${delayMs}ms)`;
  return { line: `${head}: ${String(error?.message ?? error).slice(0, 300)}`,
    data: { kind: spent ? 'reconciler.retry-exhausted' : 'reconciler.reconcile-failed', name: controller, key, attempts, detail: String(error?.stack ?? error).slice(0, 800) } };
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
    return nextRetry({ intervalMs: minMs, maxIntervalMs: maxMs }, { attempts: Number(attempts) || 1, now: 0, reason: 'backoff' }).delayMs;
  }

  /**
   * Queue (controller, key), due at `dueAt` (default now). An existing row keeps the earlier due time, except a row
   * in backoff (attempts > 0), which keeps its backoff, and a parked row (its budget spent), which a new event re-arms with a fresh budget
   * (a resync does not: nothing changed). A key in flight is marked dirty instead.
   */
  add(controller, key, { reason = null, dueAt = null } = {}) {
    if (typeof key !== 'string' || !key) return false;
    const at = Number.isFinite(dueAt) ? dueAt : this.now();
    const flight = this.inflight.get(WorkQueue.id(controller, key));
    if (flight) { flight.dirty = true; flight.dirtyReason = reason; return true; }
    const cur = this.rows.get(controller, key);
    const backingOff = Number(cur?.tries) > 0;
    if (cur?.due_at == null && backingOff && reason !== 'resync') this.rows.put({ controller, key, due_at: at, reason, tries: 0, last_error: null });
    else if (!cur) this.rows.put({ controller, key, due_at: at, reason, tries: 0, last_error: null });
    else if (!backingOff) this.rows.put({ controller, key, due_at: Math.min(Number(cur.due_at ?? at), at), reason });
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
   * The reconcile failed: attempts + 1 under the retry budget. The key is due after the backoff, or after error.retryAfterMs when the controller
   * named one (a known wait: a busy lock, a grace period); the row records the reason the attempt failed for (error.reason, default 'backoff').
   * A key past backoff.maxAttempts parks (due_at NULL, reason retry-exhausted:<reason>). Returns the delay, or null once parked.
   */
  failed(controller, key, error, { delayMs = null, reason = null } = {}) {
    const id = WorkQueue.id(controller, key);
    this.inflight.delete(id);
    const row = this.rows.get(controller, key);
    const named = reason ?? error?.reason ?? 'backoff';
    const step = retryAfterFailure({ intervalMs: this.backoff.minMs, maxIntervalMs: this.backoff.maxMs, maxAttempts: this.backoff.maxAttempts },
      { attempts: row?.tries }, { now: this.now(), reason: named, retryAfterMs: delayMs ?? error?.retryAfterMs ?? null });
    const message = String(error?.message ?? error ?? 'failed').slice(0, 500);
    if (!step.retry) {
      this.rows.put({ controller, key, due_at: null, tries: step.attempts, last_error: message, reason: `retry-exhausted:${named}` });
      return null;
    }
    this.rows.put({ controller, key, due_at: step.dueAt, tries: step.attempts, last_error: message, reason: named });
    return step.delayMs;
  }

  /** A new engine process is a new event for every parked key: its budget was spent against code and conditions that may have changed. Returns the keys re-armed. */
  rearmParked(reason = 'engine-start') {
    const parked = this.rows.all().filter((row) => row.due_at == null && Number(row.tries) > 0);
    for (const { controller, key } of parked) this.rows.put({ controller, key, due_at: this.now(), tries: 0, last_error: null, reason });
    return parked.map((row) => `${row.controller} ${row.key}`);
  }

  /** Queue depth per controller: {controller: {queued, due, failing}}. */
  depth() {
    const out = {};
    const now = this.now();
    for (const row of this.rows.all()) {
      const d = (out[row.controller] ??= { queued: 0, due: 0, failing: 0, parked: 0 });
      d.queued += 1;
      if (row.due_at != null && row.due_at <= now) d.due += 1;
      if (row.due_at == null && Number(row.tries) > 0) d.parked += 1;
      if (Number(row.tries) > 0) d.failing += 1;
    }
    return out;
  }
}
