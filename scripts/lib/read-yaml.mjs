// yaml.mjs — the forgiving YAML read: a module file a peer wrote, a missing agent card or a truncated
// template is the caller's fallback, never a throw (the JSON twin is ./json.mjs readJsonFile).
import { parseYaml } from '../../engine/yaml.mjs';
import { readParsedFile } from './read-text.mjs';

/** `file` read and parsed as YAML, or `fallback` when it is missing, unreadable or malformed. */
export const readYamlFile = (file, fallback = null) => readParsedFile(file, parseYaml, fallback);

/** `file` (YAML) overlaid on `defaults`: each declared key whose doc value is a positive finite number. */
export const yamlNumberSettings = (file, defaults) => {
  const doc = readYamlFile(file) ?? {};
  const out = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const n = Number(doc[key]);
    if (Number.isFinite(n) && n > 0) out[key] = n;
  }
  return out;
};
