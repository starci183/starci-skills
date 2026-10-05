// rev-parse.mjs — the commit-resolution read used by runtime Git consumers.
import { gitRunner } from './lib.mjs';

/**
 * Resolve a Git revision to a commit in `cwd`, peeling tags with `^{commit}`.
 * Returns the trimmed commit ID only when Git succeeds with output; unresolved
 * or non-commit revisions, failed reads and empty output return null.
 * `git` may supply a caller-owned runner instead of the native read.
 */
export const revParse = (cwd, ref, { git = null } = {}) => {
  const r = gitRunner(git)(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { cwd });
  return r.ok && r.stdout ? r.stdout : null;
};
