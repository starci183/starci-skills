// log.mjs — `git log <args>`: the commit history in a caller-chosen format.
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git log ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const log = (args = [], options = {}) => runGit(['log', ...args], options);
