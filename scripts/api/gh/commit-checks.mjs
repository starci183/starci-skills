// commit-checks.mjs - what GitHub holds about one commit, two reads of `gh api repos/{owner}/{repo}/commits/<sha>/<part>`:
//   check-runs   the GitHub apps that report as check runs (SonarCloud, Codecov's app): JSON {check_runs: [{name, status, conclusion}]}
//   status       the combined commit status (the services that report as statuses: codecov/project, codecov/patch): JSON {state, statuses: [{context, state}]}
import { ghSpawn } from './lib.mjs';

const PARTS = Object.freeze(['check-runs', 'status']);

/** The spawn result of one read of `sha` (`part`: check-runs | status); options are ghSpawn's (cwd, gh, timeout). A part this file does not name is an Error. */
export function commitChecks({ sha, part }, options = {}) {
  if (!PARTS.includes(part)) throw new Error(`commit checks: ${part} is not one of ${PARTS.join(', ')}`);
  return ghSpawn(['api', `repos/{owner}/{repo}/commits/${sha}/${part}`], options);
}
