// tag.mjs — `git tag <args>`: list or create tags (--points-at <rev>, -l <pattern>, -a <name> -m <message>).
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git tag ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const tag = (args = [], options = {}) => runGit(['tag', ...args], options);
