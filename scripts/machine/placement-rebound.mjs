// placement-rebound.mjs - the read side of a rebound placement. An attempt is admitted with immutable records of the directory it works
// in (op_attempts.worktree_path, the contract's context.worktree, the packet's workflow_worktree.path, the gate binding's target
// roots). When its workflow tree is put back at another path, the runtime appends a `placement-rebound` ledger event
// (scripts/kernel/attempt-placement.mjs); settle and the checks read the recorded directory through the attempt's rebounds here.
import { parseJson } from '../lib/json.mjs';
import { pathKey } from '../lib/path-key.mjs';

/** The ledger event that supersedes an admitted placement. */
export const PLACEMENT_REBOUND = 'placement-rebound';
const CHAIN_MAX = 8;

/** `value` as a list of non-empty directory strings. */
export const dirsOf = (value) => (Array.isArray(value) ? value : [value]).filter((dir) => typeof dir === 'string' && dir);

/** The superseded directories of an attempt: a Map from a path key to the directory that replaced it (the newest event wins). */
export function reboundMapOf(db, attemptId) {
  const map = new Map();
  if (attemptId == null) return map;
  const rows = db.prepare('SELECT payload_json FROM events WHERE attempt_id=? AND kind=? ORDER BY seq').all(attemptId, PLACEMENT_REBOUND);
  for (const row of rows) {
    const payload = parseJson(row.payload_json, {}) ?? {};
    for (const from of dirsOf(payload.from ?? [])) map.set(pathKey(from), payload.to);
  }
  return map;
}

/** The directory that stands for `dir` after the attempt's rebounds (a chain of rebinds is followed); `dir` itself when none applies. */
export function supersedeDir(map, dir) {
  let current = dir;
  for (let hop = 0; hop < CHAIN_MAX && typeof current === 'string' && map.has(pathKey(current)); hop += 1) current = map.get(pathKey(current));
  return current;
}

/** `dirs` of `attemptId` through its rebounds. */
export const supersedeDirs = (db, attemptId, dirs) => {
  const map = reboundMapOf(db, attemptId);
  return dirs.map((dir) => supersedeDir(map, dir));
};

/** The worktree directory a contracts row recorded (context.worktree) through its attempt's rebounds; null when it recorded none. */
export function placedWorktreeOf(db, contract) {
  const recorded = parseJson(contract?.context_json ?? '', null)?.worktree;
  return typeof recorded === 'string' && recorded ? supersedeDir(reboundMapOf(db, contract.attempt_id), recorded) : null;
}

/** The recorded gate binding with each admitted target root read through the attempt's rebounds; `aliases` pairs an admitted root with the root now standing for it. */
export function reboundBindingOf(recorded, rebound, placements) {
  if (!Array.isArray(recorded?.targets)) return { ...recorded, placements };
  const targets = recorded.targets.map((target) => ({ ...target, root: supersedeDir(rebound, target.root) }));
  const aliases = recorded.targets.map((target, i) => ({ from: target.root, to: targets[i].root })).filter((pair) => pair.from !== pair.to);
  return { ...recorded, targets, aliases, placements };
}
