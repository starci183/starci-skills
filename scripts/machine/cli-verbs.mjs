// cli-verbs.mjs — the catalogued starci verbs, read from their source (modules/cli/commands/<group>/<verb>.yaml, the files
// scripts/cli/gen-catalog.mjs turns into the generated catalog), for the readers that must know a verb's flags without the CLI package.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';

const COMMANDS_DIR = ['modules', 'cli', 'commands'];

/** The catalogued groups (the directories of modules/cli/commands). */
export function cliGroups(root = skillRoot) {
  const dir = path.join(root, ...COMMANDS_DIR);
  return fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

/** The catalog row of `group verb` ({summary, flags, positional, roles, ...}), or null when the catalog lacks it. */
export function cliVerb(group, verb, root = skillRoot) {
  const file = path.join(root, ...COMMANDS_DIR, group, `${verb}.yaml`);
  if (!/^[a-z][a-z0-9-]*$/.test(group) || !/^[a-z][a-z0-9-]*$/.test(verb) || !fs.existsSync(file)) return null;
  return parseYaml(fs.readFileSync(file, 'utf8'));
}
