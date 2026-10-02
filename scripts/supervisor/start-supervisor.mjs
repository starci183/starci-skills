#!/usr/bin/env node
// start-supervisor.mjs — the entry point of the ONE [Supervisor] kernel (modules/supervisor/supervise.yaml
// kernelSeat, docs/supervisor.md). It starts the durable "[Supervisor] main" worker in the runtime's own worktree
// through orca orchestration worker-start (scripts/agent/lib.mjs startAgent: a Run coordinated by the launching
// terminal, one Task, the configured agent - config.yaml supervisor.kernel, else the kernel pin) with a prompt built
// from modules/supervisor/supervisor-prompt.md and supervise.yaml. Its Agent/Task denial is a seat guard
// (scripts/guards/hook-install.mjs bindSeatGuard, enforced by the .claude/settings.json PreToolUse hook).
//
// The kernel is OPTIONAL: it runs only in config.yaml supervisor.mode kernel. In chat mode (the default; owner,
// 2026-09-25) the owner's desktop chat is the Supervisor, and start, --replace and --restart launch nothing
// (action 'chat-mode'); --stop and --status still work. The seat's liveness is the reconciler Host controller's
// (concern host.supervisor-seat: scripts/supervisor/supervisor-watchdog.mjs --once).
//
//   node scripts/supervisor/start-supervisor.mjs [--json] [--plan] [--reason <text>]
//       enable the seat and launch it unless one is live
//   node scripts/supervisor/start-supervisor.mjs --replace [--json]      (the watchdog's call; never enables)
//   node scripts/supervisor/start-supervisor.mjs --status [--json]
//   node scripts/supervisor/start-supervisor.mjs --stop [--json]         disable, worker-stop + worker-release
//   node scripts/supervisor/start-supervisor.mjs --restart [--json]      stop + start (a contract reload)
//
// Singleton, three fences:
//   1. a host lock (machine.sqlite host_locks 'supervisor-start'): two launchers never run at once;
//   2. the seat (machine.sqlite seats row 'supervisor', scripts/machine/home.mjs seatOf/writeSeat): a 'starting'
//      reservation with an expiry, then the attested worker (its Dispatch and terminal). A seat whose Dispatch
//      worker-show reports live is never replaced; an Orca that does not answer proves nothing (exit 75, nothing touched);
//   3. dedupe by OWNERSHIP (seat-sessions.mjs): a terminal sup_events records as a seat session that is not the
//      current seat is a duplicate: quit and closed. A terminal merely titled "[Supervisor]" is never touched.
import '../api/process/hide-child-windows.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { openMachine, pidAlive, starciLocalRoot } from '../../engine/db/machine.mjs';
import { agentOfTerminal } from '../kernel/quit-agent.mjs';
import {
  SKILL_ROOT, SUPERVISOR_ID, SUPERVISOR_TITLE, STARTUP_RESERVATION_MS,
  readSupervisor, seatOf, writeSeat, clearSeat, enabledOf, setEnabled, supervisorEvent, supervisorSettings, supervisorMode, productRepos, supervisorLog,
  DEFAULT_OWNER_LANGUAGE,
} from '../machine/home.mjs';
import { openWorkerHandles } from './workers.mjs';
import { recordedSeatTerminals, seatSessions, entryTerminalOf, NO_ENTRY_REMEDY } from './seat-sessions.mjs';
import { isMain } from '../lib/is-main.mjs';
import { bestEffortCall } from '../agent/best-effort-call.mjs';

export const EXIT_HOST_UNAVAILABLE = 75;
const PROMPT_FILE = path.join(SKILL_ROOT, 'modules', 'supervisor', 'supervisor-prompt.md');
const DOCTRINE_FILE = path.join(SKILL_ROOT, 'modules', 'supervisor', 'supervise.yaml');

/* ------------------------------------------------------------ prompt */

const indent = (text, pad = '  ') => String(text ?? '').trim().split(/\r?\n/).map((l) => `${pad}${l}`).join('\n');

/** The doctrine block the prompt carries, read from supervise.yaml kernelSeat + guardrails (ids and rules). */
export function doctrineOf(doc) {
  const seat = doc?.kernelSeat ?? {};
  const lines = [];
  if (seat.role) lines.push(`Role:\n${indent(seat.role)}`);
  if (Array.isArray(seat.does)) lines.push(`You do:\n${seat.does.map((d) => `  - ${String(d).trim()}`).join('\n')}`);
  if (Array.isArray(seat.never)) lines.push(`You never:\n${seat.never.map((d) => `  - ${String(d).trim()}`).join('\n')}`);
  const steps = (doc?.loop?.perCycle ?? []).map((s) => s?.step).filter(Boolean);
  if (steps.length) lines.push(`Tick steps (supervise.yaml loop.perCycle): ${steps.join(' -> ')}`);
  const rails = (doc?.guardrails ?? []).filter((g) => g?.id);
  if (rails.length) lines.push(`Guardrails (read each in supervise.yaml): ${rails.map((g) => g.id).join(', ')}`);
  return lines.join('\n\n');
}

export function launchAuthorityText({ restart = null } = {}) {
  const head = restart
    ? [`LAUNCH AUTHORITY - REPLACEMENT [Supervisor]: ${restart}.`,
      '  Nothing about your mandate changed. Re-register the channel, read the inbox, run one tick and continue.']
    : ['LAUNCH AUTHORITY - the owner approved the single [Supervisor] kernel design on 2026-09-24',
      '  ("1 Supervisor, many Workers spawned on demand; chat only reads/sends to the supervisor"). This prompt is the go.'];
  return [...head,
    '  Watchdog wakes are the runtime cadence, not owner messages: act on each. Never ask the owner for a go to start',
    '  or continue (owner rule: the owner never approves launch gates).'].join('\n');
}

function renderSupervisorPrompt({ template, doc, settings, restart = null, skillRoot = SKILL_ROOT }) {
  return template
    .replaceAll('{launchAuthority}', launchAuthorityText({ restart }))
    .replaceAll('{doctrine}', doctrineOf(doc))
    .replaceAll('{skillRoot}', skillRoot)
    .replaceAll('{ownerLanguage}', settings.language ?? DEFAULT_OWNER_LANGUAGE)
    .replaceAll('{repos}', productRepos(settings).join(', ') || '(none listed)')
    .replaceAll('{supervisorId}', SUPERVISOR_ID)
    .replaceAll('{pollMinutes}', String(Math.round(settings.pollIntervalMs / 60_000)));
}

/* ------------------------------------------------------------ the seat's denied tools */

/**
 * Tools the Supervisor's own agent may not use. Its in-process subagents (Claude Code's Agent tool, formerly
 * Task) bypass the design - [Worker]s across four providers, leases, staging, the land gate and /status all
 * see nothing of them (2026-09-24: four "general-purpose" subagents diagnosed clusters). Diagnosis is a
 * [Worker] job too (modules/supervisor/supervisor-prompt.md). worker-start takes no provider argv, so the denial is
 * a seat guard bound to the seat's terminal (bindSeatGuard) that the project PreToolUse hook enforces.
 */
export const SEAT_DENIED_TOOLS = Object.freeze({ claude: Object.freeze(['Agent', 'Task']) });

/* ------------------------------------------------------------ Orca seams (lazy: specs inject them) */

async function orcaDeps() {
  const [{ terminalList }, { terminalRead }, liveness, closeMod, quitMod, agentLib, dedupe, workerMod, workerStopMod, workerReleaseMod, guards] = await Promise.all([
    import('../api/orca/terminal-list.mjs'), import('../api/orca/terminal-read.mjs'),
    import('../lib/terminal-liveness.mjs'), import('../kernel/close-op-terminal.mjs'), import('../kernel/quit-agent.mjs'),
    import('../agent/lib.mjs'), import('../kernel/terminal-dedupe.mjs'), import('../api/orca/worker-show.mjs'),
    import('../api/orca/worker-stop.mjs'), import('../machine/worker-close.mjs'), import('../guards/hook-install.mjs')]);
  return {
    list: () => terminalList({ includeVisualLayouts: true }),
    tabTitles: dedupe.tabTitlesOf,
    screen: (handle) => { try { const r = terminalRead({ terminal: handle, screen: true }); return r?.ok ? String(r.screen ?? '') : null; } catch { return null; } },
    exitedRow: liveness.exitedAgentPromptRow,
    close: (handle) => closeMod.closeOperationTerminal(handle),
    quit: (handle, agent) => quitMod.quitAgent({ handle, agent }),
    start: (opts) => agentLib.startAgent(opts),
    show: (dispatch) => workerMod.workerShow({ dispatch }),
    stop: (dispatch) => workerStopMod.workerStop({ dispatch }),
    release: (dispatch) => workerReleaseMod.closeWorker({ dispatch }),
    bindSeat: (handle) => guards.bindSeatGuard({ handle, role: 'supervisor', deniedTools: SEAT_DENIED_TOOLS[supervisorSettings().agent] ?? [] }),
  };
}

/* ------------------------------------------------------------ seat health and dedupe */

// worker-show states that end a worker (start-workflow.mjs MANAGED_DEAD_STATE).
const DEAD_WORKER_STATE = /stop|fail|dead|exit|release|abandon/i;

/**
 * What the seat's worker proves: {live, dead, hostUnavailable, reason, terminal, dispatch}. Liveness is
 * worker-show on the seat's Dispatch. A seat with a terminal and no Dispatch is not a worker-start worker: dead,
 * replaced by the next launch.
 */
export function seatHealth(seat, deps) {
  if (!seat) return { live: false, dead: true, reason: 'no seat', terminal: null };
  if (seat.starting) return { live: true, starting: true, reason: 'startup reservation active', terminal: null };
  const terminal = seat.value?.terminal ?? null;
  const dispatch = seat.value?.dispatch ?? null;
  if (!dispatch) {
    if (!terminal) return { live: false, dead: true, reason: seat.expired ? 'startup reservation expired' : 'seat has no worker', terminal: null };
    return { live: false, dead: true, reason: 'seat has no worker', terminal };
  }
  let shown;
  try { shown = deps.show(dispatch); } catch (e) { shown = { ok: false, error: String(e?.message ?? e) }; }
  if (shown?.hostUnavailable) return { live: false, hostUnavailable: true, reason: shown.error ?? 'worker-show did not answer', terminal, dispatch };
  const state = shown?.state ?? null;
  if (shown?.ok === true && !(state && DEAD_WORKER_STATE.test(state))) return { live: true, reason: `worker ${state ?? 'ready'}`, terminal, dispatch };
  return { live: false, dead: true, reason: shown?.ok ? `worker ${state}` : (shown?.error || 'worker-show refused'), terminal, dispatch };
}

/**
 * The dedupe plan: the seat terminal is kept; every other recorded seat session is closed - a terminal is never adopted
 * as the seat (every seat is a worker-start worker). `screenOf(handle)` reads a frame (null = unreadable: kept).
 * Returns {close: [entry], keep: [entry]}.
 */
export function planSupervisorDedupe({ marked, seatTerminal = null, screenOf, exitedRow }) {
  const plan = { close: [], keep: [] };
  for (const t of marked) {
    if (t.handle === seatTerminal) { plan.keep.push({ ...t, reason: 'seat' }); continue; }
    const screen = screenOf(t.handle);
    if (screen == null) { plan.keep.push({ ...t, reason: 'unreadable' }); continue; }
    const shell = exitedRow(screen);
    if (shell) { plan.close.push({ ...t, kind: 'shell', reason: 'bare-shell' }); continue; }
    plan.close.push({ ...t, kind: 'agent', reason: 'duplicate-session' });
  }
  return plan;
}

function closeDuplicates(entries, deps, fallbackAgent) {
  return entries.map((entry) => {
    let quit = null;
    if (entry.kind === 'agent') { try { quit = deps.quit(entry.handle, agentOfTerminal(entry, fallbackAgent)); } catch (e) { quit = { error: String(e?.message ?? e) }; } }
    let closed;
    try { closed = deps.close(entry.handle); } catch (e) { closed = { ok: false, error: String(e?.message ?? e) }; }
    return { handle: entry.handle, kind: entry.kind, reason: entry.reason, ok: closed?.ok === true || quit?.exited === true, ...(closed?.ok ? {} : { error: String(closed?.error ?? 'close refused') }) };
  });
}

/* ------------------------------------------------------------ the launch */

/** Why no [Supervisor] kernel starts in chat mode (config.yaml supervisor.mode). */
export const CHAT_MODE_REASON = "config.yaml supervisor.mode is chat: the owner's desktop chat is the Supervisor; no [Supervisor] kernel is started (set supervisor.mode: kernel to run one)";

const START_LOCK = 'supervisor-start';
/**
 * The launcher lock (host_locks 'supervisor-start', TTL the startup reservation): {ok, release} or {ok:false, holder}.
 * A holder whose process is gone never blocks the next launcher.
 */
function claimStartLock(m) {
  const take = () => m.acquireHostLock({ name: START_LOCK, holder: 'start-supervisor', ttlMs: STARTUP_RESERVATION_MS });
  let got = take();
  if (!got.ok && !pidAlive(got.holder?.holder_pid)) { m.releaseHostLock({ name: START_LOCK, force: true }); got = take(); }
  if (!got.ok) return { ok: false, holder: { pid: got.holder?.holder_pid ?? null } };
  return { ok: true, release: () => { try { m.releaseHostLock({ name: START_LOCK }); } catch { /* expires */ } } };
}

/**
 * One launch pass. `mode`: 'start' (the owner's entry: enables the seat), 'replace' (the watchdog: only when
 * enabled). Every host seam is in `deps`. Returns a result object; `exit` is the
 * process exit code it maps to.
 */
export async function launchSupervisor({ mode = 'start', reason = null, plan: planOnly = false,
  env = process.env, deps = null, settings = supervisorSettings(), template = null, doc = null, now = Date.now } = {}) {
  // Chat mode never starts a seat: not the owner's start, not the watchdog's replace.
  if (supervisorMode({ env }) === 'chat') {
    return { ok: planOnly || mode === 'replace', exit: planOnly || mode === 'replace' ? 0 : 1, action: 'chat-mode', supervisorMode: 'chat', reason: CHAT_MODE_REASON, wouldLaunch: false };
  }
  const d = deps ?? await orcaDeps();
  // A long-lived writer handle: the spawn below waits for the agent's readiness (no transaction is held meanwhile).
  const m = openMachine({ env });
  const lock = planOnly ? { ok: true, release() {} } : claimStartLock(m);
  if (!lock.ok) { m.close(); return { ok: true, exit: 0, action: 'start-in-progress', holder: lock.holder?.pid ?? null }; }
  try {
    if (mode === 'start' && !planOnly) setEnabled(m, true, { by: 'start-supervisor', now: now() });
    const enabled = enabledOf(m);
    if (mode === 'replace' && enabled !== true) return { ok: true, exit: 0, action: 'disabled', reason: 'the seat is disabled (start-supervisor --stop); nothing launched' };
    const seat = seatOf(m, now());
    const health = seatHealth(seat, d, now());
    if (health.hostUnavailable) return { ok: false, exit: EXIT_HOST_UNAVAILABLE, action: 'host-unavailable', reason: health.reason };
    if (health.unverified) return { ok: false, exit: 1, action: 'seat-unverified', reason: health.reason, terminal: health.terminal };

    let listing = null;
    try { listing = d.list(); } catch (e) { listing = { ok: false, error: String(e?.message ?? e) }; }
    if (listing?.hostUnavailable) return { ok: false, exit: EXIT_HOST_UNAVAILABLE, action: 'host-unavailable', reason: listing.error ?? 'terminal list did not answer' };
    const recorded = recordedSeatTerminals(m);
    const marked = listing?.ok ? seatSessions(listing, recorded, d.tabTitles) : [];
    const dedupe = planSupervisorDedupe({ marked, seatTerminal: health.terminal, screenOf: d.screen, exitedRow: d.exitedRow });

    if (planOnly) return { ok: true, exit: 0, action: 'plan', enabled, seat: seat?.value ?? null, health, dedupe,
      wouldLaunch: !health.live, agent: settings.agent, model: settings.model, effort: settings.effort };

    if (health.live) {
      const closed = closeDuplicates(dedupe.close, d, settings.agent);
      return { ok: true, exit: 0, action: health.starting ? 'starting' : 'already-live', terminal: health.terminal, reason: health.reason, ...(closed.length ? { closedDuplicates: closed } : {}) };
    }

    const entry = entryTerminalOf({ env, listing, recorded, owned: openWorkerHandles(m) });
    if (!entry) return { ok: false, exit: 1, action: 'launch-failed', step: 'run-create', error: NO_ENTRY_REMEDY, effectState: 'none' };

    const token = `supervisor-${crypto.randomBytes(6).toString('hex')}`;
    const at = now();
    const attempt = (seat?.value?.attempt ?? 0) + 1;
    const previous = seat?.value?.terminal || seat?.value?.dispatch
      ? { terminal: seat.value.terminal ?? null, dispatch: seat.value.dispatch ?? null, reason: health.reason } : null;

    // Reserve the seat: a concurrent launcher that got past the lock (a stale lock) still meets this row.
    const reserved = m.transaction(() => {
      const row = seatOf(m, at);
      if (row && (row.starting || (row.token !== seat?.token))) return false;
      writeSeat(m, { token, value: { state: 'starting', attempt }, expiresAt: at + STARTUP_RESERVATION_MS, now: at });
      return true;
    });
    if (!reserved) return { ok: true, exit: 0, action: 'starting', reason: 'another launcher holds the startup reservation' };

    // The previous seat: its Dispatch is fenced and released; a seat with only a terminal has that terminal closed.
    const closedPrevious = [];
    if (previous?.dispatch) closedPrevious.push({ dispatch: previous.dispatch, stop: bestEffort(() => d.stop(previous.dispatch)), release: bestEffort(() => d.release(previous.dispatch)) });
    else if (previous?.terminal) closedPrevious.push({ handle: previous.terminal, ...(bestEffort(() => d.close(previous.terminal)) ?? {}) });
    const closedDuplicates = closeDuplicates(dedupe.close, d, settings.agent);

    const prompt = renderSupervisorPrompt({
      template: template ?? fs.readFileSync(PROMPT_FILE, 'utf8'),
      doc: doc ?? parseYaml(fs.readFileSync(DOCTRINE_FILE, 'utf8')),
      settings, restart: previous ? (reason ?? `the previous Supervisor terminal ${previous.terminal} failed its liveness check (${previous.reason})`) : null,
    });
    const spawned = d.start({ provider: settings.agent, model: settings.model, effort: settings.effort, worktree: SKILL_ROOT, title: SUPERVISOR_TITLE, prompt,
      specFile: path.join(starciLocalRoot(), 'supervisor', `prompt.a${attempt}.md`), objective: `${SUPERVISOR_TITLE} — ${SUPERVISOR_ID}`,
      entry, priorRunId: seat?.value?.runId ?? null,
      request: { seat: SUPERVISOR_ID, attempt, token } });
    if (!spawned?.ok) {
      m.transaction(() => {
        clearSeat(m, { token });
        supervisorEvent(m, { kind: 'supervisor-start-failed', payload: { step: spawned?.step ?? null, error: spawned?.error ?? null, terminal: spawned?.terminal ?? null,
          dispatch: spawned?.dispatchId ?? null, effectState: spawned?.effectState ?? null, agent: settings.agent }, now: now() });
      });
      return { ok: false, exit: 1, action: 'launch-failed', step: spawned?.step ?? null, error: spawned?.error ?? 'spawn failed', terminal: spawned?.terminal ?? null };
    }
    const guard = bestEffort(() => d.bindSeat(spawned.terminal));
    const value = { terminal: spawned.terminal, dispatch: spawned.dispatchId, runId: spawned.runId, taskId: spawned.taskId, agent: settings.agent,
      model: settings.model, effort: settings.effort, startedAt: new Date(now()).toISOString(), attempt, effective: spawned.effective ?? null,
      seatGuard: typeof guard === 'string' ? guard : (guard?.error ?? null) };
    m.transaction(() => {
      writeSeat(m, { token, value, now: now() });
      supervisorEvent(m, { kind: previous ? 'supervisor-restarted' : 'supervisor-booted', payload: { ...value, previous, reason }, now: now() });
    });
    return { ok: true, exit: 0, action: previous ? 'restarted' : 'booted', terminal: spawned.terminal, dispatch: spawned.dispatchId, agent: settings.agent, model: settings.model,
      attempt, ...(closedDuplicates.length ? { closedDuplicates } : {}), ...(closedPrevious.length ? { closedPrevious } : {}) };
  } finally {
    lock.release();
    m.close();
  }
}

/** Disable the seat, fence and release its worker (worker-stop + worker-release). The watchdog then leaves it down. */
export async function stopSupervisor({ env = process.env, deps = null, now = Date.now } = {}) {
  const d = deps ?? await orcaDeps();
  const m = openMachine({ env });
  try {
    setEnabled(m, false, { by: 'start-supervisor --stop', now: now() });
    const seat = seatOf(m, now());
    const terminal = seat?.value?.terminal ?? null;
    const dispatch = seat?.value?.dispatch ?? null;
    let stopped = null, released = null, closed = null;
    if (dispatch) {
      stopped = bestEffort(() => d.stop(dispatch));
      released = bestEffort(() => d.release(dispatch));
    } else if (terminal) closed = bestEffort(() => d.close(terminal));
    m.transaction(() => {
      clearSeat(m);
      supervisorEvent(m, { kind: 'supervisor-stopped', payload: { terminal, dispatch, stopped: stopped?.ok ?? null, released: released?.ok ?? null, closed: closed?.ok ?? null }, now: now() });
    });
    return { ok: true, action: 'stopped', terminal, dispatch, stopped: stopped?.ok === true, released: released?.ok === true,
      closed: closed?.ok === true || released?.ok === true };
  } finally { m.close(); }
}


/* ------------------------------------------------------------ CLI */

const bestEffort = bestEffortCall;

const describe = (r) => {
  if (r.action === 'status') return `[Supervisor] mode ${r.supervisorMode}; ${r.enabled === false ? 'DISABLED' : r.enabled ? 'enabled' : 'never started'}; seat ${r.seat?.terminal ?? 'none'} (${r.health?.reason ?? '-'})`;
  return `[Supervisor] ${r.action}${r.terminal ? ` ${r.terminal}` : ''}${r.reason ? ` (${r.reason})` : ''}${r.error ? `: ${r.error}` : ''}`;
};

async function main() {
  const argv = process.argv.slice(2);
  const has = (n) => argv.includes(`--${n}`);
  const value = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] ?? null : null; };
  const asJson = has('json');
  const out = (r) => { console.log(asJson ? JSON.stringify(r) : describe(r)); process.exitCode = r.exit ?? (r.ok ? 0 : 1); };
  if (has('help')) { console.log('use: start-supervisor.mjs [--plan] [--reason <t>] | --replace | --status | --stop | --restart  [--json]'); return; }
  if (has('status')) {
    const d = await orcaDeps();
    const { seat, enabled } = readSupervisor((m) => ({ seat: seatOf(m), enabled: enabledOf(m) }), { seat: null, enabled: null });
    return out({ ok: true, action: 'status', supervisorMode: supervisorMode(), enabled, seat: seat?.value ?? null, health: seatHealth(seat, d) });
  }
  if (has('stop')) { const r = await stopSupervisor(); supervisorLog('start', describe(r), { data: r }); return out(r); }
  if (has('restart')) {
    const stopped = await stopSupervisor();
    const r = await launchSupervisor({ mode: 'start', reason: value('reason') ?? 'owner restart (start-supervisor --restart)' });
    r.stopped = stopped;
    supervisorLog('start', `restart: ${describe(r)}`, { level: r.ok ? 'info' : 'warn', data: r });
    return out(r);
  }
  const mode = has('replace') ? 'replace' : 'start';
  const r = await launchSupervisor({ mode, reason: value('reason'), plan: has('plan') });
  if (!has('plan')) supervisorLog('start', `${mode}: ${describe(r)}`, { level: r.ok ? 'info' : 'warn', data: r });
  return out(r);
}

if (isMain(import.meta.url)) main();
