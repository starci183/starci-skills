// yaml.mjs — the forgiving YAML read: a module file a peer wrote, a missing agent card or a truncated
// template is the caller's fallback, never a throw (the JSON twin is ./json.mjs readJsonFile).
import fs from 'node:fs';
import { parseYaml } from '../../engine/yaml.mjs';

/** `file` read and parsed as YAML, or `fallback` when it is missing, unreadable or malformed. */
export const readYamlFile = (file, fallback = null) => {
  try { return parseYaml(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
};
