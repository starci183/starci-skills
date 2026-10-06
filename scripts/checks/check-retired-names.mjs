#!/usr/bin/env node
// check-retired-names.mjs — RT_RETIRED_NAME_LIVE (rule R207): a name the retired registry declares dead never appears
// in a live tracked file — not in prose, a comment, a string literal or a path. "One pattern, no legacy": the living
// text names what runs now, so a deleted name may survive only where history keeps it.
//
// The tokens come only from modules/kernel/retired-paths.yaml: every retired[].path and every moved[].from is a dead
// path (a directory row covers what is below it), and retiredNames[] declares the dead namings that are not paths (a
// deleted app, a layer naming, a verb prefix).
//
// Never scanned: history (CHANGELOG*.md, benchmark/, .starciwork/ records), the
// registry itself (it must name what it declares dead), the generated copy roots, and the two files of this check —
// like the one allowlist's own files, they carry the tokens they enforce. In the slot manifests a `forbids:` value and
// the `path:` of a `presence: forbidden` tombstone slot declare a refusal, not a use; those lines are not read.
//
// Exit 0 clean, 1 lists every live occurrence as file:line, 2 bad arguments.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkFiles } from '../lib/walk.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { gitOutputOf } from '../lib/git.mjs';
import { isMain } from '../lib/is-main.mjs';
import { parseJson } from '../lib/json.mjs';
import { readParsedFile } from '../lib/read-text.mjs';
import { byCodeUnit } from '../lib/list.mjs';
import { RETIRED_PATHS_FILE, generatedRootsOf, isHistoryPath, lineOf, runReportMain } from '../lib/check-scan.mjs';

const HELP = `Usage: check-retired-names [--root <tree>] [--json]

Refuses every retired name of modules/kernel/retired-paths.yaml (retired[].path,
moved[].from, retiredNames[].name) in a live tracked file. Exit 0 clean, 1 lists
the live occurrences, 2 is a bad argument.`;

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const RETIRED_NAME_LIVE = 'RT_RETIRED_NAME_LIVE';
/** The files of this check name the tokens they enforce. */
const SELF_FILES = new Set(['scripts/checks/check-retired-names.mjs', 'tests/checks/retired-names.spec.mjs']);
/** The slot manifests: refusal declarations there are enforcement, not use. */
const MANIFESTS = new Set(['knowledge/hfs/slots.yaml', 'knowledge/hfs/runtime-slots.yaml']);

/** The dead tokens `root`'s registry declares: [{token, kind, why}]. */
export function retiredNameTokens(root = DEFAULT_ROOT) {
  const file = path.join(root, RETIRED_PATHS_FILE);
  const doc = fs.existsSync(file) ? (parseYaml(fs.readFileSync(file, 'utf8')) ?? {}) : {};
  const tokens = [];
  for (const r of doc.retired ?? []) if (r?.path) tokens.push({ token: String(r.path), kind: 'retired path', why: r.replacedBy ? `replaced by ${r.replacedBy}` : 'retired' });
  for (const m of doc.moved ?? []) if (m?.from) tokens.push({ token: String(m.from), kind: 'moved path', why: `moved to ${m.to}`, to: String(m.to ?? '') });
  for (const n of doc.retiredNames ?? []) if (n?.name) tokens.push({ token: String(n.name), kind: 'retired name', why: n.note ?? 'a retired name' });
  return tokens;
}

/**
 * A slot manifest's refusal declarations are not uses: blank every `forbids:` value and the `path:` value of a
 * `presence: forbidden` slot (a tombstone exists to refuse the name it lists). Line count is kept.
 */
const blankRefusals = (text) => {
  const lines = text.split('\n');
  let start = null;
  const blocks = [];
  for (let i = 0; i <= lines.length; i += 1) {
    if (i === lines.length || /^\s*-\s*(?:id\s*:|{\s*id\s*:)/.test(lines[i])) {
      if (start !== null) blocks.push([start, i]);
      start = i;
    }
  }
  for (const [a, b] of blocks) {
    if (!lines.slice(a, b).some((l) => /^\s*presence\s*:\s*forbidden\b/.test(l))) continue;
    for (let i = a; i < b; i += 1) if (/^\s*path\s*:/.test(lines[i])) lines[i] = lines[i].replace(/:.*/, ':');
  }
  return lines.map((line) => (/^\s*forbids\s*:/.test(line) ? line.replace(/:.*/, ':') : line)).join('\n');
};

/** The live tracked files of `root`: git ls-files, or the filesystem under a tree that is not a Git work tree (a spec fixture). */
export function retiredNameScan(root = DEFAULT_ROOT) {
  const generated = generatedRootsOf(root);
  const scoped = (rel) => !isHistoryPath(rel) && !SELF_FILES.has(rel) && !generated.some((g) => rel.startsWith(g));
  try {
  return gitOutputOf(lsFiles(['-z'], { dir: root, maxBuffer: 256 * 1024 * 1024 }), 'git ls-files').split('\0').filter(Boolean).map((f) => f.replaceAll('\\', '/')).filter((rel) => scoped(rel) && fs.existsSync(path.join(root, rel))).sort(byCodeUnit);
  } catch {
    return walkFiles(root, { sorted: true, exclude: (name) => name === '.git' || name === 'node_modules' }).map((f) => path.relative(root, f).replaceAll('\\', '/')).filter(scoped);
  }
}

const packageRelative = (value) => {
  if (typeof value !== 'string' || /[\\\x00-\x1f\x7f]/.test(value)) return null;
  const relative = value.startsWith('./') ? value.slice(2) : value;
  return relative && !/^[A-Za-z]:/.test(relative) && relative.split('/').every((part) => part && part !== '.' && part !== '..') ? relative : null;
};

const movedBinOwner = (root, token) => {
  if (token.kind !== 'moved path' || packageRelative(token.to) !== token.to || packageRelative(token.token) !== token.token) return null;
  for (let directory = path.posix.dirname(token.to); directory !== '.'; directory = path.posix.dirname(directory)) {
    const file = path.join(root, directory, 'package.json');
    if (!fs.existsSync(file)) continue;
    const manifest = readParsedFile(file, (text) => {
      const parsed = JSON.parse(text);
      jsonStringSpans(text);
      return parsed;
    });
    if (typeof manifest?.name !== 'string') return null;
    const relative = token.to.slice(directory.length + 1);
    if (relative !== token.token) return null;
    const bins = typeof manifest.bin === 'string' ? { [manifest.name.split('/').at(-1)]: manifest.bin } : manifest.bin;
    if (!bins || typeof bins !== 'object' || Array.isArray(bins)) return null;
    const commands = Object.entries(bins).filter(([, value]) => packageRelative(value) === relative).map(([name]) => name);
    return commands.length ? { name: manifest.name, relative, commands } : null;
  }
  return null;
};

// A JSON atom: a number, sticky so it is only matched at the scan cursor.
const JSON_NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const JSON_LITERALS = ['true', 'false', 'null'];
const JSON_STRUCTURAL = new Set(['{', '[', ']', '}', ',', ':']);
const JSON_STRING_LINE_TERMINATORS = new Set(['\n', '\r', '\u2028', '\u2029']);

/**
 * The JSON lexemes of `text`, in order and with their offsets — the same lexeme stream the one
 * tokenizer regex produced (a quoted string, a structural char, a number or a literal), scanned
 * one position at a time; a position matching no alternative is skipped, as matchAll skipped it.
 */
const jsonLexemes = (text) => {
  const lexemes = [];
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (JSON_STRUCTURAL.has(c)) { lexemes.push({ 0: c, index: i }); continue; }
    if (c === '"') {
      let end = i + 1;
      let complete = false;
      while (end < text.length) {
        if (text[end] === '"') { complete = true; break; }
        if (text[end] === '\\') {
          if (end + 1 >= text.length || JSON_STRING_LINE_TERMINATORS.has(text[end + 1])) break;
          end += 2;
        } else end += 1;
      }
      if (complete) { lexemes.push({ 0: text.slice(i, end + 1), index: i }); i = end; }
      continue;
    }
    JSON_NUMBER.lastIndex = i;
    const number = JSON_NUMBER.exec(text);
    if (number) { lexemes.push({ 0: number[0], index: i }); i += number[0].length - 1; continue; }
    const literal = JSON_LITERALS.find((l) => text.startsWith(l, i));
    if (literal) { lexemes.push({ 0: literal, index: i }); i += literal.length - 1; }
  }
  return lexemes;
};

// String spans retain the original file:line and distinguish metadata values from identical prose or keys.
const jsonStringSpans = (text) => {
  const lexemes = jsonLexemes(text);
  const strings = [];
  let cursor = 0;
  const objectValue = (keys) => {
    const seen = new Set();
    while (lexemes[cursor][0] !== '}') {
      const key = parseJson(lexemes[cursor++][0]);
      if (seen.has(key)) throw new Error('Duplicate JSON key');
      seen.add(key);
      cursor += 1;
      value([...keys, key]);
      if (lexemes[cursor][0] !== ',') break;
      cursor += 1;
    }
    cursor += 1;
  };
  const arrayValue = (keys) => {
    let index = 0;
    while (lexemes[cursor][0] !== ']') {
      value([...keys, index++]);
      if (lexemes[cursor][0] !== ',') break;
      cursor += 1;
    }
    cursor += 1;
  };
  const value = (keys) => {
    const item = lexemes[cursor++];
    if (item[0] === '{') objectValue(keys);
    else if (item[0] === '[') arrayValue(keys);
    else if (item[0].startsWith('"')) strings.push({ keys, value: parseJson(item[0]), start: item.index + 1, end: item.index + item[0].length - 1 });
  };
  value([]);
  return strings;
};

const dependencyBinSpans = (root, rel, text, tokens) => {
  if (path.posix.basename(rel) !== 'package-lock.json') return [];
  const lock = parseJson(text);
  if (![2, 3].includes(lock?.lockfileVersion) || !lock.packages || typeof lock.packages !== 'object' || Array.isArray(lock.packages)) return [];
  let strings;
  try { strings = jsonStringSpans(text); } catch { return []; } // Ambiguous metadata keeps the raw scan.
  const spans = [];
  const owners = new Map();
  for (const span of strings) {
    if (span.keys.length !== 4 || span.keys[0] !== 'packages' || span.keys[2] !== 'bin') continue;
    const [, packageKey, , command] = span.keys;
    const dependency = packageKey.match(/^(?:node_modules\/(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+\/)*node_modules\/((?:@[a-z0-9._-]+\/)?[a-z0-9._-]+)$/)?.[1];
    const entry = lock.packages[packageKey];
    if (!dependency || entry?.link === true || typeof entry?.version !== 'string' || !entry.version.trim() || (entry.name !== undefined && entry.name !== dependency)) continue;
    movedTokenSpans(root, span, command, dependency, tokens, owners, spans);
  }
  return spans;
};

/** The spans of one bin value that carry a moved-path token owned by `dependency`. */
const movedTokenSpans = (root, span, command, dependency, tokens, owners, spans) => {
  for (const token of tokens) {
    if (token.kind !== 'moved path' || !span.value.includes(token.token)) continue;
    if (!owners.has(token)) owners.set(token, movedBinOwner(root, token));
    const owner = owners.get(token);
    if (owner?.name === dependency && owner.commands.includes(command) && packageRelative(span.value) === owner.relative) spans.push({ ...span, token, owner });
  }
};

/** The occurrences of `tokens` in one file's text: [{file, line, token, kind, why}]. */
const textDead = (rel, text, tokens, dependencyBins) => {
  const dead = [];
  for (const t of tokens) {
    // A moved path that is the tail of its own destination (bin/starci.mjs -> packages/cli/bin/starci.mjs) is not a use of the old path.
    const prefix = t.to?.endsWith(t.token) ? t.to.slice(0, t.to.length - t.token.length) : '';
    let at = text.indexOf(t.token);
    while (at !== -1) {
      // ...nor is a file inside the destination directory naming it relative to itself (packages/cli/package.json: ./bin/starci.mjs).
      if (prefix && (rel.startsWith(prefix) || text.slice(Math.max(0, at - prefix.length), at) === prefix)) { at = text.indexOf(t.token, at + t.token.length); continue; }
      if (t.kind === 'moved path' && dependencyBins.some((span) => span.token === t && at >= span.start && at + t.token.length <= span.end)) { at = text.indexOf(t.token, at + t.token.length); continue; }
      dead.push({ file: rel, line: lineOf(text, at), token: t.token, kind: t.kind, why: t.why });
      at = text.indexOf(t.token, at + t.token.length);
    }
  }
  return dead;
};

/** The live occurrences of `tokens` under `root`: [{file, line, token, kind, why}]. */
export function checkRetiredNames(root = DEFAULT_ROOT, tokens = retiredNameTokens(root)) {
  const dead = [];
  for (const rel of retiredNameScan(root)) {
    // A file whose own path names a dead naming is a live occurrence.
    for (const t of tokens.filter((tk) => tk.kind === 'retired name' && rel.includes(tk.token))) {
      dead.push({ file: rel, line: 0, token: t.token, kind: t.kind, why: `the path itself names it — ${t.why}` });
    }
    const buffer = fs.readFileSync(path.join(root, rel));
    if (buffer.includes(0)) continue;
    const text = MANIFESTS.has(rel) ? blankRefusals(buffer.toString('utf8')) : buffer.toString('utf8');
    dead.push(...textDead(rel, text, tokens, dependencyBinSpans(root, rel, text, tokens)));
  }
  return { schema: 'starci/retired-names@1', ok: dead.length === 0, filesScanned: retiredNameScan(root).length, dead };
}

/** RT_RETIRED_NAME_LIVE findings of the runtime's live tracked files under `root`. */
export function retiredNameFindings(root = DEFAULT_ROOT) {
  return checkRetiredNames(root).dead.map((d) => ({
    code: RETIRED_NAME_LIVE, level: 'error', path: d.file, line: d.line || undefined,
    message: `${d.line ? `${d.file}:${d.line}` : d.file} names ${d.token} (${d.kind}: ${d.why}): a live file names what the registry declares dead`,
  }));
}

export const checkRetiredNamesMain = (argv) => runReportMain(argv, {
  name: 'check-retired-names', help: HELP, root: DEFAULT_ROOT, scan: checkRetiredNames,
  describe: (report) => ({
    okText: `check-retired-names: no retired name in ${report.filesScanned} live tracked files`,
    headline: `check-retired-names: ${report.dead.length} live occurrence(s) of a retired name`,
    rows: report.dead.map((entry) => `  ${entry.line ? `${entry.file}:${entry.line}` : entry.file}  ${entry.token} — ${entry.kind}: ${entry.why}`),
  }),
});

if (isMain(import.meta.url)) {
  const result = checkRetiredNamesMain(process.argv.slice(2));
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
}
