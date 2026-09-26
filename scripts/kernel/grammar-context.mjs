// grammar-context.mjs — the grammar sources an op manifest with `grammarContext: required` carries in
// its dispatch packet (context.grammar), so no Kernel has to remember to pass them. The family CSS is
// resolved from the product's own configuration: the brand record's declared CSS sources and the
// installed @starci/grammar export of the brand's family. A missing source is a dispatch refusal.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { readBrandRecord } from '../checks/brand.mjs';
import { projectBinding, bindingRepo } from './target-repo.mjs';

export const GRAMMAR_PACKAGE = '@starci/grammar';
const GRAMMAR_KNOWLEDGE_FAMILY = 'starci';
const GRAMMAR_KNOWLEDGE_TOPICS = ['family', 'DNA', 'playbook', 'idioms'];
const UI_KNOWLEDGE_AREAS = ['presentation', 'composition', 'proof'];
const CAPTURES_DIR = path.join('_resources', 'grammar-captures');

export const grammarContextRequired = (brief) => brief?.grammarContext === 'required';

const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const slash = (p) => p.replace(/\\/g, '/');
const yamlFilesUnder = (dir) => fs.readdirSync(dir, { withFileTypes: true, recursive: true })
  .filter((e) => e.isFile() && /\.ya?ml$/i.test(e.name))
  .map((e) => slash(path.join(e.parentPath ?? e.path, e.name))).sort();

// A brand source resolves against its declared repository - bound, else the ledger repository's sibling
// of that name - with its path relative to that root or spelled from the root's parent
// (`<repository>/src/...`); one that names no repository resolves against the ledger repository first,
// then every bound repository (a frontend file declared from the Work owner).
const sourceCandidates = ({ source, repo, binding, roots }) => {
  if (path.isAbsolute(source.path)) return [source.path];
  if (source.repository) {
    const root = bindingRepo(binding, source.repository)?.root
      ?? (path.basename(repo) === source.repository ? repo : path.join(path.dirname(path.resolve(repo)), source.repository));
    return [path.join(root, source.path), path.join(path.dirname(root), source.path)];
  }
  return roots.map((root) => path.join(root, source.path));
};

// The installed grammar package's CSS export for this family: the knowledge snapshot's familyEntry
// names the subpath when the family is filed under another name (starci -> @starci/grammar/core).
const familyExportSubpath = (skillRoot, family) => {
  try {
    const index = parseYaml(fs.readFileSync(path.join(skillRoot, 'knowledge', 'grammars', family, 'index.yaml'), 'utf8'));
    const entry = index?.provenance?.familyEntry;
    if (typeof entry === 'string' && entry.startsWith(`${GRAMMAR_PACKAGE}/`)) return entry.slice(GRAMMAR_PACKAGE.length + 1);
  } catch { /* no snapshot for this family: the export is named after the family */ }
  return family;
};
const installedFamilyCss = ({ skillRoot, family, root }) => {
  const pkgDir = path.join(root, 'node_modules', ...GRAMMAR_PACKAGE.split('/'));
  let pkg;
  try { pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')); } catch { return null; }
  const target = pkg?.exports?.[`./${familyExportSubpath(skillRoot, family)}.css`];
  return typeof target === 'string' ? path.join(pkgDir, target) : null;
};

// { family, sources: [{role, path, files?}], missing: [{role, path?, detail}] }. Paths are absolute.
export function resolveGrammarContext({ skillRoot, repo, binding = projectBinding(repo) }) {
  const sources = [];
  const missing = [];
  const roots = [...new Set([repo, ...(binding?.repos ?? []).map((r) => r.root)].map((r) => path.resolve(r)))];
  const workDir = path.join(repo, binding?.workDir ?? '.starciwork');

  let brand = null;
  try { brand = readBrandRecord(workDir); } catch (e) { missing.push({ role: 'family-css', detail: `no brand record to resolve the family CSS from: ${e.message}` }); }
  const family = brand?.family ?? null;
  if (brand) {
    const seen = new Set();
    const add = (file) => { const key = path.resolve(file).toLowerCase(); if (!seen.has(key)) { seen.add(key); sources.push({ role: 'family-css', path: slash(path.resolve(file)) }); } };
    const declared = (Array.isArray(brand.brand.sources) ? brand.brand.sources : [])
      .filter((s) => typeof s?.path === 'string' && /\.css$/i.test(s.path) && s.kind !== 'reference');
    for (const source of declared) {
      const file = sourceCandidates({ source, repo, binding, roots }).find(isFile);
      if (file) add(file);
      else missing.push({ role: 'family-css', path: `${source.repository ? `${source.repository}:` : ''}${source.path}`, detail: `declared in ${slash(brand.file)} brand.sources and not on disk in its repository` });
    }
    if (family) for (const root of roots) { const file = installedFamilyCss({ skillRoot, family, root }); if (file && isFile(file)) add(file); }
    if (!sources.length && !missing.length)
      missing.push({ role: 'family-css', detail: `${slash(brand.file)} declares no CSS in brand.sources and no bound repository installs a ${GRAMMAR_PACKAGE} CSS export for family ${family ?? '(none: brand.identity.family unset)'}` });
  }

  for (const topic of GRAMMAR_KNOWLEDGE_TOPICS) {
    const file = path.join(skillRoot, 'knowledge', 'grammars', GRAMMAR_KNOWLEDGE_FAMILY, `${topic}.yaml`);
    if (isFile(file)) sources.push({ role: 'grammar-knowledge', path: slash(file) });
    else missing.push({ role: 'grammar-knowledge', path: slash(file), detail: 'not on disk' });
  }
  for (const area of UI_KNOWLEDGE_AREAS) {
    const dir = path.join(skillRoot, 'knowledge', 'ui', area);
    const files = isDir(dir) ? yamlFilesUnder(dir) : [];
    if (files.length) sources.push({ role: 'ui-knowledge', path: slash(dir), files });
    else missing.push({ role: 'ui-knowledge', path: slash(dir), detail: 'no knowledge yaml on disk' });
  }

  const captures = [path.join(workDir, CAPTURES_DIR), ...roots.map((r) => path.join(r, 'node_modules', ...GRAMMAR_PACKAGE.split('/'), 'captures'))].find(isDir);
  if (captures) sources.push({ role: 'grammar-captures', path: slash(captures) });

  return { family, sources, missing };
}

export const grammarMissingDetail = (missing) => missing
  .map((m) => `${m.role}${m.path ? ` ${m.path}` : ''}: ${m.detail}`).join('; ');

// The prompt block for packet context.grammar.
export function renderGrammarContext(grammar) {
  if (!grammar?.sources?.length) return [];
  const line = (s) => {
    if (s.role === 'ui-knowledge') return `  ${s.role}: ${s.path}/ — ${s.files.length} yaml: ${s.files.map((f) => path.posix.relative(s.path, f)).join(', ')}`;
    if (s.role === 'grammar-captures') return `  ${s.role}: ${s.path}/ — the grammar's rendered component captures; open those of every component you touch`;
    return `  ${s.role}: ${s.path}`;
  };
  return [
    `grammar_context (family ${grammar.family ?? 'unset'}): read every source below before any action (packet context.grammar). Grammar, family tokens and UI knowledge outrank product .tsx/.d.ts and your own taste:`,
    ...grammar.sources.map(line),
  ];
}
