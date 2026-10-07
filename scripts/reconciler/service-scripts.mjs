// service-scripts.mjs - the ONE owner of the script each connector service is launched at (services.mjs probe and actuator).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * The CLI verb (modules/cli/commands/<group>/<verb>.yaml) that owns each connector service's script. The script path itself is
 * never written here: serviceScript reads it from that verb's `impl.script`, so a moved or renamed script is one catalog edit.
 */
export const SERVICE_VERBS = Object.freeze({
  'ask-gateway': ['connect', 'ask-gateway'],
  'ask-tunnel': ['connect', 'tunnel'],
  'telegram-bridge': ['supervisor', 'telegram-bridge'],
});
const scriptCache = new Map();
/** The repo-relative script (posix) the catalog gives the connector service `name`; throws when the verb has no impl.script. */
export function serviceScript(name, root = ROOT) {
  const verb = SERVICE_VERBS[name];
  if (!verb) throw new Error(`no CLI verb owns service ${name}`);
  const key = `${root}|${name}`;
  if (!scriptCache.has(key)) {
    const file = path.join(root, 'modules', 'cli', 'commands', verb[0], `${verb[1]}.yaml`);
    const script = parseYaml(fs.readFileSync(file, 'utf8'))?.impl?.script;
    if (typeof script !== 'string') throw new Error(`${file} has no impl.script`);
    scriptCache.set(key, script);
  }
  return scriptCache.get(key);
}
