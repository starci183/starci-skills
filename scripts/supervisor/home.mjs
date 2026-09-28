// home.mjs — the Supervisor's durable state, in machine.sqlite (engine/machine-db.mjs, DBTREE.sql B1; decision Q3).
//
// There is no supervisor ledger any more (the old <supervisor home>/.starciwork/runtime.sqlite is archived by the
// comeback). Where each part lives:
//   seat      seats row 'supervisor' (role supervisor): state booting while a launcher holds the startup reservation
//             (detail_json.expiresAt), live once spawned; terminal_handle/agent/model/pid; detail_json {token, value}
//   enabled   sup_signals scope 'supervisor-enabled' key 'main' {enabled, by, at}
//   jobs      sup_jobs (runtime.fix [Worker] jobs), sup_leases (file leases), sup_attempts, sup_reports
//   audit     sup_events (the digest-chained audit trail; kinds as before: supervisor-*, worker-*, owed-*, ...)
//   learning  sup_learning; owed items and their acks sup_owed; owner rulings sup_owner_rulings; messages sup_messages
//   logs      machine_logs actor 'supervisor' (supervisorLog; no text logs under the supervisor home)
// Product ledgers are only ever read from here.
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../../engine/config.mjs';
import { machineLog, readMachine, withMachine } from '../../engine/machine-db.mjs';
import { lanesRoot } from '../lib/hk-lanes.mjs';

export const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SUPERVISOR_ID = 'main';
/** The seats row of the one Supervisor seat. */
export const SEAT_ID = 'supervisor';
export const ENABLED_SCOPE = 'supervisor-enabled';
export const SUPERVISOR_TITLE = `[Supervisor] ${SUPERVISOR_ID}`;
export const WORKER_TITLE_PREFIX = '[Worker]';
export const SUPERVISOR_MARKER = /\[Supervisor\]/;
export const WORKER_MARKER = /\[Worker\]/;
export const FIX_KIND = 'runtime.fix';
export const STARTUP_RESERVATION_MS = 180_000;

export const DEFAULTS = Object.freeze({
  workers: Object.freeze({ base: 4, max: 10 }),
  landGate: Object.freeze({ mode: 'shared', push: true }),
  frozenMinutes: 10,
  pollIntervalMs: 600_000,
});

/**
 * The supervisor home: STARCI_SUPERVISOR_HOME, else ~/.starci/supervisor. Nothing new is written there (the state is in
 * machine.sqlite); it remains only as the place the comeback archives the pre-alpha.3 supervisor files from.
 */
export const supervisorHome = (env = process.env) => path.resolve(env.STARCI_SUPERVISOR_HOME || path.join(os.homedir(), '.starci', 'supervisor'));
// The worktrees live under the one lanes root (scripts/lib/hk-lanes.mjs: runtimes.yaml
// allocation.housekeeping.lanesRoot, STARCI_LANES_ROOT, default D:/starci-lanes), never on C:.
export const stagingRoot = (env = process.env) => path.join(lanesRoot({ env }), 'staging');
export const landRoot = (env = process.env) => path.join(lanesRoot({ env }), 'land');

/** fn(machine handle) over a writer, closed afterwards. */
export const withSupervisor = (fn, { env = process.env } = {}) => withMachine(fn, { env });
/** fn(machine handle) over a read-only handle; `fallback` when machine.sqlite does not exist or cannot be read. */
export const readSupervisor = (fn, fallback = null, { env = process.env } = {}) => readMachine(fn, fallback, { env });

/**
 * The seat: {token, value, at, expiresAt, pid, expired, starting} or null (no seat, or an empty one). `value` is what
 * the launcher wrote ({terminal, agent, model, ...} or {state:'starting', attempt}).
 */
export function seatOf(m, now = Date.now()) {
  const row = m.seatOf(SEAT_ID);
  if (!row || row.state === 'empty') return null;
  const detail = row.detail ?? {};
  const expiresAt = detail.expiresAt ?? null;
  const expired = expiresAt != null && expiresAt <= now;
  const value = detail.value ?? {};
  return { token: detail.token ?? null, value, at: row.booted_at ?? row.last_seen_at ?? null, expiresAt, pid: row.pid ?? null, expired, starting: value.state === 'starting' && !expired, state: row.state };
}
/** Write the seat (replacing it): a {state:'starting'} value is the startup reservation (state booting, with expiry). */
export function writeSeat(m, { token, value, expiresAt = null, now = Date.now() }) {
  const starting = value?.state === 'starting';
  return m.upsertSeat({ seatId: SEAT_ID, role: 'supervisor', state: starting ? 'booting' : 'live', parkedReason: null,
    terminalHandle: value?.terminal ?? null, agent: value?.agent ?? null, model: value?.model ?? null, pid: process.pid,
    bootedAt: now, lastSeenAt: now, detailJson: { token, value, expiresAt } });
}
/** Empty the seat (only the holder of `token` when given). True when it was cleared. */
export function clearSeat(m, { token = null } = {}) {
  const cur = seatOf(m);
  if (!cur || (token && cur.token !== token)) return false;
  m.upsertSeat({ seatId: SEAT_ID, role: 'supervisor', state: 'empty', terminalHandle: null, pid: null, detailJson: null });
  return true;
}

/** Whether the owner enabled the seat: true / false, or null when never set. */
export function enabledOf(m) {
  const row = m.supSignal(ENABLED_SCOPE, SUPERVISOR_ID);
  return row ? row.value?.enabled === true : null;
}
export function setEnabled(m, enabled, { by = 'cli', now = Date.now() } = {}) {
  m.transaction(() => {
    m.setSupSignal({ scope: ENABLED_SCOPE, key: SUPERVISOR_ID, value: { enabled, by, at: new Date(now).toISOString() } });
    supervisorEvent(m, { kind: enabled ? 'supervisor-enabled' : 'supervisor-disabled', payload: { by }, now });
  });
}

/** Append one audit event (sup_events). */
export function supervisorEvent(m, { entityType = 'supervisor', entityId = SUPERVISOR_ID, kind, payload = null, now = Date.now() }) {
  return m.supEvent({ entityType, entityId, kind, payload, at: now });
}
/** The newest event of `kind` as {at, ...payload}, or null. */
export function newestEvent(m, kind) {
  const row = m.newestSupEvent(kind);
  return row ? { at: row.created_at, ...(row.payload ?? {}) } : null;
}

/**
 * Where the Supervisor role runs (config.yaml supervisor.mode, default 'chat'). Owner, 2026-09-25: "dời supervisor
 * vào chat đi cho persistent" - the role lives in the owner's desktop chat session again: it owns channel 'main'
 * (registers and drains it with no Orca terminal), runs the 10-minute tick itself and lands its Opus lanes through
 * land.mjs --lane. 'kernel' is the optional [Supervisor] Orca kernel (start-supervisor.mjs + watchdog.mjs); in chat
 * mode nothing (resume-all, restart-all, /restart, the watchdog) starts one. STARCI_SUPERVISOR_MODE overrides the
 * config (specs, a one-off CLI run).
 */
export const SUPERVISOR_MODES = Object.freeze(['chat', 'kernel']);
export const DEFAULT_SUPERVISOR_MODE = 'chat';
export function supervisorMode({ env = process.env, config = undefined } = {}) {
  const fromEnv = String(env?.STARCI_SUPERVISOR_MODE ?? '').trim();
  if (SUPERVISOR_MODES.includes(fromEnv)) return fromEnv;
  let cfg = config;
  if (cfg === undefined) { try { cfg = loadConfig(); } catch { cfg = null; } }
  const mode = cfg?.supervisor?.mode;
  return SUPERVISOR_MODES.includes(mode) ? mode : DEFAULT_SUPERVISOR_MODE;
}

/** config.yaml supervisor block with defaults: {mode, agent, model, effort, repos, pollIntervalMs, workers, landGate, frozenMinutes}. */
export function supervisorSettings({ config = undefined } = {}) {
  let cfg = config;
  if (cfg === undefined) { try { cfg = loadConfig(); } catch { cfg = null; } }
  const sup = cfg?.supervisor ?? {};
  const kernel = cfg?.kernel ?? {};
  const seat = sup.kernel ?? {};
  const pick = (...values) => values.find((v) => typeof v === 'string' && v.trim())?.trim() ?? null;
  return {
    mode: SUPERVISOR_MODES.includes(sup.mode) ? sup.mode : DEFAULT_SUPERVISOR_MODE,
    agent: pick(seat.agent, kernel.agent, 'claude'),
    model: pick(seat.model, seat.agent ? null : kernel.model),
    effort: pick(seat.effort, seat.agent ? null : kernel.effort, cfg?.effort),
    repos: Array.isArray(sup.repos) ? sup.repos : [],
    pollIntervalMs: Number.isInteger(sup.pollIntervalMs) ? sup.pollIntervalMs : DEFAULTS.pollIntervalMs,
    workers: { base: Number.isInteger(sup.workers?.base) ? sup.workers.base : DEFAULTS.workers.base,
      max: Math.min(DEFAULTS.workers.max, Number.isInteger(sup.workers?.max) ? sup.workers.max : DEFAULTS.workers.max) },
    landGate: { mode: sup.landGate?.mode === 'exclusive' ? 'exclusive' : DEFAULTS.landGate.mode, push: sup.landGate?.push !== false },
    // watchdog.mjs: a busy seat frame with no turn progress for this long is frozen, not busy.
    frozenMinutes: Number.isInteger(sup.frozenMinutes) && sup.frozenMinutes > 0 ? sup.frozenMinutes : DEFAULTS.frozenMinutes,
    language: typeof cfg?.language === 'string' ? cfg.language : 'en',
  };
}

/** The product repositories the supervisor watches and pushes: config supervisor.repos resolved against the source root. */
export const productRepos = (settings = supervisorSettings(), { sourceRoot = path.dirname(SKILL_ROOT) } = {}) =>
  settings.repos.map((repo) => path.resolve(sourceRoot, repo));

/** A db-shaped adapter that answers wakeKernel's one signal read with `terminal` (scripts/kernel/wake-delivery.mjs wakeKernel). */
export const terminalSignalDb = (terminal) => ({
  prepare: () => ({ get: () => ({ value_json: JSON.stringify({ terminal }) }) }),
});

/** One Supervisor log line in machine_logs (actor supervisor, kind supervisor.<name>). Never throws. */
export function supervisorLog(name, line, { env = process.env, now = new Date(), level = 'info', data = null } = {}) {
  return machineLog({ actor: 'supervisor', kind: `supervisor.${name}`, msg: String(line), level, data, at: now.getTime() }, { env });
}
