// branch-list.mjs — `git branch --list <args>`: the local branches matching a pattern.
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git branch --list ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const branchList = (args = [], options = {}) => runGit(['branch', '--list', ...args], options);
