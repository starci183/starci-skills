// branch-description.mjs — the Git configuration read for branch metadata.
import { gitRunner } from './lib.mjs';

/**
 * Read the branch description from Git configuration in `repoRoot`.
 * Returns trimmed stdout or null when it is empty; a falsy `branch` skips Git.
 * Command status does not distinguish missing configuration from a failed read.
 * `git` may replace the native read with a caller-supplied runner.
 */
export const branchDescription = (repoRoot, branch, { git = null } = {}) =>
  (branch ? gitRunner(git)(['config', '--get', `branch.${branch}.description`], { cwd: repoRoot }).stdout || null : null);
