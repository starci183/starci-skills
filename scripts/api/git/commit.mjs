// commit.mjs — `git commit <args>`: a commit of the staged index.
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git commit ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const commit = (args = [], options = {}) => runGit(['commit', ...args], options);
