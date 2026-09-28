// scripts/reconciler/owns.mjs — reconcilerOwns(concern): may an old loop still do this duty? (DESIGN §7.9)
//
// Every old loop (scripts/kernel/watchdog.mjs, resume-all.mjs, scripts/supervisor/{tick,watchdog,stall-alert}.mjs)
// asks before each duty. The answer is true only when BOTH hold:
//   - the reconciler leader's heartbeat (reconciler.sqlite leader.heartbeat_at) is younger than
//     runtimes.yaml allocation.reconciler.heartbeatStaleMs, and
//   - the controller that owns the concern (CONCERN_OWNER, the same map as modules/reconciler/reconciler.yaml
//     concerns) runs `active` (the modes table the leader writes: the EFFECTIVE mode, so safe mode is never active).
// Then the old loop skips the duty and records action 'reconciler-owned'. A dead engine goes stale after
// heartbeatStaleMs and every old loop takes the duty back by itself: rollback is config.yaml
// reconciler.controllers.<name>.mode: off.
//
// Cheap and safe: one SQLite read per (state file) cached CACHE_MS; ANY error answers false; it never throws.
// Under the test runner (NODE_TEST_CONTEXT) it answers false unless STARCI_RECONCILER_STATE names a state file, so a
// spec of an old loop never reads the live host's engine.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { reconcilerStateFile, reconcilerNumbers, LEADER_NAME } from './state.mjs';

// node:sqlite is loaded on first use (like engine/ledger-db.mjs), so importing this module prints no ExperimentalWarning.
const sqlite = () => createRequire(import.meta.url)('node:sqlite');
/** concern -> owning controller. The CONCERNS of the reconciler contract (LANES shared contract). */
export const CONCERN_OWNER = Object.freeze({
  'job.settle': 'job', 'job.worker': 'job', 'job.dispatch': 'job', 'job.consume-check': 'job', 'job.close-verify': 'job',
  'host.kernel-seat': 'host', 'host.supervisor-seat': 'host', 'host.services': 'host', 'host.orca': 'host', 'host.processes': 'host', 'host.ledger-health': 'host',
  'resource.throttle': 'resource', 'resource.quota': 'resource',
  'gc.sweep': 'gc', 'gc.housekeeping': 'gc',
  'workflow.stall-wake': 'workflow', 'workflow.progress': 'workflow', 'workflow.ask-repark': 'workflow',
  'fleet.owed': 'fleet', 'fleet.push': 'fleet', 'fleet.deps': 'fleet', 'notify.owner': 'fleet',
  'learning.tick': 'learning',
  'sla.report': 'workflow',
});
export const CONCERNS = Object.freeze(Object.keys(CONCERN_OWNER));
export const CACHE_MS = 5000;

const cache = new Map(); // state file -> {at, snapshot}

/** One read of the state: {heartbeatAt, modes: {controller: mode}}; null when there is no state file. */
export function readOwnership(file) {
  if (!fs.existsSync(file)) return null;
  const db = new (sqlite().DatabaseSync)(file, { readOnly: true, timeout: 1000 });
  try {
    const leader = db.prepare('SELECT heartbeat_at FROM leader WHERE name=?').get(LEADER_NAME);
    const modes = {};
    for (const row of db.prepare('SELECT controller, mode FROM modes').all()) modes[row.controller] = row.mode;
    return { heartbeatAt: Number(leader?.heartbeat_at) || null, modes };
  } finally { try { db.close(); } catch { /* closed */ } }
}

/** Forget the cached snapshots (specs). */
export const resetOwnsCache = () => cache.clear();

/**
 * True only when the leader heartbeat is fresh AND the owning controller's effective mode is active.
 * Options: env (state file, test guard), now, staleMs (default allocation.reconciler.heartbeatStaleMs), read (seam).
 * Never throws: any error is false.
 */
export function reconcilerOwns(concern, { env = process.env, now = Date.now(), staleMs = null, read = readOwnership } = {}) {
  try {
    const owner = CONCERN_OWNER[concern];
    if (!owner) return false;
    // The test guard reads the PROCESS env too: a spec that passes its own env object (no NODE_TEST_CONTEXT in it) must
    // still never see the live host's engine.
    if ((env.NODE_TEST_CONTEXT || process.env.NODE_TEST_CONTEXT) && !env.STARCI_RECONCILER_STATE) return false;
    const file = reconcilerStateFile(env);
    let entry = cache.get(file);
    if (!entry || now - entry.at >= CACHE_MS || now < entry.at) {
      let snapshot = null;
      try { snapshot = read(file); } catch { snapshot = null; }
      let limit = null;
      try { limit = reconcilerNumbers().heartbeatStaleMs; } catch { limit = null; }
      entry = { at: now, snapshot, limit };
      cache.set(file, entry);
    }
    const snap = entry.snapshot;
    if (!snap || !Number.isFinite(snap.heartbeatAt)) return false;
    const limit = Number.isFinite(staleMs) && staleMs > 0 ? staleMs : entry.limit;
    if (!Number.isFinite(limit) || now - snap.heartbeatAt >= limit) return false;
    return snap.modes?.[owner] === 'active';
  } catch { return false; }
}

/**
 * The yield helper of an old loop: when `concern` is owned, push {concern, action:'reconciler-owned'} onto `record`
 * (an array the loop returns) and answer true (skip the duty). Never throws.
 */
export function yieldTo(concern, record = null, { owns = reconcilerOwns, env = process.env } = {}) {
  let owned = false;
  try { owned = owns(concern, { env }) === true; } catch { owned = false; }
  if (owned && Array.isArray(record)) record.push({ concern, action: 'reconciler-owned' });
  return owned;
}
