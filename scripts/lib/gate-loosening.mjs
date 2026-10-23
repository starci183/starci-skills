// gate-loosening.mjs — what "loosens a gate" means, mechanically (modules/kernel/gate-loosening.yaml), over the unified diff of one change.
// A loosening is one of:
//   check-removed      a list item removed from a gate file and not added back in the same file (an item that carries an id is the
//                      same item while an added item carries that id: a row whose fields change stays a check)
//   check-narrowed     an enforcer row `{kind, id, editions}` that keeps its kind and id but now runs in fewer editions (a lost restriction or
//                      a superset of editions is a widening, never a loosening)
//   threshold-lowered  a number of a gate file moved the loose way: a floor lowered, a ceiling raised
//   allowlist-added    a list item added to an allowlist file
//   spec-deleted       a spec file deleted in a change that also changes product code
//   assertion-weakened a spec that loses more assertions than it gains in a change that also changes product code
//   spec-skipped       a skip marker added to a spec in a change that also changes product code
//   bypass-added, check-weakened, scope-widened (and check-removed over code): the code of a check is a gate too. A check script, rule module,
//                      canon template, lint package, workflow or hook (modules/kernel/gate-loosening.yaml checkCode) that gains a bypass marker,
//                      loses enforcement lines or ban-list rows, or gains an exemption is judged by scripts/lib/check-code-loosening.mjs
// A change that renames paths (a git rename, `git diff -M`) may MOVE the entries that name them: a removed line and an added line of the
// same file that are equal once every renamed prefix of the removed line is rewritten to its new name are one entry moved, not a check
// removed and an exception added (renamedPrefixesOf, movedLinesOf). A moved entry that also changes in any other way (a widened glob, an
// extra path) is still judged as a removal and an addition.
// The finding id is `<kind>:<file>:<detail>`. A loosening is always red (owner ruling loosening-always-red, 2026-10-22): there is no
// approval that lets one through, so a change that loosens a gate is fixed by restoring the gate (looseningStep).
// Only what a release shipped can be loosened (loosensReleased): a check, a spec or an assertion added after the release and folded
// away before the next one never was a gate of a release.
import { byCodeUnit } from './list.mjs';
import { checkCodeFindings, isCheckCode } from './check-code-loosening.mjs';

const LIST_ITEM = /^\s*-\s+\S/;
const NUMBER_LINE = /^\s*(?:-\s+)?([A-Za-z][\w.-]*):\s*(-?\d+(?:\.\d+)?)\s*(?:#.*)?$/;
/** A line of a JSON or JavaScript config as the YAML number line above reads it: no quotes around the key, no trailing comma or line comment. */
function plainNumberLine(line) {
  const comment = line.indexOf('//');
  const code = (comment < 0 ? line : line.slice(0, comment)).trimEnd();
  return (code.endsWith(',') ? code.slice(0, -1) : code).replace(/^(\s*(?:-\s+)?)["']([^"']+)["']:/, '$1$2:');
}

/**
 * The files of a unified diff: [{file, deleted, added[], removed[], under}] (changed lines without their marker). `under` maps an added line to the
 * hunk headers it was added under (git prints the nearest line above the hunk that starts a word, so the key a YAML list item sits in).
 */
export function parseDiff(text) {
  const files = [];
  let current = null;
  let section = '';
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const header = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
    if (header) { current = { file: header[2], deleted: false, added: [], removed: [], under: new Map() }; files.push(current); continue; }
    if (!current) continue;
    const hunk = /^@@ .*? @@ ?(.*)$/.exec(line);
    if (hunk) section = hunk[1];
    else if (line.startsWith('deleted file mode')) current.deleted = true;
    else if (line.startsWith('+') && !line.startsWith('+++')) {
      current.added.push(line.slice(1));
      current.under.set(line.slice(1), [...(current.under.get(line.slice(1)) ?? []), section]);
    } else if (line.startsWith('-') && !line.startsWith('---')) current.removed.push(line.slice(1));
  }
  return files;
}

/** The rename lines `R<score> <old> <new>` (tab separated) of `git diff --name-status -M`: [{from, to}]. */
const renamesOf = (nameStatus) => String(nameStatus ?? '').split(/\r?\n/).map((line) => line.split('\t'))
  .filter((fields) => /^R\d*$/.test(fields[0] ?? '') && fields.length === 3).map(([, from, to]) => ({ from, to }));

/** The moved prefix of one renamed file: its old and new path without the trailing segments they share. */
function movedPrefixOf({ from, to }) {
  const before = from.split('/');
  const after = to.split('/');
  while (before.length > 1 && after.length > 1 && before.at(-1) === after.at(-1)) { before.pop(); after.pop(); }
  return { from: before.join('/'), to: after.join('/') };
}

/**
 * The path prefixes a change renamed, from its `git diff --name-status -M` output: [{from, to}], longest `from` first. A prefix is kept only
 * when every renamed file under it moved to the same new prefix; an old prefix that went two ways names no single move and is dropped.
 */
export function renamedPrefixesOf(nameStatus) {
  const targets = new Map();
  for (const { from, to } of renamesOf(nameStatus).map(movedPrefixOf)) {
    if (from === to) continue;
    if (!targets.has(from)) targets.set(from, new Set());
    targets.get(from).add(to);
  }
  return [...targets].filter(([, to]) => to.size === 1).map(([from, to]) => ({ from, to: [...to][0] }))
    .sort((a, b) => b.from.length - a.from.length || byCodeUnit(a.from, b.from));
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

/** `line` with every renamed prefix rewritten to its new name; a prefix matches only as a whole path (not inside a longer name). */
function renamedLine(line, prefixes) {
  return prefixes.reduce((text, { from, to }) => text.replace(new RegExp(String.raw`(?<![\w./-])${escapeRegExp(from)}(?![\w.-])`, 'g'), to), line);
}

/**
 * One file of a change without its moved entries: each removed line whose renamed form is exactly an added line is paired with it, and
 * both are left out. A line the rename does not touch is never paired, so an entry merely removed or added stays.
 */
export function movedLinesOf(entry, prefixes) {
  if (!prefixes.length) return entry;
  const unpaired = new Map();
  for (const line of entry.added) unpaired.set(line, (unpaired.get(line) ?? 0) + 1);
  const paired = new Map();
  const removed = entry.removed.filter((line) => {
    const moved = renamedLine(line, prefixes);
    if (moved === line || (unpaired.get(moved) ?? 0) <= 0) return true;
    unpaired.set(moved, unpaired.get(moved) - 1);
    paired.set(moved, (paired.get(moved) ?? 0) + 1);
    return false;
  });
  const added = entry.added.filter((line) => {
    if ((paired.get(line) ?? 0) <= 0) return true;
    paired.set(line, paired.get(line) - 1);
    return false;
  });
  return { ...entry, added, removed };
}

const keyWords = (key) => key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const trimmed = (line) => line.trim();
const clip = (text) => (text.length > 90 ? `${text.slice(0, 89)}…` : text);

/** What makes a list item the same item: its id when it carries one, else its text. */
function identityOf(line) {
  const item = trimmed(line).slice(1).trimStart();
  const body = (item.startsWith('{') ? item.slice(1) : item).trimStart();
  if (!body.startsWith('id:')) return trimmed(line);
  const id = body.slice(3).trimStart().split(/[,}\s]/)[0];
  return id ? `id:${id}` : trimmed(line);
}

/** Splits `a: 1, b: [x, y]` at the commas outside square brackets. */
function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let from = 0;
  for (let at = 0; at < text.length; at += 1) {
    if (text[at] === '[') depth += 1;
    else if (text[at] === ']') depth -= 1;
    else if (text[at] === ',' && depth === 0) { parts.push(text.slice(from, at)); from = at + 1; }
  }
  parts.push(text.slice(from));
  return parts;
}

/** The flow-mapping enforcer row `- {kind: k, id: i, editions: [a, b]}`: {kind, id, editions} (editions null = every edition), or null. */
function flowRow(line) {
  const text = line.trim();
  if (!text.startsWith('-')) return null;
  const open = text.indexOf('{');
  const close = text.lastIndexOf('}');
  if (open < 1 || close < open || text.slice(1, open).trim() !== '') return null;
  const fields = new Map();
  for (const part of splitTopLevel(text.slice(open + 1, close))) {
    const at = part.indexOf(':');
    if (at > 0) fields.set(part.slice(0, at).trim(), part.slice(at + 1).trim());
  }
  if (!fields.has('kind') || !fields.has('id')) return null;
  const editions = fields.get('editions');
  const list = editions === undefined ? null : editions.replace('[', '').replace(']', '').split(',').map((value) => value.trim()).filter(Boolean);
  return { kind: fields.get('kind'), id: fields.get('id'), editions: list };
}

/** Whether row `after` still runs everywhere row `before` ran: a lost restriction or a superset of editions widens, a subset narrows. */
const coversEditions = (before, after) => after.editions === null || (before.editions !== null && before.editions.every((edition) => after.editions.includes(edition)));

/** The removed list items of a gate file that no added line restores; an enforcer row that keeps its kind and id may only widen its editions. */
function checksRemoved(entry) {
  const back = new Map();
  for (const line of entry.added.filter((value) => LIST_ITEM.test(value))) back.set(identityOf(line), (back.get(identityOf(line)) ?? 0) + 1);
  const addedRows = entry.added.map(flowRow).filter(Boolean);
  return entry.removed.filter((value) => LIST_ITEM.test(value)).flatMap((value) => {
    const row = flowRow(value);
    if (row) {
      const same = addedRows.filter((candidate) => candidate.kind === row.kind && candidate.id === row.id);
      if (same.length) {
        if (same.some((candidate) => coversEditions(row, candidate))) return [];
        return [{ kind: 'check-narrowed', file: entry.file, detail: clip(trimmed(value)) }];
      }
    }
    const left = back.get(identityOf(value)) ?? 0;
    if (left > 0) { back.set(identityOf(value), left - 1); return []; }
    return [{ kind: 'check-removed', file: entry.file, detail: clip(trimmed(value)) }];
  });
}

const numbersOf = (lines) => lines.map((line) => NUMBER_LINE.exec(plainNumberLine(line))).filter(Boolean).map((match) => ({ key: match[1], value: Number(match[2]) }));

/** The thresholds of a gate file moved the loose way. */
function thresholdsLowered(entry, rules) {
  const added = numbersOf(entry.added);
  return numbersOf(entry.removed).flatMap((before) => {
    const after = added.find((candidate) => candidate.key === before.key);
    if (!after || after.value === before.value) return [];
    const words = keyWords(before.key);
    const lowered = words.some((word) => rules.thresholds.floors.includes(word)) && after.value < before.value;
    const raised = words.some((word) => rules.thresholds.ceilings.includes(word)) && after.value > before.value;
    return lowered || raised ? [{ kind: 'threshold-lowered', file: entry.file, detail: `${before.key} ${before.value} -> ${after.value}` }] : [];
  });
}

const SPEC_NAME = /\.spec\.[cm]?[jt]sx?$/;
const isSpec = (file, rules) => rules.specRoots.some((root) => file.startsWith(root)) && SPEC_NAME.test(file);
const countOf = (lines, markers) => lines.filter((line) => markers.some((marker) => line.includes(marker))).length;

const baseName = (file) => file.slice(file.lastIndexOf('/') + 1);

/** Whether a spec of the same name is written elsewhere in the change: a moved spec is not a deleted one. */
const movedSpec = (entry, files, rules) => files.some((other) => other !== entry && !other.deleted && isSpec(other.file, rules) && baseName(other.file) === baseName(entry.file));

/** The spec findings of one file of a change that also changes product code. */
function specFindings(entry, files, rules) {
  if (entry.deleted) return movedSpec(entry, files, rules) ? [] : [{ kind: 'spec-deleted', file: entry.file, detail: 'deleted' }];
  const weaker = countOf(entry.removed, rules.assertionMarkers) - countOf(entry.added, rules.assertionMarkers);
  const skipped = countOf(entry.added, rules.skipMarkers) - countOf(entry.removed, rules.skipMarkers);
  return [...(weaker > 0 ? [{ kind: 'assertion-weakened', file: entry.file, detail: `${weaker} assertion(s) fewer` }] : []),
    ...(skipped > 0 ? [{ kind: 'spec-skipped', file: entry.file, detail: `${skipped} skip marker(s) added` }] : [])];
}

const changesProduct = (files, rules) => files.some((entry) => !isSpec(entry.file, rules) && rules.productPrefixes.some((prefix) => entry.file.startsWith(prefix)));

/** The findings of one file that is a gate file (its lists and numbers) or the code of a check (its numbers; its bypasses are checkCodeFindings'). */
function gateFindings(entry, rules) {
  if (rules.gateFiles.includes(entry.file)) return [...checksRemoved(entry), ...thresholdsLowered(entry, rules)];
  return isCheckCode(entry.file, rules) ? thresholdsLowered(entry, rules) : [];
}

/**
 * Every loosening of the change `diffText`, sorted: [{id, kind, file, detail}]. `rules` is modules/kernel/gate-loosening.yaml; `renamed`
 * is the change's renamed prefixes (renamedPrefixesOf), whose moved entries are no loosening.
 */
export function looseningsOf(diffText, rules, { renamed = [] } = {}) {
  const files = parseDiff(diffText).map((entry) => movedLinesOf(entry, renamed));
  const product = changesProduct(files, rules);
  const found = files.flatMap((entry) => [
    ...gateFindings(entry, rules),
    ...(rules.allowlistFiles.includes(entry.file) ? entry.added.filter((value) => LIST_ITEM.test(value)).map((value) => ({ kind: 'allowlist-added', file: entry.file, detail: clip(trimmed(value)) })) : []),
    ...(product && isSpec(entry.file, rules) ? specFindings(entry, files, rules) : []),
  ]).concat(checkCodeFindings(files, rules));
  return found.map((finding) => ({ ...finding, id: `${finding.kind}:${finding.file}:${finding.detail}` })).sort((a, b) => byCodeUnit(a.id, b.id));
}

/** One finding as the land gate and the self-check print it. */
export const looseningLine = (finding) => `${finding.kind} ${finding.file}: ${finding.detail}`;

/**
 * The land gate's step for a change that loosens a gate: always red, with the way out that exists, restoring the gate. There is no
 * approval: a loosening never lands (owner ruling loosening-always-red).
 */
export const looseningStep = (findings) => ({
  name: 'gate-loosening', ok: false, findings, output: findings.map(looseningLine).join('\n'),
  hint: 'a change that loosens a gate never lands (owner ruling loosening-always-red): restore every gate listed above',
});

const assertionsIn = (text, markers) => String(text ?? '').split('\n').filter((line) => markers.some((marker) => line.includes(marker))).length;

/** The detail of a check-removed finding without its clipping mark: the start of the removed line. */
const shownDetail = (detail) => (detail.endsWith('…') ? detail.slice(0, -1) : detail);

/**
 * Whether `finding` loosens the state released at `base`, read through `read(rev, file)` (text, or null when the revision holds no such
 * file); `rules` gives the assertion markers. A finding stays only when
 *   bypass-added        the added line is still in the file at HEAD (a bypass folded away before the next release never shipped)
 *   check-removed       the removed list item is an item of that gate file at the release commit
 *   spec-deleted        the spec exists at the release commit
 *   spec-skipped        the spec exists at the release commit
 *   assertion-weakened  the spec exists at the release commit and holds fewer assertion lines now than it held there
 * (every other kind loosens whenever its file existed at the release).
 */
export function loosensReleased(finding, { base, read, rules }) {
  // A bypass is judged by whether it still stands: one added and folded away before the next release never shipped.
  if (finding.kind === 'bypass-added') return String(read('HEAD', finding.file) ?? '').split('\n').some((line) => line.trim() === finding.text);
  const before = read(base, finding.file);
  if (before === null) return false;
  if (finding.kind === 'check-removed') return before.split('\n').some((line) => line.trim().startsWith(shownDetail(finding.detail)));
  if (finding.kind !== 'assertion-weakened') return true;
  return assertionsIn(read('HEAD', finding.file), rules.assertionMarkers) < assertionsIn(before, rules.assertionMarkers);
}
