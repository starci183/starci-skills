// ls-files.mjs — `git ls-files <args>`: the paths the index tracks (--cached), or the untracked / deleted / ignored ones
// the flags ask for (-z keeps any file name intact).
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git ls-files ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const lsFiles = (args = [], options = {}) => runGit(['ls-files', ...args], options);
