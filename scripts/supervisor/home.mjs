// home.mjs — the one [Supervisor] kernel's durable state (modules/supervisor/supervise.yaml kernelSeat).
//
// The Supervisor reuses the kernel ledger machinery instead of a second store: one ledger file under
// the supervisor home (default ~/.starci/supervisor, STARCI_SUPERVISOR_HOME overrides it; outside
// every repository, so nothing there is ever committed) holding one workflow row SUPERVISOR_WF:
//   signals  scope 'supervisor-seat'    key 'main'  the singleton seat {terminal, agent, model, ...}
//                                                   ({state:'starting'} with an expiry while it boots)
//            scope 'supervisor-enabled' key 'main'  {enabled} - resume-all keeps a disabled seat down
//   jobs     kind 'runtime.fix'                     one [Worker] fix job per root-cause cluster
//   leases   resource 'file:<path>'                 the explicit file leases a worker holds
//   reports  dispatch_id = job id                  the worker's report (commit, incidents, specs)
//   events   supervisor-*, worker-*, land-*, push-*  the audit trail /status and tick.mjs read
// Product ledgers are only ever read from here.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openLedger, inspectLedger, ledgerFileFor } from '../../engine/ledger-db.mjs';
import { loadConfig } from '../../engine/config.mjs';

export const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SUPERVISOR_ID = 'main';
export const SUPERVISOR_WF = 'wf-supervisor';
export const SEAT_SCOPE = 'supervisor-seat';
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
});

/** The supervisor home: STARCI_SUPERVISOR_HOME, else ~/.starci/supervisor. */
export const supervisorHome = (env = process.env) => path.resolve(env.STARCI_SUPERVISOR_HOME || path.join(os.homedir(), '.starci', 'supervisor'));
export const supervisorLedgerFile = (env = process.env) => ledgerFileFor(supervisorHome(env));
export const stagingRoot = (env = process.env) => path.join(supervisorHome(env), 'staging');
export const landRoot = (env = process.env) => path.join(supervisorHome(env), 'land');
export const logsRoot = (env = process.env) => path.join(supervisorHome(env), 'logs');

/** Open (creating) the supervisor ledger with its one workflow row, phase running. */
export function openSupervisorLedger({ env = process.env } = {}) {
  const file = supervisorLedgerFile(env);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const ledger = openLedger({ file });
  ledger.transaction(() => {
    ledger.ensureWorkflow({ workflowId: SUPERVISOR_WF, title: 'StarCi runtime supervisor' });
    ledger.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id=? AND phase IS NULL").run(SUPERVISOR_WF);
  });
  return ledger;
}

/** Run `fn(db)` over a read-only handle of the supervisor ledger; `fallback` when it does not exist yet. */
export function withSupervisorRead(fn, fallback = null, { env = process.env } = {}) {
  const file = supervisorLedgerFile(env);
  if (!fs.existsSync(file)) return fallback;
  let handle = null;
  try { handle = inspectLedger({ file }); return fn(handle.db); } catch { return fallback; } finally { try { handle?.close(); } catch { /* closed */ } }
}

/** Run `fn(ledger)` over a write handle, closed afterwards. */
export function withSupervisorLedger(fn, { env = process.env } = {}) {
  const ledger = openSupervisorLedger({ env });
  try { return fn(ledger); } finally { ledger.close(); }
}

const parse = (text, fallback = {}) => { try { return JSON.parse(text ?? '') ?? fallback; } catch { return fallback; } };

/** The seat row: {token, value, at, expiresAt, pid} or null. */
export function seatOf(db, now = Date.now()) {
  const row = db.prepare('SELECT * FROM signals WHERE scope=? AND key=?').get(SEAT_SCOPE, SUPERVISOR_ID);
  if (!row) return null;
  const value = parse(row.value_json);
  const expired = row.expires_at != null && row.expires_at <= now;
  return { token: row.token, value, at: row.at, expiresAt: row.expires_at, pid: row.holder_pid, expired, starting: value.state === 'starting' && !expired };
}

export function enabledOf(db) {
  const row = db.prepare('SELECT value_json FROM signals WHERE scope=? AND key=?').get(ENABLED_SCOPE, SUPERVISOR_ID);
  return row ? parse(row.value_json).enabled === true : null;
}

export function setEnabled(ledger, enabled, { by = 'cli', now = Date.now() } = {}) {
  ledger.transaction(() => {
    ledger.db.prepare('INSERT INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES(?,?,?,?,?,?,NULL) ON CONFLICT(scope,key) DO UPDATE SET value_json=excluded.value_json,at=excluded.at,holder_pid=excluded.holder_pid')
      .run(ENABLED_SCOPE, SUPERVISOR_ID, process.pid, null, JSON.stringify({ enabled, by, at: new Date(now).toISOString() }), now);
    ledger.appendEvent({ workflowId: SUPERVISOR_WF, entityType: 'supervisor', entityId: SUPERVISOR_ID, kind: enabled ? 'supervisor-enabled' : 'supervisor-disabled', payload: { by }, createdAt: now });
  });
}

/** Append one audit event on the supervisor workflow. */
export function supervisorEvent(ledger, { entityType = 'supervisor', entityId = SUPERVISOR_ID, kind, payload = null, now = Date.now() }) {
  return ledger.appendEvent({ workflowId: SUPERVISOR_WF, entityType, entityId, kind, payload, createdAt: now });
}

/** config.yaml supervisor block with defaults: {agent, model, effort, repos, pollIntervalMs, workers, landGate, frozenMinutes}. */
export function supervisorSettings({ config = undefined } = {}) {
  let cfg = config;
  if (cfg === undefined) { try { cfg = loadConfig(); } catch { cfg = null; } }
  const sup = cfg?.supervisor ?? {};
  const kernel = cfg?.kernel ?? {};
  const seat = sup.kernel ?? {};
  const pick = (...values) => values.find((v) => typeof v === 'string' && v.trim())?.trim() ?? null;
  return {
    agent: pick(seat.agent, kernel.agent, 'claude'),
    model: pick(seat.model, seat.agent ? null : kernel.model),
    effort: pick(seat.effort, seat.agent ? null : kernel.effort, cfg?.effort),
    repos: Array.isArray(sup.repos) ? sup.repos : [],
    pollIntervalMs: Number.isInteger(sup.pollIntervalMs) ? sup.pollIntervalMs : 600_000,
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

/** A db-shaped shim that answers wakeKernel's one signal read with `terminal` (stall-alert.mjs wakeKernel). */
export const terminalSignalDb = (terminal) => ({
  prepare: () => ({ get: () => ({ value_json: JSON.stringify({ terminal }) }) }),
});

/** Append one line to a supervisor log file (logs/<name>.log), 5 MB rotated. Never throws. */
export function supervisorLog(name, line, { env = process.env, now = new Date() } = {}) {
  try {
    const file = path.join(logsRoot(env), `${name}.log`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    try { if (fs.statSync(file).size > 5 * 1024 * 1024) fs.renameSync(file, `${file}.1`); } catch { /* new file */ }
    fs.appendFileSync(file, `[${now.toISOString()}] ${line}\n`);
    return file;
  } catch { return null; }
}
