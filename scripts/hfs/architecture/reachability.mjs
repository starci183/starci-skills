/**
 * HFS check 3, reachability (knowledge/hfs/slots.yaml rules BE_FEATURE_NOT_COMPOSED, FE_OWNER_REACHABLE):
 *   BE  every feature owner (be.feature) and every capability owner (be.domain, be.integrations, be.platform) must be
 *       composed into an app root: reachable from an app entry file (apps/<app>/src, the be.app.* owners) through runtime
 *       imports and re-exports. A type-only import composes nothing. A module reached only through a reached module
 *       is reached. An owner no root reaches is dead code: no process ever serves it.
 *   FE  every page/layout/overlay feature (fe.feature) must be mounted: reachable by runtime imports from a file of
 *       its app's route tree (apps/<app>/src/app, slot fe.route); and every string-literal href/redirect/router target
 *       must resolve to a route of that app (page.tsx / route.ts under src/app, route groups and [locale] transparent).
 * Only literals are judged: a computed href is counted as skipped, never guessed at.
 */
import { byCodeUnit } from '../../lib/list.mjs';

export const REACHABILITY_RULE_IDS = ['BE_FEATURE_NOT_COMPOSED', 'FE_OWNER_REACHABLE', 'FE_HREF_RESOLVES'];

const BE_CAPABILITY_SLOTS = new Set(['be.domain', 'be.integrations', 'be.platform']);
const TEST_FILE = /(?:\.(?:spec|test|stories|e2e-spec)\.[cm]?[jt]sx?$)|(?:(?:^|\/)__tests__\/)/;
const ROUTE_FILE = /^(?:page|route)\.(?:tsx|ts|jsx|js)$/;
const PLACEHOLDER = '\u0000';

/** Breadth-first reach over runtime, non-type-only edges (re-exports included) from `roots`. */
function reachFrom(graph, roots) {
  const forward = new Map();
  for (const edge of graph.edges) {
    if (!edge.runtime) continue;
    if (!forward.has(edge.from)) forward.set(edge.from, []);
    forward.get(edge.from).push(edge.to);
  }
  const reached = new Set(roots);
  const queue = [...roots];
  while (queue.length) {
    for (const next of forward.get(queue.shift()) ?? []) {
      if (reached.has(next)) continue;
      reached.add(next);
      queue.push(next);
    }
  }
  return reached;
}

function ownerFiles(graph) {
  const byUnit = new Map();
  for (const [rel, node] of graph.files) {
    if (!node.owner) continue;
    const key = `${node.owner.slot}:${node.owner.root}`;
    if (!byUnit.has(key)) byUnit.set(key, []);
    byUnit.get(key).push(rel);
  }
  return byUnit;
}

/** The file that stands for an owner in a finding: its public entry when the graph holds one, else its first file. */
function entryOf(root, files) {
  const base = root.replace(/\/$/, '');
  return files.find(rel => new RegExp(String.raw`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/index\.[tj]sx?$`).test(rel)) ?? [...files].sort(byCodeUnit)[0];
}

function checkBackend(graph) {
  const byUnit = ownerFiles(graph);
  const rootFiles = [];
  const appRoots = new Set();
  for (const [key, files] of byUnit) {
    const slot = key.slice(0, key.indexOf(':'));
    if (!slot.startsWith('be.app.')) continue;
    appRoots.add(key.slice(key.indexOf(':') + 1));
    for (const rel of files) if (!TEST_FILE.test(rel)) rootFiles.push(rel);
  }
  const roots = [...appRoots].sort(byCodeUnit);
  const counts = { features: 0, modules: 0, appRoots: roots.length, notComposed: 0 };
  if (!roots.length) return { violations: [], coverage: { status: 'unavailable', reason: 'no be.app.* owner instance holds a source file, so there is no app root to compose into', ...counts } };
  const reached = reachFrom(graph, rootFiles);
  const violations = [];
  for (const [key, files] of [...byUnit].sort(([a], [b]) => a.localeCompare(b))) {
    const slot = key.slice(0, key.indexOf(':'));
    const root = key.slice(key.indexOf(':') + 1);
    const feature = slot === 'be.feature';
    if (!feature && !BE_CAPABILITY_SLOTS.has(slot)) continue;
    counts[feature ? 'features' : 'modules'] += 1;
    if (files.some(rel => reached.has(rel))) continue;
    counts.notComposed += 1;
    const label = root.replace(/\/$/, '');
    violations.push({
      ruleId: 'BE_FEATURE_NOT_COMPOSED',
      path: entryOf(root, files), owner: label, slot, appRoots: roots,
      message: `${feature ? 'Feature' : 'Module'} ${label} is not composed into any app: no runtime import path leads from ${roots.join(', ')} to it (a type-only import composes nothing), so it is dead code that no process serves.`,
    });
  }
  return { violations, coverage: { status: 'checked', ...counts } };
}

/** Route table of one app: arrays of segments, each {kind:'static'|'dyn'|'catch'|'optcatch', text}. */
function routeTable(graph, app) {
  const prefix = `apps/${app}/src/app/`;
  const routes = [];
  for (const rel of graph.files.keys()) {
    if (!rel.startsWith(prefix)) continue;
    const parts = rel.slice(prefix.length).split('/');
    if (!ROUTE_FILE.test(parts.at(-1))) continue;
    const segments = [];
    let usable = true;
    for (const part of parts.slice(0, -1)) {
      if (/^\([^.)][^)]*\)$/.test(part)) continue;            // route group
      if (part.startsWith('@')) continue;                      // parallel slot: no URL segment
      if (part.startsWith('_') || /^\(\.+\)/.test(part)) { usable = false; break; } // private folder, intercepting route
      segments.push(part);
    }
    if (!usable) continue;
    if (segments[0] === '[locale]') segments.shift();
    routes.push(segments.map(part => {
      if (/^\[\[\.\.\..+\]\]$/.test(part)) return { kind: 'optcatch', text: part };
      if (/^\[\.\.\..+\]$/.test(part)) return { kind: 'catch', text: part };
      if (/^\[.+\]$/.test(part)) return { kind: 'dyn', text: part };
      return { kind: 'static', text: part };
    }));
  }
  return routes;
}

/** One href segment (may contain PLACEHOLDER for a template expression) against one route segment. */
function segmentMatches(hrefSegment, routeSegment) {
  if (!hrefSegment.includes(PLACEHOLDER)) return routeSegment.kind === 'dyn' || routeSegment.text === hrefSegment;
  if (routeSegment.kind === 'dyn' || routeSegment.kind === 'catch' || routeSegment.kind === 'optcatch') return true;
  const parts = hrefSegment.split(PLACEHOLDER).map(part => part.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`));
  return new RegExp(`^${parts.join('.*')}$`).test(routeSegment.text);
}

function matchRoute(hrefSegments, route, at = 0, from = 0) {
  if (from === route.length) return at === hrefSegments.length;
  const routeSegment = route[from];
  if (routeSegment.kind === 'optcatch' && matchRoute(hrefSegments, route, at, from + 1)) return true;
  if (routeSegment.kind === 'catch' || routeSegment.kind === 'optcatch') {
    for (let take = 1; at + take <= hrefSegments.length; take += 1) if (matchRoute(hrefSegments, route, at + take, from + 1)) return true;
    return false;
  }
  if (at >= hrefSegments.length || !segmentMatches(hrefSegments[at], routeSegment)) return false;
  return matchRoute(hrefSegments, route, at + 1, from + 1);
}

function hrefResolves(href, routes) {
  const cut = href.search(/[?#]/);
  const pathOnly = cut === -1 ? href : href.slice(0, cut);
  const segments = pathOnly.split('/').slice(1).filter(segment => segment !== '');
  const candidates = [segments];
  // A leading locale (a literal `en`/`vi-VN` or a bare template expression) is what [locale] carries: try without it too.
  if (segments.length && (/^[a-z]{2}(?:-[a-zA-Z]{2})?$/.test(segments[0]) || segments[0] === PLACEHOLDER)) candidates.push(segments.slice(1));
  return candidates.some(candidate => routes.some(route => matchRoute(candidate, route)));
}

/** The text of a string-ish expression with PLACEHOLDER for each ${...}; null when it is not a literal we can read. */
function literalText(ts, node) {
  if (!node) return null;
  while (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || (ts.isNonNullExpression && ts.isNonNullExpression(node))) node = node.expression;
  if (ts.isStringLiteralLike(node)) return node.text;                 // includes NoSubstitutionTemplateLiteral
  if (ts.isTemplateExpression(node)) return node.head.text + node.templateSpans.map(span => PLACEHOLDER + span.literal.text).join('');
  return null;
}

const NAVIGATION_CALLS = new Set(['redirect', 'permanentRedirect']);
const ROUTER_METHODS = new Set(['push', 'replace', 'prefetch']);

/** Every href-like target in a source file: {node, text|null (null = computed)}. */
function hrefTargets(ts, sourceFile) {
  const found = [];
  const visit = node => {
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === 'href' && node.initializer) {
      const value = ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer;
      found.push({ node: value ?? node, text: value ? literalText(ts, value) : null });
    } else if (ts.isCallExpression(node) && node.arguments.length) {
      const callee = node.expression;
      const navigates = (ts.isIdentifier(callee) && NAVIGATION_CALLS.has(callee.text))
        || (ts.isPropertyAccessExpression(callee) && ROUTER_METHODS.has(callee.name.text)
          && /router$/i.test(ts.isIdentifier(callee.expression) ? callee.expression.text : ts.isPropertyAccessExpression(callee.expression) ? callee.expression.name.text : ''));
      if (navigates) found.push({ node: node.arguments[0], text: literalText(ts, node.arguments[0]) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function checkFrontend(config, context, graph) {
  const ts = context.ts ?? context.loaded.ts;
  const byUnit = ownerFiles(graph);
  const apps = new Map();
  for (const [rel, node] of graph.files) {
    if (node.slot !== 'fe.route') continue;
    const app = /^apps\/([^/]+)\/src\/app\//.exec(rel)?.[1];
    if (!app) continue;
    if (!apps.has(app)) apps.set(app, []);
    apps.get(app).push(rel);
  }
  const counts = { pages: 0, mounted: 0, hrefs: 0, hrefsResolved: 0, hrefsSkipped: 0, routes: 0 };
  const violations = [];
  const reachedByApp = new Map([...apps].map(([app, roots]) => [app, reachFrom(graph, roots)]));
  for (const [key, files] of [...byUnit].sort(([a], [b]) => a.localeCompare(b))) {
    if (!key.startsWith('fe.feature:')) continue;
    const root = key.slice('fe.feature:'.length);
    const app = /^apps\/([^/]+)\//.exec(root)?.[1];
    counts.pages += 1;
    const reached = reachedByApp.get(app);
    if (reached && files.some(rel => reached.has(rel))) { counts.mounted += 1; continue; }
    const label = root.replace(/\/$/, '');
    violations.push({
      ruleId: 'FE_OWNER_REACHABLE', path: entryOf(root, files), owner: label, app,
      message: `${label} is not mounted: no runtime import path leads from a route file under apps/${app}/src/app to it (a type-only import mounts nothing), so the page is never shown.`,
    });
  }
  for (const app of [...new Set([...apps.keys(), ...[...graph.files.keys()].map(rel => /^apps\/([^/]+)\/src\//.exec(rel)?.[1]).filter(Boolean)])].sort(byCodeUnit)) {
    const routes = routeTable(graph, app);
    counts.routes += routes.length;
    const prefix = `apps/${app}/src/`;
    for (const [rel, node] of graph.files) {
      if (!rel.startsWith(prefix) || TEST_FILE.test(rel)) continue;
      for (const target of hrefTargets(ts, node.sourceFile)) {
        counts.hrefs += 1;
        const text = target.text;
        if (text === null || !text.startsWith('/') || text.startsWith('//') || !routes.length) { counts.hrefsSkipped += 1; continue; }
        const hrefPath = text.split(/[?#]/)[0];
        if (/\.[A-Za-z0-9]{1,6}$/.test(hrefPath.split('/').at(-1))) { counts.hrefsSkipped += 1; continue; } // static asset
        if (hrefResolves(text, routes)) { counts.hrefsResolved += 1; continue; }
        const point = node.sourceFile.getLineAndCharacterOfPosition(target.node.getStart(node.sourceFile));
        const shown = text.split(PLACEHOLDER).join('${…}');
        violations.push({
          ruleId: 'FE_HREF_RESOLVES', path: rel, line: point.line + 1, column: point.character + 1, app, href: shown,
          message: `href "${shown}" matches no route of app ${app}: no page.tsx or route.ts under ${prefix}app serves that path.`,
        });
      }
    }
  }
  return { violations, coverage: { status: 'checked', ...counts } };
}

export function checkReachability({ config, context, graph } = {}) {
  return graph.profile === 'be' ? checkBackend(graph) : checkFrontend(config, context, graph);
}
