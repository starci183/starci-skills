// scripts/agent/models.mjs — pool + launch-model resolution over
// modules/models/runtimes.yaml (schema starci/runtimes@1).
//
// Routing model (selection.yaml allocationFacts.poolSelection):
//   0. runtimes.yaml roleOfKind names the kind's role, work and floor; the
//      measured difficulty is raised to the floor, never lowered, and think
//      work takes the `think` order in step 1 in place of its role's order.
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
// Difficulty vocabulary: easy|medium|hard|insane. Alias spellings (s|m|l|xl,
// small|med|large, 'high' for 'hard') are accepted and normalized everywhere a
// difficulty enters, including the keys of the pools' models/effort maps.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';

const skillRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const DEFAULT_MODELS_DIR = path.join(skillRoot, 'modules', 'models');

const DIFFICULTY_ALIASES = {
  easy: 'easy', s: 'easy', small: 'easy',
  medium: 'medium', m: 'medium', med: 'medium',
  hard: 'hard', high: 'hard', l: 'hard', large: 'hard',
  insane: 'insane', xl: 'insane',
};

const DIFFICULTY_ORDER = ['easy', 'medium', 'hard', 'insane'];

// 'easy' | 'medium' | 'hard' | 'insane', or null when the spelling is unknown.
export function normalizeDifficulty(difficulty) {
  return DIFFICULTY_ALIASES[String(difficulty ?? '').trim().toLowerCase()] ?? null;
}

// The higher of a measured difficulty and a kind's floor. An unknown or absent
// floor leaves the measured difficulty as it is.
export function raiseToFloor(difficulty, floor) {
  const d = normalizeDifficulty(difficulty);
  const f = normalizeDifficulty(floor);
  if (!d || !f) return d;
  return DIFFICULTY_ORDER.indexOf(f) > DIFFICULTY_ORDER.indexOf(d) ? f : d;
}

// runtimes.yaml roleOfKind entry for one kind as {role, work, floor}. A bare
// string entry is the role alone.
export function kindRoute(kind, runtimes) {
  const entry = runtimes?.roleOfKind?.[kind];
  if (typeof entry === 'string') return { role: entry, work: null, floor: null };
  if (!entry || typeof entry !== 'object') return { role: null, work: null, floor: null };
  return { role: entry.role ?? null, work: entry.work ?? null, floor: normalizeDifficulty(entry.floor) };
}

function loadRuntimes(modelsDir = DEFAULT_MODELS_DIR) {
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
export function applyBias(chain, bias) {
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
const yamlCache = new Map();
const readYamlCached = (file) => {
  if (!yamlCache.has(file)) {
    let doc = null;
    try { doc = fs.existsSync(file) ? parseYaml(fs.readFileSync(file, 'utf8')) : null; } catch { doc = null; }
    yamlCache.set(file, doc);
  }
  return yamlCache.get(file);
};

/** The host tools op `kind` declares it cannot run without, from its manifest's route.riskHints. */
export function hostToolsRequired(kind, { opsDir = DEFAULT_OPS_DIR } = {}) {
  if (!kind || /[\\/]|\.\./.test(String(kind))) return [];
  const hints = readYamlCached(path.join(opsDir, `${kind}.yaml`))?.route?.riskHints;
  return (Array.isArray(hints) ? hints : [])
    .filter((hint) => typeof hint === 'string' && hint.startsWith(HOST_TOOL_HINT))
    .map((hint) => hint.slice(HOST_TOOL_HINT.length).trim()).filter(Boolean);
}

/** The host tools the agent behind `provider` has, from its card's capabilities.hostTools. */
export function hostToolsOf(provider, { modelsDir = DEFAULT_MODELS_DIR } = {}) {
  if (!provider || /[\\/]|\.\./.test(String(provider))) return [];
  const tools = readYamlCached(path.join(modelsDir, 'agents', `${provider}.yaml`))?.capabilities?.hostTools;
  return Array.isArray(tools) ? tools.map(String) : [];
}

/** The required host tools a pool's agent lacks for op `kind`. */
export function missingHostTools({ pool, kind, modelsDir, opsDir } = {}) {
  const have = hostToolsOf(pool?.provider, { modelsDir });
  return hostToolsRequired(kind, { opsDir }).filter((tool) => !have.includes(tool));
}

// Eligibility reasons for one pool at one difficulty. [] = eligible. The
// capacity map is caller-supplied live state: capacity[target] =
// {auth, quota:{state}, running, openIncident}; an absent entry means "no
// live signal" and passes the capacity gates (unknown is OK — dead is not).
function poolRejectionReasons({ pool, target, role, kind, difficulty, capacity, runtimes, modelsDir, opsDir }) {
  const reasons = [];
  if (!pool) return [`no runtimes.yaml entry for pool '${target}'`];
  if (role && Array.isArray(pool.roles) && pool.roles.length && !pool.roles.includes(role))
    reasons.push(`pool does not serve role '${role}'`);
  for (const tool of missingHostTools({ pool, kind, modelsDir, opsDir }))
    reasons.push(`pool agent '${pool.provider}' lacks host tool '${tool}' required by kind '${kind}' (route.riskHints host-tool-required:${tool})`);
  const lm = resolveLaunchModel(target, difficulty, { runtimes });
  if (lm.error) reasons.push(lm.error);
  const cap = capacity?.[target];
  if (cap) {
    if (cap.auth === 'dead') reasons.push(cap.authDetail
      ? `provider auth is unavailable: ${cap.authDetail}`
      : 'provider auth is unavailable');
    if (cap.quota?.state === 'dead') reasons.push('capacity quota is dead');
    const max = Number(pool.maxParallel);
    const running = Number(cap.running ?? 0);
    if (Number.isFinite(max) && Number.isFinite(running) && running >= max)
      reasons.push(`pool at capacity (${running}/${max} running)`);
    if (cap.openIncident === true) reasons.push('pool has an open incident');
  }
  return reasons;
}

// Full pool selection: kind → role and floor (roleOfKind, role overridable),
// difficulty raised to the floor, chain = tier∩role, bias, then eligibility
// per candidate (role, host tools, launch model, capacity). Returns the first
// eligible pool with its launch model, or {error} with the full rejected list.
export function selectPool({ kind, role, difficulty, bias, capacity, runtimes, modelsDir, opsDir } = {}) {
  const rt = runtimes ?? loadRuntimes(modelsDir);
  const measured = normalizeDifficulty(difficulty);
  if (!measured) return { error: `unknown difficulty '${difficulty}'` };
  const route = kindRoute(kind, rt);
  const d = raiseToFloor(measured, route.floor);
  const resolvedRole = role ?? route.role;
  if (!resolvedRole) return { error: `no role resolves for kind '${kind}'` };
  // Think work walks the tier's `think` order whatever its role; the role
  // still gates each pool below.
  const chainKey = route.work === 'think' ? 'think' : resolvedRole;
  const { chain: unbiased, tierSource } = chainFor({ role: chainKey, difficulty: d, runtimes: rt });
  const chain = applyBias(unbiased, bias);
  const rejected = [];
  for (const target of chain) {
    const pool = rt?.runtimes?.[target] ?? null;
    const reasons = poolRejectionReasons({ pool, target, role: resolvedRole, kind, difficulty: d, capacity, runtimes: rt, modelsDir, opsDir });
    if (reasons.length) { rejected.push({ target, reason: reasons[0], reasons }); continue; }
    const { modelId, effort } = resolveLaunchModel(target, d, { runtimes: rt });
    return { target: pool.target ?? target, modelId, effort, role: resolvedRole, work: route.work, difficulty: d,
      measuredDifficulty: measured, floor: route.floor, chain, tierSource, rejected };
  }
  // No capacity or health state can fix a missing host tool, so when no pool in
  // the chain could ever take the job for want of one, the refusal says which.
  const tools = hostToolsRequired(kind, { opsDir });
  const structural = chain.filter((target) => {
    const pool = rt?.runtimes?.[target];
    return pool && !(Array.isArray(pool.roles) && pool.roles.length && !pool.roles.includes(resolvedRole))
      && !resolveLaunchModel(target, d, { runtimes: rt }).error;
  });
  const toolRefusal = tools.length > 0 && structural.length > 0
    && structural.every((target) => missingHostTools({ pool: rt.runtimes[target], kind, modelsDir, opsDir }).length > 0);
  if (toolRefusal) {
    const holders = Object.entries(rt?.runtimes ?? {})
      .filter(([, pool]) => !missingHostTools({ pool, kind, modelsDir, opsDir }).length)
      .map(([target, pool]) => ({ target: pool.target ?? target, difficulties: Object.keys(difficultyKeyed(pool.models)), roles: pool.roles ?? [] }));
    const missing = [...new Set(structural.flatMap((target) => missingHostTools({ pool: rt.runtimes[target], kind, modelsDir, opsDir })))];
    return { error: `no ${resolvedRole} pool at ${d} difficulty has host tool ${(missing.length ? missing : tools).join(', ')}`,
      toolUnavailable: { tools: missing.length ? missing : tools, holders }, role: resolvedRole, work: route.work, difficulty: d,
      measuredDifficulty: measured, floor: route.floor, chain, tierSource, rejected };
  }
  return { error: `no eligible pool for role '${resolvedRole}' at ${d} difficulty`, role: resolvedRole, work: route.work, difficulty: d,
    measuredDifficulty: measured, floor: route.floor, chain, tierSource, rejected };
}
