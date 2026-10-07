#!/usr/bin/env node
// route-model.mjs — resolve which tier members may take a workload, by EXECUTING the declarative rules in
// modules/models/selection.yaml (the source of truth). The candidates are the members of the workload's tier
// (modules/models/tiers.yaml: a kernel function takes its seat's tier, an op the tier of its difficulty); the qualification
// gates (modules/models/qualifications.yaml — empty means no measured qualification, so eligible routes are probation, the
// kernel-function step for the kernel's own calls, or refusal) decide which of them are eligible, and the common picker
// (scripts/lib/tier-pick.mjs) orders them.
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
//       [--plan]                what-if view: walk the workload's tier chain;
//                               missing or stale qualification evidence is
//                               ANNOTATED, not fatal
//       [--repo <path>]         kernel-function kinds also read that repository
//                               ledger's provider-health circuit (open → unavailable)
//       [--json] [--modelsDir <dir>] [--verbose]
//       --help prints this argument description
//
// Prints: picked member (+model for the role), the rule that fired, the pick record
// (tier, chain after each step, who was dropped and why), the ordered fallback chain, and per-candidate rejection reasons. Exit 1 on refusal
// ('no eligible model' — a typed exclusion, never a silent swap).
//
// Owner config: <skillRoot>/config.yaml (gitignored, seeded from
// config.example.yaml by the installer) is consulted for what it owns —
// models.tiers / models.seats override the shipped tiers and effort is
// surfaced for the caller. A missing config changes nothing.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { kindRoute, raiseToFloor, missingHostTools, providerAvailability, providerCircuitOf } from '../agent/models.mjs';
import { tierMembers, tierOfOp, tierOfSeat, tierSettings } from '../agent/tiers.mjs';
import { pickRecordText } from '../lib/pick-record.mjs';
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
// The candidates are the members of the workload's tier, in chain order: a kernel function takes the tier of its seat
// (tiers.yaml kindSeats -> seats), any other op the tier of its difficulty (or its kind's own tier, tiers.yaml kindTiers).

function candidatesOf(tier, settings, registry) {
  return tierMembers(tier, { settings, registry }).map(member => ({
    id: member.pool ?? member.id, member: member.id, target: member.target ?? member.id, pool: member.pool,
    provider: member.provider, model: member.model, effort: member.effort,
    roles: registry?.pools?.[member.pool]?.roles ?? [], maxParallel: registry?.pools?.[member.pool]?.maxParallel ?? null,
    profile: fs.existsSync(path.join(skillRoot, 'modules', 'models', 'profiles', `${member.target}.yaml`))
      ? `profiles/${member.target}.yaml` : 'modules/models/registry.yaml',
  }));
}

// --- plan mode: what-if tier preview ---------------------------------------------
//
// --plan previews allocation for goal planning: it walks the workload's tier chain and evaluates each member with the same
// qualification/probation gates — except a missing or stale evidence file is annotated rather than allowed to fail the pick.
// Nothing is admitted, launched or written; this is a view, not a route.

const PLAN_COLD_MINUTES = { easy: 15, medium: 45, hard: 90, insane: 180 };
// Failures that mean "no usable evidence" rather than "evidence proved unfit":
// a pick may still be previewed past these, annotated.
const PLAN_EVIDENCE_ABSENT = new Set([
  'model qualification evidence is missing',
  'qualification is stale',
  'qualification date is invalid',
]);

function planEvidenceNote(evidence, qr) {
  if (evidence?.schema !== 'starci/model-qualification@1')
    return 'no qualification evidence on disk';
  if (qr.includes('qualification is stale')) return 'qualification evidence on disk is stale';
  if (qr.includes('qualification date is invalid')) return 'qualification evidence on disk has an invalid date';
  return null;
}

// Why a member is off the launch path for this workload (role, host tools), or [].
function structuralReasons(c, { w, runtimes }) {
  const pool = runtimes?.runtimes?.[c.pool] ?? { provider: c.provider };
  if (!c.pool) return [`no registry.yaml pool for agent '${c.provider}'`];
  if (w.role && c.roles.length && !c.roles.includes(w.role)) return [`pool does not serve role '${w.role}'`];
  return missingHostTools({ pool, kind: w.kind }).map(tool => `pool agent '${c.provider}' lacks host tool '${tool}' required by kind '${w.kind}' (route.riskHints host-tool-required:${tool})`);
}

function planCandidates(candidates, e) {
  const { w, rules, evidenceByRuntime } = e;
  const probationReasons = probationAdmissionReasons(w, rules);
  return candidates.map(c => {
    const pf = preflightFor(e.runtimes?.runtimes?.[c.pool]);
    const base = { id: c.id, target: c.target, member: c.member, provider: c.provider, model: c.model, maxParallel: c.maxParallel,
      effort: c.effort ?? null, preflight: pf.probes, ...(pf.declared ? { preflightDeclared: pf.declared } : {}) };
    const structural = structuralReasons(c, e);
    if (structural.length) return { ...base, status: 'rejected', structural: true, reasons: structural };
    const evidence = evidenceByRuntime[c.id];
    const qr = qualificationReasons({ provider: c.provider, model: c.model, target: c.target, version: null }, evidence, w, rules);
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

// The owner-config line a plan prints: the config file, its error and the effort.
function planConfigLine(owner) {
  return {
    file: owner.config ? path.relative(skillRoot, owner.file) : null,
    ...(owner.error ? { error: owner.error } : {}),
    ...(owner.configInvalid ? { configInvalid: owner.configInvalid } : {}),
    effort: owner.effort ?? null,
  };
}

function printPlanJson({ args, w, configLine, tier, chain, evaluated, primary, fallbacks, estimate, record }) {
  console.log(JSON.stringify({
    plan: true,
    difficulty: args.difficulty,
    workload: w,
    config: configLine,
    tier: { name: tier, chain },
    pickRecord: record,
    candidates: evaluated.map(c => ({
      target: c.target, member: c.member, provider: c.provider, model: c.model,
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
  const spec = `provider=${c.provider ?? '(none)'}  model=${c.model ?? '(none)'}  maxParallel=${c.maxParallel ?? '(none)'}  preflight=[${(c.preflight ?? []).join(',')}]`;
  console.log(`  ${i + 1}. ${c.member}  ${spec}  status=${c.status}` + (c.note ? `  (${c.note})` : ''));
  if (verbose && c.reasons?.length) console.log(`     reasons: ${c.reasons.join('; ')}`);
}

function printPlanText({ args, w, configLine, tier, chain, evaluated, primary, fallbacks, estimate, record }) {
  console.log(`plan what-if: kind=${w.kind} role=${w.role ?? '(none)'} difficulty=${args.difficulty}`);
  console.log(`workload: risk=${w.risk} floor=${w.qualityFloor} tools=[${w.tools}] ctx=${w.contextTokens}` +
    (w.elevated ? '  ELEVATED' : '') + (w.modelFunction ? '  KERNEL-FUNCTION' : ''));
  console.log(`config: ${configLine.file ?? 'absent'}` + (configLine.effort ? `  effort=${configLine.effort}` : '') + (configLine.error ? `  (${configLine.error})` : ''));
  console.log(`tier: ${tier}  ->  [${chain.join(', ') || '(empty)'}]`);
  for (const line of pickRecordText(record)) console.log(`  ${line}`);
  console.log('candidates:');
  evaluated.forEach((c, i) => printPlanCandidate(c, i, args.verbose));
  if (primary) {
    console.log(`primary: ${primary.member} (${planReasonFor(primary)})`);
    console.log(`fallbacks: [${fallbacks.map((c) => c.member + ' (' + c.status + ')').join(', ')}]`);
  } else {
    console.log(`primary: none — no member of tier ${tier} can preview this workload`);
    for (const c of evaluated.filter(c => c.reasons?.length)) console.log(`  ${c.member}: ${c.reasons.join('; ')}`);
  }
  console.log(`estimate: cold ~${estimate.coldMinutes}m for ${/^[aeiou]/i.test(args.difficulty) ? 'an' : 'a'} ${args.difficulty} operation`);
}

function runPlan(args, e, owner) {
  const { w, tier, candidates } = e;
  const evaluated = planCandidates(candidates, e);
  // Pickable = not structurally off the chain, and any rejection rests only on absent/stale evidence (annotation,
  // not a real disqualification) — the point of plan mode is "who takes this once qualification exists".
  const pickable = evaluated.filter(c => !c.structural && (c.status !== 'rejected' || c.qr.every(r => PLAN_EVIDENCE_ABSENT.has(r))));
  const statusRank = { qualified: 0, 'probation-only': 1, rejected: 2 };
  const ordered = [...pickable].sort((a, b) => statusRank[a.status] - statusRank[b.status] || candidates.findIndex(c => c.id === a.id) - candidates.findIndex(c => c.id === b.id));
  const primary = ordered[0] ?? null;
  const chosen = primary ? [{ id: primary.member, by: 'chain-order' }][0] : null;
  const record = { tier, chain: candidates.map(c => c.member), steps: [{ step: 'hard-filter', chain: evaluated.filter(c => !c.structural).map(c => c.member) },
    { step: 'tokens', chain: ordered.map(c => c.member) }], dropped: evaluated.filter(c => c.structural).map(c => ({ id: c.member, step: 'hard-filter', reason: c.reasons[0] })), chosen };
  const estimate = { difficulty: args.difficulty, coldMinutes: PLAN_COLD_MINUTES[args.difficulty] };
  const shown = { args, w, configLine: planConfigLine(owner), tier, chain: candidates.map(c => c.member), evaluated, primary, fallbacks: ordered.slice(1), estimate, record };
  if (args.json) printPlanJson(shown);
  else printPlanText(shown);
  if (!primary) process.exit(1);
}

// --- availability ------------------------------------------------------------------
// Kernel-function kinds read each candidate provider's quota probe and, with --repo, that ledger's provider-health circuit
// (scripts/agent/models.mjs providerAvailability). Memoized per provider; a probe that cannot answer is 'unknown' and never blocks.
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
  // The merged runtimes view: runtimes.yaml's allocation policy plus the ONE catalog's pool map (registry.yaml pools) under `runtimes`.
  const runtimes = { ...readYaml(path.join(modelsDir, 'runtimes.yaml')), runtimes: registry?.pools ?? {} };
  const quals = readYaml(path.join(modelsDir, 'qualifications.yaml'));
  const evidenceByRuntime = {};
  for (const rec of quals?.qualifications ?? []) if (rec?.runtimeId) evidenceByRuntime[rec.runtimeId] = rec;

  const kindEntry = kinds?.kinds?.[args.kind] ?? null;
  // Machine checks the op declares: kinds.yaml checks + the op's own layoutPolicy.checks (every record-writing op runs e.g. starci-validate).
  const opYaml = readYaml(path.join(skillRoot, 'modules', 'ops', 'ops', `${args.kind}.yaml`));
  const declaredChecks = [...(kindEntry?.checks ?? []), ...(opYaml?.layoutPolicy?.checks ?? [])];
  // runtimes.yaml roleOfKind is the allocator's reading of the kind: its role, think/hands-on work and difficulty floor.
  const route = kindRoute(args.kind, runtimes);
  const measured = args.difficulty ?? 'medium';
  const difficulty = raiseToFloor(measured, route.floor) ?? measured;
  const w = deriveWorkload({ ...args, role: args.plan ? args.role ?? route.role ?? kindEntry?.role : args.role ?? kindEntry?.role ?? route.role }, rules, kindEntry, declaredChecks);
  w.work = route.work;
  w.difficulty = { measured, floor: route.floor, effective: difficulty };
  const settings = tierSettings({ config: inspectOwnerConfig(ownerRoot).config, registry });
  const seat = settings.kindSeats?.[args.kind] ?? null;
  const tier = seat ? tierOfSeat(seat, settings) : tierOfOp({ kind: args.kind, difficulty }, settings);
  return { modelsDir, rules, registry, runtimes, evidenceByRuntime, route, measured, difficulty, w, tier, seat, candidates: candidatesOf(tier, settings, registry) };
}

// Owner config (config.yaml): effort is surfaced for the caller. Absent file → no effect.
function ownerBindingOf(w) {
  const ownerFile = inspectOwnerConfig(ownerRoot);
  const ownerCfg = ownerFile.config;
  const effort = (w.modelFunction ? ownerCfg?.kernel?.effort ?? ownerCfg?.effort : ownerCfg?.effort) ?? null;
  return { file: ownerFile.file, config: ownerCfg, error: ownerFile.error, configInvalid: ownerFile.invalid ?? null, effort };
}

// One candidate judged: eligible with a mode (qualified, probation, kernel-function) or rejected with reasons.
function evaluateCandidate(c, e) {
  const { w, rules, evidenceByRuntime, availability } = e;
  const reasons = structuralReasons(c, e);
  if (reasons.length) return { c, eligible: false, mode: null, reasons };
  const avail = availability?.read(c.provider) ?? null;
  if (avail?.state === 'unavailable')
    return { c, eligible: false, mode: null, availability: avail, reasons: [`provider ${c.provider} unavailable: ${avail.reason}`] };
  const qr = qualificationReasons({ provider: c.provider, model: c.model, target: c.target, version: null }, evidenceByRuntime[c.id], w, rules);
  if (!qr.length) return { c, eligible: true, mode: 'qualified', reasons: [], availability: avail };
  const pr = probationAdmissionReasons(w, rules);
  if (!pr.length) return { c, eligible: true, mode: 'probation', reasons: [], qualifiedFailed: qr, availability: avail };
  // selection.yaml decisionFlow kernel-function: the kernel's own calls on their seat's tier need no qualification record.
  if (w.modelFunction) return { c, eligible: true, mode: 'kernel-function', reasons: [], qualifiedFailed: qr, availability: avail };
  return { c, eligible: false, mode: null, reasons: [...qr, ...pr], availability: avail };
}

// The result document of a routing: the pick, the fallback chain, why the others were rejected, the quota availability read.
function routingResult({ ctx, owner, evaluated, availability, pickedSet, rule, admission }) {
  const { w, rules, tier } = ctx;
  const pick = pickedSet[0] ?? null;
  const result = {
    workload: w,
    config: {
      file: owner.config ? path.relative(skillRoot, owner.file) : null,
      ...(owner.error ? { error: owner.error } : {}),
      ...(owner.configInvalid ? { configInvalid: owner.configInvalid } : {}),
      effort: owner.effort ?? null,
    },
    assumptions: {
      approved: w.approved, scope: w.scope, noExternalEffects: w.noExternalEffects,
      strictMachineGates: w.strictMachineGates, freshIndependentReview: w.freshIndependentReview,
    },
    rules: path.relative(skillRoot, rules.file),
    tier,
    pick: pick ? { target: pick.c.target, model: pick.c.model, effort: pick.c.effort ?? null, mode: pick.mode, profile: pick.c.profile } : null,
    rule,
    orderSource: `tiers.yaml tiers.${tier}`,
    pickRecord: admission?.pick ?? null,
    fallbackChain: pickedSet.slice(1).map(e => ({ target: e.c.target, model: e.c.model, mode: e.mode })),
    fallbackPolicy: rules.fallbackAdvanceWhen,
    admission,
    rejected: evaluated.filter(e => !e.eligible).map(e => ({ target: e.c.target, reasons: e.reasons })),
    ...(availability ? { availability: Object.fromEntries(evaluated.filter(e => e.availability)
      .map(e => [e.c.target, { provider: e.availability.provider, state: e.availability.state, quota: e.availability.quota, reason: e.availability.reason }])) } : {}),
  };
  if (pick && !w.modelFunction && pick.mode === 'probation')
    result.note = 'probation admits exactly one target for one durable job; fallbackChain lists order, not parallel admission';
  return { result, pick };
}

function printRouting({ args, ctx, owner, result, pick, rule }) {
  const { w, difficulty, measured, route } = ctx;
  const floorNote = difficulty !== measured ? ` (raised from ${measured} to floor ${route.floor})` : '';
  console.log(`workload: kind=${w.kind} role=${w.role ?? '(none)'} work=${w.work ?? '(unclassified)'} difficulty=${difficulty}${floorNote} risk=${w.risk} floor=${w.qualityFloor} tools=[${w.tools}] ctx=${w.contextTokens}` +
    (w.elevated ? '  ELEVATED' : '') + (w.modelFunction ? '  KERNEL-FUNCTION' : ''));
  console.log(`assumed: approved=${w.approved} local noExternalEffects=${w.noExternalEffects} strictMachineGates=${w.strictMachineGates} freshIndependentReview=${w.freshIndependentReview}`);
  console.log(`config: ${result.config.file ?? 'absent'}` + (result.config.effort ? `  effort=${result.config.effort}` : '') + (owner.error ? `  (${owner.error})` : ''));
  if (!pick) {
    console.log(`REFUSAL — ${rule}`);
    for (const r of result.rejected) console.log(`  ${r.target}: ${r.reasons.join('; ')}`);
    return;
  }
  console.log(`PICK ${pick.c.target}  model=${pick.c.model}  mode=${pick.mode}`);
  console.log(`  rule: ${rule}`);
  console.log(`  order: ${result.orderSource}`);
  for (const line of pickRecordText(result.pickRecord)) console.log(`  ${line}`);
  if (result.availability) console.log(`  availability: ${Object.entries(result.availability).map(([t, a]) => t + '=' + a.state).join(' ')}`);
  if (result.fallbackChain.length) {
    console.log('fallback chain:');
    for (const f of result.fallbackChain) console.log(`  -> ${f.target} (${f.model}) [${f.mode}]`);
  }
  if (result.note) console.log(`  note: ${result.note}`);
  if (args.verbose) for (const r of result.rejected) console.log(`  rejected ${r.target}: ${r.reasons.join('; ')}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2), fileURLToPath(import.meta.url));
  if (!args.kind) { console.error('--kind is required'); process.exit(2); }
  const ctx = loadRoute(args);
  const { evidenceByRuntime, runtimes, difficulty, w, rules, registry, tier, candidates } = ctx;
  const owner = ownerBindingOf(w);
  if (args.plan) {
    if (!PLAN_COLD_MINUTES[args.difficulty]) { console.error('--plan requires --difficulty <easy|medium|hard|insane>'); process.exit(2); }
    runPlan({ ...args, difficulty }, { w, rules, runtimes, evidenceByRuntime, tier, candidates }, owner);
    return;
  }
  const availability = w.modelFunction ? await availabilityReader(args.repo) : null;
  const judging = { w, rules, runtimes, evidenceByRuntime, availability };
  const evaluated = candidates.map(c => evaluateCandidate(c, judging));
  availability?.close();
  const { pickedSet, rule, admission } = admittedModelSet({ evaluated, w, args, difficulty, registry, runtimes, effort: owner.effort, tier });
  const { result, pick } = routingResult({ ctx, owner, evaluated, availability, pickedSet, rule, admission });
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else printRouting({ args, ctx, owner, result, pick, rule });
  if (!pick) process.exit(1);
}

await main();
