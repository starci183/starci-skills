// worktree-list.mjs — `git worktree list --porcelain` as {path, branch, head, prunable} rows, and the lookups over it.
import path from 'node:path';
import { gitRunner } from './lib.mjs';
import { sameTree } from '../../lib/worktree-registry.mjs';

/** {path, branch, head, prunable} of every registered worktree of the repository (the main checkout first). */
export function gitWorktreeList(repoRoot, { git = null } = {}) {
  const r = gitRunner(git)(['worktree', 'list', '--porcelain'], { cwd: repoRoot });
  const out = [];
  let cur = null;
  for (const line of r.stdout.split(/\r?\n/)) {
    if (line.startsWith('worktree ')) { cur = { path: path.resolve(line.slice(9).trim()), branch: null, head: null, prunable: false }; out.push(cur); }
    else if (cur && line.startsWith('HEAD ')) cur.head = line.slice(5).trim();
    else if (cur && line.startsWith('branch ')) cur.branch = line.slice(7).trim().replace(/^refs\/heads\//, '');
    else if (cur && line.startsWith('prunable')) cur.prunable = true;
  }
  return out;
}

/** The repository's main checkout (the first `git worktree list` entry): the registry's repo key, from any of its trees. */
export const mainRootOf = (repoRoot, opts) => gitWorktreeList(repoRoot, opts)[0]?.path ?? path.resolve(repoRoot);

/** The registration of `dir` in the repository, or null. */
export const registeredAt = (repoRoot, dir, opts) => gitWorktreeList(repoRoot, opts).find((w) => sameTree(w.path, dir)) ?? null;
