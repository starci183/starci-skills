// init.mjs — `git -c init.defaultBranch=<branch> init --quiet`: create an empty repository in `cwd` (the install sandbox's app repository).
import { gitRunner } from './lib.mjs';

/** {ok, stdout, stderr}. `env` replaces the process env (a sandbox's own home); git: the caller's runner or null. */
export function init(cwd, { branch = 'main', env = undefined, git = null } = {}) {
  return gitRunner(git)(['-c', `init.defaultBranch=${branch}`, 'init', '--quiet'], env ? { cwd, env } : { cwd });
}
