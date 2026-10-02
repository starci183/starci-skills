// hook.mjs — `git hook <args>`: a repository hook run the way git runs it (hook run <name>).
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git hook ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const hook = (args = [], options = {}) => runGit(['hook', ...args], options);
