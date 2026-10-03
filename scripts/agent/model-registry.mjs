// scripts/agent/model-registry.mjs — the ONE model catalog loaders:
// modules/models/registry.yaml (models, pools, targets) plus the merged
// runtimes view (runtimes.yaml's operational policy plus registry `pools`
// under `runtimes` — the same shape consumers read before the pools moved).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { readYamlFile } from '../lib/read-yaml.mjs';

const skillRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
export const DEFAULT_MODELS_DIR = path.join(skillRoot, 'modules', 'models');

export const loadModelRegistry = (modelsDir = DEFAULT_MODELS_DIR) => readYamlFile(path.join(modelsDir, 'registry.yaml'));

/** Agent cards and model catalogs have one filesystem owner. */
export function loadAdapter(provider, modelsDir = DEFAULT_MODELS_DIR) {
  const file = path.join(modelsDir, 'agents', `${provider}.yaml`);
  if (!fs.existsSync(file)) return { provider, error: `no adapter card modules/models/agents/${provider}.yaml` };
  try {
    return { provider, card: parseYaml(fs.readFileSync(file, 'utf8')), file: `modules/models/agents/${provider}.yaml` };
  } catch (error) {
    return { provider, error: `adapter card ${provider}.yaml unparsable: ${error.message}` };
  }
}

/** A logical runtime identity never proves its provider-selected underlying model. */
export function adapterModelAuthority(card) {
  if (!card || Array.isArray(card) || card.schema !== 'starci/agent-card@1' || typeof card.agent !== 'string' || !card.agent.trim()
    || card.start?.api !== 'orchestration.worker-start' || card.start.agentArgument !== card.agent) return null;
  return card.modelAuthority ?? (card.start?.modelArgument === false ? null : 'supported-model-argument');
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
