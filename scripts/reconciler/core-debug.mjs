#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, coreDebugSettings } from '../../engine/config.mjs';
import { openMachine, openMachineReader } from '../../engine/db/machine.mjs';
import { readYamlFile } from '../lib/read-yaml.mjs';
import { isMain } from '../lib/is-main.mjs';
import { loadAdapter, loadModelRegistry, adapterModelAuthority } from '../agent/model-registry.mjs';
import { launchSupervisor, stopSupervisor, seatHealth } from '../supervisor/start-supervisor.mjs';
import { SKILL_ROOT, seatOf, enabledOf, terminalSignalDb, supervisorEvent } from '../machine/home.mjs';
import { workerShow } from '../api/orca/worker-show.mjs';
import { wakeKernel } from '../kernel/wake-delivery.mjs';
import { claimDue, finishDuty } from './schedules.mjs';

export function coreDebugProfile(root = SKILL_ROOT) {
  const profile = readYamlFile(path.join(root, 'modules', 'reconciler', 'host.yaml'))?.coreDebug;
  const fields = ['id', 'seatId', 'title', 'prompt', 'enabledScope', 'eventPrefix', 'stateScope'];
  if (!profile || fields.some(key => typeof profile[key] !== 'string' || !profile[key].trim())
      || Object.keys(profile).some(key => !fields.includes(key))) throw new Error('invalid host coreDebug seat declaration');
  return profile;
}

export function coreDebugRoute(caller, config, { registry = loadModelRegistry(), adapter = loadAdapter } = {}) {
  const agent = caller?.agent;
  if (typeof agent !== 'string' || !agent.trim()) throw new Error('core maintenance requires a declared invoking agent');
  const loaded = adapter(agent);
  if (loaded.error || !loaded.card) throw new Error(loaded.error ?? 'invoking agent card is unavailable');
  const authority = adapterModelAuthority(loaded.card);
  if (!authority) throw new Error('invoking agent has no supported launch identity authority');
  const concrete = loaded.card.start?.modelArgument !== false;
  const pool = Object.values(registry.pools ?? {}).find(row => row.provider === agent);
  const model = caller.model ?? pool?.defaultModel;
  if (!model || registry.models?.[model]?.provider !== agent) throw new Error('invoking agent/model pair is not registered');
  if (!concrete && caller.model && caller.model !== pool?.defaultModel) throw new Error('the invoking agent cannot attest an exact underlying model');
  let match = 'logical-runtime';
  if (concrete) match = caller.model ? 'concrete' : 'configured-route';
  return { agent, model, effort: caller.effort ?? null, modelAuthority: authority,
    source: caller.source ?? (caller.model ? 'declared-ingress' : 'agent-card-default'),
    match };
}

/** Called only after the workflow ingress verifies its accepted goal and start authority. */
export async function ensureCoreDebug({ caller, env = process.env, plan = false, deps = {}, config = loadConfig(), now = Date.now } = {}) {
  if (config.debug !== true) return { ok: true, ready: true, action: 'disabled' };
  const invocationCaller = caller && ['agent', 'model', 'effort'].some(key => caller[key] != null) ? caller : null;
  if (invocationCaller == null) {
    const existing = coreDebugStatus({ env, now: now(), deps: { show: deps.show ?? deps.host?.show } });
    if (existing.ready === true && existing.seat?.route) {
      return { ok: true, ready: !plan, action: 'already-live', terminal: existing.health.terminal,
        dispatch: existing.seat.dispatch, agent: existing.seat.agent, model: existing.seat.model,
        effective: existing.seat.effective ?? null, invocationCaller,
        requestedRoute: { ...existing.seat.route, source: 'persisted-owned-seat' },
        ...(plan ? { planned: true, wouldLaunch: false } : {}) };
    }
  }
  let route;
  try { route = coreDebugRoute(caller, config, deps); }
  catch (error) { return { ok: false, ready: false, action: 'caller-route-unavailable', effectState: 'none', error: String(error.message) }; }
  const profile = coreDebugProfile();
  const settings = { agent: route.agent, model: route.model, effort: route.effort,
    group: [{ agent: route.agent, model: route.model }], repos: [], language: config.language,
    pollIntervalMs: coreDebugSettings(config).intervalMs };
  const result = await (deps.launch ?? launchSupervisor)({ env, plan, profile, route, settings, deps: deps.host ?? null, now,
    template: fs.readFileSync(path.join(SKILL_ROOT, profile.prompt), 'utf8'), doc: {} });
  const ready = !plan && result.ok === true && ['booted', 'restarted', 'already-live'].includes(result.action);
  return { ...result, ok: plan ? result.ok : ready, ready, invocationCaller, requestedRoute: route,
    ...(plan ? { planned: true } : {}) };
}

export async function stopCoreDebug({ env = process.env, deps = {}, now = Date.now } = {}) {
  return (deps.stop ?? stopSupervisor)({ env, profile: coreDebugProfile(), deps: deps.host ?? null, now });
}

export function coreDebugStatus({ env = process.env, now = Date.now(), deps = {} } = {}) {
  const profile = coreDebugProfile();
  const m = openMachineReader({ env });
  if (!m) return { ok: true, ready: false, enabled: null, seat: null, health: { live: false, reason: 'no maintenance seat' } };
  try {
    const seat = seatOf(m, now, profile), enabled = enabledOf(m, profile);
    const health = seatHealth(seat, { show: deps.show ?? (dispatch => workerShow({ dispatch })) });
    return { ok: true, ready: enabled === true && health.live === true && !health.starting && Boolean(seat?.value?.route),
      enabled, seat: seat?.value ?? null, health };
  }
  finally { m.close(); }
}

/** One mechanical Host-controller pass; the reconciler owns all recurrence. */
export async function watchCoreDebug({ env = process.env, deps = {}, config = loadConfig(), now = Date.now } = {}) {
  const profile = coreDebugProfile();
  const m = openMachine({ env });
  let seat;
  try {
    seat = seatOf(m, now(), profile);
    if (config.debug !== true) {
      if (!seat) return { ok: true, action: 'disabled' };
      m.close();
      return stopCoreDebug({ env, deps, now });
    }
    if (enabledOf(m, profile) !== true) return { ok: true, action: 'never-started' };
    const route = seat?.value?.route ?? m.supSignal(profile.enabledScope, profile.id)?.value?.route;
    if (!route) return { ok: false, action: 'route-unverified', reason: 'maintenance has no persisted invoking route' };
    const show = deps.show ?? (dispatch => workerShow({ dispatch }));
    let health = seatHealth(seat, { show });
    if (health.starting) return { ok: true, action: 'starting' };
    if (health.hostUnavailable || health.unverified) return { ok: false, action: 'host-unavailable', reason: health.reason };
    if (!health.live && seat?.value?.dispatch) {
      health = seatHealth(seat, { show });
      if (health.hostUnavailable || health.unverified || health.live) return { ok: false, action: 'death-unconfirmed', reason: health.reason };
    }
    if (!health.live) {
      m.close();
      return ensureCoreDebug({ caller: route, env, config, deps, now });
    }
    const intervalMs = coreDebugSettings(config).intervalMs;
    const ctx = { machineSchedules: true, env };
    const due = claimDue(ctx, { controller: 'host', duty: profile.id, intervalMs, now: now() });
    if (!due.due) return { ok: due.reason !== 'store-unavailable', action: 'fresh', terminal: health.terminal, schedule: due };
    const text = `[${profile.title}] Run one core maintenance pass; read ${profile.prompt}.`;
    let wake;
    try { wake = (deps.wake ?? ((terminal, message) => wakeKernel({ db: terminalSignalDb(terminal), workflowId: profile.seatId, text: message })))(health.terminal, text); }
    catch (error) { wake = { delivered: false, action: 'wake-failed', error: String(error.message) }; }
    const busy = wake?.action === 'kernel-busy';
    const ok = wake?.delivered === true || busy;
    supervisorEvent(m, { entityId: profile.id, kind: `${profile.eventPrefix}-wake`, now: now(), payload: {
      dispatch: seat.value.dispatch, terminal: health.terminal, delivered: wake?.delivered === true, action: wake?.action ?? null } });
    const recorded = finishDuty(ctx, { controller: 'host', duty: profile.id, result: ok ? 'done' : 'failed', now: now() });
    let action = 'wake-failed';
    if (busy) action = 'busy';
    else if (ok) action = 'woken';
    return { ok: ok && recorded, action, terminal: health.terminal, wake };
  } finally { m.close(); }
}

if (isMain(import.meta.url)) {
  let result;
  if (process.argv.includes('--status')) result = coreDebugStatus();
  else if (process.argv.includes('--once')) result = await watchCoreDebug();
  else result = { ok: false, error: 'use: core-debug.mjs --once | --status' };
  console.log(JSON.stringify(result));
  process.exitCode = result.ok ? 0 : 1;
}
