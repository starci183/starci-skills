// gc-lanes.mjs - the lanes collector of the Supervisor GC (scripts/supervisor/gc.mjs): the worktrees under the lanes root judged in path
// order within a time budget, the cursor a bounded pass resumes from, and the removal of what landed, is clean and idle.
import fs from 'node:fs';
import path from 'node:path';
import { parseWorktreeList, laneActivity, treeBytes, laneGit } from '../housekeeping/hk-lanes.mjs';
import { safeRemoveWorktree } from '../machine/worktree-git.mjs';
import { markRemoved } from '../machine/worktree-registry.mjs';
import { pathKey } from '../lib/path-key.mjs';
import { SKILL_ROOT, lanesRoot, landRoot, readSupervisor, withSupervisor } from '../machine/home.mjs';
import { laneOwnerOf } from '../machine/lane-owner.mjs';
import { evictOverCap, spareInfo } from './lane-cap.mjs';
import { landedCommitsForLane, laneContentLanded } from './lane-landed.mjs';

/** The pass budget and the registered-lane cap a settings object without them falls back to. */
export const LANE_DEFAULTS = Object.freeze({ laneBudgetMs: 240_000, laneCap: 40 });

/** The lanes collector's resume point: the path key the last bounded pass stopped before (machine.sqlite machine_meta). */
const LANE_CURSOR = 'lanes';
export const readLaneCursor = (env = process.env) => readSupervisor((m) => m.gcCursor(LANE_CURSOR), null, { env });
export const writeLaneCursor = (value, env = process.env) => { try { withSupervisor((m) => m.setGcCursor(LANE_CURSOR, value), { env }); } catch { /* the next pass starts over */ } };

const branchOf = (ref) => String(ref ?? '').replace(/^refs\/heads\//, '');
const dirtyCount = (run, p) => {
  const s = run(['status', '--porcelain', '--untracked-files=normal'], { cwd: p });
  return s.ok ? s.stdout.trim().split(/\r?\n/).filter(Boolean).length : null;
};

/** Remove one lane worktree (or count it, in a dry run). A removal that changed the main checkout stops the collector (pass.fatal). */
function removeLaneTree(pass, w, branch, { why = 'landed in main, clean, idle' }) {
  const { apply, root, git, env, item, errors } = pass;
  const bytes = treeBytes(w.path);
  if (!apply) { item('collect', w.path, `would remove (${why})`, { bytes, branch, worktree: true }); pass.freedBytes += bytes; return; }
  // safeRemoveWorktree: every link removed as a link (found without following one), zero links asserted, then git
  // worktree remove, and the main checkout asserted untouched (a violation stops the collector).
  const r = safeRemoveWorktree(w.path, { repo: root, git });
  if (r.fatal) { pass.fatal = { path: w.path, damage: r.damage }; errors.push(`${w.path}: main checkout damaged: ${(r.damage ?? []).join('; ')}`); item('refuse', w.path, 'removal changed the main checkout: the GC stops', { ok: false }); return; }
  if (!r.ok) { errors.push(`${w.path}: ${(r.errors ?? []).slice(0, 2).map((e) => e.message).join('; ')}`); item('refuse', w.path, 'removal failed', { ok: false }); return; }
  markRemoved(w.path, { env });
  item('collect', w.path, `removed (${why})`, { bytes, branch, branchDeleted: false, ok: true, worktree: true });
  pass.freedBytes += bytes;
}

/** A detached checkout: a land scratch goes once no land runs and it is past the grace; any other is kept. */
function judgeDetached(pass, w) {
  const { item, landBusy, now, settings } = pass;
  if (!pathKey(w.path).startsWith(pass.landKey)) { item('keep', w.path, 'detached checkout outside the land root'); return; }
  if (landBusy) { item('keep', w.path, 'a land is running'); return; }
  let mtime = 0; try { mtime = fs.statSync(w.path).mtimeMs; } catch { /* unknown */ }
  if (now - mtime < settings.laneGraceMs) { item('keep', w.path, 'recent land scratch'); return; }
  pass.removeTree(w, null, { why: 'land scratch, no land running' });
}

/** Why a lane with commits ahead of main is kept: {reason, extra}; null when its commits all landed (by ledger or by content). */
function unlandedKeep(pass, w, branch, ahead) {
  const { run, root, env, now, settings, workers, sup } = pass;
  const list = run(['rev-list', 'main..' + branch], { cwd: root });
  if (!list.ok) return { reason: 'commit list unreadable', extra: { branch } };
  const commits = list.stdout.split(/\r?\n/).filter(Boolean);
  const ledger = landedCommitsForLane(branch, env);
  const ledgerLanded = commits.length > 0 && commits.every((sha) => ledger.has(sha));
  if (ledgerLanded || laneContentLanded(commits, branch, root, run)) return null;
  return { reason: `${ahead} commit(s) not landed in main`, extra: { branch, unmerged: true, ...spareInfo({ w, branch, ahead, now, idleMs: settings.laneIdleMs ?? settings.laneGraceMs, root, run, workers, sup }) } };
}

/** Why a landed, clean lane is still kept (recent git activity, a live owner): {reason, extra}, or null when it goes. */
function activeKeep(pass, w, branch) {
  const { root, run, now, settings, workers, sup } = pass;
  const act = laneActivity({ worktree: w.path, branch: w.branch, root, run });
  const idle = act.lastActiveMs == null ? null : now - act.lastActiveMs;
  const idleMs = settings.laneIdleMs ?? settings.laneGraceMs;
  if (idle == null || idle < idleMs) return { reason: `landed but git activity ${idle == null ? '?' : Math.round(idle / 60000)}m ago (< ${Math.round(idleMs / 60000)}m)`, extra: { branch } };
  const owner = laneOwnerOf({ lanePath: w.path, branch, workers, sup });
  return owner ? { reason: `landed but its owner is alive: ${owner}`, extra: { branch, liveOwner: true } } : null;
}

/** A lane worktree on a branch: kept while dirty, unreadable, unlanded, active or owned; else removed. */
function judgeBranchLane(pass, w, branch) {
  const { item, run, root } = pass;
  const d = dirtyCount(run, w.path);
  if (d === null) { item('keep', w.path, 'status unreadable', { branch }); return; }
  if (d > 0) { item('keep', w.path, `${d} uncommitted change(s)`, { branch, unmerged: true }); return; }
  const cherry = run(['cherry', 'main', branch], { cwd: root });
  if (!cherry.ok) { item('keep', w.path, 'merge check failed', { branch }); return; }
  const ahead = cherry.stdout.split(/\r?\n/).filter((l) => l.startsWith('+')).length;
  const kept = (ahead ? unlandedKeep(pass, w, branch, ahead) : null) ?? activeKeep(pass, w, branch);
  if (kept) { item('keep', w.path, kept.reason, kept.extra); return; }
  pass.removeTree(w, branch, { why: 'landed in main, clean, idle; branch kept' });
}

/** One lane worktree of the pass. */
function judgeLane(pass, w) {
  const { item, run, root, apply } = pass;
  if (w.locked) { item('keep', w.path, 'locked'); return; }
  if (!fs.existsSync(w.path)) { if (apply) { run(['worktree', 'prune'], { cwd: root }); } item('collect', w.path, 'registration of a missing directory (pruned)'); return; }
  const branch = branchOf(w.branch);
  if (w.detached || !branch) judgeDetached(pass, w);
  else judgeBranchLane(pass, w, branch);
}

/** Leftover empty directories of removed land scratch checkouts whose registration is gone. */
function sweepEmptyLeftovers(pass, registered) {
  const { item, apply, env, errors } = pass;
  const parent = landRoot(env);
  let names = [];
  try { names = fs.readdirSync(parent); } catch { return; }
  for (const name of names) {
    const p = path.join(parent, name);
    if (registered.has(pathKey(p))) continue;
    let empty = false;
    try { empty = fs.statSync(p).isDirectory() && fs.readdirSync(p).length === 0; } catch { empty = false; }
    if (!empty) { item('keep', p, 'unregistered non-empty directory (not a worktree; left for a human)'); continue; }
    if (apply) { try { fs.rmdirSync(p); item('collect', p, 'removed empty leftover directory', { ok: true }); } catch (e) { errors.push(`${p}: ${e.message}`); } }
    else item('collect', p, 'would remove empty leftover directory');
  }
}

const byPathKey = (a, b) => {
  if (pathKey(a.path) < pathKey(b.path)) { return -1; }
  if (pathKey(a.path) > pathKey(b.path)) { return 1; }
  return 0;
};

/**
 * Decide and (apply) remove the lane worktrees. `git` runner (args, {cwd}) -> {ok, stdout, error}; `sup` supervisorView.
 * BOUNDED: the lanes are judged in path order from `cursor` to the end for at most settings.laneBudgetMs
 * (`clock` is the seam); `progress` says how far it got and where the next pass resumes. A removal that changed the main
 * checkout (safeRemoveWorktree fatal) stops the collector at once. Returns {items, freedBytes, errors, progress, fatal?}.
 */
export function collectLanes({ apply = false, env = process.env, now = Date.now(), settings, sup, root = SKILL_ROOT, git = null, landBusy = false, workers = [],
  cursor = null, clock = Date.now }) {
  const run = git ?? laneGit;
  const base = lanesRoot({ env });
  const items = [], errors = [];
  const listedRes = run(['worktree', 'list', '--porcelain'], { cwd: root });
  if (!listedRes.ok) return { items, freedBytes: 0, errors: [`git worktree list: ${listedRes.error ?? 'failed'}`] };
  const worktrees = parseWorktreeList(listedRes.stdout);
  const mainKey = worktrees[0] ? pathKey(worktrees[0].path) : null;
  const selfKey = pathKey(path.resolve(root));
  const baseKey = `${pathKey(base)}/`;
  const registered = new Set(worktrees.map((w) => pathKey(w.path)));
  const pass = { apply, env, now, settings, sup, root, git, run, landBusy, workers, items, errors, freedBytes: 0, fatal: null, landKey: `${pathKey(landRoot(env))}/`,
    item: (verdict, target, reason, extra = {}) => items.push({ class: 'lane', verdict, target, reason, ...extra }) };
  pass.removeTree = (w, branch, opts) => removeLaneTree(pass, w, branch, opts);
  const lanes = worktrees.filter((w) => { const k = pathKey(w.path); return k !== mainKey && k !== selfKey && k.startsWith(baseKey); }).sort(byPathKey);
  // Resume at the cursor and run to the end of the path order; a pass that reaches the end is complete (the next one
  // starts from the beginning again).
  const at = cursor ? lanes.findIndex((w) => pathKey(w.path) >= cursor) : 0;
  const ordered = at < 0 ? [] : lanes.slice(at);
  const started = clock();
  const progress = { total: lanes.length, from: at < 0 ? lanes.length : at, done: 0, complete: true, next: null, budgetMs: settings.laneBudgetMs ?? LANE_DEFAULTS.laneBudgetMs };
  for (const w of ordered) {
    if (pass.fatal || clock() - started > progress.budgetMs) { progress.complete = false; progress.next = pathKey(w.path); break; }
    progress.done += 1;
    judgeLane(pass, w);
  }
  if (!pass.fatal && progress.complete) evictOverCap({ items, total: lanes.length, cap: settings.laneCap ?? LANE_DEFAULTS.laneCap, lanesByPath: new Map(lanes.map((w) => [w.path, w])), removeTree: pass.removeTree, item: pass.item, base, stopped: () => pass.fatal });
  if (pass.fatal) return { items, freedBytes: pass.freedBytes, errors, progress, fatal: pass.fatal };
  if (apply) run(['worktree', 'prune'], { cwd: root });
  sweepEmptyLeftovers(pass, registered);
  return { items, freedBytes: pass.freedBytes, errors, progress };
}
