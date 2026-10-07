// Kernel launch routing: owner pins, quota/circuit ordering and the native model router.
// The factory only creates one launch's closures/cache; resolving a route performs the reads.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runNode } from '../api/node/run-node.mjs';
import { inspectOwnerConfig } from '../../engine/config.mjs';
import { loadAdapter } from '../agent/lib.mjs';
import { resolveLaunchModel, providerAvailability, providerCircuitOf, orderByAvailability, loadModelRegistry } from '../agent/models.mjs';
import { parseJson } from '../lib/json.mjs';

// The pool target a provider pin launches on: the registry.yaml pool owned by
// that provider that carries the kernel-manager role (decide) first, else the
// provider's first pool.
function poolTargetForAgent(agent) {
  const doc = loadModelRegistry();
  const owned = Object.entries(doc?.pools ?? {}).filter(([, rt]) => rt?.provider === agent);
  return owned.find(([, rt]) => Array.isArray(rt?.roles) && rt.roles.includes('decide'))?.[0]
    ?? owned[0]?.[0] ?? null;
}

// kernel.model resolves its provider through the model catalog: the model id's
// declared provider (models.<id>.provider), a pool id/target, a pool's
// per-difficulty pin or defaultModel, or a launch target's runtime.
// registry.yaml is the single capacity/model-pin authority.
function agentForModel(model) {
  const doc = loadModelRegistry();
  if (!doc) return null;
  const direct = doc?.models?.[model]?.provider;
  if (direct) return direct;
  for (const [id, rt] of Object.entries(doc.pools ?? {})) {
    if (id === model || rt?.target === model) return rt?.provider ?? null;
    if (rt?.defaultModel === model || Object.values(rt?.models ?? {}).includes(model)) return rt?.provider ?? null;
  }
  return doc?.targets?.[model]?.runtime ?? null;
}

// A launch target's provider is declared by the registry: the pool's provider,
// else the target's runtime adapter id (modules/models/registry.yaml).
function agentForTarget(target) {
  const doc = loadModelRegistry();
  return doc?.pools?.[target]?.provider ?? doc?.targets?.[target]?.runtime ?? null;
}

export function createKernelRoute({ skillRoot, repo, agentOverride, ownerRoot }) {
const ROUTE_MODEL = path.join(skillRoot, 'scripts', 'route', 'route-model.mjs');
const KERNEL_ROUTE = { kind: 'model.manageWorkflow', risk: 'high' }; // selection.yaml kernelFunctionKinds
// The pool difficulty a Kernel seat launches at: kernel functions are think work at the hard floor (runtimes.yaml roleOfKind note); runtimes.yaml pools are keyed by difficulty, not by risk.
const KERNEL_DIFFICULTY = 'hard';
const ownerFileLabel = (file) => ownerRoot === skillRoot ? path.relative(skillRoot, file) : file;

// Provider liveness probe: scripts/agent/quota/index.mjs exports
// probeQuota(provider) → {state, usedPercent, detail}; 'dead' means the
// provider is not authenticated. It is imported lazily and every failure
// degrades to 'unknown' — a probe is evidence, never a verdict, and a kernel
// must still boot when the provider CLI cannot answer. Probes are memoized
// per process — one account-list read serves every candidate.
const probeCache = new Map();
async function probeAgent(agent) {
  if (probeCache.has(agent)) return probeCache.get(agent);
  const file = path.join(skillRoot, 'scripts', 'agent', 'quota', 'index.mjs');
  let probe = { state: 'unknown', detail: 'quota probe not installed' };
  if (fs.existsSync(file)) {
    try {
      const mod = await import(pathToFileURL(file).href);
      probe = typeof mod.probeQuota === 'function'
        ? (await mod.probeQuota(agent) ?? { state: 'unknown' })
        : { state: 'unknown', detail: 'quota module exports no probeQuota' };
    } catch (e) { probe = { state: 'unknown', detail: `quota probe threw: ${e.message}` }; }
  }
  probeCache.set(agent, probe && typeof probe === 'object' ? probe : { state: 'unknown' });
  return probeCache.get(agent);
}

// One provider's availability for a kernel group member: the quota probe plus
// this ledger's provider-health circuit (scripts/agent/models.mjs).
async function memberAvailability(agent, db) {
  const probe = await probeAgent(agent);
  let circuit = null;
  try { circuit = db ? providerCircuitOf(db, agent) : null; } catch { circuit = null; }
  return providerAvailability({ probe, circuit });
}

async function completeKernelRoute(route) {
  if (route.error || !route.agent) return route;
  let model = route.model ?? route.route?.model ?? null;
  let effort = route.effort ?? route.route?.effort ?? null;
  const runtimePool = route.route?.target ?? poolTargetForAgent(route.agent);
  if ((!model || !effort) && runtimePool) {
    try {
      const resolved = resolveLaunchModel(runtimePool, KERNEL_DIFFICULTY);
      model = model ?? resolved?.modelId ?? null;
      effort = effort ?? resolved?.effort ?? null;
    } catch { /* converted to a typed route error below */ }
  }
  if (!model)
    return { ...route, runtimePool, error: `kernel agent '${route.agent}' has no resolvable model for ${KERNEL_ROUTE.kind}/${KERNEL_ROUTE.risk}` };
  return { ...route, model, effort, runtimePool };
}

// Resolve the dedicated Kernel terminal's agent/model. Config pins and CLI
// overrides are authority, not preferences: a dead agent, unknown bare model
// or agent/model mismatch fails closed instead of choosing a substitute.
// A config.yaml kernel group and the unpinned think-group route are ordered
// member lists instead: `members` is the launch order after availability
// (unavailable skipped, limited last) and `fallThrough` lets the boot move to
// the next member on a no-effect launch refusal (modules/kernel/start-workflow.yaml
// spawn.fallThrough). The route's top-level agent/model are members[0].
const single = (route) => (route.error ? route : { ...route, members: [route], fallThrough: false });
const groupRoute = (members, extra) => ({ ...members[0], members, fallThrough: true, ...extra });
const memberLabel = (m) => `${m.agent}/${m.model ?? '(pool model)'}`;
const memberSummary = (m) => ({ agent: m.agent, model: m.model ?? null, effort: m.effort ?? null,
  runtimePool: m.runtimePool ?? null, ...(m.availability ? { availability: m.availability.state } : {}) });
const rejectedSummary = (rejected) => rejected.map((x) => `${x.target}: ${(x.reasons ?? [])[0] ?? 'rejected'}`).join('; ');

async function overrideRoute() {
  const probe = await probeAgent(agentOverride);
  if (probe?.state === 'dead')
    return { agent: agentOverride, routedBy: 'override', warnings: [],
      errorStep: 'kernel-pin-unavailable',
      error: `explicit kernel agent '${agentOverride}' probe is dead (${probe.detail ?? 'not authenticated'})` };
  return single(await completeKernelRoute({ agent: agentOverride, routedBy: 'override', warnings: [] }));
}

function routingConfigOf(owner) {
  const kc = owner.config?.kernel;
  const cfgGroup = Array.isArray(kc?.group) ? kc.group.filter(m => typeof m?.agent === 'string' && m.agent.trim())
    .map(m => ({ agent: m.agent.trim(), model: typeof m.model === 'string' && m.model.trim() ? m.model.trim() : null })) : null;
  const cfgAgent = !cfgGroup && typeof kc?.agent === 'string' && kc.agent.trim() ? kc.agent.trim() : null;
  const cfgModel = !cfgGroup && typeof kc?.model === 'string' && kc.model.trim() ? kc.model.trim() : null;
  // The kernel's own effort pins; the global config effort is inherited only by a kernel agent whose card can pin one
  // (start.modelArgument: worker-start takes --effort only with --model) - Devin takes neither, so an inherited effort
  // must not refuse its launch.
  const pinsEffort = (agent) => { try { return loadAdapter(agent)?.card?.start?.modelArgument !== false; } catch { return true; } };
  const kernelEffort = typeof kc?.effort === 'string' && kc.effort.trim() ? kc.effort.trim() : null;
  const globalEffort = typeof owner.config?.effort === 'string' && owner.config.effort.trim() ? owner.config.effort.trim() : null;
  const cfgEffort = kernelEffort ?? (typeof kc?.agent === 'string' && kc.agent.trim() && !pinsEffort(kc.agent.trim()) ? null : globalEffort);
  const config = owner.config || owner.error ? {
    file: owner.config ? ownerFileLabel(owner.file) : null,
    agent: cfgAgent, model: cfgModel, effort: cfgEffort,
    ...(cfgGroup ? { group: cfgGroup } : {}),
    budgets: owner.config?.budgets ?? null,
    ...(owner.error ? { error: owner.error } : {}),
    ...(owner.invalid ? { configInvalid: owner.invalid } : {}),
  } : null;
  const warnings = [];
  const warn = (warning) => { warnings.push(warning); console.error(`start-workflow: warning: ${warning}`); };
  return { cfgGroup, cfgAgent, cfgModel, cfgEffort, config, warnings, warn };
}

async function configuredGroupRoute(db, { cfgGroup, cfgEffort, config, warnings, warn }) {
  if (cfgGroup?.length) {
    const availability = new Map();
    for (const m of cfgGroup) if (!availability.has(m.agent)) availability.set(m.agent, await memberAvailability(m.agent, db));
    const { ordered, unavailable } = orderByAvailability(cfgGroup, m => availability.get(m.agent));
    for (const u of unavailable) warn(`kernel group member ${memberLabel(u)} skipped — ${u.availability.reason}`);
    const members = [];
    for (const m of ordered) {
      const modelAgent = m.model ? agentForModel(m.model) : null;
      if (modelAgent && modelAgent !== m.agent) { warn(`kernel group member ${memberLabel(m)} skipped — model is owned by agent '${modelAgent}'`); continue; }
      const completed = await completeKernelRoute({ agent: m.agent, routedBy: 'config', model: m.model, effort: cfgEffort, config, warnings, availability: m.availability });
      if (completed.error) { warn(`kernel group member ${memberLabel(m)} skipped — ${completed.error}`); continue; }
      members.push(completed);
    }
    if (!members.length)
      return { agent: cfgGroup[0].agent, routedBy: 'config', model: cfgGroup[0].model, effort: cfgEffort, config, warnings,
        members: [], fallThrough: true, errorStep: 'kernel-group-unavailable',
        error: `kernel group has no available member: ${warnings.join('; ')}` };
    return groupRoute(members);
  }
}

async function configuredPinRoute({ cfgAgent, cfgModel, cfgEffort, config, warnings }) {
  if (cfgAgent) {
    const modelAgent = cfgModel ? agentForModel(cfgModel) : null;
    if (modelAgent && modelAgent !== cfgAgent)
      return { agent: cfgAgent, routedBy: 'config', model: cfgModel, effort: cfgEffort, config, warnings,
        error: `kernel pin mismatch: agent '${cfgAgent}' cannot launch model '${cfgModel}' owned by agent '${modelAgent}'` };
    const probe = await probeAgent(cfgAgent);
    if (probe?.state === 'dead')
      return { agent: cfgAgent, routedBy: 'config', model: cfgModel, effort: cfgEffort, config, warnings,
        errorStep: 'kernel-pin-unavailable',
        error: `kernel pin failed closed: agent '${cfgAgent}' probe is dead (${probe.detail ?? 'not authenticated'})` };
    return single(await completeKernelRoute({ agent: cfgAgent, routedBy: 'config', model: cfgModel, effort: cfgEffort, config, warnings }));
  }
  if (cfgModel) {
    const agent = agentForModel(cfgModel);
    if (!agent)
      return { agent: null, routedBy: 'config', model: cfgModel, effort: cfgEffort, config, warnings,
        error: `kernel model pin '${cfgModel}' is not declared by any runtimePool` };
    const probe = await probeAgent(agent);
    if (probe?.state === 'dead')
      return { agent, routedBy: 'config', model: cfgModel, effort: cfgEffort, config, warnings,
        errorStep: 'kernel-pin-unavailable',
        error: `kernel model pin '${cfgModel}' failed closed: agent '${agent}' probe is dead (${probe.detail ?? 'not authenticated'})` };
    return single(await completeKernelRoute({ agent, routedBy: 'config', model: cfgModel, effort: cfgEffort, config, warnings }));
  }
  return null;
}

async function routeModelGroup({ cfgEffort, config, warnings, warn }) {
  // Unpinned: route-model resolves the think group quota-aware (selection.yaml
  // decisionFlow kernel-function + kernel-availability) and reads this repo's
  // provider-health circuit; its pick and fallbackChain are the members.
  const r = runNode(
    [ROUTE_MODEL, '--kind', KERNEL_ROUTE.kind, '--risk', KERNEL_ROUTE.risk, '--repo', repo, '--json'],
    { timeout: 60000, cwd: skillRoot });
  const result = parseJson(r.stdout);
  const pick = result?.pick ?? null;
  if (r.error || r.status !== 0 || !pick?.target) {
    const rejected = (result?.rejected ?? []).length ? ` — ${rejectedSummary(result.rejected)}` : '';
    return {
      agent: null, routedBy: 'route-model', effort: cfgEffort, config, warnings,
      error: r.error?.message ?? (r.status === 0 ? 'route-model returned no pick' : result?.rule ?? `route-model exited ${r.status}`)
        + rejected,
    };
  }
  const members = [];
  for (const c of [pick, ...(result.fallbackChain ?? [])]) {
    const agent = agentForTarget(c.target);
    if (!agent) { warn(`profile for runtimePool '${c.target}' declares no execution agent`); continue; }
    // Unpinned routing never invents a hard-coded Devin fallback: only
    // route-model's own members, re-probed so a dead agent is never launched.
    const probe = await probeAgent(agent);
    if (probe?.state === 'dead') { warn(`routed agent '${agent}' (${c.target}) probe is dead (${probe.detail ?? 'not authenticated'}) — taking the next member`); continue; }
    const completed = await completeKernelRoute({
      agent, routedBy: 'route-model', effort: cfgEffort, config, warnings,
      ...(result.availability?.[c.target] ? { availability: result.availability[c.target] } : {}),
      route: { kind: KERNEL_ROUTE.kind, risk: KERNEL_ROUTE.risk, target: c.target, model: c.model ?? null,
        profile: 'modules/models/registry.yaml', mode: c.mode ?? null, rule: result.rule ?? null },
    });
    if (completed.error) { warn(completed.error); continue; }
    members.push(completed);
  }
  if (!members.length)
    return { agent: null, routedBy: 'route-model', effort: cfgEffort, config, warnings,
      error: `no routed kernel member is launchable (${warnings.join('; ')})` };
  return groupRoute(members);
}

async function routeKernel(db, owner) {
  if (agentOverride) return overrideRoute();
  const config = routingConfigOf(owner);
  if (config.cfgGroup?.length) return configuredGroupRoute(db, config);
  const pinned = await configuredPinRoute(config);
  if (pinned) return pinned;
  return routeModelGroup(config);
}

  async function resolveKernelRoute(db) {
    const owner = inspectOwnerConfig(ownerRoot);
    const route = await routeKernel(db, owner);
    // Routing summaries are presentation; launch consumes this exact owner observation.
    return { ...route, ownerConfig: owner.error || owner.invalid ? null : owner.config };
  }

  return { resolveKernelRoute, memberLabel, memberSummary };
}
