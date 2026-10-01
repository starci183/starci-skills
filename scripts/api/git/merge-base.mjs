// merge-base.mjs — `git merge-base`: the best common ancestor of two commits (mergeBase), and whether commit `a` is in `b`
// (isAncestor, `--is-ancestor`).
import { gitRunner } from './lib.mjs';

export const isAncestor = (cwd, a, b, { git = null } = {}) => gitRunner(git)(['merge-base', '--is-ancestor', a, b], { cwd }).ok;

/** The best common ancestor of commits `a` and `b` (a sha), or null when they share none or a ref does not resolve. */
export const mergeBase = (cwd, a, b, { git = null } = {}) => {
  const r = gitRunner(git)(['merge-base', a, b], { cwd });
  return r.ok && r.stdout ? r.stdout : null;
};
