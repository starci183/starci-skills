// runtime-deploy-source.mjs - what a deploy knows about the revision it carries: the source (a clone path or a ref of the host repository), its commit and
// tree, whether it is committed and clean, whether it is a fast-forward of the host, and the files and areas the range changes. Reads only.
import fs from 'node:fs';
import path from 'node:path';
import { revParse } from '../api/git/rev-parse.mjs';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { isAncestor } from '../api/git/is-ancestor.mjs';
import { diffNames } from '../api/git/diff-names.mjs';
import { porcelainStatus } from '../api/git/porcelain-status.mjs';
import { revList } from '../api/git/rev-list.mjs';
import { symbolicRefQuery } from '../api/git/symbolic-ref-query.mjs';

const text = (r) => (r.status === 0 ? String(r.stdout ?? '').trim() : null);

/** Where a file belongs: scripts/<sub>, modules/<sub> and knowledge/<sub> by their second segment, everything else by its first. */
export function areaOf(file) {
  const parts = String(file).split('/');
  return parts.length > 2 && ['scripts', 'modules', 'knowledge'].includes(parts[0]) ? `${parts[0]}/${parts[1]}` : parts[0];
}

/** {area: count} of a file list, areas in code-unit order. */
export function areasOf(files) {
  const counts = {};
  for (const file of files) counts[areaOf(file)] = (counts[areaOf(file)] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => (a < b ? -1 : 1)));
}

/** `from`: an existing directory is a clone (its HEAD is the revision), anything else is a ref of the host repository. */
export function resolveSource(from, host) {
  const asDir = path.resolve(from);
  const isClone = fs.existsSync(path.join(asDir, '.git'));
  const dir = isClone ? asDir : host;
  const sha = isClone ? revParse(dir, 'HEAD') : revParse(host, from);
  if (!sha) return { ok: false, kind: isClone ? 'clone' : 'ref', from };
  const tree = text(revParseQuery([`${sha}^{tree}`], { cwd: dir }));
  const branch = isClone ? text(symbolicRefQuery(['-q', '--short', 'HEAD'], { cwd: dir })) : null;
  return { ok: true, kind: isClone ? 'clone' : 'ref', from, dir, sha, tree, branch };
}

/** Whether the working tree at `dir` has changes against HEAD (untracked files count; ignored ones do not). */
export const isDirty = (dir, { trackedOnly = false } = {}) => {
  const r = porcelainStatus(dir, { untracked: trackedOnly ? 'no' : 'all' });
  return !r.ok || r.stdout !== '';
};

/** The facts of the range host HEAD..source tip, read in the source repository: {fastForward, commits, files}. */
export function rangeOf(source, hostHead) {
  const ff = isAncestor(source.dir, hostHead, source.sha);
  if (!ff) return { fastForward: false, commits: 0, files: [] };
  const count = text(revList(['--count', `${hostHead}..${source.sha}`], { cwd: source.dir }));
  return { fastForward: true, commits: Number(count ?? 0), files: diffNames(source.dir, hostHead, source.sha) ?? [] };
}
