// run-jobs.mjs - the jobs of one workflow run, `gh run view <id> --json jobs`: JSON {jobs: [{name, conclusion, status, url, steps: [{name, conclusion}]}]}.
// The release candidate flow (scripts/supervisor/release-candidate.mjs) names the failing jobs and steps of a red candidate run with it.
import { ghSpawn } from './lib.mjs';

/** The spawn result of the job read of run `id` (a positive integer); options are ghSpawn's (cwd, gh, timeout). Any other id is an Error. */
export function runJobs({ id }, options = {}) {
  if (!/^\d+$/.test(String(id))) throw new Error(`run jobs: ${id} is not a run id`);
  return ghSpawn(['run', 'view', String(id), '--json', 'jobs'], options);
}
