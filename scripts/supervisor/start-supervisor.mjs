#!/usr/bin/env node
// start-supervisor.mjs — the entry point of the ONE [Supervisor] kernel (modules/supervisor/supervise.yaml
// kernelSeat, docs/supervisor.md). It launches a durable Orca terminal titled "[Supervisor] main" in the
// runtime's own worktree, running the configured agent (config.yaml supervisor.kernel, else the kernel pin)
// with a prompt built from modules/supervisor/supervisor-prompt.md and supervise.yaml.
//
// The kernel is OPTIONAL: it runs only in config.yaml supervisor.mode kernel. In chat mode (the default; owner,
// 2026-09-25) the owner's desktop chat is the Supervisor, and start, --replace, --adopt, --restart, the watchdog
// and resume-all's ensureSupervisor launch nothing (action 'chat-mode'); --stop and --status still work.
//
//   node scripts/supervisor/start-supervisor.mjs [--json] [--plan] [--no-watchdog] [--reason <text>]
//       enable the seat, launch it unless one is live, and make sure its watchdog loop runs
//   node scripts/supervisor/start-supervisor.mjs --replace [--json]      (the watchdog's call; never enables)
//   node scripts/supervisor/start-supervisor.mjs --adopt <terminal> [--json]
//   node scripts/supervisor/start-supervisor.mjs --status [--json]
//   node scripts/supervisor/start-supervisor.mjs --stop [--json]         disable, quit the agent, close the tab
//   node scripts/supervisor/start-supervisor.mjs --restart [--json]      stop + start (a contract reload)
//
// Singleton, three fences:
//   1. a host lock (connectors claimManager 'supervisor-start'): two launchers never run at once;
//   2. the seat signal in the supervisor ledger (scripts/supervisor/home.mjs): a 'starting' reservation with
//      an expiry, then the attested terminal. A seat whose terminal a responding Orca calls live is never
//      replaced; an Orca that does not answer proves nothing (exit 75, nothing touched);
//   3. dedupe: every other terminal whose tab or pane title carries "[Supervisor]" is a duplicate (a [Worker]
//      tab or a terminal an open worker job owns never is). With no
//      live seat, a live agent session among them is ADOPTED instead of launching a second; every other
//      one (bare shells, extra sessions) is quit and closed.
import '../lib/hide-child-windows.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { claimManager, lockHolder } from '../connectors/lib.mjs';
import { agentOfTerminal } from '../kernel/quit-agent.mjs';
import {
  SKILL_ROOT, SUPERVISOR_ID, SEAT_SCOPE, SUPERVISOR_TITLE, SUPERVISOR_MARKER, WORKER_MARKER, STARTUP_RESERVATION_MS,
  openSupervisorLedger, withSupervisorRead, seatOf, enabledOf, setEnabled, supervisorEvent, supervisorSettings, supervisorMode, productRepos, supervisorLog, logsRoot,
} from './home.mjs';
import { openWorkerHandles } from './workers.mjs';

const selfFile = fileURLToPath(import.meta.url);
export const WATCHDOG_FILE = path.join(SKILL_ROOT, 'scripts', 'supervisor', 'watchdog.mjs');
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

export function renderSupervisorPrompt({ template, doc, settings, restart = null, skillRoot = SKILL_ROOT }) {
  return template
    .replaceAll('{launchAuthority}', launchAuthorityText({ restart }))
    .replaceAll('{doctrine}', doctrineOf(doc))
    .replaceAll('{skillRoot}', skillRoot)
    .replaceAll('{ownerLanguage}', settings.language ?? 'en')
    .replaceAll('{repos}', productRepos(settings).join(', ') || '(none listed)')
    .replaceAll('{supervisorId}', SUPERVISOR_ID)
    .replaceAll('{pollMinutes}', String(Math.round(settings.pollIntervalMs / 60_000)));
}

/* ------------------------------------------------------------ the seat's command */

/**
 * Tools the Supervisor's own agent may not use. Its in-process subagents (Claude Code's Agent tool, formerly
 * Task) bypass the design - [Worker]s across four providers, leases, staging, the land gate and /status all
 * see nothing of them (2026-09-24: four "general-purpose" subagents diagnosed clusters). Diagnosis is a
 * [Worker] job too (modules/supervisor/supervisor-prompt.md).
 */
export const SEAT_DENIED_TOOLS = Object.freeze({ claude: Object.freeze(['Agent', 'Task']) });
export const SEAT_DENY_FLAG = Object.freeze({ claude: '--disallowedTools' });

/**
 * The seat's launch command body for adapter card `card` (terminalFallback command + model/effort args) plus the
 * denied tools, or null when the agent has no denial to add (the card's own command is used then).
 */
export function seatCommand({ agent, model = null, effort = null, card }) {
  const denied = SEAT_DENIED_TOOLS[agent];
  const tf = card?.terminalFallback;
  if (!denied?.length || typeof tf?.command !== 'string') return null;
  const render = (args) => (Array.isArray(args) ? args.map((a) => String(a).replaceAll('<model>', model ?? '').replaceAll('<effort>', effort ?? '')) : []);
  return [tf.command.trim(), ...(model ? render(tf.modelArgs) : []), ...(effort ? render(tf.effortArgs) : []),
    SEAT_DENY_FLAG[agent], `'${denied.join(',')}'`].join(' ');
}

/* ------------------------------------------------------------ Orca seams (lazy: specs inject them) */

async function orcaDeps() {
  const [{ terminalList }, { terminalRead }, host, liveness, closeMod, quitMod, agentLib, dedupe] = await Promise.all([
    import('../api/orca/terminal-list.mjs'), import('../api/orca/terminal-read.mjs'), import('../kernel/host-outage.mjs'),
    import('../kernel/terminal-liveness.mjs'), import('../kernel/close-op-terminal.mjs'), import('../kernel/quit-agent.mjs'),
    import('../agent/lib.mjs'), import('../kernel/terminal-dedupe.mjs')]);
  return {
    list: () => terminalList({ includeVisualLayouts: true }),
    tabTitles: dedupe.tabTitlesOf,
    verdict: (handle) => host.kernelTerminalVerdict(handle),
    screen: (handle) => { try { const r = terminalRead({ terminal: handle, screen: true }); return r?.ok ? String(r.screen ?? '') : null; } catch { return null; } },
    exitedRow: liveness.exitedAgentPromptRow,
    classify: (screen) => liveness.classifyAgentScreen(screen).state,
    close: (handle) => closeMod.closeOperationTerminal(handle),
    quit: (handle, agent) => quitMod.quitAgent({ handle, agent }),
    spawn: (opts) => agentLib.spawnAgent(opts),
    card: (agent) => agentLib.loadAdapter(agent).card ?? null,
  };
}

/* ------------------------------------------------------------ seat health and dedupe */

/**
 * What the seat's terminal proves: {live, dead, hostUnavailable, unverified, agentExited, reason, terminal}.
 * A live terminal whose frame ends in a bare shell prompt is an exited agent: dead.
 */
export function seatHealth(seat, deps, now = Date.now()) {
  if (!seat) return { live: false, dead: true, reason: 'no seat', terminal: null };
  if (seat.starting) return { live: true, starting: true, reason: 'startup reservation active', terminal: null };
  const terminal = seat.value?.terminal ?? null;
  if (!terminal) return { live: false, dead: true, reason: seat.expired ? 'startup reservation expired' : 'seat has no terminal', terminal: null };
  const v = deps.verdict(terminal);
  if (v.verdict === 'host-unavailable') return { live: false, hostUnavailable: true, reason: v.reason, terminal };
  if (v.verdict === 'unverified') return { live: false, unverified: true, reason: v.reason, terminal };
  if (v.verdict !== 'live') return { live: false, dead: true, gone: v.verdict === 'gone', reason: v.reason, terminal };
  const screen = deps.screen(terminal);
  const exited = screen == null ? null : deps.exitedRow(screen);
  if (exited) return { live: false, dead: true, agentExited: true, shellPrompt: exited, reason: `agent exited to the shell prompt '${exited}'`, terminal };
  return { live: true, reason: 'terminal connected', terminal };
}

/**
 * Every Orca terminal carrying the [Supervisor] marker (tab or pane title): [{handle, tabTitle, paneTitle, agent, connected}].
 * A [Worker] is never one: its tab title says [Worker], and a terminal an open job owns (`owned`, workers.mjs
 * openWorkerHandles) is excluded whatever its agent wrote into the pane title. Workers sit in the same Orca
 * project as the seat, and a pane title that mentions the Supervisor must not get a live worker closed.
 */
export function supervisorTerminals(listing, tabTitlesOf = () => new Map(), { owned = new Set() } = {}) {
  const terminals = listing?.terminals ?? [];
  const tabs = tabTitlesOf(listing?.visualLayouts ?? [], terminals);
  return terminals.filter((t) => t?.handle && t.connected !== false)
    .map((t) => ({ handle: t.handle, tabTitle: tabs.get(t.handle) ?? null, paneTitle: t.title ?? null, agent: t.agentIdentity ?? null, worktreePath: t.worktreePath ?? null }))
    .filter((t) => !owned.has(t.handle) && !WORKER_MARKER.test(t.tabTitle ?? ''))
    .filter((t) => SUPERVISOR_MARKER.test(`${t.tabTitle ?? ''} ${t.paneTitle ?? ''}`));
}

/**
 * The dedupe plan: the seat terminal is kept; with no live seat, the first live agent session is adopted;
 * every other marked terminal is closed. `screenOf(handle)` reads a frame (null = unreadable: kept).
 * Returns {adopt: entry|null, close: [entry], keep: [entry]}.
 */
export function planSupervisorDedupe({ marked, seatTerminal = null, seatLive = false, screenOf, exitedRow }) {
  const plan = { adopt: null, close: [], keep: [] };
  for (const t of marked) {
    if (t.handle === seatTerminal) { plan.keep.push({ ...t, reason: 'seat' }); continue; }
    const screen = screenOf(t.handle);
    if (screen == null) { plan.keep.push({ ...t, reason: 'unreadable' }); continue; }
    const shell = exitedRow(screen);
    if (shell) { plan.close.push({ ...t, kind: 'shell', reason: 'bare-shell' }); continue; }
    if (!seatLive && !plan.adopt) { plan.adopt = { ...t, reason: 'live-unbound-session' }; continue; }
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

const writeSeat = (ledger, { token, value, expiresAt = null, now = Date.now() }) => {
  ledger.db.prepare('DELETE FROM signals WHERE scope=? AND key=?').run(SEAT_SCOPE, SUPERVISOR_ID);
  ledger.db.prepare('INSERT INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES(?,?,?,?,?,?,?)')
    .run(SEAT_SCOPE, SUPERVISOR_ID, process.pid, token, JSON.stringify(value), now, expiresAt);
};

/**
 * One launch pass. `mode`: 'start' (the owner's entry: enables the seat), 'replace' (the watchdog: only when
 * enabled), 'adopt' (bind `adoptHandle`). Every host seam is in `deps`. Returns a result object; `exit` is the
 * process exit code it maps to.
 */
export async function launchSupervisor({ mode = 'start', adoptHandle = null, reason = null, plan: planOnly = false,
  env = process.env, deps = null, settings = supervisorSettings(), template = null, doc = null, now = Date.now } = {}) {
  // Chat mode never starts a seat: not the owner's start, not the watchdog's replace, not an adopt.
  if (supervisorMode({ env }) === 'chat') {
    return { ok: planOnly || mode === 'replace', exit: planOnly || mode === 'replace' ? 0 : 1, action: 'chat-mode', supervisorMode: 'chat', reason: CHAT_MODE_REASON, wouldLaunch: false };
  }
  const d = deps ?? await orcaDeps();
  const lock = planOnly ? { ok: true, release() {} } : claimManager('supervisor-start', { env });
  if (!lock.ok) return { ok: true, exit: 0, action: 'start-in-progress', holder: lock.holder?.pid ?? null };
  const ledger = openSupervisorLedger({ env });
  try {
    if (mode === 'start' && !planOnly) setEnabled(ledger, true, { by: 'start-supervisor', now: now() });
    const enabled = enabledOf(ledger.db);
    if (mode === 'replace' && enabled !== true) return { ok: true, exit: 0, action: 'disabled', reason: 'the seat is disabled (start-supervisor --stop); nothing launched' };
    const seat = seatOf(ledger.db, now());
    const health = seatHealth(seat, d, now());
    if (health.hostUnavailable) return { ok: false, exit: EXIT_HOST_UNAVAILABLE, action: 'host-unavailable', reason: health.reason };
    if (health.unverified) return { ok: false, exit: 1, action: 'seat-unverified', reason: health.reason, terminal: health.terminal };

    let listing = null;
    try { listing = d.list(); } catch (e) { listing = { ok: false, error: String(e?.message ?? e) }; }
    if (listing?.hostUnavailable) return { ok: false, exit: EXIT_HOST_UNAVAILABLE, action: 'host-unavailable', reason: listing.error ?? 'terminal list did not answer' };
    const marked = listing?.ok ? supervisorTerminals(listing, d.tabTitles, { owned: openWorkerHandles(ledger.db) }) : [];
    const dedupe = planSupervisorDedupe({ marked, seatTerminal: health.terminal, seatLive: health.live, screenOf: d.screen, exitedRow: d.exitedRow });
    if (adoptHandle) {
      const target = marked.find((t) => t.handle === adoptHandle) ?? { handle: adoptHandle };
      dedupe.adopt = health.live ? null : { ...target, reason: 'requested' };
      dedupe.close = dedupe.close.filter((t) => t.handle !== adoptHandle);
    }

    if (planOnly) return { ok: true, exit: 0, action: 'plan', enabled, seat: seat?.value ?? null, health, dedupe,
      wouldLaunch: !health.live && !dedupe.adopt, agent: settings.agent, model: settings.model, effort: settings.effort };

    if (health.live) {
      const closed = closeDuplicates(dedupe.close, d, settings.agent);
      return { ok: true, exit: 0, action: health.starting ? 'starting' : 'already-live', terminal: health.terminal, reason: health.reason, ...(closed.length ? { closedDuplicates: closed } : {}) };
    }

    const token = `supervisor-${crypto.randomBytes(6).toString('hex')}`;
    const at = now();
    const attempt = (seat?.value?.attempt ?? 0) + 1;
    const previous = seat?.value?.terminal ? { terminal: seat.value.terminal, reason: health.reason } : null;

    if (dedupe.adopt) {
      const handle = dedupe.adopt.handle;
      const v = d.verdict(handle);
      const screen = v.verdict === 'live' ? d.screen(handle) : null;
      if (v.verdict !== 'live' || screen == null || d.exitedRow(screen)) return { ok: false, exit: 1, action: 'adopt-refused', terminal: handle, reason: v.verdict !== 'live' ? v.reason : 'no agent session on screen' };
      const value = { terminal: handle, agent: agentOfTerminal(dedupe.adopt, settings.agent), model: seat?.value?.model ?? settings.model, effort: seat?.value?.effort ?? settings.effort,
        startedAt: seat?.value?.startedAt ?? new Date(at).toISOString(), adoptedAt: new Date(at).toISOString(), attempt };
      ledger.transaction(() => {
        writeSeat(ledger, { token, value, now: at });
        supervisorEvent(ledger, { kind: 'supervisor-adopted', payload: { ...value, previous, reason: dedupe.adopt.reason }, now: at });
      });
      const closed = closeDuplicates(dedupe.close, d, settings.agent);
      return { ok: true, exit: 0, action: 'adopted', terminal: handle, ...(closed.length ? { closedDuplicates: closed } : {}) };
    }

    // Reserve the seat: a concurrent launcher that got past the lock (a stale lock) still meets this row.
    const reserved = ledger.transaction(() => {
      const row = seatOf(ledger.db, at);
      if (row && (row.starting || (row.token !== seat?.token))) return false;
      writeSeat(ledger, { token, value: { state: 'starting', attempt }, expiresAt: at + STARTUP_RESERVATION_MS, now: at });
      return true;
    });
    if (!reserved) return { ok: true, exit: 0, action: 'starting', reason: 'another launcher holds the startup reservation' };

    // The previous seat's terminal: a disconnected one is closed now; an exited agent's shell after the launch.
    const closedPrevious = [];
    if (previous && !health.gone && !health.agentExited) { try { closedPrevious.push({ handle: previous.terminal, ...(d.close(previous.terminal) ?? {}) }); } catch { /* best effort */ } }
    const closedDuplicates = closeDuplicates(dedupe.close, d, settings.agent);

    const prompt = renderSupervisorPrompt({
      template: template ?? fs.readFileSync(PROMPT_FILE, 'utf8'),
      doc: doc ?? parseYaml(fs.readFileSync(DOCTRINE_FILE, 'utf8')),
      settings, restart: previous ? (reason ?? `the previous Supervisor terminal ${previous.terminal} failed its liveness check (${previous.reason})`) : null,
    });
    const command = d.card ? seatCommand({ agent: settings.agent, model: settings.model, effort: settings.effort, card: d.card(settings.agent) }) : null;
    const spawned = d.spawn({ provider: settings.agent, model: settings.model, effort: settings.effort, worktree: SKILL_ROOT,
      title: SUPERVISOR_TITLE, prompt, kernel: true, dispatchId: `supervisor-${SUPERVISOR_ID}`, ...(command ? { command } : {}) });
    if (!spawned?.ok) {
      ledger.transaction(() => {
        ledger.db.prepare('DELETE FROM signals WHERE scope=? AND key=? AND token=?').run(SEAT_SCOPE, SUPERVISOR_ID, token);
        supervisorEvent(ledger, { kind: 'supervisor-start-failed', payload: { step: spawned?.step ?? null, error: spawned?.error ?? null, terminal: spawned?.terminal ?? null, agent: settings.agent }, now: now() });
      });
      return { ok: false, exit: 1, action: 'launch-failed', step: spawned?.step ?? null, error: spawned?.error ?? 'spawn failed', terminal: spawned?.terminal ?? null };
    }
    const value = { terminal: spawned.terminal, agent: settings.agent, model: settings.model, effort: settings.effort,
      startedAt: new Date(now()).toISOString(), attempt, modelAttested: spawned.modelAttested ?? null };
    ledger.transaction(() => {
      writeSeat(ledger, { token, value, now: now() });
      supervisorEvent(ledger, { kind: previous ? 'supervisor-restarted' : 'supervisor-booted', payload: { ...value, previous, reason }, now: now() });
    });
    if (previous && health.agentExited) { try { closedPrevious.push({ handle: previous.terminal, ...(d.close(previous.terminal) ?? {}) }); } catch { /* best effort */ } }
    return { ok: true, exit: 0, action: previous ? 'restarted' : 'booted', terminal: spawned.terminal, agent: settings.agent, model: settings.model,
      attempt, ...(closedDuplicates.length ? { closedDuplicates } : {}), ...(closedPrevious.length ? { closedPrevious } : {}) };
  } finally {
    ledger.close();
    lock.release();
  }
}

/** Disable the seat, ask its agent to quit and close its tab. The watchdog then leaves it down. */
export async function stopSupervisor({ env = process.env, deps = null, now = Date.now } = {}) {
  const d = deps ?? await orcaDeps();
  const ledger = openSupervisorLedger({ env });
  try {
    setEnabled(ledger, false, { by: 'start-supervisor --stop', now: now() });
    const seat = seatOf(ledger.db, now());
    const terminal = seat?.value?.terminal ?? null;
    let quit = null, closed = null;
    if (terminal) {
      try { quit = d.quit(terminal, seat.value.agent ?? 'claude'); } catch (e) { quit = { error: String(e?.message ?? e) }; }
      try { closed = d.close(terminal); } catch (e) { closed = { ok: false, error: String(e?.message ?? e) }; }
    }
    ledger.transaction(() => {
      ledger.db.prepare('DELETE FROM signals WHERE scope=? AND key=?').run(SEAT_SCOPE, SUPERVISOR_ID);
      supervisorEvent(ledger, { kind: 'supervisor-stopped', payload: { terminal, quit, closed: closed?.ok ?? null }, now: now() });
    });
    return { ok: true, action: 'stopped', terminal, quit, closed: closed?.ok === true || quit?.exited === true };
  } finally { ledger.close(); }
}

/* ------------------------------------------------------------ the watchdog loop */

/** Live supervisor watchdog loops (not their --once children), from the process table; null = unreadable. */
export function supervisorWatchdogs() {
  // resume-all's listWatchdogs keeps only lines with --workflow; the supervisor loop has none.
  const r = process.platform === 'win32'
    ? spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -match 'supervisor[\\\\/]watchdog\\.mjs' } | ForEach-Object { '{0}|{1}' -f $_.ProcessId, $_.CommandLine }"],
    { encoding: 'utf8', windowsHide: true, timeout: 60_000 })
    : spawnSync('ps', ['-eo', 'pid=,args='], { encoding: 'utf8', timeout: 30_000 });
  if (r.status !== 0) return null;
  return String(r.stdout ?? '').split(/\r?\n/).map((l) => l.trim()).filter((l) => /supervisor[\\/]watchdog\.mjs/.test(l) && !/--once/.test(l))
    .map((l) => ({ pid: Number((/^(\d+)[|\s]/.exec(l) ?? [])[1]) || null, commandLine: l.replace(/^\d+[|\s]+/, '') }));
}

/** Start the supervisor watchdog loop detached unless one runs (its own lock also refuses a second). */
export function ensureSupervisorWatchdog({ env = process.env, dryRun = false, list = supervisorWatchdogs } = {}) {
  try {
    if (supervisorMode({ env }) === 'chat') return { ok: true, skipped: 'chat mode' };
    if (env.NODE_TEST_CONTEXT) return { ok: true, skipped: 'test context' };
    const held = lockHolder('supervisor-watchdog', env);
    if (held) return { ok: true, already: true, pid: held.pid };
    const loops = list();
    if (loops?.length) return { ok: true, already: true, pid: loops[0].pid };
    if (dryRun) return { ok: true, wouldStart: true };
    const log = path.join(logsRoot(env), 'watchdog.log');
    fs.mkdirSync(path.dirname(log), { recursive: true });
    const fd = fs.openSync(log, 'a');
    try {
      const child = spawn(process.execPath, [WATCHDOG_FILE], { detached: true, stdio: ['ignore', fd, fd], windowsHide: true, cwd: SKILL_ROOT, env });
      child.unref();
      return { ok: true, launched: child.pid ?? null, log };
    } finally { fs.closeSync(fd); }
  } catch (error) { return { ok: false, error: String(error?.message ?? error) }; }
}

/**
 * resume-all's step: when the seat is enabled (start-supervisor ran and --stop did not follow), make sure its
 * watchdog loop runs; the loop replaces a dead Supervisor itself. Never throws; never enables anything. In chat
 * mode (config.yaml supervisor.mode, the default) it does nothing: the owner's chat is the Supervisor.
 */
export function ensureSupervisor({ env = process.env, dryRun = false, ensure = ensureSupervisorWatchdog } = {}) {
  try {
    if (supervisorMode({ env }) === 'chat') return { ok: true, skipped: 'chat mode' };
    const enabled = withSupervisorRead((db) => enabledOf(db), null, { env });
    if (enabled !== true) return { ok: true, skipped: enabled === false ? 'disabled' : 'never started' };
    return ensure({ env, dryRun });
  } catch (error) { return { ok: false, error: String(error?.message ?? error) }; }
}

/* ------------------------------------------------------------ CLI */

const describe = (r) => {
  if (r.action === 'status') return `[Supervisor] mode ${r.supervisorMode}; ${r.enabled === false ? 'DISABLED' : r.enabled ? 'enabled' : 'never started'}; seat ${r.seat?.terminal ?? 'none'} (${r.health?.reason ?? '-'})${r.watchdog ? `; watchdog ${r.watchdog.length ? `pid ${r.watchdog.map((w) => w.pid).join(',')}` : 'NOT running'}` : ''}`;
  return `[Supervisor] ${r.action}${r.terminal ? ` ${r.terminal}` : ''}${r.reason ? ` (${r.reason})` : ''}${r.error ? `: ${r.error}` : ''}${r.watchdog ? `; watchdog ${r.watchdog.already ? `running pid ${r.watchdog.pid}` : r.watchdog.launched ? `started pid ${r.watchdog.launched}` : r.watchdog.skipped ?? r.watchdog.error ?? ''}` : ''}`;
};

async function main() {
  const argv = process.argv.slice(2);
  const has = (n) => argv.includes(`--${n}`);
  const value = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] ?? null : null; };
  const asJson = has('json');
  const out = (r) => { console.log(asJson ? JSON.stringify(r) : describe(r)); process.exitCode = r.exit ?? (r.ok ? 0 : 1); };
  if (has('help')) { console.log('use: start-supervisor.mjs [--plan] [--no-watchdog] [--reason <t>] | --replace | --adopt <terminal> | --status | --stop | --restart  [--json]'); return; }
  if (has('status')) {
    const d = await orcaDeps();
    const ledger = openSupervisorLedger();
    let r;
    try { const seat = seatOf(ledger.db); r = { ok: true, action: 'status', supervisorMode: supervisorMode(), enabled: enabledOf(ledger.db), seat: seat?.value ?? null, health: seatHealth(seat, d), watchdog: supervisorWatchdogs() }; }
    finally { ledger.close(); }
    return out(r);
  }
  if (has('stop')) { const r = await stopSupervisor(); supervisorLog('start', `stop: ${JSON.stringify(r)}`); return out(r); }
  if (has('restart')) {
    const stopped = await stopSupervisor();
    const r = await launchSupervisor({ mode: 'start', reason: value('reason') ?? 'owner restart (start-supervisor --restart)' });
    r.stopped = stopped;
    if (!has('no-watchdog') && r.action !== 'chat-mode') r.watchdog = ensureSupervisorWatchdog();
    supervisorLog('start', `restart: ${JSON.stringify(r)}`);
    return out(r);
  }
  const mode = has('replace') ? 'replace' : value('adopt') ? 'adopt' : 'start';
  const r = await launchSupervisor({ mode, adoptHandle: value('adopt'), reason: value('reason'), plan: has('plan') });
  if (mode === 'start' && !has('plan') && !has('no-watchdog') && r.action !== 'chat-mode') r.watchdog = ensureSupervisorWatchdog();
  if (!has('plan')) supervisorLog('start', `${mode}: ${JSON.stringify(r)}`);
  return out(r);
}

if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) main();
