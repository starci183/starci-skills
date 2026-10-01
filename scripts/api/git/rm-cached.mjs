// rm-cached.mjs — `git --literal-pathspecs rm --cached --quiet --ignore-unmatch -- <paths>`: drop `paths` from the index only.
import { gitRunner } from './lib.mjs';

/** {ok, stdout, stderr}. git: the caller's runner or null. */
export function rmCached(cwd, paths, { git = null } = {}) {
  return gitRunner(git)(['--literal-pathspecs', 'rm', '--cached', '--quiet', '--ignore-unmatch', '--', ...paths], { cwd });
}
