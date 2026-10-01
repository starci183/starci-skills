// porcelain-status.mjs — `git [--literal-pathspecs] status --porcelain[=v2] --untracked-files=<mode> -- <pathspecs>`: what a checkout changed.
import { gitRunner } from './lib.mjs';

/**
 * {ok, stdout, stderr}; stdout is empty when the checkout is clean under the pathspecs. version 2 starts every line with
 * its record type (no leading blank a runner's trim could eat). literal: pathspecs are plain paths (no glob magic). git: the caller's runner or null.
 */
export function porcelainStatus(cwd, { pathspecs = [], untracked = 'all', version = 1, literal = false, git = null } = {}) {
  return gitRunner(git)([...(literal ? ['--literal-pathspecs'] : []), 'status', version === 2 ? '--porcelain=v2' : '--porcelain', `--untracked-files=${untracked}`, '--', ...pathspecs], { cwd });
}
