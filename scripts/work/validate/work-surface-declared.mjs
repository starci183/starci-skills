// What the records declare, for check-work-surfaces.mjs: contract surfaces, graphql operation names, event ids,
// ui-screen route claims and the normalisation that lets served and declared routes compare (concepts 3 and 4).
import fs from 'node:fs';
import path from 'node:path';
import {HTTP_DECL_RE, GQL_STRICT_RES, GQL_LOOSE_RES, GQL_KIND_THEN_CAMEL, GQL_CAMEL_THEN_KIND} from './work-surface-patterns.mjs';
import {trimTrailing} from './trailing-text.mjs';

const EVENT_ID_RE = /^event\.[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/** Words that sit where an op name could, but are prose ("the GraphQL schema", "query planner") -
 * a candidate matching one is never a declared operation. */
const GQL_STOPWORDS = new Set(['schema', 'request', 'response', 'endpoint', 'door', 'layer', 'side', 'api',
  'gateway', 'field', 'type', 'resolver', 'operation', 'call', 'payload', 'document', 'string', 'body', 'header']);

// ---------- concept 4: normalization - :param segments compare positionally ----------

export const normRoute = p => trimTrailing('/' + String(p).split('/')
  .filter(Boolean)
  .map(s => (s.startsWith(':') || s.startsWith('[') ? ':_' : s))
  .join('/'), '/') || '/';

const normMethod = m => String(m).toUpperCase();
export const servedKey = r => `${normMethod(r.method)} ${normRoute(r.path)}`;
export const declaredKey = d => `${normMethod(d.method)} ${normRoute(d.path)}`;

/** The work/event@1 id an event class maps to: its `kind` discriminant when it carries one (the
 * honest binding), else the id-shaped guess - `TaskDeletedEvent` keeps the feature segment,
 * `SignedInEvent` drops it, so both mappings are tried before anything is suspected. */
export const eventClassNamesOf = id => {
  const pascal = s => s.split(/[-.]/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join('');
  const segments = id.replace(/^event\./, '').split('.');
  return [pascal(segments.join('-')) + 'Event', pascal(segments.slice(1).join('-')) + 'Event'];
};

// ---------- concept 3: declared surfaces (what the records claim) ----------

/** The `{method, path}` http items of one surface entry, with the entry's or the item's name. */
const httpItemsOf = entry => {
  const items = (Array.isArray(entry.http) && entry.http) || (entry.http && [entry.http]) || [];
  return items.filter(item => item?.method && item?.path)
    .map(item => ({name: entry.name ?? item.name ?? null, declared: {method: String(item.method).toUpperCase(), path: item.path}}));
};

const surfaceEntriesOf = data => {
  const surf = data?.surface;
  const entries = (Array.isArray(surf) && surf) || (surf && typeof surf === 'object' && [surf]) || [];
  const out = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') { out.push({name: null, text: String(entry ?? '')}); continue; }
    out.push(...httpItemsOf(entry));
    const requests = Array.isArray(entry.requests) ? entry.requests : [];
    const text = [entry.shape, entry.transport, entry.guarantee, entry.stability, ...requests.map(r => r?.shape ?? r)]
      .filter(v => typeof v === 'string').join('\n');
    out.push({name: entry.name ?? null, text});
  }
  return out;
};

/** Every `METHOD /path` a contract surface declares - from {method, path} http items and from
 * `GET /x` text inside shape/transport/guarantee/stability/requests prose. */
export function declaredHttpOf(data) {
  const out = [];
  for (const entry of surfaceEntriesOf(data)) {
    if (entry.declared) out.push(entry.declared);
    for (const m of (entry.text ?? '').matchAll(HTTP_DECL_RE)) {
      const path = trimTrailing(m[2], '.,:');
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

export function declaredGqlOf(data, strict) {
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
export function declaredEventIdsOf(data) {
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
export function gqlNamesMentioned(data) {
  const names = new Set();
  const collect = node => {
    if (typeof node === 'string') {
      for (const m of node.matchAll(GQL_KIND_THEN_CAMEL)) names.add(m[2]);
      for (const m of node.matchAll(GQL_CAMEL_THEN_KIND)) names.add(m[1]);
      return;
    }
    if (Array.isArray(node)) return node.forEach(collect);
    if (node && typeof node === 'object') Object.values(node).forEach(collect);
  };
  collect(data);
  return names;
}

/** The claim one `ui.surfaces[]` entry makes, or null when it names no route. */
function routeClaimOf(id, rec, s) {
  const raw = s?.route ?? s?.entry;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const url = /^https?:\/\/[^/]+(\/\S*)?$/.exec(raw.trim());
  const port = /^https?:\/\/[^:]+:(\d+)/.exec(raw.trim())?.[1] ?? null;
  const pathPart = (url ? (url[1] ?? '/') : raw.trim());
  return {id, state: rec.data?.state, file: path.join(rec.dir, 'index.yaml'), raw: raw.trim(),
    port, norm: normRoute(pathPart), name: s?.name ?? null};
}

/** ui-screen route claims: ui.surfaces[].route (or .entry), a bare `/path` or a full URL whose port
 * names the app through metadata.json's ports projection. */
export function uiRouteClaims(records) {
  const claims = [];
  for (const [id, rec] of records) {
    if (rec.schema !== 'work/ui-screen@1') continue;
    for (const s of rec.data?.ui?.surfaces ?? []) {
      const claim = routeClaimOf(id, rec, s);
      if (claim) claims.push(claim);
    }
  }
  return claims;
}

/** `<app>` for a port, via the ports projection in metadata.json beside the tree (or in the fe repo
 * itself) - `landing: 3069` means localhost:3069 is apps/landing's dev server. */
export function portAppMap(workRoot, feRoot) {
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
