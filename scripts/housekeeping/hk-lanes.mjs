// hk-lanes.mjs — the lane-worktree root and the merged-worktree sweep of host housekeeping
// (modules/models/runtimes.yaml allocation.housekeeping.*; the lanes root itself: the owner config roots.lanes).
//
// Every ephemeral checkout the runtime's lanes make — agent lane worktrees, worker staging
// (workers.mjs), the land gate's scratch (land.mjs) — lives under ONE root, lanesRoot():
//   1. STARCI_LANES_ROOT            a one-off/spec override
//   2. roots.lanes                  the owner config (config.yaml, gitignored)
//   3. <profile>/StarCi/lanes       the default, kept OUT of the checkout's .runtime (STARCI_LOCAL_ROOT/lanes when that seam is set; the owner moves it with STARCI_LANES_ROOT or the key)
//
// sweepLanes removes the registered worktrees under that root whose branch is fully landed on main
// (git cherry finds no '+') and that stayed idle for allocation.housekeeping.laneGraceMs, after
// safeRemoveWorktree unlinks every link as a link first. A lane made by `git worktree add -b lane/<x> main` has no commit
// of its own yet, so git cherry reads it as landed: its branch never moved since creation (tip equals
// its merge-base with main, one reflog position) and it is skipped as no-work-yet; a landed lane still
// in use (its HEAD/branch reflog or directory changed within the grace) is skipped as recent-activity.
// laneGraceMs unset or not a positive number sweeps nothing (lane-grace-unset). A reparse point
// inside a worktree is enumerated without following it and removed as a link before `git worktree remove`.
// The main checkout, the checkout the sweep runs from, a
// detached or dirty tree and anything outside the lanes root are skipped with a reason.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reflog as gitReflog } from '../api/git/reflog.mjs';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { mergeBase } from '../api/git/merge-base.mjs';
import { worktreeListQuery } from '../api/git/worktree-list-query.mjs';
import { worktreePrune } from '../api/git/worktree-prune.mjs';
import { statusQuery as gitStatus } from '../api/git/status-query.mjs';
import { cherry as gitCherry } from '../api/git/cherry.mjs';
import { revList } from '../api/git/rev-list.mjs';
import { diff as gitDiff } from '../api/git/diff.mjs';
import { diffTree } from '../api/git/diff-tree.mjs';
import { log as gitLog } from '../api/git/log.mjs';
import { branchDelete } from '../api/git/branch-delete.mjs';
import { gitResultOf } from '../lib/git.mjs';
import { safeRemoveWorktree } from '../machine/worktree-git.mjs';
import { pathKey } from '../lib/path-key.mjs';
import { allocationSettings } from '../../engine/config.mjs';
import { lanesRoot } from '../machine/home.mjs';
import { LANE_IDLE_MS, laneOwnerOf, liveLaneOwners } from '../machine/lane-owner.mjs';
import { isSpecRun } from '../lib/env.mjs';

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

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

/** allocation.housekeeping.laneGraceMs as a positive number, null when unset or invalid. */
export function laneGraceMs(allocation) {
  const ms = Number(allocation?.housekeeping?.laneGraceMs);
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

/** Epoch ms of every `<ref>@{<unix>}` reflog line, as [{hash, atMs}] (`--format=%H %gd --date=unix`). */
function reflogEntries(stdout) {
  return String(stdout ?? '').split(/\r?\n/).map((line) => {
    const m = /^([0-9a-f]{7,64}) \S*@\{(\d+)\}$/.exec(line.trim());
    return m ? { hash: m[1], atMs: Number(m[2]) * 1000 } : null;
  }).filter(Boolean);
}

/**
 * The lane's work state: `noWork` when its branch never moved since it was cut (tip is its
 * merge-base with main and the branch reflog holds that one position); `lastActiveMs` the newest of
 * the branch reflog, the worktree's HEAD reflog and the directory mtime (null when none is readable).
 */
export function laneActivity({ worktree, branch, root, run }) {
  const branchLog = run(['reflog', '--format=%H %gd', '--date=unix', branch], { cwd: root });
  const headLog = run(['reflog', '-1', '--format=%H %gd', '--date=unix', 'HEAD'], { cwd: worktree });
  const branchEntries = branchLog.ok ? reflogEntries(branchLog.stdout) : [];
  const times = [...branchEntries, ...(headLog.ok ? reflogEntries(headLog.stdout) : [])].map((e) => e.atMs);
  try { times.push(fs.statSync(worktree).mtimeMs); } catch { /* no mtime: the reflogs decide */ }
  const tip = run(['rev-parse', branch], { cwd: root });
  const base = run(['merge-base', 'main', branch], { cwd: root });
  const tipHash = tip.ok ? tip.stdout.trim() : null;
  const noWork = Boolean(tipHash) && base.ok && base.stdout.trim() === tipHash && branchEntries.every((e) => e.hash === tipHash);
  return { noWork, lastActiveMs: times.length ? Math.max(...times) : null };
}

/**
 * Sweep the lane worktrees of `root`'s repository: every registered worktree under lanesRoot whose
 * branch is merged into main and that stayed idle for laneGraceMs goes away by `git worktree remove` (never --force), its branch by
 * `git branch -d` when git agrees it is merged. `apply` false reports `wouldRemove` and touches
 * nothing. `git` is an injectable runner `(args, {cwd}) -> {ok, stdout, error}`.
 * Returns {ok, apply, at, lanesRoot, freedBytes, removed, wouldRemove, skipped, errors}.
 */
// The git calls of a lane sweep (this one and scripts/supervisor/gc.mjs collectLanes), by verb: the `git` seam takes the
// whole argv (a spec's fake), so the default picks the call file each verb names (scripts/api/git/) and folds its result
// to {ok, stdout, error}.
const LANE_CALLS = {
  reflog: (rest, opts) => gitResultOf(gitReflog(rest, opts)),
  'rev-parse': (rest, opts) => gitResultOf(revParseQuery(rest, opts)),
  'merge-base': ([a, b], { cwd }) => { const sha = mergeBase(cwd, a, b); return { ok: Boolean(sha), stdout: sha ?? '', error: sha ? '' : `no merge-base of ${a} and ${b}` }; },
  worktree: ([sub, ...rest], opts) => {
    if (sub === 'list') return gitResultOf(worktreeListQuery(rest, opts));
    const { ok, stdout, stderr } = worktreePrune(opts.cwd);
    return { ok, stdout, error: stderr };
  },
  status: (rest, opts) => gitResultOf(gitStatus(rest, opts)),
  cherry: (rest, opts) => gitResultOf(gitCherry(rest, opts)),
  'rev-list': (rest, opts) => gitResultOf(revList(rest, opts)),
  diff: (rest, opts) => gitResultOf(gitDiff(rest, opts)),
  'diff-tree': (rest, opts) => gitResultOf(diffTree(rest, opts)),
  log: (rest, opts) => gitResultOf(gitLog(rest, opts)),
  branch: ([, branch], { cwd }) => { const r = branchDelete({ repoRoot: cwd, branch, mode: 'merged' }); return { ok: r.ok, stdout: '', error: r.detail ?? '' }; },
};
/** The default lane git runner: (args, {cwd}) -> {ok, stdout, error}. */
export const laneGit = ([verb, ...rest], opts) => LANE_CALLS[verb](rest, opts);

const allocationForLaneGrace = (allocation) => {
  if (allocation !== undefined) return allocation;
  try { return allocationSettings(); } catch { return null; }
};

export function sweepLanes({ apply = false, now = Date.now(), env = process.env, allocation = undefined, config = undefined, root = SKILL_ROOT, git = null, owners = undefined } = {}) {
  const run = git ?? laneGit;
  const base = lanesRoot({ env, config });
  const out = { ok: true, apply: apply === true, at: new Date(now).toISOString(), lanesRoot: base, freedBytes: 0, removed: [], wouldRemove: [], skipped: [], errors: [] };
  const skip = (p, reason, detail = null) => out.skipped.push({ path: p, reason, ...(detail ? { detail } : {}) });
  const fail = (p, error) => { out.ok = false; out.errors.push({ path: p ?? null, error: String(error ?? 'error') }); };
  const listed = run(['worktree', 'list', '--porcelain'], { cwd: root });
  if (!listed.ok) { fail(root, listed.error || 'git worktree list failed'); return out; }
  const worktrees = parseWorktreeList(listed.stdout);
  const mainKey = worktrees[0] ? pathKey(worktrees[0].path) : null; // the main worktree lists first
  const selfKey = pathKey(path.resolve(root));
  const baseKey = `${pathKey(base)}/`;
  // The live owners (scripts/machine/lane-owner.mjs, the same rule gc.mjs applies), read once when a lane gets that far.
  // A spec process with no owners passed reads none (never the live host's Orca).
  let ownerInfo = owners ?? null;
  const ownersNow = () => (ownerInfo ??= (isSpecRun() ? { workers: [], sup: { jobs: [] } } : liveLaneOwners({ env })));
  const graceMs = laneGraceMs(allocationForLaneGrace(allocation));
  for (const w of worktrees) {
    const key = pathKey(w.path);
    if (key === mainKey) { skip(w.path, 'main-checkout'); continue; }
    if (key === selfKey) { skip(w.path, 'current-checkout'); continue; }
    if (!key.startsWith(baseKey)) { skip(w.path, 'outside-lanes-root'); continue; }
    if (w.detached || !w.branch) { skip(w.path, 'detached-head'); continue; }
    if (w.locked) { skip(w.path, 'locked'); continue; }
    if (!fs.existsSync(w.path)) { skip(w.path, 'missing'); continue; }
    if (w.dirty) { skip(w.path, 'dirty'); continue; }
    const status = run(['status', '--porcelain', '--untracked-files=all'], { cwd: w.path });
    if (!status.ok) { skip(w.path, 'status-unreadable', status.error); continue; }
    if (status.stdout.trim()) { skip(w.path, 'uncommitted-changes'); continue; }
    const cherry = run(['cherry', 'main', w.branch], { cwd: root });
    if (!cherry.ok) { skip(w.path, 'merge-check-failed', cherry.error); continue; }
    const ahead = cherry.stdout.split(/\r?\n/).filter((l) => l.startsWith('+')).length;
    if (ahead) { skip(w.path, 'unmerged-commits', `${ahead} commit(s) not in main`); continue; }
    if (graceMs === null) { skip(w.path, 'lane-grace-unset', 'allocation.housekeeping.laneGraceMs'); continue; }
    const activity = laneActivity({ worktree: w.path, branch: w.branch, root, run });
    const idleMs = activity.lastActiveMs === null ? null : now - activity.lastActiveMs;
    const minIdleMs = Math.max(graceMs, LANE_IDLE_MS);
    if (idleMs === null || idleMs < minIdleMs) {
      skip(w.path, activity.noWork ? 'no-work-yet' : 'recent-activity', idleMs === null ? 'no activity time readable' : `idle ${Math.round(idleMs)}ms < ${minIdleMs}ms (laneGraceMs, at least 60 min)`);
      continue;
    }
    const o = ownersNow();
    const owner = laneOwnerOf({ lanePath: w.path, branch: w.branch, workers: o.workers, sup: o.sup });
    if (owner) { skip(w.path, 'live-owner', owner); continue; }
    const freedBytes = treeBytes(w.path);
    const branch = shortBranch(w.branch);
    if (!out.apply) { out.wouldRemove.push({ path: w.path, branch, freedBytes }); out.freedBytes += freedBytes; continue; }
    const removed = safeRemoveWorktree(w.path, { repo: root, git });
    // A removal that changed the main checkout stops housekeeping's lane pass at once (safe-remove.mjs mainCheckoutGuard).
    if (removed.fatal) { fail(w.path, `main checkout damaged: ${(removed.damage ?? []).join('; ')}`); out.stopped = { path: w.path, damage: removed.damage }; break; }
    if (!removed.ok) { fail(w.path, (removed.errors ?? [])[0]?.message || removed.reason || 'worktree removal failed'); continue; }
    const dropped = run(['branch', '-d', branch], { cwd: root });
    out.removed.push({ path: w.path, branch, freedBytes, branchDeleted: dropped.ok });
    out.freedBytes += freedBytes;
  }
  if (out.apply) run(['worktree', 'prune'], { cwd: root });
  return out;
}
