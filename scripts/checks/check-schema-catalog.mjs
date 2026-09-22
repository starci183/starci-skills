#!/usr/bin/env node
// check-schema-catalog.mjs — every `schema:` const stamped under modules/ is
// accounted for in exactly one place: modules/schemas/index.yaml, either as a
// catalogued schema (`schemas[].id`) or as a module-local document kind
// (`moduleLocalDocumentKinds[]` — a contract document that stamps its own kind
// and has no schema file).
//
//   node scripts/checks/check-schema-catalog.mjs [--json]
//
// modules/ops/ops/*.yaml is excluded: those manifests all stamp the one op
// kind the generated modules/ops/registry.yaml indexes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';

const MODULES_DIR = path.join(skillRoot, 'modules');
const CATALOG_FILE = path.join(skillRoot, 'modules', 'schemas', 'index.yaml');
const EXCLUDED_PREFIX = 'modules/ops/ops/';

const rel = (root, file) => path.relative(root, file).split(path.sep).join('/');

function yamlFilesUnder(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return yamlFilesUnder(full);
    return /\.ya?ml$/i.test(entry.name) ? [full] : [];
  });
}

// The stamp is a top-level `schema:` key — column 0, scalar value. A nested
// `schema:` (inside properties:, inside a usedBy: note) is not an identity.
function stampOf(text) {
  const match = text.match(/^schema:[ \t]*(?:'([^']+)'|"([^"]+)"|([^\s#]+))[ \t]*(?:#.*)?$/m);
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? null;
}

export function checkSchemaCatalog({ root = skillRoot } = {}) {
  const modulesDir = root === skillRoot ? MODULES_DIR : path.join(root, 'modules');
  const catalogFile = root === skillRoot ? CATALOG_FILE : path.join(root, 'modules', 'schemas', 'index.yaml');
  const errors = [];

  let catalog = null;
  try {
    catalog = parseYaml(fs.readFileSync(catalogFile, 'utf8'));
  } catch (error) {
    return { ok: false, errors: [`modules/schemas/index.yaml is unreadable: ${error.message}`], stamps: [], uncatalogued: [], unused: [] };
  }

  // `id` may carry a trailing parenthetical note; the const is the first token.
  const catalogued = new Map();
  for (const entry of catalog?.schemas ?? []) {
    const id = String(entry?.id ?? '').trim().split(/\s+/)[0];
    if (id) catalogued.set(id, 'schemas[].id');
  }
  const moduleLocal = new Map();
  for (const entry of catalog?.moduleLocalDocumentKinds ?? []) {
    const id = String(entry?.id ?? '').trim();
    if (!id) { errors.push('moduleLocalDocumentKinds holds an entry with no id'); continue; }
    if (catalogued.has(id)) errors.push(`${id} is listed both as a catalogued schema and a module-local document kind — one place only`);
    if (moduleLocal.has(id)) errors.push(`${id} is listed twice under moduleLocalDocumentKinds`);
    const declared = Array.isArray(entry?.files) ? entry.files.map(String) : [];
    if (!declared.length) errors.push(`moduleLocalDocumentKinds entry ${id} declares no files[]`);
    moduleLocal.set(id, declared);
  }

  const stamps = [];
  for (const file of yamlFilesUnder(modulesDir).sort()) {
    const relative = rel(root, file);
    if (relative.startsWith(EXCLUDED_PREFIX)) continue;
    const id = stampOf(fs.readFileSync(file, 'utf8'));
    if (id) stamps.push({ file: relative, id });
  }

  const uncatalogued = [];
  for (const { file, id } of stamps) {
    const where = catalogued.has(id) ? 'schemas' : (moduleLocal.has(id) ? 'module-local' : null);
    if (!where) {
      uncatalogued.push({ file, id });
      errors.push(`${file} stamps ${id}, which modules/schemas/index.yaml does not list (add a schemas[] entry or a moduleLocalDocumentKinds[] entry)`);
      continue;
    }
    // A module-local kind lists every file that stamps it — no silent additions.
    if (where === 'module-local' && !moduleLocal.get(id).includes(file))
      errors.push(`${file} stamps module-local kind ${id}, which modules/schemas/index.yaml does not list under its files[]`);
  }

  // Stale entries: a module-local kind nothing stamps, or a listed file that
  // does not stamp the kind it is listed under.
  const stampedIds = new Set(stamps.map((s) => s.id));
  const stampByFile = new Map(stamps.map((s) => [s.file, s.id]));
  const unused = [...moduleLocal.keys()].filter((id) => !stampedIds.has(id));
  for (const id of unused) errors.push(`moduleLocalDocumentKinds lists ${id}, which no file under modules/ stamps`);
  for (const [id, files] of moduleLocal) {
    for (const file of files) {
      if (!stampByFile.has(file)) errors.push(`moduleLocalDocumentKinds lists ${file} under ${id}, but that file stamps no schema`);
      else if (stampByFile.get(file) !== id) errors.push(`moduleLocalDocumentKinds lists ${file} under ${id}, but it stamps ${stampByFile.get(file)}`);
    }
  }

  return { ok: errors.length === 0, errors, stamps, uncatalogued, unused };
}

export function schemaCatalogMain(argv = []) {
  if (argv.includes('--help') || argv.includes('-h'))
    return { exitCode: 0, text: 'Usage: node scripts/checks/check-schema-catalog.mjs [--json]\n\nEvery `schema:` const under modules/ (excluding modules/ops/ops/) must be catalogued in modules/schemas/index.yaml exactly once. Exit 0 is clean, 1 reports gaps.\n' };
  const result = checkSchemaCatalog();
  if (argv.includes('--json'))
    return { exitCode: result.ok ? 0 : 1, text: `${JSON.stringify({ schema: 'starci/schema-catalog-check@1', ok: result.ok, errors: result.errors, stampCount: result.stamps.length }, null, 2)}\n` };
  const text = result.ok
    ? `OK: ${result.stamps.length} schema stamps under modules/ are all catalogued.\n`
    : `${result.errors.map((e) => `  ${e}`).join('\n')}\nFAIL: ${result.errors.length} schema catalog gap(s).\n`;
  return { exitCode: result.ok ? 0 : 1, text };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = schemaCatalogMain(process.argv.slice(2));
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
}
