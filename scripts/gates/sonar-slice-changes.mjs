// sonar-slice-changes.mjs — what a Sonar slice changed: the new-side line ranges of a `git diff -U0` against a base commit, plus the
// untracked files in scope (every line new). sonar-local.mjs scans only these lines; sonar-slice.mjs judges them.
import fs from 'node:fs';
import path from 'node:path';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { diff as gitDiff } from '../api/git/diff.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { mergeBase as mergeBaseOf } from '../api/git/merge-base.mjs';
import { unquoteDiffPath } from '../lib/git.mjs';

/** One git call of this module's checkout reads, with unquoted paths and a large output budget. */
export const git = (call, cwd, args) => call(args, { cwd, config: { 'core.quotepath': 'off' }, maxBuffer: 64 * 1024 * 1024 });

/** One header line of a file's diff, read only before its first hunk. */
const applyDiffHeader = (current, line) => {
  if (line.startsWith('new file mode') || line === '--- /dev/null') current.added = true;
  else if (line === '+++ /dev/null') current.deleted = true;
  else if (line.startsWith('+++ ')) current.path = unquoteDiffPath(line.slice(4)).replace(/^b\//, '');
  else if (line.startsWith('rename to ')) current.path ??= unquoteDiffPath(line.slice(10));
};

// The [from, to] new-side lines of a hunk header, or null for a header that adds none.
const hunkRange = (line) => {
  const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
  const start = Number(hunk?.[1]), count = hunk?.[2] === undefined ? 1 : Number(hunk[2]);
  return hunk && count > 0 ? [start, start + count - 1] : null;
};

/**
 * The new-side line ranges of a `git diff -U0` patch: [{path, added, ranges: [[from, to], ...]}]. A deleted
 * file is dropped; a rename or mode change without a hunk keeps its path with no range. Header lines are
 * only read before a file's first hunk, so a removed line that starts with "-- " is never a header.
 */
export function parseDiffNewLines(patch) {
  const files = [];
  let current = null, header = false;
  for (const line of String(patch ?? '').split(/\r?\n/)) {
    if (line.startsWith('diff --git ')) { current = { path: null, added: false, deleted: false, ranges: [] }; files.push(current); header = true; continue; }
    if (!current) continue;
    if (line.startsWith('@@')) {
      header = false;
      const range = hunkRange(line);
      if (range) current.ranges.push(range);
      continue;
    }
    if (header) applyDiffHeader(current, line);
  }
  return files.filter((f) => f.path && !f.deleted).map(({ path: file, added, ranges }) => ({ path: file, added, ranges }));
}

/** A comma list, a list of them or a single value as trimmed non-empty strings. */
export const splitList = (value) => (Array.isArray(value) ? value : [value]).flatMap((v) => String(v ?? '').split(',')).map((v) => v.trim()).filter(Boolean);

/** The diff of one commit plus the untracked files in the pathspec (every untracked line new). */
const collectSlice = (cwd, commit, pathspec) => {
  const diff = git(gitDiff, cwd, ['--no-color', '--no-ext-diff', '--no-textconv', '-U0', '-M', '--relative', '--src-prefix=a/', '--dst-prefix=b/', commit, ...pathspec]);
  if (diff.status !== 0) return { error: String(diff.stderr).trim().split(/\r?\n/)[0] };
  const files = parseDiffNewLines(diff.stdout);
  const untracked = git(lsFiles, cwd, ['--others', '--exclude-standard', '-z', ...pathspec]);
  for (const file of String(untracked.stdout ?? '').split('\0').filter(Boolean)) {
    if (files.some((f) => f.path === file)) continue;
    let lines = 0;
    try { const body = fs.readFileSync(path.join(cwd, file), 'utf8'); lines = body.split(/\r?\n/).length - (body.endsWith('\n') ? 1 : 0); } catch { /* unreadable */ }
    files.push({ path: file, added: true, untracked: true, ranges: lines > 0 ? [[1, lines]] : [] });
  }
  return { files };
};

// An attempt that authored no delta of its own (its slice was committed by an earlier attempt, so the base the op
// recorded is HEAD) read as SLICE_EMPTY and left backend.implement red in ops (observed on one ledger, 2 of 5 scans). The slice is then
// what the branch carries inside --paths beyond its merge-base with the trunk: the same code the gate has to judge.
function branchDeltaSlice({ cwd, baseCommit, baseRef, collect }) {
  for (const ref of ['@{upstream}', 'origin/main', 'main', 'origin/master', 'master']) {
    const sha = mergeBaseOf(cwd, 'HEAD', ref) ?? '';
    if (!sha || sha === baseCommit) continue;
    const alt = collect(sha);
    if (alt.files?.length) {
      return { files: alt.files, used: sha, baseFallback: { requested: baseRef, merged: ref, baseCommit: sha, reason: 'the attempt changed nothing after its recorded base; the slice is the branch delta since its merge-base with the trunk' } };
    }
  }
  return null;
}

/**
 * What the slice changed: the lines between --base (default HEAD) and the working tree the scanner
 * reads, inside --paths when given, plus untracked files there (every line new). Paths are relative
 * to cwd, the scanner's project base directory.
 */
export function sliceChanges(cwd, { base, paths } = {}) {
  const scope = splitList(paths);
  const baseRef = base || 'HEAD';
  const resolved = git(revParseQuery, cwd, ['--verify', '--quiet', `${baseRef}^{commit}`]);
  if (resolved.error || (resolved.status !== 0 && git(revParseQuery, cwd, ['--git-dir']).status !== 0)) return { ok: false, code: 'SLICE_NOT_GIT', reason: `${cwd} is not a git checkout, so the slice cannot be read` };
  if (resolved.status !== 0) return { ok: false, code: 'SLICE_BASE_UNKNOWN', reason: `the slice base ${baseRef} is not a commit in ${cwd}` };
  const pathspec = scope.length ? ['--', ...scope] : [];
  const collect = (commit) => collectSlice(cwd, commit, pathspec);
  const baseCommit = resolved.stdout.trim();
  const first = collect(baseCommit);
  if (first.error) return { ok: false, code: 'SLICE_NOT_GIT', reason: `git diff against ${baseRef} failed: ${first.error}` };
  let { files } = first, used = baseCommit, baseFallback = null;
  if (!files.length && git(revParseQuery, cwd, ['--verify', '--quiet', 'HEAD']).stdout.trim() === baseCommit) {
    const delta = branchDeltaSlice({ cwd, baseCommit, baseRef, collect });
    if (delta) ({ files, used, baseFallback } = delta);
  }
  return { ok: true, base: baseRef, baseCommit: used, paths: scope, files, ...(baseFallback ? { baseFallback } : {}) };
}
