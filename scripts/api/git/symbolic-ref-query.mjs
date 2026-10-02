// symbolic-ref-query.mjs — `git symbolic-ref <args>`: one symbolic-ref query (-q, --short): the branch a symbolic ref names.
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git symbolic-ref ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const symbolicRefQuery = (args = [], options = {}) => runGit(['symbolic-ref', ...args], options);
