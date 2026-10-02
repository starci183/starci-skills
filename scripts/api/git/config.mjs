// config.mjs — `git config <args>`: a configuration read or write (--get, --local, --unset).
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git config ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const config = (args = [], options = {}) => runGit(['config', ...args], options);
