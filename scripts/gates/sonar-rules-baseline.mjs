// sonar-rules-baseline.mjs - the baseline of the `sonar-rules` gate: the findings main already carries, and nothing else. It is the
// `sonar-rules` section of the ONE allowlist (modules/kernel/allowlist.yaml), every entry with the reason it exists.
// An entry names rule + file + a fingerprint of the reported node's source (not its line) + the occurrence number among equal ones.
//   a finding with no entry                 is NEW      -> red (the baseline is never a suppression list for new code)
//   an entry whose finding is gone          is STALE    -> red (the fix commit removes its entry, so the section only shrinks)
//   an entry that has a finding             is LISTED   -> green
//   a cognitive-complexity finding above the recorded `weight` is NEW (a listed function may not get worse)
// The section ends as `sonar-rules: []`; it is written once (--init) and never again from findings.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { ALLOWLIST_FILE } from '../lib/allowlist.mjs';

export const BASELINE_SECTION = 'sonar-rules';
export const BASELINE_FILE = ALLOWLIST_FILE;
export const ENTRY_REASON = 'present on main when the sonar-rules gate landed; fix the code and delete this entry (a fix commit removes its own)';
const EXCERPT = 80;
const SECTION_HEADER = `# The findings of the sonar-rules self-check (scripts/checks/check-sonar-rules.mjs) that main carried when the gate landed: rule, file, a
# fingerprint of the flagged node, its occurrence number and, for cognitive complexity, the score it may not exceed. Not a suppression
# list: a finding that is not listed is red, a listed finding that is gone is red too, so the section only shrinks.\n`;

export const fingerprintOf = (finding) => crypto.createHash('sha256').update(`${finding.rule}\0${finding.text}`).digest('hex').slice(0, 12);

const keyOf = (rule, file, fingerprint, n) => `${rule}\0${file}\0${fingerprint}\0${n}`;
const entryKey = (entry) => keyOf(entry.rule, entry.file, entry.fingerprint, entry.n);
const compareEntries = (a, b) => (a.file + a.rule + a.fingerprint + a.n).localeCompare(b.file + b.rule + b.fingerprint + b.n, 'en');
const SECTION_START = new RegExp(String.raw`^(?:#[^\n]*\n)*${BASELINE_SECTION}:`, 'm');
const fileOf = (root) => path.join(root, ...BASELINE_FILE.split('/'));

/** {exists, entries}: `exists` is whether the allowlist carries the section at all (an empty `[]` still exists). A malformed section throws. */
export function readBaseline(root) {
  const file = fileOf(root);
  if (!fs.existsSync(file)) return { exists: false, entries: [] };
  const section = parseYaml(fs.readFileSync(file, 'utf8'))?.[BASELINE_SECTION];
  if (section === undefined || section === null) return { exists: false, entries: [] };
  if (!Array.isArray(section)) throw new Error(`${BASELINE_FILE}: ${BASELINE_SECTION} must be a list`);
  return { exists: true, entries: section };
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
  reason: ENTRY_REASON,
});

/**
 * Judge `findings` against `entries`. `covered(file)` says whether the run looked at that file (a staged run sees only the staged
 * ones); an entry of an unlooked file is neither listed nor stale. -> {fresh: findings, stale: entries, listed: findings}.
 */
export function compareToBaseline(findings, entries, covered) {
  const byKey = new Map(entries.map((entry) => [entryKey(entry), entry]));
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
  const stale = entries.filter((entry) => covered(entry.file) && !used.has(entryKey(entry)));
  return { fresh, stale, listed };
}

const scalar = (value) => JSON.stringify(value);
const field = ([key, value]) => `${key}: ${scalar(value)}`;
const entryLine = (entry) => `  - {${Object.entries(entry).map(field).join(', ')}}`;

/** The text of the section for `entries`, header included: the last section of the allowlist file. */
const sectionBody = (entries) => (entries.length ? `\n${entries.map(entryLine).join('\n')}` : ' []');
const sectionText = (entries) => `${SECTION_HEADER}${BASELINE_SECTION}:${sectionBody(entries)}\n`;

/** Replace (or append) the section in the allowlist file; the section is the last thing in the file. */
function storeEntries(root, entries) {
  const file = fileOf(root);
  const body = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : 'schema: starci/allowlist@1\n';
  const at = body.search(SECTION_START);
  const head = at < 0 ? `${body.trimEnd()}\n\n` : body.slice(0, at);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${head}${sectionText(entries)}`);
  return entries;
}

/** Write the section for `findings` (initial generation; callers refuse it once the section exists). */
export const writeBaseline = (root, findings) => storeEntries(root, numbered(findings).map(entryOf).sort(compareEntries));

/** Remove `stale` entries from the section (the only edit the writer allows once it exists). */
export function pruneBaseline(root, stale) {
  const gone = new Set(stale.map(entryKey));
  return storeEntries(root, readBaseline(root).entries.filter((entry) => !gone.has(entryKey(entry))));
}
