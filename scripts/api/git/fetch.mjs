// fetch.mjs — `git fetch <args>`: bring objects (and FETCH_HEAD) from another repository, moving no branch of this one.
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git fetch ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const fetch = (args = [], options = {}) => runGit(['fetch', ...args], options);
