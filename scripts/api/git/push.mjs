// push.mjs — `git push <args>`: refs sent to a remote.
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git push ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const push = (args = [], options = {}) => runGit(['push', ...args], options);
