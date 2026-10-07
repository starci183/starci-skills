// The operation router: one tier pick for one op (modules/models/tiers.yaml owns the chains). The structural gates
// (role, host tool, owner grant, retry lineage, provider circuit) are the picker's hard filter; owner bias, balance and
// token use are its later steps (scripts/lib/tier-pick.mjs through scripts/lib/agent-admission.mjs selectAdmission).
import { adapterModelAuthority, loadAdapter, loadModelRegistry } from './model-registry.mjs';
import { pickFromTier } from '../lib/tier-pick.mjs';
import { selectAdmission, admissionQualityFloor } from '../lib/agent-admission.mjs';
import { kindRoute, raiseToFloor, missingHostTools, hostToolsRequired } from './models.mjs';
import { tierMembers, tierOfOp, tierSettings } from './tiers.mjs';
import { poolCapsNow } from '../machine/pool-backoff.mjs';

const roleReasons = (pool, role) => (!role || !pool.roles?.length || pool.roles.includes(role) ? [] : [`pool does not serve role '${role}'`]);

function grantReasons({ pool, target, role, grants, capacity }) {
  if (!grants || pool.capacityAuthority !== 'explicit-workflow-quota') return [];
  const grant = grants[pool.target ?? target] ?? grants[target] ?? null;
  if (!grant) return [`pool needs an owner grant (capacityAuthority explicit-workflow-quota; config.yaml allocation.grants names none for ${target})`];
  const reasons = [];
  if (role && Array.isArray(grant.roles) && !grant.roles.includes(role)) reasons.push(`owner grant ${target}=${grant.slots}@${(grant.roles ?? []).join('+')} does not cover role '${role}'`);
  const running = Number(capacity?.[target]?.running ?? 0);
  if (Number.isFinite(Number(grant.slots)) && running >= Number(grant.slots)) reasons.push(`pool at granted capacity (${running}/${grant.slots} granted)`);
  return reasons;
}

const toolReasons = ({ pool, kind, modelsDir, opsDir }) => missingHostTools({ pool, kind, modelsDir, opsDir })
  .map((tool) => `pool agent '${pool.provider}' lacks host tool '${tool}' required by kind '${kind}' (route.riskHints host-tool-required:${tool})`);

function lineageReasons({ target, lineage }) {
  if (!(lineage?.exclude ?? []).includes(target)) return [];
  const seen = lineage.pools?.[target];
  return [`excluded for this retry lineage: failed ${seen?.failures ?? 'twice'}x on it${seen?.causes?.length ? ` (${seen.causes.join(', ')})` : ''}`];
}

const circuitReasons = (cap) => {
  if (cap?.auth !== 'dead') return [];
  const kind = cap.providerHealth ? cap.providerHealth.failureKind ?? 'auth' : 'auth';
  return [`provider ${kind} is unavailable${cap.authDetail ? `: ${cap.authDetail}` : ''}`];
};

/** The structural hard-filter reasons of one member for this op. */
export function structuralReasons(member, ctx) {
  const pool = ctx.runtimes?.runtimes?.[member.pool];
  if (!pool) return [`no registry.yaml pool for agent '${member.agent}'`];
  const target = pool.target ?? member.pool;
  return [...roleReasons(pool, ctx.role), ...grantReasons({ pool, target, role: ctx.role, grants: ctx.grants, capacity: ctx.capacity }),
    ...toolReasons({ pool, kind: ctx.kind, modelsDir: ctx.modelsDir, opsDir: ctx.opsDir }), ...lineageReasons({ target, lineage: ctx.lineage }),
    ...(ctx.capacity ? circuitReasons(ctx.capacity[target]) : [])];
}

function candidateOf(member, ctx) {
  const pool = ctx.runtimes.runtimes[member.pool], target = pool.target ?? member.pool, cap = ctx.capacity?.[target];
  const registered = ctx.registry?.models?.[member.model];
  const backoff = ctx.backoff?.[target];
  return { id: member.id, pool: member.pool, target, agent: member.agent, provider: member.provider, account: cap?.quota?.account ?? 'default',
    model: member.model, effort: member.effort, tier: member.tier, modelAuthority: adapterModelAuthority(loadAdapter(member.provider, ctx.modelsDir).card),
    qualityFloor: registered?.provider === member.provider ? registered.tier : null, eligibility: { eligible: true, mode: 'operation-policy' },
    quota: cap?.quota, extraHard: member.hard, capacity: { running: cap?.running, maxParallel: Math.min(pool.maxParallel, Number.isInteger(backoff) ? backoff : pool.maxParallel),
      openIncident: cap?.openIncident === true, ...(cap?.blockedUntil === undefined ? {} : { blockedUntil: cap.blockedUntil }) } };
}

const rejectedOf = (admission) => admission.rejected.map((row) => ({ target: row.id, reason: row.codes[0], reasons: row.codes }));

function noToolHolder(members, ctx, tools) {
  const structural = members.filter((member) => ctx.runtimes.runtimes[member.pool] && !roleReasons(ctx.runtimes.runtimes[member.pool], ctx.role).length);
  if (!tools.length || !structural.length || !structural.every((member) => toolReasons({ pool: ctx.runtimes.runtimes[member.pool], kind: ctx.kind, modelsDir: ctx.modelsDir, opsDir: ctx.opsDir }).length)) return null;
  const holders = Object.entries(ctx.runtimes.runtimes)
    .filter(([, pool]) => !missingHostTools({ pool, kind: ctx.kind, modelsDir: ctx.modelsDir, opsDir: ctx.opsDir }).length)
    .map(([target, pool]) => ({ target: pool.target ?? target, roles: pool.roles ?? [] }));
  const missing = [...new Set(structural.flatMap((member) => missingHostTools({ pool: ctx.runtimes.runtimes[member.pool], kind: ctx.kind, modelsDir: ctx.modelsDir, opsDir: ctx.opsDir })))];
  return { tools: missing.length ? missing : tools, holders };
}

/**
 * Pick the model of one op. Input: {kind, difficulty, bias {prefer, avoid, only}, biasTrusted, capacity (per pool target; absent = a static plan),
 * runtimes (merged view), modelRegistry, scopeId, attemptId, grants, lineage, history, settings}.
 * Output: {tier, target, modelId, effort, role, work, difficulty, measuredDifficulty, floor, chain, rejected, admission, pick} or {error, ...}.
 */
export function pickOpModel(input = {}) {
  const { kind, bias = {}, capacity = null, runtimes, scopeId, attemptId, now = Date.now(), modelsDir, opsDir, grants = null, lineage = null } = input;
  const registry = input.modelRegistry ?? loadModelRegistry(modelsDir);
  const settings = input.settings ?? tierSettings({ registry });
  const route = kindRoute(kind, runtimes), measured = input.difficulty;
  const difficulty = raiseToFloor(measured, route.floor);
  if (!difficulty) return { error: `unknown difficulty '${measured}'` };
  if (!route.role) return { error: `no role resolves for kind '${kind}'` };
  const tier = tierOfOp({ kind, difficulty }, settings);
  const ctx = { kind, role: route.role, runtimes, grants, lineage, capacity, modelsDir, opsDir, registry, backoff: input.backoff ?? (capacity ? poolCapsNow() : {}) };
  const members = tierMembers(tier, { settings, registry }).map((member) => ({ ...member, hard: structuralReasons(member, ctx) }));
  const base = { tier, role: route.role, work: route.work, difficulty, measuredDifficulty: measured, floor: route.floor, chain: members.map((member) => member.id) };
  const tools = noToolHolder(members, ctx, hostToolsRequired(kind, { opsDir }));
  if (tools) return { ...base, error: `no ${route.role} member of tier ${tier} has host tool ${tools.tools.join(', ')}`, toolUnavailable: tools };
  if (!capacity) return { ...base, ...staticPick(members, { bias, settings, input }) };
  const policy = { ...runtimes?.allocation?.admission, ...settings.usage };
  const admission = selectAdmission({ request: { role: 'op', kind, difficulty, tier, scopeId: scopeId ?? `pool-plan:${kind}`, attemptId: attemptId ?? scopeId ?? `pool-plan:${kind}`,
    qualityFloor: input.qualityFloor ?? admissionQualityFloor('op', difficulty, policy), biasTrusted: input.biasTrusted === true,
    allowGroup: members.map(({ provider, model }) => ({ provider, model })), prefer: bias.prefer ?? [], avoid: bias.avoid ?? [], only: bias.only ?? [],
    reserveOverride: bias.reserveOverride ?? null, history: input.historyOf?.(tier) ?? input.history ?? {},
    balance: { maxStreak: settings.balance.maxStreak, maxSharePercent: settings.balance.maxSharePercent } },
  candidates: members.map((member) => candidateOf(member, ctx)), policy, now });
  const rejected = rejectedOf(admission);
  if (!admission.ok) return { ...base, error: `agent admission refused: ${admission.reason}`, admission, rejected, pick: admission.pick, resetAt: admission.resetAt };
  const chosen = members.find((member) => member.id === admission.selected.id);
  return { ...base, target: chosen.target, modelId: chosen.model, effort: chosen.effort, rejected, admission: { ...admission, selected: admission.selected }, pick: admission.pick,
    chosenBy: admission.chosenBy };
}

// With no live evidence the plan applies the structural gates and the bias only: no quota, history or reservation is read.
function staticPick(members, { bias, settings, input }) {
  const tier = members[0]?.tier ?? null;
  const picked = pickFromTier({ tier, members: members.map((member) => ({ ...member, pressure: 0 })), bias: { ...bias, trusted: false },
    history: input.historyOf?.(tier) ?? input.history ?? {}, balance: { maxStreak: settings.balance.maxStreak, maxSharePercent: settings.balance.maxSharePercent }, usage: settings.usage });
  const chosen = picked.selected;
  const rejected = picked.record.dropped.map((row) => ({ target: row.id, reason: row.reason, reasons: [row.reason] }));
  if (!picked.ok || !chosen) return { error: `no eligible member of tier ${tier ?? '(none)'}`, rejected, pick: picked.record };
  return { target: chosen.target, modelId: chosen.model, effort: chosen.effort, rejected, pick: picked.record, chosenBy: picked.chosenBy,
    admission: { ok: false, reason: 'live-evidence-required', planOnly: true } };
}
