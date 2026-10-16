// local-main.mjs - keep the LOCAL main ref from falling behind a release.
// In a shared repository nothing moves refs/heads/main between releases, so it can sit far behind origin/main (the diff base of `runtime verify` once
// came from it). After a release is pushed or published, the local main is fast-forwarded to the released commit when that is safe:
//   - the released commit is already on origin/main (it is published), and the local main is an ancestor of it (a fast-forward, never a rewind);
//   - no worktree has main checked out (moving a checked-out branch ref would leave that tree dirty); the checkout that cut the release is on main
//     and already at the released commit, so there is nothing to move there.
// The move is a compare-and-swap on the old value. Never resets, stashes or touches a working tree.
import { isAncestor } from '../api/git/is-ancestor.mjs';
import { revParse } from '../api/git/rev-parse.mjs';
import { updateRef } from '../api/git/update-ref.mjs';
import { worktreeListPorcelain } from '../api/git/worktree-list-porcelain.mjs';

const short = (sha) => String(sha).slice(0, 9);

/**
 * Fast-forward the local `branch` to `to` (a ref or sha) when safe: {moved, from, to, why}. deps (seams of a spec): revParse, isAncestor, worktrees, updateRef.
 */
export function advanceLocalMain({ root, to, branch = 'main', remote = 'origin', deps = {} }) {
  const resolve = deps.revParse ?? revParse, ancestor = deps.isAncestor ?? isAncestor;
  const target = resolve(root, to);
  const current = resolve(root, `refs/heads/${branch}`);
  const stay = (why) => ({ moved: false, from: current, to: target, why });
  if (!target) return stay(`${to} does not resolve`);
  if (!current) return stay(`there is no local ${branch}`);
  if (current === target) return stay(`local ${branch} is already at ${short(target)}`);
  if (!ancestor(root, current, target)) return stay(`local ${branch} (${short(current)}) is not an ancestor of ${short(target)}: not a fast-forward`);
  if (!ancestor(root, target, `${remote}/${branch}`)) return stay(`${short(target)} is not on ${remote}/${branch} yet`);
  const holder = (deps.worktrees ?? worktreeListPorcelain)(root).find((tree) => tree.branch === branch);
  if (holder) return stay(`${branch} is checked out in ${holder.path}`);
  const moved = (deps.updateRef ?? updateRef)(root, `refs/heads/${branch}`, target, { old: current, message: `release: fast-forward ${branch} to ${short(target)}` });
  return moved.ok ? { moved: true, from: current, to: target, why: `local ${branch} fast-forwarded ${short(current)} -> ${short(target)}` } : stay(`update-ref refused: ${moved.stderr}`);
}
