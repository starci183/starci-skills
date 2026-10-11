// debug-docs.mjs — the declared documents the digest judges by besides the operating standard: the edge-case registry (the state of
// each remedy) and the end condition of the debug role (modules/kernel/roles.yaml). Both are read from the runtime tree.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { rolesContract } from '../machine/roles-contract.mjs';

const REGISTRY_FILE = 'modules/reconciler/edge-cases.yaml';

/** [{id, status, remedy}] for every case of the registry; `remedy` is the state of its finding's remedy (in-tree, on-host, open) or null. */
export function registryFacts(root = skillRoot) {
  const doc = parseYaml(fs.readFileSync(path.join(root, REGISTRY_FILE), 'utf8'));
  return (doc.cases ?? []).map((c) => ({ id: c.id, status: c.status, remedy: c.finding?.remedy?.state ?? null }));
}

/** [{id, min, rule}] of the debug role's end condition. */
export const endCriteria = (root = skillRoot) => (rolesContract(root).roles.find((role) => role.id === 'debug')?.endCondition?.criteria ?? []);
