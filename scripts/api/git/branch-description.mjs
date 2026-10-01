// branch-description.mjs — `git config --get branch.<name>.description`: the text a branch carries, or null.
import { gitRunner } from './lib.mjs';

export const branchDescription = (repoRoot, branch, { git = null } = {}) =>
  (branch ? gitRunner(git)(['config', '--get', `branch.${branch}.description`], { cwd: repoRoot }).stdout || null : null);
