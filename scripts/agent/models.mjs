// scripts/agent/models.mjs — pool + launch-model resolution over
// modules/models/runtimes.yaml (operational policy) + modules/models/registry.yaml
// (`pools`, the ONE model catalog — schema starci/profile-registry@1).
//
// Routing model (selection.yaml allocationFacts.poolSelection):
//   0. runtimes.yaml roleOfKind names the kind's role, work, floor and order;
//      the measured difficulty is raised to the floor, never lowered, and the
//      kind walks its declared `order` key in step 1 (scaffold, draw), else
//      `think` for think work, else its role's order. A hands-on cut slice
//      (fanOut) walks the fan-out order (scaffold).
//   1. chain(role, difficulty) = pools present in BOTH the difficulty tier
//      (allocation.tiers[difficulty], role key first then the tier default)
//      AND the per-role order (allocation.preference[role]). Tier position is
//      the outer sort; role preference breaks ties.
//   2. Resolve each declared pool's difficulty pin to a concrete provider/model.
//   3. Existing role, host-tool, grant and retry gates precede common new admission.
//      Live selection requires fresh identity-bound quota, the model floor and known slots.
//   4. Owner constraints and real pressure rank only eligible candidates; the launch model stays explicit.
//
// Difficulty vocabulary: easy|medium|hard|insane, and nothing else; any other
// spelling is unknown and refused where a difficulty enters.

import { readYamlFile } from '../lib/read-yaml.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALLOCATION_POLICIES } from '../../engine/config.mjs';
import { credentialFingerprintOf, credentialRotated } from './credential-fingerprint.mjs';
import { readProviderCircuit } from '../machine/provider-circuit.mjs';
import { poolCapsNow } from '../machine/pool-backoff.mjs';
import { DEFAULT_MODELS_DIR, loadModelRegistry, loadRuntimes } from './model-registry.mjs';
import { selectPool as selectPoolPolicy } from './pool-selection.mjs';

export { loadModelRegistry, loadRuntimes };
export { defaultOperationTarget } from './model-registry.mjs';
import { normalizeProvider } from '../lib/provider.mjs';
import { selectPoolAdmission } from './pool-admission.mjs';

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

// runtimes.yaml roleOfKind entry for one kind as {role, work, floor, order}. A
// bare string entry is the role alone. `order` is the allocation tiers/preference
// key the kind walks when it is not the default (think for think work, else the
// role): scaffold, draw, asset, brand, ui, implement, review, sol-think.
export function kindRoute(kind, runtimes) {
  const entry = runtimes?.roleOfKind?.[kind];
  if (!entry || typeof entry !== 'object') return { role: null, work: null, floor: null, order: null };
  return { role: entry.role ?? null, work: entry.work ?? null, floor: normalizeDifficulty(entry.floor),
    order: typeof entry.order === 'string' && entry.order.trim() ? entry.order.trim() : null };
}

// The fan-out order (runtimes.yaml allocation.preference.scaffold): every cut
// slice of hands-on work walks it, whatever its kind - small bounded work, Devin
// first (owner decision 2026-09-25).
const FAN_OUT_ORDER = 'scaffold';
// A job payload that is one cut slice of a fan-out (payload.cut, ordinal of total >= 2).
export const isFanOutSlice = (payload) => Boolean(payload?.cut && Number(payload.cut.total) >= 2);
// Orders a cut slice never leaves: the drawing (draw) and the image tool (asset), the review order,
// whose cross-family and overflow rules hold for every slice of a review
// (owner decision 2026-09-25 review-hands), and the ui order, whose host-tool
// gates (browser-dom) hold for every slice of a UI verification (owner routing
// 2026-09-26).
const PINNED_ORDERS = new Set(['draw', 'asset', 'review', 'ui']);

// The allocation tiers/preference key one route walks: the kind's declared
// order; a hands-on cut slice (fanOut) the fan-out order; else think for think
// work and the role otherwise. A declared order carries think work off the
// think order (owner routing 2026-09-26: the ui, implement and sol-think
// orders); undeclared think work stays on think.
export function orderKeyOf(route, role, { fanOut = false, runtimes } = {}) {
  if (route?.work === 'think') return route.order ?? 'think';
  if (fanOut && runtimes?.allocation?.preference?.[FAN_OUT_ORDER] && !PINNED_ORDERS.has(route?.order)) return FAN_OUT_ORDER;
  return route?.order ?? role;
}

// The pools one kind may run on at a measured difficulty: its order (orderKeyOf) at the
// floor-raised tier. selectPool routes inside it and starci kernel dispatch launches only inside it.
export function kindOrder({ kind, role, difficulty, fanOut = false, runtimes, modelsDir } = {}) {
  const rt = runtimes ?? loadRuntimes(modelsDir);
  const measured = normalizeDifficulty(difficulty);
  if (!measured) return { error: `unknown difficulty '${difficulty}'` };
  const route = kindRoute(kind, rt);
  const d = raiseToFloor(measured, route.floor);
  const resolvedRole = role ?? route.role;
  if (!resolvedRole) return { error: `no role resolves for kind '${kind}'` };
  const orderKey = orderKeyOf(route, resolvedRole, { fanOut, runtimes: rt });
  const { chain, tierSource } = chainFor({ role: orderKey, difficulty: d, runtimes: rt });
  return { rt, route, role: resolvedRole, measured, difficulty: d, orderKey, chain, tierSource };
}

// The pools an order takes only when no other pool of it is eligible, under
// either policy (runtimes.yaml allocation.overflowByOrder; the review order's
// Opus and Sol, owner decision 2026-09-25 review-hands).
function orderOverflowOf(runtimes, orderKey) {
  const list = runtimes?.allocation?.overflowByOrder?.[orderKey];
  return Array.isArray(list) ? list : [];
}

// The model a pool launches for one difficulty. A missing pin is a typed
// error (the pool is ineligible at that difficulty) — never a fallback to a
// neighbouring tier's model.
export function resolveLaunchModel(target, difficulty, opts = {}) {
  const d = normalizeDifficulty(difficulty);
  if (!d) return { error: `unknown difficulty '${difficulty}'` };
  const runtimes = opts.runtimes ?? loadRuntimes(opts.modelsDir);
  const pool = runtimes?.runtimes?.[target];
  if (!pool) return { error: `no registry.yaml pool '${target}'` };
  const modelId = pool.models?.[d];
  if (!modelId) return { error: `pool '${target}' has no ${d} model` };
  return { target: pool.target ?? target, modelId, effort: pool.effort?.[d] ?? null };
}

// The model + effort a worker launches with (worker-start --model/--effort). Order: the persisted `starci kernel route`
// decision when it names this target, the pool's difficulty pin, then the registry default model — the
// launch-only targets' `targets.<t>.defaultModel` (gpt-6.1-sol/gpt-6-luna/cursor-agent hold no pool) and the
// pool's `pools.<p>.defaultModel` at a difficulty its models map does not pin. No model at all is a typed
// error - a worker is never started on the CLI's own default model, because attestation could not prove it.
export function resolveWorkerLaunchModel({ target, payload = {}, runtimes, modelsDir } = {}) {
  if (payload?.modelId && (!payload.model || payload.model === target))
    return { modelId: payload.modelId, effort: payload.effort ?? null, source: 'route' };
  const rt = runtimes ?? loadRuntimes(modelsDir);
  const pinned = resolveLaunchModel(target, payload?.difficulty ?? 'medium', { runtimes: rt });
  if (pinned && !pinned.error && pinned.modelId)
    return { modelId: pinned.modelId, effort: pinned.effort ?? null, source: 'runtimes' };
  const fallback = rt?.runtimes?.[target]?.defaultModel ?? loadModelRegistry(modelsDir)?.targets?.[target]?.defaultModel ?? null;
  if (fallback) return { modelId: fallback, effort: payload?.effort ?? null, source: 'registry' };
  return { error: pinned?.error ?? `no launch model for ${target}` };
}

// chain(role, difficulty) — tier ∩ role order. Returns {chain, tierOrder,
// roleOrder, tierSource}; an unknown difficulty or absent tier yields chain:[].
export function chainFor({ role, difficulty, runtimes, modelsDir } = {}) {
  const rt = runtimes ?? loadRuntimes(modelsDir);
  const d = normalizeDifficulty(difficulty);
  if (!d) return { chain: [], tierOrder: [], roleOrder: [], error: `unknown difficulty '${difficulty}'` };
  const tiers = rt?.allocation?.tiers ?? {};
  const tier = tiers[d]; // tier keys are the canonical difficulty vocabulary
  const at = `runtimes.yaml allocation.tiers.${d}`;
  let tierOrder, tierSource;
  if (Array.isArray(tier)) { tierOrder = tier; tierSource = at; }
  else if (tier && typeof tier === 'object' && role && Array.isArray(tier[role])) {
    tierOrder = tier[role]; tierSource = `${at}.${role}`;
  } else if (tier && typeof tier === 'object') {
    tierOrder = Array.isArray(tier.default) ? tier.default : []; tierSource = `${at}.default`;
  } else { tierOrder = []; tierSource = `${at} (missing)`; }
  const roleOrder = (role && rt?.allocation?.preference?.[role]) || [];
  // Intersection, tier position outer sort, role position tie-break.
  const chain = tierOrder
    .filter(p => roleOrder.includes(p))
    .sort((a, b) => tierOrder.indexOf(a) - tierOrder.indexOf(b) || roleOrder.indexOf(a) - roleOrder.indexOf(b));
  return { chain, tierOrder, roleOrder, tierSource };
}

// {prefer:[pools], avoid:[pools]} — prefer hoists to the front preserving the
// chain's relative order; avoid removes. Pure permutation/filter of the chain:
// eligibility is evaluated afterwards and is untouched by bias.
function applyBias(chain, bias) {
  const prefer = new Set((bias?.prefer ?? []).filter(Boolean));
  const avoid = new Set((bias?.avoid ?? []).filter(Boolean));
  const kept = (chain ?? []).filter(p => !avoid.has(p));
  return [...kept.filter(p => prefer.has(p)), ...kept.filter(p => !prefer.has(p))];
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

export { ALLOCATION_POLICIES };

// Balanced allocation: each pool's deficit is its owner target share minus its
// share of the recent dispatches (`recent` = {pool: count}, read from the
// ledgers by scripts/agent/balance.mjs). Target shares are normalized over the
// pools the owner named; a pool the owner gave no share targets 0. With no
// recent dispatches every actual share is 0, so the largest target (then chain
// order) wins — the same pool prefer-then-overflow would pick at equal shares.
export function balanceDeficits(pools, { shares = {}, recent = {} } = {}) {
  const shareTotal = Object.values(shares ?? {}).reduce((sum, v) => sum + Math.max(0, Number(v) || 0), 0);
  const recentTotal = Object.values(recent ?? {}).reduce((sum, v) => sum + Math.max(0, Number(v) || 0), 0);
  return Object.fromEntries(pools.map((pool) => {
    const target = shareTotal > 0 ? Math.max(0, Number(shares?.[pool] ?? 0)) / shareTotal : 0;
    const actual = recentTotal > 0 ? Math.max(0, Number(recent?.[pool] ?? 0)) / recentTotal : 0;
    return [pool, { target, actual, deficit: target - actual }];
  }));
}

export function selectPool(input = {}) {
  return selectPoolPolicy(input, { allocationPolicies: ALLOCATION_POLICIES, poolCapsNow, kindOrder, applyBias,
    orderOverflowOf, resolveLaunchModel, missingHostTools, hostToolsRequired, selectPoolAdmission, balanceDeficits });
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

// Members in declared order with unavailable ones removed and limited ones
// moved behind every available one; relative order is otherwise kept.
export function orderByAvailability(members, availabilityOf) {
  const rank = { available: 0, limited: 1 };
  const seen = members.map((member, index) => ({ member, index, availability: availabilityOf(member) }));
  const ordered = seen.filter(s => s.availability?.state !== 'unavailable')
    .sort((a, b) => (rank[a.availability?.state] ?? 0) - (rank[b.availability?.state] ?? 0) || a.index - b.index);
  return {
    ordered: ordered.map(s => ({ ...s.member, availability: s.availability })),
    unavailable: seen.filter(s => s.availability?.state === 'unavailable').map(s => ({ ...s.member, availability: s.availability })),
  };
}
