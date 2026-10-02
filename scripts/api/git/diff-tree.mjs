// diff-tree.mjs — `git diff-tree <args>`: the paths a commit changed against its parents.
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git diff-tree ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const diffTree = (args = [], options = {}) => runGit(['diff-tree', ...args], options);
