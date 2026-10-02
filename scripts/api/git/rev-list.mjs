// rev-list.mjs — `git rev-list <args>`: the commits reachable from one set of refs and not another.
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git rev-list ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const revList = (args = [], options = {}) => runGit(['rev-list', ...args], options);
