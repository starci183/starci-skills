// ls-tree.mjs — `git ls-tree <args>`: the entries of a tree object.
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git ls-tree ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const lsTree = (args = [], options = {}) => runGit(['ls-tree', ...args], options);
