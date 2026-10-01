// update-ref.mjs — `git update-ref <ref> <sha>`: point a ref at a commit (a preserved worktree's refs/heads/preserved/<name>).
import { gitRunner } from './lib.mjs';

/** {ok, stdout, stderr}. git: the caller's runner or null. */
export function updateRef(repoRoot, ref, sha, { git = null } = {}) {
  return gitRunner(git)(['update-ref', ref, sha], { cwd: repoRoot });
}
