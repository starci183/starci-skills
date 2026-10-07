// git-root.mjs — the top level of the git worktree a directory sits in (null outside one): where a verb that writes into an
// op's worktree anchors its containment check.
import path from 'node:path';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { gitResultOf } from '../lib/git.mjs';

/** The resolved `git rev-parse --show-toplevel` of `cwd`, or null when `cwd` is in no worktree. */
export const gitRootOf = (cwd) => {
  const found = gitResultOf(revParseQuery(['--show-toplevel'], { cwd }));
  return found.ok && found.stdout.trim() ? path.resolve(found.stdout.trim()) : null;
};
