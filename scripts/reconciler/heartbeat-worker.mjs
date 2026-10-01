// scripts/reconciler/heartbeat-worker.mjs — the engine's heartbeat that survives a blocked main thread (MB-04, ENGINE-STALL).
//
// Why: the engine renews its lease and heartbeat from timers on its main thread. One synchronous duty (a spawnSync of the
// process-table query, a blocking SQLite busy wait, a long synchronous scan) blocks that thread, so no timer fires: on
// 2026-09-29 14:06-14:15 two engines went silent for 3 and 5 minutes with a `host run node` child in flight, boot.mjs
// ensure killed both as hung, and the crash-loop guard then forced the whole host into safe mode.
//
// What: a worker thread with its OWN machine.sqlite connection. The main thread touches a shared stamp (a 1 s interval and
// every phase change) and tells the worker its leadership (epoch, holder, process run, draining) and the phase it is in.
//   - the worker is the ONLY periodic renewer: every renewMs it renews engine_leader (fenced on holder + epoch) and the
//     process run heartbeat, so no duty, drain or blocked main thread ever lets the lease lapse or gets a working engine
//     killed (the main thread's step() only checks that it still leads);
//   - main thread blocked >= stallMaxMs: the worker stops renewing (a really hung engine must go stale so ensure replaces
//     it) and says so once;
//   - every stall that lasts STALL_LOG_MS gets one reconciler.loop-stalled row (machine_logs actor reconciler) with the
//     phase the main thread entered last, the duties running, the process CPU / RSS / fault deltas (spinning vs starved vs
//     paged out), and a resume row when it ends. That is the evidence the 14:10 stall did not leave behind.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { openMachine } from '../../engine/db/machine.mjs';

const selfFile = fileURLToPath(import.meta.url);
/** The main thread ticks every second; not ticking for this long is a stall. */
export const STALL_MIN_MS = 3000;
/** A stall this long is written to machine_logs (then again every STALL_REPEAT_MS). */
export const STALL_LOG_MS = 15_000;
export const STALL_REPEAT_MS = 60_000;
/** Default: past this a blocked main thread is a hung engine; the worker stops renewing so ensure replaces it. */
export const DEFAULT_STALL_MAX_MS = 300_000;

/** Pure: what the worker does at a tick, the main thread not ticking for `stallMs`. {renew, log, withheld}. */
export function heartbeatPlan({ stallMs, leader, renewDue = true, stallMaxMs = DEFAULT_STALL_MAX_MS, loggedAt = null, sinceMs = 0 }) {
  const withheld = stallMs >= stallMaxMs;
  const log = stallMs >= STALL_LOG_MS && (loggedAt == null || sinceMs - loggedAt >= STALL_REPEAT_MS);
  return { renew: Boolean(leader) && renewDue && !withheld, log, withheld };
}

/* ------------------------------------------------------------ the main-thread side */

/**
 * Start the worker. Returns {touch, notify, phase, running, stop}; every call is best effort and never throws (a worker
 * that cannot start leaves the engine with its own timers, as before).
 */
export function startHeartbeatWorker({ file, leaseMs, renewMs, stallMaxMs = DEFAULT_STALL_MAX_MS, env = process.env } = {}) {
  const noop = { touch() {}, notify() {}, phase() {}, running() {}, stop: () => Promise.resolve(), active: false };
  if (!file) return noop;
  try {
    const t0 = Date.now();
    const sab = new SharedArrayBuffer(4);
    const stamp = new Int32Array(sab);
    const worker = new Worker(selfFile, { workerData: { heartbeat: true, file, leaseMs, renewMs, stallMaxMs, t0, sab }, env, name: 'reconciler-heartbeat-worker' });
    worker.unref();
    let dead = false;
    const exited = new Promise((resolve) => { worker.on('exit', () => { dead = true; resolve(); }); });
    worker.on('error', () => { dead = true; });
    const send = (msg) => { if (!dead) { try { worker.postMessage(msg); } catch { dead = true; } } };
    const touch = () => Atomics.store(stamp, 0, Math.floor((Date.now() - t0) / 100));
    touch();
    return {
      active: true,
      touch,
      notify: (patch) => send({ type: 'state', patch }),
      phase: (label) => { touch(); send({ type: 'phase', label: String(label).slice(0, 160), at: Date.now() }); },
      running: (labels) => send({ type: 'running', labels: [...labels].slice(0, 12).map((l) => String(l).slice(0, 120)) }),
      // asks the worker to close its connection and end; resolves when it has (terminated after 1 s regardless)
      stop: () => {
        worker.ref(); // an unref'd worker would let the process end before its exit is seen
        if (!dead) { try { worker.postMessage({ type: 'close' }); } catch { /* gone */ } }
        const kill = setTimeout(() => { try { worker.terminate(); } catch { /* gone */ } }, 1000);
        return exited.finally(() => clearTimeout(kill));
      },
    };
  } catch { return noop; }
}

/* ------------------------------------------------------------ the worker side */

function workerMain({ file, leaseMs, renewMs, stallMaxMs, t0, sab }) {
  const stamp = new Int32Array(sab);
  let m = null;
  const machine = () => { if (!m) m = openMachine({ file, env: process.env }); return m; };
  const st = { leader: false, epoch: 0, holder: null, runId: null, draining: false, phase: null, phaseAt: 0, running: [] };
  let stalledAt = null, loggedAt = null, withheldLogged = false, lastRenewAt = 0, prev = null;

  parentPort.on('message', (msg) => {
    if (msg?.type === 'state') Object.assign(st, msg.patch ?? {});
    else if (msg?.type === 'phase') { st.phase = msg.label; st.phaseAt = msg.at; }
    else if (msg?.type === 'running') st.running = msg.labels ?? [];
    else if (msg?.type === 'close') { try { m?.close(); } catch { /* closed */ } process.exit(0); }
  });

  const sample = () => {
    const ru = process.resourceUsage();
    const at = Date.now();
    const now = { at, cpuMs: Math.round((ru.userCPUTime + ru.systemCPUTime) / 1000), majorFaults: ru.majorPageFault, ioRead: ru.fsRead, ioWrite: ru.fsWrite };
    const out = { rssMb: Math.round(process.memoryUsage.rss() / 1048576), freeMemMb: Math.round(os.freemem() / 1048576), cpuMs: now.cpuMs, majorFaults: now.majorFaults,
      ...(prev ? { sinceMs: at - prev.at, cpuDeltaMs: now.cpuMs - prev.cpuMs, faultDelta: now.majorFaults - prev.majorFaults, fsReadDelta: now.ioRead - prev.ioRead, fsWriteDelta: now.ioWrite - prev.ioWrite } : {}) };
    prev = now;
    return out;
  };
  const write = (level, msg, data) => {
    try { machine().log({ actor: 'reconciler', kind: 'reconciler.event', level, msg, data: { kind: 'reconciler.loop-stalled', controller: 'engine', ...data }, refs: ['reconciler:engine'] }); } catch { /* best effort */ }
  };

  const renew = () => {
    try {
      const db = machine();
      const row = db.leaderOf('reconciler');
      if (!row || row.holder !== st.holder || Number(row.epoch) !== Number(st.epoch)) return false; // somebody else leads now: not ours to renew
      const ok = db.renewLeader({ name: 'reconciler', epoch: st.epoch, leaseMs, draining: st.draining });
      if (st.runId != null) db.heartbeatProcessRun(st.runId, { draining: st.draining });
      lastRenewAt = Date.now();
      return ok;
    } catch { return false; } // busy: the next tick retries
  };

  const tick = () => {
    const now = Date.now();
    const stallMs = now - (t0 + Atomics.load(stamp, 0) * 100);
    const renewDue = now - lastRenewAt >= renewMs;
    if (stallMs < STALL_MIN_MS) {
      if (st.leader && renewDue) renew();
      if (stalledAt != null) {
        if (loggedAt != null) write('info', `engine main thread resumed after ${Math.round((now - stalledAt) / 1000)}s (last phase: ${st.phase ?? '-'})`, { resumed: true, stalledMs: now - stalledAt, phase: st.phase, ...sample() });
        stalledAt = null; loggedAt = null; withheldLogged = false; prev = null;
      }
      return;
    }
    if (stalledAt == null) { stalledAt = now - stallMs; sample(); }
    const plan = heartbeatPlan({ stallMs, leader: st.leader, renewDue, stallMaxMs, loggedAt: loggedAt == null ? null : loggedAt - stalledAt, sinceMs: now - stalledAt });
    if (plan.renew) renew();
    if (plan.log) {
      loggedAt = now;
      write('warn', `engine main thread blocked ${Math.round(stallMs / 1000)}s in ${st.phase ?? 'an unknown phase'}${plan.withheld ? ' (heartbeat withheld: past the stall limit)' : st.leader ? ' (heartbeat carried by the worker)' : ''}`,
        { stallMs, phase: st.phase, phaseAgeMs: st.phaseAt ? now - st.phaseAt : null, running: st.running, epoch: st.epoch, withheld: plan.withheld, stallMaxMs, ...sample() });
    }
    if (plan.withheld && !withheldLogged) {
      withheldLogged = true;
      write('error', `engine main thread blocked past ${Math.round(stallMaxMs / 1000)}s: the worker stops renewing so boot ensure replaces this engine`, { stallMs, phase: st.phase, running: st.running, withheld: true });
    }
  };
  setInterval(tick, Math.max(1000, Math.min(2500, Math.floor(renewMs / 4)))).unref?.();
  // the worker keeps the event loop of ITS thread alive; the main thread's exit ends it (worker.unref)
  setInterval(() => {}, 1 << 30);
}

if (!isMainThread && workerData?.heartbeat) workerMain(workerData);
