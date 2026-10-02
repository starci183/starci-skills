// merge-tree.mjs — `git merge-tree <args>`: a merge computed without touching the index or the working tree.
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git merge-tree ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const mergeTree = (args = [], options = {}) => runGit(['merge-tree', ...args], options);
