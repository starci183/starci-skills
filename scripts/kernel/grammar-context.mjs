// grammar-context.mjs — the grammar sources an op manifest with `grammarContext: required` carries in
// its dispatch packet (context.grammar), so no Kernel has to remember to pass them. The family CSS is
// resolved from the product's own configuration: the brand record's declared CSS sources and the
// installed @starci/grammar export of the brand's family. A missing source is a dispatch refusal.
//
// grammarInputs (op.schema.yaml): reference (default) adds the product's grammar captures; component-source
// (interface.draw, owner ruling 2026-09-27 - the drawer writes <XBase>.draw.tsx with the REAL grammar components)
// never attaches a capture or reference render: it attaches the grammar source the draw compiles against (the
// installed package's dist type declarations, the runtime's packages/grammar/src) and the HeroUI styles.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { readBrandRecord } from '../work/brand/brand.mjs';
import { projectBinding, bindingRepo } from './target-repo.mjs';
import { isFile, isDir } from '../lib/fs-kind.mjs';
import { byCodeUnit } from '../lib/list.mjs';

export const GRAMMAR_PACKAGE = '@starci/grammar';
const GRAMMAR_KNOWLEDGE_FAMILY = 'starci';
const GRAMMAR_KNOWLEDGE_TOPICS = ['family', 'DNA', 'playbook', 'idioms'];
const UI_KNOWLEDGE_AREAS = ['presentation', 'composition', 'proof'];
const CAPTURES_DIR = path.join('_resources', 'grammar-captures');

export const grammarContextRequired = (brief) => brief?.grammarContext === 'required';
const GRAMMAR_INPUTS = Object.freeze(['reference', 'component-source']);
export const grammarInputsOf = (brief) => (GRAMMAR_INPUTS.includes(brief?.grammarInputs) ? brief.grammarInputs : 'reference');


const slash = (p) => p.replaceAll('\\', '/');
const yamlFilesUnder = (dir) => fs.readdirSync(dir, { withFileTypes: true, recursive: true })
  .filter((e) => e.isFile() && /\.ya?ml$/i.test(e.name))
  .map((e) => slash(path.join(e.parentPath ?? e.path, e.name))).sort(byCodeUnit);

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

const appendDeclaredFamilyCss = ({ brand, repo, binding, roots, add, missing }) => {
  const declared = (Array.isArray(brand.brand.sources) ? brand.brand.sources : [])
    .filter((s) => typeof s?.path === 'string' && /\.css$/i.test(s.path) && s.kind !== 'reference');
  for (const source of declared) {
    const file = sourceCandidates({ source, repo, binding, roots }).find((p) => isFile(p));
    if (file) add(file);
    else {
      const declaredAt = source.repository ? `${source.repository}:` : '';
      missing.push({ role: 'family-css', path: `${declaredAt}${source.path}`, detail: `declared in ${slash(brand.file)} brand.sources and not on disk in its repository` });
    }
  }
};

const appendInstalledFamilyCss = ({ skillRoot, family, roots, add }) => {
  if (family) for (const root of roots) { const file = installedFamilyCss({ skillRoot, family, root }); if (file && isFile(file)) add(file); }
};

// The family CSS of the brand record, pushed into sources/missing: every declared non-reference css
// found in its repository, plus the installed @starci/grammar family export. Returns the family name.
const familyCss = ({ skillRoot, repo, binding, roots, workDir, sources, missing }) => {
  let brand = null;
  try { brand = readBrandRecord(workDir); } catch (e) { missing.push({ role: 'family-css', detail: `no brand record to resolve the family CSS from: ${e.message}` }); }
  const family = brand?.family ?? null;
  if (!brand) return family;
  const seen = new Set();
  const add = (file) => { const key = path.resolve(file).toLowerCase(); if (!seen.has(key)) { seen.add(key); sources.push({ role: 'family-css', path: slash(path.resolve(file)) }); } };
  appendDeclaredFamilyCss({ brand, repo, binding, roots, add, missing });
  appendInstalledFamilyCss({ skillRoot, family, roots, add });
  if (!sources.length && !missing.length)
    missing.push({ role: 'family-css', detail: `${slash(brand.file)} declares no CSS in brand.sources and no bound repository installs a ${GRAMMAR_PACKAGE} CSS export for family ${family ?? '(none: brand.identity.family unset)'}` });
  return family;
};

// The grammar and UI knowledge files every grammar op reads: each family topic yaml, each UI area's tree.
const knowledgeInputs = (skillRoot, sources, missing) => {
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
};

// The real components a component-source draw compiles against, not their pictures: the installed dist
// types, the runtime's packages/grammar/src, the HeroUI CSS.
const componentSources = ({ skillRoot, roots, sources, missing }) => {
  const installed = roots.map((r) => path.join(r, 'node_modules', ...GRAMMAR_PACKAGE.split('/'), 'dist')).filter((p) => isDir(p));
  for (const dir of installed) sources.push({ role: 'grammar-source', path: slash(dir) });
  const src = path.join(skillRoot, 'packages', 'grammar', 'src');
  if (isDir(src)) sources.push({ role: 'grammar-source', path: slash(src) });
  if (!installed.length && !isDir(src)) missing.push({ role: 'grammar-source', detail: `no ${GRAMMAR_PACKAGE} dist in a bound repository and no ${slash(src)}` });
  const heroui = roots.map((r) => path.join(r, 'node_modules', '@heroui', 'styles')).find((p) => isDir(p));
  if (heroui) sources.push({ role: 'heroui-styles', path: slash(heroui) });
};

// { family, sources: [{role, path, files?}], missing: [{role, path?, detail}] }. Paths are absolute.
export function resolveGrammarContext({ skillRoot, repo, binding = projectBinding(repo), inputs = 'reference' }) {
  const sources = [];
  const missing = [];
  const roots = [...new Set([repo, ...(binding?.repos ?? []).map((r) => r.root)].map((r) => path.resolve(r)))];
  const workDir = path.join(repo, binding?.workDir ?? '.starciwork');

  const family = familyCss({ skillRoot, repo, binding, roots, workDir, sources, missing });
  knowledgeInputs(skillRoot, sources, missing);

  if (inputs === 'component-source') {
    componentSources({ skillRoot, roots, sources, missing });
    return { family, sources, missing, inputs };
  }
  const captures = [path.join(workDir, CAPTURES_DIR), ...roots.map((r) => path.join(r, 'node_modules', ...GRAMMAR_PACKAGE.split('/'), 'captures'))].find((p) => isDir(p));
  if (captures) sources.push({ role: 'grammar-captures', path: slash(captures) });

  return { family, sources, missing };
}

export const grammarMissingDetail = (missing) => missing
  .map((m) => {
    const file = m.path ? ` ${m.path}` : '';
    return `${m.role}${file}: ${m.detail}`;
  }).join('; ');

// The prompt block for packet context.grammar.
export function renderGrammarContext(grammar) {
  if (!grammar?.sources?.length) return [];
  const line = (s) => {
    if (s.role === 'ui-knowledge') return `  ${s.role}: ${s.path}/ — ${s.files.length} yaml: ${s.files.map((f) => path.posix.relative(s.path, f)).join(', ')}`;
    if (s.role === 'grammar-captures') return `  ${s.role}: ${s.path}/ — the grammar's rendered component captures; open those of every component you touch`;
    if (s.role === 'grammar-source') return `  ${s.role}: ${s.path}/ — the real components your <XBase>.draw.tsx imports: their exported props and closed variants are the only ones that type-check`;
    if (s.role === 'heroui-styles') return `  ${s.role}: ${s.path}/ — the HeroUI CSS the grammar components render with`;
    return `  ${s.role}: ${s.path}`;
  };
  return [
    `grammar_context (family ${grammar.family ?? 'unset'}): read every source below before any action (packet context.grammar). Grammar, family tokens and UI knowledge outrank product .tsx/.d.ts and your own taste:`,
    ...grammar.sources.map(line),
  ];
}
