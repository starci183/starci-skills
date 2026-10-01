// branch-delete.mjs — delete a removed tree's branch: 'merged' -> `git branch -d` (judged against `main`), 'force' -> `-D`.
import { gitRunner } from './lib.mjs';
import { revParse } from './rev-parse.mjs';
import { isAncestor } from './merge-base.mjs';

/** {ok, detail?}. The branch's config section goes with it. */
export function deleteBranch({ repoRoot, branch, mode, main = 'main', git = null }) {
  const run = gitRunner(git);
  const flag = mode === 'force' ? '-D' : '-d';
  let d = run(['branch', flag, branch], { cwd: repoRoot });
  // `branch -d` judges "merged" against the repo's HEAD; a repo not on main is judged against main here.
  if (!d.ok && flag === '-d') {
    const tip = revParse(repoRoot, `refs/heads/${branch}`), m = revParse(repoRoot, main);
    if (tip && m && isAncestor(repoRoot, tip, m)) d = run(['branch', '-D', branch], { cwd: repoRoot });
  }
  if (d.ok) run(['config', '--remove-section', `branch.${branch}`], { cwd: repoRoot });
  return d.ok ? { ok: true } : { ok: false, detail: d.stderr.slice(0, 200) };
}
