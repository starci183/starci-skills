// worktree-list-query.mjs — `git worktree list <args>`: the registered worktrees of a repository (--porcelain for records).
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git worktree list ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const worktreeListQuery = (args = [], options = {}) => runGit(['worktree', 'list', ...args], options);
