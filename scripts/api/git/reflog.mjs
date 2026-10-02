// reflog.mjs — `git reflog <args>`: the reflog of a ref (when and how it moved).
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git reflog ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const reflog = (args = [], options = {}) => runGit(['reflog', ...args], options);
