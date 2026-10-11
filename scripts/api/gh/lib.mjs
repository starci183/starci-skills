// scripts/api/gh/lib.mjs - the runner of the GitHub CLI: `gh <args>` waited for, utf8 text, a hidden window, never a shell. The call files beside it (workflow-runs.mjs, commit-checks.mjs) each name one read;
// nothing outside scripts/api/gh imports this runner. Every call here only READS GitHub (the runs of a workflow, the checks and the statuses of a commit); the repository is the one `cwd` belongs to.
import { spawnSync } from 'node:child_process';
import { withTempEnv } from '../../../engine/temp-root.mjs';

const BASE_OPTIONS = Object.freeze({ encoding: 'utf8', windowsHide: true });

/** `gh <args>` (options: gh = the binary, default gh on PATH; timeout in ms; the rest goes to spawnSync): the result {status, stdout, stderr, error}, error = gh itself unavailable. */
export function ghSpawn(args, options = {}) {
  const { gh = 'gh', timeout = 30_000, ...rest } = options;
  const spawnOptions = withTempEnv({ ...BASE_OPTIONS, timeout, ...rest });
  return spawnSync(gh, args, spawnOptions);
}
