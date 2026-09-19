#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseYaml} from '../../core/yaml.mjs';
import {walk} from './check-example-work.mjs';
import {readWorkspace, resolveOwnedDirs, repoRootFor, loadRecords, indexInlineCriteria, resolveRecordRef} from '../example-ownership.mjs';

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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.starciwork']);
const TEST_FILE_RE = /\.(spec|test|e2e-spec)\.[tj]sx?$/;
const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'ALL']);
const EVENT_ID_RE = /^event\.[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/** Probe doors a host serves for its own sake - real, but no contract could ever own /health. */
const OPS_ROUTE_RE = /^\/(health|healthz|ready|readyz|live|livez|metrics|favicon\.ico|\.well-known)(\/|$)/;

// ---------- concept 1: source files, per bound repository ----------

/** Every src/ root a repository can have: the plain one plus one per app in an npm-workspaces
 * monorepo (ecommerce-app-be's apps/{identity,order}, ecommerce-app-fe's apps/{landing,shop}). */
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

/** GraphQL operations: graphql/{queries,mutations}/<cap>/<op>/ directories nested per-feature
 * (src/features/<f>/graphql/...), plus @Query/@Mutation decorated methods. The decorator regex must
 * survive the `() => ResponseType` argument the codebase uses, so the arguments are consumed by
 * balanced-paren scanning, not by a `[^)]*` that dies on the first inner `)`. */
export function gqlOps(repoRoot) {
  const ops = [];
  const decorated = [];
  for (const srcRoot of srcRootsOf(repoRoot)) {
    const findOpDirs = dir => {
      for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue;
        const abs = path.join(dir, entry.name);
        if ((entry.name === 'queries' || entry.name === 'mutations') && path.basename(dir) === 'graphql') {
          // queries -> query, mutations -> mutation (never slice(0,-1): 'queries' trims to 'querie')
          const kind = entry.name === 'queries' ? 'query' : 'mutation';
          const caps = fs.readdirSync(abs).filter(d => fs.statSync(path.join(abs, d)).isDirectory());
          for (const cap of caps) {
            const dirs = fs.readdirSync(path.join(abs, cap))
              .filter(d => fs.statSync(path.join(abs, cap, d)).isDirectory());
            for (const op of dirs) ops.push({kind, cap, dir: op, name: camelOf(op), file: path.join(abs, cap, op)});
          }
        } else {
          findOpDirs(abs);
        }
      }
    };
    findOpDirs(srcRoot);
    for (const file of prodFiles(srcRoot)) {
      const text = fs.readFileSync(file, 'utf8');
      for (const m of text.matchAll(/@(Query|Mutation)\s*\(/g)) {
        const args = readCallArgs(text, m.index + m[0].length - 1);
        const after = text.slice(m.index + m[0].length - 1 + args.length);
        const name = /name:\s*['"](\w+)['"]/.exec(args)?.[1]
          ?? /^\s*(?:async\s+)?(\w+)\s*\(/.exec(after)?.[1];
        if (name) decorated.push({kind: m[1].toLowerCase(), cap: null, dir: null, name, file});
      }
    }
  }
  // a decorated method and an op dir are the same operation when the resolver file sits inside the
  // dir (the wire `name:` wins over the dir's camel - `tasks` is the truth, `list-tasks` the folder),
  // or when kind+name already agree
  for (const d of decorated) {
    const host = ops.find(o => o.kind === d.kind && (d.file.startsWith(o.file + path.sep) || o.name === d.name));
    if (host) { host.name = d.name; host.resolver = d.file; }
    else ops.push(d);
  }
  return ops;
}

/** The argument list starting at the `(` at `openIndex`, balanced - quotes skipped so a paren inside
 * a string literal cannot fake the close. */
function readCallArgs(text, openIndex) {
  let depth = 0, quote = null;
  for (let i = openIndex; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === quote && text[i - 1] !== '\\') quote = null; continue; }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '(') depth++;
    if (c === ')' && --depth === 0) return text.slice(openIndex, i + 1);
  }
  return text.slice(openIndex);
}

const camelOf = kebab => kebab.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

/** FE routes: every directory holding a page.tsx under each app's src/app. `[lang]` (the locale
 * wrapper) is dropped; other `[param]` segments become positional `:_` so they compare equal to a
 * claim's `:param` spelling. Returns {app, route, norm, file}. */
function feRoutes(repoRoot) {
  const routes = [];
  for (const srcRoot of srcRootsOf(repoRoot)) {
    const appDir = path.join(srcRoot, 'app');
    if (!fs.existsSync(appDir)) continue;
    const app = appOf(srcRoot, repoRoot);
    for (const file of srcFiles(appDir, 'page.tsx')) {
      const segments = path.relative(appDir, path.dirname(file)).replaceAll('\\', '/').split('/')
        .filter(s => s && s !== '[lang]');
      const display = '/' + segments.join('/');
      const norm = '/' + segments.map(s => /^\[.*\]$/.test(s) ? ':_' : s).join('/');
      routes.push({app, route: display || '/', norm: norm === '/' ? '/' : norm.replace(/\/$/, ''), file});
    }
  }
  return routes;
}

/** The event vocabulary the code knows: `class XxxEvent` declarations paired with the `kind =
 * "event.<id>"` discriminant they carry, `new XxxEvent(` construction sites in production files
 * (emission), and `instanceof`/@EventsHandler subscriptions per file. */
function eventSurface(repoRoot) {
  const classes = new Map();   // className -> {file, kind}
  const emitted = new Map();   // className -> file (production construction site)
  const emittedIds = new Set();// record ids emitted by literal ("event.x.y" inside a publish/emit file)
  const subscriptions = [];    // {file, classes: [className]}
  for (const srcRoot of srcRootsOf(repoRoot)) {
    for (const file of prodFiles(srcRoot)) {
      const text = fs.readFileSync(file, 'utf8');
      const kinds = [...text.matchAll(/['"](event\.[a-z0-9-]+(?:\.[a-z0-9-]+)+)['"]/g)]
        .map(m => ({id: m[1], at: m.index}));
      const classDecls = [...text.matchAll(/class\s+(\w+Event)\b/g)];
      for (const [i, m] of classDecls.entries()) {
        // a class's kind discriminant sits in its own body - never borrow the next class's literal
        const nextClassAt = classDecls[i + 1]?.index ?? text.length;
        const kind = kinds.find(k => k.at > m.index && k.at < nextClassAt)?.id ?? null;
        if (!classes.has(m[1])) classes.set(m[1], {file, kind});
      }
      for (const m of text.matchAll(/new\s+(\w+Event)\b/g)) if (!emitted.has(m[1])) emitted.set(m[1], file);
      if (/\.(publish|emit|dispatch)\s*\(/.test(text)) for (const k of kinds) emittedIds.add(k.id);
      const handled = [...text.matchAll(/instanceof\s+(\w+Event)\b/g)].map(m => m[1])
        .concat([...text.matchAll(/@EventsHandler\(\s*(\w+)/g)].map(m => m[1]));
      if (handled.length || /^\s*@EventsHandler/m.test(text) || /\.subscribe\s*\(/.test(text)) {
        if (handled.length) subscriptions.push({file, classes: [...new Set(handled)]});
      }
    }
  }
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
  const entries = Array.isArray(surf) ? surf : surf && typeof surf === 'object' ? [surf] : [];
  const out = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') { out.push({name: null, text: String(entry ?? '')}); continue; }
    const httpItems = Array.isArray(entry.http) ? entry.http : entry.http ? [entry.http] : [];
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
function declaredGqlOf(data, strict) {
  const out = [];
  const res = strict ? GQL_STRICT_RES : [...GQL_STRICT_RES, ...GQL_LOOSE_RES];
  for (const entry of surfaceEntriesOf(data)) {
    const text = `${entry.name ?? ''}\n${entry.text ?? ''}`;
    for (const re of res) {
      for (const m of text.matchAll(re)) {
        const [a, b] = [m[1], m[2]];
        const name = /^(query|mutation)$/i.test(a) ? b : a;
        if (name && !/^(query|mutation)$/i.test(name) && !GQL_STOPWORDS.has(name.toLowerCase())) out.push(name);
      }
    }
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
    if (rec.schema !== 'work/ui-screen') continue;
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
  .map(s => (/^[:[]/.test(s) ? ':_' : s))
  .join('/')).replace(/\/+$/, '') || '/';

const normMethod = m => String(m).toUpperCase();
const servedKey = r => `${normMethod(r.method)} ${normRoute(r.path)}`;
const declaredKey = d => `${normMethod(d.method)} ${normRoute(d.path)}`;

/** The work/event id an event class maps to: its `kind` discriminant when it carries one (the
 * honest binding), else the id-shaped guess - `TaskDeletedEvent` keeps the feature segment,
 * `SignedInEvent` drops it, so both mappings are tried before anything is suspected. */
const eventClassNamesOf = id => {
  const pascal = s => s.split(/[-.]/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join('');
  const segments = id.replace(/^event\./, '').split('.');
  return [pascal(segments.join('-')) + 'Event', pascal(segments.slice(1).join('-')) + 'Event'];
};

// ---------- the check ----------

export function checkWorkSurfaces(workRoot, out) {
  const records = loadRecords(workRoot, walk);
  const workspaceDoc = readWorkspace(workRoot);
  const backendRoot = path.dirname(workRoot);
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

  const repos = Array.isArray(workspaceDoc?.repositories) ? workspaceDoc.repositories : [];
  const repoRoots = [...new Map([backendRoot, ...repos.map(r => repoRootFor(workRoot, r?.name, workspaceDoc))]
    .map(r => [r, r])).values()];
  const beRoots = repoRoots.filter(r => fs.existsSync(path.join(r, 'src')));
  const feRoots = [...new Set(repos.filter(r => r?.role === 'fe')
    .map(r => repoRootFor(workRoot, r.name, workspaceDoc)))].filter(r => fs.existsSync(r));

  // owned dirs once, for "the tree explains this file" tests
  const ownedDirs = [];
  const provedIds = new Set(); // record ids some impl's `proves` claims to implement
  for (const [id, rec] of records) {
    if (rec.schema === 'work/implementation') {
      for (const t of rec.data?.proves ?? []) if (typeof t === 'string') provedIds.add(canon(t));
    }
    for (const d of resolveOwnedDirs(id, rec, records, workspaceDoc, workRoot)) {
      if (fs.existsSync(d.abs)) ownedDirs.push({id, abs: d.abs, feature: featureOf(rec)});
    }
  }
  const ownerOf = file => ownedDirs.filter(d => file.startsWith(d.abs))
    .sort((a, b) => b.abs.length - a.abs.length)[0] ?? null;
  const implIds = new Set([...records].filter(([, r]) => r.schema === 'work/implementation').map(([id]) => id));
  const implNamed = name => [...implIds].find(id => id.split('.').pop() === name) ?? null;

  // ---------- HTTP ----------
  const servedRoutes = beRoots.flatMap(r => httpRoutes(r).map(x => ({...x, repo: r})));
  const servedKeys = new Map(servedRoutes.map(r => [servedKey(r), r]));

  const declaredHttp = [];   // {method, path, id, state, file}
  const declaredGql = [];    // strict-pattern names only - ghost-eligible {name, id, state, file}
  const contractClaimedOps = new Set(); // strict + loose names - claims a served op can hold
  const declaredContractEvents = []; // {id: event record id, by: contract id}
  const integrationEndpoints = [];   // {method, path, id, state, file}
  for (const [id, rec] of records) {
    const file = indexFile(rec);
    if (rec.schema === 'work/contract') {
      for (const d of declaredHttpOf(rec.data)) declaredHttp.push({...d, id, state: rec.data?.state, file});
      for (const name of declaredGqlOf(rec.data, true)) {
        declaredGql.push({name, id, state: rec.data?.state, file});
      }
      for (const name of declaredGqlOf(rec.data, false)) contractClaimedOps.add(name);
      for (const eid of declaredEventIdsOf(rec.data)) declaredContractEvents.push({id: eid, by: id, file});
    }
    if (rec.schema === 'work/integration') {
      for (const e of Array.isArray(rec.data?.endpoints) ? rec.data.endpoints : []) {
        const method = String(e?.method ?? '').toUpperCase();
        if (HTTP_METHODS.has(method) && typeof e?.path === 'string' && e.path.startsWith('/')) {
          integrationEndpoints.push({method, path: e.path, id, state: rec.data?.state, file});
        }
      }
    }
  }

  const claimedRouteKeys = new Set();
  for (const d of [...declaredHttp, ...integrationEndpoints]) {
    const key = declaredKey(d);
    const served = servedKeys.get(key)
      ?? servedRoutes.find(r => r.method === 'ALL' && normRoute(r.path) === normRoute(d.path));
    if (served) {
      claimedRouteKeys.add(servedKey(served));
      if (declaredHttp.includes(d) && !provedIds.has(d.id)) {
        suspect(d.file, 'CONTRACT_ROUTE_UNPROVEN',
          `${d.id}'s declared route ${d.method} ${d.path} is served by ${path.basename(served.file)} but no ` +
          `impl record's proves names ${d.id} - the wire exists in contract and code, yet no implementation claims it`);
      }
    } else if (declaredHttp.includes(d)) {
      // a contract's declared wire with no serving route is the /buyers-vs-/internal/buyers class -
      // deterministically wrong once the contract is done; a todo contract may describe a wire not
      // yet built, so it is suspected, not refused
      const msg = `${d.id} declares "${d.method} ${d.path}" but no controller in any bound repository ` +
        'serves it - a done contract describing a wire that does not exist';
      if (d.state === 'done') refuse(d.file, 'CONTRACT_GHOST_ROUTE', msg);
      else suspect(d.file, 'CONTRACT_GHOST_ROUTE',
        `${msg} (record is ${d.state ?? '(no state)'}, not done - the door may still be unbuilt)`);
    } else {
      // an integration endpoint is the provider's wire, not ours: unserved usually means outbound
      // (SePay's /userapi/..., Keycloak's /realms/...), which no controller could ever serve - INFO,
      // with the one question a reader has to answer themselves
      info(d.file, 'INTEGRATION_ENDPOINT_REMOTE',
        `${d.id} endpoint "${d.method} ${d.path}" is not served by any bound repository - expected for the ` +
        "provider's own API; check this entry if the endpoint was meant as an inbound door (webhook/callback)");
    }
  }
  for (const r of servedRoutes) {
    if (claimedRouteKeys.has(servedKey(r))) continue;
    if (OPS_ROUTE_RE.test(normRoute(r.path))) {
      info(r.file, 'OPS_ROUTE', `${r.method} ${r.path} is an ops/probe door - real, but no contract could ever own it`);
      continue;
    }
    const owner = ownerOf(r.file);
    const msg = `${r.method} ${r.path} served by ${path.basename(r.file)} ` +
      (owner ? `is owned by ${owner.id} but declared by no contract or integration endpoint ` +
               '- a wire between features with no record of its shape'
             : "sits under no record's owners and is declared nowhere - a shipped surface the tree cannot explain");
    suspect(r.file, 'UNDECLARED_ROUTE', msg);
  }

  // ---------- GraphQL ----------
  const ops = beRoots.flatMap(r => gqlOps(r).map(o => ({...o, repo: r})));
  const opNames = new Set(ops.map(o => o.name));
  const sdsNamedOps = new Set();
  for (const [, rec] of records) {
    if (rec.schema === 'work/sds-component') for (const n of gqlNamesMentioned(rec.data)) sdsNamedOps.add(n);
  }
  const contractNamedOps = contractClaimedOps;

  const unclaimed = new Map(); // cap group -> [op names]
  for (const o of ops) {
    const owner = o.file ? ownerOf(o.file) : null;
    const namedImpl = o.dir ? implNamed(o.dir) : null;
    const names = [o.name, o.dir, o.dir && camelOf(o.dir)].filter(Boolean);
    const named = set => names.some(n => set.has(n));
    o.claim = owner?.id ?? namedImpl
      ?? (named(contractNamedOps) ? 'contract-surface' : named(sdsNamedOps) ? 'sds-flow' : null);
    if (!o.claim) {
      const group = o.cap ? `${o.kind === 'query' ? 'queries' : 'mutations'}/${o.cap}` : `decorated ${o.kind}`;
      if (!unclaimed.has(group)) unclaimed.set(group, []);
      unclaimed.get(group).push(o);
    }
  }
  for (const [group, groupOps] of unclaimed) {
    const names = groupOps.map(o => o.name).join(', ');
    suspect(groupOps[0].file ?? workRoot, 'UNDECLARED_OPERATION',
      `graphql ${group} serves ${groupOps.length} op(s) no record owns or names: ${names} ` +
      '- protocol adaptation is thin, but a shipped door should still be explained');
  }
  for (const d of declaredGql) {
    if (opNames.has(d.name) || opNames.has(camelOf(d.name))) {
      if (!provedIds.has(d.id)) {
        suspect(d.file, 'CONTRACT_OP_UNPROVEN',
          `${d.id}'s surface names GraphQL ${d.name}, which is served, but no impl record's proves names ` +
          `${d.id} - the op exists in contract and code, yet no implementation claims it`);
      }
      continue;
    }
    const msg = `${d.id}'s surface names GraphQL ${d.name} but no resolver serves an op of that name ` +
      '- the record describes a door that does not exist';
    if (d.state === 'done') refuse(d.file, 'CONTRACT_GHOST_OP', msg);
    else suspect(d.file, 'CONTRACT_GHOST_OP', `${msg} (record is ${d.state ?? '(no state)'}, not done)`);
  }

  // ---------- FE routes ----------
  const feRoutesAll = feRoots.flatMap(r => feRoutes(r).map(x => ({...x, repo: r})));
  const claims = uiRouteClaims(records);
  const portToApp = new Map();
  for (const r of feRoots) for (const [p, a] of portAppMap(workRoot, r)) portToApp.set(p, a);
  const claimedFe = new Set();
  for (const c of claims) {
    // a URL claim's port pins the app through metadata.json's ports projection; an unmapped port
    // degrades to a path match across every app rather than an automatic ghost
    const expectedApp = c.port ? portToApp.get(c.port) ?? null : null;
    const hit = feRoutesAll.filter(r => r.norm === c.norm && (!expectedApp || r.app === expectedApp));
    if (hit.length) { for (const r of hit) claimedFe.add(`${r.repo}#${r.app ?? ''}#${r.norm}`); continue; }
    const where = expectedApp ? ` on apps/${expectedApp}` : '';
    const msg = `${c.id} claims route ${c.raw} (as ${c.norm}${where}) but no page.tsx serves it in any ` +
      'bound fe repository - a screen the record says exists that no route reaches';
    if (c.state === 'done') refuse(c.file, 'UI_ROUTE_GHOST', msg);
    else suspect(c.file, 'UI_ROUTE_GHOST', `${msg} (record is ${c.state ?? '(no state)'}, not done)`);
  }
  for (const r of feRoutesAll) {
    if (!claimedFe.has(`${r.repo}#${r.app ?? ''}#${r.norm}`)) {
      suspect(r.file, 'UI_ROUTE_UNDECLARED',
        `${r.app ? `apps/${r.app} ` : ''}route ${r.route} is served but no ui-screen's surfaces[].route claims it`);
    }
  }

  // ---------- events ----------
  const eventRecs = [...records].filter(([, r]) => r.schema === 'work/event');
  const codeByRepo = beRoots.map(r => ({repo: r, ...eventSurface(r)}));
  const allClasses = new Map();   // className -> {file, kind, repo}
  const allEmitted = new Map();   // className -> {file, repo}
  const allEmittedIds = new Set();
  for (const {repo, classes, emitted, emittedIds} of codeByRepo) {
    for (const [n, v] of classes) allClasses.set(n, {...v, repo});
    for (const [n, f] of emitted) allEmitted.set(n, {file: f, repo});
    for (const id of emittedIds) allEmittedIds.add(id);
  }
  const recordOfClass = new Map(); // className -> event record id
  for (const [id] of eventRecs) {
    for (const [cls, v] of allClasses) {
      if (v.kind === id || eventClassNamesOf(id).includes(cls)) recordOfClass.set(cls, id);
    }
  }
  const emittedRecordIds = new Set([...allEmittedIds].filter(id => records.has(id)));
  for (const [cls] of allEmitted) if (recordOfClass.has(cls)) emittedRecordIds.add(recordOfClass.get(cls));

  for (const [id, rec] of eventRecs) {
    if (emittedRecordIds.has(id)) continue;
    const names = eventClassNamesOf(id).join('/');
    const blocked = Array.isArray(rec.data?.blockedBy) && rec.data.blockedBy.length;
    const msg = `${id} maps to event class ${names}, but nothing under src/ publishes it ` +
      '- the record describes an event nothing emits';
    if (rec.data?.state === 'done') refuse(indexFile(rec), 'EVENT_UNEMITTED', msg);
    else if (blocked) {
      const gaps = rec.data.blockedBy.map(b => b?.record).filter(Boolean).join(', ');
      info(indexFile(rec), 'EVENT_UNEMITTED', `${msg}; the record itself says so (todo, blockedBy ${gaps})`);
    } else suspect(indexFile(rec), 'EVENT_UNEMITTED', `${msg} (record is ${rec.data?.state ?? '(no state)'})`);
  }
  for (const [cls, site] of allEmitted) {
    if (recordOfClass.has(cls)) continue;
    suspect(site.file, 'EVENT_UNDECLARED',
      `${cls} is constructed under src/ but no work/event record maps to it ` +
      '- an emitted signal the tree does not name');
  }
  for (const [cls, v] of allClasses) {
    if (allEmitted.has(cls) || recordOfClass.has(cls)) continue;
    suspect(v.file, 'EVENT_CLASS_ORPHAN',
      `${cls} is declared under src/ but is neither published nor claimed by a work/event record - dead vocabulary`);
  }
  for (const e of declaredContractEvents) {
    if (!records.has(canon(e.id))) {
      suspect(e.file, 'CONTRACT_EVENT_GHOST', `${e.by}'s surface names ${e.id}, which no work/event record owns`);
    }
  }

  // subscriptions, paired feature-wise: each subscriber file answers to the union of `subscribes`
  // declared by the feature that owns the file's directory
  const subscribesByFeature = new Map();
  for (const [, rec] of records) {
    for (const eid of Array.isArray(rec.data?.subscribes) ? rec.data.subscribes : []) {
      const f = featureOf(rec);
      if (!subscribesByFeature.has(f)) subscribesByFeature.set(f, new Set());
      subscribesByFeature.get(f).add(canon(eid));
    }
  }
  // subscription handling is aggregated per feature before diffing - two subscriber files in one
  // feature would otherwise each report the other's declared events as never wired
  const wiredByFeature = new Map(); // feature -> {files: [file], ids: Set(eventId), classes: Set}
  for (const {subscriptions} of codeByRepo) {
    for (const sub of subscriptions) {
      const owner = ownerOf(sub.file);
      // modules/bussiness/<feature>/ is the todo backend's module layout - when no record owns the
      // subscriber file, its path segment still names the feature it answers to
      const bussiness = /bussiness\/([^/]+)/.exec(sub.file.replaceAll('\\', '/'))?.[1];
      const feature = owner?.feature ?? (bussiness && subscribesByFeature.has(bussiness) ? bussiness : null);
      for (const cls of sub.classes.filter(c => !recordOfClass.has(c))) {
        suspect(sub.file, 'SUBSCRIPTION_UNDECLARED',
          `${path.basename(sub.file)} handles ${cls}, which maps to no work/event record`);
      }
      if (!feature) continue;
      if (!wiredByFeature.has(feature)) wiredByFeature.set(feature, {files: [], ids: new Set()});
      const entry = wiredByFeature.get(feature);
      entry.files.push(sub.file);
      for (const cls of sub.classes) if (recordOfClass.has(cls)) entry.ids.add(recordOfClass.get(cls));
    }
  }
  for (const [feature, wired] of wiredByFeature) {
    const declared = subscribesByFeature.get(feature) ?? new Set();
    const subs = wired.files.map(f => path.basename(f)).join(', ');
    for (const eid of wired.ids) {
      if (!declared.has(eid)) {
        suspect(wired.files[0], 'SUBSCRIPTION_UNDECLARED',
          `${feature}'s subscribers (${subs}) handle ${eid}, but no ${feature} record's subscribes names it`);
      }
    }
    for (const eid of declared) {
      if (wired.ids.has(eid) || !records.has(canon(eid))) continue;
      suspect(wired.files[0], 'SUBSCRIPTION_NOT_WIRED',
        `${feature}'s records subscribe to ${eid}, but its subscribers (${subs}) never handle it ` +
        '- a declared subscription with no code behind it');
    }
  }
  // a feature declaring subscribes with no subscriber file at all is the same absence, feature-wide
  for (const [id, rec] of records) {
    const feature = featureOf(rec);
    if (wiredByFeature.has(feature)) continue;
    for (const eid of Array.isArray(rec.data?.subscribes) ? rec.data.subscribes : []) {
      if (!records.has(canon(eid))) continue;
      suspect(indexFile(rec), 'SUBSCRIPTION_NOT_WIRED',
        `${id} subscribes to ${eid}, but feature ${feature} has no subscriber under any bound ` +
        "repository's src/ - a declared subscription with no code behind it");
    }
  }

  // ---------- SURFACE MAP ----------
  for (const r of repoRoots) {
    const repoName = path.basename(r);
    const routes = servedRoutes.filter(x => x.repo === r);
    const repoOps = ops.filter(x => x.repo === r);
    const fe = feRoutesAll.filter(x => x.repo === r);
    const ev = codeByRepo.find(x => x.repo === r);
    const declared = routes.filter(x => claimedRouteKeys.has(servedKey(x))).length;
    const ownedOnly = routes.filter(x => !claimedRouteKeys.has(servedKey(x)) && ownerOf(x.file)).length;
    const lines = [`${repoName}: ${routes.length} http route(s) (${declared} declared, ${ownedOnly} owned-only)`];
    if (repoOps.length) lines.push(`${repoOps.length} graphql op(s), ${repoOps.filter(x => x.claim).length} claimed`);
    if (fe.length) {
      const uiClaimed = fe.filter(x => claimedFe.has(`${x.repo}#${x.app ?? ''}#${x.norm}`)).length;
      lines.push(`${fe.length} fe route(s), ${uiClaimed} ui-claimed`);
    }
    if (ev && (ev.classes.size || ev.emitted.size)) {
      lines.push(`${ev.classes.size} event class(es), ${ev.emitted.size} emitted, ` +
        `${ev.subscriptions.length} subscriber file(s)`);
    }
    out.map.push(lines.join('; '));
  }
  const doneRecs = eventRecs.filter(([, r]) => r.data?.state === 'done').length;
  if (eventRecs.length) {
    out.map.push(`${eventRecs.length} work/event record(s) (${doneRecs} done), ${emittedRecordIds.size} ` +
      `emitted, ${subscribesByFeature.size} feature(s) declaring subscribes`);
  }
  out.map.push(`${records.size} record(s) total; ${declaredHttp.length} contract http declaration(s), ` +
    `${integrationEndpoints.length} integration endpoint(s), ${declaredGql.length} contract graphql ` +
    `declaration(s), ${claims.length} ui route claim(s)`);
  return {records: records.size, routes: servedRoutes.length, ops: ops.length,
    feRoutes: feRoutesAll.length, events: eventRecs.length};
}

// ---------- main ----------
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const treeArg = args.includes('--tree') ? args[args.indexOf('--tree') + 1] : null;
  const trees = treeArg ? [path.resolve(treeArg)]
    : walk(path.join(root, 'examples')).filter(f => f.endsWith(`.starciwork${path.sep}index.yaml`)).map(path.dirname);

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
