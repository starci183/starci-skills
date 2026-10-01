import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseYaml} from './yaml.mjs';

/**
 * Runtime root helper. The runtime reads this source tree directly. `skillRoot` is the
 * directory containing `package.json` (this module's parent) — the checkout, or the copy of it
 * an install placed on the host.
 *
 * Every workflow, op, schema, knowledge and model contract read at runtime is an authored YAML
 * file (or an authored JSON one where a document is stored that way). `readModuleJson` resolves a
 * path under `skillRoot` and parses the file by its extension.
 */
const moduleRoot = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

/** The runtime root: this source tree (or an immutable sealed payload of it). */
export const skillRoot = moduleRoot;
/**
 * The StarCi Source root (the host containing .claude and .workspaces): STARCI_SOURCE_ROOT overrides it, else the directory
 * holding this runtime checkout. Parameterized over `env`, so a spec can inject a fixture Source.
 */
export const starciSourceRoot = (env = process.env) => (env.STARCI_SOURCE_ROOT ? path.resolve(env.STARCI_SOURCE_ROOT) : path.dirname(skillRoot));

/**
 * Read a runtime contract document. `parts` are path segments under `skillRoot`
 * (e.g. readModuleJson('modules', 'models', 'kinds.yaml')).
 */
export function readModuleJson(...parts) {
  const rel = parts.join('/');
  const file = path.join(skillRoot, rel);
  if (!(file.startsWith(skillRoot) && fs.existsSync(file) && fs.statSync(file).isFile()))
    throw new Error(`Required contract not found for ${rel} under ${skillRoot}`);
  const text = fs.readFileSync(file, 'utf8');
  if (/\.ya?ml$/i.test(file)) return parseYaml(text);
  return JSON.parse(text);
}
