// archive.mjs — `git archive <args>`: a revision's tracked files as a tar (the release flow hands exactly HEAD to its Linux parity container).
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git archive ...args`; options are runGit's (cwd or dir, timeout, maxBuffer, ...). */
export const archive = (args = [], options = {}) => runGit(['archive', ...args], options);
