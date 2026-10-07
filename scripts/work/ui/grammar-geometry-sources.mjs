import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkFiles } from '../../lib/walk.mjs';
import { GRAMMAR_FAMILIES as FAMILIES } from '../../lib/example-refs.mjs';
import { readJsonFile } from '../../lib/json.mjs';
import { byCodeUnit } from '../../lib/list.mjs';
import { parseCss } from './grammar-geometry-css.mjs';

// grammar-geometry-sources.mjs - where grammar-geometry.mjs reads a product's CSS from: the installed HeroUI and
// Grammar packages, the app entry that imports them and the family sheet.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const PRUNE = new Set(['node_modules', '.next', 'dist', 'build', 'out', 'coverage', 'storybook-static', '.git', '.turbo', 'reference-renders', '.starciwork', '.claude', 'captures']);

const versionOf = (dir) => readJsonFile(path.join(dir, 'package.json'))?.version ?? '0.0.0';
const semverDesc = (a, b) => {
  const pa = String(a.version).split(/[.-]/).map((x) => Number.parseInt(x, 10) || 0);
  const pb = String(b.version).split(/[.-]/).map((x) => Number.parseInt(x, 10) || 0);
  for (let k = 0; k < 3; k++) {
    if (pa[k] !== pb[k]) return pb[k] - pa[k];
  }
  return 0;
};

/** Installed copies of `name` at the repo root and its workspace members, highest version first. */
function installedPackages(repo, name) {
  const bases = [repo];
  for (const group of ['apps', 'packages']) {
    try {
      for (const e of fs.readdirSync(path.join(repo, group), { withFileTypes: true })) {
        if (e.isDirectory()) bases.push(path.join(repo, group, e.name));
      }
    } catch { /* no workspace group */ }
  }
  const found = [];
  for (const b of bases) {
    const dir = path.join(b, 'node_modules', ...name.split('/'));
    if (fs.existsSync(path.join(dir, 'package.json'))) found.push({ dir: fs.realpathSync(dir), version: versionOf(dir) });
  }
  const unique = [...new Map(found.map((f) => [f.dir, f])).values()];
  return unique.sort(semverDesc);
}

/** Every css file of the repo's own source (build output and installed packages pruned). */
function repoCssFiles(repo, maxDepth = 8) {
  return walkFiles(repo, {maxDepth, ignoreReadErrors: true,
    exclude: (name, _full, entry) => entry.isDirectory() && (PRUNE.has(name) || name.startsWith('.')),
    filter: name => name.endsWith('.css')}).sort(byCodeUnit);
}

const familyScopeRe = (id) => new RegExp(String.raw`data-grammar-family\s*=\s*["']?${id}["']?\s*\]`);
export const readText = (file) => { try { return fs.readFileSync(file, 'utf8'); } catch { return ''; } };

/** How many custom property declarations (`--name:`) `text` holds: each run of word characters and dashes is read once. */
const customPropertyCount = (text) => [...text.matchAll(/(?<![\w-])([\w-]+)\s*:/g)]
  .filter(([, run]) => {
    const at = run.indexOf('--');
    return at >= 0 && at <= run.length - 3;
  }).length;

const scopesFamily = (file, id) => {
  const t = readText(file);
  return familyScopeRe(id).test(t) && customPropertyCount(t) > 0;
};

/** The directory of package `name` as node resolves it from `fromDir` (nearest node_modules upward). */
function packageDirFrom(fromDir, name) {
  let dir = path.resolve(fromDir);
  for (;;) {
    const candidate = path.join(dir, 'node_modules', ...name.split('/'));
    if (fs.existsSync(path.join(candidate, 'package.json'))) return fs.realpathSync(candidate);
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

const splitSpecifier = (spec) => {
  const parts = spec.split('/');
  const n = spec.startsWith('@') ? 2 : 1;
  return { name: parts.slice(0, n).join('/'), subpath: parts.slice(n).join('/') };
};

const pickTarget = (v) => {
  if (typeof v === 'string') return v;
  return v && typeof v === 'object' ? pickTarget(v.style ?? v.default ?? v.import ?? null) : null;
};

/** The file a wildcard `exports` pattern (`./dist/*`) maps `key` to, else null. */
function patternTarget(pkgDir, exp, key) {
  for (const [pattern, v] of Object.entries(exp)) {
    if (!pattern.includes('*')) continue;
    const [pre, post] = pattern.split('*');
    if (!key.startsWith(pre) || !key.endsWith(post) || key.length < pre.length + post.length) continue;
    const t = pickTarget(v);
    if (t) return path.join(pkgDir, t.replace('*', key.slice(pre.length, key.length - post.length)));
  }
  return null;
}

/** A package subpath through its `exports` map (style, then default, then import), else the plain path. */
function exportTarget(pkgDir, subpath) {
  const exp = readJsonFile(path.join(pkgDir, 'package.json'))?.exports ?? null;
  const key = subpath ? `./${subpath}` : '.';
  if (exp && typeof exp === 'object') {
    const t = exp[key] === undefined ? null : pickTarget(exp[key]);
    if (t) return path.join(pkgDir, t);
    const viaPattern = patternTarget(pkgDir, exp, key);
    if (viaPattern) return viaPattern;
  }
  return path.join(pkgDir, subpath);
}

const packageRootOf = (file, stop) => {
  let dir = path.dirname(file);
  while (dir.startsWith(stop) && dir !== stop) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    dir = path.dirname(dir);
  }
  return stop;
};
const heroFilesOf = (dir) => [path.join(dir, 'dist', 'heroui.min.css'), path.join(dir, 'dist', 'themes', 'shared', 'theme.css')].filter((f) => fs.existsSync(f));

/** The bare package import resolver of a css file: `spec -> [{file, source} | {layers}]`. */
const bareResolver = (grammarDist) => (fromFile) => (spec) => {
  if (spec === 'tailwindcss') return [{ layers: ['properties', 'theme', 'base', 'components', 'utilities'] }];
  const { name, subpath } = splitSpecifier(spec);
  const dir = name === '@starci/grammar' && grammarDist ? path.resolve(grammarDist) : packageDirFrom(path.dirname(fromFile), name);
  if (!dir) return [];
  if (name === '@heroui/styles') return heroFilesOf(dir).map((file) => ({ file, source: 'heroui' }));
  const file = exportTarget(dir, subpath);
  if (!fs.existsSync(file) || !file.endsWith('.css')) return [];
  return [{ file, source: name === '@starci/grammar' ? 'grammar' : 'app' }];
};

/** An app css entry with every css file its imports reach (three levels deep), and the packages it resolves. */
function entryGraph(entry, bareOf, grammarDist) {
  const files = [entry];
  const visit = (file, depth) => {
    if (depth > 3) return;
    for (const imp of parseCss(readText(file)).imports) {
      const hits = /^\.\.?\//.test(imp.target) ? [{ file: path.resolve(path.dirname(file), imp.target) }] : [bareOf(file)(imp.target)].flat().filter((t) => t?.file);
      for (const t of hits) {
        if (!fs.existsSync(t.file) || files.includes(t.file)) continue;
        files.push(t.file);
        visit(t.file, depth + 1);
      }
    }
  };
  visit(entry, 0);
  const grammarDir = grammarDist ? path.resolve(grammarDist) : packageDirFrom(path.dirname(entry), '@starci/grammar');
  return { entry, files, heroDir: packageDirFrom(path.dirname(entry), '@heroui/styles'), grammarDir, grammarVersion: grammarDir ? versionOf(grammarDir) : '0.0.0' };
}

/** The family a repo's css scopes: the first non-starci one an entry reaches (or any css when there is no entry), else starci. */
function detectFamily(entries, css) {
  const scopes = (k) => entries.some((e) => e.files.some((f) => scopesFamily(f, FAMILIES[k]))) || (!entries.length && css.some((f) => scopesFamily(f, FAMILIES[k])));
  return Object.keys(FAMILIES).find((k) => FAMILIES[k] !== FAMILIES.starci && scopes(k)) ?? 'starci';
}

/** The sources of the chosen app entry: HeroUI, Grammar, the family sheet and the app's own css, in cascade order. */
function entrySources(chosen, familyId, { bareOf, grammarDist, extraCss }) {
  const grammarDir = chosen.grammarDir ? path.join(chosen.grammarDir, 'dist') : path.join(ROOT, 'packages', 'grammar', 'src');
  let familyFile = chosen.files.find((f) => scopesFamily(f, familyId)) ?? null;
  const resolveBare = (spec, from) => {
    const hits = bareOf(from)(spec);
    return Array.isArray(hits) ? hits.map((h) => (h.file === familyFile ? { ...h, source: 'family' } : h)) : hits;
  };
  const commonFile = path.join(grammarDir, 'common', 'styles.css');
  const load = [];
  if (!chosen.files.includes(commonFile)) load.push({ file: commonFile, source: 'grammar' });
  load.push({ file: chosen.entry, source: familyFile === chosen.entry ? 'family' : 'app' });
  if (familyId === 'core' && !familyFile) {
    familyFile = path.join(grammarDir, 'core', 'styles.css');
    load.push({ file: familyFile, source: 'family' });
  }
  for (const file of extraCss) load.push({ file: path.resolve(file), source: 'app' });
  return { heroDir: chosen.heroDir, grammarDir, grammarInstalled: Boolean(chosen.grammarDir), familyFile, load, resolveBare };
}

/** The sources of a repo with no app entry: the installed packages (or this runtime's packages/grammar) and the css that scopes the family. */
function installedSources(repoAbs, css, familyId, { grammarDist, extraCss }) {
  const hero = installedPackages(repoAbs, '@heroui/styles')[0] ?? installedPackages(path.join(ROOT, 'packages', 'grammar'), '@heroui/styles')[0] ?? null;
  const heroDir = hero?.dir ?? null;
  const g = grammarDist ? { dir: path.resolve(grammarDist) } : installedPackages(repoAbs, '@starci/grammar').find((x) => fs.existsSync(path.join(x.dir, 'dist', 'common', 'styles.css')));
  const grammarDir = g ? path.join(g.dir, 'dist') : path.join(ROOT, 'packages', 'grammar', 'src');
  const declCount = (file) => customPropertyCount(readText(file));
  const familyFile = familyId === 'core' ? path.join(grammarDir, 'core', 'styles.css') : css.filter((f) => scopesFamily(f, familyId)).sort((a, b) => declCount(b) - declCount(a))[0] ?? null;
  const load = [...(heroDir ? heroFilesOf(heroDir) : []).map((file) => ({ file, source: 'heroui' })), { file: path.join(grammarDir, 'common', 'styles.css'), source: 'grammar' }, ...(familyFile ? [{ file: familyFile, source: 'family' }] : []),
    ...extraCss.map((file) => ({ file: path.resolve(file), source: 'app' }))];
  return { heroDir, grammarDir, grammarInstalled: Boolean(g), familyFile, load, resolveBare: () => [] };
}

/** The missing sources of a resolved set: one message each. */
function sourceErrors({ heroFiles, grammarDir, common, familyFile, familyId, chosen, repoAbs }) {
  const errors = [];
  if (!heroFiles.length) errors.push(`no installed @heroui/styles (dist/heroui.min.css) resolvable from ${chosen ? chosen.entry : repoAbs}`);
  if (!fs.existsSync(common)) errors.push(`no Grammar common/styles.css at ${grammarDir}`);
  if (!familyFile || !fs.existsSync(familyFile)) errors.push(`no css ${chosen ? 'reached from ' + chosen.entry : 'in ' + repoAbs} scopes [data-grammar-family="${familyId}"]`);
  return errors;
}

/**
 * The css sources of one product, resolved the way its app entry resolves them: the app css that imports
 * `@heroui/styles` (the one reaching the family sheet, highest Grammar first; `app` narrows the choice),
 * loaded with its imports in order - HeroUI (compiled heroui.min.css plus its @theme tokens),
 * @starci/grammar, the family sheet, the app's own css. A repo with no such entry falls back to the
 * installed packages (or this runtime's packages/grammar) and the css that scopes the family.
 * `errors` names every source that is missing.
 */
export function discoverSources(repo, family = null, { app = null, grammarDist = null, extraCss = [] } = {}) {
  // A real-component drawing renders against the grammar draw-grammar.mjs picked (grammarDist: a package root, the
  // claude-dist when the product's install does not type-check the draw) and the draw's extra stylesheets (a brand
  // direction token sheet): the expected geometry is resolved from exactly the cascade the render used.
  const repoAbs = repo ? path.resolve(repo) : null;
  if (!repoAbs || !fs.existsSync(repoAbs)) return { errors: [`repo ${repo ?? '(none)'} does not exist`], family, familyId: FAMILIES[family] ?? null, repo: repoAbs };
  if (family && !FAMILIES[family]) return { errors: [`family ${family} is not one of ${Object.keys(FAMILIES).join(', ')}`], family, familyId: null, repo: repoAbs };
  const css = repoCssFiles(repoAbs);
  const bareOf = bareResolver(grammarDist);
  const entries = css
    .filter((f) => /@import\s+(url\()?["']@heroui\/styles/.test(readText(f)))
    .filter((f) => !app || path.resolve(f).startsWith(path.resolve(app)))
    .map((entry) => entryGraph(entry, bareOf, grammarDist));
  const fam = family ?? detectFamily(entries, css);
  const familyId = FAMILIES[fam];
  const reaches = (e) => e.files.some((f) => scopesFamily(f, familyId));
  const ranked = entries.slice().sort((a, b) => Number(reaches(b)) - Number(reaches(a)) || semverDesc({ version: a.grammarVersion }, { version: b.grammarVersion }) || a.entry.localeCompare(b.entry));
  const chosen = ranked[0] ?? null;
  const picked = chosen ? entrySources(chosen, familyId, { bareOf, grammarDist, extraCss }) : installedSources(repoAbs, css, familyId, { grammarDist, extraCss });
  const { heroDir, grammarDir, grammarInstalled, familyFile, load, resolveBare } = picked;
  const heroFiles = heroDir ? heroFilesOf(heroDir) : [];
  const common = path.join(grammarDir, 'common', 'styles.css');
  const errors = sourceErrors({ heroFiles, grammarDir, common, familyFile, familyId, chosen, repoAbs });
  return {
    family: fam, familyId, repo: repoAbs, errors,
    entry: chosen?.entry ?? null, otherEntries: ranked.slice(1).map((e) => e.entry),
    heroui: heroDir ? { dir: heroDir, version: versionOf(heroDir), files: heroFiles } : null,
    grammar: { dir: grammarDir, version: versionOf(path.dirname(grammarDir)), installed: grammarInstalled, common: fs.existsSync(common) ? common : null },
    familyFile, load, resolveBare, drawCss: { grammarDist, extraCss },
    sourceRoots: chosen ? [packageRootOf(chosen.entry, repoAbs), path.join(repoAbs, 'packages')] : [repoAbs],
  };
}
