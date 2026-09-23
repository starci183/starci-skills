#!/usr/bin/env node
// layout-tree.mjs — the product's layout tree, scanned out of the frontend's Next.js `app/` directory.
//
//   node scripts/work/layout-tree.mjs scan    --work <.starciwork> [--app-dir <dir>] [--write] [--json]
//   node scripts/work/layout-tree.mjs scan    --app-dir <dir> [--repo-root <dir>] [--json]
//   node scripts/work/layout-tree.mjs convert --work <.starciwork> [--write] [--json]
//   node scripts/work/layout-tree.mjs capture --work <.starciwork> --node <id> --breakpoint <bp> --theme <t> --file <png> [--url <u>] [--provenance <text>] --write
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
import { decodePng, keyRect } from './png.mjs';

export const TREE_SCHEMA = 'work/layout-tree@1';
export const LEGACY_SHELL_SCHEMA = 'work/app-shell@1';
export const SCANNER = 'scripts/work/layout-tree.mjs';
export const SPECIAL_FILES = ['layout', 'template', 'page', 'loading', 'error', 'not-found', 'default', 'route'];
export const DEFAULT_BREAKPOINTS = [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }];
export const SLOT_KEY = [255, 0, 255];
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

  const catalogs = catalogsOf(rootAbs);
  for (const c of catalogs) for (const f of c.files) digests.push([rel(f), fileSha(f)]);
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
  return {
    app: { ...(repository ? { repository } : {}), root: rel(rootAbs) || '.', appDir: rel(dirAbs), framework: 'next-app-router', ...(localeParam ? { localeParam } : {}) },
    source: { scanner: SCANNER, ...(revision ? { revision } : {}), digest: sha256Of(digests.map(([p, s]) => `${p}\0${s}`).join('\n')) },
    i18n: catalogs.length ? { catalogs: catalogs.flatMap((c) => c.files.map((f) => ({ locale: c.locale, path: rel(f), sha256: fileSha(f) }))) } : undefined,
    productLocale,
    nodes,
  };
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

/** Breakpoint names and themes every visible layout is captured at. */
export const matrixOf = (record) => ({
  breakpoints: list(record?.breakpoints).map((b) => b?.name).filter(Boolean),
  themes: list(record?.themes).filter(Boolean),
});

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
    const { breakpoints, themes } = matrixOf(record);
    if (node.origin === 'planned' || (!list(layout.captures).length && layout.design)) {
      if (!layout.design) reasons.push(`${node.id} is planned with no design ui record to draw it`);
      else {
        const design = uiLoader?.(layout.design);
        if (!design) reasons.push(`${node.id} is drawn by ${layout.design}, which does not exist`);
        else {
          if (design.record.state !== 'done') reasons.push(`${node.id} is drawn by ${layout.design}, which is ${design.record.state ?? 'stateless'}, not done`);
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

/**
 * The image a page composite at bp/theme is placed into: the innermost visible layout's capture (a real render
 * of the whole chain down to it) with its slot, or null when no layout above the route draws chrome.
 * Returns {node, file (absolute), rel (as a composite records it), sha256, slot, width, height} | {missing} | null.
 */
export function baseLayoutFor(record, route, bp, theme, { shellDir, uiLoader = null, self = true } = {}) {
  const chain = layoutChainOf(record, route, { self });
  if (!chain) return { missing: `${route} is not a node of the layout tree` };
  const visible = chain.filter((n) => n.layout?.chrome === 'visible');
  const node = visible[visible.length - 1];
  if (!node) return null;
  const capture = list(node.layout.captures).find((c) => c?.breakpoint === bp && c?.theme === theme);
  if (capture) return { node: node.id, file: path.join(shellDir, capture.path), rel: `shell/${slash(capture.path)}`, sha256: capture.sha256, slot: capture.slot, width: capture.width, height: capture.height };
  if (node.layout.design && uiLoader) {
    const design = uiLoader(node.layout.design);
    const hit = design && designCaptureOf(design, bp, theme);
    if (hit) return { node: node.id, file: path.join(hit.dir, hit.path), rel: `${node.layout.design}:${slash(hit.path)}`, sha256: hit.sha256, slot: hit.slot, width: hit.width, height: hit.height };
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
    ...(list(prev.captures).length ? { captures: prev.captures } : {}),
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
    themes: base?.themes ?? ['light', 'dark'],
    nodes: ordered,
    ...(base?.review ? { review: base.review } : {}),
    ...(base?.refs ? { refs: base.refs } : {}),
    ...(base?.blockers ? { blockers: base.blockers } : {}),
    ...(base?.change ? { change: base.change } : {}),
  };
  const structural = (r) => JSON.stringify({ nodes: r?.nodes, source: r?.source?.digest, i18n: r?.i18n });
  const changed = !base || structural(base) !== structural(record);
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
  const themes = [...new Set(shots.map((s) => s.theme).filter((t) => t === 'light' || t === 'dark'))];
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
    if (!shellNode.layout.blockers.length) shellNode.layout.blockers = ['No capture yet; brand.decide captures this layout at every breakpoint and theme.'];
    notes.push(`${shellNode.id}: the legacy shell's layout; chrome visible, awaiting slot-keyed captures`);
    const legacyNav = list(legacy?.nav?.items).map((i) => i?.key).join(',');
    const derived = list(shellNode.layout.nav?.items).map((i) => i.key).join(',');
    if (legacyNav && legacyNav !== derived) notes.push(`${shellNode.id}: legacy nav [${legacyNav}] differs from the derived nav [${derived}] - the derived one is kept`);
  } else notes.push('no scanned layout matches the legacy shell layout - every visible layout is decided by brand.decide');
  record.state = 'todo';
  record.rev = (legacy?.rev ?? 0) + 1;
  record.refs = list(legacy?.refs).length ? legacy.refs : undefined;
  if (!record.refs) delete record.refs;
  record.blockers = ['Converted from work/app-shell@1: every visible layout needs slot-keyed captures at each breakpoint and theme, and every layout with chrome unknown needs brand.decide to decide it, before anything draws under it.'];
  record.change = { rev: record.rev, kind: 'breaking', at, reason: `Converted from work/app-shell@1 rev ${legacy?.rev ?? '?'} into the layout tree scanned from ${record.app.appDir}.` };
  return { record, notes };
}

/** Upsert one capture for a layout node from a PNG (slot measured from the key colour). Mutates `record`. */
export function addCapture(record, shellDir, { node: id, breakpoint, theme, file, url = null, provenance = null, locale = null }) {
  const node = nodeById(record, id);
  if (!node?.layout) throw new Error(`${id}: not a layout node of the tree`);
  if (!matrixOf(record).breakpoints.includes(breakpoint)) throw new Error(`${breakpoint}: not one of the tree's breakpoints`);
  if (!matrixOf(record).themes.includes(theme)) throw new Error(`${theme}: not one of the tree's themes`);
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
    const extra = n.layout ? ` LAYOUT ${n.layout.component ?? '(no component)'} chrome=${n.layout.chrome} state=${n.layout.state} rev=${n.layout.rev} captures=${list(n.layout.captures).length}` : '';
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
    if (!['scan', 'convert', 'capture', 'plan'].includes(command) || !work) {
      return { exitCode: 2, text: 'Usage: node scripts/work/layout-tree.mjs <scan|convert|capture|plan|slot> --work <.starciwork> [...] [--write] [--json]\n' };
    }
    const workRoot = path.resolve(work);
    const shell = readShellRecord(workRoot);
    if (shell?.error) return { exitCode: 1, text: `${shell.file}: ${shell.error}\n` };
    const existing = shell?.record ?? null;
    const shellDir = path.join(workRoot, 'shell');
    const save = (record) => { fs.mkdirSync(shellDir, { recursive: true }); fs.writeFileSync(shellFileOf(workRoot), stringifyYaml(record, { lineWidth: 110 })); };
    if (command === 'capture' || command === 'plan') {
      if (!isLayoutTree(existing) && command === 'capture') return { exitCode: 1, text: 'capture needs a work/layout-tree@1 record - scan or convert first\n' };
      const record = isLayoutTree(existing) ? existing : { schema: TREE_SCHEMA, id: 'shell', kind: 'shell', state: 'todo', rev: 1, origin: 'planned', app: { root: '.', appDir: 'app', framework: 'next-app-router' }, productLocale: { default: 'en', fallback: 'en', locales: ['en'] }, breakpoints: DEFAULT_BREAKPOINTS, themes: ['light', 'dark'], nodes: [] };
      let result;
      if (command === 'capture') {
        result = addCapture(record, shellDir, { node: flag(args, '--node'), breakpoint: flag(args, '--breakpoint'), theme: flag(args, '--theme'), file: flag(args, '--file'), url: flag(args, '--url'), provenance: flag(args, '--provenance'), locale: flag(args, '--locale') });
      } else {
        for (const id of flags(args, '--node')) result = addPlanned(record, { node: id, files: (flag(args, '--files') ?? '').split(',').filter(Boolean), design: flag(args, '--design') });
      }
      record.rev = (record.rev ?? 1) + (isLayoutTree(existing) ? 1 : 0);
      record.change = { rev: record.rev, kind: 'clarifying', at: now(), reason: command === 'capture' ? `Captured ${flag(args, '--node')} at ${flag(args, '--breakpoint')}/${flag(args, '--theme')}.` : `Planned ${flags(args, '--node').join(', ')}.` };
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
