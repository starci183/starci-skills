// release-ci-status.mjs - what the GitHub workflow said about a release, the verdict a `suite: ci` release (release-ci-rows.mjs) depends on:
//   ciReader      the one reader of GitHub (scripts/api/gh/**): the runs of the `ci` workflow for a sha and the Codecov / Sonar checks and statuses of that sha, as {ok, runs, checks, error}
//   verdictOf     pending (no run yet) | running | green | red, over the runs and the matched checks; pure
//   ciStatus      `starci release ci-status [--tag v...] [--wait]`: read the verdict of a release commit, leave it in <git common dir>/starci-release/<sha>.ci.json (the digest and the reconciler
//                 preflight read the newest one), and when it is RED for a release cut under `suite: ci` record it once as the runtime defect `runtime-defect:release-ci-red-<tag>` for Debug
// A seam `deps.read` stands in for GitHub in specs; `deps.recordDefect` for the machine store write; `deps.sleep` and `deps.now` for the wait.
import fs from 'node:fs';
import path from 'node:path';
import { workflowRuns } from '../api/gh/workflow-runs.mjs';
import { commitChecks } from '../api/gh/commit-checks.mjs';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { tag as gitTag } from '../api/git/tag.mjs';
import { runNode } from '../api/node/run-node.mjs';
import { gitCommonDir, readL4Record } from '../guards/release-record.mjs';
import { sleep } from '../lib/sleep.mjs';
import { RELEASE_DEFAULTS } from '../../engine/release-config.mjs';
import { ciPolicy } from './release-ci-rows.mjs';

const CI_SCHEMA = 'starci/release-ci@1';
const RED_RUN = new Set(['failure', 'timed_out', 'startup_failure', 'action_required']);
const RED_CHECK = new Set(['failure', 'error', 'timed_out', 'action_required']);

const json = (r) => { try { return r.status === 0 ? JSON.parse(r.stdout) : null; } catch { return null; } };
/** Why a gh call gave nothing: gh itself missing, or its exit status and the first words of stderr. */
function failure(what, r) {
  const stderr = String(r.stderr ?? '').trim().slice(0, 200);
  const reason = r.error ? r.error.message : stderr || `exit ${r.status}`;
  return { ok: false, runs: [], checks: [], error: `${what}: ${reason}` };
}

/** The state of a check run or a status context in one vocabulary: success | failure | pending. */
const PASSING = new Set(['success', 'neutral', 'skipped']);
function checkState(state, conclusion) {
  if (conclusion !== undefined) {
    if (state !== 'completed') return 'pending';
    return PASSING.has(conclusion) ? 'success' : 'failure';
  }
  if (state === 'success' || state === 'pending') return state;
  return 'failure';
}

/** What GitHub says about `sha`: {ok, runs: [{id, status, conclusion, event, url}], checks: [{name, state}], error?}. Reads through scripts/api/gh; `cwd` is the repository whose remote is asked. */
export function ciReader({ cwd, workflow, sha, deps = {} }) {
  const options = { cwd, ...(deps.gh ? { gh: deps.gh } : {}) };
  const runsReply = (deps.workflowRuns ?? workflowRuns)({ workflow, sha }, options);
  const runs = json(runsReply);
  if (!Array.isArray(runs)) return failure('gh run list', runsReply);
  const checkReply = json((deps.commitChecks ?? commitChecks)({ sha, part: 'check-runs' }, options));
  const statusReply = json((deps.commitChecks ?? commitChecks)({ sha, part: 'status' }, options));
  const checks = [
    ...(checkReply?.check_runs ?? []).map((c) => ({ name: c.name, state: checkState(c.status, c.conclusion ?? null) })),
    ...(statusReply?.statuses ?? []).map((s) => ({ name: s.context, state: checkState(s.state) })),
  ];
  return { ok: true, runs: runs.map((r) => ({ id: r.databaseId, status: r.status, conclusion: r.conclusion || null, event: r.event, url: r.url })), checks };
}

/** pending | running | green | red over the runs of the workflow and the checks whose name matches one of `patterns`. A cancelled run (a newer push replaced it) is not a verdict. */
export function verdictOf({ runs, checks, patterns }) {
  const watched = checks.filter((c) => patterns.some((p) => c.name.toLowerCase().includes(p)));
  const verdictful = runs.filter((r) => r.conclusion !== 'cancelled');
  if (verdictful.some((r) => RED_RUN.has(r.conclusion)) || watched.some((c) => c.state === 'failure')) return 'red';
  if (!verdictful.length) return 'pending';
  if (verdictful.some((r) => r.status !== 'completed') || watched.some((c) => c.state === 'pending')) return 'running';
  return 'green';
}

const recordFile = (dir, head) => path.join(dir, 'starci-release', `${head}.ci.json`);

/** Leave the CI state of a release commit: {ok, file} or {ok: false, reason}. Never throws. */
export function writeCiRecord({ repo, head, tag, suite, state, runs = [], checks = [], defect = null, commonDir = null, now = () => new Date() }) {
  const dir = commonDir ?? gitCommonDir(repo);
  if (!dir) return { ok: false, reason: 'the repository has no git common dir' };
  try {
    const file = recordFile(dir, head);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify({ schema: CI_SCHEMA, head, tag, suite, state, runs, checks, defect, at: now().toISOString() })}\n`);
    return { ok: true, file };
  } catch (error) { return { ok: false, reason: error.message }; }
}

/** The CI record of `head`, or null. */
export function readCiRecord({ repo, head, commonDir = null }) {
  const dir = commonDir ?? gitCommonDir(repo);
  try { const record = JSON.parse(fs.readFileSync(recordFile(dir, head), 'utf8')); return record?.schema === CI_SCHEMA && record.head === head ? record : null; } catch { return null; }
}

/** One CI record file, or null when it is unreadable or another schema. */
function readCiFile(file) {
  try { const record = JSON.parse(fs.readFileSync(file, 'utf8')); return record?.schema === CI_SCHEMA ? record : null; } catch { return null; }
}

/** The newest CI record of the repository (the last release's CI verdict), or null. */
export function latestCiRecord({ repo, commonDir = null }) {
  const dir = commonDir ?? gitCommonDir(repo);
  if (!dir) return null;
  const folder = path.join(dir, 'starci-release');
  const names = fs.existsSync(folder) ? fs.readdirSync(folder).filter((name) => name.endsWith('.ci.json')) : [];
  const newest = names.map((name) => readCiFile(path.join(folder, name))).filter(Boolean).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return newest[0] ?? null;
}

/** The one line of the last release CI: `tag green|red|running|pending (suite ci)`, or null when no release was cut here. */
export function ciLine(record) {
  if (!record) return null;
  const url = record.state === 'red' && record.runs?.[0]?.url ? `, ${record.runs[0].url}` : '';
  return `${record.tag} ${record.state} (suite: ${record.suite})${url}`;
}

/** Record a red CI as a runtime defect of the machine store through the supervisor verb (the defect queue Debug owns); {ok, item}. The default spawns the CLI; specs inject `recordDefect`. */
function recordRedCi({ repo, tag, head, url, deps = {} }) {
  const item = `runtime-defect:release-ci-red-${tag}`;
  const reason = `the ci workflow is red for the release ${tag} (${head.slice(0, 9)}) cut under suite: ci: the full suite ran only there; fix forward with the next pre-release`;
  const refs = [url, `release:${tag}`].filter(Boolean).join(',');
  if (deps.recordDefect) return { ...deps.recordDefect({ item, reason, refs }), item };
  const cli = path.join(repo, 'packages', 'cli', 'bin', 'starci.mjs');
  const r = runNode([cli, 'supervisor', 'actions', 'record', '--item', item, '--action', 'recorded', '--reason', reason, '--refs', refs], { cwd: repo, env: { ...process.env, STARCI_RUNTIME: repo } });
  return { ok: r.status === 0, item, ...(r.status === 0 ? {} : { error: String(r.stderr ?? '').slice(0, 200) }) };
}

const text = (r) => String(r.stdout ?? '').trim();

/** The release commit of `tag` (default: the newest release tag merged in HEAD): {tag, head} or null. */
function releaseOf({ repo, tag }) {
  const named = tag ?? text(gitTag(['--merged', 'HEAD', '--list', 'v*', '--sort=-creatordate'], { cwd: repo })).split(/\r?\n/).find(Boolean);
  const head = named ? text(revParseQuery([`refs/tags/${named}^{commit}`], { cwd: repo })) : '';
  return head ? { tag: named, head } : null;
}

/** Read until the run ends or the deadline `give` passes. */
async function waitFor({ read, policy, deps, give }) {
  const seen = read();
  if (!seen.ok || !['pending', 'running'].includes(seen.verdict) || (deps.now ?? Date.now)() >= give) return seen;
  await (deps.sleep ?? sleep)(policy.pollSeconds * 1000);
  return waitFor({ read, policy, deps, give });
}

/**
 * `starci release ci-status`: {ok, code, verdict, tag, head, runs, checks, why, watch?, defect?}. code: 0 green, 1 red, 3 not finished or not readable. `wait` polls until the run ends or `waitMinutes` pass.
 * A red verdict of a `suite: ci` release is recorded once as a runtime defect (machine store, for Debug); a read that fails is not a verdict and is reported as such.
 */
export async function ciStatus({ repo, tag = null, wait = false, deps = {} }) {
  const policy = ciPolicy();
  const release = releaseOf({ repo, tag });
  if (!release) return { ok: false, code: 3, verdict: 'unknown', why: 'no release tag to read the CI of (--tag v<version>)' };
  const read = () => {
    const seen = (deps.read ?? ciReader)({ cwd: repo, workflow: policy.workflow, sha: release.head, deps: deps.gh ?? {} });
    return { ...seen, verdict: seen.ok ? verdictOf({ runs: seen.runs, checks: seen.checks, patterns: policy.statusPatterns }) : 'unknown' };
  };
  const seen = wait ? await waitFor({ read, policy, deps, give: (deps.now ?? Date.now)() + policy.waitMinutes * 60_000 }) : read();
  if (!seen.ok) return { ok: false, code: 3, verdict: 'unknown', ...release, why: `GitHub could not be read (${seen.error}): this is not a verdict` };
  const suite = readL4Record({ repo, head: release.head })?.suite ?? RELEASE_DEFAULTS.suite;
  const before = readCiRecord({ repo, head: release.head });
  let defect = before?.defect ?? null;
  if (seen.verdict === 'red' && suite === 'ci' && !defect) defect = recordRedCi({ repo, ...release, url: seen.runs.find((r) => RED_RUN.has(r.conclusion))?.url, deps }).item;
  writeCiRecord({ repo, ...release, suite, state: seen.verdict, runs: seen.runs, checks: seen.checks, defect, ...(deps.now ? { now: () => new Date(deps.now()) } : {}) });
  const code = { green: 0, red: 1 }[seen.verdict] ?? 3;
  const recordedAs = defect ? `; recorded as ${defect}` : '';
  return { ok: code === 0, code, verdict: seen.verdict, ...release, suite, runs: seen.runs, checks: seen.checks, ...(defect ? { defect } : {}),
    why: `the ${policy.workflow} workflow for ${release.tag} (${release.head.slice(0, 9)}) is ${seen.verdict}${recordedAs}` };
}
