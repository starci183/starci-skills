#!/usr/bin/env node
// check-prose-commands.mjs - RT_PROSE_COMMAND_UNKNOWN (R230; part of `npm run check`).
//   runs in the check stage (self-check prose-commands); --json prints the findings as JSON
//
// A command an instruction shows exists as written. The truth is the CLI catalog (modules/cli/commands) and the one extractor of
// "a documented command exists" (lib/doc-commands.mjs): every `starci <group> <verb> [--flag ...]` in a backticked span, a fenced
// code line, a yaml example item or plain prose of skills/, docs/, README.md, CONTEXT.md, CONTRIBUTING.md and modules/ must name a
// catalogued group and verb, and every --flag it shows must be a flag of that verb or a global flag. This check enforces those
// three reasons (a prose mention is held to them as strictly as a span); the doc-command spec enforces the rest of the call's
// shape on the same extractor. The removed-vocabulary list file, the failure-code catalogue (quoted refusals) and a [removed-list]
// marked line are exempt.
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from '../lib/is-main.mjs';
import { printFindings, isHistoryPath } from '../lib/check-scan.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { workingTreeTexts } from '../lib/tracked-text-scan.mjs';
import { loadCatalog } from '../cli/catalog.mjs';
import { MARKER } from './check-removed-vocabulary.mjs';
import { checkCommand, commandCatalogOf, extractCommands } from './lib/doc-commands.mjs';

export const CODE = 'RT_PROSE_COMMAND_UNKNOWN';
const SURFACE = /^(?:(?:skills|docs)\/.+\.md|(?:README|CONTEXT|CONTRIBUTING)\.md|modules\/.+\.(?:md|yaml))$/;
const EXEMPT = /^(?:modules\/kernel\/(?:removed-vocabulary|failure-codes)\.yaml|packages\/.*)$/;
// A word after "starci" in running prose is a command only when it names a catalogued group; inside a span or a fence an unknown group is a finding too.
const ENFORCED = { bounded: /^unknown (?:group|verb|option)\b/, prose: /^unknown (?:verb|option)\b/ };
const marked = (line) => line.includes(MARKER);
const commandNameOf = (occurrence) => occurrence.text.trim().split(' ').slice(0, 2).join(' ');

/** The RT_PROSE_COMMAND_UNKNOWN findings over {rel: text}: [{code, path, line, message}]. */
export function proseCommandFindings(files, table = commandCatalogOf(loadCatalog())) {
  const findings = [];
  for (const [rel, text] of Object.entries(files)) {
    if (!SURFACE.test(rel) || EXEMPT.test(rel) || isHistoryPath(rel)) continue;
    for (const occurrence of extractCommands(text, { kind: 'text', skipLine: marked })) {
      for (const reason of checkCommand(occurrence, table, { strictProse: true }).filter((entry) => ENFORCED[occurrence.mode].test(entry))) {
        findings.push({ code: CODE, path: rel, line: occurrence.line, message: `${rel}:${occurrence.line} starci ${commandNameOf(occurrence)}: ${reason}` });
      }
    }
  }
  return findings;
}

/** Run the scan on the working tree at `root`. */
export const checkProseCommands = (root = skillRoot) => proseCommandFindings(
  workingTreeTexts(root, lsFiles, (rel) => SURFACE.test(rel) && !EXEMPT.test(rel)), commandCatalogOf(loadCatalog(root)));

if (isMain(import.meta.url)) process.exit(printFindings(checkProseCommands(), 'OK: every command an instruction shows is in the CLI catalog.'));
