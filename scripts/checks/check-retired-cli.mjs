#!/usr/bin/env node
// RT_RETIRED_CLI_CALL: tracked text must invoke the unified CLI, never one of
// the command spellings retired by the CLI catalog or dispatcher.
//
// Usage: starci runtime check --only retired-cli -- [--root <tree>] [--json]
// Exit 0 is clean, 1 reports findings, and 2 is bad usage or unreadable input.
// Generated package-lock.json files are exempt because pinned dependencies can name retired bins.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lsFiles } from '../api/git/ls-files.mjs';
import { loadCatalog } from '../cli/catalog.mjs';
import { isMain } from '../lib/is-main.mjs';
import { maskTextRange } from '../lib/text-mask.mjs';
import { lineTextAt, readTrackedTextFiles, runTrackedTextCheckCli, sentenceRanges, sentenceTextAt, sentencesOf } from '../lib/tracked-text-scan.mjs';


export const CODE = 'RT_RETIRED_CLI_CALL';
const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RUNTIME_OWNED = new Set(['modules', 'scripts', 'tests', 'docs', 'skills', 'engine', 'knowledge', 'benchmark', 'ui']);
const TOP_LEVEL = Object.freeze({
  init: 'starci runtime install',
  update: 'starci runtime update',
  doctor: 'starci runtime doctor',
  version: 'starci runtime version',
  validate: 'starci runtime validate',
  check: 'starci runtime check',
  start: 'starci workflow start',
  goal: 'starci workflow define',
});
const RETIREMENT_WORD = /\b(?:removed|retired|replaced)\b/i;
const GENERATED_LOCKFILE = /(?:^|\/)package-lock\.json$/;
const HELP = `Usage: starci runtime check --only retired-cli -- [--root <tree>] [--json]

${CODE}: no tracked text invokes a retired CLI command.
Exit 0 is clean, 1 reports findings, and 2 is bad usage or unreadable input.`;

class RetiredCliInputError extends Error {}

const slashPattern = (token) => token.split('/').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\\\/]');
const commandPattern = (spelling) => spelling.trim().split(/\s+/).map(slashPattern).join('[ \\t]+');
const commandRegex = (body, flags = '') => new RegExp(`(?<![\\w@./-])${body}(?![\\w-])`, `g${flags}`);
const alternation = (values) => [...values].sort((a, b) => b.length - a.length || a.localeCompare(b)).map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

/** Catalog-owned spellings and their replacements. */
function catalogRetired(catalog) {
  const out = [];
  for (const group of catalog.groups ?? []) {
    for (const verb of group.verbs ?? []) {
      for (const spelling of verb.removed ?? []) out.push({ spelling, use: `starci ${group.group} ${verb.verb}` });
    }
  }
  return out;
}

const exactKind = (spelling) => /^node\s+(?:\.claude[\\/])?scripts[\\/]kernel[\\/]cli\.mjs\b/.test(spelling) ? 'kernel-script' : 'catalog';

/** Compile the catalog and built-in command shapes once for a scan. */
export function retiredMatchers(catalog) {
  const matchers = catalogRetired(catalog).map(({ spelling, use }) => ({
    regex: commandRegex(commandPattern(spelling)),
    hit: (match) => ({ spelling: match[0], use, kind: exactKind(spelling), priority: 3 }),
  }));
  const kernel = catalog.groups?.find((group) => group.group === 'kernel');
  const kernelVerbs = (kernel?.verbs ?? []).map((verb) => verb.verb).filter(Boolean);
  const app = catalog.groups?.find((group) => group.group === 'app');
  const appVerbs = (app?.verbs ?? []).map((verb) => verb.verb).filter(Boolean);

  // These generic shapes cover group-level dispatcher removals and the
  // installed-runtime path. Exact catalog entries keep priority so renamed
  // verbs (for example an old verb whose replacement has a new name) win.
  matchers.push({
    regex: commandRegex('starci[ \\t]+api[ \\t]+([a-z][a-z0-9-]*)'),
    hit: (match) => ({ spelling: match[0], use: `starci kernel ${match[1]}`, kind: 'api', priority: 2 }),
  });
  if (kernelVerbs.length) matchers.push({
    regex: commandRegex(`api[ \\t]+(${alternation(kernelVerbs)})`),
    runtimeOwnedOnly: true,
    hit: (match) => ({ spelling: match[0], use: `starci kernel ${match[1]}`, kind: 'bare-api', priority: 1 }),
  });
  matchers.push({
    regex: commandRegex('node[ \\t]+(?:\\.claude[\\\\/])?scripts[\\\\/]kernel[\\\\/]cli\\.mjs[ \\t]+([a-z][a-z0-9-]*)'),
    hit: (match) => ({ spelling: match[0], use: `starci kernel ${match[1]}`, kind: 'kernel-script', priority: 2 }),
  }, {
    regex: commandRegex('node[ \\t]+bin[\\\\/]starci\\.mjs'),
    hit: (match) => ({ spelling: match[0], use: 'starci', kind: 'root-bin', priority: 2 }),
  }, {
    regex: commandRegex('npx[ \\t]+hfs(?:[ \\t]+([a-z][a-z0-9-]*))?'),
    hit: (match) => ({ spelling: match[0], use: match[1] ? `starci app ${match[1]}` : 'starci app', kind: 'hfs', priority: 2 }),
  }, {
    regex: commandRegex(['starci', 'test', 'stack'].join('-')),
    hit: (match) => ({ spelling: match[0], use: 'starci app stack', kind: 'stack', priority: 1 }),
  });
  if (appVerbs.length) matchers.push({
    regex: commandRegex(`hfs[ \\t]+(${alternation(appVerbs)})`),
    hit: (match) => ({ spelling: match[0], use: `starci app ${match[1]}`, kind: 'hfs', priority: 1 }),
  });
  for (const [verb, use] of Object.entries(TOP_LEVEL)) {
    const currentVerbs = (catalog.groups?.find((group) => group.group === verb)?.verbs ?? []).map((entry) => entry.verb).filter(Boolean);
    const currentVerbSuffix = currentVerbs.length ? `(?![ \\t]+(?:${alternation(currentVerbs)})(?![\\w-]))` : '';
    matchers.push({
      regex: commandRegex(`starci[ \\t]+${verb}${currentVerbSuffix}`),
      hit: (match) => ({ spelling: match[0], use, kind: 'top-level', priority: 2 }),
    });
  }
  return matchers;
}

const posix = (file) => String(file).replace(/\\/g, '/');
const isRuntimeOwned = (file) => {
  const rel = posix(file);
  if (!rel.includes('/')) return rel.endsWith('.md');
  return RUNTIME_OWNED.has(rel.split('/')[0]);
};
const isFullyExempt = (file) => {
  const rel = posix(file);
  return /(?:^|\/)CHANGELOG[^/]*\.md$/i.test(rel)
    || /^packages\/.+\/runtime\//.test(rel)
    || GENERATED_LOCKFILE.test(rel)
    || rel === 'tests/cli/retired-cli.spec.mjs'
    || rel === 'packages/cli/src/catalog.generated.mjs';
};

/** Hide only the catalog's removed field, preserving offsets and other fields. */
export function maskCatalogRemoved(text) {
  let result = String(text);
  const lines = [...result.matchAll(/.*(?:\n|$)/g)].filter((match) => match[0]);
  let blockIndent = null;
  for (const match of lines) {
    const line = match[0];
    const content = line.replace(/[\r\n]+$/, '');
    const indent = /^\s*/.exec(content)[0].length;
    const starts = /^\s*removed\s*:/.test(content);
    const continues = blockIndent !== null && (!content.trim() || indent > blockIndent);
    if (starts || continues) result = maskTextRange(result, match.index, match.index + line.length);
    if (starts) blockIndent = /:\s*$/.test(content) ? indent : null;
    else if (blockIndent !== null && content.trim() && indent <= blockIndent) blockIndent = null;
  }
  return result;
}

/** Hide the dispatcher's built-in removed-name table, not the rest of its generator. */
function maskDispatcherTable(text, file) {
  const rel = posix(file);
  if (rel !== 'scripts/cli/gen-catalog.mjs') return text;
  const start = text.indexOf('const RETIRED_BUILTINS = [');
  if (start < 0) return text;
  const end = text.indexOf('\n];', start);
  return end < 0 ? text : maskTextRange(text, start, end + 3);
}

const lineAt = (text, at) => text.slice(0, at).split('\n').length;

/** Findings in one text file. Pure; matchers come from retiredMatchers(). */
export function retiredCallsInText(text, file, matchers) {
  const rel = posix(file);
  if (isFullyExempt(rel)) return [];
  let source = String(text);
  if (rel.startsWith('modules/cli/commands/') && /\.ya?ml$/.test(rel)) source = maskCatalogRemoved(source);
  source = maskDispatcherTable(source, rel);
  const candidates = [];
  for (const matcher of matchers) {
    if (matcher.runtimeOwnedOnly && !isRuntimeOwned(rel)) continue;
    matcher.regex.lastIndex = 0;
    for (const match of source.matchAll(matcher.regex)) {
      const hit = matcher.hit(match);
      if (rel === 'scripts/kernel/cli.mjs' && hit.kind === 'kernel-script') continue;
      candidates.push({ ...hit, at: match.index, end: match.index + match[0].length });
    }
  }
  candidates.sort((a, b) => a.at - b.at || b.end - a.end || b.priority - a.priority);
  const selected = [];
  for (const candidate of candidates) {
    if (selected.some((hit) => candidate.at < hit.end && candidate.end > hit.at)) continue;
    selected.push(candidate);
  }
  const ranges = sentenceRanges(source, sentencesOf(source));
  return selected.filter((hit) => !RETIREMENT_WORD.test(sentenceTextAt(ranges, hit.at, source))).map((hit) => ({
    code: CODE,
    file: rel,
    line: lineAt(String(text), hit.at),
    spelling: hit.spelling.replace(/[ \t]+/g, ' ').trim(),
    use: hit.use,
    text: lineTextAt(String(text), hit.at),
  }));
}

/** Scan every tracked non-binary file under root. */
export function scanRetiredCli(root = DEFAULT_ROOT, { files = null, read = null, catalog = null } = {}) {
  let parsed;
  try { parsed = catalog ?? loadCatalog(root); } catch (error) { throw new RetiredCliInputError(error.message); }
  let tracked;
  try { tracked = files ?? readTrackedTextFiles(root, { listFiles: lsFiles }); } catch (error) { throw new RetiredCliInputError(error.message); }
  const matchers = retiredMatchers(parsed);
  const findings = [];
  let checked = 0;
  for (const raw of tracked) {
    const rel = posix(raw);
    if (isFullyExempt(rel)) continue;
    let value;
    try { value = read ? read(rel) : fs.readFileSync(path.join(root, ...rel.split('/'))); } catch { continue; }
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
    if (bytes.includes(0)) continue;
    checked += 1;
    findings.push(...retiredCallsInText(bytes.toString('utf8'), rel, matchers));
  }
  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.spelling.localeCompare(b.spelling));
  return { schema: 'starci/retired-cli-check@1', ok: findings.length === 0, code: findings.length ? CODE : null, files: checked, findings };
}

/** CLI entry point; io is injectable for the spec. */
export function main(argv = [], io = process, deps = {}) {
  return runTrackedTextCheckCli(argv, io, {
    command: 'check-retired-cli',
    help: HELP,
    defaultRoot: DEFAULT_ROOT,
    scan: deps.scan ?? scanRetiredCli,
    cleanText: (report) => `check-retired-cli: no retired CLI calls in ${report.files} tracked text file(s)`,
    findingText: (finding) => `  ${finding.file}:${finding.line} ${CODE}: "${finding.spelling}" was removed; use "${finding.use}"`,
    redText: (report) => `check-retired-cli: red (${report.findings.length} finding(s))`,
  });
}

if (isMain(import.meta.url)) process.exitCode = main(process.argv.slice(2));
