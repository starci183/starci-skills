// release-definition.mjs - what makes a commit of the runtime repository a RELEASE commit, the one definition shared by the
// pre-push hook (scripts/guards/release-push-gate.mjs) and the release cut (scripts/supervisor/release-cut.mjs). The remote
// main of the runtime moves exactly when a release is cut, so a push of main or of a v* tag is judged against this list:
//   RELEASE_VERSION_UNCHANGED   package.json `version` at the pushed commit differs from the version at the remote main's head
//   RELEASE_TAG_VERSION         the release tag is v<version> of the pushed commit
//   RELEASE_CHANGELOG_SECTION   CHANGELOG.md holds `## [<version>] - <date>` (a dated heading) with no unfinished marker (R222)
//   RELEASE_TAG_MISSING         an ANNOTATED tag v<version> points at the pushed commit
//   RELEASE_RECEIPT_MISSING     the L4 record of exactly this commit (scripts/guards/release-record.mjs, written by the cut) names this tag
//   RELEASE_RECEIPT_INCOMPLETE  that record holds a green row for each of RECEIPT_STEPS (the root suite, the packages suites and the checks) that RAN on this commit: a row the record marks `reusedFrom` another commit does not count
// Each finding names what is missing and the command that produces it. Pure over the git reads; no bypass.
import { catFile } from '../api/git/cat-file.mjs';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { show } from '../api/git/show.mjs';
import { changelogSection, releaseNotesFindings } from '../hfs/runtime-rules/release-notes.mjs';
import { readL4Record } from './release-record.mjs';

/** The rows the L4 record must hold green: the full root suite, the packages suites and the checks of the exact commit. */
export const RECEIPT_STEPS = Object.freeze(['npm test', 'npm run test:packages', 'npm run check']);
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

function receiptFindings({ cwd, commit, tag }) {
  const record = readL4Record({ repo: cwd, head: commit, tag });
  if (!record) return [finding('RELEASE_RECEIPT_MISSING', `no release record for exactly ${commit.slice(0, 9)} and ${tag}: the full suite and the packages suites did not run green on this commit`, CUT_COMMAND(tag))];
  // A row reused from another commit (reusedFrom) was not run on this one: the required rows count only when they RAN on the exact pushed commit.
  const green = new Set((record.logs ?? []).filter((row) => row?.ok === true && !row.reusedFrom).map((row) => row.name));
  const absent = RECEIPT_STEPS.filter((name) => !green.has(name));
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
