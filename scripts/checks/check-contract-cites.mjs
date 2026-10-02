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
//
// History may name what was deleted or moved on purpose: a path listed in
// modules/kernel/retired-paths.yaml (retired[].path, moved[].from) is a valid cite from a contract-change entry
// (modules/kernel/contract-changes/**), modules/kernel/owner-rulings.yaml or the registry itself, and a
// dead cite everywhere else (live contract text must name what runs now; a moved path names its moved[].to).
//
// RT_CITED_PATH_MISSING (rule R122, gate runtime): citedPathFindings() runs the same reading over the runtime's live prose
// (runtimeCiteScan: the runtime contracts, docs/*.md, skills, init, CONTEXT.md, README.md, CONTRIBUTING.md and the ui docs)
// and returns each dead cite as a finding; `starci runtime check` judges it with the runtime check.
// knowledge/, modules/schemas/ and docs/examples/ describe product repositories, whose paths are not this tree's.
// Exit 0 clean, 1 lists every dead cite as file:line, 2 bad arguments.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkFiles } from '../lib/walk.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { movedTo } from '../hfs/runtime-rules/retired.mjs';
import { isMain } from '../lib/is-main.mjs';

const HELP = `Usage: starci runtime check --only contract-cites -- [--root <tree>] [--scan <rel-path> ...] [--json]

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

export const RETIRED_PATHS_FILE = 'modules/kernel/retired-paths.yaml';
const HISTORY = (rel) => rel.startsWith('modules/kernel/contract-changes/') || rel === 'modules/kernel/owner-rulings.yaml' || rel === RETIRED_PATHS_FILE;
/** The generated copy roots of the runtime (ruleParams.runtime.generated of knowledge/hfs/runtime-slots.yaml), each a byte mirror of the runtime layout. */
const generatedRoots = (root) => {
  const file = path.join(root, 'knowledge', 'hfs', 'runtime-slots.yaml');
  if (!fs.existsSync(file)) return [];
  return (parseYaml(fs.readFileSync(file, 'utf8'))?.ruleParams?.runtime?.generated ?? []).map((g) => `${String(g.root).replace(/\/$/, '')}/`);
};
/** A path inside a generated copy is the runtime path it mirrors (packages/hfs/runtime/scripts/x.mjs -> scripts/x.mjs). */
const mirrored = (roots, target) => { const r = roots.find((g) => target.startsWith(g)); return r ? target.slice(r.length) : target; };

const readRegistry = (root) => {
  const file = path.join(root, RETIRED_PATHS_FILE);
  return fs.existsSync(file) ? (parseYaml(fs.readFileSync(file, 'utf8')) ?? {}) : {};
};

/** The retired paths of `root` (modules/kernel/retired-paths.yaml `retired[].path`); an empty set when there is none. */
export function retiredPaths(root = DEFAULT_ROOT) {
  const doc = readRegistry(root);
  return new Set((Array.isArray(doc.retired) ? doc.retired : []).map((r) => String(r?.path ?? '')).filter(Boolean));
}

/** (path) -> where it moved under `root`'s modules/kernel/retired-paths.yaml `moved[]` (a directory row covers what is below it), or null. */
export const movedPaths = (root = DEFAULT_ROOT) => movedTo(readRegistry(root).moved);

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

const yamlFilesUnder = (dir) => walkFiles(dir, {sorted: true, filter: name => /\.(?:yaml|yml|md)$/.test(name)});

function collectScanFiles(root, scan = DEFAULT_SCAN) {
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
  const retired = retiredPaths(root);
  const moved = movedPaths(root);
  const roots = generatedRoots(root);
  const retiredOrMoved = (target) => retired.has(target) || moved(target) || retired.has(mirrored(roots, target)) || moved(mirrored(roots, target));
  let checked = 0, historic = 0;
  for (const file of files) {
    const rel = path.relative(root, file).replaceAll('\\', '/');
    const seen = new Set();
    for (const cite of citesIn(fs.readFileSync(file, 'utf8'))) {
      const key = `${cite.line}:${cite.kind}:${cite.target}:${cite.symbol ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // Outside a cite key, only a token rooted at a real top-level entry is
      // a reference to this tree; `evidence/manifest.yaml` names a record artifact.
      // A cite key must name a repo-relative path; elsewhere only a token
      // rooted at a real top-level entry refers to this tree (`evidence/manifest.yaml`
      // names a record artifact, not a file here).
      if (cite.kind === 'path' && cite.form !== 'cite value'
        && !fs.existsSync(path.join(root, cite.target.split('/')[0]))) continue;
      checked += 1;
      if (cite.kind === 'bare') {
        dead.push({ file: rel, line: cite.line, form: cite.form, target: cite.target, why: 'bare filename — a cite names a repo-relative path' });
        continue;
      }
      if (retiredOrMoved(cite.target) && HISTORY(rel) && !fs.existsSync(path.join(root, cite.target))) { historic += 1; continue; }
      const body = readTarget(path.join(root, cite.target));
      if (body === null) { dead.push({ file: rel, line: cite.line, form: cite.form, target: cite.target, why: moved(cite.target) ? `moved to ${moved(cite.target)}` : 'no such file' }); continue; }
      if (cite.kind === 'symbol' && !body.includes(cite.symbol)) {
        dead.push({ file: rel, line: cite.line, form: cite.form, target: cite.target, symbol: cite.symbol, why: 'symbol not in file' });
      }
    }
  }
  return { schema: 'starci/contract-cites@1', ok: dead.length === 0, filesScanned: files.length, citesChecked: checked, retiredCites: historic, dead };
}

export const CITED_PATH_MISSING = 'RT_CITED_PATH_MISSING';
/** The runtime's live prose (rule R122): the runtime contracts and the human and agent docs of this tree. */
const RUNTIME_CITE_ROOTS = Object.freeze(['modules/kernel', 'modules/goal', 'modules/ops', 'modules/supervisor', 'modules/reconciler', 'modules/host', 'modules/models', 'skills', 'init', 'CONTEXT.md', 'README.md', 'CONTRIBUTING.md', 'ui/README.md', 'ui/CONTRACT.md']);

/** The scan of rule R122 under `root`: RUNTIME_CITE_ROOTS that exist plus every docs/*.md (docs/examples/ describes product apps). */
export function runtimeCiteScan(root = DEFAULT_ROOT) {
  const docs = fs.existsSync(path.join(root, 'docs')) ? fs.readdirSync(path.join(root, 'docs')).filter((name) => name.endsWith('.md')).sort().map((name) => `docs/${name}`) : [];
  return [...RUNTIME_CITE_ROOTS.filter((rel) => fs.existsSync(path.join(root, rel))), ...docs];
}

/** RT_CITED_PATH_MISSING findings of the runtime's live prose under `root`. */
export function citedPathFindings(root = DEFAULT_ROOT) {
  return checkContractCites(root, runtimeCiteScan(root)).dead.map((d) => ({
    code: CITED_PATH_MISSING, level: 'error', path: d.file, line: d.line,
    message: `${d.file}:${d.line} cites ${d.target}${d.symbol ? `::${d.symbol}` : ''}: ${d.why} (${d.form})`,
  }));
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

if (isMain(import.meta.url)) {
  const result = checkContractCitesMain(process.argv.slice(2));
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
}
