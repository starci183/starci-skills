// critic-contract.mjs — reads the Critic's data (modules/kernel/critic.yaml): the seat whose tier it is picked from, the
// typed codes of its holds and the coverage table of the op kinds that owe a Critic.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CRITIC_FILE = 'modules/kernel/critic.yaml';

/** The Critic contract of the tree at `root`. */
export const criticContract = (root = ROOT) => parseYaml(fs.readFileSync(path.join(root, CRITIC_FILE), 'utf8'));

/** The coverage row of op kind `kind` ({kind, status: covered|owed, ...}), or null when the kind owes no Critic. */
export const coverageOf = (kind, contract = criticContract()) => contract.coverage.find((row) => row.kind === kind) ?? null;
