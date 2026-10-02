// write-tree.mjs — `git write-tree <args>`: a tree object written from the index (its sha on stdout).
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git write-tree ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const writeTree = (args = [], options = {}) => runGit(['write-tree', ...args], options);
