// merge-base.mjs — `git merge-base --is-ancestor a b`: whether commit `a` is in `b`.
import { gitRunner } from './lib.mjs';

export const isAncestor = (cwd, a, b, { git = null } = {}) => gitRunner(git)(['merge-base', '--is-ancestor', a, b], { cwd }).ok;
