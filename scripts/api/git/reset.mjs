// reset.mjs — `git reset <args>`: HEAD, the index or the working tree reset to a commit.
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git reset ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const reset = (args = [], options = {}) => runGit(['reset', ...args], options);
