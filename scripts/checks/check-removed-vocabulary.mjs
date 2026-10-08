#!/usr/bin/env node
// check-removed-vocabulary.mjs - RT_REMOVED_VOCABULARY (R229; part of `npm run check`).
//   runs in the check stage (self-check removed-vocabulary); --json prints the findings as JSON
//
// Text an agent or the owner reads never teaches a spelling the runtime refuses. The refused spellings are the one list
// modules/kernel/removed-vocabulary.yaml (engine/removed-vocabulary.mjs reads it; the config and routing-bias refusals
// take their names and replacements from it). This scan reads every tracked instruction surface - skills/, docs/,
// README.md, CONTEXT.md, CONTRIBUTING.md, modules/ prose and yaml, knowledge/ prose and yaml - and reports each line that
// spells a removed name, with the file, the line and the replacement. A spec (tests/**/*.spec.mjs) may spell one only where it
// asserts the runtime refuses it: on a line, or under a test title, that says refuse, reject, removed, throws or unknown. Exempt: the list file, CHANGELOG.md, and a line or
// block marked `[removed-list]` (a marker standing alone on a comment line covers the lines up to the next blank one).
import { skillRoot } from '../../engine/runtime-root.mjs';
import { removedVocabulary } from '../../engine/removed-vocabulary.mjs';
import { isMain } from '../lib/is-main.mjs';
import { escapeRegExp } from '../lib/regex.mjs';
import { printFindings, isHistoryPath } from '../lib/check-scan.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { workingTreeTexts } from '../lib/tracked-text-scan.mjs';

export const CODE = 'RT_REMOVED_VOCABULARY';
const LIST_FILE = 'modules/kernel/removed-vocabulary.yaml';
/** The marker that declares a line, or the block under a bare marker line, a removed-list. */
export const MARKER = '[removed-list]';

const SURFACE = /^(?:(?:skills|docs)\/.+\.md|(?:README|CONTEXT|CONTRIBUTING)\.md|(?:modules|knowledge)\/.+\.(?:md|yaml)|tests\/.+\.spec\.mjs)$/;
const SPEC = /^tests\//;
// A spec may spell a removed name where it asserts the runtime refuses it: on a line, or under a test title, that says so.
const REFUSAL_CONTEXT = /\b(?:refus\w*|reject\w*|removed|no longer|throws|unknown)\b/i;
const TEST_TITLE = /^\s*(?:test|it|describe)\(/;
const OUT = /node_modules\/|^packages\/|\.starciwork\//;
const COMMENT_SYNTAX = /<!--|-->|#|\/\/|\s/g;

/** The line indexes a marker exempts: its own line, and for a bare marker line the lines to the next blank one. */
function exemptLines(lines) {
  const exempt = new Set();
  lines.forEach((line, index) => {
    if (!line.includes(MARKER)) return;
    exempt.add(index);
    if (line.replace(MARKER, '').replaceAll(COMMENT_SYNTAX, '') !== '') return;
    for (let next = index + 1; next < lines.length && lines[next].trim(); next += 1) exempt.add(next);
  });
  return exempt;
}

/** The scanned entries with their line patterns: the entry's `match`, else its name as a whole token. */
const patternsOf = (entries) => entries.filter((entry) => entry.scan !== false).map((entry) => ({
  entry,
  pattern: new RegExp(entry.match ?? String.raw`(?<![\w.-])${escapeRegExp(entry.name)}(?![\w-])`),
}));

/** The RT_REMOVED_VOCABULARY findings over {rel: text}: [{code, path, line, message}]. */
export function removedVocabularyFindings(files, entries = removedVocabulary()) {
  const patterns = patternsOf(entries);
  const findings = [];
  for (const [rel, text] of Object.entries(files)) {
    if (rel === LIST_FILE || isHistoryPath(rel) || !SURFACE.test(rel) || OUT.test(rel)) continue;
    const lines = text.split('\n');
    const exempt = exemptLines(lines);
    let title = '';
    lines.forEach((line, index) => {
      if (SPEC.test(rel) && TEST_TITLE.test(line)) title = line;
      if (exempt.has(index) || (SPEC.test(rel) && (REFUSAL_CONTEXT.test(line) || REFUSAL_CONTEXT.test(title)))) return;
      for (const { entry, pattern } of patterns) {
        if (!pattern.test(line)) continue;
        findings.push({ code: CODE, path: rel, line: index + 1, name: entry.name, use: entry.use,
          message: `${rel}:${index + 1} spells the removed ${entry.kind} ${entry.name} (removed in ${entry.since}); use instead: ${entry.use}` });
      }
    });
  }
  return findings;
}

/** Run the scan on the working tree at `root` (tracked files and new unignored ones). */
export const checkRemovedVocabulary = (root = skillRoot) => removedVocabularyFindings(
  workingTreeTexts(root, lsFiles, (rel) => SURFACE.test(rel) && !OUT.test(rel)));

if (isMain(import.meta.url)) process.exit(printFindings(checkRemovedVocabulary(), 'OK: no instruction surface spells a removed name.'));
