// diff.mjs — `git diff <args>`: the changes between commits, the index and the working tree.
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git diff ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const diff = (args = [], options = {}) => runGit(['diff', ...args], options);
