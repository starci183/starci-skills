// scripts/reconciler/state.mjs — the reconciler's settings (DESIGN §7.3).
//
// The engine's state lives in machine.sqlite (engine/machine-db.mjs, DBTREE.sql B2/B3): engine_leader + leader_history
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
export const CONTROLLER_NAMES = Object.freeze(['job', 'host', 'gc', 'resource', 'workflow', 'fleet', 'learning']);
/** process_runs.start_reason of the engine: boot.mjs names it in this variable (a self-reload is 'self-reload'). */
export const START_REASON_ENV = 'STARCI_ENGINE_START_REASON';

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
