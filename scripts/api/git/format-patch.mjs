// format-patch.mjs — `git format-patch <args>`: commits as mailbox patches (--stdout for one stream).
import { runGit } from './lib.mjs';

/** The spawn result {status, stdout, stderr, error} of `git format-patch ...args`; options are runGit's (cwd or dir, config, timeout, maxBuffer, input, encoding, env, git). */
export const formatPatch = (args = [], options = {}) => runGit(['format-patch', ...args], options);
