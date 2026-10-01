// worktree-prune.mjs — `git worktree prune`: drop the registrations of worktrees whose directory is gone.
import { gitRunner } from './lib.mjs';

/** {ok, stdout, stderr}. git: the caller's runner or null. */
export function worktreePrune(repoRoot, { git = null } = {}) {
  return gitRunner(git)(['worktree', 'prune'], { cwd: repoRoot });
}
