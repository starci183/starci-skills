// commit-tree.mjs — `git commit-tree <args>`: a commit object written from a tree (its sha on stdout).
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git commit-tree ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const commitTree = (args = [], options = {}) => runGit(['commit-tree', ...args], options);
