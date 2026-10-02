// ls-remote.mjs — `git ls-remote <args>`: the refs a remote advertises (--tags <remote> [<pattern>]).
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git ls-remote ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const lsRemote = (args = [], options = {}) => runGit(['ls-remote', ...args], options);
