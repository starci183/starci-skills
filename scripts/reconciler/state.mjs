// scripts/reconciler/state.mjs — the reconciler's own state DB, reconciler.sqlite (DESIGN §7.3).
//
// One file beside the Supervisor ledger (<supervisor home>/reconciler.sqlite, scripts/supervisor/home.mjs
// supervisorHome), outside every repository. STARCI_RECONCILER_STATE names another file (specs). The tables are the
// seven of DESIGN §7.3, verbatim:
//   cursors     per-ledger events cursor (sources.mjs); a hint only, a restart resyncs everything
//   leader      the one leader row (engine.mjs): holder, pid, epoch, heartbeat_at, expires_at, rev
//   queue       the persisted workqueue (workqueue.mjs), one row per (controller, key)
//   actions     the mutation journal (ctx.mjs): intent -> running -> done|failed; stale -> unknown, never replayed
//   sla_clocks  SLA clocks (ctx.clock / ctx.clear); the SLA layer (scripts/reconciler/sla.mjs) reads them
//   services    the Host controller's service registry state
//   modes       the EFFECTIVE mode of each controller, written by the leader every poll (safe mode: active -> shadow);
//               owns.mjs reads it, so a mode the engine does not run is never reported as owned.
// The heartbeat file reconciler.heartbeat sits beside it (engine.mjs, every heartbeatMs).
//
// Settings: config.yaml `reconciler` ({enabled, controllers.<name>.mode}) and runtimes.yaml allocation.reconciler
// (the numbers). Per-controller overrides: modules/reconciler/<name>.yaml (resyncMs, concurrency, timeoutMs).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { supervisorHome } from '../supervisor/home.mjs';
import { allocationSettings, loadConfig } from '../../engine/config.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { runtimeRootFor } from '../../engine/ledger-db.mjs';

// node:sqlite is loaded on first use (like engine/ledger-db.mjs), so importing this module prints no ExperimentalWarning.
const sqlite = () => createRequire(import.meta.url)('node:sqlite');
export const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const LEADER_NAME = 'reconciler';
export const MODES = Object.freeze(['off', 'shadow', 'active']);
export const CONTROLLER_NAMES = Object.freeze(['job', 'host', 'gc', 'resource', 'workflow', 'fleet', 'learning']);

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS cursors(ledger_id TEXT PRIMARY KEY, file TEXT NOT NULL, last_seq INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS leader(name TEXT PRIMARY KEY, holder TEXT NOT NULL, pid INTEGER NOT NULL, epoch INTEGER NOT NULL,
                    heartbeat_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, rev TEXT);
CREATE TABLE IF NOT EXISTS queue(controller TEXT, key TEXT, due_at INTEGER, reason TEXT, attempts INTEGER DEFAULT 0,
                   last_error TEXT, PRIMARY KEY(controller,key));
CREATE TABLE IF NOT EXISTS actions(id TEXT PRIMARY KEY, controller TEXT, key TEXT, verb TEXT, argv_digest TEXT, epoch INTEGER,
                     state TEXT CHECK(state IN ('intent','running','done','failed','unknown')),
                     started_at INTEGER, finished_at INTEGER, result_json TEXT);
CREATE TABLE IF NOT EXISTS sla_clocks(entity TEXT, state TEXT, ledger_id TEXT, entered_at INTEGER, sla_ms INTEGER,
                        violated_at INTEGER, reported_at INTEGER, cleared_at INTEGER, PRIMARY KEY(entity,state));
CREATE TABLE IF NOT EXISTS services(name TEXT PRIMARY KEY, state TEXT, since INTEGER, restarts_json TEXT, last_probe_json TEXT);
CREATE TABLE IF NOT EXISTS modes(controller TEXT PRIMARY KEY, mode TEXT CHECK(mode IN ('off','shadow','active')), set_at INTEGER);
`;

/** The state file: STARCI_RECONCILER_STATE, else <supervisor home>/reconciler.sqlite. */
export const reconcilerStateFile = (env = process.env) =>
  (env.STARCI_RECONCILER_STATE ? path.resolve(env.STARCI_RECONCILER_STATE) : path.join(supervisorHome(env), 'reconciler.sqlite'));
/** The heartbeat file beside it. */
export const heartbeatFile = (env = process.env) => path.join(path.dirname(reconcilerStateFile(env)), 'reconciler.heartbeat');
/** Crash-loop record of boot.mjs starts beside it. */
export const startsFile = (env = process.env) => path.join(path.dirname(reconcilerStateFile(env)), 'reconciler-starts.json');
/** The engine's log: %LOCALAPPDATA%/StarCi/runtime/reconciler.log (DESIGN §7.7). */
export const reconcilerLogFile = (env = process.env) => path.join(runtimeRootFor(env), 'reconciler.log');

/** Open (creating) the state DB read-write with the schema. */
export function openState({ env = process.env, file = reconcilerStateFile(env), busyTimeoutMs = 5000 } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new (sqlite().DatabaseSync)(file, { timeout: busyTimeoutMs });
  try {
    db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;');
    db.exec(SCHEMA_SQL);
  } catch (error) { try { db.close(); } catch { /* closed */ } throw error; }
  return db;
}

/** A read-only handle, or null when the file does not exist. Throws on a corrupt file (callers decide). */
export function openStateReader({ env = process.env, file = reconcilerStateFile(env), busyTimeoutMs = 2000 } = {}) {
  if (!fs.existsSync(file)) return null;
  return new (sqlite().DatabaseSync)(file, { readOnly: true, timeout: busyTimeoutMs });
}

/** Run fn(db) with a writer; closed afterwards. */
export function withState(fn, options = {}) {
  const db = openState(options);
  try { return fn(db); } finally { try { db.close(); } catch { /* closed */ } }
}

/** BEGIN IMMEDIATE .. COMMIT around fn(db). */
export function tx(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const out = fn(db); db.exec('COMMIT'); return out; } catch (error) { try { db.exec('ROLLBACK'); } catch { /* none */ } throw error; }
}

const DEFAULT_NUMBERS = Object.freeze({
  pollMs: 2000, leaseMs: 30000, renewMs: 10000, heartbeatStaleMs: 60000, statusCacheMs: 20000,
  backoff: Object.freeze({ minMs: 1000, maxMs: 300000 }), crashLoop: Object.freeze({ max: 3, windowMs: 1800000 }),
});

/** runtimes.yaml allocation.reconciler with the brief's defaults for any key it omits. Never throws. */
export function reconcilerNumbers({ allocation = null } = {}) {
  let raw = null;
  try { raw = (allocation ?? allocationSettings())?.reconciler ?? null; } catch { raw = null; }
  const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
  return {
    pollMs: num(raw?.pollMs, DEFAULT_NUMBERS.pollMs), leaseMs: num(raw?.leaseMs, DEFAULT_NUMBERS.leaseMs),
    renewMs: num(raw?.renewMs, DEFAULT_NUMBERS.renewMs), heartbeatStaleMs: num(raw?.heartbeatStaleMs, DEFAULT_NUMBERS.heartbeatStaleMs),
    statusCacheMs: num(raw?.statusCacheMs, DEFAULT_NUMBERS.statusCacheMs),
    backoff: { minMs: num(raw?.backoff?.minMs, DEFAULT_NUMBERS.backoff.minMs), maxMs: num(raw?.backoff?.maxMs, DEFAULT_NUMBERS.backoff.maxMs) },
    crashLoop: { max: num(raw?.crashLoop?.max, DEFAULT_NUMBERS.crashLoop.max), windowMs: num(raw?.crashLoop?.windowMs, DEFAULT_NUMBERS.crashLoop.windowMs) },
  };
}

/**
 * config.yaml `reconciler`: {enabled, controllers: {<name>: {mode}}}. An absent block, an unreadable config or an
 * unknown mode reads as off. Never throws.
 */
export function reconcilerConfig({ config = undefined } = {}) {
  let cfg = config;
  if (cfg === undefined) { try { cfg = loadConfig(); } catch { cfg = null; } }
  const block = cfg?.reconciler ?? null;
  const controllers = {};
  for (const [name, value] of Object.entries(block?.controllers ?? {})) {
    const mode = value?.mode;
    controllers[name] = { mode: MODES.includes(mode) ? mode : 'off' };
  }
  return { enabled: block?.enabled === true, controllers };
}

/** The configured mode of one controller ('off' when unnamed). */
export const configuredMode = (name, conf = reconcilerConfig()) => (conf.enabled ? conf.controllers[name]?.mode ?? 'off' : 'off');

/** modules/reconciler/<name>.yaml, or {} (absent or unparsable). */
export function controllerModule(name, { root = SKILL_ROOT } = {}) {
  try { return parseYaml(fs.readFileSync(path.join(root, 'modules', 'reconciler', `${name}.yaml`), 'utf8')) ?? {}; } catch { return {}; }
}

/** The leader row, or null. */
export const leaderOf = (db, name = LEADER_NAME) => db.prepare('SELECT * FROM leader WHERE name=?').get(name) ?? null;
