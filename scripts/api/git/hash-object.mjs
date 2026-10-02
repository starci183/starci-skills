// hash-object.mjs — `git hash-object <args>`: the object id of content (-w writes it, --stdin reads it).
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git hash-object ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const hashObject = (args = [], options = {}) => runGit(['hash-object', ...args], options);
