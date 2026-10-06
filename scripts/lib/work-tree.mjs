// work-tree.mjs — reading a `.starciwork` tree's authored yaml: every record and evidence file,
// `_derived/**` excluded (it is generated output, not input). Records map by their declared `id`,
// evidence by its posix directory relative to the tree root.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { isPlainObject } from '../../engine/plain-object.mjs';
import { walkFiles } from './walk.mjs';

const DERIVED = '_derived';
const yamlObjectOf = (file) => {
  try {
    const data = parseYaml(fs.readFileSync(file, 'utf8'));
    return isPlainObject(data) ? data : null;
  } catch { return null; }
};

/**
 * Every record and evidence file under `workRoot`:
 *   records       id -> {id, schema, state, feature, dir, file, relPath, data}
 *   evidenceByDir dir (posix, relative to workRoot) -> {data, file, dir}
 * A file that is not a YAML mapping or has no string `id` is skipped; `_derived` is never walked into.
 */
export function readWorkTree(workRoot) {
  const records = new Map();
  const evidenceByDir = new Map();
  for (const file of walkFiles(workRoot).filter((f) => f.endsWith('.yaml'))) {
    const relPath = path.relative(workRoot, file).replaceAll('\\', '/');
    if (relPath === DERIVED || relPath.startsWith(`${DERIVED}/`)) continue;
    const data = yamlObjectOf(file);
    if (!data) continue;
    const dir = path.dirname(relPath).replaceAll('\\', '/');
    if (relPath.endsWith('/evidence.yaml') || relPath === 'evidence.yaml') {
      evidenceByDir.set(dir, { data, file, dir });
      continue;
    }
    if (typeof data.id !== 'string' || !data.id) continue;
    const segments = relPath.split('/');
    const feature = segments[0] === 'features' && segments.length > 1 ? segments[1] : null;
    records.set(data.id, { id: data.id, schema: data.schema ?? null, state: Object.hasOwn(data, 'state') ? data.state : null, feature, dir, file, relPath, data });
  }
  return { records, evidenceByDir };
}

/** The record's own index.yaml under `workRoot` (matched on its authored `id`), or null. */
export function findRecordFile(workRoot, recordId) {
  for (const file of walkFiles(workRoot)) {
    if (!file.endsWith('index.yaml')) continue;
    let parsed;
    try { parsed = parseYaml(fs.readFileSync(file, 'utf8')); } catch { continue; }
    if (parsed && typeof parsed === 'object' && parsed.id === recordId) return file;
  }
  return null;
}
