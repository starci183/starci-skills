// scripts/agent/models.mjs — pool + launch-model resolution over
// modules/models/runtimes.yaml (schema starci/runtimes@1).
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
import { ALLOCATION_POLICIES } from '../../engine/config.mjs';
import { credentialFingerprintOf, credentialRotated } from './credential-fingerprint.mjs';

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

// runtimes.yaml roleOfKind entry for one kind as {role, work, floor, order}. A
// bare string entry is the role alone. `order` is the allocation tiers/preference
// key the kind walks when it is not the default (think for think work, else the
// role): scaffold, draw.
export function kindRoute(kind, runtimes) {
  const entry = runtimes?.roleOfKind?.[kind];
  if (typeof entry === 'string') return { role: entry, work: null, floor: null, order: null };
  if (!entry || typeof entry !== 'object') return { role: null, work: null, floor: null, order: null };
  return { role: entry.role ?? null, work: entry.work ?? null, floor: normalizeDifficulty(entry.floor),
    order: typeof entry.order === 'string' && entry.order.trim() ? entry.order.trim() : null };
}

// The fan-out order (runtimes.yaml allocation.preference.scaffold): every cut
// slice of hands-on work walks it, whatever its kind - small bounded work, Qwen
// first (owner decision 2026-09-25).
export const FAN_OUT_ORDER = 'scaffold';
// Orders a cut slice never leaves: the image tool (draw) and the review order,
// whose cross-family and overflow rules hold for every slice of a review
// (owner decision 2026-09-25 review-hands).
const PINNED_ORDERS = new Set(['draw', 'review']);

// The allocation tiers/preference key one route walks: the kind's declared
// order; a hands-on cut slice (fanOut) the fan-out order; else think for think
// work and the role otherwise. Think work never leaves the think order.
export function orderKeyOf(route, role, { fanOut = false, runtimes } = {}) {
  if (route?.work === 'think') return route.order ?? 'think';
  if (fanOut && runtimes?.allocation?.preference?.[FAN_OUT_ORDER] && !PINNED_ORDERS.has(route?.order)) return FAN_OUT_ORDER;
  return route?.order ?? role;
}

// The pools an order takes only when no other pool of it is eligible, under
// either policy (runtimes.yaml allocation.overflowByOrder; the review order's
// Opus and Sol, owner decision 2026-09-25 review-hands).
export function orderOverflowOf(runtimes, orderKey) {
  const list = runtimes?.allocation?.overflowByOrder?.[orderKey];
  return Array.isArray(list) ? list : [];
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

// The model + effort a card-composed command terminal launches with (a
// command-terminal profile with no static launch.orca.command — the Codex
// profiles). Order: the persisted `api route` decision when it names this
// target, the pool's difficulty pin, then the profile's own requestedModel for
// launch-only targets (gpt-6-sol/gpt-6-luna) that runtimes.yaml has no pool
// for. No model at all is a typed error — a Codex terminal is never launched
// on the CLI's own default model, because attestation could not prove it.
export function resolveCardLaunchModel({ target, requestedModel = null, payload = {}, runtimes, modelsDir } = {}) {
  if (payload?.modelId && (!payload.model || payload.model === target))
    return { modelId: payload.modelId, effort: payload.effort ?? null, source: 'route' };
  const pinned = resolveLaunchModel(target, payload?.difficulty ?? 'medium', { runtimes, modelsDir });
  if (pinned && !pinned.error && pinned.modelId)
    return { modelId: pinned.modelId, effort: pinned.effort ?? null, source: 'runtimes' };
  if (requestedModel) return { modelId: requestedModel, effort: payload?.effort ?? null, source: 'profile' };
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
function poolRejectionReasons({ pool, target, role, kind, difficulty, capacity, grants, runtimes, modelsDir, opsDir }) {
  const reasons = [];
  if (!pool) return [`no runtimes.yaml entry for pool '${target}'`];
  if (role && Array.isArray(pool.roles) && pool.roles.length && !pool.roles.includes(role))
    reasons.push(`pool does not serve role '${role}'`);
  // An explicit-workflow-quota pool opens only under an owner grant
  // (config.yaml allocation.grants, engine/config.mjs allocationGrants). A
  // caller that passes no grants at all is a direct low-level consumer and is
  // not gated; `api route` always passes the owner's grants.
  if (grants && pool.capacityAuthority === 'explicit-workflow-quota') {
    const grant = grants[pool.target ?? target] ?? grants[target] ?? null;
    if (!grant) reasons.push(`pool needs an owner grant (capacityAuthority explicit-workflow-quota; config.yaml allocation.grants names none for ${target})`);
    else {
      if (role && Array.isArray(grant.roles) && !grant.roles.includes(role))
        reasons.push(`owner grant ${target}=${grant.slots}@${(grant.roles ?? []).join('+')} does not cover role '${role}'`);
      const running = Number(capacity?.[target]?.running ?? 0);
      if (Number.isFinite(Number(grant.slots)) && running >= Number(grant.slots))
        reasons.push(`pool at granted capacity (${running}/${grant.slots} granted)`);
    }
  }
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

export { ALLOCATION_POLICIES };

// Balanced allocation: each pool's deficit is its owner target share minus its
// share of the recent dispatches (`recent` = {pool: count}, read from the
// ledgers by scripts/agent/balance.mjs). Target shares are normalized over the
// pools the owner named; a pool the owner gave no share targets 0. With no
// recent dispatches every actual share is 0, so the largest target (then chain
// order) wins — the same pool prefer-then-overflow would pick at equal shares.
export function balanceDeficits(pools, { shares = {}, recent = {} } = {}) {
  const shareTotal = Object.values(shares ?? {}).reduce((sum, v) => sum + (Number(v) > 0 ? Number(v) : 0), 0);
  const recentTotal = Object.values(recent ?? {}).reduce((sum, v) => sum + (Number(v) > 0 ? Number(v) : 0), 0);
  return Object.fromEntries(pools.map((pool) => {
    const target = shareTotal > 0 ? Math.max(0, Number(shares?.[pool] ?? 0)) / shareTotal : 0;
    const actual = recentTotal > 0 ? Math.max(0, Number(recent?.[pool] ?? 0)) / recentTotal : 0;
    return [pool, { target, actual, deficit: target - actual }];
  }));
}

// The audit family a pool belongs to (its provider), for the cross-family
// audit rule. The pools of runtimes.yaml allocation.frontier (the think order
// when it is absent) and allocation.hands have one: Opus and Sol, Devin and
// Qwen (owner decision 2026-09-25 review-hands - the hands review each other).
export function auditFamilyOf(rt, target) {
  const frontier = rt?.allocation?.frontier ?? rt?.allocation?.preference?.think ?? [];
  const hands = Array.isArray(rt?.allocation?.hands) ? rt.allocation.hands : [];
  if (!frontier.includes(target) && !hands.includes(target)) return null;
  return rt?.runtimes?.[target]?.provider ?? target;
}

// Full pool selection: kind → role, floor and order key (roleOfKind, role
// overridable; orderKeyOf), difficulty raised to the floor, chain = tier∩order,
// bias, then eligibility per candidate (role, owner grant, host tools, launch
// model, capacity).
//   policy prefer-then-overflow (runtimes.yaml default): the first eligible
//     pool of the biased chain.
//   policy balanced (config.yaml allocation.policy): the chain order ranks and
//     the share caps - the FIRST eligible pool of the chain still below its
//     target share (balanceDeficits deficit > 0) takes it; when every eligible
//     pool is at or over its share, the one furthest below (least over) does,
//     the chain order then `prefer` breaking ties. `avoid` still removes, and a
//     pool runtimes.yaml allocation.balanced.overflowOnly lists for the work
//     class is taken only when no other pool is eligible.
//   fanOut (a hands-on cut slice, payload.cut): the fan-out order (scaffold),
//     except for a kind pinned to draw or review.
//   Cross-family audit (runtimes.yaml allocation.thinkAuditCrossFamily): a
//     verify kind auditing another op's output (`auditOf` = the author's
//     pool) goes to an eligible pool of another audit family (auditFamilyOf:
//     frontier or hands) when one exists, under either policy - Qwen reviews
//     Devin's work and Devin Qwen's.
//   Order overflow (runtimes.yaml allocation.overflowByOrder): a pool the
//     order lists there is taken only when no other candidate is eligible,
//     under either policy - the review order's Opus and Sol.
//   Retry lineage (`lineage` = scripts/kernel/lineage-route.mjs
//     lineageRouteAdjust): a pool this job's earlier attempts failed on once
//     for a pool-attributable cause moves to the end of the order and is taken
//     only when no other candidate is eligible (demote); one they failed on
//     twice is rejected for this retry (exclude).
// Returns the chosen pool with its launch model, or {error} with the full
// rejected list.
export function selectPool({ kind, role, difficulty, bias, capacity, runtimes, modelsDir, opsDir,
  policy, shares, recent, grants, auditOf, fanOut = false, lineage = null } = {}) {
  const rt = runtimes ?? loadRuntimes(modelsDir);
  const measured = normalizeDifficulty(difficulty);
  if (!measured) return { error: `unknown difficulty '${difficulty}'` };
  const route = kindRoute(kind, rt);
  const d = raiseToFloor(measured, route.floor);
  const resolvedRole = role ?? route.role;
  if (!resolvedRole) return { error: `no role resolves for kind '${kind}'` };
  const allocationPolicy = ALLOCATION_POLICIES.includes(policy) ? policy
    : (ALLOCATION_POLICIES.includes(rt?.allocation?.policy) ? rt.allocation.policy : 'prefer-then-overflow');
  const balanced = allocationPolicy === 'balanced';
  // The kind's declared order, else think work the tier's `think` order whatever
  // its role, else the role's order; the role still gates each pool below.
  const chainKey = orderKeyOf(route, resolvedRole, { fanOut, runtimes: rt });
  const { chain: unbiased, tierSource } = chainFor({ role: chainKey, difficulty: d, runtimes: rt });
  // Balanced keeps the tier order and lets `prefer` only break deficit ties;
  // `avoid` removes under both policies.
  const biased = balanced ? applyBias(unbiased, { avoid: bias?.avoid ?? [] }) : applyBias(unbiased, bias);
  const demote = (lineage?.demote ?? []).filter(Boolean), exclude = (lineage?.exclude ?? []).filter(Boolean);
  const chain = [...biased.filter((t) => !demote.includes(t)), ...biased.filter((t) => demote.includes(t))];
  const rejected = [];
  const eligible = [];
  // The order's overflow pools (overflowByOrder) never stop the scan: a later
  // primary pool still outranks them, whatever a prefer bias hoisted.
  const overflow = orderOverflowOf(rt, chainKey);
  for (const target of chain) {
    const pool = rt?.runtimes?.[target] ?? null;
    if (exclude.includes(target)) {
      const seen = lineage?.pools?.[target];
      const reason = `excluded for this retry lineage: failed ${seen?.failures ?? 'twice'}x on it${seen?.causes?.length ? ` (${seen.causes.join(', ')})` : ''}`;
      rejected.push({ target, reason, reasons: [reason] });
      continue;
    }
    const reasons = poolRejectionReasons({ pool, target, role: resolvedRole, kind, difficulty: d, capacity, grants, runtimes: rt, modelsDir, opsDir });
    if (reasons.length) { rejected.push({ target, reason: reasons[0], reasons }); continue; }
    eligible.push(target);
    // prefer-then-overflow stops at the first eligible pool
    if (!balanced && !auditOf && !overflow.includes(target)) break;
  }
  if (eligible.length) {
    let candidates = eligible;
    let crossFamily = null;
    const authorFamily = auditOf && resolvedRole === 'verify'
      && rt?.allocation?.thinkAuditCrossFamily !== false ? auditFamilyOf(rt, auditOf) : null;
    if (authorFamily) {
      const other = candidates.filter((t) => { const f = auditFamilyOf(rt, t); return f && f !== authorFamily; });
      crossFamily = { author: auditOf, authorFamily, applied: other.length > 0 };
      if (other.length) candidates = other;
    }
    // An order's overflow pools take the job only when no other candidate is eligible, under either policy.
    let overflowUsed = false;
    if (overflow.length) {
      const primary = candidates.filter((t) => !overflow.includes(t));
      if (primary.length) candidates = primary;
      else overflowUsed = true;
    }
    // A pool the retry lineage failed on once is taken only when no other candidate is eligible.
    if (demote.length) {
      const primary = candidates.filter((t) => !demote.includes(t));
      if (primary.length) candidates = primary;
    }
    let balance = null;
    let target;
    if (balanced) {
      const workClass = route.work ?? 'hands-on';
      // overflowOnly.<work class> is a list for every tier, or a map keyed by difficulty tier.
      const declared = rt?.allocation?.balanced?.overflowOnly?.[workClass];
      const overflowOnly = (Array.isArray(declared) ? declared : declared?.[d]) ?? [];
      const primary = candidates.filter((t) => !overflowOnly.includes(t));
      if (primary.length) candidates = primary;
      const deficits = balanceDeficits(candidates, { shares, recent });
      const preferred = new Set((bias?.prefer ?? []).filter(Boolean));
      const EPS = 1e-9;
      // The order ranks, the share caps: the first candidate still below its share takes it.
      const underShare = candidates.find((t) => deficits[t].deficit > EPS) ?? null;
      target = underShare ?? candidates.reduce((best, t) => {
        if (best === null) return t;
        const diff = deficits[t].deficit - deficits[best].deficit;
        if (diff > EPS) return t;
        if (Math.abs(diff) <= EPS && preferred.has(t) && !preferred.has(best)) return t;
        return best;
      }, null);
      balance = { candidates, deficits, rule: underShare ? 'first-under-share' : 'least-over' };
    } else {
      target = candidates[0];
    }
    // prefer-then-overflow reports only the pools passed over before the pick.
    const shownRejected = balanced ? rejected
      : rejected.filter((r) => chain.indexOf(r.target) < chain.indexOf(target));
    const pool = rt.runtimes[target];
    const { modelId, effort } = resolveLaunchModel(target, d, { runtimes: rt });
    return { target: pool.target ?? target, modelId, effort, role: resolvedRole, work: route.work, difficulty: d,
      measuredDifficulty: measured, floor: route.floor, order: chainKey, chain, tierSource, rejected: shownRejected, policy: allocationPolicy,
      ...(balance ? { balance } : {}), ...(crossFamily ? { crossFamily } : {}),
      ...(overflow.length ? { overflow: { pools: overflow, used: overflowUsed } } : {}),
      ...(lineage ? { lineage: { demoted: demote, excluded: exclude, demotedTaken: demote.includes(target) } } : {}) };
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

// Provider availability for a quota-aware group (the kernel think group and the
// config.yaml kernel group). One provider credential is one availability fact:
//   unavailable — the kernel's provider-health circuit is open, or the quota
//                 probe reads 'dead' (not authenticated / no account);
//   limited     — the probe reads 'limited' (near the window cap, or a
//                 refreshable stale token): still launchable, ordered last;
//   available   — 'ok' or 'unknown' (an unanswered probe never blocks).
export const PROVIDER_HEALTH_SCOPE = 'provider-health';
const providerKey = (provider) => String(provider ?? '').trim().toLowerCase().replace(/-agent$/, '');

// The OPEN provider-health circuit for a provider in one ledger, or null.
// An auth circuit that recorded the fingerprint of the credential it rejected
// (scripts/agent/credential-fingerprint.mjs) is CLOSED once the credential in
// effect has a different fingerprint: the rejected credential was rotated
// away. `credential` is the current {fingerprint} (or a function returning
// it, called only when the comparison is needed); by default it is resolved
// from the agent card, which for an Orca-managed provider without an account
// list stays unresolved and keeps the circuit. Nothing else closes a circuit
// early but `api provider-health --recover`.
export function providerCircuitOf(db, provider, now = Date.now(), { credential } = {}) {
  const key = providerKey(provider);
  if (!key || !db) return null;
  const row = db.prepare('SELECT value_json,at,expires_at FROM signals WHERE scope=? AND key=?').get(PROVIDER_HEALTH_SCOPE, key);
  if (!row || (row.expires_at != null && row.expires_at <= now)) return null;
  let value = {};
  try { value = JSON.parse(row.value_json || '{}') ?? {}; } catch { value = {}; }
  if (value?.status !== 'unavailable') return null;
  if (value.failureKind === 'auth' && value.credentialFingerprint) {
    let current = null;
    try {
      current = typeof credential === 'function' ? credential(key)
        : credential !== undefined ? credential : credentialFingerprintOf(key);
    } catch { current = null; }
    if (credentialRotated(value, current)) return null;
  }
  return { ...value, at: row.at, expiresAt: row.expires_at };
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
