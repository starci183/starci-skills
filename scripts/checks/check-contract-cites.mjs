#!/usr/bin/env node
// check-contract-cites.mjs — live prose and source comments may only cite what exists.
// Walks the scan set (default: modules/{kernel,goal,ops}) and resolves every reference against the tree:
//
//   * .md/.yaml/.yml files, read whole: a repo-relative path ending .mjs/.yaml/.yml/.md/.sql, either inside
//     backticks anywhere in the file or bare inside a citation:/enforcedBy:/
//     source:/sources: value
//   * .mjs/.cjs/.js/.ts/.tsx files, comments only (a string literal is data, not prose)
//   * `file::symbol` and "`symbol()` in <file>" — the symbol string must
//     appear in that file
//
// A `{a,b}` group expands; a `*` glob, an `<angle>` placeholder or a
// .starciwork/ runtime path is unverifiable and is skipped by name.
//
// Live prose and source comments name current owners.
//
// RT_CITED_PATH_MISSING (rule R122, gate runtime): citedPathFindings() runs the same reading over every tracked
// .md/.yaml/.yml file and the comments of every tracked source file outside history (runtimeCiteScan; history is
// CHANGELOG*.md and benchmark/, and generated copy roots are
// never read) and returns each dead cite as a finding; `starci runtime check` judges it
// with the runtime check. A token whose top-level segment is not in this tree is skipped, so product-repository
// paths (src/..., apps/...) in knowledge text name no cite of this tree.
// Exit 0 clean, 1 lists every dead cite as file:line, 2 bad arguments.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { parseYaml } from '../../engine/yaml.mjs';
import { walkFiles } from '../lib/walk.mjs';
import { generatedRootsOf, isHistoryPath } from '../lib/check-scan.mjs';
import { ts } from '../hfs/runtime-rules/source-ast.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { gitOutputOf } from '../lib/git.mjs';
import { byCodeUnit } from '../lib/list.mjs';
import { checkReportResult } from '../lib/check-cli.mjs';
import { isMain } from '../lib/is-main.mjs';
import { trimTrailingChars } from '../lib/normalize.mjs';

const HELP = `Usage: starci runtime check --only contract-cites -- [--root <tree>] [--scan <rel-path> ...] [--json]

Verifies every cited file and symbol under modules/kernel/, modules/goal/ and
modules/ops/ exists. Exit 0 clean, 1 lists the dead cites, 2 is a bad argument.`;

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_SCAN = ['modules/kernel', 'modules/goal', 'modules/ops'];
const EXTENSIONS = 'mjs|yaml|yml|md|sql';
const CITE_KEYS = /^\s*(?:-\s*)?(?:citation|enforcedBy|source|sources)\s*:/;
const PATH_TOKEN = new RegExp(String.raw`\.?[A-Za-z0-9_][A-Za-z0-9_@./{},<>*+-]*\.(?:${EXTENSIONS})(?:\.tpl)?\b`, 'g');
const BACKTICKED = /`([^`\n]+)`/g;
const SYMBOL_CITE = new RegExp(String.raw`([A-Za-z0-9_][A-Za-z0-9_./-]*\.(?:${EXTENSIONS}))::([A-Za-z0-9_.$-]+)`, 'g');
const SYMBOL_IN_FILE = new RegExp(String.raw`\x60([\w.$]+)\(\)\x60\s+in\s+(\w[\w./-]*\.(?:${EXTENSIONS}))`, 'g');

class CiteInputError extends Error {}

const SOURCE_EXT = /\.(?:mjs|cjs|js|mts|cts|ts|tsx|jsx)$/;
const CITE_EXT = /\.(?:ya?ml|md|mjs|cjs|js|mts|cts|ts|tsx|jsx)$/;
/** The slot manifests: a `path:`/`requires:`/`allows:`/`forbids:`/`roles:` value there declares a slot's shape (judged by the HFS engine, incl. forbidden tombstones and product-repo paths), never cites this tree. */
const MANIFEST_SLOTS = new Set(['knowledge/hfs/slots.yaml', 'knowledge/hfs/runtime-slots.yaml']);
/** Blank every shape value of a slot manifest: declarations, not prose cites. Line count is kept. */
const dropSlotPathValues = (text) => text.split('\n').map((line) => (/^\s*(?:path|requires|allows|forbids|roles)\s*:/.test(line) ? line.replace(/:.*/, ':') : line)).join('\n');
/** Blank the content between `<!-- hfs:generated -->` / `<!-- hfs:generated-end -->` markers: a generated block is a byte copy of a declaration the source file already makes (R194). Line count is kept. */
const dropGeneratedBlocks = (text) => {
  let inside = false;
  return text.split('\n').map((line) => {
    if (/<!--\s*hfs:generated\b/.test(line)) { inside = true; return ''; }
    if (/<!--\s*hfs:generated-end\b/.test(line)) { inside = false; return ''; }
    return inside ? '' : line;
  }).join('\n');
};

const YAML_IGNORE_HEADER = /^ignore[ \t]*:[ \t]*(?:#.*)?\r?$/;
const YAML_IGNORE_PATTERN = /^[A-Za-z0-9_@./{},*?+!-]+$/;

/** A parsed top-level ignore string sequence is the authority for locating its source scalars. */
function yamlIgnoreDocument(text) {
  let doc;
  try { doc = parseYaml(text); } catch { return null; }
  if (!doc || typeof doc !== 'object' || !Object.hasOwn(doc, 'ignore')
    || !Array.isArray(doc.ignore) || !doc.ignore.length || !doc.ignore.every(value => typeof value === 'string')) return null;
  return doc;
}

/** Find a one-line quoted scalar's end in one pass, respecting double-quote escapes and doubled single quotes. */
function yamlQuotedScalarEnd(line, start) {
  const quote = line[start];
  for (let index = start + 1; index < line.length; index += 1) {
    const char = line[index];
    if (quote === '"' && char === '\\') { index += 1; continue; }
    if (char !== quote) continue;
    if (quote === "'" && line[index + 1] === "'") { index += 1; continue; }
    return index + 1;
  }
  return null;
}

const yamlHorizontalSpace = char => char === ' ' || char === '\t';

/** Locate one simple sequence scalar without consuming its trailing comment or line ending. */
function yamlSequenceScalar(line) {
  const indent = line.search(/\S/);
  if (indent < 0 || line[indent] !== '-' || !yamlHorizontalSpace(line[indent + 1])) return null;
  let start = indent + 1;
  while (yamlHorizontalSpace(line[start])) start += 1;
  const quote = line[start];
  let end;
  if (quote === '"' || quote === "'") end = yamlQuotedScalarEnd(line, start);
  else {
    const comment = line.indexOf('#', start);
    end = start + line.slice(start, comment < 0 ? line.length : comment).trimEnd().length;
  }
  if (end === null || end === start) return null;
  const tail = line.slice(end).trimStart();
  if (tail && !tail.startsWith('#')) return null;
  return { indent, prefix: line.slice(0, start), value: line.slice(start, end), suffix: line.slice(end) };
}

/** Locate only a consistently indented block sequence of the parsed array's exact length. */
function yamlIgnoreScalars(lines, header, count) {
  const scalars = [];
  let itemIndent = null;
  for (let index = header + 1; index < lines.length && scalars.length < count; index += 1) {
    const trimmed = lines[index].trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const scalar = yamlSequenceScalar(lines[index]);
    if (!scalar) return null;
    if (itemIndent !== null && scalar.indent !== itemIndent) return null;
    itemIndent = scalar.indent;
    scalars.push({ index, ...scalar });
  }
  return scalars.length === count ? scalars : null;
}

/** The located ranges must belong only to top-level ignore, including when surrounding YAML contains multiline scalars. */
function ownsYamlIgnoreScalars(lines, doc, scalars) {
  const probe = [...lines];
  for (const scalar of scalars) probe[scalar.index] = `${scalar.prefix}null${scalar.suffix}`;
  let parsedProbe;
  try { parsedProbe = parseYaml(probe.join('\n')); } catch { return false; }
  return isDeepStrictEqual(parsedProbe, { ...doc, ignore: doc.ignore.map(() => null) });
}

/** Top-level YAML ignore sequences contain exclusion patterns, not citations. Unsupported shapes retain the original scan; comments and line positions stay intact. */
function dropYamlIgnorePatterns(text) {
  const lines = text.split('\n');
  const headers = lines.flatMap((line, index) => YAML_IGNORE_HEADER.test(line) ? [index] : []);
  if (headers.length !== 1) return text;
  const doc = yamlIgnoreDocument(text);
  if (!doc) return text;
  const scalars = yamlIgnoreScalars(lines, headers[0], doc.ignore.length);
  if (!scalars || !ownsYamlIgnoreScalars(lines, doc, scalars)) return text;

  for (const [index, scalar] of scalars.entries()) {
    if (YAML_IGNORE_PATTERN.test(doc.ignore[index]))
      lines[scalar.index] = `${scalar.prefix}${' '.repeat(scalar.value.length)}${scalar.suffix}`;
  }
  return lines.join('\n');
}

const expandBraces = (token) => {
  const open = token.indexOf('{');
  if (open < 0) return [token];
  const close = token.indexOf('}', open);
  if (close < 0) return [token];
  const head = token.slice(0, open), tail = token.slice(close + 1);
  return token.slice(open + 1, close).split(',')
    .flatMap((part) => expandBraces(`${head}${part.trim()}${tail}`));
};

/** A token the tree cannot decide: a glob, a placeholder, or runtime state. */
const isUnverifiable = (token) => token.includes('*') || token.includes('<') || token.includes('>')
  || (/(^|\/)\.starci[a-z]*\//.test(token) && !/(^|\/)\.starci\/host\//.test(token))
  || token.includes('node_modules/');

/** `.claude/x` is how an installed tree spells the runtime root this check walks. */
const detemplate = (token) => token.replace(/^\.claude\//, '');

const citeFilesUnder = (dir) => walkFiles(dir, {sorted: true, filter: name => CITE_EXT.test(name), exclude: name => name === 'node_modules'});

function collectScanFiles(root, scan = DEFAULT_SCAN) {
  const files = [];
  for (const rel of scan) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) throw new CiteInputError(`nothing to scan at ${rel}`);
    if (fs.statSync(full).isDirectory()) files.push(...citeFilesUnder(full));
    else files.push(full);
  }
  return [...new Set(files)];
}

/** The comments of one source file re-laid on their own lines (everything else blank), so a cite keeps its real line number. */
function commentsAsText(file, text) {
  const t = ts();
  let kind = t.ScriptKind.JS;
  if (/\.ts$/i.test(file)) kind = t.ScriptKind.TS;
  if (/\.tsx$/i.test(file)) kind = t.ScriptKind.TSX;
  if (/\.jsx$/i.test(file)) kind = t.ScriptKind.JSX;
  const source = t.createSourceFile(file, String(text), t.ScriptTarget.Latest, true, kind);
  const ranges = new Map();
  const collect = (node) => {
    for (const range of t.getLeadingCommentRanges(text, node.getFullStart()) ?? []) ranges.set(range.pos, range);
    for (const range of t.getTrailingCommentRanges(text, node.getEnd()) ?? []) ranges.set(range.pos, range);
    t.forEachChild(node, collect);
  };
  collect(source);
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) if (text.codePointAt(i) === 10) starts.push(i + 1);
  const lineOfPos = (pos) => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= pos) lo = mid; else hi = mid - 1; } return lo; };
  const lines = [];
  for (const range of [...ranges.values()].sort((a, b) => a.pos - b.pos)) {
    const first = lineOfPos(range.pos);
    text.slice(range.pos, range.end).split('\n').forEach((part, i) => {
      lines[first + i] = lines[first + i] ? `${lines[first + i]} ${part}` : part;
    });
  }
  return lines.join('\n');
}

const CITE_TRAILING_CHAR = /[.,;)]/;

/** Every path and symbol reference one contract file makes, with line numbers. */
function citesIn(text) {
  const cites = [];
  const lines = text.split('\n');
  const addPath = (line, token, form) => {
    for (const raw of expandBraces(token)) {
      const candidate = detemplate(trimTrailingChars(raw, CITE_TRAILING_CHAR));
      if (isUnverifiable(candidate)) continue;
      if (!candidate.includes('/')) {
        // A citation key names one authority, so a bare filename there is
        // dead. In running prose a bare filename is ordinary vocabulary.
        if (form === 'cite value') cites.push({ line, kind: 'bare', target: candidate, form });
        continue;
      }
      cites.push({ line, kind: 'path', target: candidate, form });
    }
  };
  let inCite = false;
  let citeIndent = 0;
  // `{skillRoot}/x` and friends are the tree root spelled for a prompt.
  const untemplate = (line) => line.replace(/\{[A-Za-z_]\w*\}\//g, '');
  lines.forEach((source, index) => {
    const raw = untemplate(source);
    const line = index + 1;
    const indent = raw.length - raw.trimStart().length;
    if (CITE_KEYS.test(raw)) { inCite = true; citeIndent = indent; }
    else if (inCite && raw.trim() && indent <= citeIndent) inCite = false;

    for (const m of raw.matchAll(SYMBOL_CITE)) {
      cites.push({ line, kind: 'symbol', target: m[1], symbol: m[2], form: 'file::symbol' });
    }
    for (const m of raw.matchAll(SYMBOL_IN_FILE)) {
      cites.push({ line, kind: 'symbol', target: m[2], symbol: m[1], form: '`symbol()` in file' });
    }
    for (const m of raw.matchAll(BACKTICKED)) {
      for (const token of m[1].matchAll(PATH_TOKEN)) addPath(line, token[0], 'backticked path');
    }
    const stripped = raw.replace(BACKTICKED, ' ');
    for (const token of stripped.matchAll(PATH_TOKEN)) {
      const [first] = expandBraces(token[0]);
      // Outside a cite key only a rooted path is a reference; a bare
      // filename in running prose is ordinary vocabulary.
      if (!inCite && !first.includes('/')) continue;
      addPath(line, token[0], inCite ? 'cite value' : 'prose path');
    }
  });
  return cites;
}

/** False when the cite is not one of this tree (skipped), true once it is judged (a dead one is pushed to `dead`). */
/** The skill's own reference files are cited as `references/<file>.md`; they live under the skill folder. */
const skillRooted = (cite) => (cite.target.startsWith('references/') ? { ...cite, target: `skills/starci/${cite.target}` } : cite);

const judgeCite = (root, rawCite, rel, readTarget, dead) => {
  const cite = skillRooted(rawCite);
  // Outside a cite key, only a token rooted at a real top-level entry is
  // a reference to this tree; `evidence/manifest.yaml` names a record artifact.
  if (cite.kind === 'path' && cite.form !== 'cite value'
    && !fs.existsSync(path.join(root, cite.target.split('/')[0]))) return false;
  if (cite.kind === 'bare') {
    dead.push({ file: rel, line: cite.line, form: cite.form, target: cite.target, why: 'bare filename — a cite names a repo-relative path' });
    return true;
  }
  let body = readTarget(path.join(root, cite.target));
  // A markdown-style cite is also legal relative to the citing file (a package README's `docs/x.md`,
  // a knowledge index's `ui/index.yaml`); the repo-root reading wins.
  if (body === null) body = readTarget(path.join(root, path.posix.join(path.posix.dirname(rel), cite.target)));
  if (body === null) { dead.push({ file: rel, line: cite.line, form: cite.form, target: cite.target, why: 'no such file' }); return true; }
  if (cite.kind === 'symbol' && !body.includes(cite.symbol)) {
    dead.push({ file: rel, line: cite.line, form: cite.form, target: cite.target, symbol: cite.symbol, why: 'symbol not in file' });
  }
  return true;
};

const citesCheckedIn = (root, rel, prose, readTarget, dead) => {
  const seen = new Set();
  let checked = 0;
  for (const cite of citesIn(dropGeneratedBlocks(prose))) {
    const key = `${cite.line}:${cite.kind}:${cite.target}:${cite.symbol ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!judgeCite(root, cite, rel, readTarget, dead)) continue;
    checked += 1;
  }
  return checked;
};

function checkContractCites(root = DEFAULT_ROOT, scan = DEFAULT_SCAN) {
  const dead = [];
  const contents = new Map();
  const readTarget = (abs) => {
    if (!contents.has(abs)) contents.set(abs, fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null);
    return contents.get(abs);
  };
  const files = collectScanFiles(root, scan);
  let checked = 0;
  for (const file of files) {
    const rel = path.relative(root, file).replaceAll('\\', '/');
    const text = fs.readFileSync(file, 'utf8');
    let prose = SOURCE_EXT.test(rel) ? commentsAsText(rel, text) : text;
    if (/\.ya?ml$/.test(rel)) prose = dropYamlIgnorePatterns(prose);
    if (MANIFEST_SLOTS.has(rel)) prose = dropSlotPathValues(prose);
    checked += citesCheckedIn(root, rel, prose, readTarget, dead);
  }
  return { schema: 'starci/contract-cites@1', ok: dead.length === 0, filesScanned: files.length, citesChecked: checked, dead };
}

const CITED_PATH_MISSING = 'RT_CITED_PATH_MISSING';

const NOT_TRACKED_DIRS = new Set(['.git', 'node_modules', '.starciwork', 'dist']);

/**
 * The scan of rule R122 under `root`: every tracked file the reader may cite through — a .md/.yaml/.yml read whole,
 * a source file read through its comments — outside history (SCAN_HISTORY) and the generated copy roots. Tracked means
 * git ls-files; a tree that is not a Git work tree falls back to the filesystem (a spec fixture).
 */
function runtimeCiteScan(root = DEFAULT_ROOT) {
  const generated = generatedRootsOf(root);
  const scoped = (rel) => CITE_EXT.test(rel) && !isHistoryPath(rel) && !generated.some((g) => rel.startsWith(g));
  try {
    return gitOutputOf(lsFiles(['-z'], { dir: root, maxBuffer: 256 * 1024 * 1024 }), 'git ls-files').split('\0').filter(Boolean).map((f) => f.replaceAll('\\', '/')).filter((rel) => scoped(rel) && fs.existsSync(path.join(root, rel))).sort(byCodeUnit);
  } catch {
    return walkFiles(root, { sorted: true, exclude: (name) => NOT_TRACKED_DIRS.has(name) }).map((f) => path.relative(root, f).replaceAll('\\', '/')).filter(scoped);
  }
}

/** RT_CITED_PATH_MISSING findings of the runtime's live prose under `root`. */
export function citedPathFindings(root = DEFAULT_ROOT) {
  return checkContractCites(root, runtimeCiteScan(root)).dead.map((d) => ({
    code: CITED_PATH_MISSING, level: 'error', path: d.file, line: d.line,
    message: `${d.file}:${d.line} cites ${d.target}${d.symbol ? '::' + d.symbol : ''}: ${d.why} (${d.form})`,
  }));
}

const citeMainText = (report) => {
  if (report.ok) return { exitCode: 0, text: `check-contract-cites: ${report.citesChecked} cites in ${report.filesScanned} files all resolve\n` };
  const lines = [`check-contract-cites: ${report.dead.length} dead cite(s) of ${report.citesChecked} checked`];
  for (const entry of report.dead) {
    lines.push(`  ${entry.file}:${entry.line}  ${entry.target}${entry.symbol ? '::' + entry.symbol : ''} — ${entry.why} (${entry.form})`);
  }
  return { exitCode: 1, text: `${lines.join('\n')}\n` };
};

function checkContractCitesMain(argv) {
  let root = DEFAULT_ROOT, json = false;
  const scan = [];
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const takesValue = key === '--root' || key === '--scan';
    if (takesValue) i += 1;
    if (key === '--help' || key === '-h') return { exitCode: 0, text: `${HELP}\n` };
    if (key === '--json') { json = true; continue; }
    if (takesValue && argv[i] === undefined) return { exitCode: 2, text: `check-contract-cites: ${key} needs a value\n` };
    if (key === '--root') { root = path.resolve(argv[i]); continue; }
    if (key === '--scan') { scan.push(argv[i]); continue; }
    return { exitCode: 2, text: `check-contract-cites: unknown argument ${key}\n${HELP}\n` };
  }
  return checkReportResult(json, CiteInputError, 'check-contract-cites', () => checkContractCites(root, scan.length ? scan : DEFAULT_SCAN), citeMainText);
}

if (isMain(import.meta.url)) {
  const result = checkContractCitesMain(process.argv.slice(2));
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
}
