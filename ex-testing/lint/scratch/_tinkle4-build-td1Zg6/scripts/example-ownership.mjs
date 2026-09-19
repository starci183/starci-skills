import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parseYaml} from '../core/yaml.mjs';

/**
 * Shared resolution of "what directories does this record's code live under" - the question concepts 1
 * (codeDigest), 3 (OWNER_PATH_MISSING/PROVES_TARGET_NOT_DONE) and 4 (SDS owners) all ask, so it is answered
 * once here rather than three times with three chances to disagree. Used by scripts/checks/check-example-work.mjs,
 * scripts/example-evidence.mjs and scripts/example-derive.mjs.
 *
 * Design note (owner, 2026-09-18): `work/implementation.owners[].path`, `work/sds-component.owners[].path`
 * and `work/business-rule.module` are directories - module roots - never individual files (see
 * schemas/work-layout.yaml's `impl` shape entry). Some example records authored before this note name a
 * `/**` glob or a literal file (`src/modules/domain/task/ownership.guard.ts`); `moduleRootOf` normalises
 * both down to the directory a reader would call the module's root (`src/modules/domain/task`), so a file
 * moving inside its module during a refactor is not, by itself, a broken reference, and resolution is
 * correct today without mass-editing every pre-existing path across features this lane does not own.
 */

export function moduleRootOf(rawPath) {
  let p = rawPath.replace(/\/\*\*?$/, '');
  const last = p.split('/').pop() ?? '';
  if (last.includes('.')) p = path.dirname(p);
  return p;
}

export function readWorkspace(workRoot) {
  const file = path.join(workRoot, 'workspace.yaml');
  if (!fs.existsSync(file)) return null;
  try { return parseYaml(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

/**
 * Whether a yaml file's `schema:` marker names a Work record at all. Every record schema this layout
 * declares lives under `work/`; a workspace.yaml may widen that set through its own
 * `recordSchemaPrefixes` list (none do today). A yaml carrying any other schema -
 * starci/generation-receipts@1, starci/direction-check@1, starci/uat-run-manifest@1 - is a tool's
 * artifact payload: real bytes with their own checks (check-work-artifacts.mjs reads them by filename),
 * but never a record, so no record rule - id-matches-path, ref collection, per-schema shape - applies.
 * A file whose schema is absent or not a string stays on the record path: a missing marker is a
 * malformed record, not proof the file is payload.
 */
export function isWorkRecordSchema(schema, workspaceDoc) {
  if (typeof schema !== 'string') return true;
  const declared = Array.isArray(workspaceDoc?.recordSchemaPrefixes) ? workspaceDoc.recordSchemaPrefixes : [];
  return ['work/', ...declared].some(prefix => schema.startsWith(prefix));
}

/**
 * The real directory `repositoryName` (a `work/implementation.repository` / logical workspace name) names,
 * resolved against `workspace.yaml`'s `repositories: [{role, name}]`. The backend role always resolves to
 * the repository that owns this `.starciwork` (its parent directory); any other role is a sibling
 * directory beside it, named for the workspace entry - the two-repository topology
 * schemas/work-layout.yaml documents (`examples/todo-app-backend` paired with `examples/todo-app-frontend`).
 * With no workspace.yaml, no repositories list, or no matching entry, the backend root is the only honest
 * guess (a single-repository product has no other repository to name anyway).
 */
export function repoRootFor(workRoot, repositoryName, workspaceDoc) {
  const backendRoot = path.dirname(workRoot);
  if (!repositoryName) return backendRoot;
  const repos = Array.isArray(workspaceDoc?.repositories) ? workspaceDoc.repositories : [];
  const entry = repos.find(r => r?.name === repositoryName);
  if (!entry || entry.role === 'be') return backendRoot;
  return path.join(path.dirname(backendRoot), repositoryName);
}

function ownedRelPaths(data) {
  const fromOwners = Array.isArray(data.owners) ? data.owners.map(o => o?.path).filter(Boolean) : [];
  const fromModule = typeof data.module === 'string' ? [data.module]
    : Array.isArray(data.module) ? data.module.filter(m => typeof m === 'string') : [];
  return [...fromOwners, ...fromModule].map(moduleRootOf);
}

/** Whether `data` declares any owners/module path directly (as opposed to needing prover fallback). */
export function declaresOwnPaths(data) {
  return ownedRelPaths(data).length > 0;
}

/**
 * Every `{rel, abs}` directory `record` (an entry from check-example-work.mjs's own `records` map, or the
 * lightweight equivalent `loadRecords` below builds) owns, resolved to an absolute path under the right
 * repository: directly from its own `owners`/`module`, or - only when it declares neither - from every
 * `work/implementation` whose `proves` names this record's id (the layout's resolution for a specification
 * that owns no code itself but is demonstrated by an implementation that does). Deduplicated by `abs`.
 * `recordsById` maps id -> {schema, data} (or richer; only those two fields are read).
 */
export function resolveOwnedDirs(id, record, recordsById, workspaceDoc, workRoot) {
  const out = new Map(); // abs -> {rel, abs, via}
  const add = (data, via) => {
    const repoRoot = repoRootFor(workRoot, data.repository, workspaceDoc);
    for (const rel of ownedRelPaths(data)) {
      const abs = path.join(repoRoot, rel);
      if (!out.has(abs)) out.set(abs, {rel, abs, via});
    }
  };
  add(record.data, 'self');
  if (!declaresOwnPaths(record.data)) {
    // Compact format: `proves` may name `P#frag` or a collapsed bare `ac.*` id - both resolve to the
    // record carrying the criterion, so canonicalize each entry before comparing.
    const inline = indexInlineCriteria(recordsById);
    for (const [otherId, other] of recordsById) {
      if (other.schema !== 'work/implementation') continue;
      const proves = Array.isArray(other.data.proves) ? other.data.proves : [];
      if (proves.some(p => resolveRecordRef(recordsById, p, inline) === id)) add(other.data, otherId);
    }
  }
  return [...out.values()];
}

export function missingOwnedDirs(dirs) {
  return dirs.filter(d => !fs.existsSync(d.abs));
}

const SKIP_DIRS = new Set(['node_modules', 'dist', '.next']);

function walkFiles(dir, base = dir) {
  let entries;
  try { entries = fs.readdirSync(dir, {withFileTypes: true}); } catch { return []; }
  const out = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(...walkFiles(path.join(dir, entry.name), base));
    } else if (entry.isFile()) {
      out.push(path.relative(base, path.join(dir, entry.name)).replaceAll('\\', '/'));
    }
  }
  return out;
}

/**
 * sha256-based digest over the sorted bytes of every file under `dirs` (each `{rel, abs}`, as
 * `resolveOwnedDirs` returns) - a test file changing is a proof change like any other, so nothing under a
 * module root is excluded except `node_modules`, `dist` and `.next`. Returns `null` (not an empty digest)
 * when no owned directory exists on disk at all - nothing to hash is a different fact than an empty hash
 * of nothing. Deterministic: same files, same bytes, same output, regardless of directory-walk order,
 * because the file list is sorted by its reported `path` before anything is hashed.
 */
export function hashOwnedDirs(dirs) {
  const files = new Map(); // path -> abs (a path collision across owner dirs keeps the last one seen)
  for (const {rel, abs} of dirs) {
    if (!fs.existsSync(abs)) continue;
    for (const fileRel of walkFiles(abs)) {
      files.set(`${rel}/${fileRel}`.replaceAll('\\', '/'), path.join(abs, fileRel));
    }
  }
  if (!files.size) return null;
  const sortedPaths = [...files.keys()].sort();
  const fileDigests = sortedPaths.map(p => ({path: p, sha256: crypto.createHash('sha256').update(fs.readFileSync(files.get(p))).digest('hex')}));
  const digest = crypto.createHash('sha256').update(fileDigests.map(f => `${f.path}:${f.sha256}`).join('\n')).digest('hex');
  return {algorithm: 'sha256', files: fileDigests, digest};
}

// ---- v11 compact format: inlined acceptance criteria ----
// A criterion that used to be its own `ac/<name>/index.yaml` record can be carried inline on the parent
// record's `acceptance:` (or `statements:`) list as an entry with `id: <former ac-id>`. A collapsed
// criterion must resolve like the record it used to be: its old `ac.*` id still answers, and the new
// canonical form `parent#ac-id` (or `parent#<short-name>`) answers through the parent. These three
// helpers are the single resolution every script shares, so the gate, the deep check, the consistency
// check and the derive/evidence tools cannot drift on what "the same criterion" means.

/** Fields a parent record may carry inlined criteria under, per the v11 collapse law. */
export const INLINE_CRITERION_FIELDS = ['acceptance', 'statements'];

/** The inline criterion entries one record's data carries: [{id, name, entry}]. `id` is the former
 * ac record's id when the entry declares one; `name` is the entry's short name (`entry.name`, else the
 * id's last segment). Plain-string list items are not criteria entries and are skipped. */
export function inlineCriteriaOf(data) {
  const out = [];
  for (const field of INLINE_CRITERION_FIELDS) {
    for (const entry of Array.isArray(data?.[field]) ? data[field] : []) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : null;
      const name = typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim()
        : id ? id.split('.').pop() : null;
      if (id || name) out.push({id, name, entry});
    }
  }
  return out;
}

/**
 * Indexes every inline criterion over a records map:
 *   byAcId    - a declared entry id -> the id of the record carrying it (a bare `ac.*` ref resolves
 *               through this when no live record owns it)
 *   byParent  - parent record id -> Map(fragment -> entry) for `parent#frag` resolution; every entry
 *               registers its full id, its last id segment and its `name`
 *   collisions - a declared entry id claimed under two different parents: [{id, parents}]
 */
export function indexInlineCriteria(records) {
  const byAcId = new Map();
  const byParent = new Map();
  const collisions = [];
  for (const [id, rec] of records) {
    for (const criterion of inlineCriteriaOf(rec.data)) {
      if (!byParent.has(id)) byParent.set(id, new Map());
      const frags = byParent.get(id);
      for (const frag of [criterion.id, criterion.name, criterion.id?.split('.').pop()]) {
        if (frag && !frags.has(frag)) frags.set(frag, criterion);
      }
      if (criterion.id) {
        const other = byAcId.get(criterion.id);
        if (other && other !== id) collisions.push({id: criterion.id, parents: [other, id]});
        else byAcId.set(criterion.id, id);
      }
    }
  }
  return {byAcId, byParent, collisions};
}

/** Splits a reference into {id, frag}: `P#frag` -> {id: 'P', frag}; `P` -> {id: 'P', frag: null}. */
export function splitRef(ref) {
  const at = ref.indexOf('#');
  return at < 0 ? {id: ref, frag: null} : {id: ref.slice(0, at), frag: ref.slice(at + 1)};
}

/**
 * The record id a reference resolves to, or null when nothing owns it. `P` resolves when P is a record;
 * `P#frag` resolves to P when P is a record and frag names an inline criterion P carries (by full id,
 * short name or last segment) or is itself a live record id; a bare `ac.*` id resolves to the parent
 * record that now carries it inline when no live record owns it. `inline` may be passed when the caller
 * already built indexInlineCriteria(records).
 */
export function resolveRecordRef(records, ref, inline = indexInlineCriteria(records)) {
  const {id, frag} = splitRef(ref);
  if (frag != null) {
    if (!frag || !records.has(id)) return null;
    if (inline.byParent.get(id)?.has(frag)) return id;
    if (records.has(frag)) return id;
    if (inline.byAcId.get(frag) === id) return id;
    return null;
  }
  if (records.has(id)) return id;
  return inline.byAcId.get(id) ?? null;
}

/** A minimal records map (id -> {id, schema, data, dir}) for a `.starciwork` tree, built the same way
 * scripts/checks/check-example-work.mjs's own walk does, for callers (scripts/example-evidence.mjs) that need
 * `resolveOwnedDirs`'s prover-fallback but do not already have a records map of their own. */
export function loadRecords(workRoot, walk) {
  const records = new Map();
  const workspaceDoc = readWorkspace(workRoot);
  for (const file of walk(workRoot).filter(f => f.endsWith('.yaml'))) {
    const rel = path.relative(workRoot, file).replaceAll('\\', '/');
    if (rel === '_derived' || rel.startsWith('_derived/') || rel.endsWith('/evidence.yaml')) continue;
    let data;
    try { data = parseYaml(fs.readFileSync(file, 'utf8')); } catch { continue; }
    if (!data || typeof data !== 'object' || !data.id) continue;
    if (!isWorkRecordSchema(data.schema, workspaceDoc)) continue;
    records.set(data.id, {id: data.id, schema: data.schema, data, dir: path.dirname(file)});
  }
  return records;
}
