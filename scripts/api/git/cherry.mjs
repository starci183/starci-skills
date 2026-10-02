// cherry.mjs — `git cherry <args>`: the commits of a branch not yet upstream (one `+`/`-` line per commit).
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git cherry ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const cherry = (args = [], options = {}) => runGit(['cherry', ...args], options);
