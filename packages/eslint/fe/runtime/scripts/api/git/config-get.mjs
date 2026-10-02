// config-get.mjs — `git config [--local] --get <key>`: one configuration value of a checkout (empty when unset).
import { gitRunner } from './lib.mjs';

/**
 * {ok, stdout, stderr}; `local` reads the repository's own config only; `env` replaces the process env (a caller drops
 * git's repository-local variables). git: the caller's runner or null.
 */
export function configGet(cwd, key, { local = false, env = undefined, git = null } = {}) {
  return gitRunner(git)(['config', ...(local ? ['--local'] : []), '--get', key], env ? { cwd, env } : { cwd });
}
