// op-shared.mjs — shared op-manifest fragments live once in modules/ops/_common.yaml under `shared:`;
// a per-op manifest (modules/ops/ops/<op>.yaml) marks a member `shared` where it wants the shared value.
// Merging is deterministic and position-preserving: arrays keep the entry's slot, maps keep key order.
//
// Marker contract (the same for every site):
//   reads/writes entry  - `path: shared` (and `purpose.en`/`content.en` set `shared`) expands the whole
//                         `shared.reads|writes` entry named by `id`; local non-marker keys override.
//   placeholders.<key>  - `key: shared` -> shared.placeholders[key]
//   graphPolicy.location - `shared` -> shared.graphPolicy.location
// Raw files stay schema-valid; consumers that need real text merge first.

import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';

const cache = new Map();
const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

/** The `shared:` fragment table of modules/ops/_common.yaml. `opsDir` may be the ops root
 *  (modules/ops), the per-op directory (modules/ops/ops) or any path inside them; the nearest
 *  `_common.yaml` at or above it wins. Missing file -> empty table. Result cached by directory. */
export function opSharedOf(dir) {
  const key = path.resolve(dir);
  if (cache.has(key)) return cache.get(key);
  let found = null;
  let d = /\.(yaml|yml)$/i.test(key) ? path.dirname(key) : key;
  for (let i = 0; i < 3 && !found; i += 1) {
    const candidate = path.join(d, '_common.yaml');
    if (fs.existsSync(candidate)) found = candidate;
    else d = path.dirname(d);
  }
  let shared = {};
  if (found) {
    const doc = parseYaml(fs.readFileSync(found, 'utf8'));
    if (isObj(doc?.shared)) shared = doc.shared;
  }
  cache.set(key, shared);
  return shared;
}

function mergeEntry(entry, def, where) {
  if (!isObj(def)) throw new Error(`op manifest ${where}: shared fragment missing for ${JSON.stringify(entry?.id)}`);
  const out = { ...def };
  for (const [k, v] of Object.entries(entry)) {
    if (v === 'shared') continue;                 // filled by def
    if (isObj(v) && isObj(def[k])) {              // prose maps merge member-wise: `en: shared` keeps def.en,
      const inner = { ...def[k] };                // a local `vi:` text always wins.
      for (const [kk, vv] of Object.entries(v)) if (vv !== 'shared') inner[kk] = vv;
      out[k] = inner;
    } else {
      out[k] = v;
    }
  }
  return out;
}

const byId = (list) => {
  const map = new Map();
  for (const e of Array.isArray(list) ? list : []) if (isObj(e) && e.id != null) map.set(String(e.id), e);
  return map;
};

/** The effective manifest: `shared` markers in `doc` replaced by the matching `_common.yaml`
 *  `shared:` entries. Unknown markers throw — a stub that names no shared fragment is a defect,
 *  not a silent null. `doc` is not mutated. */
export function mergeOpShared(doc, shared = {}) {
  if (!isObj(doc)) return doc;
  const where = doc.id ?? '?';
  const out = { ...doc };
  if (isObj(doc.placeholders) && isObj(shared.placeholders)) {
    const ph = { ...doc.placeholders };
    for (const [k, v] of Object.entries(ph)) {
      if (v === 'shared') {
        if (!(k in shared.placeholders)) throw new Error(`op manifest ${where}: placeholders.${k} marks shared but _common.yaml shared.placeholders has no ${k}`);
        ph[k] = shared.placeholders[k];
      }
    }
    out.placeholders = ph;
  }
  if (isObj(doc.graphPolicy) && doc.graphPolicy.location === 'shared') {
    if (shared.graphPolicy?.location === undefined) throw new Error(`op manifest ${where}: graphPolicy.location marks shared but _common.yaml shared.graphPolicy has no location`);
    out.graphPolicy = { ...doc.graphPolicy, location: shared.graphPolicy.location };
  }
  for (const section of ['reads', 'writes']) {
    if (!Array.isArray(doc[section])) continue;
    const table = byId(shared[section]);
    // An entry merges when it carries any `shared` marker — `path: shared` is the
    // common case; `purpose.en`/`content.en: shared` alone keeps a literal path,
    // which is how a path that names a declared <token> stays visible in the file.
    out[section] = doc[section].map((e) => (isObj(e)
      && (e.path === 'shared' || e.purpose?.en === 'shared' || e.content?.en === 'shared')
      ? mergeEntry(e, table.get(e.id), `${where}.${section}`)
      : e));
  }
  return out;
}

/** Parse an op manifest file and return the effective (shared-merged) document. */
export function readOpManifest(file) {
  return mergeOpShared(parseYaml(fs.readFileSync(file, 'utf8')), opSharedOf(file));
}
