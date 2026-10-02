// worktree-remove.mjs — `git worktree remove --force <target>`, the runtime's only one. Git for Windows follows a junction
// inside the tree and empties its target, so its one caller is scripts/machine/worktree-git.mjs
// safeRemoveWorktree, after every link in the tree was removed as a link and zero asserted (tests/api-fs/safe-remove.spec.mjs
// fails any other caller of the verb).
import { gitRunner } from './lib.mjs';

/** {ok, stdout, stderr}. git: the caller's runner or null. */
export function worktreeRemove(repoRoot, target, { git = null } = {}) {
  return gitRunner(git)(['worktree', 'remove', '--force', target], { cwd: repoRoot });
}
