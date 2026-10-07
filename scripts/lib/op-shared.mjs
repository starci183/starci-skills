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
import { validateAgainstSchema } from './json-schema.mjs';

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

/** The `shared:` fragment table of modules/ops/_common.yaml. `opsDir` may be the ops root
 *  (modules/ops), the per-op directory (modules/ops/ops) or any path inside them; the nearest
 *  `_common.yaml` at or above it wins. Missing file -> empty table. Read fresh for each admission/context snapshot. */
export function opSharedOf(dir) {
  const key = path.resolve(dir);
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
  for (const entry of Array.isArray(list) ? list : []) if (isObj(entry) && entry.id != null) {
    if (map.has(String(entry.id))) throw new Error(`duplicate shared fragment id ${entry.id}`);
    map.set(String(entry.id), entry);
  }
  return map;
};

function mergeSharedPlaceholders(doc, shared, out, where) {
  if (!isObj(doc.placeholders)) return;
  const ph = { ...doc.placeholders };
  for (const [key, value] of Object.entries(ph)) {
    if (value === 'shared') {
      if (!isObj(shared.placeholders) || !Object.hasOwn(shared.placeholders, key)) throw new Error(`op manifest ${where}: placeholders.${key} marks shared but _common.yaml shared.placeholders has no ${key}`);
      ph[key] = shared.placeholders[key];
    }
  }
  out.placeholders = ph;
}

function mergeSharedGraphPolicy(doc, shared, out, where) {
  if (!isObj(doc.graphPolicy) || doc.graphPolicy.location !== 'shared') return;
  if (shared.graphPolicy?.location === undefined) throw new Error(`op manifest ${where}: graphPolicy.location marks shared but _common.yaml shared.graphPolicy has no location`);
  out.graphPolicy = { ...doc.graphPolicy, location: shared.graphPolicy.location };
}

function mergeSharedSection(doc, shared, out, section, where) {
  if (!Array.isArray(doc[section])) return;
  const table = byId(shared[section]);
  // An entry merges when it carries any `shared` marker — `path: shared` is the
  // common case; `purpose.en`/`content.en: shared` alone keeps a literal path,
  // which is how a path that names a declared <token> stays visible in the file.
  out[section] = doc[section].map((entry) => (isObj(entry)
    && (entry.path === 'shared' || entry.purpose?.en === 'shared' || entry.content?.en === 'shared')
    ? mergeEntry(entry, table.get(entry.id), `${where}.${section}`)
    : entry));
}

function mergeExecutionModes(doc, shared, out) {
  if (!isObj(doc.policy?.executionModes)) return;
  out.policy = { ...doc.policy, executionModes: Object.fromEntries(Object.entries(doc.policy.executionModes)
    .map(([mode, entry]) => [mode, mergeOpShared(entry, shared)])) };
}

/** The effective manifest: `shared` markers in `doc` replaced by the matching `_common.yaml`
 *  `shared:` entries. Unknown markers throw — a stub that names no shared fragment is a defect,
 *  not a silent null. `doc` is not mutated. */
export function mergeOpShared(doc, shared = {}) {
  if (!isObj(doc)) return doc;
  const where = doc.id ?? '?';
  const out = { ...doc };
  mergeSharedPlaceholders(doc, shared, out, where);
  mergeSharedGraphPolicy(doc, shared, out, where);
  for (const section of ['reads', 'writes']) mergeSharedSection(doc, shared, out, section, where);
  mergeExecutionModes(doc, shared, out);
  return out;
}

/** Refuse an object param without a closed, explicitly typed property boundary.
 * The canonical op schema owns the supported nested valueSchema vocabulary. */
export function paramDefinitionError(name, def) {
  if (def?.type !== 'object') return null;
  const shape = def.valueSchema;
  return isObj(shape) && shape.type === 'object' && isObj(shape.properties)
    && Object.keys(shape.properties).length > 0 && shape.additionalProperties === false
    ? null : `${name} requires an object valueSchema with declared properties and additionalProperties: false`;
}

function objectParamValueError(name, def, value) {
  if (!isObj(value)) return `${name} must be an object`;
  try {
    const errors = validateAgainstSchema(value, def.valueSchema);
    return errors.length ? `${name}: ${errors.join('; ')}` : null;
  } catch { return `${name} has an invalid valueSchema`; }
}

const enumParamValueError = (name, def, value) => {
  const allowed = Array.isArray(def.enum) ? def.enum : [];
  return allowed.includes(value) ? null : `${name} must be one of ${allowed.join(', ')} (got ${JSON.stringify(value)})`;
};

function primitiveParamTypeError(name, type, value) {
  if (type === 'integer' && !Number.isInteger(value)) return `${name} must be an integer (got ${JSON.stringify(value)})`;
  if (type === 'number' && !(typeof value === 'number' && Number.isFinite(value))) return `${name} must be a number (got ${JSON.stringify(value)})`;
  if (type === 'string' && typeof value !== 'string') return `${name} must be a string (got ${JSON.stringify(value)})`;
  if (type === 'boolean' && typeof value !== 'boolean') return `${name} must be true or false (got ${JSON.stringify(value)})`;
  return null;
}

function numericParamBoundsError(name, def, value) {
  if (typeof value === 'number') {
    if (def.min !== undefined && value < def.min) return `${name} is ${value}, below its minimum ${def.min}`;
    if (def.max !== undefined && value > def.max) return `${name} is ${value}, above its maximum ${def.max}`;
  }
  return null;
}

/** Validate one declared param value, including the defaults used at admission. */
export function paramValueError(name, def, value) {
  const type = def?.type, definitionError = paramDefinitionError(name, def);
  if (definitionError) return definitionError;
  if (type === 'object') return objectParamValueError(name, def, value);
  if (type === 'enum') return enumParamValueError(name, def, value);
  const typeError = primitiveParamTypeError(name, type, value);
  return typeError ?? numericParamBoundsError(name, def, value);
}

const mergeByKey = (common, selected, key) => {
  const result = [...(Array.isArray(common) ? common : [])];
  for (const entry of Array.isArray(selected) ? selected : []) {
    const at = result.findIndex((row) => row?.[key] === entry?.[key]);
    if (at < 0) result.push(entry); else result[at] = entry;
  }
  return result;
};

/** Select one executable mode without inheriting sibling permissions. Planning may
 * retain the selector envelope; execution requires a concrete declared mode. Common
 * reads, writes and proof/blocker obligations remain, with selected IDs taking precedence. */
export function resolveOpContract(brief, { params = {}, mode = params.mode ?? brief?.params?.mode?.default, allowSelect = false } = {}) {
  const modes = brief?.policy?.executionModes;
  if (!isObj(modes)) return { ok: true, mode: mode ?? null, contract: brief };
  if (mode === 'select' && allowSelect) return { ok: true, mode, contract: brief, planning: true };
  if (typeof mode !== 'string' || !Object.hasOwn(modes, mode) || !isObj(modes[mode])) {
    return { ok: false, reason: 'params-invalid', detail: `${brief?.id ?? 'op'} requires one concrete params.mode from [${Object.keys(modes).join(', ')}]; select is planning only` };
  }
  const selected = modes[mode];
  if (brief.id !== undefined && selected.id !== undefined && selected.id !== brief.id) return { ok: false, reason: 'params-invalid', detail: `mode ${mode} declares foreign op ${selected.id}` };
  const contract = { ...brief, ...selected };
  contract.policy = { ...brief.policy, ...selected.policy };
  delete contract.policy.executionModes;
  // Historical modes kept their specific policy at the mode root. The effective
  // manifest carries those policies in the same policy map as every other op.
  for (const key of Object.keys(selected).filter((key) => /(?:Policy|Authority)$/.test(key) && key !== 'graphPolicy' && key !== 'layoutPolicy')) {
    contract.policy[key] = selected[key]; delete contract[key];
  }
  for (const section of ['reads', 'writes', 'proofs']) contract[section] = mergeByKey(brief[section], selected[section], 'id');
  contract.blockers = mergeByKey(brief.blockers, selected.blockers, 'code');
  contract.placeholders = { ...brief.placeholders, ...selected.placeholders };
  for (const section of ['context', 'knowledge', 'docs']) {
    if (brief[section] !== undefined || selected[section] !== undefined) {
      const list = (value) => {
        if (value == null) return [];
        return Array.isArray(value) ? value : [value];
      };
      contract[section] = [...list(brief[section]), ...list(selected[section])];
    }
  }
  return { ok: true, mode, contract };
}

/** Bind a declared path placeholder only from a concrete single-segment param. */
export function bindOpPath(pattern, params = {}) {
  return pattern.replace(/<([A-Za-z0-9_-]+)>/g, (whole, name) => {
    const value = params[name];
    return typeof value === 'string' && /^[A-Za-z0-9_.-]+$/.test(value) ? value : whole;
  });
}

/** Selected declared READ text and explicit param references, before the input
 * owner classifies Source-law paths. Selection has one implementation. */
export function opReadTexts(brief, { params = {}, mode } = {}) {
  const selected = resolveOpContract(brief, { params, ...(mode == null ? {} : { mode }), allowSelect: true });
  if (!selected.ok) throw new Error(selected.detail);
  const reads = (entries) => {
    let values = [];
    if (Array.isArray(entries)) values = entries;
    else if (typeof entries === 'string') values = [entries];
    return values.map((entry) => entry?.path ?? entry);
  };
  const strings = (value) => {
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value.flatMap(strings);
    if (isObj(value)) return Object.values(value).flatMap(strings);
    return [];
  };
  return [...reads(selected.contract?.reads), ...reads(selected.contract?.context), ...reads(selected.contract?.knowledge), ...strings(params)];
}

/** Snapshot named checks and mechanical proof owners separately from route
 * candidates. A proof owner is not automatically an independently runnable CLI. */
export function opCheckRequirements(contract, kind = {}) {
  const required = [
    ...(contract?.layoutPolicy?.checks ?? []).map((value) => ({ path: value, source: 'layoutPolicy', obligation: /[\\/]/.test(value) ? 'check-owner' : 'check-id' })),
    ...(contract?.proofs ?? []).filter((proof) => typeof proof.check === 'string').map((proof) => ({ path: proof.check, source: 'proof', proof: proof.id, obligation: 'proof-owner' })),
  ];
  return { required, candidates: (kind.checks ?? []).map((value) => ({ path: value, source: 'kind' })) };
}

/** Parse an op manifest file and return the effective (shared-merged) document. */
export function readOpManifest(file) {
  return mergeOpShared(parseYaml(fs.readFileSync(file, 'utf8')), opSharedOf(file));
}
