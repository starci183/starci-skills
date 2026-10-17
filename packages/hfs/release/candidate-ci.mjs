// candidate-ci.mjs - the candidate CI of `starci app release push` (OWNER RULING candidate-ci, 2026-10-18: "never again have main receive a release whose CI is
// red, with the owner confirming afterwards"). The push sends the exact release sha to refs/heads/release/candidate-<version> first (the managed ci.yml triggers on
// release/candidate-*), waits for the ci.yml run of THAT sha, and moves the default branch and the tag only when it is green:
//   green     the newest non-cancelled run of the sha concluded success
//   red       RELEASE_CANDIDATE_CI_RED with the run URL and the failing jobs and steps; nothing reaches the default branch. The candidate ref stays for diagnosis
//   timeout   RELEASE_CANDIDATE_CI_TIMEOUT: no run started within the grace, or it did not end within the wait
//   unknown   RELEASE_CI_UNKNOWN: GitHub could not be read to the end; a release never proceeds blind
// Emergency path (documented, owner-only): the owner's `starci release ci-override --sha <sha>` record for this exact sha
// (<git common dir>/starci-release/<sha>.ci-override.json, schema starci/ci-override@1) lets a red candidate through, and the push says so.
// Every process goes through ctx.spawn (git, gh); the wait through ctx.sleep and ctx.now.
import fs from 'node:fs';
import path from 'node:path';

const CANDIDATE_PREFIX = 'refs/heads/release/candidate-';
/** The wait of the candidate run: poll interval, the grace for a run to appear, the wait for it to end (an app's ci.yml jobs time out within 45 minutes). */
const CANDIDATE_WAIT = Object.freeze({ pollSeconds: 30, graceMinutes: 10, waitMinutes: 90 });
const FIELDS = 'databaseId,headSha,status,conclusion,url,event,createdAt';
const SHA = /^[a-f0-9]{40}$/u;
const PASSING = new Set(['success', 'neutral', 'skipped']);

/** The candidate ref of the release tag `tag` with the app's tag prefix: refs/heads/release/candidate-<version>. */
export const candidateRef = (tag, prefix = 'v') => `${CANDIDATE_PREFIX}${String(tag).startsWith(prefix) ? String(tag).slice(prefix.length) : String(tag)}`;

function run(ctx, command, args) {
  try { return ctx.spawn(command, args, { cwd: ctx.cwd }); } catch { return { status: null }; }
}

function jsonOf(result) {
  if (!result || result.error || result.status !== 0) return null;
  try { return JSON.parse(result.stdout); } catch { return null; }
}

/** pending (no run) | running | green | red over the runs of the sha; a cancelled run is no verdict. Pure. */
export function candidateVerdict(rows) {
  const runs = (rows ?? []).filter((row) => row && row.conclusion !== 'cancelled');
  runs.sort((a, b) => Date.parse(b.createdAt ?? 0) - Date.parse(a.createdAt ?? 0) || Number(b.databaseId) - Number(a.databaseId));
  const newest = runs[0];
  if (!newest) return { state: 'pending', run: null };
  if (newest.status !== 'completed') return { state: 'running', run: newest };
  return { state: newest.conclusion === 'success' ? 'green' : 'red', run: newest };
}

/** One read of the ci.yml runs of `sha`: {ok, state, run} or {ok: false}. */
function readCandidateRun(ctx, sha) {
  const rows = jsonOf(run(ctx, 'gh', ['run', 'list', '--workflow', 'ci.yml', '--commit', sha, '--limit', '20', '--json', FIELDS]));
  if (!Array.isArray(rows)) return { ok: false };
  return { ok: true, ...candidateVerdict(rows.filter((row) => !row.headSha || row.headSha === sha)) };
}

/** The failing jobs and steps of a run: ['job (conclusion): step, step']; [] when unreadable. */
export function failingJobs(ctx, runRow) {
  if (!/^\d+$/u.test(String(runRow?.databaseId ?? ''))) return [];
  const reply = jsonOf(run(ctx, 'gh', ['run', 'view', String(runRow.databaseId), '--json', 'jobs']));
  return (reply?.jobs ?? []).filter((job) => job.conclusion && !PASSING.has(job.conclusion)).map((job) => {
    const steps = (job.steps ?? []).filter((step) => step.conclusion && !PASSING.has(step.conclusion)).map((step) => step.name);
    return `${job.name} (${job.conclusion})${steps.length ? `: ${steps.join(', ')}` : ''}`;
  });
}

/** Only a complete starci/ci-override@1 record for this exact commit can excuse a red candidate. */
export function overrideOf(ctx, sha) {
  if (!SHA.test(String(sha))) return null;
  const common = run(ctx, 'git', ['rev-parse', '--git-common-dir']);
  if (common.error || common.status !== 0 || !String(common.stdout ?? '').trim()) return null;
  const file = path.join(path.resolve(ctx.cwd, String(common.stdout).trim()), 'starci-release', `${sha}.ci-override.json`);
  try {
    const record = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (record.schema !== 'starci/ci-override@1' || record.sha !== sha || typeof record.reason !== 'string' || !record.reason.trim() || typeof record.by !== 'string' || !record.by.trim() || typeof record.at !== 'string' || !Number.isFinite(Date.parse(record.at))) return null;
    return record;
  } catch { return null; }
}

/** Poll the candidate run of `sha` until green or red, or the grace (no run) or the wait passes: {state: green|red|timeout|unstarted|unknown, run}. */
export async function waitForCandidate(ctx, sha, wait = CANDIDATE_WAIT) {
  const started = ctx.now();
  let readable = null;
  for (;;) {
    const seen = readCandidateRun(ctx, sha);
    if (seen.ok) readable = seen;
    if (seen.ok && (seen.state === 'green' || seen.state === 'red')) return seen;
    const elapsed = ctx.now() - started;
    if (seen.ok && seen.state === 'pending' && elapsed >= wait.graceMinutes * 60_000) return { state: 'unstarted', run: null };
    if (elapsed >= wait.waitMinutes * 60_000) return readable ? { state: 'timeout', run: readable.run } : { state: 'unknown', run: null };
    await ctx.sleep(wait.pollSeconds * 1000);
  }
}

/**
 * The candidate step of the push: push HEAD to the candidate ref (through the pre-push hook), wait for its CI. {ok, lines, data: {ref, state, run, failing, override}}.
 * ok only on green, or on red under the owner's override record for this exact sha.
 */
export async function candidateStep(ctx, { head, tag, prefix, remote, wait = CANDIDATE_WAIT }) {
  const ref = candidateRef(tag, prefix);
  const lines = [];
  const pushed = run(ctx, 'git', ['push', remote, `+${head}:${ref}`]);
  if (pushed.status !== 0) return { ok: false, lines: [`candidate      push of ${head.slice(0, 10)} to ${ref} failed: ${String(pushed.stderr ?? '').trim().split('\n')[0]}`], data: { ref, state: 'push-failed' } };
  lines.push(`candidate      pushed ${head.slice(0, 10)} to ${remote} ${ref}; waiting for its ci.yml run`);
  const seen = await waitForCandidate(ctx, head, wait);
  const url = seen.run?.url ? ` ${seen.run.url}` : '';
  if (seen.state === 'green') return { ok: true, lines: [...lines, `candidate CI   green${url}`], data: { ref, state: 'green', run: seen.run } };
  if (seen.state === 'red') {
    const failing = failingJobs(ctx, seen.run);
    const record = overrideOf(ctx, head);
    const detail = failing.length ? failing.join('; ') : 'the failing jobs could not be read';
    if (record) return { ok: true, lines: [...lines, `candidate CI   RED${url}; failing: ${detail}`, `RELEASE_CANDIDATE_CI_RED overridden by the owner (${record.by}): ${record.reason}`], data: { ref, state: 'red', run: seen.run, failing, override: { by: record.by, reason: record.reason, at: record.at } } };
    return { ok: false, lines: [...lines, `RELEASE_CANDIDATE_CI_RED: the ci.yml run of ${head.slice(0, 10)} on ${ref} is red${url}; failing: ${detail}. Nothing reached the default branch; the candidate ref stays for diagnosis`], data: { ref, state: 'red', run: seen.run, failing } };
  }
  if (seen.state === 'unstarted') return { ok: false, lines: [...lines, `RELEASE_CANDIDATE_CI_TIMEOUT: no ci.yml run started for ${head.slice(0, 10)} on ${ref} within ${wait.graceMinutes} minutes (does .github/workflows/ci.yml trigger on release/candidate-*? run starci app sync)`], data: { ref, state: 'unstarted' } };
  if (seen.state === 'timeout') return { ok: false, lines: [...lines, `RELEASE_CANDIDATE_CI_TIMEOUT: the ci.yml run of ${head.slice(0, 10)} did not end within ${wait.waitMinutes} minutes${url}`], data: { ref, state: 'timeout', run: seen.run } };
  return { ok: false, lines: [...lines, `RELEASE_CI_UNKNOWN: GitHub could not be read for the candidate ${head.slice(0, 10)} on ${ref}; a release never proceeds blind`], data: { ref, state: 'unknown' } };
}
