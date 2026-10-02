// notes.mjs — `git notes <args>`: write or read local commit metadata without rewriting history.
import { runGit } from './lib.mjs';

/** The spawn result of `git notes ...args`; options are runGit's injectable execution options. */
export const notes = (args = [], options = {}) => runGit(['notes', ...args], options);
