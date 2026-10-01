// pool-backoff.mjs — adaptive per-pool concurrency (AIMD) after provider rate limits (coordinator 2026-09-28: 14
// parallel Devin workers hit Devin's plan rate limit, "Reached free model rate limit", and 5 op workers stalled).
//
// The reconciler's Resource controller (scripts/reconciler/controllers/resource.mjs) is the only writer: on a
// provider-rate-limited signal it HALVES the pool's effective parallelism (floor `floor`, 2), at most once per
// decreaseCooldownMs so one burst of stalled workers counts once; after increaseAfterMs (15 min) with no rate-limit
// signal it raises the cap by +1 per increaseStepMs up to the pool's runtimes.yaml maxParallel, and the entry is
// dropped once back at max. It publishes one machine.sqlite pool_backoff row per backed-off pool (DBTREE.sql B4):
// until_at = the staleness horizon (written + staleMs), strikes = the halvings, reason = the AIMD entry as JSON
// ({cap, max, lastRateLimitAt, lastDecreaseAt, lastIncreaseAt, floorSince, provider, reason}); a pool back at max is
// deleted (poolRowOf / entryOfRow).
//
// Readers: route (scripts/agent/models.mjs selectPool, a live route with a capacity map) rejects a pool whose running
// count reached its backed-off cap, so the next eligible pool of the order takes the job (and a job with no other
// eligible pool stays queued); `api dispatch-ready` routes every job before dispatching, so dispatch respects it.
// A row past its until_at is ignored (a dead engine never pins a pool at its floor).
//
// Pure over its inputs except poolCapsNow (one machine.sqlite read, cached CACHE_MS).
import { readMachine } from '../../engine/db/machine.mjs';

export const DEFAULTS = Object.freeze({ floor: 2, decreaseCooldownMs: 120_000, increaseAfterMs: 900_000, increaseStepMs: 300_000, staleMs: 600_000 });
const CACHE_MS = 5000;

const int = (v, d) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? n : d; };

/**
 * One AIMD step for one pool. `prev`: the published entry or null (= at max). `rateLimitAt`: the newest rate-limit
 * signal's time for this pool or null. Returns the next entry, or null when the pool is (back) at its max with no
 * recent signal. {cap, max, lastRateLimitAt, lastDecreaseAt, lastIncreaseAt, halvings, reason}.
 */
export function aimdStep(prev, { max, rateLimitAt = null, now, floor = DEFAULTS.floor, decreaseCooldownMs = DEFAULTS.decreaseCooldownMs,
  increaseAfterMs = DEFAULTS.increaseAfterMs, increaseStepMs = DEFAULTS.increaseStepMs } = {}) {
  const top = int(max, 1);
  const lo = Math.min(top, int(floor, DEFAULTS.floor));
  const cur = prev ? Math.min(top, Math.max(lo, int(prev.cap, top))) : top;
  const lastRl = Math.max(Number(prev?.lastRateLimitAt) || 0, Number(rateLimitAt) || 0) || null;
  const fresh = rateLimitAt != null && Number(rateLimitAt) > (Number(prev?.lastRateLimitAt) || 0);
  const base = { max: top, lastRateLimitAt: lastRl, lastDecreaseAt: prev?.lastDecreaseAt ?? null, lastIncreaseAt: prev?.lastIncreaseAt ?? null, halvings: prev?.halvings ?? 0 };
  // Multiplicative decrease: a new signal, and the last decrease is older than the cooldown.
  if (fresh && (base.lastDecreaseAt == null || now - base.lastDecreaseAt >= decreaseCooldownMs)) {
    const cap = Math.max(lo, Math.floor(cur / 2));
    return { ...base, cap, floorSince: cap === lo ? (prev?.cap === lo && prev?.floorSince ? prev.floorSince : now) : null, lastDecreaseAt: now, halvings: base.halvings + 1, reason: `rate limited: ${cur} -> ${cap}${cap === lo ? ' (floor)' : ''}` };
  }
  if (!prev) return null;
  // Additive increase: quiet for increaseAfterMs since the last signal, one step per increaseStepMs.
  const quietSince = lastRl ?? base.lastDecreaseAt ?? now;
  const lastStep = Math.max(Number(base.lastIncreaseAt) || 0, Number(base.lastDecreaseAt) || 0);
  if (now - quietSince >= increaseAfterMs && now - lastStep >= Math.min(increaseStepMs, increaseAfterMs) && cur < top) {
    const cap = cur + 1;
    if (cap >= top) return null;
    return { ...base, cap, floorSince: null, lastIncreaseAt: now, reason: `quiet ${Math.round((now - quietSince) / 60000)} min: ${cur} -> ${cap}` };
  }
  return { ...base, cap: cur, floorSince: cur === lo ? (prev.floorSince ?? base.lastDecreaseAt ?? now) : null, reason: prev.reason ?? null };
}

/** Whether a pool stayed rate-limited at its floor for persistMs: {persists, since}. Pure. */
export function backoffPersists(entry, { now, persistMs, floor = DEFAULTS.floor }) {
  if (!entry || entry.cap > floor || entry.lastRateLimitAt == null || entry.lastDecreaseAt == null) return { persists: false, since: null };
  const since = entry.floorSince ?? entry.lastDecreaseAt;
  return { persists: now - entry.lastRateLimitAt < persistMs && now - since >= persistMs, since };
}

/* ------------------------------------------------------------ the store */

/** The pool_backoff row of one AIMD entry: {pool, untilAt, strikes, reason}. Pure. */
export const poolRowOf = (pool, entry, { now, staleMs = DEFAULTS.staleMs }) => ({ pool, untilAt: now + staleMs, strikes: Number(entry?.halvings) || 0,
  reason: JSON.stringify({ cap: entry.cap, max: entry.max, lastRateLimitAt: entry.lastRateLimitAt ?? null, lastDecreaseAt: entry.lastDecreaseAt ?? null,
    lastIncreaseAt: entry.lastIncreaseAt ?? null, floorSince: entry.floorSince ?? null, provider: entry.provider ?? null, reason: entry.reason ?? null }) });

/** The AIMD entry of one pool_backoff row (halvings from strikes, the rest from reason); null when unreadable. Pure. */
export function entryOfRow(row) {
  let e = null;
  try { e = JSON.parse(row?.reason ?? 'null'); } catch { e = null; }
  if (!e || typeof e !== 'object' || !Number.isFinite(Number(e.cap))) return null;
  return { ...e, halvings: Number(row.strikes) || 0 };
}

/** {<pool>: entry} of the pool_backoff rows. Pure. */
export const entriesOfRows = (rows) => Object.fromEntries((rows ?? []).map((r) => [r.pool, entryOfRow(r)]).filter(([, e]) => e));

/* ------------------------------------------------------------ the reader */

const cache = new Map();

/** The live backed-off caps of pool_backoff rows: {<pool target>: cap}, rows past until_at skipped. Pure. */
export function capsOf(rows, { now = Date.now() } = {}) {
  const out = {};
  for (const r of rows ?? []) {
    if (!(Number(r?.until_at) > now)) continue;
    const e = entryOfRow(r);
    const cap = Number(e?.cap), max = Number(e?.max);
    if (Number.isInteger(cap) && cap > 0 && (!Number.isFinite(max) || cap < max)) out[r.pool] = cap;
  }
  return out;
}

/** The backed-off caps published now ({} on any error, with no store, or when stale). */
export function poolCapsNow({ env = process.env, now = Date.now() } = {}) {
  try {
    const key = env?.STARCI_TEST_MACHINE_FILE ?? '';
    const hit = cache.get(key);
    if (hit && now - hit.at < CACHE_MS && now >= hit.at) return capsOf(hit.rows, { now });
    const rows = readMachine((m) => m.poolBackoff(), [], { env });
    cache.set(key, { at: now, rows });
    return capsOf(rows, { now });
  } catch { return {}; }
}

export const resetPoolCapsCache = () => cache.clear();
