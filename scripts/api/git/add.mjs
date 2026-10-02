// add.mjs — `git add <args>`: paths staged into the index.
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git add ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const add = (args = [], options = {}) => runGit(['add', ...args], options);
