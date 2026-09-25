#!/usr/bin/env node
// watchdog.mjs — liveness and cadence of the ONE [Supervisor] kernel (modules/supervisor/supervise.yaml
// kernelSeat, docs/supervisor.md). Like scripts/kernel/watchdog.mjs for a Kernel, it never decides anything:
//   - replaces a Supervisor terminal a responding Orca proves dead (twice) or back at a bare shell prompt
//     (scripts/supervisor/start-supervisor.mjs --replace, which re-proves it and dedupes);
//   - wakes the idle Supervisor with a one-line tag when it has work: [inbox] unread channel messages (their
//     text is NEVER typed; the Supervisor reads its inbox), [tick] the tick is due (config.yaml
//     supervisor.pollIntervalMs), [land] a worker filed a report, [worker] a worker died, [register] the
//     channel 'main' is not registered from the seat's terminal. Delivery is screen-proven
//     (scripts/supervisor/stall-alert.mjs wakeKernel -> scripts/kernel/wake-delivery.mjs);
//   - heartbeats channel 'main' while the seat is proven live and registered from its own terminal;
//   - sweeps [Worker] terminals: a worker whose terminal died without a report fails its job (leases released,
//     checkout kept for the Supervisor to inspect); a worker that reported is asked to quit and its tab closed
//     (scripts/kernel/quit-agent.mjs, close-op-terminal.mjs).
//
//   node scripts/supervisor/watchdog.mjs                 the loop (one per host: lock 'supervisor-watchdog')
//   node scripts/supervisor/watchdog.mjs --once [--json] one pass
//
// It serves only the optional [Supervisor] kernel (config.yaml supervisor.mode kernel). In chat mode (the default;
// owner, 2026-09-25: the Supervisor is the owner's desktop chat again), or while the seat is DISABLED
// (start-supervisor --stop) or was never started, a pass does nothing and the loop EXITS cleanly (exit 0, its lock
// released) once two consecutive checks agree - so a --restart's stop-then-start never kills it.
//
// The loop checks cheap facts every LOOP_MS (inbox, tick due, reports, running workers) and runs a full pass as
// a fresh `--once` child when one needs acting on, and at least every LIVENESS_MS, so a runtime fix reaches a
// running watchdog on its next pass. The loop process itself reloads (scripts/lib/self-reload.mjs): a new runtime
// HEAD or a changed watched module re-execs it with the same argv into the same logs/watchdog.log, the lock
// 'supervisor-watchdog' handed over to the replacement, at most once per 5 minutes.
import '../lib/hide-child-windows.mjs';
import crypto from 'node:crypto';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { claimOrTakeOver } from '../connectors/lib.mjs';
import { createReloadWatch, reexecSelf, RELOAD_ENV } from '../lib/self-reload.mjs';
import { readInbox, getSupervisor, heartbeatSupervisor } from '../connectors/telegram-bridge.mjs';
import {
  SKILL_ROOT, SUPERVISOR_ID, SUPERVISOR_WF, openSupervisorLedger, withSupervisorRead, seatOf, enabledOf, supervisorEvent, supervisorSettings,
  supervisorMode, terminalSignalDb, supervisorLog, logsRoot, DEFAULTS,
} from './home.mjs';
import { seatHealth } from './start-supervisor.mjs';
import { jobsOf, reportOf, releaseLeases } from './workers.mjs';

const selfFile = fileURLToPath(import.meta.url);
const START_FILE = path.join(SKILL_ROOT, 'scripts', 'supervisor', 'start-supervisor.mjs');
export const LOOP_MS = 30_000;
export const LIVENESS_MS = 180_000;
export const INBOX_REWAKE_MS = 10 * 60_000;
export const WAKE_TAG = '[Supervisor watchdog]';

const parse = (t) => { try { return JSON.parse(t ?? '') ?? {}; } catch { return {}; } };
const lastEvent = (db, kind) => { const e = db.prepare('SELECT payload_json, created_at FROM events WHERE workflow_id=? AND kind=? ORDER BY seq DESC LIMIT 1').get(SUPERVISOR_WF, kind); return e ? { at: e.created_at, payload: parse(e.payload_json) } : null; };
/** Every recent wake ATTEMPT, newest first: a wake whose proof failed may still have reached the screen. */
const recentWakes = (db) => db.prepare("SELECT payload_json, created_at FROM events WHERE workflow_id=? AND kind='supervisor-wake' ORDER BY seq DESC LIMIT 50").all(SUPERVISOR_WF)
  .map((e) => ({ at: e.created_at, payload: parse(e.payload_json) }));
/** The job ids of worker reports not yet consumed that are not done (diagnosed, blocked, failed), the last 7 days. */
const filedReports = (db, now) => db.prepare("SELECT dispatch_id FROM reports WHERE workflow_id=? AND outcome!='done' AND consumed_at IS NULL AND created_at>?")
  .all(SUPERVISOR_WF, now - 7 * 86_400_000).map((r) => r.dispatch_id);

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
export const busySignature = (screen) => crypto.createHash('sha256')
  .update(String(screen ?? '').split(/\r?\n/).map((row) => row.trimEnd()).join('\n').trim())
  .digest('hex').slice(0, 24);

/** An input row aimed at a subagent ("❯ Message @general-purpose…"): Escape leaves it before a wake. */
export const SUBAGENT_INPUT = /^\s*[>›❯❭][^\n]*@[\w@.-]+/m;

/** Busy screen states a frozen frame rescues; gates/failed/unreadable stay plain busy. */
const FROZEN_BUSY = new Set(['active', 'unknown', 'wedged', 'subagents-running']);

/** The signals scope that keeps the last busy-frame signature per terminal ({signature, since, reads}). */
export const BUSY_SCOPE = 'supervisor-busy';

/** The stored busy-frame state of one terminal, or null. */
export const busyFrameOf = (db, terminal) => {
  const row = db.prepare('SELECT value_json FROM signals WHERE scope=? AND key=?').get(BUSY_SCOPE, terminal);
  const value = parse(row?.value_json);
  return typeof value.signature === 'string' ? value : null;
};

/** Record the busy-frame state of `terminal`; rows of other (gone) terminals are dropped. */
const putBusyFrame = (ledger, terminal, state, now) => {
  ledger.db.prepare('INSERT INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES(?,?,?,?,?,?,NULL) ON CONFLICT(scope,key) DO UPDATE SET value_json=excluded.value_json,at=excluded.at')
    .run(BUSY_SCOPE, terminal, process.pid, null, JSON.stringify(state), now);
  ledger.db.prepare('DELETE FROM signals WHERE scope=? AND key<>?').run(BUSY_SCOPE, terminal);
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
const hhmm = (ms) => (ms ? new Date(ms).toISOString().slice(11, 16) + 'Z' : 'never');

/**
 * What the Supervisor should be woken for. Pure over its inputs. Returns {tags, inbox, land, text}.
 * `wakes` are the recent wake attempts (newest first, delivered or not); `unread` the unread inbox items;
 * `reported` the job ids with a report not yet announced; `workerDeaths` the jobs the sweep just failed.
 * A wake names what it is about (inbox ids, the last tick time, job ids), and a text identical to one already
 * attempted is never sent again: `duplicate` is then true and `text` null. An unread message is announced
 * once, then reminded at most every INBOX_REWAKE_MS.
 */
export function planWake({ now = Date.now(), pollIntervalMs = DEFAULTS.pollIntervalMs, lastTickAt = null, wakes = [], unread = [], reported = [], filed = [], workerDeaths = [], registered = true }) {
  const tags = [];
  const announced = new Map();
  for (const w of [...wakes].reverse()) for (const id of w.payload.inbox ?? []) announced.set(id, w.at);
  const fresh = unread.filter((m) => !announced.has(m.id)).map((m) => m.id);
  const remind = unread.filter((m) => announced.has(m.id) && now - announced.get(m.id) >= INBOX_REWAKE_MS).map((m) => m.id);
  const inbox = [...fresh, ...remind];
  if (inbox.length) tags.push('inbox');
  const lastTickWake = wakes.find((w) => (w.payload.tags ?? []).includes('tick'))?.at ?? null;
  const since = Math.max(lastTickAt ?? 0, lastTickWake ?? 0);
  if (now - since >= pollIntervalMs) tags.push('tick');
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
  if (tags.includes('land')) parts.push(`[land] report(s) filed by ${land.join(', ')}: node scripts/supervisor/workers.mjs list, then land (node scripts/supervisor/land.mjs --job <id>) or redirect.`);
  if (tags.includes('report')) parts.push(`[report] ${report.join(', ')} filed a diagnosis or a blocked/failed report: node scripts/supervisor/workers.mjs show --job <id>, then decide.`);
  if (tags.includes('worker')) parts.push(`[worker] ${workerDeaths.map((d) => `${d.jobId} (${d.reason})`).join(', ')}: respawn, reassign or take it yourself.`);
  if (tags.includes('tick')) parts.push(`[tick] due (last tick ${hhmm(lastTickAt)}, last tick wake ${hhmm(lastTickWake)}): node scripts/supervisor/tick.mjs, then close every OWED cluster this tick.`);
  const text = parts.length ? `${WAKE_TAG} ${parts.join(' ')} Act until nothing is executable, then yield; never sleep or poll in a turn.` : null;
  if (text && wakes.some((w) => w.payload.text === text)) return { tags: [], inbox: [], land: [], report: [], text: null, duplicate: true };
  return { tags, inbox, land, report, text };
}

/* ------------------------------------------------------------ the pass */

async function hostDeps() {
  const [{ terminalRead }, { terminalShow }, { terminalSend }, host, liveness, closeMod, quitMod, wake, stall, config] = await Promise.all([
    import('../api/orca/terminal-read.mjs'), import('../api/orca/terminal-show.mjs'), import('../api/orca/terminal-send.mjs'), import('../kernel/host-outage.mjs'), import('../kernel/terminal-liveness.mjs'),
    import('../kernel/close-op-terminal.mjs'), import('../kernel/quit-agent.mjs'), import('../kernel/wake-delivery.mjs'), import('./stall-alert.mjs'), import('../../engine/config.mjs')]);
  const screen = (handle) => { try { const r = terminalRead({ terminal: handle, screen: true }); return r?.ok ? String(r.screen ?? '') : null; } catch { return null; } };
  const outputAge = (handle) => {
    try { const shown = terminalShow({ terminal: handle }); const at = Number(shown?.terminal?.lastOutputAt); return at > 0 ? Math.max(0, Date.now() - at) : null; } catch { return null; }
  };
  return {
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
    wake: (terminal, text) => stall.wakeKernel({ db: terminalSignalDb(terminal), workflowId: SUPERVISOR_WF, text }),
    enter: (terminal) => wake.sendEnterWithProof({ terminal }),
    quit: (handle, agent) => quitMod.quitAgent({ handle, agent }),
    close: (handle) => closeMod.closeOperationTerminal(handle),
    closeExited: (handle) => closeMod.closeExitedTerminal(handle),
    replace: () => {
      const r = spawnSync(process.execPath, [START_FILE, '--replace', '--json'], { cwd: SKILL_ROOT, encoding: 'utf8', windowsHide: true, timeout: 600_000 });
      try { return JSON.parse(String(r.stdout ?? '').trim().split(/\r?\n/).pop()); } catch { return { ok: false, action: 'replace-failed', error: String(r.stderr || r.stdout || `exit ${r.status}`).slice(0, 300) }; }
    },
    sleep: (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms),
  };
}

/** The [Worker] sweep: returns {deaths:[{jobId, reason}], closed:[...]}. */
export function sweepWorkers(ledger, d, { now = Date.now() } = {}) {
  const out = { deaths: [], closed: [] };
  for (const job of jobsOf(ledger.db, ['running', 'reported'])) {
    const handle = job.worker_id;
    if (!handle || job.payload.self || job.payload.terminalClosed) continue;
    const v = d.verdict(handle);
    if (v.verdict === 'host-unavailable' || v.verdict === 'unverified') return { ...out, skipped: v.reason };
    const screen = v.verdict === 'live' ? d.screen(handle) : null;
    const exited = screen != null && d.exitedRow(screen);
    const dead = v.verdict !== 'live' || Boolean(exited);
    const reported = job.status === 'reported' || Boolean(reportOf(ledger.db, job.job_id));
    if (reported) {
      // The worker filed its report: it should have exited; make sure its terminal is gone.
      let quit = null, closed = null;
      if (!dead) { try { quit = d.quit(handle, job.payload.agent ?? 'claude'); } catch { /* best effort */ } }
      try { closed = dead && v.verdict !== 'live' ? { ok: true, gone: true } : d.close(handle); } catch (e) { closed = { ok: false, error: String(e?.message ?? e) }; }
      if (closed?.ok || quit?.exited) {
        ledger.transaction(() => ledger.db.prepare('UPDATE jobs SET payload_json=?, updated_at=? WHERE job_id=?').run(JSON.stringify({ ...job.payload, terminalClosed: true }), now, job.job_id));
        out.closed.push({ jobId: job.job_id, handle });
      }
      continue;
    }
    if (!dead) continue;
    const reason = exited ? 'agent exited without a report' : `terminal ${v.verdict} without a report`;
    ledger.transaction(() => {
      releaseLeases(ledger, job.job_id);
      ledger.db.prepare("UPDATE jobs SET status='failed', result_json=?, payload_json=?, updated_at=? WHERE job_id=?")
        .run(JSON.stringify({ reason: 'worker-died-no-report', detail: reason }), JSON.stringify({ ...job.payload, terminalClosed: true }), now, job.job_id);
      supervisorEvent(ledger, { entityType: 'job', entityId: job.job_id, kind: 'worker-died', payload: { terminal: handle, reason, agent: job.payload.agent ?? null }, now });
    });
    if (exited) { try { d.closeExited(handle); } catch { /* best effort */ } }
    out.deaths.push({ jobId: job.job_id, reason });
  }
  return out;
}

/**
 * Why the watchdog has nothing to watch, or null: 'chat-mode' (config.yaml supervisor.mode chat - the owner's chat
 * is the Supervisor), 'disabled' (start-supervisor --stop) or 'never-started'. An unreadable ledger is not a reason.
 */
export function standDownReason({ env = process.env } = {}) {
  if (supervisorMode({ env }) === 'chat') return 'chat-mode';
  const enabled = withSupervisorRead((db) => enabledOf(db), undefined, { env });
  if (enabled === undefined) return 'never-started';
  return enabled === false ? 'disabled' : enabled === true ? null : 'never-started';
}

/** One watchdog pass. `d` = host seams. Returns {ok, action, ...}. */
export async function watchdogPass({ env = process.env, d = null, now = Date.now } = {}) {
  if (supervisorMode({ env }) === 'chat') return { ok: true, action: 'chat-mode' };
  const deps = d ?? await hostDeps();
  const settings = supervisorSettings();
  const ledger = openSupervisorLedger({ env });
  try {
    const enabled = enabledOf(ledger.db);
    if (enabled !== true) return { ok: true, action: enabled === false ? 'disabled' : 'never-started' };
    const seat = seatOf(ledger.db, now());
    let health = seatHealth(seat, deps, now());
    if (health.starting) return { ok: true, action: 'starting' };
    if (health.hostUnavailable || health.unverified) return { ok: true, action: 'host-unavailable', reason: health.reason };
    if (!health.live && seat?.value?.terminal) {
      if (deps.settleMs > 0) deps.sleep(deps.settleMs);
      health = seatHealth(seatOf(ledger.db, now()), deps, now());
      if (health.live || health.hostUnavailable || health.unverified) return { ok: true, action: 'death-unconfirmed', reason: health.reason };
    }
    if (!health.live) {
      ledger.close();
      const replaced = deps.replace();
      supervisorLog('watchdog', `replace: ${JSON.stringify(replaced)}`, { env });
      return { ok: replaced?.ok !== false, action: replaced?.action === 'booted' || replaced?.action === 'restarted' ? 'restarted' : (replaced?.action ?? 'replace-failed'), reason: health.reason, detail: replaced };
    }
    const terminal = health.terminal;
    const sweep = sweepWorkers(ledger, deps, { now: now() });
    const sup = getSupervisor(SUPERVISOR_ID, env);
    const registered = Boolean(sup && sup.terminal === terminal);
    if (registered) heartbeatSupervisor(SUPERVISOR_ID, { env });
    const unread = readInbox(SUPERVISOR_ID, env).filter((m) => !m.read);
    const reported = jobsOf(ledger.db, ['reported']).map((j) => j.job_id);
    const filed = filedReports(ledger.db, now());
    const plan = planWake({ now: now(), pollIntervalMs: settings.pollIntervalMs, lastTickAt: lastEvent(ledger.db, 'supervisor-tick')?.at ?? null,
      wakes: recentWakes(ledger.db), unread, reported, filed, workerDeaths: sweep.deaths, registered });
    if (!plan.text) return { ok: true, action: 'idle', terminal, registered, workers: sweep };
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
      const frozen = frozenBusyFrame({ signature, prev: busyFrameOf(ledger.db, terminal), now: now(), outputAgeMs, frozenMs: settings.frozenMinutes * 60_000 });
      ledger.transaction(() => putBusyFrame(ledger, terminal, frozen.state, now()));
      if (!frozen.frozen) return { ok: true, action: 'busy', state: busy, terminal, pending: plan.tags };
      // A frozen pane is not a busy seat: Escape an input row aimed at a subagent, then the proven wake.
      const escaped = deps.escape && SUBAGENT_INPUT.test(frame) ? deps.escape(terminal) : null;
      const woke = deps.wake(terminal, plan.text);
      const after = deps.screen(terminal);
      const stillFrozen = after != null && busySignature(after) === signature;
      ledger.transaction(() => supervisorEvent(ledger, { kind: 'supervisor-wake', now: now(), payload: { tags: plan.tags, inbox: plan.inbox, land: plan.land, report: plan.report, text: plan.text,
        delivered: woke.delivered === true, action: woke.action,
        frozen: { signature, since: frozen.state.since, reads: frozen.state.reads, outputAgeMs, state: busy, escaped: escaped == null ? null : escaped.ok === true } } }));
      if (stillFrozen) {
        ledger.transaction(() => supervisorEvent(ledger, { kind: 'supervisor-frozen-replace', now: now(), payload: { terminal, signature, since: frozen.state.since, reads: frozen.state.reads, wake: woke.action ?? null } }));
        ledger.close();
        const replaced = deps.replace();
        supervisorLog('watchdog', `frozen-replace: ${JSON.stringify(replaced)}`, { env });
        return { ok: replaced?.ok !== false, action: replaced?.action === 'booted' || replaced?.action === 'restarted' ? 'restarted' : (replaced?.action ?? 'replace-failed'), terminal, tags: plan.tags, detail: replaced };
      }
      return { ok: woke.delivered === true || woke.action === 'kernel-busy', action: woke.delivered ? 'frozen-woken' : woke.action, terminal, tags: plan.tags, workers: sweep };
    }
    if (busy) return { ok: true, action: 'busy', state: busy, terminal, pending: plan.tags };
    ledger.db.prepare('DELETE FROM signals WHERE scope=?').run(BUSY_SCOPE);
    const woke = deps.wake(terminal, plan.text);
    ledger.transaction(() => supervisorEvent(ledger, { kind: 'supervisor-wake', now: now(), payload: { tags: plan.tags, inbox: plan.inbox, land: plan.land, report: plan.report, text: plan.text, delivered: woke.delivered === true, action: woke.action } }));
    return { ok: woke.delivered === true || woke.action === 'kernel-busy', action: woke.delivered ? 'woken' : woke.action, terminal, tags: plan.tags, workers: sweep };
  } finally { try { ledger.close(); } catch { /* closed above */ } }
}

/* ------------------------------------------------------------ the loop */

/** Cheap facts for the loop: does anything want a full pass now? */
export function wantsPass({ env = process.env, now = Date.now(), lastFullAt = 0, settings = supervisorSettings() } = {}) {
  return withSupervisorRead((db) => {
    if (enabledOf(db) !== true) return null;
    if (now - lastFullAt >= LIVENESS_MS) return 'liveness';
    const wakes = recentWakes(db);
    const announced = new Set(wakes.filter((w) => now - w.at < INBOX_REWAKE_MS).flatMap((w) => w.payload.inbox ?? []));
    if (readInbox(SUPERVISOR_ID, env).some((m) => !m.read && !announced.has(m.id))) return 'inbox';
    const tick = lastEvent(db, 'supervisor-tick')?.at ?? 0;
    const wake = wakes.find((w) => (w.payload.tags ?? []).includes('tick'))?.at ?? 0;
    if (now - Math.max(tick, wake) >= settings.pollIntervalMs) return 'tick';
    if (jobsOf(db, ['reported']).some((j) => !j.payload.terminalClosed)) return 'land';
    const reportAnnounced = new Set(wakes.flatMap((w) => w.payload.report ?? []));
    if (filedReports(db, now).some((id) => !reportAnnounced.has(id))) return 'report';
    if (jobsOf(db, ['running']).some((j) => !j.payload.self) && now - lastFullAt >= 60_000) return 'workers';
    return null;
  }, null, { env });
}

/** What the loop process itself runs; a change to one of them (or a new runtime HEAD) reloads the loop. */
export const reloadWatchedFiles = (root = SKILL_ROOT) => [
  'scripts/supervisor/watchdog.mjs', 'scripts/supervisor/home.mjs', 'scripts/supervisor/start-supervisor.mjs', 'scripts/supervisor/workers.mjs',
  'scripts/connectors/telegram-bridge.mjs', 'scripts/connectors/lib.mjs', 'scripts/lib/self-reload.mjs', 'engine/config.mjs',
].map((rel) => path.join(root, ...rel.split('/')));

/** Consecutive checks that must agree on a stand-down reason before the loop exits. */
export const STAND_DOWN_CHECKS = 2;

/**
 * The loop. `standDown` names why there is nothing to watch (standDownReason); once STAND_DOWN_CHECKS consecutive
 * checks agree, it returns {exited: reason} - the caller exits 0. After each sleep `watch` (createReloadWatch) is
 * asked whether the runtime changed; `reload` (reexecSelf) then hands the lock to a replacement and the loop returns
 * {reloaded: pid}. The seams are injectable (specs).
 */
export async function runLoop({ env = process.env, claim = () => claimOrTakeOver('supervisor-watchdog', { from: env[RELOAD_ENV.handoverFrom], env }), standDown = () => standDownReason({ env }),
  pass = null, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), log = (line) => supervisorLog('watchdog', line, { env }), maxIterations = Infinity,
  watch = null, reload = null } = {}) {
  const held = claim();
  if (!held.ok) return { already: true, pid: held.holder?.pid ?? null };
  if (held.takenOver) log(`loop ${process.pid} took over the lock (reload)`);
  const onSignal = () => { held.release(); process.exit(0); };
  process.on('exit', held.release);
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, onSignal);
  log(`loop ${process.pid} started`);
  let lastFullAt = 0, downReason = null, downSeen = 0;
  try {
    for (let i = 0; i < maxIterations; i += 1) {
      let down = null;
      try { down = standDown(); } catch { down = null; }
      downSeen = down && down === downReason ? downSeen + 1 : down ? 1 : 0;
      downReason = down;
      if (down && downSeen >= STAND_DOWN_CHECKS) { log(`loop ${process.pid} exits: ${down}`); return { exited: down }; }
      if (!down) lastFullAt = await (pass ?? loopPass)({ lastFullAt, env });
      await sleep(LOOP_MS);
      const check = watch?.check();
      if (check?.reload && reload) {
        watch.markAttempt();
        const handed = await reload(check);
        log(`loop ${process.pid} ${handed.ok ? `reloaded: pid ${handed.pid} took over` : `reload failed: ${handed.error}`} (${check.reason})`);
        if (handed.ok) return { reloaded: handed.pid };
      }
    }
    return { exited: null };
  } finally {
    held.release();
    process.removeListener('exit', held.release);
    for (const sig of ['SIGINT', 'SIGTERM']) process.removeListener(sig, onSignal);
  }
}

/** One loop iteration's pass: a fresh --once child when something wants it. Returns the new lastFullAt. */
function loopPass({ lastFullAt }) {
  let reason = null;
  try { reason = wantsPass({ lastFullAt }); } catch (e) { reason = `check-failed ${String(e?.message ?? e).slice(0, 80)}`; }
  if (!reason) return lastFullAt;
  const at = Date.now();
  const child = spawnSync(process.execPath, [selfFile, '--once', '--json'], { cwd: SKILL_ROOT, encoding: 'utf8', windowsHide: true, timeout: 900_000 });
  const line = String(child.stdout ?? '').trim().split(/\r?\n/).filter(Boolean).pop() ?? '';
  let r = null;
  try { r = JSON.parse(line); } catch { r = { ok: false, action: 'pass-failed', error: String(child.stderr || line || `exit ${child.status}`).slice(0, 300) }; }
  if (r.action !== 'idle' || reason !== 'liveness') supervisorLog('watchdog', `${reason}: ${JSON.stringify(r).slice(0, 600)}`);
  return at;
}

async function loop() {
  const lastReloadAt = Number(process.env[RELOAD_ENV.reloadedAt]) || null;
  const watch = createReloadWatch({ root: SKILL_ROOT, files: reloadWatchedFiles(), lastReloadAt });
  const reload = () => reexecSelf({ script: selfFile, args: process.argv.slice(2), logFile: path.join(logsRoot(), 'watchdog.log'), lockName: 'supervisor-watchdog', cwd: SKILL_ROOT });
  const r = await runLoop({ watch, reload });
  if (r.reloaded) process.exit(0);
  if (r.already) console.log(JSON.stringify({ ok: true, already: true, pid: r.pid }));
  else if (r.exited) console.log(JSON.stringify({ ok: true, exited: r.exited }));
  process.exit(0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) {
  if (process.argv.includes('--once')) {
    const r = await watchdogPass();
    console.log(process.argv.includes('--json') ? JSON.stringify(r) : `[Supervisor watchdog] ${r.action}${r.terminal ? ` ${r.terminal}` : ''}${r.tags ? ` ${r.tags.join(',')}` : ''}`);
    process.exit(r.ok ? 0 : 1);
  } else await loop();
}
