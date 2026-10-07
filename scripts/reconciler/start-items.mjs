import { CONNECTOR_DEFAULTS } from '../../engine/config.mjs';
import { PROFILES, REQUIRED_ACTIVE, configuredMode } from './state.mjs';
import { green, red, warn } from './checklist-items.mjs';

export const PROFILE = 'operational';

/** The config profile rows. `conf` is reconcilerConfig(); `raw` the config's own reconciler block. Pure. */
export function profileItems(conf, raw) {
  const fix = 'starci reconciler up --set-profile operational (writes that one block to config.yaml, backup kept)';
  if (!conf.enabled) return [red('config', 'profile', 'reconciler config', 'reconciler.enabled is not true: no controller runs', fix)];
  if (conf.profile !== PROFILE) {
    const shadow = REQUIRED_ACTIVE.filter((name) => conf.controllers[name]?.mode !== 'active');
    if (!shadow.length) return [green('config', 'profile', 'reconciler profile', `no profile, but ${REQUIRED_ACTIVE.join(', ')} are explicitly active`)];
    const label = conf.profile ? `profile ${conf.profile}` : 'no reconciler.profile: an unnamed controller is not run (shadow at most)';
    const modes = shadow.map((name) => `${name}=${configuredMode(name, conf)}`).join(' ');
    return [red('config', 'profile', 'reconciler profile', `${label}: ${modes} - start needs them active`, fix)];
  }
  const overridden = REQUIRED_ACTIVE.filter((name) => conf.controllers[name]?.mode !== 'active');
  if (!overridden.length) {
    const modes = Object.entries(PROFILES.operational).map(([name, mode]) => `${name}=${mode}`).join(' ');
    const overridesKept = raw?.controllers && Object.keys(raw.controllers).length ? '; explicit overrides kept' : '';
    return [green('config', 'profile', 'reconciler profile', `operational (${modes}${overridesKept})`)];
  }
  const controllers = overridden.join(', ');
  const modes = overridden.map((name) => conf.controllers[name]?.mode).join('/');
  const removal = `remove controllers.${overridden.join(', controllers.')} from config.yaml reconciler (or run start.mjs --set-profile operational)`;
  return [red('config', 'profile', 'reconciler profile', `operational, but controllers.${controllers} is set explicitly to ${modes}`, removal)];
}

/** The live safe-mode controller rows derive from boot.mjs leaderState(). Pure over the status. */
export function safeShadowOf(s) {
  if (!s?.leader?.fresh) return [];
  return Object.entries(s.modes ?? {}).filter(([, mode]) => mode.configured === 'active' && mode.effective === 'shadow').map(([name]) => name);
}

export const engineIsSafe = (s) => Boolean(s?.leader?.safe) || safeShadowOf(s).length > 0;

const leaderItem = (leader) => {
  if (!leader.fresh) {
    const heartbeat = leader.ageMs == null ? 'never' : `${Math.round(leader.ageMs / 1000)}s`;
    const detail = leader.holder
      ? `stale: leader ${leader.holder} pid ${leader.pid} heartbeat ${heartbeat} old`
      : 'not running';
    return red('engine', 'engine', 'reconciler engine', detail, 'starci reconciler up');
  }
  const detail = `leader ${leader.holder} pid ${leader.pid} epoch ${leader.epoch} heartbeat ${Math.round(leader.ageMs / 1000)}s ago${leader.draining ? ' (draining a reload)' : ''}`;
  return green('engine', 'engine', 'reconciler engine', detail);
};

const safeModeItem = (s, safeIsCrashLoop, shadowed) => {
  if (!engineIsSafe(s)) return green('engine', 'safe-mode', 'engine safe mode', 'normal mode');
  const detail = safeIsCrashLoop
    ? 'running --safe: a real crash loop is on record (every controller is forced shadow)'
    : 'running --safe (every controller forced shadow) without a crash loop behind it';
  const shadowNote = shadowed.length ? `; configured active but running shadow: ${shadowed.join(', ')}` : '';
  return red('engine', 'safe-mode', 'engine safe mode', detail + shadowNote, 'starci reconciler up (restarts it normally)');
};

const controllerItem = (name, mode) => {
  const wanted = PROFILES.operational[name];
  const required = REQUIRED_ACTIVE.includes(name);
  const shown = mode.effective + (mode.configured !== mode.effective ? ` (configured ${mode.configured})` : '');
  if (required) {
    if (mode.effective === 'active') return green('controllers', `mode:${name}`, `controller ${name}`, shown);
    const fix = mode.configured === 'active' ? 'the engine is not running it yet: starci reconciler up' : 'starci reconciler up --set-profile operational';
    return red('controllers', `mode:${name}`, `controller ${name}`, `${shown}, start needs active`, fix);
  }
  if (mode.effective === 'off' && wanted !== 'off') return warn('controllers', `mode:${name}`, `controller ${name}`, `${shown}, profile expects ${wanted}`);
  return green('controllers', `mode:${name}`, `controller ${name}`, shown, { required: false });
};

/** Engine and controller rows from boot.mjs status(). Pure over the status. */
export function engineItems(s, { safeIsCrashLoop = false } = {}) {
  const shadowed = safeShadowOf(s);
  return [leaderItem(s.leader), safeModeItem(s, safeIsCrashLoop, shadowed), ...Object.keys(s.modes).map((name) => controllerItem(name, s.modes[name]))];
}

const SERVICE_LABEL = { orca: 'Orca', 'harness-ui': 'harness UI (local /healthz)', 'harness-tunnel': 'harness tunnel (public /healthz)', 'ask-gateway': 'ask gateway', 'ask-tunnel': 'ask tunnel', 'telegram-bridge': 'Telegram bridge' };

/** Whether config.yaml wants a connector service at all (an `off` one is not required). Pure. */
export const serviceWanted = (name, config) => {
  if (name === 'ask-tunnel') return (config?.connectors?.cloudflare?.mode ?? CONNECTOR_DEFAULTS.cloudflare.mode) !== 'off';
  if (name === 'telegram-bridge') return config?.connectors?.telegram?.enabled === true;
  return true;
};

const serviceDownReason = (detail) => {
  let reason = detail.error ?? detail.status ?? detail.verdict;
  if (reason != null) return reason;
  if (!detail.value) return 'no answer';
  reason = detail.value.health?.problems?.[0];
  if (reason != null) return reason;
  return detail.value.running === false ? 'not running' : JSON.stringify(detail.value).slice(0, 120);
};

const serviceDetail = (probe, publicUrl) => {
  const detail = probe.detail ?? {};
  if (!probe.ok) return `down: ${serviceDownReason(detail)}`;
  let message = 'up';
  if (detail.status) message += ` (HTTP ${detail.status}`;
  if (detail.ms != null) message += (detail.status ? ', ' : ' (') + `${detail.ms}ms`;
  if (detail.status || detail.ms != null) message += ')';
  if (probe.name === 'harness-tunnel' && publicUrl) message += ` ${publicUrl}`;
  return message;
};

const scheduledTaskItem = (probe) => {
  const name = `scheduled task ${probe.name.slice(11)}`;
  if (probe.ok) return green('services', probe.name, name, `exists (${probe.detail?.status ?? 'ok'})`, { required: false });
  const detail = probe.unmanaged ? 'missing (unmanaged)' : 'not healthy';
  return warn('services', probe.name, name, detail, 'starci task register reconciler --apply (the owner)');
};

const serviceItem = (probe, { publicUrl, config }) => {
  const label = SERVICE_LABEL[probe.name] ?? probe.name;
  const detail = serviceDetail(probe, publicUrl);
  if (probe.name.startsWith('sched-task:')) return scheduledTaskItem(probe);
  if (probe.ok) return green('services', probe.name, label, detail);
  if (!serviceWanted(probe.name, config)) return green('services', probe.name, label, 'off in config.yaml connectors (not required)', { required: false });
  const fix = probe.name === 'orca'
    ? 'open Orca yourself, then run start again (start never launches a GUI app)'
    : 'the reconciler Host controller manages this service; run starci reconciler start';
  return red('services', probe.name, label, detail, fix);
};

/** Convert service probes to readiness rows without changing registry order. */
export function serviceItems(probes, { publicUrl = null, config = null } = {}) {
  return probes.map((probe) => serviceItem(probe, { publicUrl, config }));
}
