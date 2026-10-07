// scripts/machine/self-reload.mjs — a long-lived runtime loop (the reconciler engine, the Telegram bridge) re-execs itself when the runtime it runs from changes.
//
// Why: a watchdog loop imports its modules once. Every runtime fix to what the loop itself runs (its own file,
// the liveness classifier, the cards, the api helpers) needed a manual restart of every watchdog; on 2026-09-25
// the supervisor restarted all 9 kernel watchdogs by hand after a liveness fix landed.
//
//   createReloadWatch({root, files})  a cheap check per tick: the runtime's HEAD (`git rev-parse HEAD` of `root`)
//                                     and the mtime of each watched file, against the baseline read at start.
//                                     With `headPaths`, a new HEAD counts only when it changed a file under them.
//                                     A change reloads at most once per RELOAD_MIN_INTERVAL_MS (restart-storm
//                                     guard); a change seen inside that window stays pending until it opens.
//   reexecSelf({script, args, ...})   spawn the replacement with the same argv, detached and hidden like
//                                     resume-all's spawnWatchdog (its stdout/stderr discarded: a loop logs to
//                                     machine_logs itself), then wait until it has taken over the singleton host
//                                     lock (handover, never a gap). The caller exits only after that; a
//                                     replacement that does not take the lock in time is stopped and this loop
//                                     keeps running (and its lock). Every attempt is one machine_logs row
//                                     (kind self-reload.handover, under the caller's actor).
//
// The replacement learns it is one through RELOAD_ENV: HANDOVER_FROM (the pid whose host lock it takes over,
// connectors/lib.mjs claimOrTakeOver) and RELOADED_AT (the guard's clock across the re-exec).
import fs from 'node:fs';
import path from 'node:path';
import { revParse } from '../api/git/rev-parse.mjs';
import { diffNames } from '../api/git/diff-names.mjs';
import { spawnDetachedSilent } from '../api/process/spawn-detached-silent.mjs';
import { machineLog } from '../../engine/db/machine.mjs';
import { allocationMs } from '../../engine/config.mjs';
import { sleep as sleepAsync } from '../lib/sleep.mjs';

export const RELOAD_MIN_INTERVAL_MS = allocationMs('selfReload.minIntervalMs');
export const HANDOVER_WAIT_MS = allocationMs('selfReload.handoverMs');
export const RELOAD_ENV = Object.freeze({ handoverFrom: 'STARCI_RELOAD_HANDOVER_FROM', reloadedAt: 'STARCI_RELOADED_AT' });

/** The runtime checkout's HEAD commit, or null when git does not answer. git: a runner for the specs (api/git gitRunner shape). */
export function runtimeHead({ root, git = null } = {}) {
  try {
    const sha = revParse(root, 'HEAD', { git });
    return sha && /^[0-9a-f]{40,64}$/.test(sha) ? sha : null;
  } catch { return null; }
}

/**
 * The files `from..to` changed under `paths` (git diff --name-only), [] when none, or null when git does not answer
 * (the caller then counts the HEAD change as relevant).
 */
export function changedPaths({ root, from, to, paths = [], git = null } = {}) {
  try { return diffNames(root, from, to, { paths, git }); } catch { return null; }
}

/** {file: mtimeMs | null} for each watched file (null: missing or unreadable). */
export function moduleStamps(files, { stat = fs.statSync } = {}) {
  const out = {};
  for (const file of files ?? []) {
    try { out[file] = stat(file).mtimeMs; } catch { out[file] = null; }
  }
  return out;
}

function changedHead(baseline, current, headPaths, diff) {
  if (baseline.head == null) { baseline.head = current; return []; }
  if (current == null || current === baseline.head) return [];
  const touched = headPaths ? diff(baseline.head, current) : null;
  if (headPaths && Array.isArray(touched) && !touched.length) { baseline.head = current; return []; }
  return [{ kind: 'head', from: baseline.head, to: current, ...(touched ? { files: touched.length } : {}) }];
}

function changedStamps(baseline, seen) {
  const changes = [];
  for (const [file, mtime] of Object.entries(seen)) {
    const before = baseline[file];
    if (before === undefined) { baseline[file] = mtime; continue; }
    if (mtime !== before) changes.push({ kind: 'mtime', file, from: before, to: mtime });
  }
  return changes;
}

/**
 * The per-tick reload check. `head` and `stamps` are the seams (a spec passes a fake git and fake mtimes),
 * `now` the clock, `lastReloadAt` the time of the reload that started this process (RELOAD_ENV.reloadedAt), if any.
 * check() returns {reload, reason, changes, pendingMs?}: reload is true only when something changed AND no
 * reload happened in the last minIntervalMs. An unreadable HEAD is no change; a baseline read while git did
 * not answer is taken from the first answer instead.
 */
export function createReloadWatch({ root = null, files = [], head = () => runtimeHead({ root }), stamps = () => moduleStamps(files),
  now = Date.now, minIntervalMs = RELOAD_MIN_INTERVAL_MS, lastReloadAt = null,
  headPaths = null, diff = (from, to) => changedPaths({ root, from, to, paths: headPaths ?? [] }) } = {}) {
  const baseline = { head: head(), stamps: stamps() };
  let last = Number.isFinite(lastReloadAt) ? lastReloadAt : null;
  const check = () => {
    const current = head();
    const headChange = changedHead(baseline, current, headPaths, diff);
    const seen = stamps();
    // MB-01: with headPaths, a new HEAD that touches none of them moves the baseline without re-execing the loop.
    const changes = [...headChange, ...changedStamps(baseline.stamps, seen)];
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
 * Re-exec `script` with `args` as a detached, hidden replacement and hand it the singleton host lock `lockName`.
 * Waits up to waitMs for the lock to name the replacement. Returns {ok:true, pid} (the caller exits now, without
 * releasing the lock) or {ok:false, pid, error} (the replacement was stopped; the lock is this process's again). The
 * outcome is one machine_logs row (actor `actor`, kind self-reload.handover). Every host effect is a seam for the specs.
 * The caller owns the host lock: `holder(name)` reads it ({pid} or null) and `reclaim(name)` takes it back
 * (scripts/connectors/lib.mjs lockHolder and reassertManager).
 */
export async function reexecSelf({ script, args = [], lockName, env = process.env, cwd = process.cwd(), now = Date.now,
  waitMs = HANDOVER_WAIT_MS, pollMs = 200, sleep = sleepAsync, actor = 'runtime',
  holder, spawnChild = spawnDetachedSilent,
  kill = (pid) => { try { process.kill(pid); } catch { /* gone */ } }, reclaim, selfPid = process.pid,
  log = (row) => machineLog(row, { env }) } = {}) {
  const handOver = async () => {
    const childEnv = { ...env, [RELOAD_ENV.handoverFrom]: String(selfPid), [RELOAD_ENV.reloadedAt]: String(now()) };
    let child;
    try { child = spawnChild({ execPath: process.execPath, script, args, env: childEnv, cwd }); }
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
  };
  const result = await handOver();
  try {
    log({ actor, kind: 'self-reload.handover', level: result.ok ? 'info' : 'warn', data: { script: String(script), args, lockName, from: selfPid, ...result },
      msg: `${path.basename(String(script))} ${selfPid} -> ${result.pid ?? '-'}: ${result.ok ? 'handed over' : result.error}` });
  } catch { /* logging never blocks a reload */ }
  return result;
}
