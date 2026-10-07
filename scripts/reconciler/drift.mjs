// scripts/reconciler/drift.mjs — what a running engine differs from, seen from outside it (boot.mjs status, `start` rows).
//
// Two drifts, each a fact an observer on the CURRENT code can compute while the engine runs OLD code and cannot report it:
//   modes  a controller's effective mode (controller_modes) differs from what config.yaml configures for longer than
//          modeDriftMs after the later of the mode's last write and the config file's last change. A configured-active
//          controller running shadow is safe mode, which has its own row, and is not counted here.
//   rev    the engine's code revision (engine_leader.rev) differs from the live runtime HEAD, the range changed a path the
//          engine imports (RELOAD_HEAD_PATHS) or git cannot say, and the live HEAD moved longer ago than the reload bound
//          (reload-bounds.mjs). A live HEAD that touched none of those paths needs no reload.
import fs from 'node:fs';
import path from 'node:path';
import { allocationMs } from '../../engine/config.mjs';
import { reflog } from '../api/git/reflog.mjs';
import { headTime } from '../api/git/head-time.mjs';
import { changedPaths, runtimeHead } from '../machine/self-reload.mjs';
import { RELOAD_HEAD_PATHS, reloadBoundMs } from './reload-bounds.mjs';
import { SKILL_ROOT } from './state.mjs';

/** Controllers whose effective mode differs from the configured one for longer than graceMs. Pure. modes: {name: {configured, effective, setAt}}. */
export function modeDrift({ modes, configAt = 0, now = Date.now(), graceMs = allocationMs('reconciler.modeDriftMs') } = {}) {
  const drifted = [];
  for (const [controller, mode] of Object.entries(modes ?? {})) {
    if (mode.configured === mode.effective) continue;
    if (mode.configured === 'active' && mode.effective === 'shadow') continue;
    const sinceMs = now - Math.max(Number(mode.setAt) || 0, configAt);
    if (sinceMs > graceMs) drifted.push({ controller, configured: mode.configured, effective: mode.effective, sinceMs });
  }
  return drifted;
}

/** The engine's code revision against the live one: {engineRev, liveRev, sinceMs} when it drifted past the reload bound, else null. Pure. */
export function revDrift({ engineRev, liveRev, movedAt, relevant, now = Date.now(), boundMs = reloadBoundMs() } = {}) {
  if (!engineRev || !liveRev || engineRev === liveRev || relevant === false) return null;
  const sinceMs = Number.isFinite(movedAt) ? now - movedAt : null;
  return sinceMs != null && sinceMs > boundMs ? { engineRev, liveRev, sinceMs } : null;
}

/** When the live HEAD last moved (ms): its reflog entry, else its commit time, else null. */
function headMovedAt(root) {
  const r = reflog(['-1', '--format=%ct', 'HEAD'], { cwd: root });
  const seconds = Number(String(r.stdout ?? '').trim());
  if (!r.error && r.status === 0 && Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  const committed = headTime(root)?.time;
  return committed ? committed * 1000 : null;
}

/** The mtime of config.yaml (ms), 0 when it cannot be read. */
function configChangedAt(root) {
  try { return fs.statSync(path.join(root, 'config.yaml')).mtimeMs; } catch { return 0; }
}

/**
 * {modes: [...], rev: {...} | null} of a fresh leader; empty drift for a stale or absent one. `leader` is boot.mjs leaderState(),
 * `modes` status().modes. Reads git and config.yaml of `root` (seams for the specs: live, movedAt, touched, configAt).
 */
export function engineDrift({ leader, modes, now = Date.now(), root = SKILL_ROOT, live = undefined, movedAt = undefined, touched = undefined, configAt = undefined } = {}) {
  const none = { modes: [], rev: null };
  if (!leader?.fresh) return none;
  const modeRows = modeDrift({ modes, configAt: configAt ?? configChangedAt(root), now });
  const liveRev = live === undefined ? runtimeHead({ root }) : live;
  if (!leader.rev || !liveRev || leader.rev === liveRev) return { modes: modeRows, rev: null };
  const changed = touched === undefined ? changedPaths({ root, from: leader.rev, to: liveRev, paths: RELOAD_HEAD_PATHS }) : touched;
  const rev = revDrift({ engineRev: leader.rev, liveRev, movedAt: movedAt === undefined ? headMovedAt(root) : movedAt, relevant: Array.isArray(changed) ? changed.length > 0 : true, now });
  return { modes: modeRows, rev };
}

const minutes = (ms) => `${Math.max(1, Math.round(ms / 60_000))}m`;

/** One line naming every drift (the first line of `reconciler status`), or null when there is none. Pure. */
export function driftSummary(drift) {
  const parts = (drift?.modes ?? []).map((m) => `${m.controller} configured ${m.configured} runs ${m.effective} for ${minutes(m.sinceMs)}`);
  if (drift?.rev) parts.push(`engine code ${String(drift.rev.engineRev).slice(0, 9)} differs from live ${String(drift.rev.liveRev).slice(0, 9)} for ${minutes(drift.rev.sinceMs)}`);
  return parts.length ? `DRIFT: ${parts.join('; ')}` : null;
}
