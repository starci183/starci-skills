// worktree-add.mjs — the only `git worktree add` of the runtime (scripts/checks/check-worktree-add.mjs fails any other):
// a runtime-internal scratch tree no agent ever works in (land/push scratch, the verify-proof base tree, the supervisor's
// revert lane). Its one caller is scripts/machine/worktree-git.mjs createScratchWorktree, which registers the tree and
// hands it to the GC; an agent's workspace is an Orca kind and Orca makes it (scripts/machine/worktree-orca.mjs).
import { gitRunner } from './lib.mjs';

/**
 * `git worktree add` once. Exactly one of `detach` (a detached HEAD at `base`), `newBranch` (branch `branch` created at
 * `base`) or an existing `branch`. git: the caller's runner (a spec's fake) or null. {ok, stdout, stderr}
 */
export function worktreeAdd({ repoRoot, target, base = null, branch = null, newBranch = false, detach = false, git = null }) {
  let args;
  if (detach) args = ['worktree', 'add', '--detach', target, base];
  else if (newBranch) args = ['worktree', 'add', '-b', branch, target, base];
  else args = ['worktree', 'add', target, branch];
  return gitRunner(git)(args, { cwd: repoRoot });
}
