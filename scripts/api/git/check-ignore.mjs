// check-ignore.mjs — `git check-ignore <args>`: whether paths are ignored (-q exits 0 for an ignored path).
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git check-ignore ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const checkIgnore = (args = [], options = {}) => runGit(['check-ignore', ...args], options);
