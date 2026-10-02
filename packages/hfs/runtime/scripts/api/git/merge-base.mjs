// merge-base.mjs — `git merge-base <a> <b>`: the best common ancestor of two commits. Whether one commit is in another
// is is-ancestor.mjs.
import { gitRunner } from './lib.mjs';

/** The best common ancestor of commits `a` and `b` (a sha), or null when they share none or a ref does not resolve. */
export const mergeBase = (cwd, a, b, { git = null } = {}) => {
  const r = gitRunner(git)(['merge-base', a, b], { cwd });
  return r.ok && r.stdout ? r.stdout : null;
};
