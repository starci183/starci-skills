// merge.mjs — `git merge <args>`: merge one ref with the caller-selected fast-forward policy.
import { runGit } from './lib.mjs';

/** The spawn result of `git merge ...args`; options are runGit's injectable execution options. */
export const merge = (args = [], options = {}) => runGit(['merge', ...args], options);
