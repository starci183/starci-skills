// worktree-exclude.mjs — where a product repository keeps its per-workflow and per-op git worktrees, and the one
// test every scanner uses to stay out of them (DESIGN §16.7, owner rulings 2026-09-28).
//
// Layout inside a product repository (scripts/kernel/product-worktree.mjs):
//   <repo>/.starciwork/worktrees/<wf>/_wf     the workflow's integration worktree, branch wf/<wf>
//   <repo>/.starciwork/worktrees/<wf>/<op>    one op job's worktree, branch op/<op> (a sibling of _wf, never inside it)
// <wf> and <op> are short ids (8 chars). The directory is git-excluded (.git/info/exclude), so `git status`,
// `git ls-files --others --exclude-standard` and sonar never see it; every scanner that walks the filesystem
// (canon-scan's eslint, check-scoped-lint, the architecture walkers, input digests, proof-integrity, Work readers)
// skips it with isWorktreesPath / WORKTREES_IGNORE_GLOBS, or it would lint and hash every sibling worktree.
import path from 'node:path';
import { posixPath } from './path-key.mjs';

/** The worktrees directory, relative to the product repository root (posix). */
export const WORKTREES_REL = '.starciwork/worktrees';
/** The directory name of a workflow's integration worktree under <WORKTREES_REL>/<wf>/. */
export const WORKFLOW_DIR_NAME = '_wf';
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
  p = p.replace(/\/+$/, '');
  return p === WORKTREES_REL || p.startsWith(`${WORKTREES_REL}/`) || p.includes(`/${WORKTREES_REL}/`) || p.endsWith(`/${WORKTREES_REL}`);
}

/**
 * True when `abs` is a worktrees dir (or inside one) BELOW the scan root `root`. Always relative to the root a walker
 * started from: a walker whose root is itself an op worktree (<repo>/.starciwork/worktrees/<wf>/<op>) must still walk it.
 */
export const underWorktrees = (root, abs) => isWorktreesPath(path.relative(path.resolve(String(root)), path.resolve(String(abs))));
