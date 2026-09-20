/**
 * modules/models/index.mjs — the model module's single public API.
 *
 * Canonical successor of the retired `model/index.mjs` (now `legacy/model/`).
 * Every other part of the runtime calls into this module for anything that
 * lives in `modules/models/*.yaml`: the registry, kinds, records, hosts,
 * runtimes, and the provider/runtime configuration that allocation and
 * dispatch need. Callers never read a YAML themselves; they import the
 * function that answers the question. There is no compiled `.dist` form —
 * the authored YAML beside this module IS the runtime source.
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseYaml} from '../../core/yaml.mjs';
import {loadConfig, validateConfig} from '../../scripts/config.mjs';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const listOfStrings = value => Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];
const need = (condition, message) => { if (!condition) throw Error(message); };

/* ------------------------------------------------------------------ loaders */

/**
 * Read one profile file from a directory. Tries `.yaml`, `.yml`, then `.json`
 * so the same code serves authored YAML and older JSON fixtures.
 */
const readProfile = (dir, name) => {
  for (const ext of ['yaml', 'yml']) {
    const file = path.join(dir, `${name}.${ext}`);
    if (fs.existsSync(file)) return parseYaml(fs.readFileSync(file, 'utf8'));
  }
  const json = path.join(dir, `${name}.json`);
  if (fs.existsSync(json)) return JSON.parse(fs.readFileSync(json, 'utf8'));
  throw Error(`No ${name} profile in ${dir}`);
};

/**
 * Load one profile by name. When `profileDir` is given it is read directly
 * (fixtures). Otherwise the authored `modules/models/<name>.yaml` beside this
 * module is the canonical source.
 */
const load = (name, { profileDir = null } = {}) =>
  readProfile(profileDir ? path.resolve(profileDir) : moduleDir, name);

export const loadRegistry = () => load('registry');
export const loadKinds = ({ profileDir = null } = {}) => load('kinds', { profileDir });
export const loadRecords = ({ profileDir = null } = {}) => load('records', { profileDir });
export const loadHosts = ({ profileDir = null } = {}) => load('hosts', { profileDir });
export const loadRuntimes = () => load('runtimes');
export const loadRuntime = name => load(name);

/* ------------------------------------------------------------------ registry */

export const registry = loadRegistry();
export const runtimes = Object.fromEntries(
  registry.runtimes.map(name => [name, loadRuntime(name)])
);

/** Aliases (`openai`, `anthropic`, …) resolve to the canonical runtime name. */
export const normalizeRuntime = runtime => registry.aliases[runtime] ?? runtime;

export const canonicalTarget = name => registry.targetAliases?.[name] ?? name;

/* ------------------------------------------------------------------ model selection */

/**
 * Resolve the model for one operation. Selects the profile by role (working vs
 * reasoning), applies the caller's model override, and returns the full
 * execution descriptor. Pure policy: never launches, never mutates.
 */
export function resolveModel({
  runtime,
  op,
  profile,
  config = loadConfig(),
  model = config.model,
  effort = config.effort,
  language = config.language,
  imageGenerationAvailable = false,
} = {}) {
  validateConfig(config);
  const normalizedRuntime = normalizeRuntime(runtime);
  need(
    Object.hasOwn(runtimes, normalizedRuntime) &&
    typeof op === 'string' && op &&
    typeof imageGenerationAvailable === 'boolean' &&
    (model === null || (typeof model === 'string' && model.trim())),
    'Invalid runtime/profile selection'
  );

  const role = registry.reasoningOps.includes(op) ? 'reasoning' : 'working';
  const profileId = profile ?? registry.defaults[normalizedRuntime][role];
  need(
    Object.hasOwn(runtimes[normalizedRuntime].profiles, profileId),
    'Unknown or retired profile'
  );

  const selected = runtimes[normalizedRuntime].profiles[profileId];
  need(selected.role === role, 'Profile role does not own this operator');

  return {
    runtime: normalizedRuntime,
    provider: runtimes[normalizedRuntime].provider,
    profile: profileId,
    role,
    model: model ?? selected.model,
    effort,
    language,
    imageGeneration: selected.imageGeneration && imageGenerationAvailable,
    allowDeferredArtwork: ['claude', 'qwen'].includes(normalizedRuntime) && !selected.imageGeneration,
  };
}

/* ------------------------------------------------------------------ provider config */

/**
 * Return the provider/runtime configuration for one provider or runtime name.
 * `provider` may be an alias (`openai`) or the canonical runtime (`codex`).
 */
export function configFor(provider) {
  const name = normalizeRuntime(provider);
  const runtime = runtimes[name];
  need(runtime, `Unknown runtime or provider ${provider}`);
  return runtime;
}

/* ------------------------------------------------------------------ slot allocation */

/**
 * Pure slot arithmetic: returns a lease descriptor or a refusal. The caller
 * writes the lease row into the ledger; this function never mutates.
 */
export function allocateSlot({
  provider,
  model,
  ledger,
  jobId,
  now = Date.now(),
  ttlMs = 30_000,
} = {}) {
  const runtime = configFor(provider);
  const maxParallel = runtime.maxParallel ?? 1;
  const held = (ledger?.leases ?? []).filter(
    lease =>
      lease.resource_key === `ai/${runtime.provider}` &&
      lease.model === model &&
      lease.expires_at > now
  ).length;

  if (held >= maxParallel) {
    return { ok: false, reason: 'unavailable', held, maxParallel };
  }
  const token = `model:${runtime.provider}:${model}:${jobId}:${now}`;
  return {
    ok: true,
    token,
    provider: runtime.provider,
    model,
    jobId,
    acquiredAt: now,
    expiresAt: now + ttlMs,
    maxParallel,
  };
}

/**
 * Release a slot by token. The caller passes the ledger object; this function
 * mutates it in place (removes the lease row).
 */
export function releaseSlot({ ledger, token } = {}) {
  if (!ledger?.leases) return { ok: false, reason: 'no-ledger' };
  const index = ledger.leases.findIndex(lease => lease.token === token);
  if (index < 0) return { ok: false, reason: 'unknown-token' };
  ledger.leases.splice(index, 1);
  return { ok: true };
}
