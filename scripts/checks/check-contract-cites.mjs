#!/usr/bin/env node
// check-contract-cites.mjs — a kernel contract may only cite what exists.
// Walks modules/{kernel,goal,ops}/**/*.yaml plus modules/kernel/kernel-prompt.md
// and resolves every reference against the tree:
//
//   * a repo-relative path ending .mjs/.yaml/.yml/.md/.sql, either inside
//     backticks anywhere in the file or bare inside a citation:/enforcedBy:/
//     source:/sources: value
//   * `file::symbol` and "`symbol()` in <file>" — the symbol string must
//     appear in that file
//
// A `{a,b}` group expands; a `*` glob, an `<angle>` placeholder or a
// .starciwork/ runtime path is unverifiable and is skipped by name.
// Exit 0 clean, 1 lists every dead cite as file:line, 2 bad arguments.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HELP = `Usage: node scripts/checks/check-contract-cites.mjs [--root <tree>] [--scan <rel-path> ...] [--json]

Verifies every cited file and symbol under modules/kernel/, modules/goal/ and
modules/ops/ exists. Exit 0 clean, 1 lists the dead cites, 2 is a bad argument.`;

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_SCAN = ['modules/kernel', 'modules/goal', 'modules/ops'];
const EXTENSIONS = 'mjs|yaml|yml|md|sql';
const CITE_KEYS = /^\s*(?:-\s*)?(?:citation|enforcedBy|source|sources)\s*:/;
const PATH_TOKEN = new RegExp(`\\.?[A-Za-z0-9_][A-Za-z0-9_@./{},<>*+-]*\\.(?:${EXTENSIONS})\\b`, 'g');
const BACKTICKED = new RegExp('`([^`\\n]+)`', 'g');
const SYMBOL_CITE = new RegExp(`([A-Za-z0-9_][A-Za-z0-9_./-]*\\.(?:${EXTENSIONS}))::([A-Za-z0-9_.$-]+)`, 'g');
const SYMBOL_IN_FILE = new RegExp('`([A-Za-z0-9_.$]+)\\(\\)`\\s+in\\s+([A-Za-z0-9_][A-Za-z0-9_./-]*\\.(?:' + EXTENSIONS + '))', 'g');

class CiteInputError extends Error {}

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
export const isUnverifiable = (token) => token.includes('*') || token.includes('<') || token.includes('>')
  || /(^|\/)\.starci[a-z]*\//.test(token) || token.includes('node_modules/');

/** `.claude/x` is how an installed tree spells the runtime root this check walks. */
const detemplate = (token) => token.replace(/^\.claude\//, '');

const yamlFilesUnder = (dir) => {
  const out = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (/\.(?:yaml|yml|md)$/.test(entry.name)) out.push(full);
    }
  };
  walk(dir);
  return out;
};

export function collectScanFiles(root, scan = DEFAULT_SCAN) {
  const files = [];
  for (const rel of scan) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) throw new CiteInputError(`nothing to scan at ${rel}`);
    if (fs.statSync(full).isDirectory()) files.push(...yamlFilesUnder(full));
    else files.push(full);
  }
  return [...new Set(files)];
}

/** Every path and symbol reference one contract file makes, with line numbers. */
export function citesIn(text) {
  const cites = [];
  const lines = text.split('\n');
  const addPath = (line, token, form) => {
    for (const raw of expandBraces(token)) {
      const candidate = detemplate(raw.replace(/[.,;)]+$/, ''));
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
  const untemplate = (line) => line.replace(/\{[A-Za-z_][A-Za-z0-9_]*\}\//g, '');
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

export function checkContractCites(root = DEFAULT_ROOT, scan = DEFAULT_SCAN) {
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
    const seen = new Set();
    for (const cite of citesIn(fs.readFileSync(file, 'utf8'))) {
      const key = `${cite.line}:${cite.kind}:${cite.target}:${cite.symbol ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // Outside a cite key, only a token rooted at a real top-level entry is
      // a reference to this tree; `E/manifest.yaml` names a record artifact.
      // A cite key must name a repo-relative path; elsewhere only a token
      // rooted at a real top-level entry refers to this tree (`E/manifest.yaml`
      // names a record artifact, not a file here).
      if (cite.kind === 'path' && cite.form !== 'cite value'
        && !fs.existsSync(path.join(root, cite.target.split('/')[0]))) continue;
      checked += 1;
      if (cite.kind === 'bare') {
        dead.push({ file: rel, line: cite.line, form: cite.form, target: cite.target, why: 'bare filename — a cite names a repo-relative path' });
        continue;
      }
      const body = readTarget(path.join(root, cite.target));
      if (body === null) { dead.push({ file: rel, line: cite.line, form: cite.form, target: cite.target, why: 'no such file' }); continue; }
      if (cite.kind === 'symbol' && !body.includes(cite.symbol)) {
        dead.push({ file: rel, line: cite.line, form: cite.form, target: cite.target, symbol: cite.symbol, why: 'symbol not in file' });
      }
    }
  }
  return { schema: 'starci/contract-cites@1', ok: dead.length === 0, filesScanned: files.length, citesChecked: checked, dead };
}

export function checkContractCitesMain(argv) {
  let root = DEFAULT_ROOT, json = false;
  const scan = [];
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--help' || key === '-h') return { exitCode: 0, text: `${HELP}\n` };
    if (key === '--json') { json = true; continue; }
    if (key === '--root' || key === '--scan') {
      const value = argv[++i];
      if (value === undefined) return { exitCode: 2, text: `check-contract-cites: ${key} needs a value\n` };
      if (key === '--root') root = path.resolve(value); else scan.push(value);
      continue;
    }
    return { exitCode: 2, text: `check-contract-cites: unknown argument ${key}\n${HELP}\n` };
  }
  let report;
  try {
    report = checkContractCites(root, scan.length ? scan : DEFAULT_SCAN);
  } catch (error) {
    if (error instanceof CiteInputError) return { exitCode: 2, text: `check-contract-cites: ${error.message}\n` };
    throw error;
  }
  if (json) return { exitCode: report.ok ? 0 : 1, text: `${JSON.stringify(report, null, 2)}\n` };
  if (report.ok) return { exitCode: 0, text: `check-contract-cites: ${report.citesChecked} cites in ${report.filesScanned} files all resolve\n` };
  const lines = [`check-contract-cites: ${report.dead.length} dead cite(s) of ${report.citesChecked} checked`];
  for (const entry of report.dead) {
    lines.push(`  ${entry.file}:${entry.line}  ${entry.target}${entry.symbol ? `::${entry.symbol}` : ''} — ${entry.why} (${entry.form})`);
  }
  return { exitCode: 1, text: `${lines.join('\n')}\n` };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const result = checkContractCitesMain(process.argv.slice(2));
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
}
