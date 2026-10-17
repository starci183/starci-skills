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
// The finding id is `<kind>:<file>:<detail>`; the fingerprint of a change is the digest of its sorted ids, the name under which the owner
// approves exactly that loosening (an owner-rulings entry `gate-loosening-<fingerprint>`).
import { shortHash } from './hash.mjs';
import { byCodeUnit } from './list.mjs';

const LIST_ITEM = /^\s*-\s+\S/;
const NUMBER_LINE = /^\s*(?:-\s+)?([A-Za-z][\w.-]*):\s*(-?\d+(?:\.\d+)?)\s*(?:#.*)?$/;
const FINGERPRINT_LENGTH = 12;

/** The files of a unified diff: [{file, deleted, added[], removed[]}] (changed lines without their marker). */
export function parseDiff(text) {
  const files = [];
  let current = null;
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const header = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
    if (header) { current = { file: header[2], deleted: false, added: [], removed: [] }; files.push(current); continue; }
    if (!current) continue;
    if (line.startsWith('deleted file mode')) current.deleted = true;
    else if (line.startsWith('+') && !line.startsWith('+++')) current.added.push(line.slice(1));
    else if (line.startsWith('-') && !line.startsWith('---')) current.removed.push(line.slice(1));
  }
  return files;
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

const numbersOf = (lines) => lines.map((line) => NUMBER_LINE.exec(line)).filter(Boolean).map((match) => ({ key: match[1], value: Number(match[2]) }));

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

/** Every loosening of the change `diffText`, sorted: [{id, kind, file, detail}]. `rules` is modules/kernel/gate-loosening.yaml. */
export function looseningsOf(diffText, rules) {
  const files = parseDiff(diffText);
  const product = changesProduct(files, rules);
  const found = files.flatMap((entry) => [
    ...(rules.gateFiles.includes(entry.file) ? [...checksRemoved(entry), ...thresholdsLowered(entry, rules)] : []),
    ...(rules.allowlistFiles.includes(entry.file) ? entry.added.filter((value) => LIST_ITEM.test(value)).map((value) => ({ kind: 'allowlist-added', file: entry.file, detail: clip(trimmed(value)) })) : []),
    ...(product && isSpec(entry.file, rules) ? specFindings(entry, files, rules) : []),
  ]);
  return found.map((finding) => ({ ...finding, id: `${finding.kind}:${finding.file}:${finding.detail}` })).sort((a, b) => byCodeUnit(a.id, b.id));
}

/** The name under which the owner approves exactly these loosenings. */
const looseningFingerprint = (findings) => shortHash(findings.map((finding) => finding.id).join('\n'), { n: FINGERPRINT_LENGTH });

/** The id of the owner-rulings entry that approves these loosenings. */
export const approvalIdOf = (findings) => `gate-loosening-${looseningFingerprint(findings)}`;

/** Whether the parsed owner-rulings document holds the approval of these loosenings. */
export const approved = (findings, rulings) => (rulings?.rulings ?? []).some((entry) => entry?.id === approvalIdOf(findings));
