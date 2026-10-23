// release-candidate.mjs - the candidate CI step of `starci release cut` (OWNER RULING candidate-ci, 2026-10-18, modules/kernel/owner-rulings.yaml):
//   "fix the root cause, and never again have main receive a release whose CI is red, with the owner confirming afterwards."
// Before main and the tag move, the exact release sha is pushed to the candidate ref refs/heads/release/candidate-<version> (the pre-push hook allows that
// namespace, scripts/guards/release-push-gate.mjs; every ci.yml triggers on it, rule CI_TRIGGERS_RELEASE_ONLY), and the cut waits for every required
// workflow run of THAT sha (modules/supervisor/release-cut.yaml candidate.workflows) to end:
//   green      every required workflow has a completed, successful run of the sha and no watched check failed: the cut goes on to the tag and the atomic push
//   red        RELEASE_CANDIDATE_CI_RED with the run URL and the failing jobs and steps; nothing reaches main. The candidate ref stays for diagnosis
//   timeout    RELEASE_CANDIDATE_CI_TIMEOUT (no run started within graceMinutes, or a run did not end within waitMinutes); nothing reaches main
//   unknown    RELEASE_CI_UNKNOWN: GitHub could not be read to the end; a cut never proceeds blind
// There is no override: a red candidate never passes (owner ruling 2026-10-22: a loosening is always red). Fix, commit, cut again.
// A re-cut of the same unreleased version force-moves the candidate ref only (never main); after a successful cut the candidate ref is left on the remote
// (it names the released sha; the next version's cut uses its own ref).
// Seams (deps): push, readRuns, readJobs, readChecks, sleep, now.
import { push as gitPush } from '../api/git/push.mjs';
import { workflowRuns } from '../api/gh/workflow-runs.mjs';
import { runJobs } from '../api/gh/run-jobs.mjs';
import { commitChecks } from '../api/gh/commit-checks.mjs';
import { readModuleJson } from '../../engine/runtime-root.mjs';
import { sleep as defaultSleep } from '../lib/sleep.mjs';
import { jsonReply as json } from '../lib/json-reply.mjs';

const RED_RUN = new Set(['failure', 'timed_out', 'startup_failure', 'action_required']);
const PASSING = new Set(['success', 'neutral', 'skipped']);

/** The candidate policy of release-cut.yaml: {refPrefix, workflows, statusPatterns, pollSeconds, graceMinutes, waitMinutes}. */
export const candidatePolicy = () => readModuleJson('modules', 'supervisor', 'release-cut.yaml').candidate;

/** The candidate ref of a release tag v<version>: refs/heads/release/candidate-<version>. */
export const candidateRef = (tag, policy = candidatePolicy()) => `${policy.refPrefix}${String(tag).replace(/^v/, '')}`;


/** The verdict of one required workflow over its runs of the sha: pending (no run) | running | green | red, with the deciding run. A cancelled run is no verdict. */
function workflowVerdict(runs) {
  const verdictful = (runs ?? []).filter((r) => r.conclusion !== 'cancelled');
  const red = verdictful.find((r) => RED_RUN.has(r.conclusion));
  if (red) return { state: 'red', run: red };
  if (!verdictful.length) return { state: 'pending', run: null };
  const open = verdictful.find((r) => r.status !== 'completed');
  if (open) return { state: 'running', run: open };
  const off = verdictful.find((r) => r.conclusion !== 'success');
  if (off) return { state: 'red', run: off };
  return { state: 'green', run: verdictful[0] };
}

/** The watched checks of the sha (names holding one of `patterns`) as [{name, state: success | failure | pending}]; null when GitHub cannot be read. */
function watchedChecks({ cwd, sha, patterns, deps }) {
  const read = deps.readChecks ?? ((part) => commitChecks({ sha, part }, { cwd }));
  const runs = json(read('check-runs'));
  const statuses = json(read('status'));
  if (!runs || !statuses) return null;
  const state = (status, conclusion) => {
    if (conclusion === undefined) return status === 'success' || status === 'pending' ? status : 'failure';
    if (status !== 'completed') return 'pending';
    return PASSING.has(conclusion) ? 'success' : 'failure';
  };
  return [
    ...(runs.check_runs ?? []).map((c) => ({ name: c.name, state: state(c.status, c.conclusion ?? null) })),
    ...(statuses.statuses ?? []).map((s) => ({ name: s.context, state: state(s.state) })),
  ].filter((c) => patterns.some((p) => c.name.toLowerCase().includes(p)));
}

/** One read of every required workflow of the sha: {ok, verdict, workflows: [{workflow, state, run}], checks, error?}. */
export function readCandidate({ cwd, sha, policy, deps = {} }) {
  const workflows = [];
  for (const workflow of policy.workflows) {
    const runs = json((deps.readRuns ?? ((name) => workflowRuns({ workflow: name, sha, limit: 20 }, { cwd })))(workflow));
    if (!Array.isArray(runs)) return { ok: false, verdict: 'unknown', workflows, checks: [], error: `gh run list --workflow ${workflow} could not be read` };
    workflows.push({ workflow, ...workflowVerdict(runs.filter((r) => !r.headSha || r.headSha === sha)) });
  }
  const checks = watchedChecks({ cwd, sha, patterns: policy.statusPatterns ?? [], deps });
  if (!checks) return { ok: false, verdict: 'unknown', workflows, checks: [], error: 'the checks of the sha could not be read' };
  const states = new Set(workflows.map((w) => w.state));
  let verdict = 'green';
  if (states.has('red') || checks.some((c) => c.state === 'failure')) verdict = 'red';
  else if (states.has('pending')) verdict = 'pending';
  else if (states.has('running') || checks.some((c) => c.state === 'pending')) verdict = 'running';
  return { ok: true, verdict, workflows, checks };
}

/** The failing jobs and steps of a red run: ['job (conclusion): step, step']; [] when they cannot be read. */
export function failingJobs({ cwd, run, deps = {} }) {
  if (!run?.databaseId && !run?.id) return [];
  const reply = json((deps.readJobs ?? ((id) => runJobs({ id }, { cwd })))(run.databaseId ?? run.id));
  return (reply?.jobs ?? []).filter((job) => job.conclusion && !PASSING.has(job.conclusion))
    .map((job) => {
      const steps = (job.steps ?? []).filter((step) => step.conclusion && !PASSING.has(step.conclusion)).map((step) => step.name);
      const where = steps.length ? ': ' + steps.join(', ') : '';
      return `${job.name} (${job.conclusion})${where}`;
    });
}

/** Poll until the candidate is green or red, or the grace (no run yet) or wait deadline passes: the last read plus {timedOut}. */
async function waitForCandidate({ cwd, sha, policy, deps }) {
  const now = deps.now ?? Date.now;
  const started = now();
  const deadlines = { grace: started + policy.graceMinutes * 60_000, wait: started + policy.waitMinutes * 60_000 };
  return pollCandidate({ cwd, sha, policy, deps, now, deadlines, lastReadable: null });
}

/** One poll of the candidate, then the next after pollSeconds (a recursion, one read per step). */
async function pollCandidate({ cwd, sha, policy, deps, now, deadlines, lastReadable }) {
  const seen = readCandidate({ cwd, sha, policy, deps });
  const readable = seen.ok ? seen : lastReadable;
  if (seen.ok && (seen.verdict === 'green' || seen.verdict === 'red')) return { ...seen, timedOut: false };
  const at = now();
  const unstarted = seen.ok && seen.verdict === 'pending' && at >= deadlines.grace;
  if (unstarted || at >= deadlines.wait) return { ...(readable ?? seen), timedOut: true, unstarted, readable: Boolean(readable) };
  await (deps.sleep ?? defaultSleep)(policy.pollSeconds * 1000);
  return pollCandidate({ cwd, sha, policy, deps, now, deadlines, lastReadable: readable });
}

const runLine = (w) => [w.workflow, w.state, w.run?.url].filter(Boolean).join(' ');

/**
 * The candidate step: push `head` to the candidate ref of `tag` on `remote` (through `pushTarget`, the lifted push url when the remote is parked), wait for its CI.
 * Returns {ok, verdict, why, ref, workflows, failing}: ok true only on green.
 */
export async function candidateCi({ repo, remote, pushTarget = null, head, tag, deps = {} }) {
  const policy = deps.policy ?? candidatePolicy();
  const ref = candidateRef(tag, policy);
  const pushed = await (deps.push ?? ((args) => gitPush(args, { cwd: repo, timeout: 600_000 })))([pushTarget ?? remote, `+${head}:${ref}`]);
  if (pushed.status !== 0) return { ok: false, verdict: 'candidate-push', ref, why: `the push of ${head.slice(0, 9)} to ${ref} on ${remote} failed (nothing moved on main): ${String(pushed.stderr ?? '').trim().slice(0, 300)}` };
  const seen = await waitForCandidate({ cwd: repo, sha: head, policy, deps });
  const workflows = seen.workflows ?? [];
  const runs = workflows.map(runLine).join('; ');
  if (seen.ok && seen.verdict === 'green') return { ok: true, verdict: 'candidate-green', ref, workflows, why: `candidate CI green for ${head.slice(0, 9)} on ${ref}: ${runs}` };
  if (seen.ok && seen.verdict === 'red') {
    const redRuns = workflows.filter((w) => w.state === 'red');
    const failing = redRuns.flatMap((w) => failingJobs({ cwd: repo, run: w.run, deps }).map((line) => `${w.workflow}: ${line}`));
    const checks = (seen.checks ?? []).filter((c) => c.state === 'failure').map((c) => `check ${c.name} failed`);
    const detail = [...failing, ...checks].join('; ') || 'the failing jobs could not be read';
    return { ok: false, verdict: 'RELEASE_CANDIDATE_CI_RED', ref, workflows, failing,
      why: `RELEASE_CANDIDATE_CI_RED: CI of the candidate ${head.slice(0, 9)} on ${ref} is red (${runs}); failing: ${detail}. Nothing reached main; the candidate ref stays for diagnosis. Fix, commit, and cut again (the candidate ref is force-moved, main never)` };
  }
  if (seen.timedOut && seen.readable) {
    const why = seen.unstarted
      ? `no run of ${policy.workflows.join(', ')} started for ${head.slice(0, 9)} on ${ref} within ${policy.graceMinutes} minutes (does every required workflow trigger on release/candidate-*?)`
      : `the candidate CI of ${head.slice(0, 9)} on ${ref} did not end within ${policy.waitMinutes} minutes (${runs})`;
    return { ok: false, verdict: 'RELEASE_CANDIDATE_CI_TIMEOUT', ref, workflows, why: `RELEASE_CANDIDATE_CI_TIMEOUT: ${why}. Nothing reached main` };
  }
  return { ok: false, verdict: 'RELEASE_CI_UNKNOWN', ref, workflows, why: `RELEASE_CI_UNKNOWN: GitHub could not be read for the candidate ${head.slice(0, 9)} on ${ref} (${seen.error ?? 'no readable reply'}); a cut never proceeds blind. Nothing reached main` };
}
