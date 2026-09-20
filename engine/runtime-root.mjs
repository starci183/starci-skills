import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseYaml} from './yaml.mjs';

/**
 * Runtime root helper. The `.dist` build is retired: the runtime reads this source tree
 * directly. `skillRoot` is the directory containing `package.json` (this module's parent),
 * whether that is the authored checkout or a sealed runtime-pin payload.
 *
 * All workflows/ops/schemas/knowledge/specifications/model contracts consumed at
 * runtime are authored YAML (or authored JSON where a document is stored that way).
 * `readDistJson`/`distPath`/`distRoot` keep their historical names as compatibility
 * aliases so foreign call sites keep working, but they resolve under `skillRoot` and
 * `readDistJson` understands that a `<name>.json` request is answered by the authored
 * `<name>.yaml` (or `.yml`) document beside it.
 */
const moduleRoot = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

/** The runtime root: this source tree (or an immutable sealed payload of it). */
export const skillRoot = moduleRoot;
/** @deprecated Alias kept for call sites; there is no `.dist` directory. */
export const distRoot = skillRoot;

/**
 * Path under the runtime root. Returns a plain join - callers that need a contract
 * document should use readDistJson (or parse the file by extension), since authored
 * documents are YAML where the compiled layout used JSON.
 */
export function distPath(...parts) {
  return path.join(skillRoot, ...parts);
}

/** Fail fast when the runtime tree is absent; returns the runtime root. */
export function requireDist() {
  if (!fs.existsSync(path.join(skillRoot, 'package.json')) || !fs.existsSync(path.join(skillRoot, 'engine', 'ledger-db.mjs'))) {
    throw new Error(`StarCi runtime files are missing from ${skillRoot}`);
  }
  return skillRoot;
}

/**
 * Candidate source paths for a contract requested by its historical `.dist` spelling.
 * `ops/<id>/operator.json` resolves to the canonical module manifest
 * `modules/ops/ops/<id>.yaml`; the `legacy/` fallback arms are gone with the retired
 * tree. A generic `<name>.json` falls back to the authored `<name>.yaml`/`.yml`
 * beside it, and `schemas/<doc>` spellings resolve under `modules/schemas/`.
 */
function contractCandidates(parts) {
  if (parts[0] === 'ops' && parts.length === 3) {
    const [, id, doc] = parts;
    if (doc === 'operator.json' || doc === 'operator.yaml') {
      return [`modules/ops/ops/${id}.yaml`];
    }
    // Non-manifest op documents only ever lived under the retired legacy/ops tree; they fall through to the
    // generic candidates so the miss reports the historical spelling.
  }
  const rel = parts.join('/');
  // `model/` is retired: canonical records live in modules/models/.
  // Runtime profiles flattened from model/<runtime>/profiles/<id> to modules/models/profiles/<id>.
  const runtimeProfile = rel.match(/^model\/([^/]+)\/profiles\/([^/]+)\.json$/i);
  if (runtimeProfile) {
    return [`modules/models/profiles/${runtimeProfile[2]}.yaml`];
  }
  const modelRecord = rel.match(/^model\/([^/]+)\.(?:json|ya?ml)$/i);
  if (modelRecord) {
    return [`modules/models/${modelRecord[1]}.yaml`];
  }
  // `schemas/` merged into `modules/schemas/`: a `schemas/<doc>.json` request resolves to the authored
  // `modules/schemas/<doc>.yaml` (or `.yml`).
  const schemaDoc = rel.match(/^schemas\/(.+)$/i);
  if (schemaDoc) {
    const stem = schemaDoc[1].replace(/\.(?:json|ya?ml)$/i, '');
    return [`modules/schemas/${stem}.yaml`, `modules/schemas/${stem}.yml`, `modules/schemas/${schemaDoc[1]}`];
  }
  const candidates = [rel];
  if (/\.json$/i.test(rel)) {
    candidates.push(`${rel.slice(0, -5)}.yaml`, `${rel.slice(0, -5)}.yml`);
  }
  return candidates;
}

/**
 * Resolve the source document a `.dist`-style contract path now maps to.
 * Returns the absolute file path, or null when no candidate exists.
 */
export function resolveContractFile(...parts) {
  for (const relative of contractCandidates(parts)) {
    const file = path.join(skillRoot, relative);
    if (file.startsWith(skillRoot) && fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  }
  return null;
}

/** Absolute path of an op manifest document, or null. `doc` is the document stem (`operator`, `secondary`, `specification`). */
export function opDocumentPath(id, doc = 'operator') {
  return resolveContractFile('ops', id, `${doc}.json`);
}

/**
 * Read a runtime contract document. `parts` are the historical `.dist` path segments
 * (e.g. readDistJson('model','registry.json')); the YAML fallbacks and retired-tree
 * mappings are applied by contractCandidates.
 */
export function readDistJson(...parts) {
  const candidates = contractCandidates(parts);
  let file = null;
  for (const relative of candidates) {
    const absolute = path.join(skillRoot, relative);
    if (absolute.startsWith(skillRoot) && fs.existsSync(absolute) && fs.statSync(absolute).isFile()) { file = absolute; break; }
  }
  if (!file) throw new Error(`Required contract not found for ${parts.join('/')} (looked for ${candidates.join(', ')}) under ${skillRoot}`);
  const text = fs.readFileSync(file, 'utf8');
  if (/\.ya?ml$/i.test(file)) return parseYaml(text);
  return JSON.parse(text);
}
