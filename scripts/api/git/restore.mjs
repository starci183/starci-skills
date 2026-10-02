// restore.mjs — `git restore <args>`: working-tree or index paths restored from a source.
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git restore ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const restore = (args = [], options = {}) => runGit(['restore', ...args], options);
