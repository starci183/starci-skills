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
// The loop checks cheap facts every LOOP_MS (inbox, tick due, reports, running workers) and runs a full pass as
// a fresh `--once` child when one needs acting on, and at least every LIVENESS_MS, so a runtime fix reaches a
// running watchdog on its next pass.
import '../lib/hide-child-windows.mjs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { claimManager } from '../connectors/lib.mjs';
import { readInbox, getSupervisor, heartbeatSupervisor } from '../connectors/telegram-bridge.mjs';
import {
  SKILL_ROOT, SUPERVISOR_ID, SUPERVISOR_WF, openSupervisorLedger, withSupervisorRead, seatOf, enabledOf, supervisorEvent, supervisorSettings,
  terminalSignalDb, supervisorLog,
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
const delivered = (db) => db.prepare("SELECT payload_json, created_at FROM events WHERE workflow_id=? AND kind='supervisor-wake' ORDER BY seq DESC LIMIT 20").all(SUPERVISOR_WF)
  .map((e) => ({ at: e.created_at, payload: parse(e.payload_json) })).filter((e) => e.payload.delivered);

/**
 * What the Supervisor should be woken for. Pure over its inputs. Returns {tags, inbox, land, text}.
 * `wakes` are the recent delivered wakes (newest first); `unread` the unread inbox items; `reported` the job
 * ids with a report not yet announced; `workerDeaths` the jobs the sweep just failed.
 */
export function planWake({ now = Date.now(), pollIntervalMs = 600_000, lastTickAt = null, wakes = [], unread = [], reported = [], workerDeaths = [], registered = true }) {
  const tags = [];
  const announced = new Map();
  for (const w of [...wakes].reverse()) for (const id of w.payload.inbox ?? []) announced.set(id, w.at);
  const inbox = unread.filter((m) => !announced.has(m.id) || now - announced.get(m.id) >= INBOX_REWAKE_MS).map((m) => m.id);
  if (inbox.length) tags.push('inbox');
  const lastTickWake = wakes.find((w) => (w.payload.tags ?? []).includes('tick'))?.at ?? null;
  const since = Math.max(lastTickAt ?? 0, lastTickWake ?? 0);
  if (now - since >= pollIntervalMs) tags.push('tick');
  const landAnnounced = new Set(wakes.flatMap((w) => w.payload.land ?? []));
  const land = reported.filter((id) => !landAnnounced.has(id));
  if (land.length) tags.push('land');
  if (workerDeaths.length) tags.push('worker');
  if (!registered) tags.push('register');
  const parts = [];
  if (tags.includes('register')) parts.push(`[register] channel '${SUPERVISOR_ID}' is not registered from this terminal: node scripts/supervisor/channel.mjs register --id ${SUPERVISOR_ID} --label "Supervisor".`);
  if (tags.includes('inbox')) parts.push(`[inbox] ${unread.length} unread message(s): node scripts/supervisor/channel.mjs inbox --id ${SUPERVISOR_ID}, then reply to each (--to <inboxId>).`);
  if (tags.includes('land')) parts.push(`[land] report(s) filed by ${land.join(', ')}: node scripts/supervisor/workers.mjs list, then land (node scripts/supervisor/land.mjs --job <id>) or redirect.`);
  if (tags.includes('worker')) parts.push(`[worker] ${workerDeaths.map((d) => `${d.jobId} (${d.reason})`).join(', ')}: respawn, reassign or take it yourself.`);
  if (tags.includes('tick')) parts.push('[tick] due: node scripts/supervisor/tick.mjs, then close every OWED cluster this tick.');
  const text = parts.length ? `${WAKE_TAG} ${parts.join(' ')} Act until nothing is executable, then yield; never sleep or poll in a turn.` : null;
  return { tags, inbox, land, text };
}

/* ------------------------------------------------------------ the pass */

async function hostDeps() {
  const [{ terminalRead }, { terminalShow }, host, liveness, closeMod, quitMod, wake, stall, config] = await Promise.all([
    import('../api/orca/terminal-read.mjs'), import('../api/orca/terminal-show.mjs'), import('../kernel/host-outage.mjs'), import('../kernel/terminal-liveness.mjs'),
    import('../kernel/close-op-terminal.mjs'), import('../kernel/quit-agent.mjs'), import('../kernel/wake-delivery.mjs'), import('./stall-alert.mjs'), import('../../engine/config.mjs')]);
  const screen = (handle) => { try { const r = terminalRead({ terminal: handle, screen: true }); return r?.ok ? String(r.screen ?? '') : null; } catch { return null; } };
  return {
    verdict: (h) => host.kernelTerminalVerdict(h), screen, exitedRow: liveness.exitedAgentPromptRow, settleMs: host.DEATH_SETTLE_MS,
    state: (handle) => {
      const s = screen(handle);
      if (s == null) return 'unreadable';
      let age = null;
      try { const shown = terminalShow({ terminal: handle }); const at = Number(shown?.terminal?.lastOutputAt); age = at > 0 ? Date.now() - at : null; } catch { /* unknown */ }
      let stale = null;
      try { stale = config.allocationMs('liveness.activeStaleMs'); } catch { /* none */ }
      return liveness.staleAwareState(liveness.classifyAgentScreen(s).state, age, stale).state;
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

/** One watchdog pass. `d` = host seams. Returns {ok, action, ...}. */
export async function watchdogPass({ env = process.env, d = null, now = Date.now } = {}) {
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
    const plan = planWake({ now: now(), pollIntervalMs: settings.pollIntervalMs, lastTickAt: lastEvent(ledger.db, 'supervisor-tick')?.at ?? null,
      wakes: delivered(ledger.db), unread, reported, workerDeaths: sweep.deaths, registered });
    if (!plan.text) return { ok: true, action: 'idle', terminal, registered, workers: sweep };
    const state = deps.state(terminal);
    if (state === 'queued-input' || state === 'staged-input') {
      const proof = deps.enter(terminal);
      return { ok: proof?.ok === true, action: `${state}-sent`, terminal, tags: plan.tags };
    }
    if (state !== 'turn-idle') return { ok: true, action: 'busy', state, terminal, pending: plan.tags };
    const woke = deps.wake(terminal, plan.text);
    ledger.transaction(() => supervisorEvent(ledger, { kind: 'supervisor-wake', now: now(), payload: { tags: plan.tags, inbox: plan.inbox, land: plan.land, delivered: woke.delivered === true, action: woke.action } }));
    return { ok: woke.delivered === true || woke.action === 'kernel-busy', action: woke.delivered ? 'woken' : woke.action, terminal, tags: plan.tags, workers: sweep };
  } finally { try { ledger.close(); } catch { /* closed above */ } }
}

/* ------------------------------------------------------------ the loop */

/** Cheap facts for the loop: does anything want a full pass now? */
export function wantsPass({ env = process.env, now = Date.now(), lastFullAt = 0, settings = supervisorSettings() } = {}) {
  return withSupervisorRead((db) => {
    if (enabledOf(db) !== true) return null;
    if (now - lastFullAt >= LIVENESS_MS) return 'liveness';
    const wakes = delivered(db);
    const announced = new Set(wakes.filter((w) => now - w.at < INBOX_REWAKE_MS).flatMap((w) => w.payload.inbox ?? []));
    if (readInbox(SUPERVISOR_ID, env).some((m) => !m.read && !announced.has(m.id))) return 'inbox';
    const tick = lastEvent(db, 'supervisor-tick')?.at ?? 0;
    const wake = wakes.find((w) => (w.payload.tags ?? []).includes('tick'))?.at ?? 0;
    if (now - Math.max(tick, wake) >= settings.pollIntervalMs) return 'tick';
    if (jobsOf(db, ['reported']).some((j) => !j.payload.terminalClosed)) return 'land';
    if (jobsOf(db, ['running']).some((j) => !j.payload.self) && now - lastFullAt >= 60_000) return 'workers';
    return null;
  }, null, { env });
}

async function loop() {
  const claim = claimManager('supervisor-watchdog');
  if (!claim.ok) { console.log(JSON.stringify({ ok: true, already: true, pid: claim.holder?.pid ?? null })); return; }
  process.on('exit', claim.release);
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { claim.release(); process.exit(0); });
  supervisorLog('watchdog', `loop ${process.pid} started`);
  let lastFullAt = 0;
  for (;;) {
    let reason = null;
    try { reason = wantsPass({ lastFullAt }); } catch (e) { reason = `check-failed ${String(e?.message ?? e).slice(0, 80)}`; }
    if (reason) {
      lastFullAt = Date.now();
      const child = spawnSync(process.execPath, [selfFile, '--once', '--json'], { cwd: SKILL_ROOT, encoding: 'utf8', windowsHide: true, timeout: 900_000 });
      const line = String(child.stdout ?? '').trim().split(/\r?\n/).filter(Boolean).pop() ?? '';
      let r = null;
      try { r = JSON.parse(line); } catch { r = { ok: false, action: 'pass-failed', error: String(child.stderr || line || `exit ${child.status}`).slice(0, 300) }; }
      if (r.action !== 'idle' || reason !== 'liveness') supervisorLog('watchdog', `${reason}: ${JSON.stringify(r).slice(0, 600)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, LOOP_MS));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) {
  if (process.argv.includes('--once')) {
    const r = await watchdogPass();
    console.log(process.argv.includes('--json') ? JSON.stringify(r) : `[Supervisor watchdog] ${r.action}${r.terminal ? ` ${r.terminal}` : ''}${r.tags ? ` ${r.tags.join(',')}` : ''}`);
    process.exit(r.ok ? 0 : 1);
  } else await loop();
}
