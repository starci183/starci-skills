// pool-backoff.mjs — adaptive per-pool concurrency (AIMD) after provider rate limits (coordinator 2026-09-28: 14
// parallel Devin workers hit Devin's plan rate limit, "Reached free model rate limit", and 5 op workers stalled).
//
// The reconciler's Resource controller (scripts/reconciler/controllers/resource.mjs) is the only writer: on a
// provider-rate-limited signal it HALVES the pool's effective parallelism (floor `floor`, 2), at most once per
// decreaseCooldownMs so one burst of stalled workers counts once; after increaseAfterMs (15 min) with no rate-limit
// signal it raises the cap by +1 per increaseStepMs up to the pool's runtimes.yaml maxParallel, and the entry is
// dropped once back at max. It publishes {<pool target>: {cap, max, ...}} as `poolBackoff` in the throttle state
// (ram-throttle.json) with `poolBackoffAt`.
//
// Readers: route (scripts/agent/models.mjs selectPool, a live route with a capacity map) rejects a pool whose running
// count reached its backed-off cap, so the next eligible pool of the order takes the job (and a job with no other
// eligible pool stays queued); `api dispatch-ready` routes every job before dispatching, so dispatch respects it.
// A publication older than staleMs is ignored (a dead engine never pins a pool at its floor).
//
// Pure over its inputs except poolCapsNow (one file read, cached CACHE_MS). Under the test runner it reads nothing
// unless STARCI_RAM_THROTTLE_STATE names a state file.
import fs from 'node:fs';
import path from 'node:path';
import { machineFileFor } from '../../engine/ledger-db.mjs';

export const POOL_BACKOFF_KEY = 'poolBackoff';
export const DEFAULTS = Object.freeze({ floor: 2, decreaseCooldownMs: 120_000, increaseAfterMs: 900_000, increaseStepMs: 300_000, staleMs: 600_000 });
const STATE_ENV = 'STARCI_RAM_THROTTLE_STATE';
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

/* ------------------------------------------------------------ the reader */

const stateFileOf = (env) => (env?.[STATE_ENV] ? path.resolve(env[STATE_ENV]) : path.join(path.dirname(machineFileFor(env)), 'ram-throttle.json'));
const cache = new Map();

/** The live backed-off caps from a throttle state object: {<pool target>: cap}. Pure. */
export function capsOf(state, { now = Date.now(), staleMs = DEFAULTS.staleMs } = {}) {
  const at = Date.parse(state?.poolBackoffAt ?? '');
  const limit = Number(state?.poolBackoffStaleMs) > 0 ? Number(state.poolBackoffStaleMs) : staleMs;
  if (!Number.isFinite(at) || now - at >= limit) return {};
  const out = {};
  for (const [pool, e] of Object.entries(state?.[POOL_BACKOFF_KEY] ?? {})) {
    const cap = Number(e?.cap), max = Number(e?.max);
    if (Number.isInteger(cap) && cap > 0 && (!Number.isFinite(max) || cap < max)) out[pool] = cap;
  }
  return out;
}

/** The backed-off caps published now ({} on any error, when stale, or in a spec with no state file named). */
export function poolCapsNow({ env = process.env, now = Date.now(), staleMs = DEFAULTS.staleMs } = {}) {
  try {
    if (env.NODE_TEST_CONTEXT && !env[STATE_ENV]) return {};
    const file = stateFileOf(env);
    const hit = cache.get(file);
    if (hit && now - hit.at < CACHE_MS && now >= hit.at) return capsOf(hit.state, { now, staleMs });
    let state = {};
    try { state = JSON.parse(fs.readFileSync(file, 'utf8')) ?? {}; } catch { state = {}; }
    cache.set(file, { at: now, state });
    return capsOf(state, { now, staleMs });
  } catch { return {}; }
}

export const resetPoolCapsCache = () => cache.clear();
