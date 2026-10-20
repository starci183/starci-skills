// R270: product documentation cites paths, commands, environment keys and rules that still exist.
// Paths in links are document-relative; code/prose paths may be repository-relative. Only tracked
// names are inspected: no environment file, sealed member or secret value is ever read.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOG } from '../../../packages/cli/src/catalog.generated.mjs';
import { checkCommand, extractCommands } from '../doc-commands.mjs';
import { globExpression } from '../../lib/glob.mjs';
import { loadTypescript } from '../../lib/package-at.mjs';
import { loadRuleCatalog } from '../rule-catalog.mjs';
import { found, readJson, readText } from './read.mjs';

const PATH_MISSING = 'HFS_DOC_PATH_MISSING';
const COMMAND_UNKNOWN = 'HFS_DOC_COMMAND_UNKNOWN';
const ENV_UNKNOWN = 'HFS_DOC_ENV_UNKNOWN';
const RULE_UNKNOWN = 'HFS_DOC_RULE_UNKNOWN';
const DOCUMENT = /(?:^|\/)README\.md$|(?:^|\/)docs\/.+\.mdx?$/i;
const KEY = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;
const PLACEHOLDER = /[<>{}*$]/;
const PATH_TOKEN = /^(?:\.\.?\/)?[\w@.-]+(?:\/[\w@.()[\]-]+)*\/?$/;
let runtimeCatalogs;

function catalogs() {
  runtimeCatalogs ??= {
    commands: CATALOG,
    rules: loadRuleCatalog(),
  };
  return runtimeCatalogs;
}

const trackedPath = (target, tracked) => tracked.has(target) || [...tracked].some((file) => file.startsWith(`${target.replace(/\/$/, '')}/`));

function cleanPath(raw) {
  if (EXTERNAL.test(raw) || PLACEHOLDER.test(raw)) return null;
  let target;
  try { target = decodeURIComponent(raw.split(/[?#]/)[0]); } catch { return null; }
  if (!PATH_TOKEN.test(target) || !target || target === '.' || target === '..') return null;
  return target.replace(/\/$/, '');
}

function codePathRoots(file, tracked) {
  const side = /^(be|fe)\//.exec(file)?.[1] ?? '';
  return [...new Set(['', side, packageDirectory(file, tracked)])];
}

function resolvedPath(raw, file, tracked, link, generated, roots) {
  const target = cleanPath(raw);
  if (target === null) return true;
  const relative = path.posix.normalize(path.posix.join(path.posix.dirname(file), target));
  const candidates = link ? [relative] : [relative, ...roots.map((root) => path.posix.join(root, target))];
  return candidates.some((candidate) => !candidate.startsWith('../') && (trackedPath(candidate, tracked) || generated.has(candidate)));
}

const ENV_NAME = /[A-Z][A-Z0-9_]*/.source;
const INLINE_LINK = /\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+['"][^)]*)?\)/.source;
const REFERENCE_LINK = /^\s*\[[^\]]+\]:\s*(?:<([^>]+)>|(\S+))/.source;
const MARKDOWN_LINK = new RegExp(`${INLINE_LINK}|${REFERENCE_LINK}`, 'g');

function pathReferences(line) {
  const refs = [];
  // Markdown inline and reference links, including image links. URLs and anchors are excluded later.
  for (const match of line.matchAll(MARKDOWN_LINK)) {
    refs.push({ target: match[1] ?? match[2] ?? match[3] ?? match[4], link: true });
  }
  const masked = line.replace(/\]\([^)]*\)/g, ']');
  for (const match of masked.matchAll(/`([^`]+)`/g)) {
    const target = match[1];
    if (target.includes('/') || /\.(?:md|mdx|json|ya?ml|[cm]?[jt]sx?|sh|env|toml|sql|graphql|enc)$/.test(target)) refs.push({ target, link: false });
  }
  // Unquoted prose paths need a slash; dotted words and API routes are not file citations.
  const prose = masked.replace(/`[^`]*`|\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, '');
  for (const match of prose.matchAll(/(?<![\w@./:-])((?:\.\.?\/)?[\w@.-]+\/(?:[\w@.()[\]-]+\/)*[\w@.()[\]-]*)(?![\w/])/g)) {
    refs.push({ target: match[1].replace(/[.,;:]$/, ''), link: false });
  }
  return refs;
}

/** A cited host location (the untracked custody file `.claude/secret.env`, `~/...`) or a prose pair (`expand/contract`: no extension and no tracked top-level folder of that name) is no repository path. */
function hostOrProse(target, tracked, link, roots) {
  if (!link && (target === 'process.env' || target === 'import.meta.env')) return true;
  if (target === '.claude/secret.env' || /^(?:~\/|\/)/.test(target)) return true;
  if (link || /\.[A-Za-z0-9]+$/.test(target) || target.endsWith('/') || target.startsWith('.')) return false;
  const top = target.split('/')[0];
  return !roots.some((root) => trackedPath(path.posix.join(root, top), tracked));
}

function pathFindings(file, lines, tracked, generated) {
  const findings = [];
  const roots = codePathRoots(file, tracked);
  for (const [index, line] of lines.entries()) {
    for (const { target, link } of pathReferences(line)) {
      if (hostOrProse(target, tracked, link, roots)) continue;
      if (!resolvedPath(target, file, tracked, link, generated, roots)) findings.push(found(PATH_MISSING, file, `${file} cites a missing repository path ${target}; update the documentation or restore the path`, { line: index + 1, reference: target }));
    }
  }
  return findings;
}

/** Tool reports are generated, never tracked; both their consumer and the slot policy must declare them. */
function generatedReports(repoRoot, tracked, resolver) {
  const reports = new Set();
  if (!tracked.has('sonar-project.properties') || !resolver) return reports;
  const text = readText(repoRoot, 'sonar-project.properties') ?? '';
  for (const match of text.matchAll(/^sonar\.javascript\.lcov\.reportPaths\s*=\s*([^\r\n]*)/gm)) {
    for (const report of match[1].split(',').map((entry) => entry.trim())) {
      const target = cleanPath(report);
      if (target && resolver.trackingOf(target) === 'ignored') reports.add(target);
    }
  }
  return reports;
}

function packageDirectory(file, tracked) {
  let dir = path.posix.dirname(file);
  while (true) {
    if (tracked.has(path.posix.join(dir, 'package.json'))) return dir === '.' ? '' : dir;
    if (dir === '.') return '';
    dir = path.posix.dirname(dir);
  }
}

function workspaceManifests(repoRoot, directory, tracked) {
  const manifest = readJson(repoRoot, path.posix.join(directory, 'package.json'));
  const workspaces = Array.isArray(manifest?.workspaces) ? manifest.workspaces : manifest?.workspaces?.packages ?? [];
  const patterns = workspaces.map((entry) => globExpression(path.posix.join(directory, entry)));
  return [...tracked].filter((entry) => path.posix.basename(entry) === 'package.json' && patterns.some((pattern) => pattern.test(path.posix.dirname(entry))));
}

function missingScripts(repoRoot, directory, tracked, name, workspaces) {
  const manifests = workspaces ? workspaceManifests(repoRoot, directory, tracked) : [path.posix.join(directory, 'package.json')];
  if (!manifests.length) return [path.posix.join(directory, 'package.json')];
  return manifests.filter((file) => !Object.hasOwn(readJson(repoRoot, file)?.scripts ?? {}, name));
}

function scriptFindings(repoRoot, file, lines, tracked) {
  const findings = [];
  const initial = packageDirectory(file, tracked);
  let directory = initial;
  for (const [index, line] of lines.entries()) {
    if (/^\s*```/.test(line)) directory = initial;
    const changed = /(?:^|[;&]\s*|\$\s*)cd\s+([\w./-]+)/.exec(line);
    if (changed) directory = path.posix.normalize(path.posix.join(directory, changed[1]));
    for (const match of line.matchAll(/\bnpm\s+(?:--prefix\s+([\w./-]+)\s+)?run\s+(?:--silent\s+)?([\w:.-]+)/g)) {
      const dir = match[1] ? path.posix.join(directory, match[1]) : directory;
      const name = match[2];
      const tail = line.slice(match.index + match[0].length).split(/[`;&|]/)[0];
      const workspaces = /(?:^|\s)--workspaces(?:\s|$)/.test(tail);
      const missing = missingScripts(repoRoot, dir, tracked, name, workspaces);
      for (const manifest of missing) findings.push(found(COMMAND_UNKNOWN, file, `${file} cites npm run ${name}, absent from ${manifest}; update the command or declare the script`, { line: index + 1, reference: `npm run ${name}` }));
    }
  }
  return findings;
}

function commandFindings(repoRoot, file, text, tracked, commands) {
  const findings = scriptFindings(repoRoot, file, text.split(/\r?\n/), tracked);
  for (const occurrence of extractCommands(text)) {
    if (!/^\s*app\s/.test(occurrence.text)) continue;
    for (const issue of checkCommand(occurrence, commands, { strictProse: true }).filter((reason) => /^unknown verb\b/.test(reason))) {
      findings.push(found(COMMAND_UNKNOWN, file, `${file} cites a starci app command that does not resolve: ${issue}; use a verb from the CLI catalog`, { line: occurrence.line }));
    }
  }
  return findings;
}

function importedFiles(file, text, tracked) {
  const prefix = /^(be|fe)\//.exec(file)?.[1] ?? '';
  const imports = [...text.matchAll(/\b(?:from\s*|import\s*|export\s*\*\s*from\s*)['"]([^'"]+)['"]/g)].map((match) => match[1]);
  return imports.flatMap((specifier) => {
    let target;
    if (specifier.startsWith('.')) target = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
    else if (specifier.startsWith('@modules/')) target = path.posix.join(prefix, 'src/modules', specifier.slice('@modules/'.length));
    else return [];
    return [target, `${target}.ts`, `${target}/index.ts`].filter((candidate) => tracked.has(candidate));
  });
}

const READER_CALL = /\b(\w+)\s*\.\s*\w+\s*\(\s*['"]([A-Z][A-Z0-9_]*)['"]/.source;
const PROCESS_ENV_DOT = /\bprocess\.env\.([A-Z][A-Z0-9_]*)/.source;
const PROCESS_ENV_INDEX = /\bprocess\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/.source;
const ENV_READ = new RegExp(`${READER_CALL}|${PROCESS_ENV_DOT}|${PROCESS_ENV_INDEX}`, 'g');

function addReaderKeys(text, keys) {
  const readers = new Set(['env', 'source', ...[...text.matchAll(/\b(\w+)\s*:\s*EnvSource\b/g)].map((match) => match[1])]);
  for (const match of text.matchAll(ENV_READ)) {
    if (match[3] || match[4]) keys.add(match[3] ?? match[4]);
    else if (readers.has(match[1])) keys.add(match[2]);
  }
}

function addDocumentedKeys(text, keys) {
  for (const line of text.split(/\r?\n/)) {
    const cell = /^\s*\|\s*`?([A-Z][A-Z0-9_]*)`?\s*\|/.exec(line);
    if (cell) keys.add(cell[1]);
    const bullet = /^\s*[-*]\s*`([A-Z][A-Z0-9_]*)`/.exec(line);
    if (bullet) keys.add(bullet[1]);
  }
}

function environmentKeys(repoRoot, tracked) {
  const keys = new Set();
  const pending = [...tracked].filter((file) => /(?:^|\/)[^/]+\.env\.ts$/.test(file));
  const seen = new Set();
  while (pending.length) {
    const file = pending.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const text = readText(repoRoot, file) ?? '';
    // Follow the typed reader's local capability parsers and barrel exports, never execute them.
    pending.push(...importedFiles(file, text, tracked));
    addReaderKeys(text, keys);
  }
  for (const file of [...tracked].filter((entry) => /(?:^|\/)KEYS\.md$/.test(entry))) {
    const text = readText(repoRoot, file) ?? '';
    addDocumentedKeys(text, keys);
  }
  return keys;
}

function symbolCall(ts, node) {
  if (!node || !ts.isCallExpression(node)) return false;
  const callee = node.expression;
  if (ts.isIdentifier(callee)) return callee.text === 'Symbol';
  return ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === 'Symbol' && callee.name.text === 'for';
}

function declaredTokens(ts, source, tokens) {
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && KEY.test(node.name.text) && symbolCall(ts, node.initializer)) tokens.add(node.name.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
}

function injectionTokens(repoRoot, tracked) {
  const tokens = new Set();
  const ts = loadTypescript(repoRoot, path.dirname(fileURLToPath(import.meta.url)));
  if (!ts) return tokens;
  for (const file of tracked) {
    if (!/\.[cm]?[jt]sx?$/.test(file) || /(?:(?:^|\/)(?:tests?|__tests__)\/)|(?:(?:\.(?:spec|test)|-spec)\.[cm]?[jt]sx?$)/.test(file)) continue;
    const text = readText(repoRoot, file) ?? '';
    declaredTokens(ts, ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true), tokens);
  }
  return tokens;
}

function unknownEnvironmentName(name, line, keys, codes, tokens, explicit) {
  if (!KEY.test(name) || /^R\d+$/.test(name) || codes.has(name)) return false;
  if (!explicit && tokens.has(name) && !/\benv(?:ironment)?\b|\bvariable\b/i.test(line)) return false;
  if (!name.includes('_') && !keys.has(name) && !/\benv(?:ironment)?\b|\b(?:key|variable)s?\b/i.test(line)) return false;
  return !keys.has(name) && !(name.endsWith('_FILE') && keys.has(name.slice(0, -5)));
}

const QUOTED_ENV_NAME = `\`(${ENV_NAME})\``;
const REFERENCED_ENV_NAME = String.raw`\b(?:process\.env\.|\$\{?)(${ENV_NAME})`;
const ASSIGNED_ENV_NAME = String.raw`\b(${ENV_NAME})\s*=`;
const ENV_NAME_CITATION = new RegExp(`${QUOTED_ENV_NAME}|${REFERENCED_ENV_NAME}|${ASSIGNED_ENV_NAME}`, 'g');

function nameFindings(file, lines, keys, rules, tokens) {
  const findings = [];
  const codes = new Set(rules.rules.flatMap((rule) => rule.failureCodes));
  for (const [index, line] of lines.entries()) {
    for (const match of line.matchAll(/\bR\d+\b/g)) {
      if (!rules.rule(match[0])) findings.push(found(RULE_UNKNOWN, file, `${file} cites unknown rule ${match[0]}; use an id from the HFS rule catalog`, { line: index + 1, reference: match[0] }));
    }
    for (const match of line.matchAll(ENV_NAME_CITATION)) {
      const name = match[1] ?? match[2] ?? match[3];
      if (!unknownEnvironmentName(name, line, keys, codes, tokens, !match[1])) continue;
      findings.push(found(ENV_UNKNOWN, file, `${file} cites unknown environment key ${name}; declare it in a typed environment reader or KEYS.md, or update the documentation`, { line: index + 1, reference: name }));
    }
  }
  return findings;
}

/** Findings of R270 over product READMEs and docs, in lite and full; runtime docs retain their own checks. */
export function docFreshFindings({ repoRoot, files = [], all = files, repo, resolver, appSide = false, inScope = () => true }) {
  if (appSide || repo?.profile === 'runtime' || !['lite', 'full'].includes(repo?.edition)) return [];
  const inventory = repo.profile === 'app' ? all : files;
  const docs = inventory.filter((file) => DOCUMENT.test(file) && path.posix.basename(file) !== 'KEYS.md' && inScope(file));
  if (!docs.length) return [];
  const tracked = new Set(all);
  const { commands, rules } = catalogs();
  const keys = environmentKeys(repoRoot, tracked);
  const tokens = injectionTokens(repoRoot, tracked);
  const generated = generatedReports(repoRoot, tracked, resolver);
  const findings = [];
  for (const file of docs) {
    const text = readText(repoRoot, file);
    if (text === null) continue;
    const lines = text.split(/\r?\n/);
    findings.push(...pathFindings(file, lines, tracked, generated), ...commandFindings(repoRoot, file, text, tracked, commands), ...nameFindings(file, lines, keys, rules, tokens));
  }
  const seen = new Set();
  return findings.filter((finding) => {
    const key = `${finding.code}:${finding.path}:${finding.line}:${finding.reference ?? finding.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
