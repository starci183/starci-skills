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
//   starci supervisor start [--json] [--plan] [--reason <text>]
//       enable the seat and launch it unless one is live
//   start-supervisor.mjs --replace [--json]      (internal, the watchdog's call; never enables)
//   start-supervisor.mjs --rotate --reason <handover> [--json]   (internal, the watchdog's call: close the idle live seat and start the standing prompt again; the seat stays enabled)
//   starci supervisor status [--json]
//   starci supervisor stop [--json]         disable, worker-stop + worker-release
//   start-supervisor.mjs --restart [--json]      (internal) stop + start (a contract reload)
//
// The public verbs are status, start (--plan, --reason) and stop; --replace, --rotate and --restart are not CLI flags (the catalog
// refuses them): the watchdog runs this script for them.
// Singleton, three fences:
//   1. a host lock (machine.sqlite host_locks 'supervisor-start'): two launchers never run at once;
//   2. the seat (machine.sqlite seats row 'supervisor', scripts/machine/home.mjs seatOf/writeSeat): a 'starting'
//      reservation with an expiry, then the attested worker (its Dispatch and terminal). A seat whose Dispatch
//      worker-show reports live is never replaced; an Orca that does not answer proves nothing (exit 75, nothing touched);
//   3. dedupe by OWNERSHIP (seat-sessions.mjs): a terminal sup_events records as a seat session that is not the
//      current seat is a duplicate: quit and closed. A terminal merely titled "[Supervisor]" is never touched.
import { seatAgentGone, agentGoneHealth } from './seat-agent-gone.mjs';
import '../api/process/hide-child-windows.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseYaml } from '../../engine/yaml.mjs';
import { openMachine, openMachineReader, pidAlive } from '../../engine/db/machine.mjs';
import { agentOfTerminal } from '../kernel/quit-agent.mjs';
import {
  SKILL_ROOT, SUPERVISOR_ID, STARTUP_RESERVATION_MS,
  readSupervisor, seatOf, writeSeat, clearSeat, enabledOf, setEnabled, supervisorEvent, supervisorSettings, supervisorMode, productRepos, supervisorLog,
  DEFAULT_OWNER_LANGUAGE, SUPERVISOR_SEAT, supervisedSeatHandles,
} from '../machine/home.mjs';
import { openWorkerHandles } from './workers.mjs';
import { recordedSeatTerminals, seatSessions, entryTerminalOf, NO_ENTRY_REMEDY } from '../machine/seat-sessions.mjs';
import { isMain } from '../lib/is-main.mjs';
import { bestEffortCall } from '../agent/best-effort-call.mjs';
import { tierMembers, tierOfSeat } from '../agent/tiers.mjs';
import { planAgentAdmission } from '../agent/admission.mjs';
import { workerClosureProven } from '../machine/worker-close.mjs';

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
  if (Array.isArray(seat.does)) lines.push('You do:\n' + seat.does.map((d) => '  - ' + String(d).trim()).join('\n'));
  if (Array.isArray(seat.never)) lines.push('You never:\n' + seat.never.map((d) => '  - ' + String(d).trim()).join('\n'));
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
      '  ("1 Supervisor; chat only reads/sends to the supervisor"). This prompt is the go.'];
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
 * Tools the Supervisor's own agent may not use. Its in-process subagents (Claude Code's Agent tool) sit outside the menu and the decision
 * log: a judgment is one typed choice of the menu (modules/supervisor/supervisor-prompt.md). worker-start takes no provider argv, so the denial is
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
    release: (dispatch, handle = null) => workerReleaseMod.closeWorker({ dispatch, handle }),
    bindSeat: (handle, provider = supervisorSettings().agent) => guards.bindSeatGuard({ handle, role: 'supervisor', deniedTools: SEAT_DENIED_TOOLS[provider] ?? [] }),
  };
}

/* ------------------------------------------------------------ seat health and dedupe */

// worker-show states that end a worker (start-workflow.mjs MANAGED_DEAD_STATE).
const DEAD_WORKER_STATE = /stop|fail|dead|exit|release|abandon/i;

// A startup timer cannot retire a receipt that crossed the worker-start boundary.
const unsettledStartup = (machine, seat, profile = SUPERVISOR_SEAT) => seat?.value?.state === 'starting' && machine
  ? machine.providerReservations({activeOnly:true}).find(row=>row.role==='supervisor'
    && row.scope?.scopeId===`${profile.id}:attempt:${seat.value.attempt}`
    && ['launching','live','unknown'].includes(row.state)) : null;

/**
 * What the seat's worker proves: {live, dead, hostUnavailable, reason, terminal, dispatch}. Liveness is
 * worker-show on the seat's Dispatch. A terminal without its immutable Dispatch identity remains unverified.
 */
export function seatHealth(seat, deps) {
  if (!seat) return { live: false, dead: true, reason: 'no seat', terminal: null };
  if (seat.value?.state === 'launch-unknown') return { live: false, hostUnavailable: true, reason: 'prior launch effect requires definitive reconciliation',
    terminal: seat.value?.terminal ?? null, dispatch: seat.value?.dispatch ?? null };
  if (seat.starting) return { live: true, starting: true, reason: 'startup reservation active', terminal: null };
  const terminal = seat.value?.terminal ?? null;
  const dispatch = seat.value?.dispatch ?? null;
  if (!dispatch) return healthWithoutDispatch(seat, terminal);
  let shown;
  try { shown = deps.show(dispatch); } catch (e) { shown = { ok: false, error: String(e?.message ?? e) }; }
  const health = shownWorkerHealth(shown, terminal, dispatch);
  const gone = health.live ? seatAgentGone(deps, terminal) : null;
  return gone ? agentGoneHealth(gone, { terminal, dispatch }) : health;
}

function healthWithoutDispatch(seat, terminal) {
  if (!terminal) return { live: false, dead: true, reason: seat.expired ? 'startup reservation expired' : 'seat has no worker', terminal: null };
  return { live: false, unverified: true, reason: 'the terminal has no immutable worker Dispatch identity', terminal };
}

function shownWorkerHealth(shown, terminal, dispatch) {
  if (shown?.hostUnavailable) return { live: false, hostUnavailable: true, reason: shown.error ?? 'worker-show did not answer', terminal, dispatch };
  const state = shown?.state ?? null;
  if (shown?.ok !== true) return { live: false, unverified: true, reason: shown?.error || 'worker-show refusal does not prove worker death', terminal, dispatch };
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

// The existing recorded-session plan owns closure; provider facts come from this exact listed handle.
function closeDuplicates(entries, deps, listing) {
  return entries.map((entry) => {
    let quit = null;
    if (entry.kind === 'agent') { try { quit = deps.quit(entry.handle, agentOfTerminal((listing?.terminals ?? []).find((terminal) => terminal?.handle === entry.handle) ?? entry)); } catch (e) { quit = { error: String(e?.message ?? e) }; } }
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
  const take = () => m.acquireHostLock({ name: START_LOCK, holder: START_LOCK, ttlMs: STARTUP_RESERVATION_MS });
  let got = take();
  if (!got.ok && !pidAlive(got.holder?.holder_pid)) { m.releaseHostLock({ name: START_LOCK, force: true }); got = take(); }
  if (!got.ok) return { ok: false, holder: { pid: got.holder?.holder_pid ?? null } };
  return { ok: true, release: () => { try { m.releaseHostLock({ name: START_LOCK }); } catch { /* expires */ } } };
}

/** The chat-mode refusal: chat mode never starts a seat, not the owner's start, not the watchdog's replace. */
function chatModeRefusal({ env, planOnly, mode }) {
  if (supervisorMode({ env }) !== 'chat') return null;
  return { ok: planOnly || mode === 'replace', exit: planOnly || mode === 'replace' ? 0 : 1, action: 'chat-mode', supervisorMode: 'chat', reason: CHAT_MODE_REASON, wouldLaunch: false };
}

/** The seat as found: `{ result }` ends the launch pass, otherwise `{ enabled, seat, health }`. */
function assessSeat({ m, mode, planOnly, profile, now, d }) {
  let enabled = m ? enabledOf(m, profile) : null;
  if (mode === 'replace' && enabled !== true) return { result: { ok: true, exit: 0, action: 'disabled', reason: 'the seat is disabled (start-supervisor --stop); nothing launched' } };
  const seat = m ? seatOf(m, now(), profile) : null;
  if (mode === 'start' && !planOnly) { setEnabled(m, true, { by: `${profile.eventPrefix}-start`, now: now(), profile }); enabled = true; }
  const unfinished = !seat?.starting && unsettledStartup(m, seat, profile);
  const health = unfinished ? {live:false,unverified:true,reason:'startup reservation expired with an unsettled launch receipt',
    terminal:unfinished.handle ?? null} : seatHealth(seat, d);
  if (health.hostUnavailable) return { result: { ok: false, exit: EXIT_HOST_UNAVAILABLE, action: 'host-unavailable', reason: health.reason } };
  if (health.unverified) return { result: { ok: false, exit: 1, action: 'seat-unverified', reason: health.reason, terminal: health.terminal } };
  return { enabled, seat, health };
}

/** The terminals around the seat: `{ result }` ends the launch pass, otherwise `{ listing, recorded, dedupe }`. */
function surveyTerminals({ m, d, profile, health }) {
  let listing = null;
  try { listing = d.list(); } catch (e) { listing = { ok: false, error: String(e?.message ?? e) }; }
  if (listing?.hostUnavailable) return { result: { ok: false, exit: EXIT_HOST_UNAVAILABLE, action: 'host-unavailable', reason: listing.error ?? 'terminal list did not answer' } };
  const recorded = m ? recordedSeatTerminals(m, { eventPrefix: profile.eventPrefix }) : new Set();
  const marked = listing?.ok ? seatSessions(listing, recorded, d.tabTitles) : [];
  const dedupe = planSupervisorDedupe({ marked, seatTerminal: health.terminal, screenOf: d.screen, exitedRow: d.exitedRow });
  return { listing, recorded, dedupe };
}

/** The launch chain: the members of the seat's tier (tiers.yaml seats.supervisor), each with its provider, model and effort. */
function launchGroup(settings, { seat = 'supervisor' } = {}) {
  const tier = tierOfSeat(seat);
  return tierMembers(tier).map(member => ({ id: member.id, provider: member.provider, model: member.model, pool: member.pool, effort: settings.effort ?? member.effort, tier }));
}

/** The owner's pin of the seat as the bias `only` (config.yaml supervisor.kernel agent/model), or null. */
const seatBias = (settings) => (settings.agent || settings.model
  ? { only: [{ ...(settings.agent ? { provider: settings.agent } : {}), ...(settings.model ? { model: settings.model } : {}) }] } : null);

/** Close the previous seat's worker: `{ closedPrevious, failure }`, the failure set when the closure is unproven. */
function closePreviousSeat(previous, d) {
  const closedPrevious = [];
  if (previous?.dispatch) {
    const stop = bestEffort(() => d.stop(previous.dispatch));
    const release = bestEffort(() => d.release(previous.dispatch, previous.terminal));
    closedPrevious.push({ dispatch: previous.dispatch, stop, release });
    if (!workerClosureProven(release, previous.terminal)) return { closedPrevious, failure: { ok: false, exit: 1, action: 'launch-failed',
      step: 'worker-close', effectState: 'unknown', error: 'the previous Supervisor worker exit is unproven', closedPrevious } };
  } else if (previous?.terminal) return { closedPrevious, failure: { ok: false, exit: 1, action: 'launch-failed', step: 'worker-close',
    effectState: 'unknown', error: 'the previous Supervisor terminal has no worker closure proof' } };
  return { closedPrevious, failure: null };
}

/** Record a failed spawn: the seat row is cleared when nothing took effect, else it keeps the unknown launch. */
function recordSpawnFailure({ m, spawned, token, attempt, profile, settings, now }) {
  m.transaction(() => {
    if (spawned?.effectState === 'none') clearSeat(m, { token, profile });
    else writeSeat(m, { token, value: { state: 'launch-unknown', attempt, terminal: spawned?.terminal ?? null,
      dispatch: spawned?.dispatchId ?? null, runId: spawned?.runId ?? null, admission: spawned?.admission ?? null }, now: now(), profile });
    supervisorEvent(m, { entityId: profile.id, kind: `${profile.eventPrefix}-start-failed`, payload: { step: spawned?.step ?? null, error: spawned?.error ?? null, terminal: spawned?.terminal ?? null,
      dispatch: spawned?.dispatchId ?? null, effectState: spawned?.effectState ?? null, agent: settings.agent }, now: now() });
  });
  return { ok: false, exit: 1, action: 'launch-failed', step: spawned?.step ?? null, error: spawned?.error ?? 'spawn failed', ...(spawned?.detail ? { detail: spawned.detail } : {}), terminal: spawned?.terminal ?? null,
    effectState: spawned?.effectState ?? 'unknown', admission: spawned?.admission ?? null };
}

/** The spawned seat's value, recorded under the reservation `token` with its booted or restarted event; returns the value. */
function recordLaunch({ m, d, spawned, group, settings, token, attempt, previous, reason, profile, now }) {
  const guard = bestEffort(() => d.bindSeat(spawned.terminal, spawned.provider ?? group[0].provider));
  const value = { terminal: spawned.terminal, dispatch: spawned.dispatchId, runId: spawned.runId, taskId: spawned.taskId, agent: spawned.provider ?? group[0].provider,
    model: spawned.admission?.selected?.model ?? spawned.model ?? group[0].model, effort: spawned.effort ?? settings.effort,
    admission: spawned.admission ?? null, startedAt: new Date(now()).toISOString(), attempt, effective: spawned.effective ?? null,
    seatGuard: typeof guard === 'string' ? guard : (guard?.error ?? null) };
  m.transaction(() => {
    writeSeat(m, { token, value, now: now(), profile });
    supervisorEvent(m, { entityId: profile.id, kind: `${profile.eventPrefix}-${previous ? 'restarted' : 'booted'}`, payload: { ...value, previous, reason }, now: now() });
  });
  return value;
}

/** Reserve the seat: a concurrent launcher that got past the lock (a stale lock) still meets this row. */
function reserveSeat({ m, seat, token, attempt, at, profile }) {
  return m.transaction(() => {
    const row = seatOf(m, at, profile);
    if (row && (row.starting || (row.token !== seat?.token))) return false;
    writeSeat(m, { token, value: { state: 'starting', attempt }, expiresAt: at + STARTUP_RESERVATION_MS, now: at, profile });
    return true;
  });
}

/** What `--plan` reports: the admission verdict for the next attempt and whether a launch would follow. */
function planResult({ seat, health, dedupe, group, settings, profile, env, d, enabled }) {
  const admission = planAgentAdmission({ role: 'supervisor', scopeId: `${profile.id}:attempt:${(seat?.value?.attempt ?? 0) + 1}`,
    allowGroup: group, tier: group[0]?.tier ?? null, bias: seatBias(settings), biasTrusted: true, env, io: d.admission });
  return { ok: true, exit: 0, action: 'plan', enabled, seat: seat?.value ?? null, health, dedupe, admission,
    wouldLaunch: !health.live && admission.ok, agent: admission.selected?.provider ?? group[0].provider,
    model: admission.selected?.model ?? group[0].model, effort: settings.effort };
}

/** The launch proper: reserve the seat, spawn the agent, record the outcome. Runs under the start lock. */
async function spawnSeat({ m, d, seat, health, listing, recorded, dedupe, group, settings, template, doc, reason, profile, env, now }) {
  const entry = entryTerminalOf({ env, listing, recorded, owned: new Set([...openWorkerHandles(m), ...supervisedSeatHandles(m)]) });
  if (!entry) return { ok: false, exit: 1, action: 'launch-failed', step: 'run-create', error: NO_ENTRY_REMEDY, effectState: 'none' };

  const token = `${profile.eventPrefix}-${crypto.randomBytes(6).toString('hex')}`;
  const at = now();
  const attempt = (seat?.value?.attempt ?? 0) + 1;
  const previous = seat?.value?.terminal || seat?.value?.dispatch
    ? { terminal: seat.value.terminal ?? null, dispatch: seat.value.dispatch ?? null, reason: health.reason } : null;

  const { closedPrevious, failure } = closePreviousSeat(previous, d);
  if (failure) return failure;

  if (!reserveSeat({ m, seat, token, attempt, at, profile })) return { ok: true, exit: 0, action: 'starting', reason: 'another launcher holds the startup reservation' };

  // Only an affirmatively closed predecessor permits this replacement reservation.
  const closedDuplicates = closeDuplicates(dedupe.close, d, listing);

  const prompt = renderSupervisorPrompt({
    template: template ?? fs.readFileSync(PROMPT_FILE, 'utf8'),
    doc: doc ?? parseYaml(fs.readFileSync(DOCTRINE_FILE, 'utf8')),
    settings, restart: previous ? (reason ?? `the previous Supervisor terminal ${previous.terminal} failed its liveness check (${previous.reason})`) : null,
  });
  const spawned = d.start({ provider: group[0].provider, model: group[0].model, effort: settings.effort, worktree: SKILL_ROOT, title: profile.title, prompt, env,
    role: 'supervisor', scopeId: `${profile.id}:attempt:${attempt}`, allowGroup: group, tier: group[0]?.tier ?? null, bias: seatBias(settings), biasTrusted: true,
    objective: `${profile.title} — ${profile.id}`,
    entry, priorRunId: seat?.value?.runId ?? null,
    request: { seat: profile.id, attempt, token } });
  if (!spawned?.ok) return recordSpawnFailure({ m, spawned, token, attempt, profile, settings, now });
  const value = recordLaunch({ m, d, spawned, group, settings, token, attempt, previous, reason, profile, now });
  return { ok: true, exit: 0, action: previous ? 'restarted' : 'booted', terminal: spawned.terminal, dispatch: spawned.dispatchId, agent: value.agent, model: value.model,
    admission: spawned.admission ?? null,
    attempt, ...(closedDuplicates.length ? { closedDuplicates } : {}), ...(closedPrevious.length ? { closedPrevious } : {}) };
}

/**
 * One launch pass. `mode`: 'start' (the owner's entry: enables the seat), 'replace' (the watchdog: only when
 * enabled). Every host seam is in `deps`. Returns a result object; `exit` is the
 * process exit code it maps to.
 */
export async function launchSupervisor({ mode = 'start', reason = null, plan: planOnly = false, rotate = false,
  env = process.env, deps = null, settings = supervisorSettings(), template = null, doc = null, now = Date.now,
  profile = SUPERVISOR_SEAT } = {}) {
  const refusal = chatModeRefusal({ env, planOnly, mode });
  if (refusal) return refusal;
  const d = deps ?? await orcaDeps();
  // A long-lived writer handle: the spawn below waits for the agent's readiness (no transaction is held meanwhile).
  const m = planOnly ? openMachineReader({ env }) : openMachine({ env });
  const lock = planOnly ? { ok: true, release() {} } : claimStartLock(m);
  if (!lock.ok) { m.close(); return { ok: true, exit: 0, action: 'start-in-progress', holder: lock.holder?.pid ?? null }; }
  try {
    const assessed = assessSeat({ m, mode, planOnly, profile, now, d });
    if (assessed.result) return assessed.result;
    const { enabled, seat, health } = assessed;
    const surveyed = surveyTerminals({ m, d, profile, health });
    if (surveyed.result) return surveyed.result;
    const { listing, recorded, dedupe } = surveyed;
    const group = launchGroup(settings);
    if (planOnly) return planResult({ seat, health, dedupe, group, settings, profile, env, d, enabled });

    if (health.live && !rotate) {
      const closed = closeDuplicates(dedupe.close, d, listing);
      return { ok: true, exit: 0, action: health.starting ? 'starting' : 'already-live', terminal: health.terminal, reason: health.reason, ...(closed.length ? { closedDuplicates: closed } : {}) };
    }
    return await spawnSeat({ m, d, seat, health, listing, recorded, dedupe, group, settings, template, doc, reason, profile, env, now });
  } finally {
    lock.release();
    m?.close();
  }
}

/** Disable the seat, fence and release its worker (worker-stop + worker-release). The watchdog then leaves it down. */
export async function stopSupervisor({ env = process.env, deps = null, now = Date.now, profile = SUPERVISOR_SEAT } = {}) {
  const d = deps ?? await orcaDeps();
  const m = openMachine({ env });
  try {
    setEnabled(m, false, { by: `${profile.eventPrefix}-stop`, now: now(), profile });
    const seat = seatOf(m, now(), profile);
    const terminal = seat?.value?.terminal ?? null;
    const dispatch = seat?.value?.dispatch ?? null;
    let stopped = null, released = null, closed = null;
    if (dispatch) {
      stopped = bestEffort(() => d.stop(dispatch));
      released = bestEffort(() => d.release(dispatch, terminal));
    } else if (terminal) closed = bestEffort(() => d.close(terminal));
    const proven = !seat || (seat.value?.state === 'starting' && !terminal && !dispatch && !unsettledStartup(m, seat, profile))
      || workerClosureProven(released, terminal);
    m.transaction(() => {
      if (proven) clearSeat(m, { profile });
      supervisorEvent(m, { entityId: profile.id, kind: `${profile.eventPrefix}-stopped`, payload: { terminal, dispatch, stopped: stopped?.ok ?? null, released: released?.ok ?? null, closed: closed?.ok ?? null }, now: now() });
    });
    return { ok: proven, action: proven ? 'stopped' : 'stop-unproven', ...(proven ? {} : { effectState: 'unknown' }), terminal, dispatch, stopped: stopped?.ok === true, released: released?.ok === true,
      closed: closed?.ok === true || released?.ok === true };
  } finally { m.close(); }
}


/** The seat's status: {ok, action: 'status', supervisorMode, enabled, seat, health}. */
export async function supervisorStatus() {
  const d = await orcaDeps();
  const { seat, enabled } = readSupervisor((m) => ({ seat: seatOf(m), enabled: enabledOf(m) }), { seat: null, enabled: null });
  return { ok: true, action: 'status', supervisorMode: supervisorMode(), enabled, seat: seat?.value ?? null, health: seatHealth(seat, d) };
}

/* ------------------------------------------------------------ CLI */

const bestEffort = bestEffortCall;

const describe = (r) => {
  if (r.action === 'status') {
    let enabled = 'never started';
    if (r.enabled === false) enabled = 'DISABLED';
    else if (r.enabled) enabled = 'enabled';
    return `[Supervisor] mode ${r.supervisorMode}; ${enabled}; seat ${r.seat?.terminal ?? 'none'} (${r.health?.reason ?? '-'})`;
  }
  const terminal = r.terminal ? ` ${r.terminal}` : '';
  const reason = r.reason ? ` (${r.reason})` : '';
  const error = r.error ? `: ${r.error}` : '';
  return `[Supervisor] ${r.action}${terminal}${reason}${error}`;
};

/** The flags this script takes for the runtime's own callers (the watchdog, the owner's restart) and the CLI refuses with a pointer: modules/cli/commands/supervisor/start.yaml internalFlags. */
export const INTERNAL_FLAGS = Object.freeze(['replace', 'rotate', 'restart']);

async function main() {
  const argv = process.argv.slice(2);
  const has = (n) => argv.includes(`--${n}`);
  const value = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] ?? null : null; };
  const asJson = has('json');
  const out = (r) => { console.log(asJson ? JSON.stringify(r) : describe(r)); process.exitCode = r.exit ?? (r.ok ? 0 : 1); };
  if (has('help')) { console.log(`use: start-supervisor.mjs [--plan] [--reason <t>] | ${INTERNAL_FLAGS.map((name) => '--' + name).join(' | ')} | --status | --stop  [--json]`); return; }
  if (has('status')) return out(await supervisorStatus());
  if (has('stop')) { const r = await stopSupervisor(); supervisorLog('start', describe(r), { data: r }); return out(r); }
  if (has('restart')) {
    const stopped = await stopSupervisor();
    const r = await launchSupervisor({ mode: 'start', reason: value('reason') ?? 'owner restart (start-supervisor --restart)' });
    r.stopped = stopped;
    supervisorLog('start', `restart: ${describe(r)}`, { level: r.ok ? 'info' : 'warn', data: r });
    return out(r);
  }
  const mode = has('replace') || has('rotate') ? 'replace' : 'start';
  const r = await launchSupervisor({ mode, reason: value('reason'), plan: has('plan'), rotate: has('rotate') });
  if (!has('plan')) supervisorLog('start', `${mode}: ${describe(r)}`, { level: r.ok ? 'info' : 'warn', data: r });
  return out(r);
}

if (isMain(import.meta.url)) await main().catch((error) => { console.error(JSON.stringify({ ok: false, error: String(error?.message ?? error) })); process.exitCode = 1; });
