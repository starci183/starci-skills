// scripts/reconciler/schedules.mjs — the durable cadence of every periodic duty of the engine (MB-01).
//
// A controller's "last run / next due" lived in process memory (gc.mjs `memory`, fleet.mjs a WeakMap per ctx), so
// every engine restart or self-reload ran every duty again as a "first run": on 2026-09-28 the daily housekeeping ran
// 32 times in 3.5 h and the 30-min push 28 times in 3 h. The cadence now lives in the `schedules` table of the
// engine's state DB (DBTREE.sql B2, the same DDL), one row per (controller, duty):
//
//   claimDue(db, {controller, duty, intervalMs, now, earlyAfterMs?, force?})
//        -> {due: true, reason: 'first-run'|'due'|'early'|'forced', prev} after it wrote last_started_at=now and
//           next_due_at=now+intervalMs in one transaction (so two passes never both run it), or
//           {due: false, nextAt, lastStartedAt}. earlyAfterMs: due already when that long has passed since the last
//           start (housekeeping on a low-resource host).
//   finishDuty(db, {controller, duty, result: 'done'|'failed'|'skipped'|'unknown', actionId?, digest?, now})
//
// `db` is the state DB handle; any other owner (a spec's fake ctx; null) keeps the same rules in memory, per object.

export const SCHEDULE_CONTROLLERS = Object.freeze(['job', 'workflow', 'resource', 'host', 'gc', 'fleet', 'learning', 'sla']);
export const SCHEDULE_RESULTS = Object.freeze(['done', 'failed', 'unknown', 'skipped']);

/** DBTREE.sql B2 `schedules`, verbatim (machine.sqlite carries the same table). */
export const SCHEDULES_SQL = `
CREATE TABLE IF NOT EXISTS schedules(
  controller       TEXT NOT NULL CHECK(controller IN ('job','workflow','resource','host','gc','fleet','learning','sla')),
  duty             TEXT NOT NULL,
  interval_ms      INTEGER NOT NULL CHECK(interval_ms>0),
  last_started_at  INTEGER, last_finished_at INTEGER,
  last_result      TEXT CHECK(last_result IS NULL OR last_result IN ('done','failed','unknown','skipped')),
  last_action_id   TEXT,
  last_result_digest TEXT,
  next_due_at      INTEGER NOT NULL,
  running_pid      INTEGER,
  PRIMARY KEY(controller,duty)) STRICT;`;

const globalMemory = new Map();
const memories = new WeakMap();
const ready = new WeakSet();
const isDb = (db) => typeof db?.prepare === 'function' && typeof db?.exec === 'function';
/** The in-memory rows of a non-DB owner (a spec's fake ctx: per object; null: per process). */
const memoryOf = (owner) => {
  if (!owner || typeof owner !== 'object') return globalMemory;
  if (!memories.has(owner)) memories.set(owner, new Map());
  return memories.get(owner);
};
const idOf = (controller, duty) => `${controller}/${duty}`;

function ensure(db) {
  if (!ready.has(db)) { db.exec(SCHEDULES_SQL); ready.add(db); }
  return db;
}

function check(controller, duty, intervalMs) {
  if (!SCHEDULE_CONTROLLERS.includes(controller)) throw new Error(`schedules: unknown controller '${controller}'`);
  if (!String(duty ?? '').trim()) throw new Error('schedules: a duty needs a name');
  if (!(Number(intervalMs) > 0)) throw new Error(`schedules: ${controller}/${duty} needs intervalMs > 0`);
}

/** The pure due rule over the stored row (or null). */
export function dueOf(row, { intervalMs, now, earlyAfterMs = null, force = false }) {
  if (force) return { due: true, reason: 'forced' };
  if (!row) return { due: true, reason: 'first-run' };
  const last = Number(row.last_started_at) || null;
  // A shorter configured interval takes effect at once; a longer one from the next start.
  const next = Math.min(Number(row.next_due_at), last != null ? last + intervalMs : Number(row.next_due_at));
  if (now >= next) return { due: true, reason: 'due' };
  if (earlyAfterMs != null && last != null && now - last >= earlyAfterMs) return { due: true, reason: 'early' };
  return { due: false, nextAt: next, lastStartedAt: last };
}

const rowOf = (db, controller, duty) => db.prepare('SELECT * FROM schedules WHERE controller=? AND duty=?').get(controller, duty) ?? null;

/** Claim one run of (controller, duty) when it is due; see the header. */
export function claimDue(db, { controller, duty, intervalMs, now = Date.now(), earlyAfterMs = null, force = false, pid = process.pid } = {}) {
  check(controller, duty, intervalMs);
  if (!isDb(db)) {
    const memory = memoryOf(db), id = idOf(controller, duty);
    const row = memory.get(id) ?? null;
    const d = dueOf(row, { intervalMs, now, earlyAfterMs, force });
    if (d.due) memory.set(id, { ...(row ?? {}), last_started_at: now, next_due_at: now + intervalMs, interval_ms: intervalMs });
    return { ...d, prev: row };
  }
  ensure(db);
  db.exec('BEGIN IMMEDIATE');
  try {
    const row = rowOf(db, controller, duty);
    const d = dueOf(row, { intervalMs, now, earlyAfterMs, force });
    if (d.due) {
      db.prepare(`INSERT INTO schedules(controller,duty,interval_ms,last_started_at,next_due_at,running_pid) VALUES(?,?,?,?,?,?)
        ON CONFLICT(controller,duty) DO UPDATE SET interval_ms=excluded.interval_ms, last_started_at=excluded.last_started_at,
          next_due_at=excluded.next_due_at, running_pid=excluded.running_pid`).run(controller, duty, intervalMs, now, now + intervalMs, pid);
    } else if (row && Number(row.interval_ms) !== intervalMs) {
      db.prepare('UPDATE schedules SET interval_ms=?, next_due_at=? WHERE controller=? AND duty=?').run(intervalMs, d.nextAt, controller, duty);
    }
    db.exec('COMMIT');
    return { ...d, prev: row };
  } catch (error) { try { db.exec('ROLLBACK'); } catch { /* none */ } throw error; }
}

/** Record how the claimed run ended. `result` done | failed | skipped | unknown. Never throws. */
export function finishDuty(db, { controller, duty, result = 'done', actionId = null, digest = null, now = Date.now() } = {}) {
  const r = SCHEDULE_RESULTS.includes(result) ? result : 'unknown';
  if (!isDb(db)) {
    const memory = memoryOf(db), id = idOf(controller, duty);
    memory.set(id, { ...(memory.get(id) ?? {}), last_finished_at: now, last_result: r });
    return true;
  }
  try {
    ensure(db);
    return db.prepare('UPDATE schedules SET last_finished_at=?, last_result=?, last_action_id=COALESCE(?, last_action_id), last_result_digest=COALESCE(?, last_result_digest), running_pid=NULL WHERE controller=? AND duty=?')
      .run(now, r, actionId, digest, controller, duty).changes > 0;
  } catch { return false; }
}

/** Every schedule row (the status surface), or []. */
export function listSchedules(db) {
  if (!isDb(db)) return [...memoryOf(db).entries()].map(([id, v]) => { const cut = id.indexOf('/'); return { controller: id.slice(0, cut), duty: id.slice(cut + 1), ...v }; });
  try { ensure(db); return db.prepare('SELECT * FROM schedules ORDER BY controller, duty').all(); } catch { return []; }
}


