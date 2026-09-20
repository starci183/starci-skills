// scripts/agent/models.mjs — pool + launch-model resolution over
// modules/models/runtimes.yaml (schema starci/runtimes@1).
//
// Routing model (selection.yaml allocationFacts.poolSelection):
//   1. chain(role, difficulty) = pools present in BOTH the difficulty tier
//      (allocation.tiers[difficulty], role key first then the tier default)
//      AND the per-role order (allocation.preference[role]). Tier position is
//      the outer sort; role preference breaks ties.
//   2. bias {prefer, avoid} then reorders the chain: prefer hoists named pools
//      to the front preserving relative order, avoid removes them. Bias never
//      bypasses eligibility.
//   3. Per candidate: role covered (roles[]), models[difficulty] exists,
//      capacity auth/quota not 'dead' (unknown/limited OK), running <
//      maxParallel, no open incident. Every skipped pool lands in rejected[]
//      with its typed reason — a miss is an exclusion, never a silent swap.
//   4. The launch model is the pool's models[difficulty] pin (+ effort).
//
// Difficulty vocabulary: easy|medium|hard|insane. Legacy S|M|L|XL spellings
// (and 'high' for 'hard') are accepted and normalized everywhere a difficulty
// enters, including the keys of the pools' models/effort maps.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';

const skillRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const DEFAULT_MODELS_DIR = path.join(skillRoot, 'modules', 'models');

export const DIFFICULTIES = ['easy', 'medium', 'hard', 'insane'];

const DIFFICULTY_ALIASES = {
  easy: 'easy', s: 'easy', small: 'easy',
  medium: 'medium', m: 'medium', med: 'medium',
  hard: 'hard', high: 'hard', l: 'hard', large: 'hard',
  insane: 'insane', xl: 'insane',
};

// 'easy' | 'medium' | 'hard' | 'insane', or null when the spelling is unknown.
export function normalizeDifficulty(difficulty) {
  return DIFFICULTY_ALIASES[String(difficulty ?? '').trim().toLowerCase()] ?? null;
}

export function loadRuntimes(modelsDir = DEFAULT_MODELS_DIR) {
  const file = path.join(modelsDir, 'runtimes.yaml');
  if (!fs.existsSync(file)) return null;
  return parseYaml(fs.readFileSync(file, 'utf8'));
}

// Re-key a models/effort map by normalized difficulty so 'high'/'L' spellings
// in data read exactly like the canonical keys.
function difficultyKeyed(map) {
  const out = {};
  for (const [k, v] of Object.entries(map ?? {})) {
    const d = normalizeDifficulty(k);
    if (d) out[d] = v;
  }
  return out;
}

// The model a pool launches for one difficulty. A missing pin is a typed
// error (the pool is ineligible at that difficulty) — never a fallback to a
// neighbouring tier's model.
export function resolveLaunchModel(target, difficulty, opts = {}) {
  const d = normalizeDifficulty(difficulty);
  if (!d) return { error: `unknown difficulty '${difficulty}'` };
  const runtimes = opts.runtimes ?? loadRuntimes(opts.modelsDir);
  const pool = runtimes?.runtimes?.[target];
  if (!pool) return { error: `no runtimes.yaml pool '${target}'` };
  const modelId = difficultyKeyed(pool.models)[d];
  if (!modelId) return { error: `pool '${target}' has no ${d} model` };
  return { target: pool.target ?? target, modelId, effort: difficultyKeyed(pool.effort)[d] ?? null };
}

// chain(role, difficulty) — tier ∩ role order. Returns {chain, tierOrder,
// roleOrder, tierSource}; an unknown difficulty or absent tier yields chain:[].
export function chainFor({ role, difficulty, runtimes, modelsDir } = {}) {
  const rt = runtimes ?? loadRuntimes(modelsDir);
  const d = normalizeDifficulty(difficulty);
  if (!d) return { chain: [], tierOrder: [], roleOrder: [], error: `unknown difficulty '${difficulty}'` };
  const tiers = rt?.allocation?.tiers ?? {};
  const tier = tiers[d] ?? tiers[difficulty]; // raw-key fallback for alias-spelled tier names
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
export function applyBias(chain, bias) {
  const prefer = new Set((bias?.prefer ?? []).filter(Boolean));
  const avoid = new Set((bias?.avoid ?? []).filter(Boolean));
  const kept = (chain ?? []).filter(p => !avoid.has(p));
  return [...kept.filter(p => prefer.has(p)), ...kept.filter(p => !prefer.has(p))];
}

// Eligibility reasons for one pool at one difficulty. [] = eligible. The
// capacity map is caller-supplied live state: capacity[target] =
// {auth, quota:{state}, running, openIncident}; an absent entry means "no
// live signal" and passes the capacity gates (unknown is OK — dead is not).
export function poolRejectionReasons({ pool, target, role, difficulty, capacity, runtimes }) {
  const reasons = [];
  if (!pool) return [`no runtimes.yaml entry for pool '${target}'`];
  if (role && Array.isArray(pool.roles) && pool.roles.length && !pool.roles.includes(role))
    reasons.push(`pool does not serve role '${role}'`);
  const lm = resolveLaunchModel(target, difficulty, { runtimes });
  if (lm.error) reasons.push(lm.error);
  const cap = capacity?.[target];
  if (cap) {
    if (cap.auth === 'dead') reasons.push('capacity auth is dead');
    if (cap.quota?.state === 'dead') reasons.push('capacity quota is dead');
    const max = Number(pool.maxParallel);
    const running = Number(cap.running ?? 0);
    if (Number.isFinite(max) && Number.isFinite(running) && running >= max)
      reasons.push(`pool at capacity (${running}/${max} running)`);
    if (cap.openIncident === true) reasons.push('pool has an open incident');
  }
  return reasons;
}

// Full pool selection: kind → role (roleOfKind, overridable), chain =
// tier∩role, bias, then eligibility per candidate. Returns the first eligible
// pool with its launch model, or {error} with the full rejected list.
export function selectPool({ kind, role, difficulty, bias, capacity, runtimes, modelsDir } = {}) {
  const rt = runtimes ?? loadRuntimes(modelsDir);
  const d = normalizeDifficulty(difficulty);
  if (!d) return { error: `unknown difficulty '${difficulty}'` };
  const resolvedRole = role ?? rt?.roleOfKind?.[kind] ?? null;
  if (!resolvedRole) return { error: `no role resolves for kind '${kind}'` };
  const { chain: unbiased, tierSource } = chainFor({ role: resolvedRole, difficulty: d, runtimes: rt });
  const chain = applyBias(unbiased, bias);
  const rejected = [];
  for (const target of chain) {
    const pool = rt?.runtimes?.[target] ?? null;
    const reasons = poolRejectionReasons({ pool, target, role: resolvedRole, difficulty: d, capacity, runtimes: rt });
    if (reasons.length) { rejected.push({ target, reason: reasons[0], reasons }); continue; }
    const { modelId, effort } = resolveLaunchModel(target, d, { runtimes: rt });
    return { target: pool.target ?? target, modelId, effort, role: resolvedRole, difficulty: d, chain, tierSource, rejected };
  }
  return { error: `no eligible pool for role '${resolvedRole}' at ${d} difficulty`, role: resolvedRole, difficulty: d, chain, tierSource, rejected };
}
