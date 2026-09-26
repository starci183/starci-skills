// Strict per-record schema enforcement for `starci validate --strict`.
//
// The structural, consistency and artifact machines check ids, places, refs and proof; none of them compiles
// a record against the JSON schema its own `schema:` const names. So a record carrying a key its closed
// schema refuses, a slug with a capital, or a timestamp in the wrong shape went green under the validator
// while an ajv draft-2020 compile of the same schema refused it (inc-16fe1a2895fd). This machine is that
// compile: every Work record in the walked scope is validated against the catalogued work-tree schema that
// its `schema:` const names, and every violation is a refusal.
//
// Membership is the tree walk's own (scripts/checks/check-example-work.mjs): kernel custody roots and
// _derived projections are skipped, a foreign schema is an artifact payload, an evidence manifest is proof
// payload checked by check-work-artifacts.mjs, and the retired recursive `work/node@*` envelope keeps its
// own readers in engine/index.mjs.
//
// ajv is a devDependency of the runtime checkout, not of an installed tree. When it cannot be loaded the
// strict mode fails closed with one refusal naming why, rather than reporting a green it did not compute.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { isWorkRecordSchema, readWorkspace } from '../example/example-ownership.mjs';
import { legacyOperationsRecord } from './check-example-work.mjs';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKIPPED_ROOTS = new Set(['kernel-evidence', 'kernel-strays', 'kernel-approvals', '_derived']);
const RETIRED_NODE = /^work\/node@\d+$/;

let cached = null;

/** Every catalogued work-tree schema compiled once per process, keyed by its `schema` const. */
export function loadWorkSchemaValidators(root = runtimeRoot) {
  if (cached && cached.root === root) return cached;
  let Ajv2020;
  try {
    const require = createRequire(path.join(root, 'package.json'));
    const loaded = require('ajv/dist/2020.js');
    Ajv2020 = loaded?.default ?? loaded;
  } catch (error) {
    cached = { root, error: `ajv/dist/2020.js is not installed beside the runtime (${String(error?.message ?? error).split('\n')[0]})`, validators: new Map() };
    return cached;
  }
  const schemaDir = path.join(root, 'modules', 'schemas');
  const catalog = parseYaml(fs.readFileSync(path.join(schemaDir, 'index.yaml'), 'utf8'));
  const ajv = new Ajv2020({ strict: false, allErrors: true, logger: false });
  const validators = new Map();
  for (const entry of catalog?.schemas ?? []) {
    if (entry?.subsystem !== 'work-tree' || entry?.dialect !== 'json-schema') continue;
    const schema = parseYaml(fs.readFileSync(path.join(root, String(entry.file)), 'utf8'));
    const family = schema?.properties?.schema?.const;
    if (typeof family === 'string') validators.set(family, { file: String(entry.file), validate: ajv.compile(schema) });
  }
  cached = { root, error: null, validators };
  return cached;
}

const describe = (error) => {
  const at = error.instancePath || '/';
  const detail = error.params?.additionalProperty !== undefined ? ` (${error.params.additionalProperty})`
    : Array.isArray(error.params?.allowedValues) ? ` (${error.params.allowedValues.join(', ')})` : '';
  return `${at} ${error.message}${detail}`;
};

const listYaml = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : listYaml(full);
  return entry.isFile() && entry.name.endsWith('.yaml') ? [full] : [];
});

/**
 * Validates every Work record under `root` against its named schema. Violations go to `refused` as
 * `<path>: <pointer> <message> [SCHEMA_VIOLATION]`; `workRoot` is the enclosing tree whose workspace.yaml may
 * widen the record-schema prefixes. Returns the counts the validate report carries.
 */
export function checkWorkSchemas(root, refused, info = [], { workRoot = root } = {}) {
  const counts = { schemaChecked: 0, schemaRejected: 0 };
  const loaded = loadWorkSchemaValidators();
  if (loaded.error) {
    refused.push(`${root}: strict schema validation cannot run - ${loaded.error} [SCHEMA_VALIDATOR_UNAVAILABLE]`);
    return counts;
  }
  const workspaceDoc = readWorkspace(workRoot);
  for (const file of listYaml(root)) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    const segments = rel.split('/');
    if (SKIPPED_ROOTS.has(segments[0])) continue;
    let record;
    try { record = parseYaml(fs.readFileSync(file, 'utf8')); } catch { continue; } // structural owns the parse refusal
    if (!record || typeof record !== 'object' || Array.isArray(record)) continue;
    const family = record.schema;
    if (typeof family !== 'string' || !isWorkRecordSchema(family, workspaceDoc) || RETIRED_NODE.test(family)) continue;
    if ((family === 'work/evidence@1' && path.basename(rel) !== 'evidence.yaml')
      || (path.basename(rel) === 'manifest.yaml' && segments.includes('evidence'))) continue;
    const shown = path.relative(workRoot, file).split(path.sep).join('/') || rel;
    // The structural gate owns the legacy interface.audit record's suspect (contract change operations-record-legacy).
    if (legacyOperationsRecord(shown.split('/'), record)) continue;
    const entry = loaded.validators.get(family);
    if (!entry) {
      refused.push(`${shown}: names schema ${family}, which no catalogued work-tree schema defines [SCHEMA_UNKNOWN]`);
      counts.schemaRejected += 1;
      continue;
    }
    counts.schemaChecked += 1;
    if (entry.validate(record)) continue;
    counts.schemaRejected += 1;
    for (const error of entry.validate.errors ?? []) refused.push(`${shown}: ${describe(error)} under ${entry.file} [SCHEMA_VIOLATION]`);
  }
  info.push(`${root}: strict schema validation compiled ${counts.schemaChecked} record(s) against their named schemas; ${counts.schemaRejected} rejected [STRICT_MODE]`);
  return counts;
}
