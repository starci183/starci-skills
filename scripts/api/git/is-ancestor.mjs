// is-ancestor.mjs — `git merge-base --is-ancestor <a> <b>`: whether commit `a` is in the history of `b`.
import { gitRunner } from './lib.mjs';

/** True when `a` is an ancestor of (or equal to) `b`; false otherwise, and when a ref does not resolve. git: the caller's runner or null. */
export const isAncestor = (cwd, a, b, { git = null } = {}) => gitRunner(git)(['merge-base', '--is-ancestor', a, b], { cwd }).ok;
