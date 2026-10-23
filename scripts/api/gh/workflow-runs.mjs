// workflow-runs.mjs - the runs of one workflow, optionally filtered by commit, branch and status.
// With a commit the runs are read by commit (`gh run list --commit`) and kept by workflow name: GitHub resolves `--workflow` only for a
// workflow file on the default branch, so a workflow the release adds (it reaches main only with the release) would read as unknown while
// its candidate run exists. Without a commit the runs are read by workflow, as GitHub knows it.
import { ghSpawn } from './lib.mjs';

const FIELDS = 'databaseId,status,conclusion,url,headSha,event,createdAt,workflowName';
/** The runs one commit can carry across every workflow (ci, examples, sonar, their reruns and the bots'): the window read before the name filter. */
const COMMIT_WINDOW = 100;

/** The spawn result of the run list; optional sha, branch and status filter runs, and limit defaults to 10. Options are ghSpawn's (cwd, gh, timeout). */
export function workflowRuns({ workflow, sha, branch, status, limit = 10 }, options = {}) {
  const byCommit = sha !== undefined;
  const args = ['run', 'list', ...(byCommit ? ['--commit', sha] : ['--workflow', workflow])];
  if (branch !== undefined) args.push('--branch', branch);
  if (status !== undefined) args.push('--status', status);
  args.push('--limit', String(byCommit ? Math.max(limit, COMMIT_WINDOW) : limit), '--json', FIELDS);
  const reply = ghSpawn(args, options);
  if (!byCommit || reply.status !== 0) return reply;
  let runs;
  try { runs = JSON.parse(reply.stdout); } catch { return reply; }
  if (!Array.isArray(runs)) return reply;
  const named = runs.filter((run) => run.workflowName === workflow).slice(0, limit);
  return { ...reply, stdout: JSON.stringify(named) };
}
