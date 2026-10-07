// scripts/reconciler/engine-modes.mjs — how the engine turns config.yaml into the effective mode of each controller.
//
// A readable config gives every controller its configured mode (safe mode and --once without --apply run `active` as
// `shadow`). A config the running code cannot read (a newer file under older code, a file mid-swap, an invalid key)
// gives NO new modes: the engine keeps the modes it runs (at start: the ones controller_modes recorded), says so in
// machine_logs (reconciler.config-unreadable) and holds an open ENGINE_CONFIG_UNREADABLE clock until the config reads again.
import { CONTROLLERS as MACHINE_CONTROLLERS } from '../../engine/db/machine.mjs';
import { MODES, configuredMode } from './state.mjs';
import { openClock } from './sla.mjs';

const CONFIG_FAULT_ENTITY = 'engine:config';
const CONFIG_FAULT_STATE = 'ENGINE_CONFIG_UNREADABLE';

const demoted = (mode, engine) => ((engine.safe || !engine.apply) && mode === 'active' ? 'shadow' : mode);
const validMode = (mode) => (MODES.includes(mode) ? mode : MODES[0]);

/** The modes the store recorded as effective ({} when it cannot be read). */
function recordedModes(engine) {
  try { return engine.state.controllerModes(); } catch { return {}; }
}

/** The modes to keep while the config is unreadable: the running ones, else the recorded ones, else off. */
function heldModes(engine, names) {
  const running = Object.keys(engine.modes).length ? engine.modes : recordedModes(engine);
  return Object.fromEntries(names.map((name) => [name, demoted(validMode(running[name]), engine)]));
}

/** One line of the modes, for the fault row. */
const modesLine = (modes) => Object.entries(modes).map(([name, mode]) => `${name}=${mode}`).join(' ');

/** The fault changed: say it once (a new message is a new row), and say when it ends. */
function settleFault(engine, error) {
  const previous = engine.configFault;
  if (!error) {
    if (previous) engine.log('reconciler.event', `config.yaml reads again after ${Math.round((engine.now() - previous.since) / 1000)}s; modes follow it`, { kind: 'reconciler.config-recovered', since: previous.since });
    engine.configFault = null;
    return;
  }
  const message = String(error?.message ?? error).slice(0, 300);
  engine.configFault = { since: previous?.since ?? engine.now(), message };
  if (previous?.message === message) return;
  engine.log('reconciler.error', `config.yaml unreadable, modes held (${modesLine(engine.modes)}): ${message}`, { kind: 'reconciler.config-unreadable', detail: message, held: engine.modes });
}

/**
 * The effective modes of `names` after reading the config. Sets engine.configured (the configured mode of each name) on a
 * readable config; on an unreadable one returns the held modes and records the fault.
 */
export function readModes(engine, names) {
  let conf;
  try { conf = engine.configFn(); } catch (error) {
    const held = heldModes(engine, names);
    engine.modes = held;
    settleFault(engine, error);
    return held;
  }
  settleFault(engine, null);
  engine.configured = Object.fromEntries(names.map((name) => [name, configuredMode(name, conf)]));
  return Object.fromEntries(names.map((name) => [name, demoted(validMode(engine.configured[name]), engine)]));
}

/** The ENGINE_CONFIG_UNREADABLE clock follows engine.configFault (the SLA pass reports it in every mode). */
function syncFaultClock(engine) {
  if (engine.configFault) openClock(engine.state, { entity: CONFIG_FAULT_ENTITY, state: CONFIG_FAULT_STATE, slaMs: 0, enteredAt: engine.configFault.since });
  else engine.state.clearSla({ entity: CONFIG_FAULT_ENTITY, state: CONFIG_FAULT_STATE, reason: 'resolved' });
}

/**
 * Record the EFFECTIVE mode of each controller in controller_modes; a change is a mode_changes row first (who and why,
 * G6). The engine never chooses a mode: it records what config.yaml (and --safe / --once) make effective, and nothing
 * while the config is unreadable.
 */
export function writeModes(engine) {
  try {
    engine.state.transaction(() => {
      syncFaultClock(engine);
      if (engine.configFault) return;
      for (const [name, mode] of Object.entries(engine.modes)) {
        if (!MACHINE_CONTROLLERS.includes(name)) continue;
        const configured = engine.configured?.[name] ?? 'off';
        const reason = mode !== configured ? `${(engine.safe && 'safe mode') || 'no --apply'}: configured ${configured} runs ${mode}` : `config.yaml reconciler.controllers.${name}.mode`;
        engine.state.setControllerMode({ controller: name, mode, by: `engine:${engine.holder}`, reason });
      }
    });
  } catch (error) { engine.log('reconciler.error', `modes write failed: ${String(error?.message ?? error).slice(0, 300)}`, { kind: 'reconciler.modes-write-failed' }); }
}
