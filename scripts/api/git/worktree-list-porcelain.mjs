// worktree-list-porcelain.mjs — `git worktree list --porcelain` as {path, branch, head, prunable} rows. The lookups over it
// (mainRootOf, registeredAt) are scripts/machine/worktree-git.mjs.
import path from 'node:path';
import { gitRunner } from './lib.mjs';

/** {path, branch, head, prunable} of every registered worktree of the repository (the main checkout first). */
export function worktreeListPorcelain(repoRoot, { git = null } = {}) {
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
