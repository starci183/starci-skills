#!/usr/bin/env node
// watchdog.mjs — liveness and cadence of the ONE [Supervisor] kernel (modules/supervisor/supervise.yaml
// kernelSeat, docs/supervisor.md). Like scripts/kernel/watchdog.mjs for a Kernel, it never decides anything:
//   - replaces a Supervisor terminal a responding Orca proves dead (twice) or back at a bare shell prompt
//     (scripts/supervisor/start-supervisor.mjs --replace, which re-proves it and dedupes);
//   - wakes the idle Supervisor with a one-line tag when it has work: [inbox] unread channel messages (their
//     text is NEVER typed; the Supervisor reads its inbox), [land] a worker filed a report, [worker] a worker died, [register] the
//     channel 'main' is not registered from the seat's terminal, [decide] an open Supervisor Decision Item (MB-02: announced
//     once by id, reminded every INBOX_REWAKE_MS while it stays open). Delivery is screen-proven
//     (scripts/kernel/wake-delivery.mjs wakeKernel);
//   - replaces a seat that refused input SEAT_DEAF_MAX times in a row (kernel-unwritable / -exited / -unavailable /
//     -send-failed, counted in machine.sqlite seats/deliveries: MB-05, 42 failed wakes and no replacement on
//     2026-09-27); a delivered wake resets the count;
//   - heartbeats channel 'main' while the seat is proven live and registered from its own terminal;
//   [Worker] terminals are the Job controller's (scripts/reconciler/controllers/job.mjs calls sweepWorkers below).
//
//   node scripts/supervisor/watchdog.mjs --once [--json] one pass; the reconciler Host controller runs it
//                                                        (concern host.supervisor-seat). There is no loop (owner ruling
//                                                        2026-09-28 "có lỗi xóa luôn": the reconciler is the only loop).
//
// It serves only the optional [Supervisor] kernel (config.yaml supervisor.mode kernel). In chat mode (the default;
// owner, 2026-09-25: the Supervisor is the owner's desktop chat again), or while the seat is DISABLED
// (start-supervisor --stop) or was never started, a pass does nothing.
import '../lib/hide-child-windows.mjs';
import path from 'node:path';
import { sha256 } from '../../engine/index.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { allocationMs } from '../../engine/config.mjs';
import { sleepSync } from '../lib/sleep-sync.mjs';
import { INPUT_GLYPH_CLASS } from '../lib/input-glyph.mjs';
import { readInbox, getSupervisor, heartbeatSupervisor } from '../connectors/telegram-bridge.mjs';
import {
  SKILL_ROOT, SUPERVISOR_ID, SEAT_ID, SUPERVISOR_TITLE, WORKER_TITLE_PREFIX, seatOf, enabledOf, supervisorEvent, supervisorSettings,
  supervisorMode, terminalSignalDb, supervisorLog, DEFAULTS,
} from './home.mjs';
import { seatHealth } from './start-supervisor.mjs';
import { jobsOf, reportOf } from './workers.mjs';
import { openMachine, withMachine } from '../../engine/machine-db.mjs';
import { terminalList } from '../api/orca/terminal-list.mjs';
import { terminalRename } from '../api/orca/terminal-rename.mjs';
import { tabTitlesOf } from '../kernel/terminal-dedupe.mjs';
import { supervisorDecisions } from '../reconciler/decisions.mjs';

const selfFile = fileURLToPath(import.meta.url);
const START_FILE = path.join(SKILL_ROOT, 'scripts', 'supervisor', 'start-supervisor.mjs');
export const LOOP_MS = 30_000;
export const LIVENESS_MS = 180_000;
export const INBOX_REWAKE_MS = 10 * 60_000;
export const WAKE_TAG = '[Supervisor watchdog]';

/** Every recent wake ATTEMPT, newest first: a wake whose proof failed may still have reached the screen. */
const recentWakes = (m) => m.supEvents({ kind: 'supervisor-wake', limit: 50 }).map((e) => ({ at: e.created_at, payload: e.payload ?? {} }));
/** How far back unconsumed worker reports are read (modules/models/runtimes.yaml
 * allocation.workerJobs.reportWindowMs). */
export const WORKER_REPORT_WINDOW_MS = allocationMs('workerJobs.reportWindowMs');
/** The job ids of worker reports not yet consumed that are not done (diagnosed, blocked, failed), the last WORKER_REPORT_WINDOW_MS. */
const filedReports = (m, now) => m.db.prepare("SELECT DISTINCT job_id FROM sup_reports WHERE outcome!='done' AND consumed_at IS NULL AND created_at>?")
  .all(now - WORKER_REPORT_WINDOW_MS).map((r) => r.job_id);

/**
 * Claude Code keeps its input row idle while subagents it launched still run: the frame then lists them
 * ("● general-purpose  Checking … 8m 41s · ↓ 154.0k tokens", "← for agents"). That Supervisor is busy - a wake
 * typed there lands on top of its running work (2026-09-24: two [inbox] wakes during four subagents).
 * But only while the frame MOVES: the same day the seat sat 70 minutes on a general-purpose pane frozen
 * at "12m 2s" and every read called it busy, so no wake landed. A busy frame whose signature repeats
 * across reads is FROZEN, not busy (frozenBusyFrame): the pending wake is delivered through the proven
 * split-send path (Escape first when the input row targets a subagent), and a frame still frozen after
 * the wake restarts the seat through the replace path.
 */
export const SUBAGENT_ROW = /^\s*(?:❯\s*)?[●◯◐◑◒◓]\s+(?!main\s*$)[\w.@-]+\s{2,}\S.*?\b\d+m(?:\s*\d+s)?\s*·/mu;
export const busyScreen = (screen) => SUBAGENT_ROW.test(String(screen ?? ''));

/**
 * The signature of a busy frame: the normalized screen text, hashed. A subagent/agent row or a spinner
 * timer whose text has not changed across watchdog reads signs identically; a timer that still ticks
 * signs differently and is still busy.
 */
export const busySignature = (screen) => sha256(
  String(screen ?? '').split(/\r?\n/).map((row) => row.trimEnd()).join('\n').trim()
).slice(0, 24);

/** An input row aimed at a subagent ("❯ Message @general-purpose…"): Escape leaves it before a wake. */
export const SUBAGENT_INPUT = new RegExp(`^\\s*${INPUT_GLYPH_CLASS}[^\\n]*@[\\w@.-]+`, 'm');

/** Busy screen states a frozen frame rescues; gates/failed/unreadable stay plain busy. */
const FROZEN_BUSY = new Set(['active', 'unknown', 'wedged', 'subagents-running']);

/** The sup_signals scope that keeps the last busy-frame signature per terminal ({signature, since, reads}). */
export const BUSY_SCOPE = 'supervisor-busy';

/** The stored busy-frame state of one terminal, or null. */
export const busyFrameOf = (m, terminal) => {
  const value = m.supSignal(BUSY_SCOPE, terminal)?.value;
  return typeof value?.signature === 'string' ? value : null;
};

/** Record the busy-frame state of `terminal`; rows of other (gone) terminals are dropped. */
const putBusyFrame = (m, terminal, state) => {
  m.setSupSignal({ scope: BUSY_SCOPE, key: terminal, value: state });
  m.db.prepare('DELETE FROM sup_signals WHERE scope=? AND key<>?').run(BUSY_SCOPE, terminal);
};

/**
 * Whether the busy frame signed `signature` is FROZEN: the same signature the previous busy read stored
 * (the frame's text did not change across 2+ reads), or the terminal printed nothing for frozenMs
 * (no turn progress - config.yaml supervisor.frozenMinutes). `state` is what the next read
 * compares against; `since` keeps the first sighting of a repeating signature.
 */
export function frozenBusyFrame({ signature, prev = null, now = Date.now(), outputAgeMs = null, frozenMs = DEFAULTS.frozenMinutes * 60_000 }) {
  const same = prev?.signature === signature;
  const state = { signature, since: same ? prev.since ?? now : now, reads: same ? (prev.reads ?? 1) + 1 : 1 };
  const frozen = same || (Number.isFinite(outputAgeMs) && outputAgeMs >= frozenMs);
  return { frozen, state };
}
const shortId = (id) => String(id).slice(0, 8);

/**
 * What the Supervisor should be woken for. Pure over its inputs. Returns {tags, inbox, land, text}.
 * `wakes` are the recent wake attempts (newest first, delivered or not); `unread` the unread inbox items;
 * `reported` the job ids with a report not yet announced; `workerDeaths` the jobs the sweep just failed.
 * A wake names what it is about (inbox ids, the last tick time, job ids), and a text identical to one already
 * attempted is never sent again: `duplicate` is then true and `text` null. An unread message is announced
 * once, then reminded at most every INBOX_REWAKE_MS.
 */
export function planWake({ now = Date.now(), wakes = [], unread = [], reported = [], filed = [], workerDeaths = [], registered = true, decisions = [] }) {
  const tags = [];
  const announced = new Map();
  for (const w of [...wakes].reverse()) for (const id of w.payload.inbox ?? []) announced.set(id, w.at);
  const fresh = unread.filter((m) => !announced.has(m.id)).map((m) => m.id);
  const remind = unread.filter((m) => announced.has(m.id) && now - announced.get(m.id) >= INBOX_REWAKE_MS).map((m) => m.id);
  const inbox = [...fresh, ...remind];
  if (inbox.length) tags.push('inbox');
  // MB-02: an open Supervisor Decision Item is work: announced once, then reminded every INBOX_REWAKE_MS while open.
  const diAnnounced = new Map();
  for (const w of [...wakes].reverse()) for (const id of w.payload.decisions ?? []) diAnnounced.set(id, w.at);
  const openDis = decisions.filter((di) => di?.id && di.status === 'open');
  const diFresh = openDis.filter((di) => !diAnnounced.has(di.id)).map((di) => di.id);
  const diRemind = openDis.filter((di) => diAnnounced.has(di.id) && now - diAnnounced.get(di.id) >= INBOX_REWAKE_MS).map((di) => di.id);
  const decide = [...diFresh, ...diRemind];
  if (decide.length) tags.push('decide');
  const landAnnounced = new Set(wakes.flatMap((w) => w.payload.land ?? []));
  const land = reported.filter((id) => !landAnnounced.has(id));
  if (land.length) tags.push('land');
  const fileAnnounced = new Set(wakes.flatMap((w) => w.payload.report ?? []));
  const report = filed.filter((id) => !fileAnnounced.has(id));
  if (report.length) tags.push('report');
  if (workerDeaths.length) tags.push('worker');
  if (!registered) tags.push('register');
  const parts = [];
  if (tags.includes('register')) parts.push(`[register] channel '${SUPERVISOR_ID}' is not registered from this terminal: node scripts/supervisor/channel.mjs register --id ${SUPERVISOR_ID} --label "Supervisor".`);
  if (tags.includes('inbox')) parts.push(`[inbox] ${unread.length} unread message(s)${fresh.length ? ` (new ${fresh.map(shortId).join(',')})` : ''}${remind.length ? ` (still unread ${remind.map(shortId).join(',')})` : ''}: node scripts/supervisor/channel.mjs inbox --id ${SUPERVISOR_ID}, then reply to each (--to <inboxId>).`);
  if (tags.includes('decide')) parts.push(`[decide] ${openDis.length} open Supervisor decision(s)${diFresh.length ? ` (new ${diFresh.join(',')})` : ''}${diRemind.length ? ` (still open ${diRemind.join(',')})` : ''}: node scripts/reconciler/decisions.mjs supervisor --list, then claim and resolve each.`);
  if (tags.includes('land')) parts.push(`[land] report(s) filed by ${land.join(', ')}: node scripts/supervisor/workers.mjs list, then land (node scripts/supervisor/land.mjs --job <id>) or redirect.`);
  if (tags.includes('report')) parts.push(`[report] ${report.join(', ')} filed a diagnosis or a blocked/failed report: node scripts/supervisor/workers.mjs show --job <id>, then decide.`);
  if (tags.includes('worker')) parts.push(`[worker] ${workerDeaths.map((d) => `${d.jobId} (${d.reason})`).join(', ')}: respawn, reassign or take it yourself.`);
  const text = parts.length ? `${WAKE_TAG} ${parts.join(' ')} Act until nothing is executable, then yield; never sleep or poll in a turn.` : null;
  if (text && wakes.some((w) => w.payload.text === text)) return { tags: [], inbox: [], land: [], report: [], decisions: [], text: null, duplicate: true };
  return { tags, inbox, land, report, decisions: decide, text };
}

/* ------------------------------------------------------------ the pass */

async function hostDeps() {
  const [{ terminalRead }, { terminalShow }, { terminalSend }, host, liveness, closeMod, quitMod, wake, config] = await Promise.all([
    import('../api/orca/terminal-read.mjs'), import('../api/orca/terminal-show.mjs'), import('../api/orca/terminal-send.mjs'), import('../kernel/host-outage.mjs'), import('../kernel/terminal-liveness.mjs'),
    import('../kernel/close-op-terminal.mjs'), import('../kernel/quit-agent.mjs'), import('../kernel/wake-delivery.mjs'), import('../../engine/config.mjs')]);
  const screen = (handle) => { try { const r = terminalRead({ terminal: handle, screen: true }); return r?.ok ? String(r.screen ?? '') : null; } catch { return null; } };
  const outputAge = (handle) => {
    try { return liveness.outputAgeOf(terminalShow({ terminal: handle })?.terminal?.lastOutputAt).outputAgeMs; } catch { return null; }
  };
  return {
    list: () => terminalList({ includeVisualLayouts: true }), tabTitles: tabTitlesOf,
    rename: (terminal, title) => terminalRename({ terminal, title }),
    verdict: (h) => host.kernelTerminalVerdict(h), screen, exitedRow: liveness.exitedAgentPromptRow, settleMs: host.DEATH_SETTLE_MS, outputAge,
    // Escape (no Enter) leaves an input row that targets a subagent before the wake is typed.
    escape: (handle) => { try { return terminalSend({ terminal: handle, text: '\u001b', enter: false }); } catch (e) { return { ok: false, error: String(e?.message ?? e) }; } },
    state: (handle) => {
      const s = screen(handle);
      if (s == null) return 'unreadable';
      let stale = null;
      try { stale = config.allocationMs('liveness.activeStaleMs'); } catch { /* none */ }
      return liveness.staleAwareState(liveness.classifyAgentScreen(s).state, outputAge(handle), stale).state;
    },
    wake: (terminal, text) => wake.wakeKernel({ db: terminalSignalDb(terminal), workflowId: SEAT_ID, text }),
    enter: (terminal) => wake.sendEnterWithProof({ terminal }),
    quit: (handle, agent) => quitMod.quitAgent({ handle, agent }),
    close: (handle) => closeMod.closeOperationTerminal(handle),
    closeExited: (handle) => closeMod.closeExitedTerminal(handle),
    replace: () => {
      const r = spawnSync(process.execPath, [START_FILE, '--replace', '--json'], { cwd: SKILL_ROOT, encoding: 'utf8', windowsHide: true, timeout: 600_000 });
      try { return JSON.parse(String(r.stdout ?? '').trim().split(/\r?\n/).pop()); } catch { return { ok: false, action: 'replace-failed', error: String(r.stderr || r.stdout || `exit ${r.status}`).slice(0, 300) }; }
    },
    sleep: sleepSync,
  };
}

/** Restore runtime names in Orca's sidebar from the tab titles, never from agent-controlled pane titles. */
export function repairSupervisorTabTitles(seatTerminal, workers, d) {
  if (!d?.list || !d?.rename) return [];
  let listed;
  try { listed = d.list(); } catch { return []; }
  if (!listed?.ok) return [];
  const titles = (d.tabTitles ?? tabTitlesOf)(listed.visualLayouts ?? [], listed.terminals ?? []);
  const expected = [
    { terminal: seatTerminal, title: SUPERVISOR_TITLE },
    ...workers.filter((job) => job.worker_id && !job.payload?.self && !job.payload?.terminalClosed)
      .map((job) => ({ terminal: job.worker_id, title: `${WORKER_TITLE_PREFIX} ${job.payload.cluster}`.slice(0, 80) })),
  ];
  const repairs = [];
  for (const { terminal, title } of expected) {
    if (!terminal || titles.get(terminal) === title || !(listed.terminals ?? []).some((t) => t.handle === terminal && t.connected !== false)) continue;
    try {
      const r = d.rename(terminal, title);
      repairs.push({ terminal, title, ok: r?.ok === true, ...(r?.ok ? {} : { error: r?.error ?? 'terminal rename failed' }) });
    } catch (error) { repairs.push({ terminal, title, ok: false, error: String(error?.message ?? error) }); }
  }
  return repairs;
}

/** The [Worker] sweep over the machine handle `m` (sup_jobs): returns {deaths:[{jobId, reason}], closed:[...]}. */
export function sweepWorkers(m, d, { now = Date.now() } = {}) {
  const out = { deaths: [], closed: [] };
  for (const job of jobsOf(m, ['running', 'reported'])) {
    const handle = job.worker_id;
    if (!handle || job.payload.self || job.payload.terminalClosed) continue;
    const v = d.verdict(handle);
    if (v.verdict === 'host-unavailable' || v.verdict === 'unverified') return { ...out, skipped: v.reason };
    const screen = v.verdict === 'live' ? d.screen(handle) : null;
    const exited = screen != null && d.exitedRow(screen);
    const dead = v.verdict !== 'live' || Boolean(exited);
    const reported = job.status === 'reported' || Boolean(reportOf(m, job.job_id));
    if (reported) {
      // The worker filed its report: it should have exited; make sure its terminal is gone.
      let quit = null, closed = null;
      if (!dead) { try { quit = d.quit(handle, job.payload.agent ?? 'claude'); } catch { /* best effort */ } }
      try { closed = dead && v.verdict !== 'live' ? { ok: true, gone: true } : d.close(handle); } catch (e) { closed = { ok: false, error: String(e?.message ?? e) }; }
      if (closed?.ok || quit?.exited) {
        m.transaction(() => m.update('sup_jobs', { payload_json: { ...job.payload, terminalClosed: true }, updated_at: now }, { job_id: job.job_id }));
        out.closed.push({ jobId: job.job_id, handle });
      }
      continue;
    }
    if (!dead) continue;
    const reason = exited ? 'agent exited without a report' : `terminal ${v.verdict} without a report`;
    m.transaction(() => {
      m.releaseSupLeases(job.job_id);
      m.setSupJobStatus(job.job_id, 'failed', { payload: { ...job.payload, terminalClosed: true, result: { reason: 'worker-died-no-report', detail: reason } } });
      supervisorEvent(m, { entityType: 'job', entityId: job.job_id, kind: 'worker-died', payload: { terminal: handle, reason, agent: job.payload.agent ?? null }, now });
    });
    if (exited) { try { d.closeExited(handle); } catch { /* best effort */ } }
    out.deaths.push({ jobId: job.job_id, reason });
  }
  return out;
}

/** One watchdog pass. `d` = host seams. Returns {ok, action, ...}. */
export async function watchdogPass({ env = process.env, d = null, now = Date.now } = {}) {
  if (supervisorMode({ env }) === 'chat') return { ok: true, action: 'chat-mode' };
  const deps = d ?? await hostDeps();
  const settings = supervisorSettings();
  const m = openMachine({ env });
  try {
    const enabled = enabledOf(m);
    if (enabled !== true) return { ok: true, action: enabled === false ? 'disabled' : 'never-started' };
    const seat = seatOf(m, now());
    let health = seatHealth(seat, deps, now());
    if (health.starting) return { ok: true, action: 'starting' };
    if (health.hostUnavailable || health.unverified) return { ok: true, action: 'host-unavailable', reason: health.reason };
    if (!health.live && seat?.value?.terminal) {
      if (deps.settleMs > 0) deps.sleep(deps.settleMs);
      health = seatHealth(seatOf(m, now()), deps, now());
      if (health.live || health.hostUnavailable || health.unverified) return { ok: true, action: 'death-unconfirmed', reason: health.reason };
    }
    if (!health.live) {
      m.close();
      const replaced = deps.replace();
      const titleRepairs = replaced?.ok && replaced?.terminal ? repairSupervisorTabTitles(replaced.terminal, [], deps) : [];
      supervisorLog('watchdog', `replace: ${JSON.stringify(replaced)}`, { env });
      return { ok: replaced?.ok !== false, action: replaced?.action === 'booted' || replaced?.action === 'restarted' ? 'restarted' : (replaced?.action ?? 'replace-failed'), reason: health.reason, detail: replaced, ...(titleRepairs.length ? { titleRepairs } : {}) };
    }
    const terminal = health.terminal;
    // [Worker] terminals (deaths, reported-worker close) are the Job controller's: it calls sweepWorkers itself.
    const sweep = { deaths: [], closed: [], action: 'job-controller' };
    const titleRepairs = repairSupervisorTabTitles(terminal, jobsOf(m, ['running']), deps);
    const sup = getSupervisor(SUPERVISOR_ID, env);
    const registered = Boolean(sup && sup.terminal === terminal);
    if (registered) heartbeatSupervisor(SUPERVISOR_ID, { env });
    const unread = readInbox(SUPERVISOR_ID, env).filter((m) => !m.read);
    const reported = jobsOf(m, ['reported']).map((j) => j.job_id);
    const filed = filedReports(m, now());
    let decisions = [];
    try { decisions = supervisorDecisions(m, { now: now() }); } catch { decisions = []; }
    const plan = planWake({ now: now(), wakes: recentWakes(m), unread, reported, filed, workerDeaths: sweep.deaths, registered, decisions });
    if (!plan.text) return { ok: true, action: 'idle', terminal, registered, workers: sweep, ...(titleRepairs.length ? { titleRepairs } : {}) };
    const state = deps.state(terminal);
    if (state === 'queued-input' || state === 'staged-input') {
      const proof = deps.enter(terminal);
      return { ok: proof?.ok === true, action: `${state}-sent`, terminal, tags: plan.tags };
    }
    let frame = null;
    const busy = state !== 'turn-idle' ? state : (busyScreen(frame = deps.screen(terminal)) ? 'subagents-running' : null);
    if (busy && FROZEN_BUSY.has(busy)) {
      frame ??= deps.screen(terminal);
      const signature = frame == null ? null : busySignature(frame);
      if (signature == null) return { ok: true, action: 'busy', state: busy, terminal, pending: plan.tags };
      const outputAgeMs = deps.outputAge ? deps.outputAge(terminal) : null;
      const frozen = frozenBusyFrame({ signature, prev: busyFrameOf(m, terminal), now: now(), outputAgeMs, frozenMs: settings.frozenMinutes * 60_000 });
      m.transaction(() => putBusyFrame(m, terminal, frozen.state));
      if (!frozen.frozen) return { ok: true, action: 'busy', state: busy, terminal, pending: plan.tags };
      // A frozen pane is not a busy seat: Escape an input row aimed at a subagent, then the proven wake.
      const escaped = deps.escape && SUBAGENT_INPUT.test(frame) ? deps.escape(terminal) : null;
      const woke = deps.wake(terminal, plan.text);
      noteInputOutcome(terminal, woke.action, { env });
      const after = deps.screen(terminal);
      const stillFrozen = after != null && busySignature(after) === signature;
      m.transaction(() => supervisorEvent(m, { kind: 'supervisor-wake', now: now(), payload: { tags: plan.tags, inbox: plan.inbox, land: plan.land, report: plan.report, decisions: plan.decisions, text: plan.text,
        delivered: woke.delivered === true, action: woke.action,
        frozen: { signature, since: frozen.state.since, reads: frozen.state.reads, outputAgeMs, state: busy, escaped: escaped == null ? null : escaped.ok === true } } }));
      if (stillFrozen) {
        m.transaction(() => supervisorEvent(m, { kind: 'supervisor-frozen-replace', now: now(), payload: { terminal, signature, since: frozen.state.since, reads: frozen.state.reads, wake: woke.action ?? null } }));
        m.close();
        const replaced = deps.replace();
        const titleRepairs = replaced?.ok && replaced?.terminal ? repairSupervisorTabTitles(replaced.terminal, [], deps) : [];
        supervisorLog('watchdog', `frozen-replace: ${JSON.stringify(replaced)}`, { env });
        return { ok: replaced?.ok !== false, action: replaced?.action === 'booted' || replaced?.action === 'restarted' ? 'restarted' : (replaced?.action ?? 'replace-failed'), terminal, tags: plan.tags, detail: replaced, ...(titleRepairs.length ? { titleRepairs } : {}) };
      }
      return { ok: woke.delivered === true || woke.action === 'kernel-busy', action: woke.delivered ? 'frozen-woken' : woke.action, terminal, tags: plan.tags, workers: sweep };
    }
    if (busy) return { ok: true, action: 'busy', state: busy, terminal, pending: plan.tags };
    m.db.prepare('DELETE FROM sup_signals WHERE scope=?').run(BUSY_SCOPE);
    const woke = deps.wake(terminal, plan.text);
    m.transaction(() => supervisorEvent(m, { kind: 'supervisor-wake', now: now(), payload: { tags: plan.tags, inbox: plan.inbox, land: plan.land, report: plan.report, decisions: plan.decisions, text: plan.text, delivered: woke.delivered === true, action: woke.action } }));
    // MB-05: a seat that refuses input SEAT_DEAF_MAX times in a row is replaced, not woken forever.
    const deaf = noteInputOutcome(terminal, woke.action, { env });
    if (deaf.replace) {
      m.transaction(() => supervisorEvent(m, { kind: 'supervisor-deaf-replace', now: now(), payload: { terminal, failures: deaf.failures, since: deaf.since, last: woke.action } }));
      const replaced = deps.replace();
      const titleRepairs = replaced?.ok && replaced?.terminal ? repairSupervisorTabTitles(replaced.terminal, [], deps) : [];
      supervisorLog('watchdog', `deaf-replace after ${deaf.failures} refused input(s): ${JSON.stringify(replaced)}`, { env });
      return { ok: replaced?.ok !== false, action: replaced?.action === 'booted' || replaced?.action === 'restarted' ? 'restarted' : (replaced?.action ?? 'replace-failed'), reason: `seat-deaf x${deaf.failures}`, inputFailures: deaf.failures, terminal, tags: plan.tags, detail: replaced, ...(titleRepairs.length ? { titleRepairs } : {}) };
    }
    return { ok: woke.delivered === true || woke.action === 'kernel-busy', action: woke.delivered ? 'woken' : woke.action, terminal, tags: plan.tags, workers: sweep, inputFailures: deaf.failures };
  } finally { m.close(); }
}

/** MB-05: this many refused inputs in a row replace the seat (DBTREE v_deaf_seats: input_failures_consecutive >= 3). */
export const SEAT_DEAF_MAX = 3;
export const SUPERVISOR_SEAT_ID = 'supervisor';

/**
 * Count one wake outcome of the Supervisor seat in machine.sqlite (machine-db recordSeatInput: one deliveries row, the
 * seat's input_failures_consecutive kept by its trigger; a refused input adds one, a delivered wake resets, busy leaves
 * it; a new terminal starts from zero). Returns {failures, since, replace}. Never throws.
 */
export function noteInputOutcome(terminal, action, { env = process.env } = {}) {
  try { return withMachine((m) => m.recordSeatInput({ seatId: SUPERVISOR_SEAT_ID, terminal, action, role: 'supervisor', max: SEAT_DEAF_MAX }), { env }); }
  catch (error) { return { failures: 0, since: null, replace: false, error: String(error?.message ?? error).slice(0, 200) }; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) {
  if (!process.argv.includes('--once')) {
    console.error('use: node scripts/supervisor/watchdog.mjs --once [--json]  (the Host controller runs it; there is no loop)');
    process.exit(2);
  }
  const r = await watchdogPass();
  console.log(process.argv.includes('--json') ? JSON.stringify(r) : `[Supervisor watchdog] ${r.action}${r.terminal ? ` ${r.terminal}` : ''}${r.tags ? ` ${r.tags.join(',')}` : ''}`);
  process.exit(r.ok ? 0 : 1);
}
