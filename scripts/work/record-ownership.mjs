import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../../engine/yaml.mjs';
import {readYamlFile} from '../lib/read-yaml.mjs';
import {sha256, sha256File} from '../../engine/digest.mjs';
import { byCodeUnit } from '../lib/list.mjs';

/**
 * Shared resolution of "what directories does this record's code live under" - the question concepts 1
 * (codeDigest), 3 (OWNER_PATH_MISSING/PROVES_TARGET_NOT_DONE) and 4 (SDS owners) all ask, so it is answered
 * once here rather than three times with three chances to disagree. Used by scripts/work/validate/check-example-work.mjs,
 * scripts/example/example-evidence.mjs and scripts/example/example-derive.mjs.
 *
 * Design note (owner, 2026-09-18): `work/implementation@1.owners[].path`, `work/sds-component@1.owners[].path`
 * and `work/business-rule@1.module` are directories - module roots - never individual files (see
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

export const readWorkspace = (workRoot) => readYamlFile(path.join(workRoot, 'workspace.yaml'));

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
 * The side folder `repositoryName` (a record's `repository`: be or fe, the repositories workspace.yaml declares, the sides of
 * hfs.json) names under the app root, or the app root itself when the record names none; null for a name that is not a side
 * the workspace declares (a record of no folder of this app). Owner paths do not use it: they are app-relative
 * (ownerPathProblem) and resolve under the app root. The one package.json and every proof command are the app root's.
 */
export function repoRootFor(workRoot, repositoryName, workspaceDoc) {
  const appRoot = appRootOf(workRoot);
  if (!repositoryName) return appRoot;
  const repos = Array.isArray(workspaceDoc?.repositories) ? workspaceDoc.repositories : [];
  const declared = repos.some(r => r?.name === repositoryName && r?.role === repositoryName);
  return declared && APP_SIDES.includes(repositoryName) ? path.join(appRoot, repositoryName) : null;
}

function ownedRelPaths(data) {
  const fromOwners = Array.isArray(data.owners) ? data.owners.map(o => o?.path).filter(Boolean) : [];
  let fromModule = [];
  if (typeof data.module === 'string') fromModule = [data.module];
  else if (Array.isArray(data.module)) fromModule = data.module.filter(m => typeof m === 'string');
  return [...fromOwners, ...fromModule].map(moduleRootOf);
}

/** Whether `data` declares any owners/module path directly (as opposed to needing prover fallback). */
export function declaresOwnPaths(data) {
  return ownedRelPaths(data).length > 0;
}

/** The app root a Work tree belongs to: .starciwork sits at the app root, beside hfs.json and the be/ and fe/ sides. */
export const appRootOf = workRoot => path.dirname(path.resolve(workRoot));

/** The sides of an app: every owner path of a code record starts with one of them (or names an app-root directory). */
export const APP_SIDES = Object.freeze(['be', 'fe']);

/**
 * Why one owner path (`owners[].path`, `module`, `composes[].module`) is not app-relative, or null when it is. An owner
 * path is app-relative - be/<path>, fe/<path> or a directory of the app root - the one form gate.mjs, a job's owned_paths
 * and every finding use. Refused: a `repository:<id>/` prefix, an absolute or ../ path, and a side-relative path (src/x
 * where be/src/x exists): OWNER_PATH_NOT_APP_RELATIVE.
 */
function ownerPathProblem(rawPath, appRoot) {
  const rel = String(rawPath).replaceAll('\\', '/');
  const hint = 'an owner path is app-relative: be/<path>, fe/<path> or a directory of the app root';
  if (rel.startsWith('repository:')) return `${rawPath} names a repository; ${hint}`;
  if (path.isAbsolute(rawPath) || /^[A-Za-z]:/.test(rel)) return `${rawPath} is absolute; ${hint}`;
  if (rel === '..' || rel.startsWith('../') || rel.startsWith('./')) return `${rawPath} is relative to another directory; ${hint}`;
  const head = moduleRootOf(rel).split('/')[0];
  if (APP_SIDES.includes(head) || fs.existsSync(path.join(appRoot, head))) return null;
  const sides = APP_SIDES.filter(side => fs.existsSync(path.join(appRoot, side, head))).map(side => `${side}/${moduleRootOf(rel)}`);
  return sides.length ? `${rawPath} is side-relative (it means ${sides.join(' or ')}); ${hint}` : null;
}

/** Every owner path of `data` that is not app-relative, as {path, problem}. */
export function ownerPathProblems(data, appRoot) {
  let modulePaths = [];
  if (typeof data?.module === 'string') modulePaths = [data.module];
  else if (Array.isArray(data?.module)) modulePaths = data.module.filter(m => typeof m === 'string');
  const raw = [
    ...(Array.isArray(data?.owners) ? data.owners.map(o => o?.path).filter(p => typeof p === 'string') : []),
    ...modulePaths,
    ...(Array.isArray(data?.composes) ? data.composes.map(c => c?.module).filter(m => typeof m === 'string') : []),
  ];
  return raw.map(p => ({path: p, problem: ownerPathProblem(p, appRoot)})).filter(x => x.problem);
}

/**
 * Every `{rel, abs}` directory `record` (an entry from check-example-work.mjs's own `records` map, or the
 * lightweight equivalent `loadRecords` below builds) owns, resolved under the app root (every owner path is
 * app-relative; one that is not is left out here and refused by the checks as OWNER_PATH_NOT_APP_RELATIVE):
 * directly from its own `owners`/`module`, or - only when it declares neither - from every
 * `work/implementation@1` whose `proves` names this record's id (the layout's resolution for a specification
 * that owns no code itself but is demonstrated by an implementation that does). Deduplicated by `abs`.
 * `recordsById` maps id -> {schema, data} (or richer; only those two fields are read).
 */
export function resolveOwnedDirs(id, record, recordsById, workspaceDoc, workRoot) {
  const appRoot = appRootOf(workRoot);
  const out = new Map(); // abs -> {rel, abs, via}
  const add = (data, via) => {
    for (const rel of ownedRelPaths(data)) {
      if (ownerPathProblem(rel, appRoot)) continue;
      const abs = path.join(appRoot, rel);
      if (!out.has(abs)) out.set(abs, {rel, abs, via});
    }
  };
  add(record.data, 'self');
  if (!declaresOwnPaths(record.data)) {
    // Compact format: `proves` may name `P#frag` or a collapsed bare `ac.*` id - both resolve to the
    // record carrying the criterion, so canonicalize each entry before comparing.
    const inline = indexInlineCriteria(recordsById);
    for (const [otherId, other] of recordsById) {
      if (other.schema !== 'work/implementation@1') continue;
      const proves = Array.isArray(other.data.proves) ? other.data.proves : [];
      if (proves.some(p => resolveRecordRef(recordsById, p, inline) === id)) add(other.data, otherId);
    }
  }
  return [...out.values()];
}

export function missingOwnedDirs(dirs) {
  return dirs.filter(d => !fs.existsSync(d.abs));
}

/**
 * The owned paths a record list resolves to under a `.starciwork` tree (`workRoot`, absolute): one entry per
 * directory resolveOwnedDirs returns - {record, path (forward slashes), via, exists} plus `abs` when `withAbs` -
 * and `missing`, the record ids nothing answered. `walk` lists a directory's files for the loadRecords scan.
 */
export function ownedRecordPaths(records, workRoot, { walk, withAbs = false } = {}) {
  const recordsById = loadRecords(workRoot, walk);
  const workspaceDoc = readWorkspace(workRoot);
  const ownedPaths = [];
  const missing = [];
  for (const rid of records) {
    const rec = recordsById.get(rid);
    if (!rec) { missing.push(rid); continue; }
    for (const d of resolveOwnedDirs(rid, rec, recordsById, workspaceDoc, workRoot)) {
      ownedPaths.push({ record: rid, path: d.rel.replaceAll('\\', '/'), via: d.via, exists: fs.existsSync(d.abs), ...(withAbs ? { abs: d.abs } : {}) });
    }
  }
  return { ownedPaths, missing };
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
  const sortedPaths = [...files.keys()].sort(byCodeUnit);
  const fileDigests = sortedPaths.map(p => ({path: p, sha256: sha256File(files.get(p))}));
  const digest = sha256(fileDigests.map(f => `${f.path}:${f.sha256}`).join('\n'));
  return {algorithm: 'sha256', files: fileDigests, digest};
}

// ---- v11 compact format: inlined acceptance criteria ----
// A criterion can be carried inline on the parent
// record's `acceptance:` (or `statements:`) list as an entry with `id: <ac-id>`. An inlined
// criterion resolves like a record: its `ac.*` id answers directly, and the
// canonical form `parent#ac-id` (or `parent#<short-name>`) answers through the parent. These three
// helpers are the single resolution every script shares, so the gate, the deep check, the consistency
// check and the derive/evidence tools cannot drift on what "the same criterion" means.

/** Fields a parent record may carry inlined criteria under, per the v11 collapse law. */
export const INLINE_CRITERION_FIELDS = ['acceptance', 'statements'];

/** The inline criterion entries one record's data carries: [{id, name, entry}]. `id` is the former
 * ac record's id when the entry declares one; `name` is the entry's short name (`entry.name`, else the
 * id's last segment). Plain-string list items are not criteria entries and are skipped. */
function inlineCriterionOf(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : null;
  let name = null;
  if (typeof entry.name === 'string' && entry.name.trim()) name = entry.name.trim();
  else if (id) name = id.split('.').pop();
  return id || name ? {id, name, entry} : null;
}

export function inlineCriteriaOf(data) {
  const out = [];
  for (const field of INLINE_CRITERION_FIELDS) {
    for (const entry of Array.isArray(data?.[field]) ? data[field] : []) {
      const criterion = inlineCriterionOf(entry);
      if (criterion) out.push(criterion);
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
function addInlineCriterion(parentId, criterion, byAcId, byParent, collisions) {
  if (!byParent.has(parentId)) byParent.set(parentId, new Map());
  const frags = byParent.get(parentId);
  for (const frag of [criterion.id, criterion.name, criterion.id?.split('.').pop()]) {
    if (frag && !frags.has(frag)) frags.set(frag, criterion);
  }
  if (!criterion.id) return;
  const other = byAcId.get(criterion.id);
  if (other && other !== parentId) collisions.push({id: criterion.id, parents: [other, parentId]});
  else byAcId.set(criterion.id, parentId);
}

export function indexInlineCriteria(records) {
  const byAcId = new Map();
  const byParent = new Map();
  const collisions = [];
  for (const [id, rec] of records) {
    for (const criterion of inlineCriteriaOf(rec.data)) addInlineCriterion(id, criterion, byAcId, byParent, collisions);
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
 * scripts/work/validate/check-example-work.mjs's own walk does, for callers (scripts/example/example-evidence.mjs) that need
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
