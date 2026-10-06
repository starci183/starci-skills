// worktree-exclude.mjs — where a product repository keeps the runtime's own git worktrees (scratch trees made by
// scripts/machine/worktree-git.mjs createScratchWorktree), and the one test every scanner uses to stay out of them.
//
// Layout inside a product repository:
//   <repo>/.starciwork/worktrees/<name>    one runtime scratch tree
// The directory is git-excluded (.git/info/exclude), so `git status`,
// `git ls-files --others --exclude-standard` and sonar never see it; every scanner that walks the filesystem
// (canon-scan's eslint, starci app lint, the architecture walkers, input digests, proof-integrity, Work readers)
// skips it with isWorktreesPath / WORKTREES_IGNORE_GLOBS, or it would lint and hash every sibling worktree.
import path from 'node:path';
import { posixPath } from './path-key.mjs';

/** The worktrees directory, relative to the product repository root (posix). */
export const WORKTREES_REL = '.starciwork/worktrees';
/** Glob patterns an ESLint/tsc-style ignore list takes. */
export const WORKTREES_IGNORE_GLOBS = Object.freeze([`${WORKTREES_REL}/**`, `**/${WORKTREES_REL}/**`]);
/** The line .git/info/exclude (or .gitignore) carries. */
export const WORKTREES_EXCLUDE_LINE = `/${WORKTREES_REL}/`;

const posix = posixPath;

/**
 * True when `rel` (a path relative to a repository root, either slash) is the worktrees directory or inside it.
 * With `root`, `rel` may be absolute: it is made relative to root first.
 */
export function isWorktreesPath(rel, { root = null } = {}) {
  let p = posix(rel);
  if (root && path.isAbsolute(String(rel))) p = posix(path.relative(root, String(rel)));
  while (p.endsWith('/')) p = p.slice(0, -1);
  return p === WORKTREES_REL || p.startsWith(`${WORKTREES_REL}/`) || p.includes(`/${WORKTREES_REL}/`) || p.endsWith(`/${WORKTREES_REL}`);
}

/**
 * True when `abs` is a worktrees dir (or inside one) BELOW the scan root `root`. Always relative to the root a walker
 * started from: a walker whose root is itself a runtime tree (<repo>/.starciwork/worktrees/<name>) must still walk it.
 */
export const underWorktrees = (root, abs) => isWorktreesPath(path.relative(path.resolve(String(root)), path.resolve(String(abs))));
