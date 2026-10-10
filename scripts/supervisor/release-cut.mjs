// release-cut.mjs - the release flow, and the ONLY push of main (docs/git-governance.md). Lands only fast-forward LOCAL main; the remote moves once per release,
// main and its tag together:
//   1. the checkout is on `main` with no tracked change (nothing is stashed, reset or cleaned);
//   2. the release tag `v<version>` is named, is not on the remote yet, and is either absent or an annotated tag already on HEAD; any other tag is refused;
//   3. RELEASE_NOTES holds: the tag's CHANGELOG section exists and has no unfinished entries (scripts/hfs/runtime-rules/release-notes.mjs), and the rest of the release
//      definition that can hold before the suite ran (scripts/guards/release-definition.mjs: the version moved past the remote main's, a dated heading); `--plan` stops here and reports what the cut would run;
//      the release host provides what L4 needs (scripts/supervisor/release-host.mjs: an Orca terminal, a reachable Orca, a Docker daemon), else the cut refuses `release-host` at once;
//   4. the L4 row runs once (scripts/supervisor/release-l4.mjs: the example installs, every spec, lint, checks, tsc, images, the Sonar proof and the Linux parity step), as a schedule whose rows run together where they are independent,
//      each step to a log recorded in the result; a row green for this very commit, or green with an identical input set on an earlier commit (scripts/supervisor/release-reuse.mjs; never the rows the pre-push gate requires), is not run again:
//      `--rows` re-runs named rows alone on the same commit, `--no-reuse` runs every row;
//      every skipped test is reported with its reason, and a skip from missing infrastructure (or any skip but the declared browser ones) fails L4;
//   5. main did not move meanwhile; the pushed range passes the secret scan;
//   6. the ANNOTATED tag is created on HEAD with the CHANGELOG section as its message, and main and the tag are pushed together, atomically: both refs move or neither does.
// The push lock: a remote whose pushurl reads `DISABLED...` (the owner's lock while lands stay local) is pushed through its fetch url for this one push, without writing the config (pushLiftTarget).
// Exported function only: the CLI exposes it as `starci release cut`. Git goes through the scripts/api/git call files the CLI's git verbs use. Never stashes, resets, deletes or moves a tag, never pushes anything but main and that tag.
// The heavy part (the suite and the push) runs under the host lock (scripts/machine/host-lock.mjs, role release): a held lock refuses the cut and names its owner.
// After the tag is made and before the push, the L4 record of HEAD is written (scripts/guards/release-record.mjs): the pre-push hook of the runtime and of every app
// lets main and a v* tag through only when that record exists for HEAD and names the tag. Seams (deps): git, suite, push, scan, changelog, lock, recordL4; for the default
// suite also proofs, supplier, parity, parityDeps (the L4 row brings its own Sonar proofs and Linux parity step: scripts/supervisor/release-l4.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { catFile } from '../api/git/cat-file.mjs';
import { configGet } from '../api/git/config-get.mjs';
import { lsRemote } from '../api/git/ls-remote.mjs';
import { push } from '../api/git/push.mjs';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { statusQuery } from '../api/git/status-query.mjs';
import { symbolicRefQuery } from '../api/git/symbolic-ref-query.mjs';
import { tag as gitTag } from '../api/git/tag.mjs';
import { updateRef } from '../api/git/update-ref.mjs';
import { changelogSection, releaseNotesFindings } from '../hfs/runtime-rules/release-notes.mjs';
import { runL4, skipReport } from './release-l4.mjs';
import { combine, decisionLines, needsSonar, refusalFor, remember, selectionFor } from './release-cut-rows.mjs';
import { scanRange } from './push-mains.mjs';
import { planOf, preSuiteRefusal } from './release-cut-plan.mjs';
import { releaseHostMissing, releaseHostWhy } from './release-host.mjs';
import { withHostLock as holdHostLock } from '../machine/host-lock.mjs';
import { writeL4Record } from '../guards/release-record.mjs';
import { suiteModeOf } from '../guards/release-suite-mode.mjs';
import { writeCiRecord } from './release-ci-status.mjs';

/** A release tag: `v` and a version. Anything else is never pushed by the release flow. */
const RELEASE_TAG = /^v\d[\w.+-]*$/;
const GIT_CALLS = { 'symbolic-ref': symbolicRefQuery, status: statusQuery, 'rev-parse': revParseQuery, tag: gitTag, 'cat-file': catFile, 'ls-remote': lsRemote };

/** Run one git verb of the release flow in `cwd`: {ok, stdout, stderr}. */
function git([verb, ...args], { cwd }) {
  const call = GIT_CALLS[verb];
  if (!call) throw new Error(`git ${verb}: not a call of the release flow`);
  const r = call(args, { cwd, timeout: 120_000 });
  return { ok: r.status === 0, stdout: String(r.stdout ?? '').trim(), stderr: String(r.stderr ?? '').trim() };
}

/**
 * Where the release push goes: a remote whose `pushurl` the owner parked as `DISABLED...` (a push lock while lands stay local; docs/git-governance.md) is pushed through its fetch url for this one
 * push (a pushurl is multi-valued, so a per-command override would still try the parked one), the config is never written, and the remote-tracking ref is moved by hand afterwards.
 * Any other pushurl (an ssh url for an https remote, say) is the owner's choice and is left alone. Pure over the values: the url to push to, or null when the named remote is pushed.
 */
function pushLiftTarget({ pushUrl, fetchUrl }) {
  return /^DISABLED/i.test(String(pushUrl ?? '').trim()) && String(fetchUrl ?? '').trim() ? String(fetchUrl).trim() : null;
}

/** The refs a release push may carry: main and one release tag. Pure: the refusal reason, or null. */
export function pushRefusal({ refs, branch = 'main' }) {
  const odd = refs.filter((ref) => ref !== branch && !RELEASE_TAG.test(String(ref).replace(/^refs\/tags\//, '')));
  if (odd.length) return `only ${branch} and a release tag v* may be pushed, not ${odd.join(', ')}`;
  if (!refs.includes(branch)) return `a release pushes ${branch} with its tag`;
  if (refs.filter((ref) => ref !== branch).length !== 1) return 'a release pushes exactly one tag with main';
  return null;
}

/** Run `work` while holding the host's one heavy-run lock (one heavy run at a time, role release); a held lock returns {ok: false, reason: 'held', owner} instead of the work's result. */
const withHostLock = (work) => holdHostLock({ role: 'release', purpose: 'release-cut' }, work);
const heldBy = (r) => (r && !Array.isArray(r) && r.ok === false && r.reason === 'held' ? r.owner ?? {} : null);
const heldWhy = (o) => {
  const purpose = o.purpose ? ` (${o.purpose})` : '';
  const pid = o.pid ? ` pid ${o.pid}` : '';
  return `the host lock is held by ${o.role ?? 'another heavy run'}${purpose}${pid}: wait for it, never delete the lock by hand`;
};

/** The default L4 runner (scripts/supervisor/release-l4.mjs): every step of the L4 row once, each to a log: [{name, ok, log, ms, skips, absent?}]. The Sonar proofs come from the existing gate (release-l4-sonar.mjs), the Linux step from release-linux-parity.mjs. */
const defaultSuite = (repo, deps = {}) => runL4(repo, {
  plan: deps.selection?.plan, proofs: deps.proofs, supplier: deps.supplier,
  ...(deps.parity !== undefined ? { parity: deps.parity } : {}), parityDeps: deps.parityDeps ?? {}, carry: deps.carry ?? {},
});

function releaseTagState({ tag, branch, remote, cwd, run, out, refuse }) {
  if (!tag) return { refusal: refuse('no-release-tag', 'name the release tag: v<version>') };
  if (!RELEASE_TAG.test(tag)) return { refusal: refuse('bad-tag', `${tag} is not a release tag: only v<version> tags are created and pushed`) };
  const onBranch = run(['symbolic-ref', '--short', 'HEAD'], { cwd }).stdout;
  if (onBranch !== branch) return { refusal: refuse('not-on-main', `the checkout is on ${onBranch || 'a detached HEAD'}, not ${branch}`) };
  const dirty = run(['status', '--porcelain', '--untracked-files=no'], { cwd }).stdout.split(/\r?\n/).filter(Boolean);
  if (dirty.length) return { refusal: refuse('dirty', `the tree has ${dirty.length} tracked change(s): commit them first (nothing is stashed or reset)`, { dirty: dirty.slice(0, 20) }) };
  const head = run(['rev-parse', 'HEAD'], { cwd }).stdout;
  out.head = head;
  const local = run(['tag', '--list', tag], { cwd }).stdout.trim() === tag;
  if (local) {
    if (run(['rev-parse', `refs/tags/${tag}^{commit}`], { cwd }).stdout !== head) return { refusal: refuse('tag-elsewhere', `${tag} already exists on another commit: a tag is never moved; cut the next version`) };
    if (run(['cat-file', '-t', `refs/tags/${tag}`], { cwd }).stdout !== 'tag') return { refusal: refuse('tag-not-annotated', `${tag} is a lightweight tag: a release tag is annotated, its message is the release notes`) };
  }
  const remoteHas = run(['ls-remote', '--tags', remote, `refs/tags/${tag}`], { cwd });
  if (!remoteHas.ok) return { refusal: refuse('remote-unreachable', `could not read the tags of ${remote}: ${remoteHas.stderr.slice(0, 200)}`) };
  if (remoteHas.stdout) return { refusal: refuse('tag-exists-on-remote', `${tag} already exists on ${remote}: a tag is never moved or re-pushed; cut the next version`) };
  return { head, local };
}

/**
 * What is already known to stop the cut before the suite runs, as a refusal or null: the release definition (scripts/guards/release-definition.mjs) is what the pre-push hook enforces, and what the
 * L4 row needs from this host (an Orca terminal, a reachable Orca, a Docker daemon) decides whether the row can pass at all: a cut that would fail an hour in refuses in seconds.
 */
async function beforeSuiteRefusal({ repo, run, cwd, head, remote, branch, tag, deps, refuse, sonar }) {
  const unmet = await preSuiteRefusal({ repo, run, cwd, head, remote, branch, tag, deps, sonar });
  if (unmet) return refuse(unmet.verdict, unmet.why, { findings: unmet.findings });
  const hostMissing = (deps.host ?? releaseHostMissing)({ repo, root: cwd });
  return hostMissing.length ? refuse('release-host', releaseHostWhy(hostMissing), { hostMissing }) : null;
}

/** The refusal of a `--rows` the plan or the ledger of this commit cannot serve, or null. */
function rowsRefusal(selection, rows, refuse) {
  const unservable = refusalFor(selection, rows);
  return unservable ? refuse(unservable.verdict, unservable.why) : null;
}

async function releaseSuite({ repo, deps, out, refuse, lock, selection, tag }) {
  const ran = await lock(() => (deps.suite ?? defaultSuite)(repo, { ...deps, carry: selection.carry, selection }));
  if (heldBy(ran)) return { refusal: refuse('host-lock-held', heldWhy(heldBy(ran))) };
  const steps = combine(selection, ran);
  out.suite = steps;
  out.reused = steps.filter((s) => s.reusedFrom).map((s) => ({ name: s.name, from: s.reusedFrom }));
  out.rows = decisionLines(selection);
  remember({ repo, head: out.head, tag, rows: steps, selection, deps });
  const red = steps.filter((s) => !s.ok);
  if (red.length) {
    const names = red.map((s) => `${s.name}${s.absent ? ' (absent)' : ''}`).join(', ');
    const logs = red.map((s) => s.log).filter(Boolean).join(', ');
    return { refusal: refuse('suite-red', `${names} red: fix, land, and cut again (logs: ${logs})`) };
  }
  if (!steps.length) return { refusal: refuse('suite-red', 'the full suite did not run') };
  const skips = skipReport(steps);
  out.skips = skips.skips;
  out.declaredSkips = skips.declared;
  out.coveredSkips = skips.covered;
  const unmatched = steps.flatMap((s) => s.unmatched ?? []);
  if (skips.failures.length) {
    const skipped = skips.failures.slice(0, 8).map((k) => `${k.name} [${k.class}: ${k.reason || 'no reason'}]`).join('; ');
    const missingTitles = unmatched.length ? `; no spec file holds the literal title of: ${unmatched.slice(0, 6).join(' | ')} (the Linux leg could not run it)` : '';
    return { refusal: refuse('suite-skips', `${skips.failures.length} skipped test(s) executed in no leg and fail L4: ${skipped}${missingTitles}`) };
  }
  return { steps };
}

/** The result of a release that moved: leaves the pending CI record of the commit and names the command that reads CI's verdict (the suite itself under `suite: ci`). */
function pushedResult({ out, repo, head, tag, branch, remote, mode, deps }) {
  (deps.writeCi ?? writeCiRecord)({ repo, head, tag, suite: mode, state: 'pending' });
  const watch = `starci release ci-status --tag ${tag} --wait`;
  const judged = mode === 'ci' ? `; the full suite now runs only on GitHub (suite: ci) - watch it: ${watch}` : `; CI runs next - ${watch}`;
  return { ...out, ok: true, verdict: 'pushed', why: `${branch} and ${tag} pushed to ${remote} in one atomic push${judged}`, pushed: true, ciWatch: watch };
}

/**
 * Cut the release `tag` (v<version>) of `repo`: see the header. Async (the L4 Sonar gate is): a Promise of {ok, verdict, why, tag, head, suite, skips, declaredSkips, pushed, tagCreated}.
 * The tag is required, must be `v*`, and is created here, ANNOTATED, with the CHANGELOG section as its message (an existing annotated tag on HEAD is reused).
 */
export async function cutRelease({ repo, remote = 'origin', branch = 'main', tag = null, plan = false, rows, reuse, deps = {} } = {}) {
  const run = deps.git ?? git;
  const out = { ok: false, repo: path.basename(repo), verdict: null, why: null, tag, head: null, suite: [], pushed: false, tagCreated: false };
  const refuse = (verdict, why, extra = {}) => ({ ...out, ...extra, verdict, why });
  const cwd = repo;

  const tagState = releaseTagState({ tag, branch, remote, cwd, run, out, refuse });
  if (tagState.refusal) return tagState.refusal;
  const { head, local } = tagState;

  const changelog = (deps.changelog ?? (() => fs.readFileSync(path.join(repo, 'CHANGELOG.md'), 'utf8')))();
  const notes = releaseNotesFindings({ tags: [tag], changelog });
  if (notes.length) return refuse('release-notes', notes.map((f) => f.message).join('; '), { findings: notes });

  const mode = (deps.suiteMode ?? suiteModeOf)(repo);
  out.suiteMode = mode;
  const selection = selectionFor({ repo, head, rows, reuse, mode, deps });
  const stop = rowsRefusal(selection, rows, refuse) ?? await beforeSuiteRefusal({ repo, run, cwd, head, remote, branch, tag, deps, refuse, sonar: needsSonar(selection) });
  if (stop) return stop;
  if (plan) return planOf({ head, tag, remote, branch, out, selection });

  // L4 reports every skipped test with its reason, and every test must have passed in at least one leg (the host run or the Linux container run): a skip that passed in the other leg is covered and listed with where it passed;
  // a skip nothing covered (missing infrastructure, a platform no leg has, any undeclared skip) fails L4.
  const lock = deps.lock ?? withHostLock;
  const suiteResult = await releaseSuite({ repo, deps, out, refuse, lock, selection, tag });
  if (suiteResult.refusal) return suiteResult.refusal;
  const { steps } = suiteResult;

  if (run(['rev-parse', 'HEAD'], { cwd }).stdout !== head || run(['status', '--porcelain', '--untracked-files=no'], { cwd }).stdout) return refuse('main-moved', 'the checkout changed while the suite ran: start over');
  const scan = (deps.scan ?? scanRange)({ cwd, from: `${remote}/${branch}`, to: branch });
  if (!scan.ok) return refuse('secret-scan', scan.error ?? `${scan.findings.length} finding(s) in the pushed range`, { findings: scan.findings });

  if (!local) {
    const made = run(['tag', '-a', tag, '--cleanup=verbatim', '-m', changelogSection(changelog, tag.slice(1)).body], { cwd });
    if (!made.ok) return refuse('tag-failed', `could not create the annotated tag ${tag}: ${made.stderr.slice(0, 200)}`);
    out.tagCreated = true;
  }
  const refs = [branch, `refs/tags/${tag}`];
  const refusal = pushRefusal({ refs });
  if (refusal) return refuse('push-refused', refusal);
  const recorded = (deps.recordL4 ?? writeL4Record)({ repo, head, tag, logs: steps.filter((s) => !s.absent), suite: mode, delegated: selection.plan.delegated });
  if (!recorded.ok) return refuse('l4-record', `the L4 record of ${head.slice(0, 9)} could not be written (${recorded.reason}): the pre-push gate would refuse the push`);
  out.l4Record = recorded.file ?? null;
  const lifted = pushLiftTarget({ pushUrl: configGet(cwd, `remote.${remote}.pushurl`).stdout, fetchUrl: configGet(cwd, `remote.${remote}.url`).stdout });
  const pushed = await lock(() => (deps.push ?? push)(['--atomic', lifted ?? remote, ...refs], { cwd, timeout: 600_000 }));
  if (heldBy(pushed)) return refuse('host-lock-held', heldWhy(heldBy(pushed)));
  if (pushed.status !== 0) return refuse('push-refused', `the atomic push of ${refs.join(' and ')} to ${remote} failed (the local tag stays, nothing moved on the remote): ${String(pushed.stderr ?? '').trim().slice(0, 300)}`);
  if (lifted) updateRef(cwd, `refs/remotes/${remote}/${branch}`, head, { message: `release push of ${tag}` });
  return pushedResult({ out, repo, head, tag, branch, remote, mode, deps });
}
