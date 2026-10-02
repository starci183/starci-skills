// status-query.mjs — `git status <args>`: what a checkout changed (--porcelain, untracked-files mode, pathspecs).
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git status ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const statusQuery = (args = [], options = {}) => runGit(['status', ...args], options);
