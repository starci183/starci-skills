// merge-base-query.mjs — `git merge-base <args>`: one merge-base query (the best common ancestor, or --is-ancestor's exit status).
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git merge-base ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const mergeBaseQuery = (args = [], options = {}) => runGit(['merge-base', ...args], options);
