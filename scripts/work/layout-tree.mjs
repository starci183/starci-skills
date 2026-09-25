#!/usr/bin/env node
// layout-tree.mjs — the product's layout tree, scanned out of the frontend's Next.js `app/` directory.
//
//   node scripts/work/layout-tree.mjs scan    --work <.starciwork> [--app-dir <dir>] [--write] [--json]
//   node scripts/work/layout-tree.mjs scan    --app-dir <dir> [--repo-root <dir>] [--json]
//   node scripts/work/layout-tree.mjs convert --work <.starciwork> [--write] [--json]
//   node scripts/work/layout-tree.mjs capture --work <.starciwork> --node <id> --breakpoint <bp> --theme <t> --file <png> [--url <u>] [--provenance <text>] --write
//   node scripts/work/layout-tree.mjs capture --work <.starciwork> --node <id> --destination <key> [--route <node-id>]... --breakpoint <bp> --theme <t> --file <png> --write
//   node scripts/work/layout-tree.mjs lockup  --work <.starciwork> --from <shell/<capture> | <ui-id>:<layout composite>> --rect x,y,w,h [--theme t] --write
//   node scripts/work/layout-tree.mjs destinations --work <.starciwork> [--promote] [--route <node-id> [--active-nav <key>]] [--write] [--json]
//   node scripts/work/layout-tree.mjs plan    --work <.starciwork> --node <id> [--files layout,page] [--design <ui-id>] --write
//   node scripts/work/layout-tree.mjs slot    <png> [--key ff00ff] [--tolerance 8]
//
// The source of truth for what wraps a screen is the App Router's own file convention, not a sentence in a
// prompt and not a hand-kept list: one node per segment directory under app/ with its special files
// (layout, template, page, loading, error, not-found, default, route) and their digests, route groups
// (x), parallel slots @x and intercepting routes (.)x as nodes of their own. The frontend repository is
// only ever READ; `--write` writes the one record .starciwork/shell/index.yaml (work/layout-tree@1) and,
// for `capture`, the capture bytes under .starciwork/shell/assets/. A re-scan keeps what the owning op
// decided (chrome, captures, personas, lockups, planned nodes) and marks a layout whose file changed as
// needing a re-capture, so the record is regenerated rather than hand-maintained.
//
// Navigation labels come from the route tree plus the i18n message catalogs: the destination registry is
// read out of the source a layout imports (objects with a key and a route), each destination's label is
// looked up in every catalog, and each route is resolved against the scanned pages. A destination with no
// route, a route no page answers, a label a catalog lacks and a top-level route no destination reaches are
// each written into the layout's nav.findings - reported, never papered over.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml, stringifyYaml } from '../../engine/yaml.mjs';
import { cropImage, decodePng, encodePng, keyRect } from './png.mjs';
import { drawingAcceptance } from './direction-part.mjs';

export const TREE_SCHEMA = 'work/layout-tree@1';
export const LEGACY_SHELL_SCHEMA = 'work/app-shell@1';
export const SCANNER = 'scripts/work/layout-tree.mjs';
export const SPECIAL_FILES = ['layout', 'template', 'page', 'loading', 'error', 'not-found', 'default', 'route'];
export const DEFAULT_BREAKPOINTS = [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }];
// Owner ruling 2026-09-24: every drawing set covers desktop AND mobile in the LIGHT theme, so those are the
// captures a layout needs to be settled and the draws a drawn state needs. Dark is optional - kept and
// composed when a tree already captures it, never demanded; another breakpoint the tree declares is optional too.
export const REQUIRED_BREAKPOINTS = ['desktop', 'mobile'];
export const REQUIRED_THEMES = ['light'];
export const THEMES = ['light', 'dark'];
export const SLOT_KEY = [255, 0, 255];
// How a planned layout's drawing gets accepted (mia inc-a4b5b1abdd90): nothing else writes its ui record done
// before the final reconciliation, so interface.draw parks one owner draw-review ask of its parts and applies the
// owner's accept answer onto the record (scripts/work/draw-review.mjs).
export const ACCEPT_PATH = 'interface.draw parks the owner draw-review ask of its drawn parts (scripts/work/draw-review.mjs question) and, on the owner accept answer, writes the record done (draw-review.mjs apply --receipt <answer receipt> --write)';
const SOURCE_EXT = ['.tsx', '.ts', '.jsx', '.js', '.mdx'];
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'coverage', 'storybook-static', '.turbo']);
const LOCALE_PARAMS = new Set(['locale', 'lang', 'lng', 'language']);

const slash = (p) => String(p).split(path.sep).join('/');
const sha256Of = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const fileSha = (file) => sha256Of(fs.readFileSync(file));
const list = (v) => (Array.isArray(v) ? v : []);
const readText = (file) => { try { return fs.readFileSync(file, 'utf8'); } catch { return null; } };
const readYamlFile = (file) => { try { return parseYaml(fs.readFileSync(file, 'utf8')); } catch { return null; } };
const now = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// ---------------------------------------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------------------------------------

/** What an app/ directory name is under the App Router convention. */
export function segmentKindOf(name) {
  if (/^\((?:\.{1,3}|\.\.(?:\)\(\.\.)*)\)/.test(name)) return 'intercept';
  if (/^\(.+\)$/.test(name)) return 'group';
  if (name.startsWith('@')) return 'slot';
  if (/^\[\[\.\.\..+\]\]$/.test(name)) return 'optional-catch-all';
  if (/^\[\.\.\..+\]$/.test(name)) return 'catch-all';
  if (/^\[.+\]$/.test(name)) return 'dynamic';
  return 'static';
}

const joinUrl = (base, part) => (base === '/' ? `/${part}` : `${base}/${part}`);
const urlParts = (url) => url.split('/').filter(Boolean);

/** The URL an intercepting segment presents: (.) is relative to its own level, (..) one up, (...) the root. */
function interceptTarget(name, parentUrl) {
  const marker = name.match(/^((?:\((?:\.{1,3})\))+)/)?.[1] ?? '';
  const rest = name.slice(marker.length);
  let base = urlParts(parentUrl);
  if (marker === '(...)') base = [];
  else if (marker !== '(.)') base = base.slice(0, Math.max(0, base.length - (marker.match(/\(\.\.\)/g) ?? []).length));
  return `/${[...base, rest].join('/')}`;
}

const specialFileIn = (dir, name) => {
  for (const ext of SOURCE_EXT) { const file = path.join(dir, `${name}${ext}`); if (fs.existsSync(file)) return file; }
  return null;
};

// ---------------------------------------------------------------------------------------------------------
// Source reading: imports, the layout's component, the navigation registry
// ---------------------------------------------------------------------------------------------------------

const stripJsonComments = (text) => text.replace(/("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m, str) => str ?? '').replace(/,(\s*[}\]])/g, '$1');

/** tsconfig `paths` of the app root as [{prefix, targets}] with absolute target prefixes. */
function aliasesOf(appRoot) {
  const text = readText(path.join(appRoot, 'tsconfig.json'));
  if (!text) return [];
  let paths = {};
  try { paths = JSON.parse(stripJsonComments(text))?.compilerOptions?.paths ?? {}; } catch { return []; }
  return Object.entries(paths).map(([pattern, targets]) => ({
    prefix: pattern.replace(/\*$/, ''),
    targets: list(targets).map((t) => path.resolve(appRoot, String(t).replace(/\*$/, ''))),
  }));
}

function resolveImport(spec, fromFile, aliases, repoRoot) {
  let bases = [];
  if (spec.startsWith('.')) bases = [path.resolve(path.dirname(fromFile), spec)];
  else {
    const alias = aliases.filter((a) => spec.startsWith(a.prefix)).sort((a, b) => b.prefix.length - a.prefix.length)[0];
    if (!alias) return null;
    bases = alias.targets.map((t) => path.join(t, spec.slice(alias.prefix.length)));
  }
  for (const base of bases) {
    if (!path.resolve(base).startsWith(path.resolve(repoRoot))) continue;
    for (const candidate of [base, ...SOURCE_EXT.map((e) => `${base}${e}`), ...SOURCE_EXT.map((e) => path.join(base, `index${e}`))]) {
      try { if (fs.statSync(candidate).isFile()) return candidate; } catch { /* next */ }
    }
  }
  return null;
}

const importsOf = (text) => [...text.matchAll(/(?:import|export)\s+(?:type\s+)?(?:[^'"`;]*?\s+from\s+)?['"]([^'"]+)['"]/g)].map((m) => m[1]);

/** The files a layout reaches through its imports, breadth first, within the repository. */
function importClosure(entry, aliases, repoRoot, { maxDepth = 4, maxFiles = 150 } = {}) {
  const seen = new Set([entry]);
  let frontier = [entry];
  for (let depth = 0; depth < maxDepth && frontier.length && seen.size < maxFiles; depth += 1) {
    const next = [];
    for (const file of frontier) {
      const text = readText(file);
      if (!text) continue;
      for (const spec of importsOf(text)) {
        const resolved = resolveImport(spec, file, aliases, repoRoot);
        if (resolved && !seen.has(resolved) && !resolved.split(path.sep).includes('node_modules') && !/\.(?:spec|test|stories)\.[jt]sx?$/.test(resolved)) {
          seen.add(resolved); next.push(resolved);
        }
      }
    }
    frontier = next;
  }
  return [...seen];
}

/** The chrome component a layout file renders, and whether it can only be a passthrough (document + providers). */
export function layoutComponentOf(text) {
  const imported = new Set();
  for (const m of text.matchAll(/import\s+(?:type\s+)?([^'"]*?)\s+from\s+['"][^'"]+['"]/g)) {
    for (const name of m[1].replace(/[{}]/g, ',').split(',').map((s) => s.trim().split(/\s+as\s+/).pop()).filter(Boolean)) if (/^[A-Z]/.test(name)) imported.add(name);
  }
  // A JSX tag, not a TypeScript type argument: `Promise<Metadata>` has an identifier right before the `<`.
  const tags = [...text.matchAll(/(?<![A-Za-z0-9_$\])])<([A-Z][A-Za-z0-9_]*)[\s/>]/g)].map((m) => m[1]).filter((t) => imported.has(t));
  const chrome = tags.filter((t) => !/Providers?$/.test(t) && t !== 'Fragment' && t !== 'Suspense');
  return { component: chrome[0] ?? null, passthrough: chrome.length === 0 };
}

/** Objects with a key and a route in one source file: the navigation registry, in source order. */
export function registryIn(text) {
  const items = [];
  for (const m of text.matchAll(/\{[^{}]*\}/g)) {
    const body = m[0];
    const key = body.match(/\b(?:key|id)\s*:\s*['"`]([a-z0-9][\w-]*)['"`]/)?.[1];
    const routeMatch = body.match(/\b(?:route|href|path|url)\s*:\s*(null|['"`](\/[^'"`]*)['"`])/);
    if (!key || !routeMatch) continue;
    const group = body.match(/\bgroup\s*:\s*['"`]([a-z0-9][\w-]*)['"`]/)?.[1];
    items.push({ key, route: routeMatch[1] === 'null' ? null : routeMatch[2], ...(group ? { group } : {}) });
  }
  return items;
}

/** How the registry file turns a key into a message key: its translation namespace and label prefix. */
function labelKeyPattern(text) {
  const ns = text.match(/useTranslations\(\s*['"]([\w.]+)['"]\s*\)/)?.[1] ?? text.match(/getTranslations\(\s*['"]([\w.]+)['"]\s*\)/)?.[1] ?? null;
  const prefix = text.match(/\bt\(\s*`([\w.]*)\$\{/)?.[1] ?? null;
  return { ns, prefix };
}

const getPath = (obj, dotted) => dotted.split('.').reduce((at, k) => (at && typeof at === 'object' ? at[k] : undefined), obj);
const keyPathsEndingIn = (obj, suffix, trail = []) => Object.entries(obj ?? {}).flatMap(([k, v]) => {
  const here = [...trail, k];
  if (v && typeof v === 'object') return keyPathsEndingIn(v, suffix, here);
  return here.join('.').endsWith(suffix) ? [here.join('.')] : [];
});

// ---------------------------------------------------------------------------------------------------------
// i18n
// ---------------------------------------------------------------------------------------------------------

const LOCALE_FILE = /^([a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*)\.json$/;

/** The message catalogs under the app root: messages/<locale>.json or locales/<locale>.json (or a dir of namespaces). */
export function catalogsOf(appRoot) {
  const found = [];
  const walk = (dir, depth) => {
    if (depth > 4) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (!e.isDirectory() || SKIP_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.name === 'messages' || e.name === 'locales') {
        for (const f of fs.readdirSync(full, { withFileTypes: true })) {
          const m = f.name.match(LOCALE_FILE);
          if (f.isFile() && m) found.push({ locale: m[1], files: [path.join(full, f.name)], merge: null });
          else if (f.isDirectory() && /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(f.name)) {
            const files = fs.readdirSync(path.join(full, f.name)).filter((n) => n.endsWith('.json')).map((n) => path.join(full, f.name, n));
            if (files.length) found.push({ locale: f.name, files, merge: 'namespace' });
          }
        }
      } else walk(full, depth + 1);
    }
  };
  walk(appRoot, 0);
  return found.map((c) => {
    const messages = {};
    for (const file of c.files) {
      let doc = {};
      try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* unreadable catalog: empty */ }
      if (c.merge === 'namespace') messages[path.basename(file, '.json')] = doc; else Object.assign(messages, doc);
    }
    return { locale: c.locale, files: c.files, messages };
  }).sort((a, b) => a.locale.localeCompare(b.locale));
}

/** defaultLocale and the locale list as the app's i18n config spells them, when it does. */
export function localeConfigOf(appRoot) {
  const texts = [];
  const walk = (dir, depth) => {
    if (depth > 3) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && !SKIP_DIRS.has(e.name)) walk(full, depth + 1);
      else if (e.isFile() && /(?:^|[/\\])i18n[/\\][^/\\]+\.[jt]sx?$|(?:^|[/\\])i18n\.[jt]s$/.test(full) && !/\.spec\.|\.test\./.test(e.name)) texts.push({ file: full, text: readText(full) ?? '' });
    }
  };
  walk(appRoot, 0);
  let def = null, locales = null, source = null;
  for (const { file, text } of texts) {
    const d = text.match(/defaultLocale\s*[:=]\s*['"]([\w-]+)['"]/)?.[1] ?? text.match(/DEFAULT_LOCALE[^=\n]*=\s*['"]([\w-]+)['"]/)?.[1];
    const l = text.match(/\blocales\s*[:=]\s*\[([^\]]*)\]/)?.[1] ?? text.match(/\bLOCALES\s*=\s*\[([^\]]*)\]/)?.[1];
    if (d && !def) { def = d; source = slash(file); }
    if (l && !locales) { const parsed = [...l.matchAll(/['"]([\w-]+)['"]/g)].map((m) => m[1]); if (parsed.length) locales = parsed; }
  }
  return { default: def, locales, source };
}

// ---------------------------------------------------------------------------------------------------------
// The scan
// ---------------------------------------------------------------------------------------------------------

function gitRevision(repoRoot) {
  try {
    const head = fs.readFileSync(path.join(repoRoot, '.git', 'HEAD'), 'utf8').trim();
    if (/^[a-f0-9]{40}$/.test(head)) return head;
    const ref = head.match(/^ref:\s*(.+)$/)?.[1];
    if (!ref) return null;
    const loose = path.join(repoRoot, '.git', ref);
    if (fs.existsSync(loose)) return fs.readFileSync(loose, 'utf8').trim();
    const packed = readText(path.join(repoRoot, '.git', 'packed-refs')) ?? '';
    return packed.split('\n').find((l) => l.endsWith(` ${ref}`))?.split(' ')[0] ?? null;
  } catch { return null; }
}

/** Page nodes a navigation route can land on: not inside a slot or an intercept, with a page file. */
const landingPages = (nodes) => {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const inside = (n) => { for (let at = n; at; at = byId.get(at.parent)) if (at.segmentKind === 'slot' || at.segmentKind === 'intercept') return true; return false; };
  return nodes.filter((n) => n.files?.page && !inside(n));
};

const matchUrl = (pattern, url) => {
  const p = urlParts(pattern), u = urlParts(url);
  for (let i = 0; i < p.length; i += 1) {
    const kind = segmentKindOf(p[i]);
    if (kind === 'catch-all') return u.length > i;
    if (kind === 'optional-catch-all') return true;
    if (i >= u.length) return false;
    if (kind !== 'dynamic' && p[i] !== u[i]) return false;
  }
  return p.length === u.length;
};

/** The locale-less URL of a node: the leading locale parameter segment removed. */
const localelessUrl = (url, localeParam) => {
  const parts = urlParts(url);
  return localeParam && parts[0] === `[${localeParam}]` ? `/${parts.slice(1).join('/')}` : url;
};

/** The page node a locale-less navigation route resolves to (static segments preferred), or null. */
export function resolveNavRoute(nodes, route, localeParam) {
  if (typeof route !== 'string') return null;
  const clean = route.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  const candidates = landingPages(nodes).filter((n) => matchUrl(localelessUrl(n.url, localeParam), clean));
  candidates.sort((a, b) => urlParts(a.url).filter((s) => segmentKindOf(s) !== 'static').length - urlParts(b.url).filter((s) => segmentKindOf(s) !== 'static').length);
  return candidates[0]?.id ?? null;
}

/**
 * Scan an app/ directory. Returns {app, source, i18n, productLocale, nodes} - the record's scanned half.
 * `repoRoot` is the repository the paths are recorded relative to; `appRoot` the application directory
 * (where tsconfig.json and the i18n catalogs live), defaulting to the parent of src/ or of app/.
 */
export function scanAppDir(appDir, { repoRoot = null, appRoot = null, repository = null } = {}) {
  const dirAbs = path.resolve(appDir);
  if (!fs.existsSync(dirAbs) || !fs.statSync(dirAbs).isDirectory()) throw new Error(`${appDir}: not an app/ directory`);
  const rootAbs = path.resolve(appRoot ?? (path.basename(path.dirname(dirAbs)) === 'src' ? path.dirname(path.dirname(dirAbs)) : path.dirname(dirAbs)));
  const repoAbs = path.resolve(repoRoot ?? rootAbs);
  const rel = (abs) => slash(path.relative(repoAbs, abs));
  const digests = [];
  const nodes = [];
  const walk = (dir, parent, name) => {
    const kind = parent ? segmentKindOf(name) : 'root';
    const id = parent ? (parent.id === '/' ? `/${name}` : `${parent.id}/${name}`) : '/';
    const url = !parent ? '/' : kind === 'group' || kind === 'slot' ? parent.url : kind === 'intercept' ? interceptTarget(name, parent.url) : joinUrl(parent.url, name);
    const files = {};
    for (const special of SPECIAL_FILES) {
      const file = specialFileIn(dir, special);
      if (file) { const sha = fileSha(file); files[special] = { path: rel(file), sha256: sha }; digests.push([rel(file), sha]); }
    }
    const node = { id, parent: parent?.id ?? null, segment: parent ? name : '/', segmentKind: kind, url, origin: 'repository', ...(Object.keys(files).length ? { files } : {}) };
    const at = nodes.length;
    nodes.push(node);
    const children = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() && !SKIP_DIRS.has(e.name) && !e.name.startsWith('_') && !e.name.startsWith('.')).map((e) => e.name).sort();
    let hasContent = Object.keys(files).length > 0;
    for (const child of children) if (walk(path.join(dir, child), node, child)) hasContent = true;
    if (!hasContent && parent) { nodes.splice(at, 1); return false; }
    return true;
  };
  walk(dirAbs, null, '/');
  // Node order: parents first, then children in name order (the walk already produced it).
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const pages = landingPages(nodes);
  for (const node of nodes) {
    let inIntercept = false;
    for (let at = node; at; at = byId.get(at.parent)) if (at.segmentKind === 'intercept') { inIntercept = true; break; }
    if (inIntercept && node.files?.page) node.intercepts = pages.find((p) => p.url === node.url)?.id ?? undefined;
    if (node.intercepts === undefined) delete node.intercepts;
  }
  const localeRoot = nodes.find((n) => n.parent === '/' && n.segmentKind === 'dynamic' && LOCALE_PARAMS.has(n.segment.slice(1, -1)));
  const localeParam = localeRoot ? localeRoot.segment.slice(1, -1) : null;

  // The catalogs stay out of source.digest: a catalog is shared and hot (every workflow adds strings to it), so
  // the tree records only the message keys it uses and a digest of their values per locale (i18n.used).
  const catalogs = catalogsOf(rootAbs);
  const config = localeConfigOf(rootAbs);
  const catalogLocales = catalogs.map((c) => c.locale);
  const productLocale = config.default || catalogLocales.length ? {
    default: config.default ?? catalogLocales[0],
    fallback: config.default ?? catalogLocales[0],
    locales: config.locales ?? catalogLocales,
    source: config.source ? `${rel(path.resolve(config.source))} (defaultLocale / locales)` : 'message catalog file names',
  } : null;

  const aliases = aliasesOf(rootAbs);
  const claimed = new Set();
  for (const node of nodes) {
    if (!node.files?.layout) continue;
    const layoutAbs = path.join(repoAbs, node.files.layout.path);
    const text = readText(layoutAbs) ?? '';
    const { component, passthrough } = layoutComponentOf(text);
    const layout = { ...(component ? { component } : {}), chrome: passthrough ? 'passthrough' : 'unknown', state: passthrough ? 'done' : 'todo', rev: 1 };
    const closure = importClosure(layoutAbs, aliases, repoAbs).filter((f) => f !== layoutAbs);
    let registry = null;
    for (const file of closure) {
      if (claimed.has(file)) continue;
      const found = registryIn(readText(file) ?? '');
      if (found.length >= 2 && (!registry || found.length > registry.items.length)) registry = { file, items: found };
    }
    if (registry) {
      claimed.add(registry.file);
      const text2 = readText(registry.file) ?? '';
      digests.push([rel(registry.file), fileSha(registry.file)]);
      const { ns, prefix } = labelKeyPattern(text2);
      const componentName = text2.match(/export\s+(?:const|function)\s+([A-Z][A-Za-z0-9_]*)/)?.[1];
      const findings = [];
      const items = registry.items.map((item) => {
        let i18nKey = ns || prefix ? [ns, `${prefix ?? ''}${item.key}`].filter(Boolean).join('.') : null;
        if (!i18nKey || !catalogs.some((c) => typeof getPath(c.messages, i18nKey) === 'string')) {
          const guesses = [...new Set(catalogs.flatMap((c) => keyPathsEndingIn(c.messages, `nav.${item.key}`)))];
          if (guesses.length === 1) i18nKey = guesses[0];
        }
        const labels = {};
        for (const c of catalogs) { const label = i18nKey ? getPath(c.messages, i18nKey) : undefined; if (typeof label === 'string' && label.trim()) labels[c.locale] = label; }
        for (const c of catalogs) if (!labels[c.locale]) findings.push({ code: 'NAV_LABEL_MISSING', detail: `${item.key} has no ${c.locale} label${i18nKey ? ` at ${i18nKey}` : ''} in ${rel(c.files[0])}` });
        const target = resolveNavRoute(nodes, item.route, localeParam);
        if (item.route === null) findings.push({ code: 'NAV_ROUTE_NULL', detail: `${item.key} has no route - the navigation draws it disabled and no page answers it` });
        else if (!target) findings.push({ code: 'NAV_ROUTE_MISSING', detail: `${item.key} navigates to ${item.route}, which no page under app/ answers` });
        return { key: item.key, route: item.route, ...(i18nKey ? { i18nKey } : {}), ...(item.group ? { group: item.group } : {}), target, ...(item.route === null ? { disabled: true } : {}), labels: Object.keys(labels).length ? labels : { [catalogs[0]?.locale ?? 'en']: item.key } };
      });
      // Top-level routes under this layout that no destination reaches.
      const baseParts = urlParts(localelessUrl(node.url, localeParam));
      const reached = new Set(items.map((i) => i.target).filter(Boolean).map((id) => urlParts(localelessUrl(byId.get(id).url, localeParam))[baseParts.length]));
      const under = pages.filter((p) => { for (let at = p; at; at = byId.get(at.parent)) if (at.id === node.id) return true; return false; });
      const heads = new Map();
      for (const p of under) {
        const head = urlParts(localelessUrl(p.url, localeParam))[baseParts.length];
        if (head === undefined) continue;
        heads.set(head, (heads.get(head) ?? 0) + 1);
      }
      for (const [head, count] of heads) if (!reached.has(head)) findings.push({ code: 'ROUTE_NOT_IN_NAV', detail: `/${[...baseParts, head].join('/')} (${count} page${count === 1 ? '' : 's'}) is reached by no navigation destination` });
      layout.nav = { ...(componentName ? { component: componentName } : {}), source: rel(registry.file), items, ...(findings.length ? { findings } : {}) };
    }
    node.layout = layout;
  }
  digests.sort((a, b) => a[0].localeCompare(b[0]));
  const revision = gitRevision(repoAbs);
  const catalogFiles = catalogs.flatMap((c) => c.files.map((f) => ({ locale: c.locale, path: rel(f), sha256: fileSha(f) })));
  const scan = {
    app: { ...(repository ? { repository } : {}), root: rel(rootAbs) || '.', appDir: rel(dirAbs), framework: 'next-app-router', ...(localeParam ? { localeParam } : {}) },
    source: { scanner: SCANNER, ...(revision ? { revision } : {}), digest: digestOfParts(digests) },
    i18n: catalogs.length ? { catalogs: catalogFiles, used: keyedI18n(catalogs, usedI18nKeys({ nodes })) } : undefined,
    productLocale,
    nodes,
  };
  // Not part of the record: the code digest parts (to re-derive a pre-keyed whole-file digest) and the parsed
  // catalogs (to digest the keys a merged record uses).
  Object.defineProperty(scan, 'codeParts', { value: digests, enumerable: false });
  Object.defineProperty(scan, 'catalogs', { value: catalogs, enumerable: false });
  return scan;
}

const digestOfParts = (parts) => sha256Of([...parts].sort((a, b) => a[0].localeCompare(b[0])).map(([p, s]) => `${p}\0${s}`).join('\n'));

// ---------------------------------------------------------------------------------------------------------
// The message keys the tree uses (nivo inc-13f6af8494bf)
// ---------------------------------------------------------------------------------------------------------
//
// A message catalog is shared by every workflow, so a whole-file digest stales the tree on every unrelated
// string. The tree records the keys it USES - nav labels (i18nKey), layout titles (titleKey) and any key a
// node, layout, destination or capture names - and one digest of their values per locale. A catalog change
// stales the tree only when a used key's value changed or a used key disappeared.

const KEY_FIELDS = new Set(['i18nKey', 'titleKey', 'labelKey', 'messageKey']);
const KEY_LISTS = new Set(['i18nKeys', 'messageKeys']);

/** Every message key the tree references, sorted and unique. */
export function usedI18nKeys(record) {
  const keys = new Set();
  const walk = (v) => {
    if (Array.isArray(v)) { for (const x of v) walk(x); return; }
    if (!v || typeof v !== 'object') return;
    for (const [k, x] of Object.entries(v)) {
      if (KEY_FIELDS.has(k)) { if (typeof x === 'string' && x.trim()) keys.add(x.trim()); }
      else if (KEY_LISTS.has(k)) { for (const y of list(x)) if (typeof y === 'string' && y.trim()) keys.add(y.trim()); }
      else walk(x);
    }
  };
  walk(record?.nodes);
  walk(record?.brand);
  return [...keys].sort();
}

/** One digest of the used keys' values in a catalog: key and value per line, an absent key marked absent. */
export function keyedDigest(messages, keys) {
  return sha256Of(list(keys).map((k) => {
    const v = getPath(messages ?? {}, k);
    return `${k}\0${v === undefined ? '\u0001absent' : typeof v === 'string' ? v : JSON.stringify(v)}`;
  }).join('\n'));
}

/** i18n.used: {keys, locales: [{locale, sha256}]} for parsed catalogs ({locale, messages}). */
export function keyedI18n(catalogs, keys) {
  return { keys: [...keys], locales: list(catalogs).map((c) => ({ locale: c.locale, sha256: keyedDigest(c.messages, keys) })) };
}

const catalogSet = (catalogs) => list(catalogs).map((c) => `${c.locale} ${c.path}`).sort();

/**
 * Whether app/ drifted from what the tree recorded, judged against a fresh scan. Returns {stale, changed,
 * legacy}: `changed` names what moved; `legacy` is true when the record still carries the whole-file catalog
 * digest (it stays valid until the next re-scan and is judged by the keys it uses).
 */
export function sourceDrift(record, scan) {
  const changed = [];
  const recorded = list(record?.i18n?.catalogs);
  const used = record?.i18n?.used;
  const legacy = recorded.length > 0 && !Array.isArray(used?.keys);
  // A pre-keyed digest folded the catalog files in: re-derive it from the fresh code and the RECORDED catalog
  // digests, so only code moves it.
  const code = legacy ? digestOfParts([...list(scan.codeParts), ...recorded.map((c) => [c.path, c.sha256])]) : scan.source?.digest;
  const nodes = nodesOf(record);
  const now = new Map(list(scan.nodes).map((n) => [n.id, n]));
  if (record?.source?.digest && code !== record.source.digest) {
    const before = changed.length;
    for (const n of nodes.filter((x) => x.origin !== 'planned')) {
      const fresh = now.get(n.id);
      if (!fresh) { changed.push(`${n.id} removed`); continue; }
      for (const [kind, file] of Object.entries(n.files ?? {})) if (file?.sha256 && fresh.files?.[kind]?.sha256 !== file.sha256) changed.push(`${n.id} ${kind}`);
    }
    const ids = new Set(nodes.map((n) => n.id));
    for (const id of now.keys()) if (!ids.has(id)) changed.push(`${id} added`);
    if (changed.length === before) changed.push('a navigation source');
  }
  const freshCatalogs = list(scan.i18n?.catalogs);
  if (catalogSet(recorded).join('\n') !== catalogSet(freshCatalogs).join('\n')) changed.push(`the message catalogs (${freshCatalogs.map((c) => c.path).join(', ') || 'none'} now)`);
  // Nav labels: what the fresh scan resolves (message key, label per locale) against what the tree recorded.
  for (const n of nodes.filter((x) => x.origin !== 'planned' && x.layout?.nav)) {
    const fresh = now.get(n.id);
    if (!fresh) continue;
    const before = new Map(list(n.layout.nav.items).map((i) => [i?.key, i]));
    const after = new Map(list(fresh.layout?.nav?.items).map((i) => [i?.key, i]));
    for (const [key, item] of before) {
      const next = after.get(key);
      if (!next) { changed.push(`${n.id} nav ${key} removed`); continue; }
      if ((item?.i18nKey ?? null) !== (next.i18nKey ?? null)) { changed.push(`${n.id} nav ${key} now reads ${next.i18nKey ?? 'no message key'}`); continue; }
      for (const locale of new Set([...Object.keys(item?.labels ?? {}), ...Object.keys(next.labels ?? {})])) {
        if (item?.labels?.[locale] !== next.labels?.[locale]) changed.push(`${n.id} nav ${key} ${locale} label${item?.i18nKey ? ` (${item.i18nKey})` : ''}`);
      }
    }
    for (const key of after.keys()) if (!before.has(key)) changed.push(`${n.id} nav ${key} added`);
  }
  // Every used key (titles, capture keys, labels): the keyed digest per locale. A pre-keyed record recorded no
  // value for a key outside the nav, so a catalog change with such a key in use is stale until re-scanned.
  const parsed = list(scan.catalogs);
  if (!legacy && Array.isArray(used?.keys)) {
    for (const c of parsed) {
      const was = list(used.locales).find((l) => l?.locale === c.locale)?.sha256;
      if (!was || keyedDigest(c.messages, used.keys) === was) continue;
      const gone = used.keys.filter((k) => getPath(c.messages, k) === undefined);
      changed.push(`${c.locale} used key values${gone.length ? ` (absent now: ${gone.slice(0, 4).join(', ')})` : ''}`);
    }
  } else if (legacy) {
    const navKeys = new Set(nodes.flatMap((n) => list(n.layout?.nav?.items)).map((i) => i?.i18nKey).filter(Boolean));
    const other = usedI18nKeys(record).filter((k) => !navKeys.has(k));
    const moved = recorded.some((c) => freshCatalogs.find((f) => f.path === c.path)?.sha256 !== c.sha256);
    if (moved && other.length) changed.push(`the catalogs changed and ${other.slice(0, 4).join(', ')} ha${other.length === 1 ? 's' : 've'} no recorded value to compare`);
  }
  return { stale: changed.length > 0, changed: [...new Set(changed)], legacy };
}

// ---------------------------------------------------------------------------------------------------------
// Reading the record, resolving routes and layout chains
// ---------------------------------------------------------------------------------------------------------

export const shellFileOf = (workRoot) => path.join(workRoot, 'shell', 'index.yaml');

/** The tree's shell record: {file, dir, record} when it exists, {error} when it does not parse, null when absent. */
export function readShellRecord(workRoot) {
  const file = shellFileOf(workRoot);
  if (!fs.existsSync(file)) return null;
  const record = readYamlFile(file);
  if (!record || typeof record !== 'object' || Array.isArray(record)) return { file, dir: path.dirname(file), error: 'does not parse as a YAML object' };
  return { file, dir: path.dirname(file), record };
}

export const isLayoutTree = (record) => record?.schema === TREE_SCHEMA;
export const nodesOf = (record) => list(record?.nodes).filter((n) => n && typeof n.id === 'string');
export const nodeById = (record, id) => nodesOf(record).find((n) => n.id === id) ?? null;

/** The node chain from the root to `id` (inclusive), or null when `id` is not in the tree. */
export function chainOf(record, id) {
  const byId = new Map(nodesOf(record).map((n) => [n.id, n]));
  if (!byId.has(id)) return null;
  const chain = [];
  for (let at = byId.get(id), guard = 0; at && guard < 200; at = byId.get(at.parent), guard += 1) chain.unshift(at);
  return chain;
}

/** The layout nodes wrapping `id`, outermost first. `self` includes the node's own layout (a layout drawing excludes it). */
export function layoutChainOf(record, id, { self = true } = {}) {
  const chain = chainOf(record, id);
  if (!chain) return null;
  return chain.filter((n) => (n.files?.layout || n.layout) && (self || n.id !== id));
}

/** The nearest existing ancestor id of a route path that is not (yet) in the tree, walking up by segment. */
export function nearestExisting(record, route) {
  const parts = String(route).split('/').filter(Boolean);
  for (let n = parts.length; n >= 0; n -= 1) {
    const id = n ? `/${parts.slice(0, n).join('/')}` : '/';
    if (nodeById(record, id)) return id;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------
// A ui record's place in the tree: route, surface (per breakpoint), drawer direction, routed, host
// ---------------------------------------------------------------------------------------------------------

export const SURFACES = ['layout', 'page', 'modal', 'drawer', 'loading', 'error', 'not-found'];
export const OVERLAY_SURFACES = new Set(['modal', 'drawer']);
export const DRAWER_DIRECTIONS = ['left', 'right', 'top', 'bottom'];
/** The file an App Router segment must carry for a surface drawn at that route. */
export const SURFACE_FILE = { layout: 'layout', page: 'page', loading: 'loading', error: 'error', 'not-found': 'not-found' };

const perBreakpoint = (value, bp) => (typeof value === 'string' ? value : value && typeof value === 'object' ? value[bp] ?? value.default ?? null : null);
/** The surface a ui record presents at breakpoint `bp` ({desktop: drawer, mobile: modal} overrides). */
export const surfaceAt = (ui, bp) => perBreakpoint(ui?.surface, bp);
/** The edge a drawer is anchored to at `bp` ({desktop: right, mobile: bottom} overrides). */
export const directionAt = (ui, bp) => perBreakpoint(ui?.direction, bp);
/** Every surface value a ui record names, across breakpoints. */
export const surfaceValues = (ui) => (typeof ui?.surface === 'string' ? [ui.surface] : ui?.surface && typeof ui.surface === 'object' ? Object.values(ui.surface) : []);
export const isOverlayRecord = (ui) => surfaceValues(ui).some((s) => OVERLAY_SURFACES.has(s));

/** Every work/ui-screen@1 record under the Work root's features/: Map id -> {file, record}. */
export function loadUiRecords(workRoot) {
  const found = new Map();
  const walk = (dir, depth) => {
    if (depth > 8) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (!['assets', 'evidence', 'runs', 'node_modules'].includes(e.name)) walk(full, depth + 1); continue; }
      if (e.name !== 'index.yaml') continue;
      const record = readYamlFile(full);
      if (record?.schema === 'work/ui-screen@1' && typeof record.id === 'string') found.set(record.id, { file: full, record });
    }
  };
  walk(path.join(workRoot, 'features'), 0);
  return found;
}

/** Breakpoint names and themes the tree declares (what a layout may be captured and a draw composed at). */
export const matrixOf = (record) => ({
  breakpoints: list(record?.breakpoints).map((b) => b?.name).filter(Boolean),
  themes: list(record?.themes).filter(Boolean),
});

/** The cells that are required, not just allowed: desktop and mobile, light (REQUIRED_BREAKPOINTS/THEMES). */
export const requiredMatrixOf = () => ({ breakpoints: [...REQUIRED_BREAKPOINTS], themes: [...REQUIRED_THEMES] });

/**
 * Whether one layout node is settled for drawing under it, with the reasons it is not.
 * `uiLoader(id)` returns {file, record} for a ui record id (for a planned layout's design), or null.
 */
export function layoutSettlement(record, node, { shellDir = null, uiLoader = null } = {}) {
  const reasons = [];
  const layout = node.layout;
  if (!layout) return { settled: false, reasons: [`${node.id} has a layout file but no layout block - re-run the scan`] };
  if (layout.chrome === 'unknown') reasons.push(`${node.id} chrome is unknown - brand.decide decides visible or passthrough`);
  if (layout.state !== 'done') reasons.push(`${node.id} layout is ${layout.state ?? 'stateless'}, not done`);
  if (layout.chrome === 'visible') {
    const { breakpoints, themes } = requiredMatrixOf(record);
    if (node.origin === 'planned' || (!list(layout.captures).length && layout.design)) {
      if (!layout.design) reasons.push(`${node.id} is planned with no design ui record to draw it`);
      else {
        const design = uiLoader?.(layout.design);
        if (!design) reasons.push(`${node.id} is drawn by ${layout.design}, which does not exist`);
        else {
          const acceptance = drawingAcceptance(design.record, path.dirname(design.file));
          if (!acceptance.accepted) reasons.push(`${node.id} is drawn by ${layout.design}, which is ${acceptance.reason}${design.record.state !== 'done' ? ` - ${ACCEPT_PATH}` : ''}`);
          for (const bp of breakpoints) for (const theme of themes) {
            const hit = designCaptureOf(design, bp, theme);
            if (!hit) reasons.push(`${layout.design} has no accepted layout composite at ${bp}/${theme} with a measured childSlot`);
          }
        }
      }
    } else {
      for (const bp of breakpoints) for (const theme of themes) {
        const capture = list(layout.captures).find((c) => c?.breakpoint === bp && c?.theme === theme);
        if (!capture) { reasons.push(`${node.id} has no capture at ${bp}/${theme}`); continue; }
        if (!capture.slot) reasons.push(`${node.id} capture ${capture.path} has no measured slot`);
        if (shellDir) {
          const file = path.join(shellDir, capture.path);
          if (!fs.existsSync(file)) reasons.push(`${node.id} capture ${capture.path} is not on disk`);
          else if (capture.sha256 && fileSha(file) !== capture.sha256) reasons.push(`${node.id} capture ${capture.path} no longer hashes to its recorded sha256`);
        }
      }
      // Each destination is a render of its own, held to the same matrix, disk and digest as the default.
      for (const d of destinationsOf(record, node)) {
        for (const bp of breakpoints) for (const theme of themes) {
          const capture = d.captures.find((c) => c?.breakpoint === bp && c?.theme === theme);
          if (!capture) { reasons.push(`${node.id} destination ${d.key} has no capture at ${bp}/${theme}`); continue; }
          if (!capture.slot && !d.legacy) reasons.push(`${node.id} destination ${d.key} capture ${capture.path} has no measured slot`);
          if (shellDir) {
            const file = path.join(shellDir, capture.path);
            if (!fs.existsSync(file)) reasons.push(`${node.id} destination ${d.key} capture ${capture.path} is not on disk`);
            else if (capture.sha256 && fileSha(file) !== capture.sha256) reasons.push(`${node.id} destination ${d.key} capture ${capture.path} no longer hashes to its recorded sha256`);
          }
        }
      }
    }
  }
  return { settled: reasons.length === 0, reasons };
}

/** A design ui record's accepted layout composite at bp/theme: {path (relative to the ui dir), sha256, slot}. */
export function designCaptureOf(design, bp, theme) {
  const assets = [...list(design?.record?.assets), ...list(design?.record?.ui?.assets)];
  const hit = assets.find((a) => a?.composite?.breakpoint === bp && a.composite.theme === theme && a.composite.presentation === 'page' && a.composite.childSlot && a.selected !== false);
  return hit ? { path: hit.path, sha256: hit.sha256, slot: hit.composite.childSlot, width: hit.width, height: hit.height, dir: path.dirname(design.file) } : null;
}

// ---------------------------------------------------------------------------------------------------------
// Destinations: one layout, several active states (inc-8b2e1cb6fbbf, inc-41db3976f275)
// ---------------------------------------------------------------------------------------------------------
//
// A layout whose chrome marks where the user is - a sidebar with the active destination, a tab strip with the
// active tab - renders differently under each of its routes. `layout.captures` is the layout's default render;
// `layout.destinations` holds one entry per active state: {key, routes: [node ids under the layout], captures}.
// A page composite takes the destination whose route is the ui record's route or its nearest ancestor (the
// longest match); an explicit `shell.layouts[].destination` binding overrides the route, and `shell.activeNav`
// decides when no route matches. A tree written before destinations were in the schema kept them as
// `extensions.destinationCaptures` ({note, items: [{key, breakpoint, path, sha256}]}); that block is still read
// (light theme, keys resolved against the layout's nav items and extensions.targetLayouts tabRoutes) until
// `layout-tree.mjs destinations --promote` moves it into the nodes.

/** Whether node id `route` is `base` or sits below it. */
const underNode = (route, base) => route === base || String(route).startsWith(base === '/' ? '/' : `${base}/`);

/** The legacy extensions.destinationCaptures of a tree mapped onto one layout node: [{key, routes, captures, legacy}]. */
export function legacyDestinationsOf(record, node) {
  const items = list(record?.extensions?.destinationCaptures?.items).filter((i) => i && typeof i.key === 'string' && i.path);
  if (!items.length || !node?.layout) return [];
  const routesByKey = new Map();
  for (const item of list(node.layout.nav?.items)) if (item?.key && typeof item.target === 'string') routesByKey.set(item.key, [item.target]);
  const nodes = nodesOf(record);
  for (const [name, entry] of Object.entries(record?.extensions?.targetLayouts ?? {})) {
    if (!entry || typeof entry !== 'object' || entry.node !== node.id) continue;
    for (const url of list(entry.tabRoutes)) {
      const target = nodes.find((n) => n.url === url && underNode(n.id, node.id));
      if (!target) continue;
      const key = url === node.url ? name : `${name}-${urlParts(url).pop()}`;
      if (!routesByKey.has(key)) routesByKey.set(key, [target.id]);
    }
  }
  const byKey = new Map();
  for (const item of items) {
    const routes = routesByKey.get(item.key);
    if (!routes) continue;
    if (!byKey.has(item.key)) byKey.set(item.key, { key: item.key, routes, captures: [], legacy: true });
    byKey.get(item.key).captures.push({
      breakpoint: item.breakpoint, theme: item.theme ?? 'light', ...(item.locale ? { locale: item.locale } : {}), path: item.path, sha256: item.sha256,
      ...(item.width ? { width: item.width } : {}), ...(item.height ? { height: item.height } : {}), ...(item.slot ? { slot: item.slot } : {}), kind: 'render',
    });
  }
  return [...byKey.values()];
}

/** The destinations of one layout node: `layout.destinations`, else the tree's legacy extension block. */
export function destinationsOf(record, node) {
  const own = list(node?.layout?.destinations).filter((d) => d && typeof d.key === 'string');
  return own.length ? own.map((d) => ({ ...d, routes: list(d.routes), captures: list(d.captures) })) : legacyDestinationsOf(record, node);
}

/**
 * The destination of `node` a ui record at `route` shows active: the binding's explicit
 * `shell.layouts[{node}].destination`, else the destination with the longest route at or above `route`, else
 * the one keyed by `shell.activeNav`. Returns {destination, by: binding|route|activeNav} | {unknown: key} | null.
 */
export function destinationFor(record, node, { route = null, activeNav = null, key = null } = {}) {
  const dests = destinationsOf(record, node);
  if (key) { const hit = dests.find((d) => d.key === key); return hit ? { destination: hit, by: 'binding' } : { unknown: key }; }
  if (!dests.length) return null;
  let best = null, length = -1;
  if (typeof route === 'string') for (const d of dests) for (const r of d.routes) if (typeof r === 'string' && underNode(route, r) && r.length > length) { best = d; length = r.length; }
  if (best) return { destination: best, by: 'route' };
  const byNav = activeNav ? dests.find((d) => d.key === activeNav) : null;
  return byNav ? { destination: byNav, by: 'activeNav' } : null;
}

/** Every recorded capture of a layout node (default and per destination) at bp/theme: [{rel, sha256, destination|null}]. */
export function capturesAt(record, node, bp, theme) {
  const out = [];
  for (const c of list(node?.layout?.captures)) if (c?.breakpoint === bp && c?.theme === theme) out.push({ rel: `shell/${slash(c.path)}`, sha256: c.sha256, destination: null });
  for (const d of destinationsOf(record, node)) for (const c of d.captures) if (c?.breakpoint === bp && c?.theme === theme) out.push({ rel: `shell/${slash(c.path)}`, sha256: c.sha256, destination: d.key });
  return out;
}

/** A capture's slot and size: as recorded, else measured from the PNG on disk (legacy destination captures). */
function measuredCapture(shellDir, capture) {
  if (capture.slot && capture.width && capture.height) return capture;
  const file = shellDir ? path.join(shellDir, capture.path) : null;
  if (!file || !fs.existsSync(file)) return capture;
  const image = decodePng(fs.readFileSync(file));
  const key = keyRect(image, SLOT_KEY);
  return { ...capture, width: capture.width ?? image.width, height: capture.height ?? image.height, ...(capture.slot ? {} : key && key.fill >= 0.98 ? { slot: key.rect } : {}) };
}

/**
 * The image a page composite at bp/theme is placed into: the innermost visible layout's capture (a real render
 * of the whole chain down to it) with its slot, or null when no layout above the route draws chrome. When that
 * layout records destinations, the capture is the one of the destination the ui record shows active
 * (destinationFor over `ui`: {route, activeNav, layouts}); an optional cell (dark) the destination lacks falls
 * back to the default capture, a required one is missing.
 * Returns {node, file (absolute), rel (as a composite records it), sha256, slot, width, height, destination,
 * equivalents} | {missing} | null. `equivalents` are the node's recorded captures with the same bytes.
 */
export function baseLayoutFor(record, route, bp, theme, { shellDir, uiLoader = null, self = true, ui = null } = {}) {
  const chain = layoutChainOf(record, route, { self });
  if (!chain) return { missing: `${route} is not a node of the layout tree` };
  const visible = chain.filter((n) => n.layout?.chrome === 'visible');
  const node = visible[visible.length - 1];
  if (!node) return null;
  const bound = list(ui?.shell?.layouts).find((b) => b?.node === node.id)?.destination ?? null;
  const picked = destinationFor(record, node, { route: ui?.route ?? route, activeNav: ui?.shell?.activeNav ?? null, key: bound });
  if (picked?.unknown) return { missing: `shell.layouts binds ${node.id} destination ${picked.unknown}, which is not a destination of that layout (${destinationsOf(record, node).map((d) => d.key).join(', ') || 'none recorded'})` };
  const same = (sha) => capturesAt(record, node, bp, theme).filter((c) => c.sha256 === sha).map((c) => c.rel);
  let destination = null;
  if (picked) {
    const hit = picked.destination.captures.find((c) => c?.breakpoint === bp && c?.theme === theme);
    if (hit) {
      const c = measuredCapture(shellDir, hit);
      if (!c.slot) return { missing: `${node.id} destination ${picked.destination.key} capture ${hit.path} has no measured #FF00FF slot` };
      return { node: node.id, file: path.join(shellDir, c.path), rel: `shell/${slash(c.path)}`, sha256: c.sha256, slot: c.slot, width: c.width, height: c.height, destination: picked.destination.key, by: picked.by, equivalents: same(c.sha256) };
    }
    if (REQUIRED_BREAKPOINTS.includes(bp) && REQUIRED_THEMES.includes(theme)) return { missing: `${node.id} destination ${picked.destination.key} (active for ${ui?.route ?? route}) has no capture at ${bp}/${theme}` };
    destination = picked.destination.key;
  }
  const capture = list(node.layout.captures).find((c) => c?.breakpoint === bp && c?.theme === theme);
  if (capture) return { node: node.id, file: path.join(shellDir, capture.path), rel: `shell/${slash(capture.path)}`, sha256: capture.sha256, slot: capture.slot, width: capture.width, height: capture.height, destination: null, ...(destination ? { destinationFallback: destination } : {}), equivalents: same(capture.sha256) };
  if (node.layout.design && uiLoader) {
    const design = uiLoader(node.layout.design);
    const hit = design && designCaptureOf(design, bp, theme);
    if (hit) return { node: node.id, file: path.join(hit.dir, hit.path), rel: `${node.layout.design}:${slash(hit.path)}`, sha256: hit.sha256, slot: hit.slot, width: hit.width, height: hit.height, destination: null, equivalents: [] };
  }
  return { missing: `${node.id} has no capture at ${bp}/${theme}` };
}

// ---------------------------------------------------------------------------------------------------------
// Writing: merge a scan into the record, convert app-shell@1, add captures and planned nodes
// ---------------------------------------------------------------------------------------------------------

/** Where the frontend's app/ directory is for a Work tree: --app-dir, the record's app.appDir, or a search. */
export function locateAppDir(workRoot, record, explicit = null) {
  const workspace = readYamlFile(path.join(workRoot, 'workspace.yaml'));
  const repos = list(workspace?.repositories);
  const name = record?.app?.repository ?? repos.find((r) => r?.role === 'fe')?.name ?? null;
  const backendRoot = path.dirname(workRoot);
  const entry = repos.find((r) => r?.name === name);
  const repoRoot = !name || entry?.role === 'be' ? backendRoot : path.join(path.dirname(backendRoot), name);
  if (explicit) return { repository: name, repoRoot, appDir: path.resolve(explicit) };
  if (record?.app?.appDir) return { repository: name, repoRoot, appDir: path.join(repoRoot, record.app.appDir) };
  const hint = record?.app?.root ? [path.join(repoRoot, record.app.root, 'src', 'app'), path.join(repoRoot, record.app.root, 'app')] : [];
  const found = [...hint, ...findAppDirs(repoRoot)].find((d) => fs.existsSync(d) && fs.statSync(d).isDirectory());
  return { repository: name, repoRoot, appDir: found ?? null };
}

function findAppDirs(repoRoot) {
  const out = [];
  const walk = (dir, depth) => {
    if (depth > 4) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (!e.isDirectory() || SKIP_DIRS.has(e.name) || e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name);
      if (e.name === 'app' && fs.readdirSync(full).some((n) => /^layout\.[jt]sx?$/.test(n) || fs.existsSync(path.join(full, n)) && fs.statSync(path.join(full, n)).isDirectory() && fs.readdirSync(path.join(full, n)).some((m) => /^layout\.[jt]sx?$/.test(m)))) out.push(full);
      else walk(full, depth + 1);
    }
  };
  walk(repoRoot, 0);
  return out;
}

const carryLayout = (scanned, previous, notes) => {
  if (!previous?.layout) return scanned.layout;
  const prev = previous.layout;
  const fileChanged = previous.files?.layout?.sha256 && scanned.files?.layout?.sha256 && previous.files.layout.sha256 !== scanned.files.layout.sha256;
  const navChanged = !same(prev.nav?.items, scanned.layout?.nav?.items);
  const layout = {
    ...scanned.layout,
    chrome: prev.chrome && prev.chrome !== 'unknown' ? prev.chrome : scanned.layout.chrome,
    state: prev.state ?? scanned.layout.state,
    rev: prev.rev ?? 1,
    ...(prev.design ? { design: prev.design } : {}),
    ...(prev.titleKey ? { titleKey: prev.titleKey } : {}),
    ...(list(prev.captures).length ? { captures: prev.captures } : {}),
    ...(list(prev.destinations).length ? { destinations: prev.destinations } : {}),
    ...(list(prev.blockers).length ? { blockers: prev.blockers } : {}),
  };
  if (fileChanged || navChanged) {
    layout.rev = (prev.rev ?? 1) + 1;
    if (layout.chrome === 'visible') {
      layout.state = 'todo';
      layout.blockers = [...new Set([...list(layout.blockers), `${fileChanged ? 'The layout file' : 'The navigation'} changed since the captures were taken - brand.decide re-captures it (rev ${layout.rev}).`])];
    }
    notes.push(`${scanned.id}: ${fileChanged ? 'layout file' : 'navigation'} changed; layout rev ${prev.rev ?? 1} -> ${layout.rev}`);
  }
  return layout;
};

/** Merge a fresh scan into an existing layout-tree record (or start one). Returns {record, notes, changed}. */
export function mergeScan(existing, scan, { at = now() } = {}) {
  const notes = [];
  const base = isLayoutTree(existing) ? existing : null;
  const previous = new Map(nodesOf(base).map((n) => [n.id, n]));
  const nodes = scan.nodes.map((n) => {
    const prev = previous.get(n.id);
    const node = { ...n };
    if (n.layout) node.layout = carryLayout(n, prev, notes);
    else if (prev?.layout && prev.origin === 'planned') node.layout = prev.layout;
    return node;
  });
  const scannedIds = new Set(nodes.map((n) => n.id));
  for (const prev of nodesOf(base)) {
    if (scannedIds.has(prev.id)) continue;
    if (prev.origin === 'planned') { nodes.push(prev); continue; }
    notes.push(`${prev.id}: no longer in app/ - dropped`);
  }
  for (const n of nodes) if (!previous.has(n.id)) notes.push(`${n.id}: new ${n.segmentKind} segment`);
  const ordered = orderNodes(nodes);
  const record = {
    schema: TREE_SCHEMA, id: 'shell', kind: 'shell',
    state: base?.state ?? 'todo',
    ...(base?.activity ? { activity: base.activity } : {}),
    rev: base?.rev ?? 1,
    origin: 'repository',
    app: { ...scan.app, ...(base?.app?.repository && !scan.app.repository ? { repository: base.app.repository } : {}) },
    source: { ...scan.source, scannedAt: at },
    productLocale: base?.productLocale ?? scan.productLocale ?? { default: 'en', fallback: 'en', locales: ['en'], source: 'no locale configuration found - brand.decide settles it' },
    ...(scan.i18n ? { i18n: scan.i18n } : {}),
    ...(base?.brand ? { brand: base.brand } : {}),
    ...(base?.personas ? { personas: base.personas } : {}),
    breakpoints: base?.breakpoints ?? DEFAULT_BREAKPOINTS,
    themes: base?.themes ?? [...REQUIRED_THEMES],
    nodes: ordered,
    ...(base?.review ? { review: base.review } : {}),
    ...(base?.refs ? { refs: base.refs } : {}),
    ...(base?.blockers ? { blockers: base.blockers } : {}),
    ...(base?.change ? { change: base.change } : {}),
    // The owner's extension blocks are the owner's: a re-scan never drops them.
    ...(base?.extensions ? { extensions: base.extensions } : {}),
  };
  // The keys the merged tree uses (scanned nav keys plus a carried title or capture key), digested per locale.
  if (record.i18n && scan.catalogs) record.i18n = { ...record.i18n, used: keyedI18n(scan.catalogs, usedI18nKeys(record)) };
  // A catalog file's own digest is not structural, only the used keys are (nivo inc-13f6af8494bf). A record
  // that still carries the whole-file digest is judged through sourceDrift, so recording the keyed digest for
  // the first time does not by itself bump the rev every binding names.
  const i18nShape = (r) => ({ catalogs: list(r?.i18n?.catalogs).map((c) => [c.locale, c.path]), used: r?.i18n?.used ?? null });
  const structural = (r) => JSON.stringify({ nodes: r?.nodes, source: r?.source?.digest, i18n: i18nShape(r) });
  const legacyBase = Boolean(base && list(base.i18n?.catalogs).length && !Array.isArray(base.i18n?.used?.keys));
  const changed = !base || (legacyBase
    ? JSON.stringify(base.nodes) !== JSON.stringify(record.nodes) || sourceDrift(base, scan).stale
    : structural(base) !== structural(record));
  if (changed && base) {
    record.rev = (base.rev ?? 1) + 1;
    record.change = { rev: record.rev, kind: 'clarifying', at, reason: `Re-scanned app/ (${notes.length ? notes.slice(0, 6).join('; ') : 'source digests changed'}).` };
    if (nodes.some((n) => n.layout?.chrome === 'visible' && n.layout.state !== 'done') || nodes.some((n) => n.layout?.chrome === 'unknown')) record.state = 'todo';
  } else if (!base) {
    record.change = { rev: 1, kind: 'initial', at, reason: 'First scan of the frontend app/ directory into the layout tree.' };
  }
  return { record, notes, changed };
}

/** Parents before children, siblings in id order. */
export function orderNodes(nodes) {
  const children = new Map();
  for (const n of nodes) { const k = n.parent ?? ''; if (!children.has(k)) children.set(k, []); children.get(k).push(n); }
  const out = [];
  const visit = (id) => { for (const n of (children.get(id) ?? []).sort((a, b) => a.id.localeCompare(b.id))) { out.push(n); visit(n.id); } };
  visit('');
  const placed = new Set(out.map((n) => n.id));
  return [...out, ...nodes.filter((n) => !placed.has(n.id))];
}

const breakpointOfViewport = (viewport) => {
  const m = String(viewport ?? '').match(/([a-z][\w-]*)?\s*(\d+)\s*x\s*(\d+)/i);
  return m ? { name: (m[1] ?? (Number(m[2]) >= 1024 ? 'desktop' : 'mobile')).toLowerCase(), width: Number(m[2]), height: Number(m[3]) } : null;
};

/** Convert a work/app-shell@1 record into a layout tree over a fresh scan. Returns {record, notes}. */
export function convertAppShell(legacy, scan, { at = now() } = {}) {
  const { record } = mergeScan(null, scan, { at });
  const notes = [];
  const assets = list(legacy?.assets);
  if (legacy?.productLocale?.default) record.productLocale = legacy.productLocale;
  if (legacy?.persona) record.personas = [{ role: 'primary', default: true, ...legacy.persona }];
  const lockups = assets.filter((a) => a?.role === 'brand-lockup').map((a) => ({ path: a.path, sha256: a.sha256, ...(a.theme ? { theme: a.theme } : {}), ...(a.width ? { width: a.width } : {}), ...(a.height ? { height: a.height } : {}), ...(a.provenance ? { provenance: a.provenance } : {}) }));
  if (lockups.length) record.brand = { ...(legacy.topBar?.brand?.component ? { component: legacy.topBar.brand.component } : {}), ...(legacy.topBar?.brand?.path ? { path: legacy.topBar.brand.path } : {}), lockups };
  const shots = assets.filter((a) => a?.role === 'shell-capture');
  const bps = [];
  for (const s of shots) { const bp = breakpointOfViewport(s.viewport); if (bp && !bps.some((b) => b.name === bp.name)) bps.push(bp); }
  if (bps.length) record.breakpoints = bps;
  const themes = [...new Set([...REQUIRED_THEMES, ...shots.map((s) => s.theme).filter((t) => THEMES.includes(t))])];
  if (themes.length) record.themes = themes;
  // The layout the legacy record named is the visible chrome: by its route-layout file, else by component.
  const legacyFiles = [legacy?.source?.layout, ...list(legacy?.source?.files)].filter(Boolean);
  const shellNode = record.nodes.find((n) => n.files?.layout && legacyFiles.some((f) => f.path === n.files.layout.path))
    ?? record.nodes.find((n) => n.layout?.component && n.layout.component === legacy?.source?.layout?.component)
    ?? record.nodes.find((n) => n.layout?.component && n.layout.component === legacy?.topBar?.component);
  if (shellNode) {
    shellNode.layout.chrome = 'visible';
    shellNode.layout.state = 'todo';
    shellNode.layout.blockers = [
      ...shots.map((s) => `Legacy capture ${s.path} (${s.viewport ?? 'viewport unrecorded'}, ${s.theme ?? 'theme unrecorded'}) has no measured page slot; re-capture with the slot keyed #FF00FF and record it with \`node scripts/work/layout-tree.mjs capture\`.`),
    ];
    if (!shellNode.layout.blockers.length) shellNode.layout.blockers = ['No capture yet; brand.decide captures this layout at desktop and mobile in the light theme (dark optional).'];
    notes.push(`${shellNode.id}: the legacy shell's layout; chrome visible, awaiting slot-keyed captures`);
    const legacyNav = list(legacy?.nav?.items).map((i) => i?.key).join(',');
    const derived = list(shellNode.layout.nav?.items).map((i) => i.key).join(',');
    if (legacyNav && legacyNav !== derived) notes.push(`${shellNode.id}: legacy nav [${legacyNav}] differs from the derived nav [${derived}] - the derived one is kept`);
  } else notes.push('no scanned layout matches the legacy shell layout - every visible layout is decided by brand.decide');
  record.state = 'todo';
  record.rev = (legacy?.rev ?? 0) + 1;
  record.refs = list(legacy?.refs).length ? legacy.refs : undefined;
  if (!record.refs) delete record.refs;
  record.blockers = ['Converted from work/app-shell@1: every visible layout needs slot-keyed captures at desktop and mobile in the light theme (dark optional), and every layout with chrome unknown needs brand.decide to decide it, before anything draws under it.'];
  record.change = { rev: record.rev, kind: 'breaking', at, reason: `Converted from work/app-shell@1 rev ${legacy?.rev ?? '?'} into the layout tree scanned from ${record.app.appDir}.` };
  return { record, notes };
}

/** Upsert one capture for a layout node from a PNG (slot measured from the key colour). Mutates `record`. */
export function addCapture(record, shellDir, { node: id, breakpoint, theme, file, url = null, provenance = null, locale = null, destination = null, routes = [] }) {
  if (destination) return addDestinationCapture(record, shellDir, { node: id, destination, routes, breakpoint, theme, file, url, provenance, locale });
  const node = nodeById(record, id);
  if (!node?.layout) throw new Error(`${id}: not a layout node of the tree`);
  if (!matrixOf(record).breakpoints.includes(breakpoint)) throw new Error(`${breakpoint}: not one of the tree's breakpoints`);
  // An optional theme (dark) joins the tree's themes with its first capture; it is never required.
  if (!matrixOf(record).themes.includes(theme)) {
    if (!THEMES.includes(theme)) throw new Error(`${theme}: not a theme (${THEMES.join(', ')})`);
    record.themes = [...matrixOf(record).themes, theme];
  }
  const bytes = fs.readFileSync(file);
  const image = decodePng(bytes);
  const key = keyRect(image, SLOT_KEY);
  if (!key || key.fill < 0.98) throw new Error(`${file}: no solid #FF00FF slot found (fill ${key ? key.fill.toFixed(3) : 0}) - capture with the page slot emptied and keyed`);
  const rel = `assets/layouts/${nodeSlug(id)}--${breakpoint}--${theme}.png`;
  const dest = path.join(shellDir, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (path.resolve(dest) !== path.resolve(file)) fs.writeFileSync(dest, bytes);
  const capture = { breakpoint, theme, ...(locale ? { locale } : {}), path: rel, sha256: sha256Of(bytes), width: image.width, height: image.height, slot: key.rect, kind: 'render', ...(url ? { url } : {}), ...(provenance ? { provenance } : {}) };
  const captures = list(node.layout.captures).filter((c) => !(c.breakpoint === breakpoint && c.theme === theme));
  const prior = list(node.layout.captures).find((c) => c.breakpoint === breakpoint && c.theme === theme);
  node.layout.captures = [...captures, capture].sort((a, b) => `${a.breakpoint}/${a.theme}`.localeCompare(`${b.breakpoint}/${b.theme}`));
  node.layout.chrome = 'visible';
  if (prior && prior.sha256 !== capture.sha256) node.layout.rev = (node.layout.rev ?? 1) + 1;
  return capture;
}

/** A PNG measured as a capture: {bytes, capture fields} or a thrown refusal when the slot is not keyed. */
function readCaptureFile(file) {
  const bytes = fs.readFileSync(file);
  const image = decodePng(bytes);
  const key = keyRect(image, SLOT_KEY);
  if (!key || key.fill < 0.98) throw new Error(`${file}: no solid #FF00FF slot found (fill ${key ? key.fill.toFixed(3) : 0}) - capture with the page slot emptied and keyed`);
  return { bytes, sha256: sha256Of(bytes), width: image.width, height: image.height, slot: key.rect };
}

/**
 * Upsert one destination capture: the layout rendered with destination `destination` active (a nav key of the
 * layout, or a tab key), active for the node ids in `routes` (required when the destination is new and is not
 * a nav item with a target). Mutates `record`; a changed capture bumps the layout rev.
 */
export function addDestinationCapture(record, shellDir, { node: id, destination, routes = [], breakpoint, theme, file, url = null, provenance = null, locale = null }) {
  const node = nodeById(record, id);
  if (!node?.layout) throw new Error(`${id}: not a layout node of the tree`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(destination))) throw new Error(`${destination}: a destination key is a slug`);
  if (!matrixOf(record).breakpoints.includes(breakpoint)) throw new Error(`${breakpoint}: not one of the tree's breakpoints`);
  if (!matrixOf(record).themes.includes(theme)) {
    if (!THEMES.includes(theme)) throw new Error(`${theme}: not a theme (${THEMES.join(', ')})`);
    record.themes = [...matrixOf(record).themes, theme];
  }
  if (!list(node.layout.destinations).length && legacyDestinationsOf(record, node).length) throw new Error(`${id} still keeps its destinations in extensions.destinationCaptures - run layout-tree.mjs destinations --promote first`);
  const dests = list(node.layout.destinations);
  let entry = dests.find((d) => d.key === destination);
  const navTarget = list(node.layout.nav?.items).find((i) => i?.key === destination)?.target ?? null;
  const wanted = list(routes).length ? [...new Set(routes)] : entry ? entry.routes : navTarget ? [navTarget] : [];
  if (!wanted.length) throw new Error(`${destination}: name the node ids it is active for with --route (it is not a nav item of ${id} with a target)`);
  for (const r of wanted) if (!nodeById(record, r) || !underNode(r, id)) throw new Error(`${r}: not a node at or below ${id}`);
  const measured = readCaptureFile(file);
  const rel = `assets/layouts/${nodeSlug(id)}--${destination}--${breakpoint}--${theme}.png`;
  const dest = path.join(shellDir, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (path.resolve(dest) !== path.resolve(file)) fs.writeFileSync(dest, measured.bytes);
  const capture = { breakpoint, theme, ...(locale ? { locale } : {}), path: rel, sha256: measured.sha256, width: measured.width, height: measured.height, slot: measured.slot, kind: 'render', ...(url ? { url } : {}), ...(provenance ? { provenance } : {}) };
  if (!entry) { entry = { key: destination, routes: wanted, captures: [] }; dests.push(entry); } else entry.routes = wanted;
  const prior = list(entry.captures).find((c) => c.breakpoint === breakpoint && c.theme === theme);
  entry.captures = [...list(entry.captures).filter((c) => !(c.breakpoint === breakpoint && c.theme === theme)), capture].sort((a, b) => `${a.breakpoint}/${a.theme}`.localeCompare(`${b.breakpoint}/${b.theme}`));
  node.layout.destinations = dests.sort((a, b) => a.key.localeCompare(b.key));
  node.layout.chrome = 'visible';
  if (prior && prior.sha256 !== capture.sha256) node.layout.rev = (node.layout.rev ?? 1) + 1;
  return { destination, ...capture };
}

/**
 * Move a tree's legacy extensions.destinationCaptures into `layout.destinations` of the nodes they belong to,
 * measuring each capture's slot and size from its PNG. Items no layout claims stay in the extension and are
 * returned as `unmapped`. Mutates `record`; layout revs do not move (the bytes are the same).
 */
export function promoteDestinations(record, shellDir) {
  const promoted = [], problems = [];
  const claimed = new Set();
  for (const node of nodesOf(record).filter((n) => n.layout)) {
    const legacy = legacyDestinationsOf(record, node);
    if (!legacy.length) continue;
    if (list(node.layout.destinations).length) { problems.push(`${node.id} already records destinations; the legacy block is not merged into them`); continue; }
    const out = [];
    for (const d of legacy) {
      const captures = [];
      for (const c of d.captures) {
        const file = path.join(shellDir, c.path);
        if (!fs.existsSync(file)) { problems.push(`${node.id} ${d.key}: ${c.path} is not on disk`); continue; }
        try {
          const m = readCaptureFile(file);
          if (c.sha256 && m.sha256 !== c.sha256) problems.push(`${node.id} ${d.key}: ${c.path} no longer hashes to its recorded sha256 (recorded as it is now)`);
          const twin = list(node.layout.captures).find((x) => x.breakpoint === c.breakpoint && x.theme === c.theme);
          captures.push({ breakpoint: c.breakpoint, theme: c.theme, ...(c.locale ?? twin?.locale ? { locale: c.locale ?? twin.locale } : {}), path: c.path, sha256: m.sha256, width: m.width, height: m.height, slot: m.slot, kind: 'render', provenance: 'promoted from extensions.destinationCaptures' });
          claimed.add(`${d.key}\0${c.breakpoint}\0${c.path}`);
        } catch (error) { problems.push(`${node.id} ${d.key}: ${error.message}`); }
      }
      if (captures.length) out.push({ key: d.key, routes: d.routes, captures: captures.sort((a, b) => `${a.breakpoint}/${a.theme}`.localeCompare(`${b.breakpoint}/${b.theme}`)) });
    }
    if (out.length) { node.layout.destinations = out.sort((a, b) => a.key.localeCompare(b.key)); promoted.push({ node: node.id, keys: out.map((d) => d.key) }); }
  }
  const block = record.extensions?.destinationCaptures;
  const unmapped = list(block?.items).filter((i) => !claimed.has(`${i?.key}\0${i?.breakpoint}\0${i?.path}`));
  if (block && promoted.length) {
    if (unmapped.length) record.extensions.destinationCaptures = { ...block, items: unmapped };
    else delete record.extensions.destinationCaptures;
    if (!Object.keys(record.extensions).length) delete record.extensions;
  }
  return { promoted, unmapped: unmapped.map((i) => `${i?.key} ${i?.breakpoint} ${i?.path}`), problems };
}

// ---------------------------------------------------------------------------------------------------------
// The brand lockup: cropped from a real render, or - on a greenfield product - from the accepted drawing
// ---------------------------------------------------------------------------------------------------------

/**
 * Where a lockup may be cropped from (mia inc-1649b9490cb5): `shell/<path>` - a recorded capture (a real render)
 * of a layout of this tree; `ui.<id>:<path>` - the ACCEPTED layout composite of a planned visible layout's
 * design record (the record is done, the asset is its selected page composite with a measured childSlot, and
 * the record is the layout.design of a planned node). Returns {file, ref, kind, sha256, node} | {error}.
 */
export function lockupSourceOf(record, workRoot, ref, uiLoader = null) {
  const shellDir = path.join(workRoot, 'shell');
  const text = String(ref ?? '');
  const ui = text.match(/^(ui\.[^:]+):(.+)$/);
  if (ui) {
    const [, id, rel] = ui;
    const node = nodesOf(record).find((n) => n.layout?.design === id && n.layout.chrome === 'visible');
    if (!node || node.origin !== 'planned') return { error: `${id} is not the design record of a planned visible layout of this tree - a lockup is cropped from a real render once the frontend renders it` };
    const design = (uiLoader ?? ((x) => loadUiRecords(workRoot).get(x) ?? null))(id);
    if (!design) return { error: `${id} does not exist - interface.draw draws the planned layout first` };
    const acceptance = drawingAcceptance(design.record, path.dirname(design.file));
    if (!acceptance.accepted) return { error: `${id} is ${acceptance.reason} - the layout drawing is accepted before its lockup is taken: ${ACCEPT_PATH}` };
    const asset = [...list(design.record.assets), ...list(design.record.ui?.assets)].find((a) => a?.path === rel);
    const c = asset?.composite;
    if (!c || c.surface !== 'layout' || c.presentation !== 'page' || !c.childSlot || asset.selected === false) return { error: `${rel} is not an accepted layout composite of ${id} (a selected page composite of the layout with a measured childSlot)` };
    const file = path.join(path.dirname(design.file), rel);
    if (!fs.existsSync(file)) return { error: `${rel} is not on disk` };
    const sha256 = fileSha(file);
    if (asset.sha256 && asset.sha256 !== sha256) return { error: `${rel} no longer hashes to its recorded sha256` };
    return { file, ref: `${id}:${slash(rel)}`, kind: 'layout-drawing', sha256, node: node.id, theme: c.theme ?? null };
  }
  const shell = text.match(/^shell\/(.+)$/);
  if (!shell) return { error: `--from names shell/<capture path> or <ui-id>:<layout composite path>, not ${text || '(nothing)'}` };
  const rel = shell[1];
  for (const node of nodesOf(record).filter((n) => n.layout)) {
    const captures = [...list(node.layout.captures), ...destinationsOf(record, node).flatMap((d) => d.captures)];
    const hit = captures.find((c) => slash(c.path) === rel);
    if (!hit) continue;
    const file = path.join(shellDir, rel);
    if (!fs.existsSync(file)) return { error: `${rel} is not on disk` };
    const sha256 = fileSha(file);
    if (hit.sha256 && hit.sha256 !== sha256) return { error: `${rel} no longer hashes to its recorded sha256` };
    return { file, ref: `shell/${rel}`, kind: 'render', sha256, node: node.id, theme: hit.theme ?? null };
  }
  return { error: `${rel} is not a recorded capture of any layout of this tree - record the render with layout-tree.mjs capture first` };
}

/**
 * Crop the lockup out of a source image (lockupSourceOf) at `rect` and upsert it into brand.lockups for its
 * theme, with `source` naming the image, its digest and the rectangle so the crop is re-derivable. Mutates
 * `record`; writes assets/lockups/lockup--<theme>.png under the shell dir.
 */
export function addLockup(record, workRoot, { from, rect, theme = null, provenance = null, uiLoader = null }) {
  const source = lockupSourceOf(record, workRoot, from, uiLoader);
  if (source.error) throw new Error(source.error);
  const r = typeof rect === 'string' ? Object.fromEntries(['x', 'y', 'width', 'height'].map((k, i) => [k, Number(rect.split(',')[i])])) : rect;
  if (!r || ['x', 'y', 'width', 'height'].some((k) => !Number.isInteger(r[k]) || r[k] < 0) || r.width < 1 || r.height < 1) throw new Error('--rect is x,y,width,height in whole pixels');
  const image = decodePng(fs.readFileSync(source.file));
  if (r.x + r.width > image.width || r.y + r.height > image.height) throw new Error(`--rect ${r.x},${r.y},${r.width},${r.height} leaves the ${image.width}x${image.height} source`);
  const th = theme ?? source.theme ?? 'light';
  if (!THEMES.includes(th)) throw new Error(`${th}: not a theme (${THEMES.join(', ')})`);
  const bytes = encodePng(cropImage(image, r));
  const rel = `assets/lockups/lockup--${th}.png`;
  const dest = path.join(workRoot, 'shell', rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, bytes);
  const lockup = {
    path: rel, sha256: sha256Of(bytes), theme: th, width: r.width, height: r.height,
    provenance: provenance ?? `cropped by ${SCANNER} lockup from ${source.kind === 'render' ? 'the real render' : 'the accepted layout drawing'} ${source.ref}`,
    source: { ref: source.ref, kind: source.kind, sha256: source.sha256, rect: r },
  };
  record.brand = { ...(record.brand ?? {}), lockups: [...list(record.brand?.lockups).filter((l) => (l.theme ?? 'light') !== th), lockup].sort((a, b) => String(a.theme).localeCompare(String(b.theme))) };
  return lockup;
}

export const nodeSlug = (id) => (id === '/' ? 'root' : id.replace(/^\//, '').replace(/[()[\]@.]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'root');

/** Add a planned node (and any missing planned ancestors). Mutates `record`. */
export function addPlanned(record, { node: id, files = [], design = null }) {
  const parts = String(id).split('/').filter(Boolean);
  if (!record.nodes) record.nodes = [];
  if (!nodeById(record, '/')) record.nodes.unshift({ id: '/', parent: null, segment: '/', segmentKind: 'root', url: '/', origin: 'planned' });
  for (let n = 1; n <= parts.length; n += 1) {
    const nid = `/${parts.slice(0, n).join('/')}`;
    const parentId = n === 1 ? '/' : `/${parts.slice(0, n - 1).join('/')}`;
    let node = nodeById(record, nid);
    if (!node) {
      const parent = nodeById(record, parentId);
      const name = parts[n - 1], kind = segmentKindOf(name);
      node = { id: nid, parent: parentId, segment: name, segmentKind: kind, url: kind === 'group' || kind === 'slot' ? parent.url : kind === 'intercept' ? interceptTarget(name, parent.url) : joinUrl(parent.url, name), origin: 'planned' };
      record.nodes.push(node);
    }
    if (n === parts.length) {
      if (files.length) node.files = { ...(node.files ?? {}), ...Object.fromEntries(files.map((f) => [f, node.files?.[f] ?? { path: `${record.app?.appDir ?? 'app'}${nid === '/' ? '' : nid}/${f}.tsx` }])) };
      if (files.includes('layout') && !node.layout) node.layout = { chrome: 'visible', state: 'todo', rev: 1, ...(design ? { design } : {}) };
      else if (design && node.layout) node.layout.design = design;
    }
  }
  record.nodes = orderNodes(record.nodes);
  return nodeById(record, id);
}

// ---------------------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------------------

const flag = (args, name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const flags = (args, name) => args.flatMap((a, i) => (a === name ? [args[i + 1]] : []));

/** One-screen summary of a tree: layouts with chrome and captures, nav with findings, special files. */
export function summarize(record) {
  const lines = [`layout tree ${record.app?.appDir ?? ''} (origin ${record.origin}, rev ${record.rev}, state ${record.state}) - ${nodesOf(record).length} nodes`];
  lines.push(`productLocale ${record.productLocale?.default} (fallback ${record.productLocale?.fallback}; locales ${list(record.productLocale?.locales).join(', ')})`);
  for (const n of nodesOf(record)) {
    const depth = (chainOf(record, n.id)?.length ?? 1) - 1;
    const files = Object.keys(n.files ?? {}).join(',');
    const dests = n.layout ? destinationsOf(record, n) : [];
    const extra = n.layout ? ` LAYOUT ${n.layout.component ?? '(no component)'} chrome=${n.layout.chrome} state=${n.layout.state} rev=${n.layout.rev} captures=${list(n.layout.captures).length}${dests.length ? ` destinations=${dests.map((d) => d.key).join(',')}${dests[0].legacy ? ' (legacy extension)' : ''}` : ''}` : '';
    lines.push(`${'  '.repeat(depth)}${n.segment} [${n.segmentKind}] url=${n.url}${files ? ` {${files}}` : ''}${n.intercepts ? ` intercepts=${n.intercepts}` : ''}${extra}`);
    for (const item of list(n.layout?.nav?.items)) lines.push(`${'  '.repeat(depth + 2)}nav ${item.key} -> ${item.route ?? 'null'} target=${item.target ?? 'NONE'} ${Object.entries(item.labels ?? {}).map(([l, v]) => `${l}:"${v}"`).join(' ')}`);
    for (const f of list(n.layout?.nav?.findings)) lines.push(`${'  '.repeat(depth + 2)}! ${f.code} ${f.detail}`);
  }
  return lines.join('\n');
}

export function layoutTreeMain(argv = []) {
  const [command, ...args] = argv;
  const json = args.includes('--json');
  const write = args.includes('--write');
  const out = (value, text) => ({ exitCode: 0, text: json ? `${JSON.stringify(value, null, 2)}\n` : `${text}\n` });
  try {
    if (command === 'slot') {
      const file = args.find((a) => !a.startsWith('--') && a !== flag(args, '--key') && a !== flag(args, '--tolerance'));
      if (!file) return { exitCode: 2, text: 'Usage: layout-tree.mjs slot <png> [--key ff00ff] [--tolerance 8]\n' };
      const hex = (flag(args, '--key') ?? 'ff00ff').replace(/^#/, '');
      const key = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
      const found = keyRect(decodePng(fs.readFileSync(file)), key, Number(flag(args, '--tolerance') ?? 8));
      if (!found || found.fill < 0.98) return { exitCode: 1, text: `${JSON.stringify({ ok: false, found })}\n` };
      return { exitCode: 0, text: `${JSON.stringify({ ok: true, slot: found.rect, fill: Number(found.fill.toFixed(4)) })}\n` };
    }
    const work = flag(args, '--work');
    if (command === 'scan' && !work) {
      const appDir = flag(args, '--app-dir');
      if (!appDir) return { exitCode: 2, text: 'scan needs --work <.starciwork> or --app-dir <dir>\n' };
      const scan = scanAppDir(appDir, { repoRoot: flag(args, '--repo-root') });
      const { record } = mergeScan(null, scan);
      return out(record, summarize(record));
    }
    if (!['scan', 'convert', 'capture', 'plan', 'destinations', 'lockup'].includes(command) || !work) {
      return { exitCode: 2, text: 'Usage: node scripts/work/layout-tree.mjs <scan|convert|capture|plan|destinations|lockup|slot> --work <.starciwork> [...] [--write] [--json]\n' };
    }
    const workRoot = path.resolve(work);
    const shell = readShellRecord(workRoot);
    if (shell?.error) return { exitCode: 1, text: `${shell.file}: ${shell.error}\n` };
    const existing = shell?.record ?? null;
    const shellDir = path.join(workRoot, 'shell');
    const save = (record) => { fs.mkdirSync(shellDir, { recursive: true }); fs.writeFileSync(shellFileOf(workRoot), stringifyYaml(record, { lineWidth: 110 })); };
    if (command === 'lockup') {
      if (!isLayoutTree(existing)) return { exitCode: 1, text: 'lockup needs a work/layout-tree@1 record\n' };
      if (!flag(args, '--from') || !flag(args, '--rect')) return { exitCode: 2, text: 'Usage: layout-tree.mjs lockup --work <.starciwork> --from <shell/<capture> | <ui-id>:<layout composite>> --rect x,y,w,h [--theme light] [--provenance <text>] --write\n' };
      const record = existing;
      if (!write) {
        const source = lockupSourceOf(record, workRoot, flag(args, '--from'));
        return source.error ? { exitCode: 1, text: `layout-tree: ${source.error}\n` } : out({ ok: true, written: false, source }, `would crop ${flag(args, '--rect')} of ${source.ref} (${source.kind}) into brand.lockups (dry run - pass --write)`);
      }
      const lockup = addLockup(record, workRoot, { from: flag(args, '--from'), rect: flag(args, '--rect'), theme: flag(args, '--theme'), provenance: flag(args, '--provenance') });
      record.rev = (record.rev ?? 1) + 1;
      record.change = { rev: record.rev, kind: 'clarifying', at: now(), reason: `Brand lockup (${lockup.theme}) cropped from ${lockup.source.ref}.` };
      save(record);
      return out({ ok: true, written: true, lockup }, `wrote ${slash(shellFileOf(workRoot))}: lockup ${lockup.path} from ${lockup.source.ref}`);
    }
    if (command === 'destinations') {
      if (!isLayoutTree(existing)) return { exitCode: 1, text: 'destinations needs a work/layout-tree@1 record\n' };
      const record = existing;
      const route = flag(args, '--route');
      if (route) {
        // Which capture a page at --route composes into, per breakpoint and theme (what compose-direction takes).
        const ui = { route, shell: { activeNav: flag(args, '--active-nav') } };
        const anchor = nodeById(record, route) ? route : nearestExisting(record, route);
        const picks = matrixOf(record).breakpoints.flatMap((bp) => matrixOf(record).themes.map((theme) => {
          const base = baseLayoutFor(record, anchor, bp, theme, { shellDir, ui });
          return { breakpoint: bp, theme, ...(base ? (base.missing ? { missing: base.missing } : { node: base.node, capture: base.rel, destination: base.destination, by: base.by ?? null, slot: base.slot }) : { canvas: true }) };
        }));
        return out({ ok: true, route, picks }, picks.map((p) => `${p.breakpoint}/${p.theme}: ${p.missing ? `MISSING ${p.missing}` : p.canvas ? 'blank canvas (no visible layout)' : `${p.capture} (${p.node}${p.destination ? ` destination ${p.destination} by ${p.by}` : ' default'})`}`).join('\n'));
      }
      if (!args.includes('--promote')) {
        const rows = nodesOf(record).filter((n) => n.layout).flatMap((n) => destinationsOf(record, n).map((d) => ({ node: n.id, key: d.key, routes: d.routes, cells: d.captures.map((c) => `${c.breakpoint}/${c.theme}`), legacy: d.legacy === true })));
        return out({ ok: true, destinations: rows }, rows.length ? rows.map((r) => `${r.node} ${r.key}${r.legacy ? ' (legacy extension)' : ''} routes=${r.routes.join(',')} cells=${r.cells.join(',')}`).join('\n') : 'no layout records destinations');
      }
      const result = promoteDestinations(record, shellDir);
      if (result.promoted.length && write) {
        record.rev = (record.rev ?? 1) + 1;
        record.change = { rev: record.rev, kind: 'clarifying', at: now(), reason: `Promoted extensions.destinationCaptures into layout.destinations (${result.promoted.map((p) => `${p.node}: ${p.keys.join(', ')}`).join('; ')}); the capture bytes are unchanged.` };
        save(record);
      }
      const text = [...result.promoted.map((p) => `promoted ${p.node}: ${p.keys.join(', ')}`), ...result.unmapped.map((u) => `UNMAPPED ${u} (left in extensions.destinationCaptures)`), ...result.problems.map((p) => `PROBLEM ${p}`), result.promoted.length ? (write ? `wrote ${slash(shellFileOf(workRoot))}` : '(dry run - pass --write to write the record)') : 'nothing to promote'].join('\n');
      return { exitCode: result.problems.length ? 1 : 0, text: json ? `${JSON.stringify({ ok: !result.problems.length, written: write && result.promoted.length > 0, ...result }, null, 2)}\n` : `${text}\n` };
    }
    if (command === 'capture' || command === 'plan') {
      if (!isLayoutTree(existing) && command === 'capture') return { exitCode: 1, text: 'capture needs a work/layout-tree@1 record - scan or convert first\n' };
      const record = isLayoutTree(existing) ? existing : { schema: TREE_SCHEMA, id: 'shell', kind: 'shell', state: 'todo', rev: 1, origin: 'planned', app: { root: '.', appDir: 'app', framework: 'next-app-router' }, productLocale: { default: 'en', fallback: 'en', locales: ['en'] }, breakpoints: DEFAULT_BREAKPOINTS, themes: [...REQUIRED_THEMES], nodes: [] };
      let result;
      if (command === 'capture') {
        result = addCapture(record, shellDir, { node: flag(args, '--node'), breakpoint: flag(args, '--breakpoint'), theme: flag(args, '--theme'), file: flag(args, '--file'), url: flag(args, '--url'), provenance: flag(args, '--provenance'), locale: flag(args, '--locale'), destination: flag(args, '--destination'), routes: flags(args, '--route') });
      } else {
        for (const id of flags(args, '--node')) result = addPlanned(record, { node: id, files: (flag(args, '--files') ?? '').split(',').filter(Boolean), design: flag(args, '--design') });
      }
      record.rev = (record.rev ?? 1) + (isLayoutTree(existing) ? 1 : 0);
      record.change = { rev: record.rev, kind: 'clarifying', at: now(), reason: command === 'capture' ? `Captured ${flag(args, '--node')}${flag(args, '--destination') ? ` destination ${flag(args, '--destination')}` : ''} at ${flag(args, '--breakpoint')}/${flag(args, '--theme')}.` : `Planned ${flags(args, '--node').join(', ')}.` };
      if (write) save(record);
      return out({ ok: true, written: write, result }, `${write ? 'wrote' : 'would write'} ${slash(shellFileOf(workRoot))}: ${JSON.stringify(result)}`);
    }
    const located = locateAppDir(workRoot, isLayoutTree(existing) ? existing : existing?.app ? { app: { repository: existing.app.repository, root: existing.app.root } } : null, flag(args, '--app-dir'));
    if (!located.appDir) return { exitCode: 1, text: `no app/ directory found for ${slash(workRoot)} (repository ${located.repository ?? '(none)'}) - pass --app-dir\n` };
    const scan = scanAppDir(located.appDir, { repoRoot: located.repoRoot, repository: located.repository });
    let record, notes;
    if (command === 'convert' || existing?.schema === LEGACY_SHELL_SCHEMA) {
      if (existing && existing.schema !== LEGACY_SHELL_SCHEMA && !isLayoutTree(existing)) return { exitCode: 1, text: `${slash(shellFileOf(workRoot))} names schema ${existing.schema}; nothing to convert\n` };
      if (isLayoutTree(existing)) ({ record, notes } = mergeScan(existing, scan));
      else ({ record, notes } = convertAppShell(existing ?? {}, scan));
    } else ({ record, notes } = mergeScan(existing, scan));
    if (write) save(record);
    return out({ ok: true, written: write, notes, record }, `${summarize(record)}\n${notes.map((n) => `- ${n}`).join('\n')}\n${write ? `wrote ${slash(shellFileOf(workRoot))}` : '(dry run - pass --write to write the record)'}`);
  } catch (error) {
    return { exitCode: 1, text: `layout-tree: ${error.message}\n` };
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = layoutTreeMain(process.argv.slice(2));
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
}
