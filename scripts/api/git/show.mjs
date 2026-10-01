// show.mjs — `git show <rev>:<path>`: the exact text of a file at a revision, or null when the revision does not hold it.
import { runGit } from './lib.mjs';

/** The text of `file` (repository-relative, forward slashes) at `rev` in the repository at `cwd`, untrimmed; null when absent. */
export const show = (cwd, rev, file) => {
  const r = runGit(['show', `${rev}:${file}`], { cwd, maxBuffer: 64 * 1024 * 1024 });
  return !r.error && r.status === 0 ? r.stdout : null;
};
