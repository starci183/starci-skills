// revision-change.mjs — what changed between two runtime revisions and what each role must do about it (modules/kernel/revision-scope.yaml).
//
// The mechanical test for a rule that was removed or reversed: a line-level diff of the file (git diff --numstat, no rename detection). A file
// that only gained lines is an ADDITION; a file that lost or changed a line, a binary file and a diff git cannot measure count as a REMOVAL.
// A commit may declare a contract edit wording-only with the trailer `Revision-Wording: <path>[, <path>]`; the declaration holds only when the
// file keeps the same structure (every mapping key, every list length, every heading and bullet), so an edit that deletes a list entry or a
// choice is refused and stays a replacement.
import { diff as gitDiff } from '../api/git/diff.mjs';
import { log as gitLog } from '../api/git/log.mjs';
import { catFile } from '../api/git/cat-file.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { sha256 } from '../../engine/digest.mjs';
import { byCodeUnit } from '../lib/list.mjs';
import { REPLACE, actionsFor, engineLoadedSet, loadScope, opKindsOf } from './revision-scope.mjs';

export const WORDING_TRAILER = 'Revision-Wording';
const SEATS = ['kernel', 'supervisor'];
const ALL_ROLES = [...SEATS, 'op', 'critic', 'engine'];
const SCALAR = 's';
const GIT = { timeout: 30_000, maxBuffer: 64 * 1024 * 1024 };

const run = (call, root, args) => {
  try {
    const r = call(args, { dir: root, ...GIT });
    return r.status === 0 ? String(r.stdout ?? '') : null;
  } catch { return null; }
};

/** [{path, added, deleted, binary}] changed from `from` to `to`, or null when git cannot say. */
export function changedFiles(root, from, to) {
  const out = run(gitDiff, root, ['--numstat', '--no-renames', '-z', from, to]);
  if (out == null) return null;
  return out.split('\0').filter(Boolean).map((record) => {
    const [added, deleted, ...rest] = record.replace(/^\n/, '').split('\t');
    const binary = added === '-' || deleted === '-';
    return { path: rest.join('\t'), added: binary ? 0 : Number(added), deleted: binary ? 0 : Number(deleted), binary };
  });
}

/** The paths the commits in (from, to] declare wording-only through the trailer. */
export function declaredWording(root, from, to) {
  const out = run(gitLog, root, ['--format=%B', `${from}..${to}`]) ?? '';
  const pattern = new RegExp(`^${WORDING_TRAILER}:\\s*(.+)$`, 'gm');
  return [...new Set([...out.matchAll(pattern)].flatMap((m) => m[1].split(',').map((p) => p.trim()).filter(Boolean)))].sort(byCodeUnit);
}

const structureOfValue = (value) => {
  if (Array.isArray(value)) return ['[]', value.length, ...value.map(structureOfValue)];
  if (value && typeof value === 'object') return Object.keys(value).sort(byCodeUnit).map((key) => [key, structureOfValue(value[key])]);
  return SCALAR;
};

const markdownKind = (line) => {
  const heading = /^(#+)\s/.exec(line);
  if (heading) return `h${heading[1].length}`;
  const bullet = /^(\s*)(?:[-*+]|\d+[.)])\s/.exec(line);
  if (bullet) return `b${bullet[1].length}`;
  return line.trim() === '' ? '_' : 'p';
};

/** The structure of a file's text: the mapping keys and list lengths of a YAML file, the heading, bullet and blank-line sequence of Markdown, the exact text of anything else. */
export function structureOf(file, text) {
  if (/\.ya?ml$/.test(file)) return JSON.stringify(structureOfValue(parseYaml(text)));
  if (/\.md$/.test(file)) return String(text).split('\n').map(markdownKind).join(',');
  return String(text);
}

/** Whether `before` to `after` of `file` is wording only: the same structure. {ok, reason}. A text that does not parse is not wording only. */
export function wordingOnly(file, before, after) {
  try {
    if (structureOf(file, before) === structureOf(file, after)) return { ok: true, reason: null };
    return { ok: false, reason: `${file} changes its structure (a key, a list entry, a choice, a heading or a bullet was added or removed)` };
  } catch (error) { return { ok: false, reason: `${file} cannot be compared: ${String(error?.message ?? error).slice(0, 120)}` }; }
}

const blobAt = (root, rev, file) => run(catFile, root, ['-p', `${rev}:${file}`]);

/** The effective action of a seat for one changed file of the table action `action`. */
function effective(action, entry, accepted) {
  if (action === 'boot') return REPLACE;
  if (action !== 'contract') return action;
  const removal = entry.deleted > 0 || entry.binary;
  return removal && !accepted.includes(entry.path) ? REPLACE : 'reread';
}

function wordingVerdict(root, from, to, entries, declared) {
  const accepted = [], refused = [];
  for (const entry of entries.filter((e) => declared.includes(e.path))) {
    const before = blobAt(root, from, entry.path), after = blobAt(root, to, entry.path);
    const verdict = before == null || after == null ? { ok: false, reason: `${entry.path} is not in both revisions` } : wordingOnly(entry.path, before, after);
    if (verdict.ok) accepted.push(entry.path);
    else refused.push({ path: entry.path, reason: verdict.reason });
  }
  return { declared, accepted, refused };
}

const weight = (doc, action) => (action === REPLACE ? doc.order.length : doc.order.indexOf(action));
const heaviest = (doc, actions) => actions.reduce((top, a) => (weight(doc, a) > weight(doc, top) ? a : top), 'none');
const LISTED = new Set(['reread', REPLACE, 'restart']);

function roleScope(doc, role, perFile, accepted) {
  const mine = perFile.map(({ entry, actions }) => ({ path: entry.path, action: effective(actions[role] ?? 'none', entry, accepted) })).filter((f) => f.action !== 'none');
  const named = (pick) => mine.filter(pick).map((f) => f.path).sort(byCodeUnit);
  return { action: heaviest(doc, mine.map((f) => f.action)), count: mine.length, files: named((f) => LISTED.has(f.action)), replaceFiles: named((f) => f.action === REPLACE) };
}

/**
 * The scope of the change from `from` to `to` in the tree at `root`: {known, from, to, fileCount, digest, wording, roles: {kernel: {action, count,
 * files, replaceFiles}, supervisor: {...}, op: {action, ..., kinds}, critic: {...}, engine: {...}}}. `roles` limits the roles computed (the
 * engine's import graph is read only when `engine` is asked for). `known` is false when git cannot say; the caller treats that as a replacement.
 */
export function changeScope(root, from, to, { doc = loadScope(root), roles = ALL_ROLES } = {}) {
  const entries = changedFiles(root, from, to);
  const none = { declared: [], accepted: [], refused: [] };
  if (!entries) return { known: false, from, to, fileCount: 0, digest: null, wording: none, roles: {} };
  const wording = wordingVerdict(root, from, to, entries, declaredWording(root, from, to));
  let engine = null;
  const engineLoaded = roles.includes('engine') ? (file) => (engine ??= engineLoadedSet(root, doc).loaded).has(file) : () => false;
  const perFile = entries.map((entry) => ({ entry, ...actionsFor(doc, entry.path, { engineLoaded }) }));
  const result = Object.fromEntries(roles.map((role) => [role, roleScope(doc, role, perFile, wording.accepted)]));
  if (result.op) result.op.kinds = [...new Set(entries.flatMap((e) => opKindsOf(doc, e.path)))].sort(byCodeUnit);
  const digest = sha256(entries.map((e) => `${e.path}\t${e.added}\t${e.deleted}`).sort(byCodeUnit).join('\n'));
  return { known: true, from, to, fileCount: entries.length, digest, wording, roles: result };
}
