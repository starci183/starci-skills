// scripts/agent/models.mjs - kind routes, host tools, launch-model resolution and provider health over
// modules/models/runtimes.yaml (operational policy) and modules/models/registry.yaml (the model catalog).
// Which model takes which work is modules/models/tiers.yaml (scripts/agent/tiers.mjs, op-pick.mjs).
//
// Difficulty vocabulary: easy|medium|hard|insane, and nothing else; any other spelling is unknown and refused
// where a difficulty enters.

import { readYamlFile } from '../lib/read-yaml.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { credentialFingerprintOf, credentialRotated } from './credential-fingerprint.mjs';
import { readProviderCircuit } from '../machine/provider-circuit.mjs';
import { DEFAULT_MODELS_DIR, loadModelRegistry, loadRuntimes } from './model-registry.mjs';

export { loadModelRegistry, loadRuntimes };
export { defaultOperationTarget } from './model-registry.mjs';
import { normalizeProvider } from '../lib/provider.mjs';

const skillRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

const DIFFICULTY_ORDER = ['easy', 'medium', 'hard', 'insane'];

// 'easy' | 'medium' | 'hard' | 'insane', or null when the spelling is unknown.
export function normalizeDifficulty(difficulty) {
  return DIFFICULTY_ORDER.includes(difficulty) ? difficulty : null;
}

// The higher of a measured difficulty and a kind's floor. An unknown or absent
// floor leaves the measured difficulty as it is.
export function raiseToFloor(difficulty, floor) {
  const d = normalizeDifficulty(difficulty);
  const f = normalizeDifficulty(floor);
  if (!d || !f) return d;
  return DIFFICULTY_ORDER.indexOf(f) > DIFFICULTY_ORDER.indexOf(d) ? f : d;
}

// runtimes.yaml roleOfKind entry for one kind as {role, work, floor}.
export function kindRoute(kind, runtimes) {
  const entry = runtimes?.roleOfKind?.[kind];
  if (!entry || typeof entry !== 'object') return { role: null, work: null, floor: null };
  return { role: entry.role ?? null, work: entry.work ?? null, floor: normalizeDifficulty(entry.floor) };
}

// The model + effort a worker launches with (worker-start --model/--effort): the persisted `starci kernel route`
// decision when it names this target, else the registry default model - the launch-only targets'
// `targets.<t>.defaultModel` (gpt-6.1-sol/gpt-6-luna/cursor-agent hold no pool) and the pool's `pools.<p>.defaultModel`.
// No model at all is a typed error - a worker is never started on the CLI's own default model, because attestation
// could not prove it.
export function resolveWorkerLaunchModel({ target, payload = {}, runtimes, modelsDir } = {}) {
  if (payload?.modelId && (!payload.model || payload.model === target))
    return { modelId: payload.modelId, effort: payload.effort ?? null, source: 'route' };
  const rt = runtimes ?? loadRuntimes(modelsDir);
  const fallback = rt?.runtimes?.[target]?.defaultModel ?? loadModelRegistry(modelsDir)?.targets?.[target]?.defaultModel ?? null;
  if (fallback) return { modelId: fallback, effort: payload?.effort ?? null, source: 'registry' };
  return { error: `no launch model for ${target}` };
}

// Host tools. An op that cannot run without a tool of the agent's host says so
// as data: `route.riskHints: [host-tool-required:<tool>]` on its manifest. An
// agent says which host tools it has as data: `capabilities.hostTools` on its
// card (modules/models/agents/<provider>.yaml). A pool whose agent lacks a
// required tool is ineligible — tier order and prefer-bias never hoist it.
const HOST_TOOL_HINT = 'host-tool-required:';
const DEFAULT_OPS_DIR = path.join(skillRoot, 'modules', 'ops', 'ops');


/** The host tools op `kind` declares it cannot run without, from its manifest's route.riskHints. */
export function hostToolsRequired(kind, { opsDir = DEFAULT_OPS_DIR } = {}) {
  if (!kind || /[\\/]|\.\./.test(String(kind))) return [];
  const hints = readYamlFile(path.join(opsDir, `${kind}.yaml`))?.route?.riskHints;
  return (Array.isArray(hints) ? hints : [])
    .filter((hint) => typeof hint === 'string' && hint.startsWith(HOST_TOOL_HINT))
    .map((hint) => hint.slice(HOST_TOOL_HINT.length).trim()).filter(Boolean);
}

/** The host tools the agent behind `provider` has, from its card's capabilities.hostTools. */
export function hostToolsOf(provider, { modelsDir = DEFAULT_MODELS_DIR } = {}) {
  if (!provider || /[\\/]|\.\./.test(String(provider))) return [];
  const tools = readYamlFile(path.join(modelsDir, 'agents', `${provider}.yaml`))?.capabilities?.hostTools;
  return Array.isArray(tools) ? tools.map(String) : [];
}

/** The required host tools a pool's agent lacks for op `kind`. */
export function missingHostTools({ pool, kind, modelsDir, opsDir } = {}) {
  const have = hostToolsOf(pool?.provider, { modelsDir });
  return hostToolsRequired(kind, { opsDir }).filter((tool) => !have.includes(tool));
}

// Health ordering hints precede the separate common-admission evidence gate.

// The OPEN provider-health circuit for a provider in one ledger, or null.
// An auth circuit that recorded the fingerprint of the credential it rejected
// (scripts/agent/credential-fingerprint.mjs) is CLOSED once the credential in
// effect has a different fingerprint: the rejected credential was rotated
// away. `credential` is the current {fingerprint} (or a function returning
// it, called only when the comparison is needed); by default it is resolved
// from the agent card, which for an Orca-managed provider without an account
// list stays unresolved and keeps the circuit. Nothing else closes a circuit
// early but `starci kernel provider-health --recover`.
// The circuit is machine.sqlite provider_health (scripts/machine/provider-circuit.mjs): one worker-wide fact per provider;
// `db` (a ledger) is not read and stays in the signature for its callers.
export function providerCircuitOf(db, provider, now = Date.now(), { credential, readCircuit = readProviderCircuit } = {}) {
  const key = normalizeProvider(provider);
  if (!key) return null;
  const row = readCircuit(key);
  if (!row || (row.expiresAt != null && row.expiresAt <= now)) return null;
  const value = row.value;
  if (value?.status !== 'unavailable') return null;
  if (value.failureKind === 'auth' && value.credentialFingerprint) {
    let current = null;
    try {
      if (typeof credential === 'function') current = credential(key);
      else if (credential !== undefined) current = credential;
      else current = credentialFingerprintOf(key);
    } catch { current = null; }
    if (credentialRotated(value, current)) return null;
  }
  return { ...value, at: row.at, expiresAt: row.expiresAt };
}

export function providerAvailability({ probe = null, circuit = null } = {}) {
  if (circuit) return { state: 'unavailable', reason: `provider circuit open (${circuit.failureKind ?? 'auth'}) until ${circuit.expiresAt ? new Date(circuit.expiresAt).toISOString() : 'explicit recovery'}` };
  if (probe?.state === 'dead') return { state: 'unavailable', reason: `quota probe dead (${probe.detail ?? 'not authenticated'})` };
  if (probe?.state === 'limited') return { state: 'limited', reason: `quota limited (${probe.detail ?? 'near the window cap'})` };
  return { state: 'available', reason: `quota ${probe?.state ?? 'unknown'}` };
}
