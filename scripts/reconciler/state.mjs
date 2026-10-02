// scripts/reconciler/state.mjs — the reconciler's settings (DESIGN §7.3).
//
// The engine's state lives in machine.sqlite (engine/db/machine.mjs, DBTREE.sql B2/B3): engine_leader + leader_history
// (the leader and its epochs), engine_cursors (per-ledger events cursor, keyed by machine.ledgers ledger_id),
// engine_queue (the workqueue), engine_actions (the mutation journal), sla_episodes (SLA clocks, append-only; the open
// ones are v_sla_open), services + service_events + service_probes (the Host controller's registry), controller_modes +
// mode_changes (the effective mode of each controller, with who and why), process_runs (every engine start and exit)
// and machine_logs actor 'reconciler' (the engine's log). reconciler.sqlite, reconciler.heartbeat, reconciler-starts.json
// and reconciler.log are retired.
//
// Settings: config.yaml `reconciler` ({enabled, controllers.<name>.mode}) and runtimes.yaml allocation.reconciler
// (the numbers). Per-controller overrides: modules/reconciler/<name>.yaml (resyncMs, concurrency, timeoutMs).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { allocationSettings, loadConfig } from '../../engine/config.mjs';
import { parseYaml } from '../../engine/yaml.mjs';

export const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const LEADER_NAME = 'reconciler';
export const MODES = Object.freeze(['off', 'shadow', 'active']);
export const CONTROLLER_NAMES = Object.freeze(['job', 'host', 'gc', 'resource', 'workflow', 'workers', 'learning']);
/** process_runs.start_reason of the engine: boot.mjs names it in this variable (a self-reload is 'self-reload'). */
export const START_REASON_ENV = 'STARCI_ENGINE_START_REASON';

const DEFAULT_NUMBERS = Object.freeze({
  pollMs: 2000, leaseMs: 30000, renewMs: 10000, heartbeatStaleMs: 60000, statusCacheMs: 20000, stallMaxMs: 300000,
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
    // a blocked main thread past this is a hung engine: the heartbeat worker stops renewing (heartbeat-worker.mjs)
    stallMaxMs: num(raw?.stallMaxMs, DEFAULT_NUMBERS.stallMaxMs),
    backoff: { minMs: num(raw?.backoff?.minMs, DEFAULT_NUMBERS.backoff.minMs), maxMs: num(raw?.backoff?.maxMs, DEFAULT_NUMBERS.backoff.maxMs) },
    crashLoop: { max: num(raw?.crashLoop?.max, DEFAULT_NUMBERS.crashLoop.max), windowMs: num(raw?.crashLoop?.windowMs, DEFAULT_NUMBERS.crashLoop.windowMs) },
  };
}

/**
 * The operational profile (owner 2026-09-29): what `start` needs of the engine. job settles and dispatches, host brings
 * services and seats up, workflow wakes stalled workflows, resource throttles; gc, workers and learning stay shadow unless
 * config.yaml says otherwise. `observe` keeps every controller shadow (read-only). No profile = only the explicit
 * controllers.<name>.mode entries count (an unnamed controller is off).
 */
export const PROFILES = Object.freeze({
  operational: Object.freeze({ job: 'active', host: 'active', workflow: 'active', resource: 'active', gc: 'shadow', workers: 'shadow', learning: 'shadow' }),
  observe: Object.freeze({ job: 'shadow', host: 'shadow', workflow: 'shadow', resource: 'shadow', gc: 'shadow', workers: 'shadow', learning: 'shadow' }),
});
/** The controllers `start` needs active: those the operational profile runs active. */
export const REQUIRED_ACTIVE = Object.freeze(Object.entries(PROFILES.operational).filter(([, m]) => m === 'active').map(([n]) => n));

/**
 * config.yaml `reconciler`: {enabled, profile, controllers: {<name>: {mode}}}. The profile (when named) supplies the
 * default mode of every controller; an explicit controllers.<name>.mode overrides it. An absent block, an unreadable
 * config or an unknown mode reads as off. Never throws.
 */
export function reconcilerConfig({ config = undefined } = {}) {
  let cfg = config;
  if (cfg === undefined) { try { cfg = loadConfig(); } catch { cfg = null; } }
  const block = cfg?.reconciler ?? null;
  const profile = Object.hasOwn(PROFILES, block?.profile) ? block.profile : null;
  const controllers = {};
  for (const [name, mode] of Object.entries(profile ? PROFILES[profile] : {})) controllers[name] = { mode };
  for (const [name, value] of Object.entries(block?.controllers ?? {})) {
    const mode = value?.mode;
    controllers[name] = { mode: MODES.includes(mode) ? mode : 'off' };
  }
  return { enabled: block?.enabled === true, profile, controllers };
}

/** The configured mode of one controller ('off' when unnamed). */
export const configuredMode = (name, conf = reconcilerConfig()) => (conf.enabled ? conf.controllers[name]?.mode ?? 'off' : 'off');

/** modules/reconciler/<name>.yaml, or {} (absent or unparsable). */
export function controllerModule(name, { root = SKILL_ROOT } = {}) {
  try { return parseYaml(fs.readFileSync(path.join(root, 'modules', 'reconciler', `${name}.yaml`), 'utf8')) ?? {}; } catch { return {}; }
}
