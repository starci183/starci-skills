import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseYaml} from './yaml.mjs';

/**
 * Runtime root helper. The runtime reads this source tree directly. `skillRoot` is the
 * directory containing `package.json` (this module's parent), whether that is the authored
 * checkout or a sealed runtime-pin payload.
 *
 * All workflows/ops/schemas/knowledge/specifications/model contracts consumed at
 * runtime are authored YAML (or authored JSON where a document is stored that way).
 * `readDistJson` resolves a path under `skillRoot` and parses the file by extension.
 */
const moduleRoot = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

/** The runtime root: this source tree (or an immutable sealed payload of it). */
export const skillRoot = moduleRoot;

/**
 * Read a runtime contract document. `parts` are path segments under `skillRoot`
 * (e.g. readDistJson('modules', 'schemas', 'profiles.yaml')).
 */
export function readDistJson(...parts) {
  const rel = parts.join('/');
  const file = path.join(skillRoot, rel);
  if (!(file.startsWith(skillRoot) && fs.existsSync(file) && fs.statSync(file).isFile()))
    throw new Error(`Required contract not found for ${rel} under ${skillRoot}`);
  const text = fs.readFileSync(file, 'utf8');
  if (/\.ya?ml$/i.test(file)) return parseYaml(text);
  return JSON.parse(text);
}
