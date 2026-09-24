// scripts/lib/self-reload.mjs — a long-lived runtime loop re-execs itself when the runtime it runs from changes.
//
// Why: a watchdog loop imports its modules once. Every runtime fix to what the loop itself runs (its own file,
// the liveness classifier, the cards, the api helpers) needed a manual restart of every watchdog; on 2026-09-25
// the supervisor restarted all 9 kernel watchdogs by hand after a liveness fix landed.
//
//   createReloadWatch({root, files})  a cheap check per tick: the runtime's HEAD (`git rev-parse HEAD` of `root`)
//                                     and the mtime of each watched file, against the baseline read at start.
//                                     A change reloads at most once per RELOAD_MIN_INTERVAL_MS (restart-storm
//                                     guard); a change seen inside that window stays pending until it opens.
//   reexecSelf({script, args, ...})   spawn the replacement with the same argv, detached and hidden like
//                                     resume-all's spawnWatchdog, stdout/stderr appended to the same log file,
//                                     then wait until it has taken over the singleton lock (handover, never a
//                                     gap). The caller exits only after that; a replacement that does not take
//                                     the lock in time is stopped and this loop keeps running (and its lock).
//
// The replacement learns it is one through RELOAD_ENV: HANDOVER_FROM (the pid whose lock it takes over,
// connectors/lib.mjs claimOrTakeOver) and RELOADED_AT (the guard's clock across the re-exec).
import fs from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { lockHolder, reassertManager } from '../connectors/lib.mjs';

export const RELOAD_MIN_INTERVAL_MS = 5 * 60_000;
export const HANDOVER_WAIT_MS = 30_000;
export const RELOAD_ENV = Object.freeze({ handoverFrom: 'STARCI_RELOAD_HANDOVER_FROM', reloadedAt: 'STARCI_RELOADED_AT' });

/** The runtime checkout's HEAD commit, or null when git does not answer. */
export function runtimeHead({ root, run = spawnSync } = {}) {
  try {
    const r = run('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true, timeout: 10_000 });
    const sha = String(r?.stdout ?? '').trim();
    return r?.status === 0 && /^[0-9a-f]{40,64}$/.test(sha) ? sha : null;
  } catch { return null; }
}

/** {file: mtimeMs | null} for each watched file (null: missing or unreadable). */
export function moduleStamps(files, { stat = fs.statSync } = {}) {
  const out = {};
  for (const file of files ?? []) {
    try { out[file] = stat(file).mtimeMs; } catch { out[file] = null; }
  }
  return out;
}

/**
 * The per-tick reload check. `head` and `stamps` are the seams (a spec passes a fake git and fake mtimes),
 * `now` the clock, `lastReloadAt` the time of the reload that started this process (RELOAD_ENV.reloadedAt), if any.
 * check() returns {reload, reason, changes, pendingMs?}: reload is true only when something changed AND no
 * reload happened in the last minIntervalMs. An unreadable HEAD is no change; a baseline read while git did
 * not answer is taken from the first answer instead.
 */
export function createReloadWatch({ root = null, files = [], head = () => runtimeHead({ root }), stamps = () => moduleStamps(files),
  now = Date.now, minIntervalMs = RELOAD_MIN_INTERVAL_MS, lastReloadAt = null } = {}) {
  const baseline = { head: head(), stamps: stamps() };
  let last = Number.isFinite(lastReloadAt) ? lastReloadAt : null;
  const check = () => {
    const changes = [];
    const current = head();
    if (baseline.head == null) baseline.head = current;
    else if (current != null && current !== baseline.head) changes.push({ kind: 'head', from: baseline.head, to: current });
    const seen = stamps();
    for (const [file, mtime] of Object.entries(seen)) {
      const before = baseline.stamps[file];
      if (before === undefined) { baseline.stamps[file] = mtime; continue; }
      if (mtime !== before) changes.push({ kind: 'mtime', file, from: before, to: mtime });
    }
    if (!changes.length) return { reload: false, reason: null, changes };
    const reason = changes.map((c) => (c.kind === 'head' ? `runtime HEAD ${String(c.from).slice(0, 9)} -> ${String(c.to).slice(0, 9)}` : `${c.file} changed`)).join('; ');
    const at = now();
    if (last != null && at - last < minIntervalMs) return { reload: false, deferred: true, reason, changes, pendingMs: minIntervalMs - (at - last) };
    return { reload: true, reason, changes };
  };
  /** Record a reload attempt (a failed handover too), so the next one waits a full interval. */
  const markAttempt = (at = now()) => { last = at; };
  return { baseline, check, markAttempt, lastReloadAt: () => last };
}

/**
 * Re-exec `script` with `args` as a detached, hidden replacement whose stdout/stderr append to `logFile`, and
 * hand it the singleton lock `lockName`. Waits up to waitMs for the lock to name the replacement.
 * Returns {ok:true, pid} (the caller exits now, without releasing the lock) or {ok:false, pid, error} (the
 * replacement was stopped; the lock is this process's again). Every host effect is a seam for the specs.
 */
export async function reexecSelf({ script, args = [], logFile, lockName, env = process.env, cwd = process.cwd(), now = Date.now,
  waitMs = HANDOVER_WAIT_MS, pollMs = 200, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  holder = (name) => lockHolder(name, env), spawnChild = spawnDetachedLogged,
  kill = (pid) => { try { process.kill(pid); } catch { /* gone */ } }, reclaim = (name) => reassertManager(name, { env }), selfPid = process.pid } = {}) {
  const childEnv = { ...env, [RELOAD_ENV.handoverFrom]: String(selfPid), [RELOAD_ENV.reloadedAt]: String(now()) };
  let child;
  try { child = spawnChild({ execPath: process.execPath, script, args, logFile, env: childEnv, cwd }); }
  catch (error) { return { ok: false, pid: null, error: `spawn failed: ${String(error?.message ?? error)}` }; }
  const pid = child?.pid ?? null;
  if (!pid) return { ok: false, pid: null, error: 'the replacement did not start' };
  const deadline = now() + waitMs;
  for (;;) {
    const held = holder(lockName);
    if (held?.pid === pid) return { ok: true, pid };
    if (child.exited?.()) break;
    if (now() >= deadline) break;
    await sleep(pollMs);
  }
  kill(pid);
  // The replacement may have taken the lock between the last read and the kill: take it back.
  const after = holder(lockName);
  if (after?.pid === pid || !after) reclaim?.(lockName);
  return { ok: false, pid, error: child.exited?.() ? `the replacement exited before taking the lock ${lockName}` : `the replacement did not take the lock ${lockName} within ${waitMs}ms` };
}

/** spawn node <script> ...args detached, hidden, stdio appended to logFile; {pid, exited()}. */
export function spawnDetachedLogged({ execPath = process.execPath, script, args = [], logFile, env, cwd }) {
  const fd = logFile ? fs.openSync(logFile, 'a') : 'ignore';
  try {
    let gone = false;
    const child = spawn(execPath, [script, ...args], { detached: true, stdio: ['ignore', fd, fd], windowsHide: true, cwd, env });
    child.on('exit', () => { gone = true; });
    child.on('error', () => { gone = true; });
    child.unref();
    return { pid: child.pid ?? null, exited: () => gone };
  } finally { if (typeof fd === 'number') fs.closeSync(fd); }
}
