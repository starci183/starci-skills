// release-definition.mjs - what makes a commit of the runtime repository a RELEASE commit, the one definition shared by the
// pre-push hook (scripts/guards/release-push-gate.mjs) and the release cut (scripts/supervisor/release-cut.mjs). The remote
// main of the runtime moves exactly when a release is cut, so a push of main or of a v* tag is judged against this list:
//   RELEASE_VERSION_UNCHANGED   package.json `version` at the pushed commit differs from the version at the remote main's head
//   RELEASE_TAG_VERSION         the release tag is v<version> of the pushed commit
//   RELEASE_CHANGELOG_SECTION   CHANGELOG.md holds `## [<version>] - <date>` (a dated heading) with no unfinished marker (R222)
//   RELEASE_TAG_MISSING         an ANNOTATED tag v<version> points at the pushed commit
//   RELEASE_RECEIPT_MISSING     the L4 record of exactly this commit (scripts/guards/release-record.mjs, written by the cut) names this tag
//   RELEASE_RECEIPT_INCOMPLETE  that record holds a green row for each of RECEIPT_STEPS (the root suite, the packages suites and the checks) that RAN on this commit: a row the record marks `reusedFrom` another commit does not count
//   RELEASE_SUITE_MODE          the record says `suite: ci` (the full suite delegated to CI) while the checked-out config says `local`, or it lists no delegated root suite: a record never claims the mode by itself
//                               (the mode `ci` asks for the packages suites and the checks only, scripts/guards/release-suite-mode.mjs)
// Each finding names what is missing and the command that produces it. Pure over the git reads; no bypass.
import { catFile } from '../api/git/cat-file.mjs';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { show } from '../api/git/show.mjs';
import { tag as gitTag } from '../api/git/tag.mjs';
import { mergeBaseQuery } from '../api/git/merge-base-query.mjs';
import { pathKey, realPath } from '../lib/path-key.mjs';
import { changelogSection, releaseNotesFindings } from '../hfs/runtime-rules/release-notes.mjs';
import { readL4Record } from './release-record.mjs';
import { suiteModeOf } from './release-suite-mode.mjs';

/** The rows the L4 record must hold green: the full root suite, the packages suites and the checks of the exact commit. */
export const RECEIPT_STEPS = Object.freeze(['npm test', 'npm run test:packages', 'npm run check']);
/** The rows a record cut under `suite: ci` must hold green, RUN on the exact commit: the root suite is CI's, these two are not. */
export const RECEIPT_STEPS_CI = Object.freeze(['npm run test:packages', 'npm run check']);
const CUT_COMMAND = (tag) => `starci release cut --tag ${tag}`;
const REGEX_SPECIALS = /[.*+?^$()|[\]{}\\]/g;
const HEADING_HEAD = String.raw`^## \[`;
const DATED_HEADING_TAIL = String.raw`\] — \d{4}-\d{2}-\d{2}\s*$`;
const DATED_HEADING = (version) => new RegExp([HEADING_HEAD, version.replaceAll(REGEX_SPECIALS, String.raw`\$&`), DATED_HEADING_TAIL].join(''), 'mu');

const finding = (code, missing, fix) => ({ code, missing, fix });
const gitText = (verb, args, cwd) => {
  const r = verb(args, { cwd, timeout: 60_000 });
  return r.status === 0 ? String(r.stdout ?? '') : null;
};

/** The package.json version of `commit`, or null when the commit or its manifest cannot be read. */
export function versionAt(cwd, commit) {
  const text = gitText(show, [`${commit}:package.json`], cwd);
  try { return text === null ? null : JSON.parse(text).version ?? null; } catch { return null; }
}

const releaseUnknown = (why) => ({ ok: false, status: 'unknown', why });
const ineligibleRelease = (explicit, why) => explicit ? releaseUnknown(why) : { ok: true, candidate: null };

/** A runtime Git root's nearest annotated, manifest-bound release; enclosing application history is inapplicable. */
export function releaseTagOf({ repo, tag = null, excludeHead = false }) {
  const history = runtimeGitHistory(repo);
  if (!history.ok) return history;
  const listed = tag === null ? gitText(gitTag, ['--merged', 'HEAD', '--list', 'v*'], repo) : tag;
  if (listed === null) return releaseUnknown('release tags are unreadable');
  const candidates = [];
  for (const named of listed.split(/\r?\n/).filter(Boolean)) {
    const result = releaseCandidate({ repo, named, current: history.head, explicit: tag !== null, excludeHead });
    if (!result.ok) return result;
    if (result.candidate) candidates.push(result.candidate);
  }
  return nearestRelease(repo, candidates);
}

/** Runtime history exists only at its own Git top-level with a readable HEAD and full ancestry. */
function runtimeGitHistory(repo) {
  const top = revParseQuery(['--show-toplevel'], { cwd: repo });
  if (top.status !== 0) {
    if (/not a git repository/i.test(String(top.stderr ?? ''))) return { ok: false, status: 'no-repository', why: 'release history requires a Git repository' };
    return releaseUnknown('release repository identity is unreadable');
  }
  const gitRoot = String(top.stdout ?? '').trim();
  if (!gitRoot) return releaseUnknown('release repository root is unreadable');
  if (pathKey(realPath(gitRoot)) !== pathKey(realPath(repo))) return { ok: false, status: 'no-runtime-repository', why: 'the runtime copy is inside an enclosing Git repository; its history belongs to that repository' };
  const head = gitText(revParseQuery, ['HEAD'], repo)?.trim();
  if (!head) return releaseUnknown('release history HEAD is unreadable');
  if (gitText(revParseQuery, ['--is-shallow-repository'], repo)?.trim() !== 'false') return releaseUnknown('release history is shallow or unreadable; fetch complete release history');
  return { ok: true, head };
}

/** A candidate binds annotation, peeled commit, manifest spelling and ancestry; default discovery omits ineligible tags. */
function releaseCandidate({ repo, named, current, explicit, excludeHead }) {
  const kind = gitText(catFile, ['-t', `refs/tags/${named}`], repo)?.trim();
  const head = gitText(revParseQuery, [`refs/tags/${named}^{commit}`], repo)?.trim();
  if (!kind || !head) return releaseUnknown(`release tag ${named} is unreadable`);
  if (kind !== 'tag') return ineligibleRelease(explicit, `release tag ${named} is not annotated`);
  const version = versionAt(repo, head);
  if (!version) return releaseUnknown(`release manifest of ${named} is unreadable`);
  if (named !== `v${version}`) return ineligibleRelease(explicit, `release tag ${named} differs from its manifest version ${version}`);
  const reachable = releaseAncestor(repo, head, current);
  if (reachable === null) return releaseUnknown(`release ancestry of ${named} is unreadable`);
  if (!reachable) return ineligibleRelease(explicit, `release tag ${named} is not merged in HEAD`);
  if (excludeHead && head === current) return { ok: true, candidate: null };
  return { ok: true, candidate: { tag: named, head } };
}

/** Only one unsuperseded release ancestor proves a boundary; incomparable releases hold. */
function nearestRelease(repo, candidates) {
  if (!candidates.length) return releaseUnknown('no eligible annotated, manifest-bound release tag is merged in HEAD');
  const nearest = [];
  for (const candidate of candidates) {
    const superseded = candidateSuperseded(repo, candidate, candidates);
    if (superseded === null) return releaseUnknown('release ancestry between tags is unreadable');
    if (!superseded) nearest.push(candidate);
  }
  if (nearest.length !== 1) return releaseUnknown(`release history is ambiguous: ${nearest.map((entry) => entry.tag).join(', ')}`);
  return { ok: true, ...nearest[0] };
}

/** A release loses its boundary only to a proven descendant release, never to a date or version sort. */
function candidateSuperseded(repo, candidate, candidates) {
  for (const other of candidates) {
    if (candidate.head === other.head) continue;
    const older = releaseAncestor(repo, candidate.head, other.head);
    if (older === null) return null;
    if (older) return true;
  }
  return false;
}

/** Missing Git proof is distinct from a proven non-ancestor. */
function releaseAncestor(repo, before, after) {
  const result = mergeBaseQuery(['--is-ancestor', before, after], { cwd: repo });
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  return null;
}

function versionFindings({ cwd, commit, remoteCommit, version }) {
  if (!remoteCommit) return [];
  const remoteVersion = versionAt(cwd, remoteCommit);
  if (remoteVersion === null) return [finding('RELEASE_REMOTE_HEAD_UNKNOWN', `the remote main head ${remoteCommit.slice(0, 9)} is not in this repository, so its version cannot be compared`, 'git fetch origin main')];
  if (remoteVersion === version) return [finding('RELEASE_VERSION_UNCHANGED', `package.json version ${version} is the version the remote main already carries`, `bump package.json version, move the CHANGELOG section to the new version, commit, then ${CUT_COMMAND('v<new version>')}`)];
  return [];
}

function changelogFindings({ cwd, commit, version, tag }) {
  const changelog = gitText(show, [`${commit}:CHANGELOG.md`], cwd);
  if (changelog === null) return [finding('RELEASE_CHANGELOG_SECTION', 'CHANGELOG.md is not readable at the pushed commit', 'restore CHANGELOG.md')];
  const notes = releaseNotesFindings({ tags: [tag], changelog });
  if (notes.length) return notes.map((n) => finding('RELEASE_CHANGELOG_SECTION', n.message, 'finish the CHANGELOG section of the release (no in-preparation mark, no open marker), commit'));
  if (!changelogSection(changelog, version).found || !DATED_HEADING(version).test(changelog)) return [finding('RELEASE_CHANGELOG_SECTION', `CHANGELOG.md has no dated heading "## [${version}] — YYYY-MM-DD"`, `date the heading of the ${version} section, commit`)];
  return [];
}

function tagFindings({ cwd, commit, tag }) {
  const kind = gitText(catFile, ['-t', `refs/tags/${tag}`], cwd)?.trim();
  const target = gitText(revParseQuery, [`refs/tags/${tag}^{commit}`], cwd)?.trim();
  if (kind === 'tag' && target === commit) return [];
  return [finding('RELEASE_TAG_MISSING', `no annotated tag ${tag} points at ${commit.slice(0, 9)}`, CUT_COMMAND(tag))];
}

/** The finding of a record that claims the delegated suite without the checked-out config saying so (or without naming the delegated root suite), else null. */
function suiteModeFinding({ record, cwd, commit, tag }) {
  if (record.suite !== 'ci') return null;
  if (suiteModeOf(cwd) !== 'ci') return finding('RELEASE_SUITE_MODE', `the release record of ${commit.slice(0, 9)} says suite: ci, but this checkout's config.yaml release.suite is not ci: a record does not choose the mode`, `set release.suite: ci in config.yaml (the owner's choice), or ${CUT_COMMAND(tag)} under suite: local`);
  if (!(record.delegated ?? []).some((row) => row?.name === 'npm test')) return finding('RELEASE_SUITE_MODE', `the suite: ci record of ${commit.slice(0, 9)} does not list npm test as delegated`, CUT_COMMAND(tag));
  return null;
}

function receiptFindings({ cwd, commit, tag }) {
  const record = readL4Record({ repo: cwd, head: commit, tag });
  if (!record) return [finding('RELEASE_RECEIPT_MISSING', `no release record for exactly ${commit.slice(0, 9)} and ${tag}: the full suite and the packages suites did not run green on this commit`, CUT_COMMAND(tag))];
  const mode = suiteModeFinding({ record, cwd, commit, tag });
  if (mode) return [mode];
  // A row reused from another commit (reusedFrom) was not run on this one: the required rows count only when they RAN on the exact pushed commit.
  const green = new Set((record.logs ?? []).filter((row) => row?.ok === true && !row.reusedFrom).map((row) => row.name));
  const required = record.suite === 'ci' ? RECEIPT_STEPS_CI : RECEIPT_STEPS;
  const absent = required.filter((name) => !green.has(name));
  return absent.length ? [finding('RELEASE_RECEIPT_INCOMPLETE', `the release record of ${commit.slice(0, 9)} has no green row run on this commit for: ${absent.join(', ')}`, CUT_COMMAND(tag))] : [];
}

/**
 * The findings that keep `commit` from being a release commit of the repository at `cwd`: [{code, missing, fix}], [] when it is one.
 * `remoteCommit` is the remote main's head being replaced (null for a tag push or a first push); `tag` the release tag (default v<version>);
 * `needTag` / `needReceipt` are false only for the cut's early look, before it has created the tag and run the suite.
 */
export function releaseFindings({ cwd, commit, remoteCommit = null, tag = null, needTag = true, needReceipt = true }) {
  const version = versionAt(cwd, commit);
  if (!version) return [finding('RELEASE_VERSION_UNREADABLE', `package.json at ${commit.slice(0, 9)} has no readable version`, 'restore package.json')];
  const expected = `v${version}`;
  const named = tag ?? expected;
  if (named !== expected) return [finding('RELEASE_TAG_VERSION', `the tag ${named} is not v${version}, the version of ${commit.slice(0, 9)}`, `tag v${version}, or set package.json version to ${named.replace(/^v/, '')}`)];
  return [
    ...versionFindings({ cwd, commit, remoteCommit, version }),
    ...changelogFindings({ cwd, commit, version, tag: named }),
    ...(needTag ? tagFindings({ cwd, commit, tag: named }) : []),
    ...(needReceipt ? receiptFindings({ cwd, commit, tag: named }) : []),
  ];
}
