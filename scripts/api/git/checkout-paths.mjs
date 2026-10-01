// checkout-paths.mjs — `git --literal-pathspecs checkout <rev> -- <paths>`: the working tree and index of exactly `paths` at `rev`.
import { gitRunner } from './lib.mjs';

/** {ok, stdout, stderr}. git: the caller's runner or null. */
export function checkoutPaths(cwd, rev, paths, { git = null } = {}) {
  return gitRunner(git)(['--literal-pathspecs', 'checkout', rev, '--', ...paths], { cwd });
}
