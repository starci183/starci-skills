// host-path.mjs - the ONE matcher of a hard-coded absolute host path and the ONE normalizer that removes it (rule RT_ABSOLUTE_PATH of
// knowledge/hfs/rules.yaml; the settle refusal EVIDENCE_HOST_PATH of scripts/kernel/job-artifacts.mjs; the evidence recorder
// scripts/example/example-evidence.mjs). Pure: text in, text or hits out; the roots a caller knows come in as arguments.
//   hostPathHits(text)                        [{kind, sample, offset}]: a drive-letter path (a letter, a colon, a slash or backslash,
//                                             not a URL), a user-profile path (/Users/<name>/, /home/<name>/) and an expanded AppData path
//   normalizeHostPaths(text, roots)           the text with every host path written the portable way: inside roots.repo -> repo-relative;
//                                             inside roots.worktree|runtime|tmp|home -> <worktree>|<runtime>|<tmp>|<home>; a host
//                                             executable (a shell) -> its bare command name; any other host path -> <host>/<last segment>
// `%LOCALAPPDATA%` as an unexpanded name is not a path and is never touched.
import { trimTrailingChars } from './normalize.mjs';

const SEP = String.raw`(?:\\\\|\\|/)`;
const SLASH_CHAR = /[\\/]/;
const DRIVE = /(?<![\p{L}\p{N}_])[A-Za-z]:(?:\\|\/(?!\/))/gu;
const PROFILE = /(?<![\p{L}\p{N}_.:-])\/(?:Users|home)\/[A-Za-z0-9][A-Za-z0-9_.-]*\//gu;
const APPDATA = /(?<![\p{L}\p{N}_])AppData[\\/](?:Local|LocalLow|Roaming)(?![\p{L}\p{N}_])/gu;
const KINDS = [
  { kind: 'drive-letter path', rx: DRIVE },
  { kind: 'user-profile path', rx: PROFILE },
  { kind: 'AppData path', rx: APPDATA },
];
const TAIL = '[^\\s"\'`)\\]},;<>|]*';
const BEFORE = String.raw`(?<![\p{L}\p{N}_])`;

/** The host-path hits of one text: [{kind, sample, offset}] sorted by offset; a profile or AppData part of a drive path is the drive path's. */
export function hostPathHits(text) {
  const hits = [];
  for (const { kind, rx } of KINDS) {
    rx.lastIndex = 0;
    for (let m = rx.exec(text); m; m = rx.exec(text)) hits.push({ kind, sample: text.slice(m.index, m.index + 48).split(/[\s"'`)\]},;]/)[0], offset: m.index });
  }
  const drives = hits.filter((h) => h.kind === 'drive-letter path');
  const insideDrivePath = (h) => drives.some((d) => d.offset < h.offset && !/[\s"'`]/.test(text.slice(d.offset, h.offset)));
  return hits.filter((h) => h.kind === 'drive-letter path' || !insideDrivePath(h)).sort((a, b) => a.offset - b.offset);
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
const rootPattern = (root) => trimTrailingChars(String(root), SLASH_CHAR).split(/[\\/]+/).map(escape).join(SEP);
const portable = (s) => s.replace(/\\{1,2}/g, '/');

/** The text with each known root replaced: [{root, to}] longest root first; `to` '' makes the path relative to that root. */
function replaceRoots(text, roots) {
  let out = text;
  for (const { root, to } of roots) {
    const rx = new RegExp(String.raw`${BEFORE}${rootPattern(root)}(?=${SEP}|[^\p{L}\p{N}_.~-]|$)(${SEP}${TAIL})?`, 'giu');
    out = out.replace(rx, (_, tail) => {
      const rest = tail ? portable(tail.replace(new RegExp(`^${SEP}`), '')) : '';
      if (to === '') return rest || '.';
      return rest ? `${to}/${rest}` : to;
    });
  }
  return out;
}

/** The portable form of `text` (see the header). roots: {repo, worktree, runtime, tmp, home} - any may be absent. */
export function normalizeHostPaths(text, roots = {}) {
  const known = [['repo', ''], ['worktree', '<worktree>'], ['runtime', '<runtime>'], ['tmp', '<tmp>'], ['home', '<home>']]
    .filter(([key]) => typeof roots[key] === 'string' && roots[key].trim())
    .map(([key, to]) => ({ root: roots[key], to }))
    .sort((a, b) => b.root.length - a.root.length);
  let out = replaceRoots(String(text), known);
  // A host executable keeps only its bare command name: a shell path is recorded as `bash -c ...`.
  out = out.replace(new RegExp(String.raw`${BEFORE}[A-Za-z]:(?:${SEP}[^\s"'\\/]+)*${SEP}([^\s"'\\/]+?)\.exe(?![\p{L}\p{N}_.])`, 'giu'), '$1');
  // Any other host path: a placeholder plus its last segment.
  out = out.replace(new RegExp(String.raw`${BEFORE}[A-Za-z]:(?:\\{1,2}|/(?!/))${TAIL}`, 'gu'), (path) => `<host>/${path.split(/[\\/]+/).findLast(Boolean)}`.replace(/\/[A-Za-z]:$/, ''));
  out = out.replace(/(?<![\p{L}\p{N}_.:-])\/(?:Users|home)\/[A-Za-z0-9][A-Za-z0-9_.-]*\/[^\s"'`)\]},;<>|]*/gu, (path) => `<home>/${path.split('/').slice(3).join('/')}`.replace(/\/$/, ''));
  return out;
}
