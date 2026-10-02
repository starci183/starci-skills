// read-tree.mjs — `git read-tree <args>`: a tree read into the index.
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git read-tree ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const readTree = (args = [], options = {}) => runGit(['read-tree', ...args], options);
