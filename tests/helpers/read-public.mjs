import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseYaml} from '../../core/yaml.mjs';
import {readDistJson} from '../../core/runtime-root.mjs';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Read a public contract document; `.json` spellings resolve to the authored YAML source. */
export function readPublicJson(...parts) {
  return readDistJson(...parts);
}

export function readExample(name) {
  const base = name.replace(/\.(json|ya?ml)$/i, '');
  for (const candidate of [`examples/${base}.yaml`, `examples/${base}.json`]) {
    const file = path.join(repository, candidate);
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    return /\.ya?ml$/i.test(file) ? parseYaml(text) : JSON.parse(text);
  }
  throw Error(`Missing example ${name}`);
}

export function readWorkflow(name) {
  return readPublicJson('workflows', name.endsWith('.json') ? name : `${name}.json`);
}

/** Canonical model record: `modules/models/<name>.yaml` — there is no compiled form. */
export function readModel(name) {
  const base = name.replace(/\.(yaml|yml|json)$/i, '');
  return parseYaml(fs.readFileSync(path.join(repository, 'modules', 'models', `${base}.yaml`), 'utf8'));
}

export {repository};
