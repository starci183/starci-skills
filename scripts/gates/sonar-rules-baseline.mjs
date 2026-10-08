// sonar-rules-baseline.mjs - the committed baseline of the `sonar-rules` gate: the findings main already carries, and nothing else.
// An entry names rule + file + a fingerprint of the reported node's source (not its line) + the occurrence number among equal ones.
//   a finding with no entry                 is NEW      -> red (a baseline is never a suppression list for new code)
//   an entry whose finding is gone          is STALE    -> red (the fix commit removes its entry, so the file only shrinks)
//   an entry that has a finding             is LISTED   -> green
//   a cognitive-complexity finding above the recorded `weight` is NEW (a listed function may not get worse)
// The file is deleted when its last entry goes; an empty file is itself a finding.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const BASELINE_FILE = 'knowledge/sonar-baseline.json';
export const BASELINE_VERSION = 1;
const EXCERPT = 80;

export const fingerprintOf = (finding) => crypto.createHash('sha256').update(`${finding.rule}\0${finding.text}`).digest('hex').slice(0, 12);

const keyOf = (rule, file, fingerprint, n) => `${rule}\0${file}\0${fingerprint}\0${n}`;
const compareEntries = (a, b) => (a.file + a.rule + a.fingerprint + a.n).localeCompare(b.file + b.rule + b.fingerprint + b.n, 'en');

/** The entries of the baseline at `root` ([] when the file is absent); a malformed file throws. */
export function readBaseline(root) {
  const file = path.join(root, BASELINE_FILE);
  if (!fs.existsSync(file)) return { exists: false, entries: [] };
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (doc.version !== BASELINE_VERSION || !Array.isArray(doc.entries)) throw new Error(`${BASELINE_FILE} is not a version ${BASELINE_VERSION} baseline`);
  return { exists: true, entries: doc.entries };
}

/** Findings numbered per (rule, file, fingerprint) in source order: each gets `fingerprint` and `n`. */
export function numbered(findings) {
  const seen = new Map();
  return [...findings].sort((a, b) => a.file.localeCompare(b.file, 'en') || a.line - b.line || a.column - b.column).map((finding) => {
    const fingerprint = fingerprintOf(finding);
    const id = `${finding.rule}\0${finding.file}\0${fingerprint}`;
    const n = (seen.get(id) ?? 0) + 1;
    seen.set(id, n);
    return { ...finding, fingerprint, n };
  });
}

const entryOf = (finding) => ({
  rule: finding.rule,
  file: finding.file,
  fingerprint: finding.fingerprint,
  n: finding.n,
  ...(finding.weight ? { weight: finding.weight } : {}),
  excerpt: finding.text.slice(0, EXCERPT),
});

/**
 * Judge `findings` against `entries`. `covered(file)` says whether the run looked at that file (a staged run sees only the staged
 * ones); an entry of an unlooked file is neither listed nor stale. -> {fresh: findings, stale: entries, listed: findings}.
 */
export function compareToBaseline(findings, entries, covered) {
  const byKey = new Map(entries.map((entry) => [keyOf(entry.rule, entry.file, entry.fingerprint, entry.n), entry]));
  const fresh = [];
  const listed = [];
  const used = new Set();
  for (const finding of numbered(findings)) {
    const key = keyOf(finding.rule, finding.file, finding.fingerprint, finding.n);
    const entry = byKey.get(key);
    if (!entry || (entry.weight && finding.weight > entry.weight)) { fresh.push(finding); continue; }
    used.add(key);
    listed.push(finding);
  }
  const stale = entries.filter((entry) => covered(entry.file) && !used.has(keyOf(entry.rule, entry.file, entry.fingerprint, entry.n)));
  return { fresh, stale, listed };
}

/** Write the baseline for `findings` (initial generation); deletes the file when there is nothing to list. */
export function writeBaseline(root, findings) {
  const file = path.join(root, BASELINE_FILE);
  const entries = numbered(findings).map(entryOf).sort(compareEntries);
  if (!entries.length) { fs.rmSync(file, { force: true }); return entries; }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify({ version: BASELINE_VERSION, entries }, null, 1)}\n`);
  return entries;
}

/** Remove `stale` entries from the baseline (the only edit the writer allows once a baseline exists); lowers weights to the current ones. */
export function pruneBaseline(root, stale) {
  const { entries } = readBaseline(root);
  const gone = new Set(stale.map((entry) => keyOf(entry.rule, entry.file, entry.fingerprint, entry.n)));
  const kept = entries.filter((entry) => !gone.has(keyOf(entry.rule, entry.file, entry.fingerprint, entry.n)));
  const file = path.join(root, BASELINE_FILE);
  if (!kept.length) fs.rmSync(file, { force: true });
  else fs.writeFileSync(file, `${JSON.stringify({ version: BASELINE_VERSION, entries: kept }, null, 1)}\n`);
  return kept;
}
