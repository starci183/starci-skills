#!/usr/bin/env node
// route-model.mjs — resolve which model target may take a workload, by EXECUTING
// the declarative rules in modules/models/selection.yaml (the source of truth).
// Ordering facts come from the files
// selection.yaml cites: modules/models/registry.yaml `pools` (the ONE model
// catalog: membership, roles, models, maxParallel), modules/models/runtimes.yaml
// (preference/tiers) and
// modules/models/qualifications.yaml (the shipped evidence store — empty means
// no measured qualification, so eligible routes are probation, the
// kernel-function step for the kernel's own calls, or refusal).
//
// Internal entry: spawned by scripts/goal/define-goal.mjs; not invoked directly.
// Args: --kind <kind>
//       [--role <implement|verify|decide|plan|write>]   (default: kinds.yaml role)
//       [--domain <d>] [--risk <low|medium|high|critical>]
//       [--floor <probation|standard|high|critical>]
//       [--tools <t>[,<t>...]] [--contextTokens <n>]
//       [--external]            workload has external effects (probation forbidden)
//       [--unapproved]          workflow not approved (probation forbidden)
//       [--no-review]           no fresh independent review planned
//       [--no-checks]           op declares no machine checks
//       [--difficulty <easy|medium|hard|insane>]   measured difficulty (default
//                               medium; required with --plan), raised to the
//                               kind's runtimes.yaml roleOfKind floor
//       [--plan]                what-if view: walk the runtimes.yaml difficulty tier
//                               (∩ per-role preference) instead of the declared
//                               operator chain; missing or stale qualification
//                               evidence is ANNOTATED, not fatal
//       [--repo <path>]         kernel-function kinds also read that repository
//                               ledger's provider-health circuit (open → unavailable)
//       [--json] [--modelsDir <dir>] [--verbose]
//       --help prints this argument description
//
// Prints: picked target (+model for the role), the rule that fired, the ordered
// fallback chain, and per-candidate rejection reasons. Exit 1 on refusal
// ('no eligible model' — a typed exclusion, never a silent swap).
//
// Owner config: <skillRoot>/config.yaml (gitignored, seeded from
// config.example.yaml by the installer) is consulted for what it owns —
// models.nonOperation pools bind kernel-function kinds to a configured pool,
// allocation.preferredProvider is a bounded owner bias (never a fallback
// chain), and effort is surfaced for the caller. A missing config changes
// nothing: routing is identical to the pre-config behavior.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { chainFor, resolveLaunchModel, kindRoute, orderKeyOf, raiseToFloor, missingHostTools,
  providerAvailability, providerCircuitOf } from '../agent/models.mjs';
import { inspectOwnerConfig } from '../../engine/config.mjs';
import { inspectLedger, ledgerFileFor } from '../../engine/db/ledger.mjs';
import { readEnv } from '../lib/env.mjs';
import { admittedModelSet } from './admitted-model-set.mjs';
import { parseArgs } from './route-model-args.mjs';
import { probationAdmissionReasons, qualificationReasons } from './route-model-gates.mjs';
const skillRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const readYaml = p => (fs.existsSync(p) ? parseYaml(fs.readFileSync(p, 'utf8')) : null);

// --- owner config (config.yaml) --------------------------------------------------
// engine/config.mjs inspectOwnerConfig is the one reader. STARCI_OWNER_ROOT
// points it at a different directory holding a config.yaml (test and tooling
// seam). A missing, unparsable or schema-short file is never fatal — routing
// degrades to "no config" and reports why.
const ownerRoot = readEnv('STARCI_OWNER_ROOT') ? path.resolve(readEnv('STARCI_OWNER_ROOT')) : skillRoot;

// Which config.yaml models.nonOperation role serves each kernel-function kind —
// the same map engine/config.mjs resolves through nonOperationModels().
// Kernel kinds without an entry (screen classification, owner presentation)
// have no configured pool and keep the runtimes.yaml preference order.
const KERNEL_FUNCTION_ROLE = {
  'model.assessGoal': 'planner',
  'model.planOp': 'planner',
  'model.decide': 'kernelManager',
  'model.manageWorkflow': 'kernelManager',
  'model.validateOp': 'validator',
  'model.critiqueGoal': 'validator',
  'judge': 'validator',
};

// --- provider preflight + capacity drift (adapter-card facts) ---------------------
// A preflight is whatever the provider's adapter card declares must hold before
// a dispatch can be trusted: its readiness (the worker-start receipt), and post-submission attestation. An explicit `preflight:`
// key on the runtimes.yaml entry or the adapter card wins outright — it is the
// data hook this layer reports; execution stays in scripts/agent/lib.mjs.
const adapterCache = new Map();
function adapterCardFor(provider) {
  if (!provider) return null;
  if (!adapterCache.has(provider))
    adapterCache.set(provider, readYaml(path.join(skillRoot, 'modules', 'models', 'agents', `${provider}.yaml`)));
  return adapterCache.get(provider);
}
function preflightFor(runtime) {
  const card = adapterCardFor(runtime?.provider);
  const declared = runtime?.preflight ?? card?.preflight ?? null;
  if (declared) return { probes: ['declared-preflight'], declared };
  const probes = [];
  if (card?.readiness) probes.push(typeof card.readiness === 'string' ? card.readiness : 'readiness-screen');
  if (card?.attestation || Array.isArray(card?.knownFailures)) probes.push('post-submit-attestation');
  if (!card) probes.push('no-adapter-card');
  return { probes, declared: null };
}

// registry.yaml `pools` is the single capacity authority: no second copy of
// maxParallel exists, so no drift check is possible or needed.

// --- selection.yaml-driven data -------------------------------------------------

function loadRules(modelsDir) {
  const file = path.join(modelsDir, 'selection.yaml');
  const doc = readYaml(file);
  if (doc?.schema !== 'starci/module-model-selection@1')
    throw new Error(`selection.yaml missing or wrong schema at ${file}`);
  return {
    file,
    riskOrder: doc.ladders.risk.order,
    riskDefault: doc.ladders.risk.default,
    floorOrder: doc.ladders.qualityFloor.order,
    floorDefault: doc.ladders.qualityFloor.default,
    highKinds: new Set(doc.closedSets.highKinds),
    kernelKinds: new Set(doc.closedSets.kernelFunctionKinds),
    probationFloorBan: ['high', 'critical'],   // selection.yaml probation.recordGates
    fallbackAdvanceWhen: doc.fallback?.advanceOnlyWhen ?? [],
  };
}

// --- workload normalization + derivation (selection.yaml §2-3) -------------------

function deriveWorkload(args, rules, kindEntry, opChecks = []) {
  const modelFunction = rules.kernelKinds.has(args.kind) || args.kind === 'judge';
  const checksDeclared = args.checks ?? (opChecks.length > 0 || !kindEntry);
  const reviewPlanned = args.review ?? true; // CLI what-if default; printed as an assumption
  let risk = args.risk ?? rules.riskDefault;
  let floor = args.floor ?? rules.floorDefault;
  const elevated = rules.highKinds.has(args.kind) || ['high', 'critical'].includes(risk) || ['high', 'critical'].includes(floor);
  if (elevated) { risk = 'high'; floor = 'high'; }
  const w = {
    kind: args.kind, role: args.role ?? kindEntry?.role ?? null,
    domain: args.domain ?? 'general', risk, qualityFloor: floor,
    tools: modelFunction ? [] : args.tools,
    contextTokens: Number.isFinite(args.contextTokens) ? args.contextTokens : 0,
    modelFunction, elevated,
    scope: 'local', approved: args.approved ?? true,
    noExternalEffects: !args.external,
    strictMachineGates: modelFunction || checksDeclared,
    freshIndependentReview: modelFunction || reviewPlanned,
  };
  w.probationEligible = !elevated && w.noExternalEffects && (modelFunction || (checksDeclared && reviewPlanned));
  return w;
}

// --- candidates ------------------------------------------------------------------

function loadCandidates(modelsDir) {
  // registry.yaml `pools` holds exactly the automatic-chain pools; explicit-only
  // targets like cursor-agent live under `targets` and never appear here.
  const registry = readYaml(path.join(modelsDir, 'registry.yaml'));
  return Object.entries(registry?.pools ?? {}).map(([id, pool]) => ({
    id, target: pool?.target ?? id,
    provider: pool?.provider ?? null,
    roles: pool?.roles ?? [],
    profile: fs.existsSync(path.join(modelsDir, 'profiles', `${pool?.target ?? id}.yaml`))
      ? `profiles/${pool?.target ?? id}.yaml` : 'modules/models/registry.yaml',
  }));
}

// Candidate order sources, in precedence order:
//   1. registry.yaml operators[kind].chain — the declared per-op launch chain
//      ("choosing the first ready runtime/profile", registry.yaml selection).
//   2. runtimes.yaml allocation.preference[key] — within-family suitability,
//      used for kinds with no declared chain (kernel functions, unknown kinds);
//      the key is the kind's roleOfKind order, else `think` for think work,
//      else the role (models.mjs orderKeyOf).
// selection.yaml allocationFacts.note: tiers/preference are NOT a workflow
// provider fallback chain; the declared operator chains decide in a workflow.
function candidateOrder(kind, key, registry, runtimes) {
  const chain = registry?.operators?.[kind]?.chain;
  if (Array.isArray(chain) && chain.length) return { order: chain, source: `registry.yaml operators.${kind}.chain` };
  const pref = (key && runtimes?.allocation?.preference?.[key]) || runtimes?.allocation?.preference?.implement || [];
  return { order: pref, source: `runtimes.yaml allocation.preference.${key ?? 'implement'}` };
}

// --- plan mode: what-if tier preview ---------------------------------------------
//
// --plan previews allocation for goal planning: instead of the declared operator
// chain it walks the runtimes.yaml difficulty tier (allocation.tiers.<difficulty>,
// role-keyed where the tier is a map) and evaluates each runtime entry with the
// same qualification/probation gates — except a missing or stale evidence file is
// annotated rather than allowed to fail the pick. Nothing is admitted, launched or
// written; this is a view, not a route.

const PLAN_COLD_MINUTES = { easy: 15, medium: 45, hard: 90, insane: 180 };
// Failures that mean "no usable evidence" rather than "evidence proved unfit":
// a pick may still be previewed past these, annotated.
const PLAN_EVIDENCE_ABSENT = new Set([
  'model qualification evidence is missing',
  'qualification is stale',
  'qualification date is invalid',
]);

// The (role, difficulty) chain is shared with scripts/agent/models.mjs: pools
// in BOTH the tier order and the per-role preference, tier position outer
// sort.
function planChain(runtimes, difficulty, role) {
  const { chain, tierSource } = chainFor({ role, difficulty, runtimes });
  return { chain, source: `${tierSource} ∩ allocation.preference.${role ?? '(none)'}` };
}

function planEvidenceNote(evidence, qr) {
  if (evidence?.schema !== 'starci/model-qualification@1')
    return 'no qualification evidence on disk';
  if (qr.includes('qualification is stale')) return 'qualification evidence on disk is stale';
  if (qr.includes('qualification date is invalid')) return 'qualification evidence on disk has an invalid date';
  return null;
}

function planCandidates(chain, runtimes, w, rules, evidenceByRuntime, difficulty) {
  const probationReasons = probationAdmissionReasons(w, rules);
  // A pool serves the kind when it serves its role or the order the kind walks
  // (owner routing 2026-09-26: the implement order's mechanical ops are
  // decide/plan/write-role kinds the hands take anyway) — the same gate
  // scripts/agent/models.mjs::selectPool applies.
  const serveKey = orderKeyOf({ work: w.work, order: w.order }, w.role);
  return chain.map(id => {
    const rt = runtimes?.runtimes?.[id] ?? null;
    if (!rt) return { id, target: id, status: 'rejected', structural: true, reasons: ['no registry.yaml entry for this pool'] };
    // The launch model is the pool's per-difficulty pin (registry.yaml pools
    // models[difficulty]); a pool without that pin is structurally off this
    // chain, the same gate scripts/agent/models.mjs::selectPool applies.
    const lm = resolveLaunchModel(id, difficulty, { runtimes });
    const model = lm.modelId ?? rt.target ?? id;
    const pf = preflightFor(rt);
    const base = { id, target: rt.target ?? id, provider: rt.provider ?? null, model, maxParallel: rt.maxParallel ?? null,
      effort: lm.effort ?? null,
      preflight: pf.probes, ...(pf.declared ? { preflightDeclared: pf.declared } : {}) };
    if (w.role && rt.roles?.length && !rt.roles.includes(w.role) && !rt.roles.includes(serveKey))
      return { ...base, status: 'rejected', structural: true, reasons: [
        `pool does not serve role '${w.role}'` + (serveKey !== w.role ? ` or order '${serveKey}'` : '')] };
    const missingTools = missingHostTools({ pool: rt, kind: w.kind });
    if (missingTools.length)
      return { ...base, status: 'rejected', structural: true, reasons: missingTools.map(tool => `pool agent '${rt.provider}' lacks host tool '${tool}' required by kind '${w.kind}' (route.riskHints host-tool-required:${tool})`) };
    if (lm.error)
      return { ...base, status: 'rejected', structural: true, reasons: [lm.error] };
    const evidence = evidenceByRuntime[id];
    const qr = qualificationReasons({ provider: rt.provider, model, target: rt.target ?? id, version: null }, evidence, w, rules);
    const note = planEvidenceNote(evidence, qr);
    if (!qr.length) return { ...base, status: 'qualified', structural: false, reasons: [], note, qr };
    if (!probationReasons.length) return { ...base, status: 'probation-only', structural: false, reasons: [], note, qr };
    return { ...base, status: 'rejected', structural: false, reasons: [...qr, ...probationReasons], note, qr };
  });
}

const planReasonFor = (candidate) => {
  if (candidate.status === 'qualified') return 'measured qualification evidence passes';
  if (candidate.status === 'probation-only')
    return candidate.note ? `${candidate.note}; scoped probation would admit` : 'scoped probation would admit';
  return `what-if pick: ${candidate.note ?? 'no usable qualification evidence'} — launch still requires measured qualification (probation cannot satisfy this workload)`;
};

// The owner-config line a plan prints: the config file, its error, the effort and preferred provider, a kernel function's pool.
function planConfigLine(w, owner) {
  return {
    file: owner.config ? path.relative(skillRoot, owner.file) : null,
    ...(owner.error ? { error: owner.error } : {}),
    ...(owner.configInvalid ? { configInvalid: owner.configInvalid } : {}),
    effort: owner.effort ?? null,
    preferredProvider: owner.preferredProvider ?? null,
    ...(w.modelFunction ? { kernelRole: owner.cfgRole ?? null, pool: owner.cfgPoolName ?? null, members: owner.cfgMembers ?? null } : {}),
  };
}

function printPlanJson({ args, w, configLine, source, chain, evaluated, primary, fallbacks, estimate }) {
  console.log(JSON.stringify({
    plan: true,
    difficulty: args.difficulty,
    workload: w,
    config: configLine,
    tier: { source, chain },
    candidates: evaluated.map(c => ({
      target: c.target, provider: c.provider, model: c.model,
      maxParallel: c.maxParallel, status: c.status,
      ...(c.effort ? { effort: c.effort } : {}),
      preflight: c.preflight, ...(c.preflightDeclared ? { preflightDeclared: c.preflightDeclared } : {}),
      ...(c.note ? { evidence: c.note } : {}), ...(c.reasons?.length ? { reasons: c.reasons } : {}),
    })),
    pick: primary
      ? { primary: { target: primary.target, model: primary.model, status: primary.status, ...(primary.effort ? { effort: primary.effort } : {}) }, reason: planReasonFor(primary),
          fallbacks: fallbacks.map(c => ({ target: c.target, model: c.model, status: c.status })) }
      : null,
    estimate,
  }, null, 2));
}

function printPlanCandidate(c, i, verbose) {
  const spec = c.provider !== undefined
    ? `provider=${c.provider ?? '(none)'}  model=${c.model ?? '(none)'}  maxParallel=${c.maxParallel ?? '(none)'}  preflight=[${(c.preflight ?? []).join(',')}]`
    : '';
  console.log(`  ${i + 1}. ${c.target}  ${spec}  status=${c.status}` +
    (c.note ? `  (${c.note})` : ''));
  if (verbose && c.reasons?.length) console.log(`     reasons: ${c.reasons.join('; ')}`);
}

function printPlanText({ args, w, configLine, source, chain, evaluated, primary, fallbacks, estimate }) {
  console.log(`plan what-if: kind=${w.kind} role=${w.role ?? '(none)'} difficulty=${args.difficulty}`);
  console.log(`workload: risk=${w.risk} floor=${w.qualityFloor} tools=[${w.tools}] ctx=${w.contextTokens}` +
    (w.elevated ? '  ELEVATED' : '') + (w.modelFunction ? '  KERNEL-FUNCTION' : ''));
  console.log(`config: ${configLine.file ?? 'absent'}` +
    (configLine.effort ? `  effort=${configLine.effort}` : '') +
    (configLine.preferredProvider ? `  preferredProvider=${configLine.preferredProvider}` : '') +
    (configLine.pool ? `  ${configLine.kernelRole} pool '${configLine.pool}' -> [${(configLine.members ?? []).join(', ')}]` : '') +
    (configLine.error ? `  (${configLine.error})` : ''));
  console.log(`chain: ${source}  ->  [${chain.join(', ') || '(empty)'}]`);
  console.log('candidates:');
  evaluated.forEach((c, i) => printPlanCandidate(c, i, args.verbose));
  if (primary) {
    console.log(`primary: ${primary.target} (${planReasonFor(primary)})`);
    console.log(`fallbacks: [${fallbacks.map((c) => c.target + ' (' + c.status + ')').join(', ')}]`);
  } else {
    console.log(`primary: none — no pool on the ${args.difficulty} tier can preview this workload`);
    for (const c of evaluated.filter(c => c.reasons?.length)) console.log(`  ${c.target}: ${c.reasons.join('; ')}`);
  }
  console.log(`estimate: cold ~${estimate.coldMinutes}m for ${/^[aeiou]/i.test(args.difficulty) ? 'an' : 'a'} ${args.difficulty} operation`);
}

function runPlan(args, rules, runtimes, w, evidenceByRuntime, owner = {}) {
  const { chain, source } = planChain(runtimes, args.difficulty, orderKeyOf({ work: w.work, order: w.order }, w.role));
  const evaluated = planCandidates(chain, runtimes, w, rules, evidenceByRuntime, args.difficulty);
  // Pickable = not structurally off the chain, and any rejection rests only on
  // absent/stale evidence (annotation, not a real disqualification) — the point
  // of plan mode is "who takes this once qualification exists". Probation
  // reasons are workload-level and never disqualify a pool in this preview.
  const pickable = evaluated.filter(c => !c.structural
    && (c.status !== 'rejected' || c.qr.every(r => PLAN_EVIDENCE_ABSENT.has(r))));
  const statusRank = { qualified: 0, 'probation-only': 1, rejected: 2 };
  const bias = c => (owner.preferredProvider && c.provider === owner.preferredProvider ? 0 : 1);
  const ordered = [...pickable].sort((a, b) => statusRank[a.status] - statusRank[b.status]
    || bias(a) - bias(b) || chain.indexOf(a.id) - chain.indexOf(b.id));
  const primary = ordered[0] ?? null;
  const fallbacks = ordered.slice(1);
  const estimate = { difficulty: args.difficulty, coldMinutes: PLAN_COLD_MINUTES[args.difficulty] };
  const shown = { args, w, configLine: planConfigLine(w, owner), source, chain, evaluated, primary, fallbacks, estimate };
  if (args.json) printPlanJson(shown);
  else printPlanText(shown);
  if (!primary) process.exit(1);
}

// --- availability (config.yaml models.selection: quota-aware) ----------------------
// Kernel-function kinds are the non-operation pool config.yaml declares
// quota-aware: each candidate provider's quota probe and, with --repo, that
// ledger's provider-health circuit decide availability (scripts/agent/models.mjs
// providerAvailability). Memoized per provider; a probe that cannot answer is
// 'unknown' and never blocks.
async function availabilityReader(repo) {
  let probeQuota = null;
  try { ({ probeQuota } = await import('../agent/quota/index.mjs')); } catch { /* probe not installed */ }
  let db = null;
  if (repo) {
    try {
      const file = ledgerFileFor(path.resolve(repo));
      if (fs.existsSync(file)) db = inspectLedger({ file }).db;
    } catch { /* no readable ledger — circuits unknown */ }
  }
  const cache = new Map();
  const read = (provider) => {
    if (!provider) return { state: 'available', reason: 'pool declares no provider' };
    if (cache.has(provider)) return cache.get(provider);
    let probe;
    try { probe = probeQuota ? probeQuota(provider) : { state: 'unknown', detail: 'quota probe not installed' }; }
    catch (e) { probe = { state: 'unknown', detail: `quota probe threw: ${e.message}` }; }
    let circuit = null;
    try { circuit = db ? providerCircuitOf(db, provider) : null; } catch { circuit = null; }
    const availability = { provider, quota: probe?.state ?? 'unknown', ...providerAvailability({ probe, circuit }) };
    cache.set(provider, availability);
    return availability;
  };
  return { read, close: () => { try { db?.close(); } catch { /* read-only */ } } };
}

// --- main -------------------------------------------------------------------------

// The models directory's data and the workload of the requested kind, raised to its role's difficulty floor.
function loadRoute(args) {
  const modelsDir = path.resolve(args.modelsDir ?? path.join(skillRoot, 'modules', 'models'));
  const rules = loadRules(modelsDir);
  const kinds = readYaml(path.join(modelsDir, 'kinds.yaml'));
  const registry = readYaml(path.join(modelsDir, 'registry.yaml'));
  // The merged runtimes view: runtimes.yaml's allocation policy plus the ONE
  // catalog's pool map (registry.yaml pools) under `runtimes`.
  const runtimes = { ...readYaml(path.join(modelsDir, 'runtimes.yaml')), runtimes: registry?.pools ?? {} };
  const quals = readYaml(path.join(modelsDir, 'qualifications.yaml'));
  const evidenceByRuntime = {};
  for (const rec of quals?.qualifications ?? []) if (rec?.runtimeId) evidenceByRuntime[rec.runtimeId] = rec;

  const kindEntry = kinds?.kinds?.[args.kind] ?? null;
  // Machine checks the op declares: kinds.yaml checks + the op's own
  // layoutPolicy.checks (every record-writing op runs e.g. starci-validate).
  const opYaml = readYaml(path.join(skillRoot, 'modules', 'ops', 'ops', `${args.kind}.yaml`));
  const declaredChecks = [...(kindEntry?.checks ?? []), ...(opYaml?.layoutPolicy?.checks ?? [])];
  // runtimes.yaml roleOfKind is the allocator's reading of the kind: its role,
  // think/hands-on work and difficulty floor. The floor raises the requested
  // difficulty (default medium) and never lowers it.
  const route = kindRoute(args.kind, runtimes);
  const measured = args.difficulty ?? 'medium';
  const difficulty = raiseToFloor(measured, route.floor) ?? measured;
  const w = args.plan
    ? deriveWorkload({ ...args, role: args.role ?? route.role ?? kindEntry?.role }, rules, kindEntry, declaredChecks)
    : deriveWorkload({ ...args, role: args.role ?? kindEntry?.role ?? route.role }, rules, kindEntry, declaredChecks);
  w.work = route.work;
  w.order = route.order;
  w.difficulty = { measured, floor: route.floor, effective: difficulty };
  return { modelsDir, rules, registry, runtimes, evidenceByRuntime, route, measured, difficulty, w };
}

// Owner config (config.yaml): models.nonOperation pools bind kernel-function
// kinds to a configured pool, allocation.preferredProvider is a bounded owner
// bias over order (never a fallback chain — it permutes, it does not shrink
// eligibility), effort is surfaced for the caller. Absent file → no effect.
function ownerBindingOf(args, w) {
  const ownerFile = inspectOwnerConfig(ownerRoot);
  const ownerCfg = ownerFile.config;
  const cfgRole = KERNEL_FUNCTION_ROLE[args.kind] ?? null;
  const cfgPoolName = cfgRole ? ownerCfg?.models?.nonOperation?.[cfgRole] : null;
  const cfgPool = cfgPoolName ? ownerCfg?.models?.pools?.[cfgPoolName] : null;
  const cfgMembers = Array.isArray(cfgPool) ? cfgPool.filter(s => typeof s === 'string' && s.trim()) : null;
  const preferredProvider = typeof ownerCfg?.allocation?.preferredProvider === 'string'
    && ownerCfg.allocation.preferredProvider.trim() ? ownerCfg.allocation.preferredProvider.trim() : null;
  const effort = (w.modelFunction ? ownerCfg?.kernel?.effort ?? ownerCfg?.effort : ownerCfg?.effort) ?? null;
  return { file: ownerFile.file, config: ownerCfg, error: ownerFile.error,
    configInvalid: ownerFile.invalid ?? null,
    cfgRole, cfgPoolName, cfgMembers, preferredProvider, effort };
}

// Which think order the kind is held to: its declared order (review, ui, implement), a kernel function's sol-think order, else think.
function thinkOrderOf(runtimes, route, w) {
  const preference = runtimes?.allocation?.preference;
  const frontier = preference?.think ?? [];
  const solThink = Array.isArray(preference?.['sol-think']) ? preference['sol-think'] : null;
  const hasRouteOrder = w.work === 'think' && route.order && !w.modelFunction && Array.isArray(preference?.[route.order]);
  let thinkKey = 'think'; if (w.modelFunction && solThink) thinkKey = 'sol-think'; if (hasRouteOrder) thinkKey = route.order;
  return { frontier, solThink, thinkKey, thinkPools: thinkKey === 'think' ? frontier : runtimes.allocation.preference[thinkKey] };
}

// The candidate order the kind walks and where it comes from: a configured non-operation pool, the kernel group, or the declared chain.
function launchOrderOf({ args, ctx, owner, think }) {
  const { runtimes, registry, route, w } = ctx;
  // The kernel's own calls walk the sol-think order (runtimes.yaml
  // allocation.preference.sol-think: Sol first, Opus as overflow — owner
  // routing 2026-09-26), falling back to the frontier think group when
  // sol-think is undeclared.
  const kernelGroup = think.solThink ?? runtimes?.allocation?.frontier ?? think.frontier;
  const kernelGroupSource = think.solThink ? 'runtimes.yaml allocation.preference.sol-think' : 'runtimes.yaml allocation.frontier';
  const orderKey = orderKeyOf(route, w.role);
  let { order, source: orderSource } = candidateOrder(args.kind, orderKey, registry, runtimes);
  if (w.modelFunction && owner.cfgMembers?.length) {
    order = owner.cfgMembers;
    orderSource = `config.yaml models.nonOperation.${owner.cfgRole} → pools.${owner.cfgPoolName}`;
  } else if (w.modelFunction && !registry?.operators?.[args.kind]?.chain) {
    order = kernelGroup;
    orderSource = kernelGroupSource;
  }
  return { orderKey, order, orderSource, kernelGroup };
}

// The candidates in launch order: the owner's preferred provider first, then the walked order, then the id.
const orderedCandidates = (candidates, order, preferredProvider) => [...candidates].sort((a, b) => {
  const pa = preferredProvider && a.provider === preferredProvider ? 0 : 1;
  const pb = preferredProvider && b.provider === preferredProvider ? 0 : 1;
  const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
  return pa - pb || (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.id.localeCompare(b.id);
});

// The structural reasons a pool is off the launch path for this workload (think order, declared chain, role, host tools), or [].
function structuralReasons(c, e) {
  const { args, w, think, order, orderSource, orderKey, runtimes, chainDeclared, thinkKey } = e;
  // Think work runs only on its think-class order - the frontier pools for
  // think, or the kind's own declared order (review, ui, implement) or the
  // kernel functions' sol-think order; neither a declared chain
  // nor preferredProvider can move it anywhere else.
  if (think && !e.thinkPools.includes(c.id)) return [`think work runs only on runtimes.yaml allocation.preference.${thinkKey}`];
  // A declared operator chain — or a configured non-operation pool — is a
  // closed set: pools absent from it are not on the launch path at all
  // (interface.draw → [devin-agent, codex-agent] only; kernelManager → its pool only).
  if (chainDeclared && !order.includes(c.id)) return [`pool is not on the declared chain for ${args.kind} (${orderSource})`];
  // A pool serves the kind when it serves its role or the order the kind
  // walks (scripts/agent/models.mjs::selectPool applies the same gate).
  if (w.role && c.roles.length && !c.roles.includes(w.role) && !c.roles.includes(orderKey))
    return [`pool does not serve role '${w.role}'` + (orderKey !== w.role ? ` or order '${orderKey}'` : '')];
  const missingTools = missingHostTools({ pool: runtimes?.runtimes?.[c.id] ?? { provider: c.provider }, kind: args.kind });
  return missingTools.map(tool => `pool agent '${c.provider}' lacks host tool '${tool}' required by kind '${args.kind}' (route.riskHints host-tool-required:${tool})`);
}

// One candidate judged: eligible with a mode (qualified, probation, kernel-function) or rejected with reasons.
function evaluateCandidate(c, e) {
  const { w, rules, runtimes, evidenceByRuntime, difficulty, availability, kernelGroup } = e;
  const reasons = structuralReasons(c, e);
  if (reasons.length) return { c, eligible: false, mode: null, reasons };
  const lm = resolveLaunchModel(c.id, difficulty, { runtimes });
  if (lm.error) return { c, eligible: false, mode: null, reasons: [lm.error] };
  const avail = availability?.read(c.provider) ?? null;
  if (avail?.state === 'unavailable')
    return { c, eligible: false, mode: null, availability: avail, reasons: [`provider ${c.provider} unavailable: ${avail.reason}`] };
  const qr = qualificationReasons({ provider: c.provider, model: lm.modelId ?? c.target, target: c.target, version: null }, evidenceByRuntime[c.id], w, rules);
  if (!qr.length) return { c, eligible: true, mode: 'qualified', reasons: [], availability: avail };
  const pr = probationAdmissionReasons(w, rules);
  if (!pr.length) return { c, eligible: true, mode: 'probation', reasons: [], qualifiedFailed: qr, availability: avail };
  // selection.yaml decisionFlow kernel-function: the kernel's own calls on the
  // sol-think order need no qualification record.
  if (w.modelFunction && kernelGroup.includes(c.id))
    return { c, eligible: true, mode: 'kernel-function', reasons: [], qualifiedFailed: qr, availability: avail };
  return { c, eligible: false, mode: null, reasons: [...qr, ...pr], availability: avail };
}

// The result document of a routing: the pick, the fallback chain, why the others were rejected, the quota availability read.
function routingResult({ args, ctx, owner, evaluated, availability, orderSource, pickedSet, rule, admission }) {
  const { w, rules, runtimes, difficulty } = ctx;
  const pick = pickedSet[0] ?? null;
  const modelFor = c => resolveLaunchModel(c.id, difficulty, { runtimes }).modelId ?? c.target;
  const result = {
    workload: w,
    config: {
      file: owner.config ? path.relative(skillRoot, owner.file) : null,
      ...(owner.error ? { error: owner.error } : {}),
      ...(owner.configInvalid ? { configInvalid: owner.configInvalid } : {}),
      effort: owner.effort ?? null,
      preferredProvider: owner.preferredProvider,
      ...(w.modelFunction ? { kernelRole: owner.cfgRole, pool: owner.cfgPoolName ?? null, members: owner.cfgMembers ?? null } : {}),
    },
    assumptions: {
      approved: w.approved, scope: w.scope, noExternalEffects: w.noExternalEffects,
      strictMachineGates: w.strictMachineGates, freshIndependentReview: w.freshIndependentReview,
    },
    rules: path.relative(skillRoot, rules.file),
    pick: pick ? { target: pick.c.target, model: modelFor(pick.c), mode: pick.mode, profile: pick.c.profile } : null,
    rule,
    orderSource,
    fallbackChain: pickedSet.slice(1).map(e => ({ target: e.c.target, model: modelFor(e.c), mode: e.mode })),
    fallbackPolicy: rules.fallbackAdvanceWhen,
    admission,
    rejected: evaluated.filter(e => !e.eligible).map(e => ({ target: e.c.target, reasons: e.reasons })),
    ...(availability ? { availability: Object.fromEntries(evaluated.filter(e => e.availability)
      .map(e => [e.c.target, { provider: e.availability.provider, state: e.availability.state, quota: e.availability.quota, reason: e.availability.reason }])) } : {}),
  };
  if (pick && !w.modelFunction && pick.mode === 'probation')
    result.note = 'probation admits exactly one target for one durable job; fallbackChain lists order, not parallel admission';
  return { result, pick, modelFor };
}

function printRoutingHeader({ ctx, owner, result }) {
  const { w, difficulty, measured, route } = ctx;
  const floorNote = difficulty !== measured ? ` (raised from ${measured} to floor ${route.floor})` : '';
  console.log(`workload: kind=${w.kind} role=${w.role ?? '(none)'} work=${w.work ?? '(unclassified)'} difficulty=${difficulty}${floorNote} risk=${w.risk} floor=${w.qualityFloor} tools=[${w.tools}] ctx=${w.contextTokens}` +
    (w.elevated ? '  ELEVATED' : '') + (w.modelFunction ? '  KERNEL-FUNCTION' : ''));
  console.log(`assumed: approved=${w.approved} local noExternalEffects=${w.noExternalEffects} strictMachineGates=${w.strictMachineGates} freshIndependentReview=${w.freshIndependentReview}`);
  console.log(`config: ${result.config.file ?? 'absent'}` +
    (result.config.effort ? `  effort=${result.config.effort}` : '') +
    (owner.preferredProvider ? `  preferredProvider=${owner.preferredProvider} (bias, not a chain)` : '') +
    (result.config.pool ? `  ${result.config.kernelRole} pool '${result.config.pool}' -> [${(result.config.members ?? []).join(', ')}]` : '') +
    (owner.error ? `  (${owner.error})` : ''));
}

function printPick({ args, pick, modelFor, orderSource, rule, result }) {
  console.log(`PICK ${pick.c.target}  model=${modelFor(pick.c)}  mode=${pick.mode}`);
  console.log(`  rule: ${rule}`);
  console.log(`  order: ${orderSource}`);
  if (result.availability) console.log(`  availability: ${Object.entries(result.availability).map(([t, a]) => t + '=' + a.state).join(' ')}`);
  if (result.fallbackChain.length) {
    console.log('fallback chain:');
    for (const f of result.fallbackChain) console.log(`  -> ${f.target} (${f.model}) [${f.mode}]`);
  }
  if (result.note) console.log(`  note: ${result.note}`);
  if (args.verbose) for (const r of result.rejected) console.log(`  rejected ${r.target}: ${r.reasons.join('; ')}`);
}

function printRefusal({ rule, result }) {
  console.log(`REFUSAL — ${rule}`);
  for (const r of result.rejected) console.log(`  ${r.target}: ${r.reasons.join('; ')}`);
}

function printRouting({ args, ctx, owner, result, pick, modelFor, orderSource, rule }) {
  printRoutingHeader({ ctx, owner, result });
  if (pick) printPick({ args, pick, modelFor, orderSource, rule, result });
  else printRefusal({ rule, result });
}

// Every candidate judged for the workload, in launch order. Kernel functions route inside the configured non-operation pool
// when the owner config declares one (models.nonOperation.<role> → pools.<name>) — the same binding engine/config.mjs
// resolves via nonOperationModels().
async function judgeCandidates({ args, ctx, owner, candidates }) {
  const { rules, runtimes, evidenceByRuntime, route, difficulty, w } = ctx;
  const thinkOrder = thinkOrderOf(runtimes, route, w);
  const { orderKey, order, orderSource, kernelGroup } = launchOrderOf({ args, ctx, owner, think: thinkOrder });
  const ordered = orderedCandidates(candidates, order, owner.preferredProvider);
  const chainDeclared = orderSource.startsWith('registry.yaml') || orderSource.startsWith('config.yaml') || orderSource.startsWith('runtimes.yaml allocation.');
  const availability = w.modelFunction ? await availabilityReader(args.repo) : null;
  const judging = { args, w, rules, runtimes, evidenceByRuntime, difficulty, availability, kernelGroup, think: w.work === 'think', thinkKey: thinkOrder.thinkKey,
    thinkPools: thinkOrder.thinkPools, order, orderSource, orderKey, chainDeclared };
  const evaluated = ordered.map(c => evaluateCandidate(c, judging));
  availability?.close();
  return { evaluated, availability, orderSource };
}

async function main() {
  const args = parseArgs(process.argv.slice(2), fileURLToPath(import.meta.url));
  if (!args.kind) { console.error('--kind is required'); process.exit(2); }
  const ctx = loadRoute(args);
  const { modelsDir, rules, registry, runtimes, evidenceByRuntime, difficulty, w } = ctx;
  const owner = ownerBindingOf(args, w);
  const candidates = loadCandidates(modelsDir);
  if (args.plan) {
    if (!PLAN_COLD_MINUTES[args.difficulty]) { console.error('--plan requires --difficulty <easy|medium|hard|insane>'); process.exit(2); }
    runPlan({ ...args, difficulty }, rules, runtimes, w, evidenceByRuntime, owner);
    return;
  }

  const { evaluated, availability, orderSource } = await judgeCandidates({ args, ctx, owner, candidates });
  const { pickedSet, rule, admission } = admittedModelSet({ evaluated, w, args, difficulty, registry, runtimes, effort: owner.effort });
  const { result, pick, modelFor } = routingResult({ args, ctx, owner, evaluated, availability, orderSource, pickedSet, rule, admission });
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else printRouting({ args, ctx, owner, result, pick, modelFor, orderSource, rule });
  if (!pick) process.exit(1);
}

await main();
