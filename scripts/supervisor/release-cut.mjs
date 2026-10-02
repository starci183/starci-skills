// release-cut.mjs - the release flow, and the ONLY push of main (docs/git-governance.md). Lands only fast-forward LOCAL main; the remote moves once per release,
// main and its tag together:
//   1. the checkout is on `main` with no tracked change (nothing is stashed, reset or cleaned);
//   2. the release tag `v<version>` is named, is not on the remote yet, and is either absent or an annotated tag already on HEAD; any other tag is refused;
//   3. RELEASE_NOTES holds: the tag's CHANGELOG section exists and has no TODO, PENDING or TBD left (scripts/hfs/runtime-rules/release-notes.mjs);
//   4. the L4 row runs once (scripts/supervisor/release-l4.mjs: every spec, lint, checks, tsc, images and the Sonar proof), each step to a log recorded in the result;
//      every skipped test is reported with its reason, and a skip from missing infrastructure (or any skip but the declared browser ones) fails L4;
//   5. main did not move meanwhile; the pushed range passes the secret scan;
//   6. the ANNOTATED tag is created on HEAD with the CHANGELOG section as its message, and main and the tag are pushed together, atomically: both refs move or neither does.
// Exported function only: the CLI exposes it as `starci release cut`. Git goes through the scripts/api/git call files the CLI's git verbs use. Never stashes, resets, deletes or moves a tag, never pushes anything but main and that tag.
// The heavy part (the suite and the push) runs under the host lock (scripts/machine/host-lock.mjs, role release): a held lock refuses the cut and names its owner.
// After the tag is made and before the push, the L4 record of HEAD is written (scripts/guards/release-record.mjs): the pre-push hook of the runtime and of every app
// lets main and a v* tag through only when that record exists for HEAD and names the tag. Seams (deps): git, suite, push, scan, changelog, lock, recordL4.
import fs from 'node:fs';
import path from 'node:path';
import { catFile } from '../api/git/cat-file.mjs';
import { lsRemote } from '../api/git/ls-remote.mjs';
import { push } from '../api/git/push.mjs';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { statusQuery } from '../api/git/status-query.mjs';
import { symbolicRefQuery } from '../api/git/symbolic-ref-query.mjs';
import { tag as gitTag } from '../api/git/tag.mjs';
import { changelogSection, releaseNotesFindings } from '../hfs/runtime-rules/release-notes.mjs';
import { runL4, skipReport } from './release-l4.mjs';
import { scanRange } from './push-mains.mjs';
import { withHostLock as holdHostLock } from '../machine/host-lock.mjs';
import { writeL4Record } from '../guards/release-record.mjs';

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
const heldWhy = (o) => `the host lock is held by ${o.role ?? 'another heavy run'}${o.purpose ? ` (${o.purpose})` : ''}${o.pid ? ` pid ${o.pid}` : ''}: wait for it, never delete the lock by hand`;

/** The default L4 runner (scripts/supervisor/release-l4.mjs): every step of the L4 row once, each to a log: [{name, ok, log, ms, skips, absent?}]. */
const defaultSuite = (repo, deps = {}) => runL4(repo, { proofs: deps.proofs ?? {} });

/**
 * Cut the release `tag` (v<version>) of `repo`: see the header. {ok, verdict, why, tag, head, suite, skips, declaredSkips, pushed, tagCreated}.
 * The tag is required, must be `v*`, and is created here, ANNOTATED, with the CHANGELOG section as its message (an existing annotated tag on HEAD is reused).
 */
export function cutRelease({ repo, remote = 'origin', branch = 'main', tag = null, deps = {} } = {}) {
  const run = deps.git ?? git;
  const out = { ok: false, repo: path.basename(repo), verdict: null, why: null, tag, head: null, suite: [], pushed: false, tagCreated: false };
  const refuse = (verdict, why, extra = {}) => ({ ...out, ...extra, verdict, why });
  const cwd = repo;

  if (!tag) return refuse('no-release-tag', 'name the release tag: v<version>');
  if (!RELEASE_TAG.test(tag)) return refuse('bad-tag', `${tag} is not a release tag: only v<version> tags are created and pushed`);
  const onBranch = run(['symbolic-ref', '--short', 'HEAD'], { cwd }).stdout;
  if (onBranch !== branch) return refuse('not-on-main', `the checkout is on ${onBranch || 'a detached HEAD'}, not ${branch}`);
  const dirty = run(['status', '--porcelain', '--untracked-files=no'], { cwd }).stdout.split(/\r?\n/).filter(Boolean);
  if (dirty.length) return refuse('dirty', `the tree has ${dirty.length} tracked change(s): commit them first (nothing is stashed or reset)`, { dirty: dirty.slice(0, 20) });
  const head = run(['rev-parse', 'HEAD'], { cwd }).stdout;
  out.head = head;

  const local = run(['tag', '--list', tag], { cwd }).stdout.trim() === tag;
  if (local) {
    if (run(['rev-parse', `refs/tags/${tag}^{commit}`], { cwd }).stdout !== head) return refuse('tag-elsewhere', `${tag} already exists on another commit: a tag is never moved; cut the next version`);
    if (run(['cat-file', '-t', `refs/tags/${tag}`], { cwd }).stdout !== 'tag') return refuse('tag-not-annotated', `${tag} is a lightweight tag: a release tag is annotated, its message is the release notes`);
  }
  const remoteHas = run(['ls-remote', '--tags', remote, `refs/tags/${tag}`], { cwd });
  if (!remoteHas.ok) return refuse('remote-unreachable', `could not read the tags of ${remote}: ${remoteHas.stderr.slice(0, 200)}`);
  if (remoteHas.stdout) return refuse('tag-exists-on-remote', `${tag} already exists on ${remote}: a tag is never moved or re-pushed; cut the next version`);

  const changelog = (deps.changelog ?? (() => fs.readFileSync(path.join(repo, 'CHANGELOG.md'), 'utf8')))();
  const notes = releaseNotesFindings({ tags: [tag], changelog });
  if (notes.length) return refuse('release-notes', notes.map((f) => f.message).join('; '), { findings: notes });

  const lock = deps.lock ?? withHostLock;
  const ran = lock(() => (deps.suite ?? defaultSuite)(repo, deps));
  if (heldBy(ran)) return refuse('host-lock-held', heldWhy(heldBy(ran)));
  const steps = ran;
  out.suite = steps;
  const red = steps.filter((s) => !s.ok);
  if (red.length) return refuse('suite-red', `${red.map((s) => `${s.name}${s.absent ? ' (absent)' : ''}`).join(', ')} red: fix, land, and cut again (logs: ${red.map((s) => s.log).filter(Boolean).join(', ')})`);
  if (!steps.length) return refuse('suite-red', 'the full suite did not run');
  // L4 reports every skipped test with its reason: a skip caused by missing infrastructure, or any skip but the declared browser-conditional ones, fails it.
  const skips = skipReport(steps);
  out.skips = skips.skips;
  out.declaredSkips = skips.declared;
  if (skips.failures.length) return refuse('suite-skips', `${skips.failures.length} skipped test(s) fail L4: ${skips.failures.slice(0, 8).map((k) => `${k.name} [${k.class}: ${k.reason || 'no reason'}]`).join('; ')}`);

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
  const recorded = (deps.recordL4 ?? writeL4Record)({ repo, head, tag, logs: steps.filter((s) => !s.absent) });
  if (!recorded.ok) return refuse('l4-record', `the L4 record of ${head.slice(0, 9)} could not be written (${recorded.reason}): the pre-push gate would refuse the push`);
  out.l4Record = recorded.file ?? null;
  const pushed = lock(() => (deps.push ?? push)(['--atomic', remote, ...refs], { cwd, timeout: 600_000 }));
  if (heldBy(pushed)) return refuse('host-lock-held', heldWhy(heldBy(pushed)));
  if (pushed.status !== 0) return refuse('push-refused', `the atomic push of ${refs.join(' and ')} to ${remote} failed (the local tag stays, nothing moved on the remote): ${String(pushed.stderr ?? '').trim().slice(0, 300)}`);
  return { ...out, ok: true, verdict: 'pushed', why: `${branch} and ${tag} pushed to ${remote} in one atomic push`, pushed: true };
}
