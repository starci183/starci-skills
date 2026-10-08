// workflow-runs.mjs - `gh run list --workflow <name> --commit <sha> --json ...`: the runs of one workflow for one commit (a push of main and a push of its tag are two runs).
import { ghSpawn } from './lib.mjs';

const FIELDS = 'databaseId,status,conclusion,url,headSha,event,createdAt,workflowName';

/** The spawn result of the run list; stdout is a JSON array of {databaseId, status, conclusion, url, headSha, event, createdAt, workflowName}. Options are ghSpawn's (cwd, gh, timeout). */
export const workflowRuns = ({ workflow, sha }, options = {}) => ghSpawn(['run', 'list', '--workflow', workflow, '--commit', sha, '--limit', '10', '--json', FIELDS], options);
