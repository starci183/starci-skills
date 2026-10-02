// rebase.mjs — `git rebase <args>`: the checked-out branch's commits replayed onto another commit (--abort ends a stopped one).
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git rebase ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const rebase = (args = [], options = {}) => runGit(['rebase', ...args], options);
