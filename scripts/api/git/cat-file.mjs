// cat-file.mjs — `git cat-file <args>`: the type, size or content of repository objects (-e, -p, --batch).
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git cat-file ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const catFile = (args = [], options = {}) => runGit(['cat-file', ...args], options);
