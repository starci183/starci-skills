// config-get.mjs — `git config --get <key>`: one configuration value of a checkout (empty when unset).
import { gitRunner } from './lib.mjs';

/** {ok, stdout, stderr}; `env` replaces the process env (a caller drops git's repository-local variables). git: the caller's runner or null. */
export function configGet(cwd, key, { env = undefined, git = null } = {}) {
  return gitRunner(git)(['config', '--get', key], env ? { cwd, env } : { cwd });
}
