// check-code-loosening.mjs - what loosens a gate when the gate is CODE: a check script, a canon template, a lint package, a workflow or a hook.
// gate-loosening.mjs judges the lists and numbers of the listed gate files; a bypass done by editing the check itself (a skip, an inline disable,
// a swallowed failure, a ban or an assertion deleted, an exemption widened) is judged here, over the same unified diff, rename-aware (a line
// that moves keeps its text, so it is paired off against its removal anywhere in the change). The kinds it reports:
//   bypass-added     a bypass marker added to a file of checkCode (scripts/lib/bypass-markers.mjs)
//   check-weakened   the change removes more enforcement lines from the files of checkCode than it adds back to them
//   check-removed    a pattern-table row or quoted list entry removed from a check script and added nowhere in the change
//   scope-widened    an exemption added: an ignore / exclude / exclusion key gaining an entry, a line more in an ignore file, an item added
//                    under codecov.yml `ignore:`, or skipLibCheck turned on
// A deleted file is not counted for check-weakened or check-removed: a registered check is judged by its entry in a gate file
// (knowledge/hfs/runtime-slots.yaml), and an unregistered script deleted is dead code (scripts/checks/check-dead-scripts.mjs).
import { bypassFileKind, bypassLabelsOf } from './bypass-markers.mjs';

const SPEC_NAME = /\.spec\.[cm]?[jt]sx?$/;
const FIXTURE_NAME = /\.fixture(?:\.\w+)?$/;
const CODE_NAME = /\.[cm]?[jt]sx?$/;
const COMMENT_LINE = /^\s*(?:\/\/|\/\*|\*|#)/;
const NOT_TEXT = /^\s*(?:#|\/\/|$)/;

const trimmed = (line) => line.trim();
const clip = (text) => (text.length > 90 ? `${text.slice(0, 89)}…` : text);

/** Whether `file` is one of the entries: a folder (the entry ends in a slash) or one file. */
const listed = (file, entries = []) => entries.some((entry) => (entry.endsWith('/') ? file.startsWith(entry) : file === entry));

/** Whether `file` is a check, a canon template, a lint package, a workflow or a hook (checkCode); its specs and fixtures spell markers on purpose and are not. */
export const isCheckCode = (file, rules) => listed(file, rules.checkCode) && !SPEC_NAME.test(file) && !FIXTURE_NAME.test(file);

const WORD = String.raw`\b(?:findings|violations|failures|errors|problems|issues|found|flag|fail)\s*(?:\.push\(|\()`;
const EXIT = String.raw`process\.exit(?:Code)?\b|\bassert[.(]|\bexpect\(|\bok\s*:\s*false\b`;
/** The lines that make a check fail: a finding pushed, a failing exit, an assertion. */
const ENFORCEMENT = new RegExp(`${WORD}|${EXIT}`);
const enforcementCount = (lines) => lines.filter((line) => !COMMENT_LINE.test(line) && ENFORCEMENT.test(line)).length;

const LITERAL = '/.+/[a-z]*|\'[^\']*\'|"[^"]*"|`[^`]*`';
/** A pattern-table row or a quoted list entry of a check script: the shape of a ban list or a rule table. */
const LIST_ENTRY = new RegExp(String.raw`^\s*(?:\[\s*(?:${LITERAL})\s*,.*\]|${LITERAL})\s*,?\s*(?://.*)?$`);

const countOf = (lines) => lines.reduce((counts, line) => counts.set(trimmed(line), (counts.get(trimmed(line)) ?? 0) + 1), new Map());

/** Each file's added lines once every line that also appears removed somewhere in the change (it only moved) is paired off: Map(entry -> {added, removed}). */
function unmovedOf(files) {
  const added = countOf(files.flatMap((entry) => entry.added));
  const removed = countOf(files.flatMap((entry) => entry.removed));
  const keep = (line) => {
    const key = trimmed(line);
    if ((added.get(key) ?? 0) <= 0 || (removed.get(key) ?? 0) <= 0) return true;
    added.set(key, added.get(key) - 1);
    removed.set(key, removed.get(key) - 1);
    return false;
  };
  return new Map(files.map((entry) => [entry, { added: entry.added.filter(keep), removed: entry.removed }]));
}

function bypassesAdded(entry, unmoved) {
  const kind = bypassFileKind(entry.file);
  if (!kind || entry.deleted) return [];
  return unmoved.added.flatMap((line) => bypassLabelsOf(kind, line, { pending: true })
    .map((label) => ({ kind: 'bypass-added', file: entry.file, detail: `${label}: ${clip(trimmed(line))}`, text: trimmed(line) })));
}

function entriesRemoved(entry, addedBack) {
  if (entry.deleted || !CODE_NAME.test(entry.file)) return [];
  return entry.removed.filter((line) => LIST_ENTRY.test(line) && !COMMENT_LINE.test(line)).flatMap((line) => {
    const left = addedBack.get(trimmed(line)) ?? 0;
    if (left > 0) { addedBack.set(trimmed(line), left - 1); return []; }
    return [{ kind: 'check-removed', file: entry.file, detail: clip(trimmed(line)) }];
  });
}

const EXEMPT_WORDS = ['ignores?', 'excludes?', 'exclusions?', 'coverageExclusions', '(?:coverage|testPath|modulePath)(?:Path)?IgnorePatterns', 'globalIgnores', String.raw`sonar\.(?:coverage\.)?exclusions`];
const EXEMPT_KEY = new RegExp(String.raw`["']?(?:${EXEMPT_WORDS.join('|')})["']?\s*[:=]`, 'i');
const SKIP_LIB_CHECK = /skipLibCheck["']?\s*:\s*true/;
const IGNORE_FILE = /(?:^|\/)[^/]*ignore$/;
const CODECOV_FILE = /(?:^|\/)codecov\.ya?ml$/;

const itemsOf = (line) => (line.match(/[^\s,"'[\]{}=:]+/g) ?? []).slice(1);

function scopesWidened(entry, unmoved) {
  if (entry.deleted) return [];
  const widened = (line) => ({ kind: 'scope-widened', file: entry.file, detail: clip(trimmed(line)) });
  // An ignore file that gains more lines than it loses (a line rewritten is not a line more); codecov.yml: a list item added under `ignore:`.
  if (IGNORE_FILE.test(entry.file)) return unmoved.added.filter((line) => !NOT_TEXT.test(line)).slice(unmoved.removed.filter((line) => !NOT_TEXT.test(line)).length).map(widened);
  if (CODECOV_FILE.test(entry.file)) return unmoved.added.filter((line) => (entry.under?.get(line) ?? []).some((section) => /^ignore\b/.test(section))).map(widened);
  return unmoved.added.flatMap((line) => {
    if (SKIP_LIB_CHECK.test(line)) return [widened(line)];
    const key = EXEMPT_KEY.exec(line)?.[0];
    if (!key) return [];
    const before = unmoved.removed.find((value) => value.includes(key));
    const known = new Set(before === undefined ? [] : itemsOf(before));
    return before === undefined || itemsOf(line).some((item) => !known.has(item)) ? [widened(line)] : [];
  });
}

/** Every finding the check files of the change `files` (parseDiff entries) add under `rules` (modules/kernel/gate-loosening.yaml): [{kind, file, detail}]. */
export function checkCodeFindings(files, rules) {
  const watched = files.filter((entry) => isCheckCode(entry.file, rules));
  const unmoved = unmovedOf(watched);
  const alive = watched.filter((entry) => !entry.deleted);
  const fewerInChange = enforcementCount(alive.flatMap((entry) => entry.removed)) - enforcementCount(alive.flatMap((entry) => entry.added));
  const addedBack = countOf(watched.flatMap((entry) => entry.added));
  return watched.flatMap((entry) => {
    const own = unmoved.get(entry);
    const fewer = enforcementCount(entry.removed) - enforcementCount(entry.added);
    return [
      ...bypassesAdded(entry, own),
      ...entriesRemoved(entry, addedBack),
      ...scopesWidened(entry, own),
      ...(fewerInChange > 0 && !entry.deleted && fewer > 0 ? [{ kind: 'check-weakened', file: entry.file, detail: `${fewer} enforcement line(s) fewer` }] : []),
    ];
  });
}
