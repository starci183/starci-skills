import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseYaml} from '../../core/yaml.mjs';
import {readDistJson} from '../../core/runtime-root.mjs';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Prefer `.dist` public JSON; fall back to authored YAML for build-adjacent tests. */
export function readPublicJson(...parts) {
  const dist = path.join(repository, '.dist', ...parts);
  if (fs.existsSync(dist)) return JSON.parse(fs.readFileSync(dist, 'utf8'));
  return readDistJson(...parts);
}

export function readExample(name) {
  const base = name.replace(/\.json$/i, '');
  const dist = path.join(repository, '.dist', 'examples', `${base}.json`);
  if (fs.existsSync(dist)) return JSON.parse(fs.readFileSync(dist, 'utf8'));
  const yaml = path.join(repository, 'examples', `${base}.yaml`);
  if (fs.existsSync(yaml)) return parseYaml(fs.readFileSync(yaml, 'utf8'));
  throw Error(`Missing example ${name}`);
}

export function readWorkflow(name) {
  return readPublicJson('workflows', name.endsWith('.json') ? name : `${name}.json`);
}

export {repository};
