import fs from 'node:fs';
import path from 'node:path';
import { byCodeUnit } from '../lib/list.mjs';
import { list, sha256File, slash } from './work-io.mjs';
import { importClausesOf, importSpecifiersOf } from './layout-imports.mjs';

const SCANNER = 'scripts/work/layout-tree.mjs';
const SPECIAL_FILES = ['layout', 'template', 'page', 'loading', 'error', 'not-found', 'default', 'route'];
const SOURCE_EXT = ['.tsx', '.ts', '.jsx', '.js', '.mdx'];
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'coverage', 'storybook-static', '.turbo']);
const LOCALE_PARAMS = new Set(['locale', 'lang', 'lng', 'language']);
const readText = (file) => { try { return fs.readFileSync(file, 'utf8'); } catch { return null; } };
const IMPORT_ALIAS_RX = new RegExp([String.raw`\s+`, 'as', String.raw`\s+`].join(''));
const I18N_FILE_RX = /(?:^|[/\\])i18n[/\\][^/\\]+\.[jt]sx?$|(?:^|[/\\])i18n\.[jt]s$/;
const TRAILING_SLASHES_RX = /(?<!\/)\/+$/;

// Segments
// ---------------------------------------------------------------------------------------------------------

/** What an app/ directory name is under the App Router convention. */
function segmentKindOf(name) {
  if (/^\((?:\.{1,3}|\.\.(?:\)\(\.\.)*)\)/.test(name)) return 'intercept';
  if (/^\(.+\)$/.test(name)) return 'group';
  if (name.startsWith('@')) return 'slot';
  if (/^\[\[\.\.\..+\]\]$/.test(name)) return 'optional-catch-all';
  if (/^\[\.\.\..+\]$/.test(name)) return 'catch-all';
  if (/^\[.+\]$/.test(name)) return 'dynamic';
  return 'static';
}

/** The locale segment next-intl routes through: a dynamic segment directly under app/ whose parameter is a locale. It is
 * transparent to the URL a page serves (app/[locale]/x/page.tsx serves /x); the scan and the surface checks share this. */
const isLocaleSegment = (name) => segmentKindOf(name) === 'dynamic' && LOCALE_PARAMS.has(name.slice(1, -1));

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


/** The files a layout reaches through its imports, breadth first, within the repository. */
function importClosure(entry, aliases, repoRoot, { maxDepth = 4, maxFiles = 150 } = {}) {
  const seen = new Set([entry]);
  let frontier = [entry];
  for (let depth = 0; depth < maxDepth && frontier.length && seen.size < maxFiles; depth += 1) {
    const next = [];
    for (const file of frontier) {
      const text = readText(file);
      if (!text) continue;
      for (const spec of importSpecifiersOf(text)) {
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
function layoutComponentOf(text) {
  const imported = new Set();
  for (const clause of importClausesOf(text)) {
    for (const name of clause.replace(/[{}]/g, ',').split(',').map((s) => s.trim().split(IMPORT_ALIAS_RX).pop()).filter(Boolean)) if (/^[A-Z]/.test(name)) imported.add(name);
  }
  // A JSX tag, not a TypeScript type argument: `Promise<Metadata>` has an identifier right before the `<`.
  const tags = [...text.matchAll(/(?<![\w$\])])<([A-Z]\w*)[\s/>]/g)].map((m) => m[1]).filter((t) => imported.has(t));
  const chrome = tags.filter((t) => !/Providers?$/.test(t) && t !== 'Fragment' && t !== 'Suspense');
  return { component: chrome[0] ?? null, passthrough: chrome.length === 0 };
}

/** Objects with a key and a route in one source file: the navigation registry, in source order. */
function registryIn(text) {
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
function addCatalogFiles(full, found) {
  for (const file of fs.readdirSync(full, { withFileTypes: true })) {
    const match = file.name.match(LOCALE_FILE);
    if (file.isFile() && match) {
      found.push({ locale: match[1], files: [path.join(full, file.name)], merge: null });
    } else if (file.isDirectory() && /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(file.name)) {
      const dir = path.join(full, file.name);
      const files = fs.readdirSync(dir).filter((name) => name.endsWith('.json')).map((name) => path.join(dir, name));
      if (files.length) found.push({ locale: file.name, files, merge: 'namespace' });
    }
  }
}

function readCatalog(catalog) {
  const messages = {};
  for (const file of catalog.files) {
    let doc = {};
    try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* unreadable catalog: empty */ }
    if (catalog.merge === 'namespace') messages[path.basename(file, '.json')] = doc; else Object.assign(messages, doc);
  }
  return { locale: catalog.locale, files: catalog.files, messages };
}

function catalogsOf(appRoot) {
  const found = [];
  const walk = (dir, depth) => {
    if (depth > 4) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.name === 'messages' || entry.name === 'locales') addCatalogFiles(full, found);
      else walk(full, depth + 1);
    }
  };
  walk(appRoot, 0);
  return found.map(readCatalog).sort((a, b) => a.locale.localeCompare(b.locale));
}

/** defaultLocale and the locale list as the app's i18n config spells them, when it does. */
function localeConfigOf(appRoot) {
  const texts = [];
  const walk = (dir, depth) => {
    if (depth > 3) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && !SKIP_DIRS.has(e.name)) walk(full, depth + 1);
      else if (e.isFile() && I18N_FILE_RX.test(full) && !/\.spec\.|\.test\./.test(e.name)) texts.push({ file: full, text: readText(full) ?? '' });
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
    const ref = head.match(/^ref:\s*(?!\s)(.+)$/)?.[1];
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
  const inside = (n) => { for (let at = n; at; at = byId.get(at.parent)) { if (at.segmentKind === 'slot' || at.segmentKind === 'intercept') { return true; } } return false; };
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
function resolveNavRoute(nodes, route, localeParam) {
  if (typeof route !== 'string') return null;
  const clean = route.split(/[?#]/)[0].replace(TRAILING_SLASHES_RX, '') || '/';
  const candidates = landingPages(nodes).filter((n) => matchUrl(localelessUrl(n.url, localeParam), clean));
  candidates.sort((a, b) => urlParts(a.url).filter((s) => segmentKindOf(s) !== 'static').length - urlParts(b.url).filter((s) => segmentKindOf(s) !== 'static').length);
  return candidates[0]?.id ?? null;
}

/**
 * Scan one app's app/ directory. Returns {app, source, i18n, productLocale, nodes} - the record's scanned half.
 * `repoRoot` is the root the paths are recorded relative to (the app root); `appRoot` the application directory
 * (where tsconfig.json and the i18n catalogs live), defaulting to the parent of src/ or of app/.
 */
const nodeIdOf = (name, parent) => {
  if (!parent) { return '/'; }
  if (parent.id === '/') { return `/${name}`; }
  return `${parent.id}/${name}`;
};

const nodeUrlOf = (name, parent, kind) => {
  if (!parent) { return '/'; }
  if (kind === 'group' || kind === 'slot') { return parent.url; }
  if (kind === 'intercept') { return interceptTarget(name, parent.url); }
  return joinUrl(parent.url, name);
};

function scanAppNodes(dirAbs, rel) {
  const digests = [];
  const nodes = [];
  const walk = (dir, parent, name) => {
    const kind = parent ? segmentKindOf(name) : 'root';
    const id = nodeIdOf(name, parent);
    const url = nodeUrlOf(name, parent, kind);
    const files = {};
    for (const special of SPECIAL_FILES) {
      const file = specialFileIn(dir, special);
      if (file) { const sha = sha256File(file); files[special] = { path: rel(file), sha256: sha }; digests.push([rel(file), sha]); }
    }
    const node = { id, parent: parent?.id ?? null, segment: parent ? name : '/', segmentKind: kind, url, origin: 'repository', ...(Object.keys(files).length ? { files } : {}) };
    const at = nodes.length;
    nodes.push(node);
    const children = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() && !SKIP_DIRS.has(e.name) && !e.name.startsWith('_') && !e.name.startsWith('.')).map((e) => e.name).sort(byCodeUnit);
    let hasContent = Object.keys(files).length > 0;
    for (const child of children) { if (walk(path.join(dir, child), node, child)) hasContent = true; }
    if (!hasContent && parent) { nodes.splice(at, 1); return false; }
    return true;
  };
  walk(dirAbs, null, '/');
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const pages = landingPages(nodes);
  for (const node of nodes) {
    let inIntercept = false;
    for (let at = node; at; at = byId.get(at.parent)) { if (at.segmentKind === 'intercept') { inIntercept = true; break; } }
    if (inIntercept && node.files?.page) node.intercepts = pages.find((p) => p.url === node.url)?.id ?? undefined;
    if (node.intercepts === undefined) { delete node.intercepts; }
  }
  return { nodes, digests };
}

function isWithinNode(page, node, byId) {
  for (let at = page; at; at = byId.get(at.parent)) { if (at.id === node.id) return true; }
  return false;
}

/** The catalog key a nav item's label lives at: the namespaced key when a catalog holds it, else the one `nav.<key>` match. */
function navLabelKeyOf(item, { ns, prefix, catalogs }) {
  const named = ns || prefix ? [ns, `${prefix ?? ''}${item.key}`].filter(Boolean).join('.') : null;
  if (named && catalogs.some((catalog) => typeof getPath(catalog.messages, named) === 'string')) return named;
  const guesses = [...new Set(catalogs.flatMap((catalog) => keyPathsEndingIn(catalog.messages, `nav.${item.key}`)))];
  return guesses.length === 1 ? guesses[0] : named;
}

/** The label a catalog gives `i18nKey`, per locale; a locale whose label is missing or blank has no entry. */
function navLabelsOf(catalogs, i18nKey) {
  const labels = {};
  for (const catalog of catalogs) {
    const label = i18nKey ? getPath(catalog.messages, i18nKey) : undefined;
    if (typeof label === 'string' && label.trim()) labels[catalog.locale] = label;
  }
  return labels;
}

function navItemOf(item, { ns, prefix, catalogs, nodes, localeParam, findings, rel }) {
  const i18nKey = navLabelKeyOf(item, { ns, prefix, catalogs });
  const labels = navLabelsOf(catalogs, i18nKey);
  for (const catalog of catalogs) {
    if (!labels[catalog.locale]) findings.push({ code: 'NAV_LABEL_MISSING', detail: item.key + ' has no ' + catalog.locale + ' label' + (i18nKey ? ' at ' + i18nKey : '') + ' in ' + rel(catalog.files[0]) });
  }
  const target = resolveNavRoute(nodes, item.route, localeParam);
  if (item.route === null) findings.push({ code: 'NAV_ROUTE_NULL', detail: `${item.key} has no route - the navigation draws it disabled and no page answers it` });
  else if (!target) findings.push({ code: 'NAV_ROUTE_MISSING', detail: `${item.key} navigates to ${item.route}, which no page under app/ answers` });
  return { key: item.key, route: item.route, ...(i18nKey ? { i18nKey } : {}), ...(item.group ? { group: item.group } : {}), target, ...(item.route === null ? { disabled: true } : {}), labels: Object.keys(labels).length ? labels : { [catalogs[0]?.locale ?? 'en']: item.key } };
}

function addUnreachedRouteFindings(node, items, pages, byId, localeParam, findings) {
  const baseParts = urlParts(localelessUrl(node.url, localeParam));
  const reached = new Set(items.map((item) => item.target).filter(Boolean).map((id) => urlParts(localelessUrl(byId.get(id).url, localeParam))[baseParts.length]));
  const under = pages.filter((page) => isWithinNode(page, node, byId));
  const heads = new Map();
  for (const page of under) {
    const head = urlParts(localelessUrl(page.url, localeParam))[baseParts.length];
    if (head === undefined) continue;
    heads.set(head, (heads.get(head) ?? 0) + 1);
  }
  for (const [head, count] of heads) {
    if (!reached.has(head)) findings.push({ code: 'ROUTE_NOT_IN_NAV', detail: `/${[...baseParts, head].join('/')} (${count} page${count === 1 ? '' : 's'}) is reached by no navigation destination` });
  }
}

function navOf(node, registry, { catalogs, nodes, pages, byId, localeParam, rel, digests }) {
  const text = readText(registry.file) ?? '';
  digests.push([rel(registry.file), sha256File(registry.file)]);
  const { ns, prefix } = labelKeyPattern(text);
  const componentName = text.match(/export\s+(?:const|function)\s+([A-Z]\w*)/)?.[1];
  const findings = [];
  const items = registry.items.map((item) => navItemOf(item, { ns, prefix, catalogs, nodes, localeParam, findings, rel }));
  addUnreachedRouteFindings(node, items, pages, byId, localeParam, findings);
  return { ...(componentName ? { component: componentName } : {}), source: rel(registry.file), items, ...(findings.length ? { findings } : {}) };
}

/** The navigation registry of a layout's import closure: the unclaimed file with the most items (at least two). */
function navRegistryIn(closure, claimed) {
  let registry = null;
  for (const file of closure) {
    if (claimed.has(file)) continue;
    const found = registryIn(readText(file) ?? '');
    if (found.length >= 2 && (!registry || found.length > registry.items.length)) registry = { file, items: found };
  }
  return registry;
}

function scanLayouts(nodes, catalogs, appRoot, repoAbs, rel, digests, localeParam) {
  const aliases = aliasesOf(appRoot);
  const claimed = new Set();
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const pages = landingPages(nodes);
  const navScope = { catalogs, nodes, pages, byId, localeParam, rel, digests };
  for (const node of nodes) {
    if (!node.files?.layout) continue;
    const layoutAbs = path.join(repoAbs, node.files.layout.path);
    const text = readText(layoutAbs) ?? '';
    const { component, passthrough } = layoutComponentOf(text);
    const layout = { ...(component ? { component } : {}), chrome: passthrough ? 'passthrough' : 'unknown', state: passthrough ? 'done' : 'todo', rev: 1 };
    const closure = importClosure(layoutAbs, aliases, repoAbs).filter((file) => file !== layoutAbs);
    const registry = navRegistryIn(closure, claimed);
    if (registry) {
      claimed.add(registry.file);
      layout.nav = navOf(node, registry, navScope);
    }
    node.layout = layout;
  }
}

function scanAppDir(appDir, { repoRoot = null, appRoot = null, name = null } = {}, dependencies = {}) {
  const { appNameOf, digestOfParts, keyedI18n, usedI18nKeys } = dependencies;
  const dirAbs = path.resolve(appDir);
  if (!fs.existsSync(dirAbs) || !fs.statSync(dirAbs).isDirectory()) throw new Error(`${appDir}: not an app/ directory`);
  const rootAbs = path.resolve(appRoot ?? (path.basename(path.dirname(dirAbs)) === 'src' ? path.dirname(path.dirname(dirAbs)) : path.dirname(dirAbs)));
  const repoAbs = path.resolve(repoRoot ?? rootAbs);
  const rel = (abs) => slash(path.relative(repoAbs, abs));
  const { nodes, digests } = scanAppNodes(dirAbs, rel);
  const localeRoot = nodes.find((n) => n.parent === '/' && isLocaleSegment(n.segment));
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
  scanLayouts(nodes, catalogs, rootAbs, repoAbs, rel, digests, localeParam);
  digests.sort((a, b) => a[0].localeCompare(b[0]));
  const revision = gitRevision(repoAbs);
  const catalogFiles = catalogs.flatMap((c) => c.files.map((f) => ({ locale: c.locale, path: rel(f), sha256: sha256File(f) })));
  const scan = {
    app: { name: name ?? appNameOf(rel(rootAbs) || '.'), root: rel(rootAbs) || '.', appDir: rel(dirAbs), framework: 'next-app-router', ...(localeParam ? { localeParam } : {}) },
    source: { scanner: SCANNER, ...(revision ? { revision } : {}), digest: digestOfParts(digests) },
    i18n: catalogs.length ? { catalogs: catalogFiles, used: keyedI18n(catalogs, usedI18nKeys({ nodes })) } : undefined,
    productLocale,
    nodes,
  };
  // Not part of the record: the parsed catalogs (to digest the keys a merged record uses).
  Object.defineProperty(scan, 'catalogs', { value: catalogs, enumerable: false });
  return scan;
}

/** The app's name when nothing declares one: the last segment of its root (fe/apps/landing -> landing). */

export const scanTools = Object.freeze({ SCANNER, readText, segmentKindOf, isLocaleSegment, resolveNavRoute, getPath, nodeUrlOf, scanAppDir });
