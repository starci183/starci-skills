// hk-lanes.mjs — the lane-worktree root and the merged-worktree sweep of host housekeeping
// (modules/models/runtimes.yaml allocation.housekeeping.*).
//
// Every ephemeral checkout the runtime's lanes make — agent lane worktrees, worker staging
// (workers.mjs), the land gate's scratch (land.mjs) — lives under ONE root, lanesRoot():
//   1. STARCI_LANES_ROOT            a one-off/spec override
//   2. allocation.housekeeping.lanesRoot   runtimes.yaml (allocationSettings)
//   3. DEFAULT_LANES_ROOT           D:/starci-lanes — lanes stay off C:, which filled 2026-09-26
//
// sweepLanes removes the registered worktrees under that root whose branch is fully landed on main
// (git cherry finds no '+'), after proving the tree holds no link: a reparse point inside a worktree
// means `git worktree remove` could be made to walk out of it (nivo-fe inc-c8fbf76aa499), so that
// worktree is skipped, never unlinked here. The main checkout, the checkout the sweep runs from, a
// detached or dirty tree and anything outside the lanes root are skipped with a reason.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { allocationSettings } from '../../engine/config.mjs';
import { gitResult } from './git.mjs';
import { isLinkLike } from './safe-remove.mjs';
import { pathKey } from './path-key.mjs';

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const DEFAULT_LANES_ROOT = 'D:/starci-lanes';

/**
 * The one lane-worktree root. `env.STARCI_LANES_ROOT` wins (specs, a one-off run); then the
 * runtimes.yaml key — pass `allocation` (allocationSettings()) when the caller already holds it,
 * else it is read here; the declared default applies while the key is absent.
 */
export function lanesRoot({ env = process.env, allocation = undefined } = {}) {
  let configured = null;
  if (allocation !== undefined) configured = allocation?.housekeeping?.lanesRoot ?? null;
  else { try { configured = allocationSettings()?.housekeeping?.lanesRoot ?? null; } catch { configured = null; } }
  return path.resolve(String(env?.STARCI_LANES_ROOT || configured || DEFAULT_LANES_ROOT));
}

/** `git worktree list --porcelain` as [{path, branch, detached, dirty, locked, prunable}]. */
export function parseWorktreeList(text) {
  const out = [];
  let cur = null;
  for (const line of String(text ?? '').split(/\r?\n/)) {
    if (line.startsWith('worktree ')) { cur = { path: line.slice(9).trim(), branch: null, detached: false, dirty: false, locked: false, prunable: false }; out.push(cur); continue; }
    if (!cur) continue;
    if (line.startsWith('branch ')) cur.branch = line.slice(7).trim();
    else if (line === 'detached') cur.detached = true;
    else if (line === 'dirty') cur.dirty = true;
    else if (line.startsWith('locked')) cur.locked = true;
    else if (line.startsWith('prunable')) cur.prunable = true;
  }
  return out;
}

/** The first link-like entry inside `dir` (or `dir` itself), null when the tree is link-free. */
export function linkInside(dir) {
  if (isLinkLike(dir)) return dir;
  let entries;
  try { entries = fs.readdirSync(dir); } catch { return null; }
  for (const name of entries) {
    const p = path.join(dir, name);
    let st;
    try { st = fs.lstatSync(p); } catch { continue; }
    if (isLinkLike(p, { stat: st })) return p;
    if (st.isDirectory()) { const hit = linkInside(p); if (hit) return hit; }
  }
  return null;
}

/** Bytes `dir` holds in regular files, never descending into a link. */
export function treeBytes(dir) {
  let bytes = 0;
  let entries;
  try { entries = fs.readdirSync(dir); } catch { return 0; }
  for (const name of entries) {
    const p = path.join(dir, name);
    let st;
    try { st = fs.lstatSync(p); } catch { continue; }
    if (st.isSymbolicLink()) continue;
    bytes += st.isDirectory() ? treeBytes(p) : st.size;
  }
  return bytes;
}

const shortBranch = (ref) => String(ref ?? '').replace(/^refs\/heads\//, '');

/**
 * Sweep the lane worktrees of `root`'s repository: every registered worktree under lanesRoot whose
 * branch is merged into main goes away by `git worktree remove` (never --force), its branch by
 * `git branch -d` when git agrees it is merged. `apply` false reports `wouldRemove` and touches
 * nothing. `git` is an injectable runner `(args, {cwd}) -> {ok, stdout, error}`.
 * Returns {ok, apply, at, lanesRoot, freedBytes, removed, wouldRemove, skipped, errors}.
 */
export function sweepLanes({ apply = false, now = Date.now(), env = process.env, allocation = undefined, root = SKILL_ROOT, git = null } = {}) {
  const run = git ?? ((args, { cwd }) => gitResult(args, { cwd }));
  const base = lanesRoot({ env, allocation });
  const out = { ok: true, apply: apply === true, at: new Date(now).toISOString(), lanesRoot: base, freedBytes: 0, removed: [], wouldRemove: [], skipped: [], errors: [] };
  const skip = (p, reason, detail = null) => out.skipped.push({ path: p, reason, ...(detail ? { detail } : {}) });
  const fail = (p, error) => { out.ok = false; out.errors.push({ path: p ?? null, error: String(error ?? 'error') }); };
  const listed = run(['worktree', 'list', '--porcelain'], { cwd: root });
  if (!listed.ok) { fail(root, listed.error || 'git worktree list failed'); return out; }
  const worktrees = parseWorktreeList(listed.stdout);
  const mainKey = worktrees[0] ? pathKey(worktrees[0].path) : null; // the main worktree lists first
  const selfKey = pathKey(path.resolve(root));
  const baseKey = `${pathKey(base)}/`;
  for (const w of worktrees) {
    const key = pathKey(w.path);
    if (key === mainKey) { skip(w.path, 'main-checkout'); continue; }
    if (key === selfKey) { skip(w.path, 'current-checkout'); continue; }
    if (!key.startsWith(baseKey)) { skip(w.path, 'outside-lanes-root'); continue; }
    if (w.detached || !w.branch) { skip(w.path, 'detached-head'); continue; }
    if (w.locked) { skip(w.path, 'locked'); continue; }
    if (!fs.existsSync(w.path)) { skip(w.path, 'missing'); continue; }
    const link = linkInside(w.path);
    if (link) { skip(w.path, 'contains-links', link); continue; }
    if (w.dirty) { skip(w.path, 'dirty'); continue; }
    const status = run(['status', '--porcelain', '--untracked-files=all'], { cwd: w.path });
    if (!status.ok) { skip(w.path, 'status-unreadable', status.error); continue; }
    if (status.stdout.trim()) { skip(w.path, 'uncommitted-changes'); continue; }
    const cherry = run(['cherry', 'main', w.branch], { cwd: root });
    if (!cherry.ok) { skip(w.path, 'merge-check-failed', cherry.error); continue; }
    const ahead = cherry.stdout.split(/\r?\n/).filter((l) => l.startsWith('+')).length;
    if (ahead) { skip(w.path, 'unmerged-commits', `${ahead} commit(s) not in main`); continue; }
    const freedBytes = treeBytes(w.path);
    const branch = shortBranch(w.branch);
    if (!out.apply) { out.wouldRemove.push({ path: w.path, branch, freedBytes }); out.freedBytes += freedBytes; continue; }
    const removed = run(['worktree', 'remove', w.path], { cwd: root });
    if (!removed.ok) { fail(w.path, removed.error || 'git worktree remove failed'); continue; }
    const dropped = run(['branch', '-d', branch], { cwd: root });
    out.removed.push({ path: w.path, branch, freedBytes, branchDeleted: dropped.ok });
    out.freedBytes += freedBytes;
  }
  if (out.apply) run(['worktree', 'prune'], { cwd: root });
  return out;
}
