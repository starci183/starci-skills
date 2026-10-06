// home.mjs — the Supervisor's durable state, in machine.sqlite (engine/db/machine.mjs, DBTREE.sql B1; decision Q3).
//
// There is no supervisor ledger and no supervisor home directory: every part is a machine.sqlite row.
// Where each part lives:
//   seat      seats row 'supervisor' (role supervisor): state booting while a launcher holds the startup reservation
//             (detail_json.expiresAt), live once spawned; terminal_handle/agent/model/pid; detail_json {token, value}
//   enabled   sup_signals scope 'supervisor-enabled' key 'main' {enabled, by, at}
//   jobs      sup_jobs (runtime.fix [Worker] jobs), sup_leases (file leases), sup_attempts, sup_reports
//   audit     sup_events (the digest-chained audit trail; kinds as before: supervisor-*, worker-*, owed-*, ...)
//   learning  sup_learning; owed items and their acks sup_owed; owner rulings sup_owner_rulings; messages sup_messages
//   logs      machine_logs actor 'supervisor' (supervisorLog; the Supervisor writes no text logs)
// Product ledgers are only ever read from here.
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_OWNER_LANGUAGE, loadConfig } from '../../engine/config.mjs';
import { LOCAL_ROOT_ENV, machineLog, readMachine, starciLocalRoot, withMachine } from '../../engine/db/machine.mjs';
import { headTime } from '../api/git/head-time.mjs';
import { readEnv } from '../lib/env.mjs';

export const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * The rev of the runtime this process runs: '<HEAD committer time, ms, 13 digits>:<short sha>' of the .claude checkout
 * (STARCI_RUNTIME_REV overrides), 'unknown' outside a checkout. The machine db never spawns git: a writer that stamps a
 * store row passes this in. Computed once per process.
 */
let cachedRev = null;
export function runtimeRevOf() {
  if (cachedRev) return cachedRev;
  if (readEnv('STARCI_RUNTIME_REV')) {
    cachedRev = String(readEnv('STARCI_RUNTIME_REV'));
    return cachedRev;
  }
  const head = headTime(SKILL_ROOT);
  cachedRev = head ? `${String(head.time * 1000).padStart(13, '0')}:${head.sha}` : 'unknown';
  return cachedRev;
}
export const SUPERVISOR_ID = 'main';
/** The seats row of the one Supervisor seat. */
export const SEAT_ID = 'supervisor';
const ENABLED_SCOPE = 'supervisor-enabled';
export const SUPERVISOR_TITLE = `[Supervisor] ${SUPERVISOR_ID}`;
export const SUPERVISOR_SEAT = Object.freeze({ id: SUPERVISOR_ID, seatId: SEAT_ID, enabledScope: ENABLED_SCOPE,
  eventPrefix: 'supervisor', title: SUPERVISOR_TITLE });
export const WORKER_TITLE_PREFIX = '[Worker]';
export const FIX_KIND = 'runtime.fix';
export const STARTUP_RESERVATION_MS = 180_000;

export const DEFAULTS = Object.freeze({
  workers: Object.freeze({ base: 4, max: 10 }),
  landGate: Object.freeze({ mode: 'shared', push: true }),
  frozenMinutes: 10,
  pollIntervalMs: 600_000,
});

// The land scratch trees live under the one lanes root (lanesRoot below), never on C: unless the owner puts it there. A [Worker]
// staging checkout is an Orca worktree (workers.mjs createStaging): Orca places it, the job records where.

/** The host-state sub-root `archive` defaults to: <starciLocalRoot>/archive, i.e. <runtime root>/.runtime/archive. */
const stateRootChild = (name, env) => path.join(starciLocalRoot(env), name);
/**
 * Lane worktrees are git worktrees, so their default stays OUT of the runtime's own checkout (and its .runtime): the per-user
 * profile directory (<LOCALAPPDATA>/StarCi/lanes, ~/.local/state/StarCi/lanes), or <STARCI_LOCAL_ROOT>/lanes when that seam is set.
 * The owner moves it with roots.lanes or STARCI_LANES_ROOT.
 */
const lanesDefault = (env) => (readEnv(LOCAL_ROOT_ENV, env) ? stateRootChild('lanes', env)
  : path.join(readEnv('LOCALAPPDATA', env) || path.join(os.homedir(), '.local', 'state'), 'StarCi', 'lanes'));
/** The owner's relocation of a host root (config.yaml `roots.<key>`, validated by engine/config.mjs), or null. `config` is the owner config (default: loadConfig()). */
const ownerRoot = (key, config) => {
  try { return (config === undefined ? loadConfig() : config)?.roots?.[key] ?? null; } catch { return null; }
};

/**
 * The one lane-worktree root: env STARCI_LANES_ROOT (specs, a one-off run), then the owner config `roots.lanes`
 * (config.yaml, gitignored), else lanesDefault (outside the checkout). No host location is written in a tracked file.
 */
export function lanesRoot({ env = process.env, config = undefined } = {}) {
  return path.resolve(String(env?.STARCI_LANES_ROOT || ownerRoot('lanes', config) || lanesDefault(env)));
}

/** The one archive root (session files, blob retention, ledger backups): env STARCI_ARCHIVE_ROOT, then the owner config `roots.archive`, else <starciLocalRoot>/archive. */
export function archiveRoot({ env = process.env, config = undefined } = {}) {
  return path.resolve(String(env?.STARCI_ARCHIVE_ROOT || ownerRoot('archive', config) || stateRootChild('archive', env)));
}

export const landRoot = (env = process.env) => path.join(lanesRoot({ env }), 'land');

/** fn(machine handle) over a writer, closed afterwards. */
export const withSupervisor = (fn, { env = process.env } = {}) => withMachine(fn, { env });
/** fn(machine handle) over a read-only handle; `fallback` when machine.sqlite does not exist or cannot be read. */
export const readSupervisor = (fn, fallback = null, { env = process.env } = {}) => readMachine(fn, fallback, { env });

/**
 * The `{env}`-bound reader of a supervisor-store projection `read`: `fresh` yields the fallback when the
 * store is absent (a thunk, so the value is never shared between calls).
 */
export const supervisorRead = (read, fresh) => ({ env = process.env } = {}) => readSupervisor(read, fresh(), { env });

/**
 * The seat: {token, value, at, expiresAt, pid, expired, starting} or null (no seat, or an empty one). `value` is what
 * the launcher wrote ({terminal, agent, model, ...} or {state:'starting', attempt}).
 */
export function seatOf(m, now = Date.now(), profile = SUPERVISOR_SEAT) {
  const row = m.seatOf(profile.seatId);
  if (!row || row.state === 'empty') return null;
  const detail = row.detail ?? {};
  const expiresAt = detail.expiresAt ?? null;
  const expired = expiresAt != null && expiresAt <= now;
  const value = detail.value ?? {};
  return { token: detail.token ?? null, value, at: row.booted_at ?? row.last_seen_at ?? null, expiresAt, pid: row.pid ?? null, expired, starting: value.state === 'starting' && !expired, state: row.state };
}
/** Write the seat (replacing it): a {state:'starting'} value is the startup reservation (state booting, with expiry). */
export function writeSeat(m, { token, value, expiresAt = null, now = Date.now(), profile = SUPERVISOR_SEAT }) {
  const starting = value?.state === 'starting';
  return m.upsertSeat({ seatId: profile.seatId, role: 'supervisor', state: starting ? 'booting' : 'live', parkedReason: null,
    terminalHandle: value?.terminal ?? null, agent: value?.agent ?? null, model: value?.model ?? null, pid: process.pid,
    bootedAt: now, lastSeenAt: now, detailJson: { token, value, expiresAt } });
}
/** Empty the seat (only the holder of `token` when given). True when it was cleared. */
export function clearSeat(m, { token = null, profile = SUPERVISOR_SEAT } = {}) {
  const cur = seatOf(m, Date.now(), profile);
  if (!cur || (token && cur.token !== token)) return false;
  m.upsertSeat({ seatId: profile.seatId, role: 'supervisor', state: 'empty', terminalHandle: null, pid: null, detailJson: null });
  return true;
}

/** Whether the owner enabled the seat: true / false, or null when never set. */
export function enabledOf(m, profile = SUPERVISOR_SEAT) {
  const row = m.supSignal(profile.enabledScope, profile.id);
  return row ? row.value?.enabled === true : null;
}
export function setEnabled(m, enabled, { by = 'cli', now = Date.now(), profile = SUPERVISOR_SEAT, route = null } = {}) {
  m.transaction(() => {
    m.setSupSignal({ scope: profile.enabledScope, key: profile.id, value: { enabled, by, at: new Date(now).toISOString(), ...(route ? { route } : {}) } });
    supervisorEvent(m, { entityId: profile.id, kind: `${profile.eventPrefix}-${enabled ? 'enabled' : 'disabled'}`, payload: { by }, now });
  });
}

/** Native supervised seats retain their terminals until their owning launcher proves closure. */
export function supervisedSeatHandles(m) {
  return new Set(m.seats().filter(row => row.role === 'supervisor' && row.state !== 'empty')
    .map(row => row.terminal_handle ?? row.detail?.value?.terminal).filter(Boolean));
}

/** Append one audit event (sup_events). */
export function supervisorEvent(m, { entityType = 'supervisor', entityId = SUPERVISOR_ID, kind, payload = null, now = Date.now() }) {
  return m.supEvent({ entityType, entityId, kind, payload, at: now });
}
/** The newest event of `kind` as {at, ...payload}, or null. */
export function newestEvent(m, kind) {
  const row = m.newestSupEvent(kind);
  return row ? { at: row.created_at, ...row.payload } : null;
}

/**
 * Where the Supervisor role runs (config.yaml supervisor.mode, default 'chat'). Owner, 2026-09-25: "move the
 * supervisor back into chat so it stays persistent" - the role lives in the owner's desktop chat session again: it owns channel 'main'
 * (registers and drains it with no Orca terminal), runs the 10-minute tick itself and lands its Opus lanes through
 * land.mjs --lane. 'kernel' is the optional [Supervisor] Orca kernel (start-supervisor.mjs + supervisor-watchdog.mjs); in chat
 * mode nothing (resume-all, restart-all, /start, the watchdog) starts one. STARCI_SUPERVISOR_MODE overrides the
 * config (specs, a one-off CLI run).
 */
const SUPERVISOR_MODES = Object.freeze(['chat', 'kernel']);
export const DEFAULT_SUPERVISOR_MODE = 'chat';
/** engine/config.mjs owns the owner-language default; home re-exports it so base (scripts/lib/i18n.mjs) never imports machine. */
export { DEFAULT_OWNER_LANGUAGE };
export const DEFAULT_AGENT = 'claude';
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
  if (cfg === undefined) cfg = loadConfig();
  const sup = cfg?.supervisor ?? {};
  const kernel = cfg?.kernel ?? {};
  const seat = sup.kernel ?? {};
  const pick = (...values) => values.find((v) => typeof v === 'string' && v.trim())?.trim() ?? null;
  let group = null;
  if (Array.isArray(seat.group)) group = seat.group;
  else if (!seat.agent && !seat.model && Array.isArray(kernel.group)) group = kernel.group;
  return {
    mode: SUPERVISOR_MODES.includes(sup.mode) ? sup.mode : DEFAULT_SUPERVISOR_MODE,
    agent: pick(seat.agent, kernel.agent, DEFAULT_AGENT),
    model: pick(seat.model, seat.agent ? null : kernel.model),
    group,
    effort: pick(seat.effort, seat.agent ? null : kernel.effort, cfg?.effort),
    repos: Array.isArray(sup.repos) ? sup.repos : [],
    pollIntervalMs: Number.isInteger(sup.pollIntervalMs) ? sup.pollIntervalMs : DEFAULTS.pollIntervalMs,
    workers: { base: Number.isInteger(sup.workers?.base) ? sup.workers.base : DEFAULTS.workers.base,
      max: Math.min(DEFAULTS.workers.max, Number.isInteger(sup.workers?.max) ? sup.workers.max : DEFAULTS.workers.max) },
    landGate: { mode: sup.landGate?.mode === 'exclusive' ? 'exclusive' : DEFAULTS.landGate.mode, push: sup.landGate?.push !== false },
    // supervisor-watchdog.mjs: a busy seat frame with no turn progress for this long is frozen, not busy.
    frozenMinutes: Number.isInteger(sup.frozenMinutes) && sup.frozenMinutes > 0 ? sup.frozenMinutes : DEFAULTS.frozenMinutes,
    language: typeof cfg?.language === 'string' ? cfg.language : DEFAULT_OWNER_LANGUAGE,
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
