// workflow-runs.mjs - the runs of one workflow, optionally filtered by commit, branch and status.
import { ghSpawn } from './lib.mjs';

const FIELDS = 'databaseId,status,conclusion,url,headSha,event,createdAt,workflowName';

/** The spawn result of the run list; optional sha, branch and status filter runs, and limit defaults to 10. Options are ghSpawn's (cwd, gh, timeout). */
export function workflowRuns({ workflow, sha, branch, status, limit = 10 }, options = {}) {
  const args = ['run', 'list', '--workflow', workflow];
  if (sha !== undefined) args.push('--commit', sha);
  if (branch !== undefined) args.push('--branch', branch);
  if (status !== undefined) args.push('--status', status);
  args.push('--limit', String(limit), '--json', FIELDS);
  return ghSpawn(args, options);
}
