// canon-pins.mjs - where the canon pins live and how they are read: knowledge/hfs/canon-pins.yaml (shape:
// modules/schemas/canon-pins.schema.yaml) and the profiles bound to the canons, modules/models/code-patterns.yaml.
// The gates read the pins here; scripts/checks/check-canon-pins.mjs is the self-check that judges them.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';

export const PINS_FILE = 'knowledge/hfs/canon-pins.yaml';
export const SCHEMA_FILE = 'modules/schemas/canon-pins.schema.yaml';
export const PROFILES_FILE = 'modules/models/code-patterns.yaml';

/** The parsed canon pins of the runtime at `root`. */
export function loadPins(root = skillRoot) {
  return parseYaml(fs.readFileSync(path.join(root, PINS_FILE), 'utf8'));
}
