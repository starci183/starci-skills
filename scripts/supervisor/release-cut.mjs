// release-cut.mjs - the release flow, and the ONLY push of main (docs/git-governance.md). Lands only fast-forward LOCAL main; the remote moves once per release,
// main and its tag together:
//   1. the checkout is on `main` with no tracked change (nothing is stashed, reset or cleaned);
//   2. HEAD carries exactly ONE new release tag `v*` (not on the remote yet), ANNOTATED (its message is the CHANGELOG section); any other tag is refused;
//   3. RELEASE_NOTES holds: the tag's CHANGELOG section exists and has no TODO, PENDING or TBD left (scripts/hfs/runtime-rules/release-notes.mjs);
//   4. the FULL suite runs once (npm test) and `npm run check`, each step to a log file that is recorded in the result;
//   5. main did not move meanwhile; the pushed range passes the secret scan;
//   6. `git push --atomic <remote> main <tag>`: both refs move or neither does.
// Exported function only: the CLI exposes it as `starci release cut`. Never stashes, resets, deletes or moves a tag, never pushes anything but main and that tag.
// The heavy part (the suite and the push) runs inside ONE host-lock function, `withHostLock`: the RIGHTS lane's lock API replaces its body when it lands; until
// then it runs the work directly. Seams (deps): git, suite, push, scan, changelog, lock.
import fs from 'node:fs';
import path from 'node:path';
import { catFile } from '../api/git/cat-file.mjs';
import { lsRemote } from '../api/git/ls-remote.mjs';
import { push } from '../api/git/push.mjs';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { statusQuery } from '../api/git/status-query.mjs';
import { symbolicRefQuery } from '../api/git/symbolic-ref-query.mjs';
import { tag as gitTag } from '../api/git/tag.mjs';
import { releaseNotesFindings } from '../hfs/runtime-rules/release-notes.mjs';
import { planFor, runStep } from './push-git.mjs';
import { scanRange } from './push-mains.mjs';

/** A release tag: `v` and a version. Anything else is never pushed by the release flow. */
const RELEASE_TAG = /^v\d[\w.+-]*$/;
const GIT_CALLS = { 'symbolic-ref': symbolicRefQuery, status: statusQuery, 'rev-parse': revParseQuery, tag: gitTag, 'cat-file': catFile, 'ls-remote': lsRemote };
const SUITE_TIMEOUT_MS = 60 * 60_000;

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

/** Run `work` while holding the host's one heavy-run lock (one heavy run at a time). The lock API of the RIGHTS lane lands here; today it runs the work as is. */
const withHostLock = (work) => work();

/** The default full-suite runner: npm test then npm run check, each to a log: [{name, ok, log, ms}]. */
function defaultSuite(repo) {
  return planFor(repo).steps.filter((step) => !step.absent).map((step) => {
    const r = runStep(step, { cwd: repo, timeoutMs: SUITE_TIMEOUT_MS, tag: 'release' });
    return { name: step.name, ok: r.ok, log: r.log, ms: r.ms };
  });
}

/**
 * Cut the release of `repo`: see the header. {ok, verdict, why, tag, head, suite, pushed}. `tag` names the tag to release (default: the one new
 * release tag on HEAD); a tag that is not `v*` is refused.
 */
export function cutRelease({ repo, remote = 'origin', branch = 'main', tag = null, deps = {} } = {}) {
  const run = deps.git ?? git;
  const out = { ok: false, repo: path.basename(repo), verdict: null, why: null, tag: null, head: null, suite: [], pushed: false };
  const refuse = (verdict, why, extra = {}) => ({ ...out, ...extra, verdict, why });
  const cwd = repo;

  const onBranch = run(['symbolic-ref', '--short', 'HEAD'], { cwd }).stdout;
  if (onBranch !== branch) return refuse('not-on-main', `the checkout is on ${onBranch || 'a detached HEAD'}, not ${branch}`);
  const dirty = run(['status', '--porcelain', '--untracked-files=no'], { cwd }).stdout.split(/\r?\n/).filter(Boolean);
  if (dirty.length) return refuse('dirty', `the tree has ${dirty.length} tracked change(s): commit them first (nothing is stashed or reset)`, { dirty: dirty.slice(0, 20) });
  const head = run(['rev-parse', 'HEAD'], { cwd }).stdout;
  out.head = head;

  const atHead = run(['tag', '--points-at', 'HEAD'], { cwd }).stdout.split(/\r?\n/).map((t) => t.trim()).filter(Boolean);
  if (tag !== null && !RELEASE_TAG.test(tag)) return refuse('bad-tag', `${tag} is not a release tag: only v<version> tags are pushed`);
  const candidates = tag ? [tag] : atHead.filter((t) => RELEASE_TAG.test(t));
  if (tag && !atHead.includes(tag)) return refuse('no-release-tag', `the tag ${tag} does not point at HEAD ${head.slice(0, 9)}`);
  const odd = tag ? [] : atHead.filter((t) => !RELEASE_TAG.test(t));
  if (odd.length) return refuse('bad-tag', `HEAD carries the non-release tag ${odd.join(', ')}: it is never pushed (housekeeping marks are refs/backup/* or refs/salvage/*, not tags)`);
  if (!candidates.length) return refuse('no-release-tag', `HEAD ${head.slice(0, 9)} carries no release tag v*: write the notes, tag the release commit (annotated) and run the flow again`);
  if (candidates.length > 1) return refuse('several-tags', `HEAD carries ${candidates.length} release tags (${candidates.join(', ')}): one push is one tag`);
  const name = candidates[0];
  out.tag = name;
  if (run(['cat-file', '-t', `refs/tags/${name}`], { cwd }).stdout !== 'tag') return refuse('tag-not-annotated', `${name} is a lightweight tag: create it with git tag -a, its message is the release notes`);
  const remoteHas = run(['ls-remote', '--tags', remote, `refs/tags/${name}`], { cwd });
  if (!remoteHas.ok) return refuse('remote-unreachable', `could not read the tags of ${remote}: ${remoteHas.stderr.slice(0, 200)}`);
  if (remoteHas.stdout) return refuse('tag-exists-on-remote', `${name} already exists on ${remote}: a tag is never moved or re-pushed; cut the next version`);

  const changelog = (deps.changelog ?? (() => fs.readFileSync(path.join(repo, 'CHANGELOG.md'), 'utf8')))();
  const notes = releaseNotesFindings({ tags: [name], changelog });
  if (notes.length) return refuse('release-notes', notes.map((f) => f.message).join('; '), { findings: notes });

  const lock = deps.lock ?? withHostLock;
  const steps = lock(() => (deps.suite ?? defaultSuite)(repo));
  out.suite = steps;
  const red = steps.filter((s) => !s.ok);
  if (red.length) return refuse('suite-red', `${red.map((s) => s.name).join(', ')} red: fix, land, and cut again (logs: ${red.map((s) => s.log).join(', ')})`);
  if (!steps.length) return refuse('suite-red', 'the full suite did not run');

  if (run(['rev-parse', 'HEAD'], { cwd }).stdout !== head || run(['status', '--porcelain', '--untracked-files=no'], { cwd }).stdout) return refuse('main-moved', 'the checkout changed while the suite ran: start over');
  const scan = (deps.scan ?? scanRange)({ cwd, from: `${remote}/${branch}`, to: branch });
  if (!scan.ok) return refuse('secret-scan', scan.error ?? `${scan.findings.length} finding(s) in the pushed range`, { findings: scan.findings });

  const refs = [branch, `refs/tags/${name}`];
  const refusal = pushRefusal({ refs });
  if (refusal) return refuse('push-refused', refusal);
  const pushed = lock(() => (deps.push ?? push)(['--atomic', remote, ...refs], { cwd, timeout: 600_000 }));
  if (pushed.status !== 0) return refuse('push-refused', `git push --atomic ${remote} ${refs.join(' ')} failed: ${String(pushed.stderr ?? '').trim().slice(0, 300)}`);
  return { ...out, ok: true, verdict: 'pushed', why: `${branch} and ${name} pushed to ${remote} in one atomic push`, pushed: true };
}
