// lane-cap.mjs - the lane worktree cap of the Supervisor GC (allocation.gc.laneCap, scripts/supervisor/gc.mjs collectLanes).
// A complete pass that leaves more lanes registered than the cap evicts the longest idle clean lanes whose commits are not in
// main. The branch stays (it holds every commit), so nothing committed is lost; a dirty, recent or live-owned lane is never
// one. Owner rule: worktrees never accumulate.
import { laneActivity } from '../housekeeping/hk-lanes.mjs';
import { laneOwnerOf } from '../machine/lane-owner.mjs';

/** What an unlanded clean lane adds to its `keep` item: {spareIdleMs, ahead} when it is idle and unowned (a cap candidate), else {}. */
export function spareInfo({ w, branch, ahead, now, idleMs, root, run, workers, sup }) {
  const act = laneActivity({ worktree: w.path, branch: w.branch, root, run });
  const idle = act.lastActiveMs == null ? null : now - act.lastActiveMs;
  return idle != null && idle >= idleMs && !laneOwnerOf({ lanePath: w.path, branch, workers, sup }) ? { spareIdleMs: idle, ahead } : {};
}

/**
 * Evict cap candidates (the pass's `keep` items carrying spareIdleMs) longest idle first until at most `cap` lanes stay.
 * `items` are the pass's items, `total` the registered lanes under the lanes root, `removeTree(w, branch, {why})` the
 * collector's removal, `lanesByPath` path -> worktree. Returns how many lanes are still over the cap after the eviction.
 */
export function evictOverCap({ items, total, cap, lanesByPath, removeTree, item, base, stopped }) {
  const removed = () => items.filter((i) => i.class === 'lane' && i.verdict === 'collect' && i.worktree).length;
  const spare = items.filter((i) => i.spareIdleMs != null).sort((a, b) => b.spareIdleMs - a.spareIdleMs);
  for (const c of spare) {
    if (total - removed() <= cap || stopped()) break;
    removeTree(lanesByPath.get(c.target), c.branch, { why: `over the lane cap of ${cap}; branch kept with ${c.ahead} unlanded commit(s)` });
  }
  const over = Math.max(0, total - removed() - cap);
  if (over) item('keep', base, `${total - removed()} lanes stay registered, over the cap of ${cap}: the rest are dirty, live or not idle`, { overCap: true });
  return over;
}
