// What the bound repositories actually serve, for check-work-surfaces.mjs: http routes, graphql operations, frontend
// page routes and the event vocabulary of the code (concepts 1 and 2 of that check).
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {walk} from './check-example-work.mjs';
import {isLocaleSegment} from '../layout-tree.mjs';
import {gqlOps as buildGqlOps} from './work-surface-gql.mjs';
import {HTTP_DECORATOR_WITH_OPTIONS} from './work-surface-patterns.mjs';

const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.starciwork']);
const TEST_FILE_RE = /\.(spec|test|e2e-spec)\.[tj]sx?$/;

// ---------- concept 1: source files, per bound repository ----------

/** Every src/ root a repository can have: the plain one plus one per app in an npm-workspaces
 * monorepo (e.g. be/apps/{identity,order} and fe/apps/{landing,shop}). */
function srcRootsOf(repoRoot) {
  const roots = [];
  const plain = path.join(repoRoot, 'src');
  if (fs.existsSync(plain)) roots.push(plain);
  const appsDir = path.join(repoRoot, 'apps');
  if (fs.existsSync(appsDir)) {
    for (const app of fs.readdirSync(appsDir)) {
      const appSrc = path.join(appsDir, app, 'src');
      if (fs.statSync(path.join(appsDir, app)).isDirectory() && fs.existsSync(appSrc)) roots.push(appSrc);
    }
  }
  return roots;
}

/** App name for a file inside an apps/<app>/ src root, or null for the repo's plain src/. */
function appOf(srcRoot, repoRoot) {
  const rel = path.relative(path.join(repoRoot, 'apps'), srcRoot).replaceAll('\\', '/');
  return rel !== srcRoot && !rel.startsWith('..') && rel.includes('/src') ? rel.split('/')[0] : null;
}

const srcFiles = (srcRoot, ext) =>
  walk(srcRoot).filter(f => f.endsWith(ext) && !f.split(path.sep).some(s => SKIP_DIRS.has(s)));

/** Production files only - a spec constructing an event is not the product emitting it. */
const prodFiles = (srcRoot, ext = '.ts') => srcFiles(srcRoot, ext).filter(f => !TEST_FILE_RE.test(f));

// ---------- concept 2: served surfaces (what the code actually exposes) ----------

const joinRoute = (prefix, sub) => `/${[prefix, sub].filter(Boolean).join('/')}`.replace(/\/+/g, '/');

/** HTTP routes from NestJS controllers: @Controller prefix + @Get/@Post/.../@All method decorators.
 * The path argument may be followed by options (@Post('x', {httpCode})), so the arg regex ends at
 * ',' or ')' rather than ')' alone. */
export function httpRoutes(repoRoot) {
  const routes = [];
  for (const srcRoot of srcRootsOf(repoRoot)) {
    for (const file of srcFiles(srcRoot, '.ts').filter(f => f.endsWith('.controller.ts'))) {
      const text = fs.readFileSync(file, 'utf8');
      const prefix = /@Controller\(\s*['"]([^'"]*)/.exec(text)?.[1] ?? '';
      for (const m of text.matchAll(HTTP_DECORATOR_WITH_OPTIONS)) {
        routes.push({method: m[1].toUpperCase(), path: joinRoute(prefix, m[2]), file});
      }
      for (const m of text.matchAll(/@(Get|Post|Put|Patch|Delete|Head|Options|All)\(\s*\)/g)) {
        routes.push({method: m[1].toUpperCase(), path: joinRoute(prefix, ''), file});
      }
    }
  }
  return routes;
}

/** GraphQL operation directories and resolver decorators (see work-surface-gql.mjs). */
export function gqlOps(repoRoot) {
  return buildGqlOps(repoRoot, {srcRootsOf, prodFiles, skipDirs: SKIP_DIRS});
}

/** One page.tsx under an app's src/app as a route: the leading locale segment (layout-tree isLocaleSegment: next-intl's
 * `[locale]`) is dropped and other `[param]` segments become positional `:_`. */
function pageRoute(appDir, app, file) {
  const segments = path.relative(appDir, path.dirname(file)).replaceAll('\\', '/').split('/')
    .filter(Boolean);
  if (segments.length && isLocaleSegment(segments[0])) segments.shift();
  const display = '/' + segments.join('/');
  const norm = '/' + segments.map(s => /^\[.*\]$/.test(s) ? ':_' : s).join('/');
  return {app, route: display || '/', norm: norm === '/' ? '/' : norm.replace(/\/$/, ''), file};
}

/** FE routes: every directory holding a page.tsx under each app's src/app. The leading locale segment
 * (layout-tree isLocaleSegment: next-intl's `[locale]`) is transparent and dropped; other `[param]` segments become positional `:_` so they compare equal to a
 * claim's `:param` spelling. Returns {app, route, norm, file}. */
export function feRoutes(repoRoot) {
  const routes = [];
  for (const srcRoot of srcRootsOf(repoRoot)) {
    const appDir = path.join(srcRoot, 'app');
    if (!fs.existsSync(appDir)) continue;
    const app = appOf(srcRoot, repoRoot);
    for (const file of srcFiles(appDir, 'page.tsx')) routes.push(pageRoute(appDir, app, file));
  }
  return routes;
}

let typescript = null;
const ts = () => (typescript ??= createRequire(import.meta.url)('typescript'));

function collectEnumValues(t, node, values) {
  if (t.isEnumDeclaration(node)) {
    for (const member of node.members) {
      if (member.initializer && t.isStringLiteralLike(member.initializer) && t.isIdentifier(member.name)) {
        values.set(`${node.name.text}.${member.name.text}`, member.initializer.text);
      }
    }
  }
  t.forEachChild(node, child => collectEnumValues(t, child, values));
}

/** `Enum.Member` -> its string value, for every string-valued enum member declared in `files` ([{file, text}]). */
function enumStringValues(files) {
  const values = new Map();
  for (const {file, text} of files) {
    if (!/\benum\b/.test(text)) continue;
    const t = ts();
    collectEnumValues(t, t.createSourceFile(file, text, t.ScriptTarget.Latest, false, t.ScriptKind.TS), values);
  }
  return values;
}

/** Every string a message argument carries - a literal or a string-valued enum member - handed to `add`. */
function collectMessageStrings(t, node, {add, enumValues}) {
  if (t.isStringLiteralLike(node)) add(node.text);
  else if (t.isPropertyAccessExpression(node) && t.isIdentifier(node.expression)) add(enumValues.get(`${node.expression.text}.${node.name.text}`));
  t.forEachChild(node, child => collectMessageStrings(t, child, {add, enumValues}));
}

/** The name of the transaction handle a `x.transaction(async (m) => ...)` call binds, or null. */
function transactionHandleOf(t, node) {
  if (!(t.isCallExpression(node) && t.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'transaction')) return null;
  const callback = node.arguments.find(arg => t.isArrowFunction(arg) || t.isFunctionExpression(arg));
  const handle = callback?.parameters[0]?.name;
  return handle && t.isIdentifier(handle) ? handle.text : null;
}

function visitTransactions(t, node, handles, env) {
  const handle = transactionHandleOf(t, node);
  const inner = handle ? new Set([...handles, handle]) : handles;
  if (t.isCallExpression(node) && handles.size && node.arguments.length > 1) {
    const first = node.arguments[0];
    if (t.isIdentifier(first) && handles.has(first.text)) for (const arg of node.arguments.slice(1)) collectMessageStrings(t, arg, env);
  }
  t.forEachChild(node, child => visitTransactions(t, child, inner, env));
}

/**
 * The event ids an outbox emission names, read structurally: inside a transaction callback (`x.transaction(async (m) =>
 * ...)`) a call whose first argument is that callback's own transaction handle `m` enqueues a message in the write
 * transaction (the standard emission: `outbox.enqueue(manager, toAuditAppendMessage({action: AuditAction.TaskCreated}))`).
 * Every string the message argument carries - a literal or a string-valued enum member - is a candidate event name;
 * `task.created` names `event.task.created`. A message whose strings name no event record emits nothing that counts.
 */
function outboxEmittedIds(files, enumValues) {
  const ids = new Set();
  const add = value => {
    if (typeof value !== 'string') return;
    ids.add(value);
    if (!value.startsWith('event.')) ids.add(`event.${value}`);
  };
  for (const {file, text} of files) {
    if (!/\.transaction\s*\(/.test(text)) continue;
    const t = ts();
    visitTransactions(t, t.createSourceFile(file, text, t.ScriptTarget.Latest, false, t.ScriptKind.TS), new Set(), {add, enumValues});
  }
  return ids;
}

/** The event vocabulary the code knows: `class XxxEvent` declarations paired with the `kind =
 * "event.<id>"` discriminant they carry, `new XxxEvent(` construction sites and outbox enqueues in the write
 * transaction (outboxEmittedIds) in production files (emission), and `instanceof`/@EventsHandler subscriptions per file. */
function registerEventClasses(file,text,kinds,classes){
  const declarations=[...text.matchAll(/class\s+(\w+Event)\b/g)];
  for(const [i,match] of declarations.entries()){
    // a class's kind discriminant sits in its own body - never borrow the next class's literal
    const nextClassAt=declarations[i+1]?.index??text.length;
    const kind=kinds.find(item=>item.at>match.index&&item.at<nextClassAt)?.id??null;
    if(!classes.has(match[1]))classes.set(match[1],{file,kind});
  }
}

function registerEventEmissions(file,text,kinds,emitted,emittedIds){
  for(const match of text.matchAll(/new\s+(\w+Event)\b/g))if(!emitted.has(match[1]))emitted.set(match[1],file);
  if(/\.(publish|emit|dispatch)\s*\(/.test(text))for(const kind of kinds)emittedIds.add(kind.id);
}

function registerEventSubscriptions(file,text,subscriptions){
  const handled=[...text.matchAll(/instanceof\s+(\w+Event)\b/g)].map(match=>match[1])
    .concat([...text.matchAll(/@EventsHandler\(\s*(\w+)/g)].map(match=>match[1]));
  if(handled.length||/^\s*@EventsHandler/m.test(text)||/\.subscribe\s*\(/.test(text)){
    if(handled.length)subscriptions.push({file,classes:[...new Set(handled)]});
  }
}

function inspectEventFile(file,classes,emitted,emittedIds,subscriptions,texts){
  const text=fs.readFileSync(file,'utf8');
  texts.push({file,text});
  const kinds=[...text.matchAll(/['"](event\.[a-z0-9-]+(?:\.[a-z0-9-]+)+)['"]/g)]
    .map(match=>({id:match[1],at:match.index}));
  registerEventClasses(file,text,kinds,classes);
  registerEventEmissions(file,text,kinds,emitted,emittedIds);
  registerEventSubscriptions(file,text,subscriptions);
}

export function eventSurface(repoRoot) {
  const classes = new Map();   // className -> {file, kind}
  const emitted = new Map();   // className -> file (production construction site)
  const emittedIds = new Set();// record ids emitted by literal ("event.x.y" inside a publish/emit file)
  const subscriptions = [];    // {file, classes: [className]}
  const texts = [];
  for (const srcRoot of srcRootsOf(repoRoot)) {
    for (const file of prodFiles(srcRoot)) inspectEventFile(file,classes,emitted,emittedIds,subscriptions,texts);
  }
  for (const id of outboxEmittedIds(texts, enumStringValues(texts))) emittedIds.add(id);
  return {classes, emitted, emittedIds, subscriptions};
}
