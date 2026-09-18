import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parseYaml} from '../core/yaml.mjs';

/**
 * Shared resolution of "what directories does this record's code live under" - the question concepts 1
 * (codeDigest), 3 (OWNER_PATH_MISSING/PROVES_TARGET_NOT_DONE) and 4 (SDS owners) all ask, so it is answered
 * once here rather than three times with three chances to disagree. Used by scripts/check-example-work.mjs,
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
    for (const [otherId, other] of recordsById) {
      if (other.schema !== 'work/implementation') continue;
      const proves = Array.isArray(other.data.proves) ? other.data.proves : [];
      if (proves.includes(id)) add(other.data, otherId);
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

/** A minimal records map (id -> {id, schema, data, dir}) for a `.starciwork` tree, built the same way
 * scripts/check-example-work.mjs's own walk does, for callers (scripts/example-evidence.mjs) that need
 * `resolveOwnedDirs`'s prover-fallback but do not already have a records map of their own. */
export function loadRecords(workRoot, walk) {
  const records = new Map();
  for (const file of walk(workRoot).filter(f => f.endsWith('.yaml'))) {
    const rel = path.relative(workRoot, file).replaceAll('\\', '/');
    if (rel === '_derived' || rel.startsWith('_derived/') || rel.endsWith('/evidence.yaml')) continue;
    let data;
    try { data = parseYaml(fs.readFileSync(file, 'utf8')); } catch { continue; }
    if (!data || typeof data !== 'object' || !data.id) continue;
    records.set(data.id, {id: data.id, schema: data.schema, data, dir: path.dirname(file)});
  }
  return records;
}
