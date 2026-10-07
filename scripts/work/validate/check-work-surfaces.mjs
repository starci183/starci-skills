#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {walk} from './check-example-work.mjs';
import {isLocaleSegment} from '../layout-tree.mjs';
import {createRequire} from 'node:module';
import {APP_SIDES, readWorkspace, resolveOwnedDirs, repoRootFor, loadRecords, indexInlineCriteria, resolveRecordRef} from '../record-ownership.mjs'; import { isMain } from '../../lib/is-main.mjs';
import {gqlOps as buildGqlOps, camelOf} from './work-surface-gql.mjs';
import {declaredSubscriptions,wiredSubscriptions,reportWiredSubscriptionDiff,reportFeaturesWithoutSubscribers,appendSurfaceMap} from './work-surface-reporting.mjs';

/**
 * The audits' sharpest surface complaint was the `/buyers` vs `/internal/buyers` class: a done contract
 * describing a wire no controller serves, discovered only when a live run fell over. check-work-deep.mjs
 * carries heuristic SUSPECT-tier versions of this diff (UNCLAIMED_SURFACE, GHOST_SURFACE,
 * CAPABILITY_WITHOUT_*) - deliberately soft, because regex extraction can lie in both directions. This
 * script is the standalone, rigorous pass over the same question: it extracts every public surface the
 * bound repositories actually serve (HTTP routes, GraphQL operations, frontend page routes, domain
 * events) and diffs it against every surface the tree declares (contract surfaces, integration
 * endpoints, ui-screen routes, event records, `subscribes`).
 *
 * Severity follows check-work-deep's discipline:
 *   REFUSE  - a done record asserts a surface nothing serves (deterministically wrong: the record claims
 *             a wire that does not exist)
 *   SUSPECT - served code no record explains, or a todo record's declared surface is not yet served
 *             (extraction is heuristic; an undeclared door can be legitimate)
 *   INFO    - ops-class routes and counts - visible, never alarming
 *
 * Emission is judged on non-spec files only: the bus spec suite constructs every event class
 * (including NewDeviceSigninEvent, which no use case publishes), so counting spec construction as
 * emission would report the exact lie this check exists to catch.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.starciwork']);
const TEST_FILE_RE = /\.(spec|test|e2e-spec)\.[tj]sx?$/;
const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'ALL']);
const EVENT_ID_RE = /^event\.[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/** Probe doors a host serves for its own sake - real, but no contract could ever own /health. */
const OPS_ROUTE_RE = /^\/(health|healthz|ready|readyz|live|livez|metrics|favicon\.ico|\.well-known)(\/|$)/;

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

/** HTTP routes from NestJS controllers: @Controller prefix + @Get/@Post/.../@All method decorators.
 * The path argument may be followed by options (@Post('x', {httpCode})), so the arg regex ends at
 * ',' or ')' rather than ')' alone. */
function httpRoutes(repoRoot) {
  const routes = [];
  for (const srcRoot of srcRootsOf(repoRoot)) {
    for (const file of srcFiles(srcRoot, '.ts').filter(f => f.endsWith('.controller.ts'))) {
      const text = fs.readFileSync(file, 'utf8');
      const prefix = /@Controller\(\s*['"]([^'"]*)/.exec(text)?.[1] ?? '';
      for (const m of text.matchAll(/@(Get|Post|Put|Patch|Delete|Head|Options|All)\(\s*['"]([^'"]*)['"]?\s*[,)]/g)) {
        routes.push({method: m[1].toUpperCase(), path: joinRoute(prefix, m[2]), file});
      }
      for (const m of text.matchAll(/@(Get|Post|Put|Patch|Delete|Head|Options|All)\(\s*\)/g)) {
        routes.push({method: m[1].toUpperCase(), path: joinRoute(prefix, ''), file});
      }
    }
  }
  return routes;
}

const joinRoute = (prefix, sub) => `/${[prefix, sub].filter(Boolean).join('/')}`.replace(/\/+/g, '/');

/** GraphQL operation directories and resolver decorators (see work-surface-gql.mjs). */
export function gqlOps(repoRoot) {
  return buildGqlOps(repoRoot, {srcRootsOf, prodFiles, skipDirs: SKIP_DIRS});
}

/** FE routes: every directory holding a page.tsx under each app's src/app. The leading locale segment
 * (layout-tree isLocaleSegment: next-intl's `[locale]`) is transparent and dropped; other `[param]` segments become positional `:_` so they compare equal to a
 * claim's `:param` spelling. Returns {app, route, norm, file}. */
function feRoutes(repoRoot) {
  const routes = [];
  for (const srcRoot of srcRootsOf(repoRoot)) {
    const appDir = path.join(srcRoot, 'app');
    if (!fs.existsSync(appDir)) continue;
    const app = appOf(srcRoot, repoRoot);
    for (const file of srcFiles(appDir, 'page.tsx')) {
      const segments = path.relative(appDir, path.dirname(file)).replaceAll('\\', '/').split('/')
        .filter(Boolean);
      if (segments.length && isLocaleSegment(segments[0])) segments.shift();
      const display = '/' + segments.join('/');
      const norm = '/' + segments.map(s => /^\[.*\]$/.test(s) ? ':_' : s).join('/');
      routes.push({app, route: display || '/', norm: norm === '/' ? '/' : norm.replace(/\/$/, ''), file});
    }
  }
  return routes;
}

let typescript = null;
const ts = () => (typescript ??= createRequire(import.meta.url)('typescript'));

/** `Enum.Member` -> its string value, for every string-valued enum member declared in `files` ([{file, text}]). */
function enumStringValues(files) {
  const values = new Map();
  for (const {file, text} of files) {
    if (!/\benum\b/.test(text)) continue;
    const t = ts(), source = t.createSourceFile(file, text, t.ScriptTarget.Latest, false, t.ScriptKind.TS);
    const visit = node => {
      if (t.isEnumDeclaration(node)) {
        for (const member of node.members) {
          if (member.initializer && t.isStringLiteralLike(member.initializer) && t.isIdentifier(member.name)) {
            values.set(`${node.name.text}.${member.name.text}`, member.initializer.text);
          }
        }
      }
      t.forEachChild(node, visit);
    };
    visit(source);
  }
  return values;
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
  const add = value => { if (typeof value !== 'string') return; ids.add(value); if (!value.startsWith('event.')) ids.add(`event.${value}`); };
  for (const {file, text} of files) {
    if (!/\.transaction\s*\(/.test(text)) continue;
    const t = ts(), source = t.createSourceFile(file, text, t.ScriptTarget.Latest, false, t.ScriptKind.TS);
    const strings = node => {
      if (t.isStringLiteralLike(node)) add(node.text);
      else if (t.isPropertyAccessExpression(node) && t.isIdentifier(node.expression)) add(enumValues.get(`${node.expression.text}.${node.name.text}`));
      t.forEachChild(node, strings);
    };
    const visit = (node, handles) => {
      let inner = handles;
      if (t.isCallExpression(node) && t.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'transaction') {
        const callback = node.arguments.find(arg => t.isArrowFunction(arg) || t.isFunctionExpression(arg));
        const handle = callback?.parameters[0]?.name;
        if (handle && t.isIdentifier(handle)) inner = new Set([...handles, handle.text]);
      }
      if (t.isCallExpression(node) && handles.size && node.arguments.length > 1) {
        const first = node.arguments[0];
        if (t.isIdentifier(first) && handles.has(first.text)) for (const arg of node.arguments.slice(1)) strings(arg);
      }
      t.forEachChild(node, child => visit(child, inner));
    };
    visit(source, new Set());
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

function eventSurface(repoRoot) {
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

// ---------- concept 3: declared surfaces (what the records claim) ----------

const HTTP_DECL_RE = /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|ALL)\s+(\/[^\s,;'")\]}]+)/g;

/** Words that sit where an op name could, but are prose ("the GraphQL schema", "query planner") -
 * a candidate matching one is never a declared operation. */
const GQL_STOPWORDS = new Set(['schema', 'request', 'response', 'endpoint', 'door', 'layer', 'side', 'api',
  'gateway', 'field', 'type', 'resolver', 'operation', 'call', 'payload', 'document', 'string', 'body', 'header']);

// strict patterns: the op name's position is unambiguous, so a miss is a ghost. Loose patterns
// ("GraphQL query composes ..." would yield 'composes') only ever make a served op claimed.
const GQL_STRICT_RES = [
  /\b([a-zA-Z_]\w*)\s*\([^)]*\)\s+GraphQL\s+(query|mutation)\b/g,   // "the account(personId) GraphQL query"
  /\b([a-zA-Z_]\w*)\s+GraphQL\s+(query|mutation)\b/g,               // "the taskCounts GraphQL query"
  /\bGraphQL\s+([a-zA-Z_]\w*)\s+(query|mutation)\b/g,               // "the GraphQL taskCounts query"
];
const GQL_LOOSE_RES = [
  /\bGraphQL\s+(query|mutation)\s+([a-zA-Z_]\w*)/g,                 // "the GraphQL query taskCounts"
  // "mutation addCartItem" (camelCase only - prose words stay lowercase)
  /\b(query|mutation)\s+([a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*)\b/g,
];

const surfaceEntriesOf = data => {
  const surf = data?.surface;
  const entries = (Array.isArray(surf) && surf) || (surf && typeof surf === 'object' && [surf]) || [];
  const out = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') { out.push({name: null, text: String(entry ?? '')}); continue; }
    const httpItems = (Array.isArray(entry.http) && entry.http) || (entry.http && [entry.http]) || [];
    for (const item of httpItems) {
      if (item?.method && item?.path) {
        out.push({name: entry.name ?? item.name ?? null,
          declared: {method: String(item.method).toUpperCase(), path: item.path}});
      }
    }
    const requests = Array.isArray(entry.requests) ? entry.requests : [];
    const text = [entry.shape, entry.transport, entry.guarantee, entry.stability, ...requests.map(r => r?.shape ?? r)]
      .filter(v => typeof v === 'string').join('\n');
    out.push({name: entry.name ?? null, text});
  }
  return out;
};

/** Every `METHOD /path` a contract surface declares - from {method, path} http items and from
 * `GET /x` text inside shape/transport/guarantee/stability/requests prose. */
function declaredHttpOf(data) {
  const out = [];
  for (const entry of surfaceEntriesOf(data)) {
    if (entry.declared) out.push(entry.declared);
    for (const m of (entry.text ?? '').matchAll(HTTP_DECL_RE)) {
      const path = m[2].replace(/[.,:]+$/, '');
      if (path !== '/graphql') out.push({method: m[1].toUpperCase(), path});
    }
  }
  return out;
}

/** GraphQL operation names a contract surface declares. `strict` selects only the patterns whose
 * capture position is provably a name - loose shapes ("GraphQL query composes ..." -> 'composes')
 * are claim material, never ghost evidence. */
function appendGqlMatches(text,res,out){
  for(const re of res){
    for(const match of text.matchAll(re)){
      const [a,b]=[match[1],match[2]];
      const name=/^(query|mutation)$/i.test(a)?b:a;
      if(name&&!/^(query|mutation)$/i.test(name)&&!GQL_STOPWORDS.has(name.toLowerCase()))out.push(name);
    }
  }
}

function declaredGqlOf(data, strict) {
  const out = [];
  const res = strict ? GQL_STRICT_RES : [...GQL_STRICT_RES, ...GQL_LOOSE_RES];
  for (const entry of surfaceEntriesOf(data)) {
    const text = `${entry.name ?? ''}\n${entry.text ?? ''}`;
    appendGqlMatches(text,res,out);
  }
  return [...new Set(out)];
}

/** Event record ids a contract surface names, as `event.<id>` entry names or `publish(XxxEvent)`
 * shapes - the emitted-events contract's vocabulary. */
function declaredEventIdsOf(data) {
  const out = [];
  for (const entry of surfaceEntriesOf(data)) {
    if (entry.name && EVENT_ID_RE.test(entry.name)) out.push(entry.name);
    for (const m of (entry.text ?? '').matchAll(/['"](event\.[a-z0-9-]+(?:\.[a-z0-9-]+)+)['"]/g)) out.push(m[1]);
  }
  return [...new Set(out)];
}

/** GraphQL op names any record's serialized data claims in passing - sds flow messages like
 * "mutation addCartItem on /graphql" declare a door without owning it; naming one that exists is a
 * claim, naming one that does not is never refused (sequence prose is a diagram, not a surface). */
function gqlNamesMentioned(data) {
  const names = new Set();
  const collect = node => {
    if (typeof node === 'string') {
      for (const m of node.matchAll(/\b(query|mutation)\s+([a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*)\b/g)) names.add(m[2]);
      for (const m of node.matchAll(/\b([a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*)\s+(query|mutation)\b/g)) names.add(m[1]);
      return;
    }
    if (Array.isArray(node)) return node.forEach(collect);
    if (node && typeof node === 'object') Object.values(node).forEach(collect);
  };
  collect(data);
  return names;
}

/** ui-screen route claims: ui.surfaces[].route (or .entry), a bare `/path` or a full URL whose port
 * names the app through metadata.json's ports projection. */
function uiRouteClaims(records) {
  const claims = [];
  const indexFileOf = rec => path.join(rec.dir, 'index.yaml');
  for (const [id, rec] of records) {
    if (rec.schema !== 'work/ui-screen@1') continue;
    for (const s of rec.data?.ui?.surfaces ?? []) {
      const raw = s?.route ?? s?.entry;
      if (typeof raw !== 'string' || !raw.trim()) continue;
      const url = /^https?:\/\/[^/]+(\/\S*)?$/.exec(raw.trim());
      const port = /^https?:\/\/[^:]+:(\d+)/.exec(raw.trim())?.[1] ?? null;
      const pathPart = (url ? (url[1] ?? '/') : raw.trim());
      claims.push({id, state: rec.data?.state, file: indexFileOf(rec), raw: raw.trim(),
        port, norm: normRoute(pathPart), name: s?.name ?? null});
    }
  }
  return claims;
}

/** `<app>` for a port, via the ports projection in metadata.json beside the tree (or in the fe repo
 * itself) - `landing: 3069` means localhost:3069 is apps/landing's dev server. */
function portAppMap(workRoot, feRoot) {
  const map = new Map();
  for (const dir of [path.dirname(workRoot), feRoot]) {
    const file = path.join(dir, 'metadata.json');
    if (!fs.existsSync(file)) continue;
    try {
      const ports = JSON.parse(fs.readFileSync(file, 'utf8'))?.ports ?? {};
      for (const [name, port] of Object.entries(ports)) {
        if (fs.existsSync(path.join(feRoot, 'apps', name, 'src', 'app'))) map.set(String(port), name);
      }
    } catch { /* an unreadable metadata.json means no port mapping, not a failure */ }
  }
  return map;
}

// ---------- concept 4: normalization - :param segments compare positionally ----------

const normRoute = p => ('/' + String(p).split('/')
  .filter(Boolean)
  .map(s => (s.startsWith(':') || s.startsWith('[') ? ':_' : s))
  .join('/')).replace(/\/+$/, '') || '/';

const normMethod = m => String(m).toUpperCase();
const servedKey = r => `${normMethod(r.method)} ${normRoute(r.path)}`;
const declaredKey = d => `${normMethod(d.method)} ${normRoute(d.path)}`;

/** The work/event@1 id an event class maps to: its `kind` discriminant when it carries one (the
 * honest binding), else the id-shaped guess - `TaskDeletedEvent` keeps the feature segment,
 * `SignedInEvent` drops it, so both mappings are tried before anything is suspected. */
const eventClassNamesOf = id => {
  const pascal = s => s.split(/[-.]/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join('');
  const segments = id.replace(/^event\./, '').split('.');
  return [pascal(segments.join('-')) + 'Event', pascal(segments.slice(1).join('-')) + 'Event'];
};

function ownershipClaims(records,workspaceDoc,workRoot,canon,featureOf){
  const ownedDirs=[];
  const provedIds=new Set();
  for(const [id,rec] of records){
    if(rec.schema==='work/implementation@1'){
      for(const target of rec.data?.proves??[])if(typeof target==='string')provedIds.add(canon(target));
    }
    for(const dir of resolveOwnedDirs(id,rec,records,workspaceDoc,workRoot)){
      if(fs.existsSync(dir.abs))ownedDirs.push({id,abs:dir.abs,feature:featureOf(rec)});
    }
  }
  const ownerOf=file=>ownedDirs.filter(dir=>file.startsWith(dir.abs))
    .sort((a,b)=>b.abs.length-a.abs.length)[0]??null;
  const implIds=new Set([...records].filter(([,rec])=>rec.schema==='work/implementation@1').map(([id])=>id));
  const implNamed=name=>[...implIds].find(id=>id.split('.').pop()===name)??null;
  return {provedIds,ownerOf,implNamed};
}

function contractDeclarations(records,indexFile){
  const declaredHttp=[];
  const declaredGql=[];
  const contractClaimedOps=new Set();
  const declaredContractEvents=[];
  const integrationEndpoints=[];
  for(const [id,rec] of records){
    const file=indexFile(rec);
    if(rec.schema==='work/contract@1'){
      for(const item of declaredHttpOf(rec.data))declaredHttp.push({...item,id,state:rec.data?.state,file});
      for(const name of declaredGqlOf(rec.data,true))declaredGql.push({name,id,state:rec.data?.state,file});
      for(const name of declaredGqlOf(rec.data,false))contractClaimedOps.add(name);
      for(const eventId of declaredEventIdsOf(rec.data))declaredContractEvents.push({id:eventId,by:id,file});
    }
    if(rec.schema==='work/integration@1'){
      for(const endpoint of Array.isArray(rec.data?.endpoints)?rec.data.endpoints:[]){
        const method=String(endpoint?.method??'').toUpperCase();
        if(HTTP_METHODS.has(method)&&typeof endpoint?.path==='string'&&endpoint.path.startsWith('/')){
          integrationEndpoints.push({method,path:endpoint.path,id,state:rec.data?.state,file});
        }
      }
    }
  }
  return {declaredHttp,declaredGql,contractClaimedOps,declaredContractEvents,integrationEndpoints};
}

function matchDeclaredRoutes(declarations,declaredHttp,servedRoutes,servedKeys,provedIds,suspect,refuse,info){
  const claimedRouteKeys=new Set();
  for(const declaration of declarations){
    const key=declaredKey(declaration);
    const served=servedKeys.get(key)
      ??servedRoutes.find(route=>route.method==='ALL'&&normRoute(route.path)===normRoute(declaration.path));
    if(served){
      claimedRouteKeys.add(servedKey(served));
      if(declaredHttp.includes(declaration)&&!provedIds.has(declaration.id)){
        suspect(declaration.file,'CONTRACT_ROUTE_UNPROVEN',
          `${declaration.id}'s declared route ${declaration.method} ${declaration.path} is served by ${path.basename(served.file)} but no `+
          `impl record's proves names ${declaration.id} - the wire exists in contract and code, yet no implementation claims it`);
      }
    }else if(declaredHttp.includes(declaration)){
      // a contract's declared wire with no serving route is the /buyers-vs-/internal/buyers class -
      // deterministically wrong once the contract is done; a todo contract may describe a wire not
      // yet built, so it is suspected, not refused
      const msg=`${declaration.id} declares "${declaration.method} ${declaration.path}" but no controller in any bound repository `+
        'serves it - a done contract describing a wire that does not exist';
      if(declaration.state==='done')refuse(declaration.file,'CONTRACT_GHOST_ROUTE',msg);
      else suspect(declaration.file,'CONTRACT_GHOST_ROUTE',
        `${msg} (record is ${declaration.state??'(no state)'}, not done - the door may still be unbuilt)`);
    }else{
      // an integration endpoint is the provider's wire, not ours: unserved usually means outbound
      // (SePay's /userapi/..., Keycloak's /realms/...), which no controller could ever serve - INFO,
      // with the one question a reader has to answer themselves
      info(declaration.file,'INTEGRATION_ENDPOINT_REMOTE',
        `${declaration.id} endpoint "${declaration.method} ${declaration.path}" is not served by any bound repository - expected for the `+
        "provider's own API; check this entry if the endpoint was meant as an inbound door (webhook/callback)");
    }
  }
  return claimedRouteKeys;
}

function reportUndeclaredRoutes(servedRoutes,claimedRouteKeys,ownerOf,suspect,info){
  for(const route of servedRoutes){
    if(claimedRouteKeys.has(servedKey(route)))continue;
    if(OPS_ROUTE_RE.test(normRoute(route.path))){
      info(route.file,'OPS_ROUTE',`${route.method} ${route.path} is an ops/probe door - real, but no contract could ever own it`);
      continue;
    }
    const owner=ownerOf(route.file);
    const msg=`${route.method} ${route.path} served by ${path.basename(route.file)} `+
      (owner?`is owned by ${owner.id} but declared by no contract or integration endpoint `+
        '- a wire between features with no record of its shape'
        :"sits under no record's owners and is declared nowhere - a shipped surface the tree cannot explain");
    suspect(route.file,'UNDECLARED_ROUTE',msg);
  }
}

function claimGraphOps(ops,records,ownerOf,implNamed,contractClaimedOps){
  const opNames=new Set(ops.map(op=>op.name));
  const sdsNamedOps=new Set();
  for(const [,rec] of records){
    if(rec.schema==='work/sds-component@1'){
      for(const name of gqlNamesMentioned(rec.data))sdsNamedOps.add(name);
    }
  }
  const unclaimed=new Map();
  for(const op of ops){
    const owner=op.file?ownerOf(op.file):null;
    const namedImpl=op.dir?implNamed(op.dir):null;
    const names=[op.name,op.dir,op.dir&&camelOf(op.dir)].filter(Boolean);
    const named=set=>names.some(name=>set.has(name));
    op.claim=owner?.id??namedImpl
      ??((named(contractClaimedOps)&&'contract-surface')||(named(sdsNamedOps)&&'sds-flow')||null);
    if(!op.claim){
      const group=op.cap?`${(op.kind==='query'&&'queries')||'mutations'}/${op.cap}`:`decorated ${op.kind}`;
      if(!unclaimed.has(group))unclaimed.set(group,[]);
      unclaimed.get(group).push(op);
    }
  }
  return {opNames,unclaimed};
}

function reportUnclaimedGraphOps(unclaimed,workRoot,suspect){
  for(const [group,groupOps] of unclaimed){
    const names=groupOps.map(op=>op.name).join(', ');
    suspect(groupOps[0].file??workRoot,'UNDECLARED_OPERATION',
      `graphql ${group} serves ${groupOps.length} op(s) no record owns or names: ${names} `+
      '- protocol adaptation is thin, but a shipped door should still be explained');
  }
}

function reportDeclaredGraphOps(declaredGql,opNames,provedIds,suspect,refuse){
  for(const declaration of declaredGql){
    if(opNames.has(declaration.name)||opNames.has(camelOf(declaration.name))){
      if(!provedIds.has(declaration.id)){
        suspect(declaration.file,'CONTRACT_OP_UNPROVEN',
          `${declaration.id}'s surface names GraphQL ${declaration.name}, which is served, but no impl record's proves names `+
          `${declaration.id} - the op exists in contract and code, yet no implementation claims it`);
      }
      continue;
    }
    const msg=`${declaration.id}'s surface names GraphQL ${declaration.name} but no resolver serves an op of that name `+
      '- the record describes a door that does not exist';
    if(declaration.state==='done')refuse(declaration.file,'CONTRACT_GHOST_OP',msg);
    else suspect(declaration.file,'CONTRACT_GHOST_OP',`${msg} (record is ${declaration.state??'(no state)'}, not done)`);
  }
}

function checkFeRoutes(workRoot,feRoots,records,suspect,refuse){
  const feRoutesAll=feRoots.flatMap(repo=>feRoutes(repo).map(route=>({...route,repo})));
  const claims=uiRouteClaims(records);
  const portToApp=new Map();
  for(const repo of feRoots)for(const [port,app] of portAppMap(workRoot,repo))portToApp.set(port,app);
  const claimedFe=new Set();
  for(const claim of claims){
    // a URL claim's port pins the app through metadata.json's ports projection; an unmapped port
    // degrades to a path match across every app rather than an automatic ghost
    const expectedApp=claim.port?portToApp.get(claim.port)??null:null;
    const hit=feRoutesAll.filter(route=>route.norm===claim.norm&&(!expectedApp||route.app===expectedApp));
    if(hit.length){
      for(const route of hit)claimedFe.add(`${route.repo}#${route.app??''}#${route.norm}`);
      continue;
    }
    const where=expectedApp?` on apps/${expectedApp}`:'';
    const msg=`${claim.id} claims route ${claim.raw} (as ${claim.norm}${where}) but no page.tsx serves it in any `+
      'bound fe repository - a screen the record says exists that no route reaches';
    if(claim.state==='done')refuse(claim.file,'UI_ROUTE_GHOST',msg);
    else suspect(claim.file,'UI_ROUTE_GHOST',`${msg} (record is ${claim.state??'(no state)'}, not done)`);
  }
  for(const route of feRoutesAll){
    if(!claimedFe.has(`${route.repo}#${route.app??''}#${route.norm}`)){
      suspect(route.file,'UI_ROUTE_UNDECLARED',
        `${route.app?'apps/'+route.app+' ':''}route ${route.route} is served but no ui-screen's surfaces[].route claims it`);
    }
  }
  return {feRoutesAll,claims,claimedFe};
}

function eventIndexes(records,beRoots){
  const eventRecs=[...records].filter(([,record])=>record.schema==='work/event@1');
  const codeByRepo=beRoots.map(repo=>({repo,...eventSurface(repo)}));
  const allClasses=new Map();
  const allEmitted=new Map();
  const allEmittedIds=new Set();
  for(const {repo,classes,emitted,emittedIds} of codeByRepo){
    for(const [name,value] of classes)allClasses.set(name,{...value,repo});
    for(const [name,file] of emitted)allEmitted.set(name,{file,repo});
    for(const id of emittedIds)allEmittedIds.add(id);
  }
  const recordOfClass=new Map();
  for(const [id] of eventRecs){
    for(const [className,value] of allClasses){
      if(value.kind===id||eventClassNamesOf(id).includes(className))recordOfClass.set(className,id);
    }
  }
  const emittedRecordIds=new Set([...allEmittedIds].filter(id=>records.has(id)));
  for(const [className] of allEmitted){
    if(recordOfClass.has(className))emittedRecordIds.add(recordOfClass.get(className));
  }
  return {eventRecs,codeByRepo,allClasses,allEmitted,recordOfClass,emittedRecordIds};
}

function reportUnemittedEvents(eventRecs,emittedRecordIds,recordOfClass,indexFile,refuse,suspect,info){
  for(const [id,record] of eventRecs){
    if(emittedRecordIds.has(id))continue;
    const names=eventClassNamesOf(id).join('/');
    const blocked=Array.isArray(record.data?.blockedBy)&&record.data.blockedBy.length;
    const msg=`${id} maps to event class ${names}, but nothing under src/ publishes it `+
      '- the record describes an event nothing emits';
    if(record.data?.state==='done')refuse(indexFile(record),'EVENT_UNEMITTED',msg);
    else if(blocked){
      const gaps=record.data.blockedBy.map(item=>item?.record).filter(Boolean).join(', ');
      info(indexFile(record),'EVENT_UNEMITTED',`${msg}; the record itself says so (todo, blockedBy ${gaps})`);
    }else suspect(indexFile(record),'EVENT_UNEMITTED',`${msg} (record is ${record.data?.state??'(no state)'})`);
  }
}

function reportUnrecordedEvents(allEmitted,allClasses,recordOfClass,suspect){
  for(const [className,site] of allEmitted){
    if(recordOfClass.has(className))continue;
    suspect(site.file,'EVENT_UNDECLARED',
      `${className} is constructed under src/ but no work/event@1 record maps to it `+
      '- an emitted signal the tree does not name');
  }
  for(const [className,value] of allClasses){
    if(allEmitted.has(className)||recordOfClass.has(className))continue;
    suspect(value.file,'EVENT_CLASS_ORPHAN',
      `${className} is declared under src/ but is neither published nor claimed by a work/event@1 record - dead vocabulary`);
  }
}

function reportContractEvents(declaredContractEvents,records,canon,suspect){
  for(const event of declaredContractEvents){
    if(!records.has(canon(event.id))){
      suspect(event.file,'CONTRACT_EVENT_GHOST',`${event.by}'s surface names ${event.id}, which no work/event@1 record owns`);
    }
  }
}

// ---------- the check ----------

export function checkWorkSurfaces(workRoot, out) {
  const records = loadRecords(workRoot, walk);
  const workspaceDoc = readWorkspace(workRoot);
  const rel = f => path.relative(root, f).replaceAll('\\', '/');
  const refuse = (file, code, msg) => out.refuse.push(`${rel(file)}: ${msg} [${code}]`);
  const suspect = (file, code, msg) => out.suspect.push(`${rel(file)}: ${msg} [${code}]`);
  const info = (file, code, msg) => out.info.push(`${rel(file)}: ${msg} [${code}]`);
  const indexFile = rec => path.join(rec.dir, 'index.yaml');
  const featureOf = rec => path.relative(workRoot, rec.dir).replaceAll('\\', '/').split('/')[1];
  // Compact format: `P#frag` and collapsed bare `ac.*` ids resolve to the record carrying the criterion,
  // so proves/subscribes/contract-event refs compare canonical ids on both sides.
  const inline = indexInlineCriteria(records);
  const canon = ref => resolveRecordRef(records, ref, inline) ?? ref;

  // The sides workspace.yaml declares (be, fe), each its folder under the app root: the be side serves the routes, ops and
  // events, the fe side the pages.
  const sideRoot = side => {
    const root = repoRootFor(workRoot, side, workspaceDoc);
    return root && fs.existsSync(root) ? root : null;
  };
  const repoRoots = APP_SIDES.map(sideRoot).filter(Boolean);
  const beRoots = [sideRoot('be')].filter(r => r && fs.existsSync(path.join(r, 'src')));
  const feRoots = [sideRoot('fe')].filter(Boolean);

  // owned dirs once, for "the tree explains this file" tests
  const {provedIds,ownerOf,implNamed}=ownershipClaims(records,workspaceDoc,workRoot,canon,featureOf);

  // ---------- HTTP ----------
  const servedRoutes = beRoots.flatMap(r => httpRoutes(r).map(x => ({...x, repo: r})));
  const servedKeys = new Map(servedRoutes.map(r => [servedKey(r), r]));

  const {declaredHttp,declaredGql,contractClaimedOps,declaredContractEvents,integrationEndpoints}=
    contractDeclarations(records,indexFile);

  const claimedRouteKeys=matchDeclaredRoutes([...declaredHttp,...integrationEndpoints],declaredHttp,
    servedRoutes,servedKeys,provedIds,suspect,refuse,info);
  reportUndeclaredRoutes(servedRoutes,claimedRouteKeys,ownerOf,suspect,info);

  // ---------- GraphQL ----------
  const ops = beRoots.flatMap(r => gqlOps(r).map(o => ({...o, repo: r})));
  const {opNames,unclaimed}=claimGraphOps(ops,records,ownerOf,implNamed,contractClaimedOps);
  reportUnclaimedGraphOps(unclaimed,workRoot,suspect);
  reportDeclaredGraphOps(declaredGql,opNames,provedIds,suspect,refuse);

  // ---------- FE routes ----------
  const {feRoutesAll,claims,claimedFe}=checkFeRoutes(workRoot,feRoots,records,suspect,refuse);

  // ---------- events ----------
  const {eventRecs,codeByRepo,allClasses,allEmitted,recordOfClass,emittedRecordIds}=
    eventIndexes(records,beRoots);
  reportUnemittedEvents(eventRecs,emittedRecordIds,recordOfClass,indexFile,refuse,suspect,info);
  reportUnrecordedEvents(allEmitted,allClasses,recordOfClass,suspect);
  reportContractEvents(declaredContractEvents,records,canon,suspect);

  // subscriptions, paired feature-wise: each subscriber file answers to the union of `subscribes`
  // declared by the feature that owns the file's directory
  const subscribesByFeature=declaredSubscriptions(records,featureOf,canon);
  // subscription handling is aggregated per feature before diffing - two subscriber files in one
  // feature would otherwise each report the other's declared events as never wired
  const wiredByFeature=wiredSubscriptions(codeByRepo,ownerOf,recordOfClass,suspect);
  reportWiredSubscriptionDiff(wiredByFeature,subscribesByFeature,records,canon,suspect);
  // a feature declaring subscribes with no subscriber file at all is the same absence, feature-wide
  reportFeaturesWithoutSubscribers(records,wiredByFeature,featureOf,canon,indexFile,suspect);

  // ---------- SURFACE MAP ----------
  appendSurfaceMap(out,repoRoots,servedRoutes,ops,feRoutesAll,claimedRouteKeys,claimedFe,codeByRepo,eventRecs,
    emittedRecordIds,subscribesByFeature,records,declaredHttp,integrationEndpoints,declaredGql,claims,ownerOf,servedKey);
  return {records: records.size, routes: servedRoutes.length, ops: ops.length,
    feRoutes: feRoutesAll.length, events: eventRecs.length};
}

// ---------- main ----------
if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const treeArg = args.includes('--tree') ? args[args.indexOf('--tree') + 1] : null;
  const trees = treeArg ? [path.resolve(treeArg)]
    : walk(path.join(root, 'examples')).filter(f => f.endsWith(`.starciwork${path.sep}index.yaml`)).map(dir => path.dirname(dir));

  const out = {refuse: [], suspect: [], info: [], map: []};
  for (const workRoot of trees) checkWorkSurfaces(workRoot, out);
  console.log('SURFACE MAP');
  for (const l of out.map) console.log(`  ${l}`);
  console.log('');
  for (const l of out.refuse) console.log(`REFUSE  ${l}`);
  for (const l of out.suspect) console.log(`SUSPECT ${l}`);
  for (const l of out.info) console.log(`INFO    ${l}`);
  console.log(`\n${out.refuse.length} refused, ${out.suspect.length} suspect, ${out.info.length} info`);
  process.exitCode = out.refuse.length ? 1 : 0;
}
