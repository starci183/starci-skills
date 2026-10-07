#!/usr/bin/env node
// starci supervisor watchdog — liveness and cadence of the ONE [Supervisor] kernel (modules/supervisor/supervise.yaml
// kernelSeat, docs/supervisor.md). Like scripts/kernel/kernel-watchdog.mjs for a Kernel, it never decides anything:
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
//   starci supervisor watchdog --once [--json] one pass; the reconciler Host controller runs it
//                                                        (concern host.supervisor-seat). There is no loop (owner ruling
//                                                        2026-09-28 "on error just delete it": the reconciler is the only loop).
//
// It serves only the optional [Supervisor] kernel (config.yaml supervisor.mode kernel). In chat mode (the default;
// owner, 2026-09-25: the Supervisor is the owner's desktop chat again), or while the seat is DISABLED
// (start-supervisor --stop) or was never started, a pass does nothing.
import '../api/process/hide-child-windows.mjs';
import path from 'node:path';
import {sha256} from '../../engine/digest.mjs';
import { runNode } from '../api/node/run-node.mjs';
import { allocationMs, allocationSettings } from '../../engine/config.mjs';
import { retryAfterFailure } from '../lib/retry-budget.mjs';
import { sleepSync } from '../lib/sleep-sync.mjs';
import { INPUT_GLYPH_CLASS } from '../lib/input-glyph.mjs';
import { getSupervisor, heartbeatSupervisor } from './telegram-bridge.mjs';
import { readInbox } from '../machine/sup-messages.mjs';
import {
  SKILL_ROOT, SUPERVISOR_ID, SEAT_ID, SUPERVISOR_TITLE, WORKER_TITLE_PREFIX, seatOf, enabledOf, supervisorEvent, supervisorSettings,
  supervisorMode, terminalSignalDb, supervisorLog, DEFAULTS,
} from '../machine/home.mjs';
import { seatHealth } from './start-supervisor.mjs';
import { jobsOf, reportOf } from './workers.mjs';
import { workerTerminalClosed } from './worker-state.mjs';
import { openMachine, withMachine } from '../../engine/db/machine.mjs';
import { terminalList } from '../api/orca/terminal-list.mjs';
import { terminalRename } from '../api/orca/terminal-rename.mjs';
import { tabTitlesOf } from '../kernel/terminal-dedupe.mjs';
import { supervisorDecisions } from '../machine/decisions.mjs';
import { isMain } from '../lib/is-main.mjs';
import { bestEffortCall } from '../agent/best-effort-call.mjs';

const START_FILE = path.join(SKILL_ROOT, 'scripts', 'supervisor', 'start-supervisor.mjs');
const INBOX_REWAKE_MS = 10 * 60_000;
const WAKE_TAG = '[Supervisor watchdog]';

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
const SUBAGENT_ROW = new RegExp([String.raw`^\s*(?:❯\s*)?`, '[●◯◐◑◒◓]', String.raw`\s+`, String.raw`(?!main\s*$)`, String.raw`[\w.@-]+`, String.raw`\s{2,}`, String.raw`\S.*?`, String.raw`\b\d+m`, String.raw`(?:\s*\d+s)?`, String.raw`\s*·`].join(''), 'mu');
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
export const SUBAGENT_INPUT = new RegExp(String.raw`^\s*${INPUT_GLYPH_CLASS}[^\n]*@[\w@.-]+`, 'm');

/** Busy screen states a frozen frame rescues; gates/failed/unreadable stay plain busy. */
const FROZEN_BUSY = new Set(['active', 'unknown', 'wedged', 'subagents-running']);

/** The sup_signals scope that keeps the last busy-frame signature per terminal ({signature, since, reads}). */
const BUSY_SCOPE = 'supervisor-busy';

/** The stored busy-frame state of one terminal, or null. */
const busyFrameOf = (m, terminal) => {
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
function announcedAt(wakes, key) {
  const announced = new Map();
  for (const w of [...wakes].reverse()) for (const id of w.payload[key] ?? []) announced.set(id, w.at);
  return announced;
}

function inboxWakePart(unread, fresh, remind) {
  return '[inbox] ' + unread.length + ' unread message(s)' + (fresh.length ? ' (new ' + fresh.map(shortId).join(',') + ')' : '') + (remind.length ? ' (still unread ' + remind.map(shortId).join(',') + ')' : '') + `: starci supervisor channel inbox --id ${SUPERVISOR_ID}, then reply to each (--to <inboxId>).`;
}

function decisionWakePart(openDis, diFresh, diRemind) {
  return '[decide] ' + openDis.length + ' open Supervisor decision(s)' + (diFresh.length ? ' (new ' + diFresh.join(',') + ')' : '') + (diRemind.length ? ' (still open ' + diRemind.join(',') + ')' : '') + ': starci machine decisions supervisor --list, then claim and resolve each.';
}

function wakeText({ tags, unread, fresh, remind, openDis, diFresh, diRemind, land, report, workerDeaths }) {
  const parts = [];
  if (tags.includes('register')) parts.push(`[register] channel '${SUPERVISOR_ID}' is not registered from this terminal: starci supervisor channel register --id ${SUPERVISOR_ID} --label "Supervisor".`);
  if (tags.includes('inbox')) parts.push(inboxWakePart(unread, fresh, remind));
  if (tags.includes('decide')) parts.push(decisionWakePart(openDis, diFresh, diRemind));
  if (tags.includes('land')) parts.push(`[land] report(s) filed by ${land.join(', ')}: starci supervisor workers list, then land (starci supervisor land --job <id>) or redirect.`);
  if (tags.includes('report')) parts.push(`[report] ${report.join(', ')} filed a diagnosis or a blocked/failed report: starci supervisor workers show --job <id>, then decide.`);
  if (tags.includes('worker')) parts.push(`[worker] ${workerDeaths.map((d) => d.jobId + ' (' + d.reason + ')').join(', ')}: respawn, reassign or take it yourself.`);
  const text = parts.length ? `${WAKE_TAG} ${parts.join(' ')} Act until nothing is executable, then yield; never sleep or poll in a turn.` : null;
  return text;
}

export function planWake({ now = Date.now(), wakes = [], unread = [], reported = [], filed = [], workerDeaths = [], registered = true, decisions = [] }) {
  const tags = [];
  const announced = announcedAt(wakes, 'inbox');
  const fresh = unread.filter((m) => !announced.has(m.id)).map((m) => m.id);
  const remind = unread.filter((m) => announced.has(m.id) && now - announced.get(m.id) >= INBOX_REWAKE_MS).map((m) => m.id);
  const inbox = [...fresh, ...remind];
  if (inbox.length) tags.push('inbox');
  // MB-02: an open Supervisor Decision Item is work: announced once, then reminded every INBOX_REWAKE_MS while open.
  const diAnnounced = announcedAt(wakes, 'decisions');
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
  const text = wakeText({ tags, unread, fresh, remind, openDis, diFresh, diRemind, land, report, workerDeaths });
  if (text && wakes.some((w) => w.payload.text === text)) return { tags: [], inbox: [], land: [], report: [], decisions: [], text: null, duplicate: true };
  return { tags, inbox, land, report, decisions: decide, text };
}

/* ------------------------------------------------------------ the pass */

async function hostDeps() {
  const [{ terminalRead }, { terminalShow }, { terminalSend }, host, liveness, closeMod, quitMod, wake, config, { workerShow }, { workerStop }, { closeWorker }] = await Promise.all([
    import('../api/orca/terminal-read.mjs'), import('../api/orca/terminal-show.mjs'), import('../api/orca/terminal-send.mjs'), import('../kernel/host-outage.mjs'), import('../lib/terminal-liveness.mjs'),
    import('../kernel/close-op-terminal.mjs'), import('../kernel/quit-agent.mjs'), import('../kernel/wake-delivery.mjs'), import('../../engine/config.mjs'),
    import('../api/orca/worker-show.mjs'), import('../api/orca/worker-stop.mjs'), import('../machine/worker-close.mjs')]);
  const screen = (handle) => { try { const r = terminalRead({ terminal: handle, screen: true }); return r?.ok ? String(r.screen ?? '') : null; } catch { return null; } };
  const outputAge = (handle) => {
    try { return liveness.outputAgeOf(terminalShow({ terminal: handle })?.terminal?.lastOutputAt).outputAgeMs; } catch { return null; }
  };
  return {
    list: () => terminalList({ includeVisualLayouts: true }), tabTitles: tabTitlesOf,
    rename: (terminal, title) => terminalRename({ terminal, title }),
    show: (dispatch) => workerShow({ dispatch }), stop: (dispatch) => workerStop({ dispatch }), release: (dispatch) => closeWorker({ dispatch }),
    screen, settleMs: host.DEATH_SETTLE_MS, outputAge,
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
    replace: () => {
      const r = runNode([START_FILE, '--replace', '--json'], { cwd: SKILL_ROOT, timeout: 600_000 });
      try { return JSON.parse(String(r.stdout ?? '').trim().split(/\r?\n/).pop()); } catch { return { ok: false, action: 'replace-failed', error: String(r.stderr || r.stdout || `exit ${r.status}`).slice(0, 300) }; }
    },
    sleep: sleepSync,
  };
}

/** Restore runtime names in Orca's sidebar from the tab titles, never from agent-controlled pane titles. */
function expectedSupervisorTitles(seatTerminal, workers) {
  return [
    { terminal: seatTerminal, title: SUPERVISOR_TITLE },
    ...workers.filter((job) => job.worker_id && !job.payload?.self && !job.payload?.terminalClosed)
      .map((job) => ({ terminal: job.worker_id, title: `${WORKER_TITLE_PREFIX} ${job.payload.cluster}`.slice(0, 80) })),
  ];
}

function titleNeedsRepair(terminal, title, titles, listed) {
  return terminal && titles.get(terminal) !== title && (listed.terminals ?? []).some((t) => t.handle === terminal && t.connected !== false);
}

function renameTitle(d, terminal, title) {
  try {
    const r = d.rename(terminal, title);
    return { terminal, title, ok: r?.ok === true, ...(r?.ok ? {} : { error: r?.error ?? 'terminal rename failed' }) };
  } catch (error) { return { terminal, title, ok: false, error: String(error?.message ?? error) }; }
}

export function repairSupervisorTabTitles(seatTerminal, workers, d) {
  if (!d?.list || !d?.rename) return [];
  let listed;
  try { listed = d.list(); } catch { return []; }
  if (!listed?.ok) return [];
  const titles = (d.tabTitles ?? tabTitlesOf)(listed.visualLayouts ?? [], listed.terminals ?? []);
  const repairs = [];
  for (const { terminal, title } of expectedSupervisorTitles(seatTerminal, workers)) {
    if (!titleNeedsRepair(terminal, title, titles, listed)) continue;
    repairs.push(renameTitle(d, terminal, title));
  }
  return repairs;
}

// worker-show states that end a worker (start-workflow.mjs MANAGED_DEAD_STATE).
const DEAD_WORKER_STATE = /stop|fail|dead|exit|release|abandon/i;
const bestEffort = bestEffortCall;

/** Sweep one job: a reported worker is released and marked closed, a dead one without a report fails. Returns the reason the whole sweep stops (the host did not answer), or null. */
function sweepJob(job, { m, d, now, out, markClosed, fail }) {
  const handle = job.worker_id;
  const dispatch = job.payload.dispatch ?? null;
  if (!handle || job.payload.self || job.payload.terminalClosed) return null;
  const reported = job.status === 'reported' || Boolean(reportOf(m, job.job_id));
  if (!dispatch) return null;
  const shown = bestEffort(() => d.show(dispatch));
  if (shown?.hostUnavailable) return shown.error ?? 'worker-show did not answer';
  if (!shown?.ok) return null; // an unreadable worker proves nothing
  const dead = Boolean(shown.state && DEAD_WORKER_STATE.test(shown.state));
  if (reported) {
    const stop = dead ? null : bestEffort(() => d.stop(dispatch));
    const release = bestEffort(() => d.release(dispatch));
    if (release?.ok) { markClosed(job, { released: { at: now, stopped: stop?.ok ?? null } }); out.closed.push({ jobId: job.job_id, handle, dispatch }); }
    return null;
  }
  if (!dead) return null;
  const reason = `worker ${shown.state} without a report`;
  const release = bestEffort(() => d.release(dispatch));
  fail(job, reason, { reason: 'worker-died-no-report', detail: reason }, release?.ok === true, { dispatch });
  out.deaths.push({ jobId: job.job_id, reason });
  return null;
}

const FINISHED_STATUSES = ['cancelled', 'failed', 'succeeded'];
const LEFTOVER_CLOSES_PER_SWEEP = 3;

/** The retry budget of closing a finished worker's terminal (modules/models/runtimes.yaml allocation.workerClose). */
const leftoverCloseBudget = () => ({ intervalMs: allocationMs('workerClose.leftoverRetryMs'), maxIntervalMs: allocationMs('workerClose.leftoverRetryMaxMs'),
  maxAttempts: allocationSettings().workerClose.leftoverRetryAttempts });

/** A finished job whose worker terminal has no recorded closure and whose retry budget is not spent or waiting. */
const leftoverDue = (job, now) => Boolean(job.worker_id) && !job.payload.self && !workerTerminalClosed(job)
  && !job.payload.closeRetry?.exhausted && (job.payload.closeRetry?.nextAt ?? 0) <= now;

/** Close one leftover; an unproven close is retried on the budget with its named reason, a spent budget stays recorded on the job. */
function closeLeftover(job, { m, d, now, out, budget }) {
  const closed = d.closeLeftover(m, { jobId: job.job_id, now });
  if (!closed || closed.ok) { out.closed.push({ jobId: job.job_id, handle: job.worker_id, leftover: true }); return; }
  const step = retryAfterFailure(budget, job.payload.closeRetry, { now, reason: closed.reason ?? 'worker-closure-unproven' });
  const closeRetry = { attempts: step.attempts, firstAt: step.firstAt, nextAt: step.dueAt, reason: step.reason, ...(step.exhausted ? { exhausted: step.exhausted } : {}) };
  m.transaction(() => m.update('sup_jobs', { payload_json: { ...job.payload, closeRetry }, updated_at: now }, { job_id: job.job_id }));
  (out.unclosed ??= []).push({ jobId: job.job_id, handle: job.worker_id, ...closeRetry });
}

/**
 * Finished [Worker] jobs (cancelled, failed, succeeded) whose terminal was never closed with proof: a worker that filed its report from
 * inside its own terminal, or a cancel whose close was refused. The close, and with it the provider slot of that worker, is retried
 * here on its own interval instead of waiting for a human; at most LEFTOVER_CLOSES_PER_SWEEP per pass, each a bounded Orca call.
 */
function sweepLeftovers(m, d, { now, out }) {
  if (!d.closeLeftover) return;
  const budget = leftoverCloseBudget();
  const due = jobsOf(m, FINISHED_STATUSES).filter((job) => leftoverDue(job, now)).slice(0, LEFTOVER_CLOSES_PER_SWEEP);
  for (const job of due) closeLeftover(job, { m, d, now, out, budget });
}

/**
 * The [Worker] sweep over the machine handle `m` (sup_jobs): returns {deaths:[{jobId, reason}], closed:[...]}.
 * Liveness is worker-show on the job's Dispatch; a reported or dead worker is fenced and released (worker-stop +
 * worker-release, which archives its output). A job with no Dispatch is not a worker-start worker (every [Worker]
 * is one): the sweep proves nothing about it and leaves it.
 */
export function sweepWorkers(m, d, { now = Date.now() } = {}) {
  const out = { deaths: [], closed: [] };
  const markClosed = (job, extra = {}) => m.transaction(() => m.update('sup_jobs', { payload_json: { ...job.payload, terminalClosed: true, ...extra }, updated_at: now }, { job_id: job.job_id }));
  const fail = (job, reason, result, closed, extra = {}) => m.transaction(() => {
    m.releaseSupLeases(job.job_id);
    m.setSupJobStatus(job.job_id, 'failed', { payload: { ...job.payload, terminalClosed: closed, result } });
    supervisorEvent(m, { entityType: 'job', entityId: job.job_id, kind: 'worker-died', payload: { terminal: job.worker_id, reason, agent: job.payload.agent ?? null, ...extra }, now });
  });
  for (const job of jobsOf(m, ['running', 'reported'])) {
    const skipped = sweepJob(job, { m, d, now, out, markClosed, fail });
    if (skipped) return { ...out, skipped };
  }
  sweepLeftovers(m, d, { now, out });
  return out;
}

/** Replace the seat through the host seam, repair the new seat's tab titles and log the replacement: the pass outcome, `fields` after `action`. */
function replaceSeat(deps, env, label, fields = {}) {
  const replaced = deps.replace();
  const titleRepairs = replaced?.ok && replaced?.terminal ? repairSupervisorTabTitles(replaced.terminal, [], deps) : [];
  supervisorLog('watchdog', `${label}: ${JSON.stringify(replaced)}`, { env });
  return { ok: replaced?.ok !== false, action: replaced?.action === 'booted' || replaced?.action === 'restarted' ? 'restarted' : (replaced?.action ?? 'replace-failed'), ...fields, detail: replaced, ...(titleRepairs.length ? { titleRepairs } : {}) };
}

/** The seat's standing: `{ result }` ends the pass (disabled, starting, unverified, dead and replaced), otherwise `{ health }` of a live seat. */
function liveSeatHealth({ m, deps, env, now }) {
  const enabled = enabledOf(m);
  if (enabled !== true) return { result: { ok: true, action: enabled === false ? 'disabled' : 'never-started' } };
  const seat = seatOf(m, now());
  let health = seatHealth(seat, deps, now());
  if (health.starting) return { result: { ok: true, action: 'starting' } };
  if (health.hostUnavailable || health.unverified) return { result: { ok: true, action: 'host-unavailable', reason: health.reason } };
  if (!health.live && seat?.value?.terminal) {
    if (deps.settleMs > 0) deps.sleep(deps.settleMs);
    health = seatHealth(seatOf(m, now()), deps, now());
    if (health.live || health.hostUnavailable || health.unverified) return { result: { ok: true, action: 'death-unconfirmed', reason: health.reason } };
  }
  if (health.live) return { health };
  m.close();
  return { result: replaceSeat(deps, env, 'replace', { reason: health.reason }) };
}

/** A frozen busy frame: the proven wake, and a replacement of the seat when its frame is still frozen after it. */
function wakeFrozenSeat({ m, deps, env, now, settings, terminal, plan, sweep, busy, frame: seenFrame }) {
  const frame = seenFrame ?? deps.screen(terminal);
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
    return replaceSeat(deps, env, 'frozen-replace', { terminal, tags: plan.tags });
  }
  return { ok: woke.delivered === true || woke.action === 'kernel-busy', action: woke.delivered ? 'frozen-woken' : woke.action, terminal, tags: plan.tags, workers: sweep };
}

/** The wake of an idle seat; a seat that refuses input SEAT_DEAF_MAX times in a row is replaced, not woken forever (MB-05). */
function wakeIdleSeat({ m, deps, env, now, terminal, plan, sweep }) {
  m.db.prepare('DELETE FROM sup_signals WHERE scope=?').run(BUSY_SCOPE);
  const woke = deps.wake(terminal, plan.text);
  m.transaction(() => supervisorEvent(m, { kind: 'supervisor-wake', now: now(), payload: { tags: plan.tags, inbox: plan.inbox, land: plan.land, report: plan.report, decisions: plan.decisions, text: plan.text, delivered: woke.delivered === true, action: woke.action } }));
  const deaf = noteInputOutcome(terminal, woke.action, { env });
  if (deaf.replace) {
    m.transaction(() => supervisorEvent(m, { kind: 'supervisor-deaf-replace', now: now(), payload: { terminal, failures: deaf.failures, since: deaf.since, last: woke.action } }));
    return replaceSeat(deps, env, `deaf-replace after ${deaf.failures} refused input(s)`, { reason: `seat-deaf x${deaf.failures}`, inputFailures: deaf.failures, terminal, tags: plan.tags });
  }
  return { ok: woke.delivered === true || woke.action === 'kernel-busy', action: woke.delivered ? 'woken' : woke.action, terminal, tags: plan.tags, workers: sweep, inputFailures: deaf.failures };
}

/** The wake plan for a live seat on `terminal`, with whether the seat is registered as the Supervisor channel. */
function wakePlanFor({ m, env, now, terminal }) {
  const sup = getSupervisor(SUPERVISOR_ID, env);
  const registered = Boolean(sup && sup.terminal === terminal);
  if (registered) heartbeatSupervisor(SUPERVISOR_ID, { env });
  const unread = readInbox(SUPERVISOR_ID, env).filter((m) => !m.read);
  const reported = jobsOf(m, ['reported']).map((j) => j.job_id);
  const filed = filedReports(m, now());
  let decisions = [];
  try { decisions = supervisorDecisions(m, { now: now() }); } catch { decisions = []; }
  // [Worker] terminals (deaths, reported-worker close) are the Job controller's: it calls sweepWorkers itself.
  const sweep = { deaths: [], closed: [], action: 'job-controller' };
  const plan = planWake({ now: now(), wakes: recentWakes(m), unread, reported, filed, workerDeaths: sweep.deaths, registered, decisions });
  return { plan, registered, sweep };
}

/** One pass over a live seat: repair tab titles, plan the wake, and deliver it (or report why not). */
function wakeLiveSeat({ m, deps, env, now, settings, terminal }) {
  const titleRepairs = repairSupervisorTabTitles(terminal, jobsOf(m, ['running']), deps);
  const { plan, registered, sweep } = wakePlanFor({ m, env, now, terminal });
  if (!plan.text) return { ok: true, action: 'idle', terminal, registered, workers: sweep, ...(titleRepairs.length ? { titleRepairs } : {}) };
  const state = deps.state(terminal);
  if (state === 'queued-input' || state === 'staged-input') {
    const proof = deps.enter(terminal);
    return { ok: proof?.ok === true, action: `${state}-sent`, terminal, tags: plan.tags };
  }
  let frame = null;
  let busy = state;
  if (state === 'turn-idle') { frame = deps.screen(terminal); busy = busyScreen(frame) ? 'subagents-running' : null; }
  if (busy && FROZEN_BUSY.has(busy)) return wakeFrozenSeat({ m, deps, env, now, settings, terminal, plan, sweep, busy, frame });
  if (busy) return { ok: true, action: 'busy', state: busy, terminal, pending: plan.tags };
  return wakeIdleSeat({ m, deps, env, now, terminal, plan, sweep });
}

/** One watchdog pass. `d` = host seams. Returns {ok, action, ...}. */
export async function watchdogPass({ env = process.env, d = null, now = Date.now } = {}) {
  if (supervisorMode({ env }) === 'chat') return { ok: true, action: 'chat-mode' };
  const deps = d ?? await hostDeps();
  const settings = supervisorSettings();
  const m = openMachine({ env });
  try {
    const standing = liveSeatHealth({ m, deps, env, now });
    if (standing.result) return standing.result;
    return wakeLiveSeat({ m, deps, env, now, settings, terminal: standing.health.terminal });
  } finally { m.close(); }
}

/** MB-05: this many refused inputs in a row replace the seat (DBTREE v_deaf_seats: input_failures_consecutive >= 3). */
export const SEAT_DEAF_MAX = 3;
const SUPERVISOR_SEAT_ID = 'supervisor';

/**
 * Count one wake outcome of the Supervisor seat in machine.sqlite (machine-db recordSeatInput: one deliveries row, the
 * seat's input_failures_consecutive kept by its trigger; a refused input adds one, a delivered wake resets, busy leaves
 * it; a new terminal starts from zero). Returns {failures, since, replace}. Never throws.
 */
function noteInputOutcome(terminal, action, { env = process.env } = {}) {
  try { return withMachine((m) => m.recordSeatInput({ seatId: SUPERVISOR_SEAT_ID, terminal, action, role: 'supervisor', max: SEAT_DEAF_MAX }), { env }); }
  catch (error) { return { failures: 0, since: null, replace: false, error: String(error?.message ?? error).slice(0, 200) }; }
}

if (isMain(import.meta.url)) {
  if (!process.argv.includes('--once')) {
    console.error('use: starci supervisor watchdog --once [--json]  (the Host controller runs it; there is no loop)');
    process.exit(2);
  }
  const r = await watchdogPass();
  if (process.argv.includes('--json')) console.log(JSON.stringify(r));
  else console.log('[Supervisor watchdog] ' + r.action + (r.terminal ? ' ' + r.terminal : '') + (r.tags ? ' ' + r.tags.join(',') : ''));
  process.exit(r.ok ? 0 : 1);
}
