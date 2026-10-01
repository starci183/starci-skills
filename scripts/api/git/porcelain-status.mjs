// porcelain-status.mjs — `git status --porcelain[=v2] --untracked-files=<mode> -- <pathspecs>`: what a checkout changed.
import { gitRunner } from './lib.mjs';

/**
 * {ok, stdout, stderr}; stdout is empty when the checkout is clean under the pathspecs. version 2 starts every line with
 * its record type (no leading blank a runner's trim could eat). git: the caller's runner or null.
 */
export function porcelainStatus(cwd, { pathspecs = [], untracked = 'all', version = 1, git = null } = {}) {
  return gitRunner(git)(['status', version === 2 ? '--porcelain=v2' : '--porcelain', `--untracked-files=${untracked}`, '--', ...pathspecs], { cwd });
}
