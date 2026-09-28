// scripts/reconciler/schedules.mjs — the durable cadence of every periodic duty of the engine (MB-01).
//
// A controller's "last run / next due" lived in process memory (gc.mjs `memory`, fleet.mjs a WeakMap per ctx), so
// every engine restart or self-reload ran every duty again as a "first run": on 2026-09-28 the daily housekeeping ran
// 32 times in 3.5 h and the 30-min push 28 times in 3 h. The cadence now lives in machine.sqlite `schedules`
// (DBTREE.sql B2), one row per (controller, duty), written only through engine/machine-db.mjs
// (ensureSchedule / claimSchedule / finishSchedule):
//
//   claimDue(ctx, {controller, duty, intervalMs, now, earlyAfterMs?, force?})
//        -> {due: true, reason: 'first-run'|'due'|'early'|'forced'|'reclaimed'} once this caller holds the run
//           (running_pid), or {due: false, nextAt, reason?}. A row whose running_pid is dead, or is this process and
//           older than one interval (a pass that threw), is reclaimed. earlyAfterMs: due already when that long has
//           passed since the last start (housekeeping on a low-resource host). A fresh store runs each duty once.
//   finishDuty(ctx, {controller, duty, result: 'done'|'failed'|'skipped'|'unknown', actionId?, digest?})
//        -> next_due_at = now + interval, running_pid cleared.
//   listSchedules(ctx) -> the rows.
//
// `ctx` is the controller's ctx: an engine ctx (it has stateDb) uses machine.sqlite (ctx.env picks the file); a spec's
// fake ctx (no stateDb) keeps the same rules in memory, per ctx object. A store that cannot be opened (the old-schema
// file before the comeback) makes nothing due: a duty never runs on a guess.
import { withMachine, readMachine, pidAlive } from '../../engine/machine-db.mjs';

export const SCHEDULE_CONTROLLERS = Object.freeze(['job', 'workflow', 'resource', 'host', 'gc', 'fleet', 'learning', 'sla']);
export const SCHEDULE_RESULTS = Object.freeze(['done', 'failed', 'unknown', 'skipped']);

const memories = new WeakMap();
const globalMemory = new Map();
const usesMachine = (ctx) => Boolean(ctx?.stateDb) || ctx?.machineSchedules === true;
const memoryOf = (owner) => {
  if (!owner || typeof owner !== 'object') return globalMemory;
  if (!memories.has(owner)) memories.set(owner, new Map());
  return memories.get(owner);
};
const idOf = (controller, duty) => `${controller}/${duty}`;

function check(controller, duty, intervalMs) {
  if (!SCHEDULE_CONTROLLERS.includes(controller)) throw new Error(`schedules: unknown controller '${controller}'`);
  if (!String(duty ?? '').trim()) throw new Error('schedules: a duty needs a name');
  if (!(Number(intervalMs) > 0)) throw new Error(`schedules: ${controller}/${duty} needs intervalMs > 0`);
}

/** The pure due rule over a stored row (or null): {due, reason} or {due: false, nextAt}. */
export function dueOf(row, { intervalMs, now, earlyAfterMs = null, force = false, pid = process.pid, alive = pidAlive }) {
  if (force) return { due: true, reason: 'forced' };
  if (!row || row.last_started_at == null) return { due: true, reason: 'first-run' };
  const last = Number(row.last_started_at);
  if (row.running_pid != null) {
    const stale = Number(row.running_pid) === pid ? now - last > intervalMs : !alive(Number(row.running_pid));
    if (!stale) return { due: false, nextAt: null, reason: 'running' };
    return { due: true, reason: 'reclaimed' };
  }
  const next = Math.min(Number(row.next_due_at), last + intervalMs); // a shorter interval takes effect at once
  if (now >= next) return { due: true, reason: 'due' };
  if (earlyAfterMs != null && now - last >= earlyAfterMs) return { due: true, reason: 'early' };
  return { due: false, nextAt: next };
}

/** Claim one run of (controller, duty) when it is due; see the header. Never throws for a store problem. */
export function claimDue(ctx, { controller, duty, intervalMs, now = Date.now(), earlyAfterMs = null, force = false, pid = process.pid } = {}) {
  check(controller, duty, intervalMs);
  if (!usesMachine(ctx)) {
    const memory = memoryOf(ctx), id = idOf(controller, duty);
    const row = memory.get(id) ?? null;
    const d = dueOf(row, { intervalMs, now, earlyAfterMs, force, pid });
    if (d.due) memory.set(id, { ...(row ?? {}), interval_ms: intervalMs, last_started_at: now, next_due_at: now + intervalMs, running_pid: pid });
    return d;
  }
  try {
    return withMachine((m) => m.transaction(() => {
      const row = m.ensureSchedule({ controller, duty, intervalMs, firstDueAt: now });
      const d = dueOf(row, { intervalMs, now, earlyAfterMs, force, pid });
      if (!d.due) return d;
      // Make the row claimable now (a reclaimed, early or forced run), then take it; the claim is the no-overlap guard.
      if (row.running_pid != null || Number(row.next_due_at) > now) {
        m.finishSchedule({ controller, duty, result: row.running_pid != null ? 'unknown' : row.last_result ?? 'skipped', digest: row.last_result_digest ?? null, nextDueAt: now });
      }
      return m.claimSchedule({ controller, duty, pid }) ? d : { due: false, nextAt: null, reason: 'claimed-elsewhere' };
    }), { env: ctx?.env ?? process.env, now: () => now });
  } catch (error) { return { due: false, nextAt: null, reason: 'store-unavailable', error: String(error?.message ?? error).slice(0, 200) }; }
}

/** Record how the claimed run ended; the next run is due one interval from now. Never throws. */
export function finishDuty(ctx, { controller, duty, result = 'done', actionId = null, digest = null, now = Date.now() } = {}) {
  const r = SCHEDULE_RESULTS.includes(result) ? result : 'unknown';
  if (!usesMachine(ctx)) {
    const memory = memoryOf(ctx), id = idOf(controller, duty);
    const row = memory.get(id) ?? {};
    memory.set(id, { ...row, last_finished_at: now, last_result: r, running_pid: null, ...(digest != null ? { last_result_digest: digest } : {}), ...(actionId ? { last_action_id: actionId } : {}),
      next_due_at: now + (Number(row.interval_ms) || 0) });
    return true;
  }
  try {
    return withMachine((m) => m.transaction(() => {
      const row = m.schedules().find((s) => s.controller === controller && s.duty === duty);
      return m.finishSchedule({ controller, duty, result: r, digest: digest ?? row?.last_result_digest ?? null });
    }), { env: ctx?.env ?? process.env, now: () => now });
  } catch { return false; }
}

/** Every schedule row (the status surface), or []. */
export function listSchedules(ctx) {
  if (!usesMachine(ctx)) return [...memoryOf(ctx).entries()].map(([id, v]) => { const cut = id.indexOf('/'); return { controller: id.slice(0, cut), duty: id.slice(cut + 1), ...v }; });
  return readMachine((m) => m.schedules(), [], { env: ctx?.env ?? process.env });
}
