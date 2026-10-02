// scripts/agent/model-registry.mjs — the ONE model catalog loaders:
// modules/models/registry.yaml (models, pools, targets) plus the merged
// runtimes view (runtimes.yaml's operational policy plus registry `pools`
// under `runtimes` — the same shape consumers read before the pools moved).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';

const skillRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
export const DEFAULT_MODELS_DIR = path.join(skillRoot, 'modules', 'models');

export function loadModelRegistry(modelsDir = DEFAULT_MODELS_DIR) {
  const file = path.join(modelsDir, 'registry.yaml');
  if (!fs.existsSync(file)) return null;
  try { return parseYaml(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

export function loadRuntimes(modelsDir = DEFAULT_MODELS_DIR) {
  const file = path.join(modelsDir, 'runtimes.yaml');
  if (!fs.existsSync(file)) return null;
  const doc = parseYaml(fs.readFileSync(file, 'utf8'));
  return { ...(doc ?? {}), runtimes: loadModelRegistry(modelsDir)?.pools ?? {} };
}

// The unrouted operation target is declared, never a literal: modules/models/registry.yaml
// orchestration.defaultOperationTarget (GQ-02).
// A registry that cannot be read or does not declare it fails loudly.
export function defaultOperationTarget(modelsDir = DEFAULT_MODELS_DIR) {
  const value = loadModelRegistry(modelsDir)?.orchestration?.defaultOperationTarget;
  if (typeof value !== 'string' || !value)
    throw new Error('modules/models/registry.yaml orchestration.defaultOperationTarget must declare the unrouted default target');
  return value;
}
