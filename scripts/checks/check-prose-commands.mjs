#!/usr/bin/env node
// check-prose-commands.mjs - RT_PROSE_COMMAND_UNKNOWN (R230; part of `npm run check`).
//   runs in the check stage (self-check prose-commands); --json prints the findings as JSON
//
// A command an instruction shows exists as written. The truth is the CLI catalog (modules/cli/commands): every
// `starci <group> <verb> [--flag ...]` in a backticked span, a fenced code line or a yaml example item of skills/, docs/,
// README.md, CONTEXT.md, CONTRIBUTING.md and modules/ must name a catalogued group and verb of a known group, and every
// --flag it shows (in code formatting or in plain prose, a prose command ending at the first , ; : ( ) + or sentence end) must be a flag of that verb or a global flag. The text after a lone `--` is the flags of another program
// (the check script a runtime check runs) and is not read; a chain of commands is read one command at a time. The removed-
// vocabulary list file, the failure-code catalogue (quoted refusals) and a [removed-list] marked line are exempt.
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from '../lib/is-main.mjs';
import { printFindings, isHistoryPath } from '../lib/check-scan.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { workingTreeTexts } from '../lib/tracked-text-scan.mjs';
import { loadCatalog } from '../cli/catalog.mjs';
import { MARKER } from './check-removed-vocabulary.mjs';

export const CODE = 'RT_PROSE_COMMAND_UNKNOWN';
const SURFACE = /^(?:(?:skills|docs)\/.+\.md|(?:README|CONTEXT|CONTRIBUTING)\.md|modules\/.+\.(?:md|yaml))$/;
const EXEMPT = /^(?:modules\/kernel\/(?:removed-vocabulary|failure-codes)\.yaml|packages\/.*)$/;
const SPAN = /`([^`\n]+)`/g;
const COMMAND_HEAD = /(?<![\w/.-])starci ([a-z][a-z-]*) ([a-z][a-z-]*)/g;
/** Each `starci <group> <verb>` of a text with its own tail: up to the next command or the arrow that ends it. */
function commandsOf(shown) {
  const heads = [...shown.matchAll(COMMAND_HEAD)];
  return heads.map((head, index) => {
    const from = head.index + head[0].length;
    const next = heads[index + 1]?.index ?? shown.length;
    const arrow = shown.indexOf('→', from);
    return [head[0], head[1], head[2], shown.slice(from, arrow >= 0 && arrow < next ? arrow : next)];
  });
}
const PROSE_CLAUSE = /(?<![\w/.-])starci [a-z][a-z-]* [a-z][a-z-]*[^(),;:+→\n]*/g;
const FLAG = /(?<![\w-])--([a-z][a-z0-9-]*[a-z0-9])(?![\w*-])/g;

/** The group -> verb -> flag-name set of a loaded catalog, global flags included. */
function commandTable(catalog = loadCatalog()) {
  const globals = catalog.global.flags.map((flag) => flag.name);
  const table = new Map();
  for (const group of catalog.groups) {
    table.set(group.group, new Map(group.verbs.map((verb) => [verb.verb, new Set([...(verb.flags ?? []).map((flag) => flag.name), ...globals])])));
  }
  return table;
}

/** The command-bearing parts of a line: backticked spans, each unbackticked `starci <group> <verb>` clause of prose, and the whole line of a fenced block or a yaml example item. */
function partsOf(line, fenced) {
  if (fenced || /^\s*-\s+starci /.test(line)) return [line];
  const spans = [...line.matchAll(SPAN)].map((match) => match[1]);
  const prose = [...line.replace(SPAN, ' ').matchAll(PROSE_CLAUSE)].map((match) => match[0].replace(/\.\s.*$/, ''));
  return [...spans, ...prose];
}

function commandFindings(part, table) {
  const found = [];
  const shown = part.split(/\s--\s/)[0];
  for (const match of commandsOf(shown)) {
    const verbs = table.get(match[1]);
    if (!verbs) continue;
    const flags = verbs.get(match[2]);
    if (!flags) { found.push(`starci ${match[1]} ${match[2]} is not a catalogued verb of ${match[1]}`); continue; }
    for (const flag of match[3].matchAll(FLAG)) if (!flags.has(flag[1])) found.push(`starci ${match[1]} ${match[2]} has no flag --${flag[1]}`);
  }
  return found;
}

/** The RT_PROSE_COMMAND_UNKNOWN findings over {rel: text}: [{code, path, line, message}]. */
export function proseCommandFindings(files, table = commandTable()) {
  const findings = [];
  for (const [rel, text] of Object.entries(files)) {
    if (!SURFACE.test(rel) || EXEMPT.test(rel) || isHistoryPath(rel)) continue;
    let fenced = false;
    text.split('\n').forEach((line, index) => {
      if (/^\s*```/.test(line)) { fenced = !fenced; return; }
      if (line.includes(MARKER)) return;
      for (const part of partsOf(line, fenced)) {
        for (const message of commandFindings(part, table)) findings.push({ code: CODE, path: rel, line: index + 1, message: `${rel}:${index + 1} ${message}` });
      }
    });
  }
  return findings;
}

/** Run the scan on the working tree at `root`. */
export const checkProseCommands = (root = skillRoot) => proseCommandFindings(
  workingTreeTexts(root, lsFiles, (rel) => SURFACE.test(rel) && !EXEMPT.test(rel)), commandTable(loadCatalog(root)));

if (isMain(import.meta.url)) process.exit(printFindings(checkProseCommands(), 'OK: every command an instruction shows is in the CLI catalog.'));
