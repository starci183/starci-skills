// revert.mjs — `git revert <args>`: the inverse of commits applied to the checked-out branch (--no-commit stages it only).
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git revert ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const revert = (args = [], options = {}) => runGit(['revert', ...args], options);
