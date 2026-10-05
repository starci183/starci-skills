// lane-landed.mjs - the Supervisor GC's conservative proof that a lane's commits landed in main.
// Used by gc.mjs collectLanes; it reads evidence only and never removes a worktree or branch.
import { readSupervisor } from '../machine/home.mjs';
import { parseJson } from '../lib/json.mjs';

/** The commits the land gate landed for `branch`: every commit of its passed land_runs (commit_sha and commits_json). */
export function landedCommitsForLane(branch, env) {
  return readSupervisor((m) => {
    const landed = new Set();
    for (const r of m.db.prepare("SELECT commit_sha, commits_json FROM land_runs WHERE lane=? AND result='passed'").all(branch)) {
      landed.add(r.commit_sha);
      const commits = parseJson(r.commits_json);
      if (Array.isArray(commits)) for (const sha of commits) if (typeof sha === 'string') landed.add(sha);
    }
    return landed;
  }, new Set(), { env });
}

/** Conservative file proof for a lane whose land changed patch IDs (conflict resolution or contract entry). */
export function laneContentLanded(commits, branch, root, run) {
  const touched = new Set();
  for (const sha of commits) {
    const paths = run(['diff-tree', '--root', '-r', '--no-commit-id', '--name-only', '-z', sha], { cwd: root });
    if (!paths.ok) return false;
    for (const file of paths.stdout.split('\0').filter(Boolean)) touched.add(file);
  }
  if (!touched.size) return false;
  for (const file of touched) {
    const diff = run(['diff', '--name-only', '-z', 'main', branch, '--', file], { cwd: root });
    if (!diff.ok) return false;
    if (!diff.stdout) continue;
    const mainTime = run(['log', '-1', '--format=%ct', 'main', '--', file], { cwd: root });
    const laneTime = run(['log', '-1', '--format=%ct', branch, '--', file], { cwd: root });
    if (!mainTime.ok || !laneTime.ok || !mainTime.stdout.trim() || !laneTime.stdout.trim() ||
        Number(mainTime.stdout.trim()) <= Number(laneTime.stdout.trim())) return false;
  }
  return true;
}
