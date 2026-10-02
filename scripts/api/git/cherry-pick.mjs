// cherry-pick.mjs — `git cherry-pick <args>`: commits applied onto the checked-out branch (--abort ends a stopped one).
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git cherry-pick ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const cherryPick = (args = [], options = {}) => runGit(['cherry-pick', ...args], options);
