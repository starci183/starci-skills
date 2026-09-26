#!/usr/bin/env node
// route-model.mjs — resolve which model target may take a workload, by EXECUTING
// the declarative rules in modules/models/selection.yaml (the source of truth).
// Ordering facts come from the files
// selection.yaml cites: modules/models/runtimes.yaml (preference/tiers) and
// modules/models/qualifications.yaml (the shipped evidence store — empty means
// no measured qualification, so eligible routes are probation, the
// kernel-function step for the kernel's own calls, or refusal).
//
// CLI:
//   node scripts/route/route-model.mjs --kind <kind>
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
//                               kind's runtimes.yaml roleOfKind floor; alias
//                               spellings (s|m|l|xl, 'high') are normalized
//       [--prefer <pool>[,<pool>...]] [--avoid <pool>[,<pool>...]]
//                               bounded pool bias over the walked chain (prefer
//                               hoists, avoid removes; never bypasses eligibility)
//       [--plan]                what-if view: walk the runtimes.yaml difficulty tier
//                               (∩ per-role preference) instead of the declared
//                               operator chain; missing or stale qualification
//                               evidence is ANNOTATED, not fatal
//       [--repo <path>]         kernel-function kinds also read that repository
//                               ledger's provider-health circuit (open → unavailable)
//       [--json] [--modelsDir <dir>] [--verbose]
//   node scripts/route/route-model.mjs --help   prints this usage
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
import { normalizeDifficulty, chainFor, applyBias, resolveLaunchModel, kindRoute, orderKeyOf, raiseToFloor, missingHostTools,
  providerAvailability, providerCircuitOf } from '../agent/models.mjs';
import { inspectOwnerConfig } from '../../engine/config.mjs';
import { inspectLedger, ledgerFileFor } from '../../engine/ledger-db.mjs';

const skillRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const readYaml = p => (fs.existsSync(p) ? parseYaml(fs.readFileSync(p, 'utf8')) : null);

// --- owner config (config.yaml) --------------------------------------------------
// engine/config.mjs inspectOwnerConfig is the one reader. STARCI_OWNER_ROOT
// points it at a different directory holding a config.yaml (test and tooling
// seam). A missing, unparsable or schema-short file is never fatal — routing
// degrades to "no config" and reports why.
const ownerRoot = process.env.STARCI_OWNER_ROOT ? path.resolve(process.env.STARCI_OWNER_ROOT) : skillRoot;

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
// a dispatch can be trusted: credentialRefresh env repair (qwen's stale-key
// unset), a commandPrefix auth probe (devin's `devin models list` check), the
// readiness screen, and post-submission attestation. An explicit `preflight:`
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
  if (card?.credentialRefresh) probes.push('credential-refresh');
  if (card?.commandPrefix) probes.push('auth-probe');
  if (Array.isArray(card?.environmentStrip) && card.environmentStrip.length) probes.push('env-strip');
  if (card?.readiness) probes.push(typeof card.readiness === 'string' ? card.readiness : 'readiness-screen');
  if (card?.attestation || Array.isArray(card?.knownFailures)) probes.push('post-submit-attestation');
  if (!card) probes.push('no-adapter-card');
  return { probes, declared: null };
}

// runtimes.yaml is the single capacity authority — model profiles repeat
// capacity.maxParallel as a cached copy that can drift. Drift is reported,
// never silently reconciled: the runtimes.yaml value always wins.
function capacityDrift(candidates, runtimes) {
  const out = [];
  for (const c of candidates) {
    const declared = runtimes?.runtimes?.[c.id]?.maxParallel;
    const cached = c.profileMaxParallel;
    if (cached != null && declared != null && Number(cached) !== Number(declared))
      out.push({ target: c.id, profileMaxParallel: Number(cached), runtimesMaxParallel: Number(declared) });
  }
  return out;
}

function parseArgs(argv) {
  const a = { tools: [], prefer: [], avoid: [] };
  const take = i => {
    const v = argv[i + 1];
    if (v === undefined) { console.error(`missing value for ${argv[i]}`); process.exit(2); }
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--help' || k === '-h') {
      const header = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n');
      const from = header.findIndex(line => line.startsWith('// CLI:'));
      const to = header.findIndex(line => line.startsWith('// Owner config:'));
      console.log(header.slice(from, to).map(line => line.replace(/^\/\/ ?/, '')).join('\n').trimEnd());
      process.exit(0);
    }
    if (k === '--kind') a.kind = take(i), i++;
    else if (k === '--role') a.role = take(i), i++;
    else if (k === '--domain') a.domain = take(i), i++;
    else if (k === '--risk') a.risk = take(i), i++;
    else if (k === '--floor') a.floor = take(i), i++;
    else if (k === '--tools') a.tools.push(...take(i).split(',')), i++;
    else if (k === '--contextTokens') a.contextTokens = Number(take(i)), i++;
    else if (k === '--external') a.external = true;
    else if (k === '--unapproved') a.approved = false;
    else if (k === '--no-review') a.review = false;
    else if (k === '--no-checks') a.checks = false;
    else if (k === '--difficulty') a.difficulty = take(i), i++;
    else if (k === '--prefer') a.prefer.push(...take(i).split(',')), i++;
    else if (k === '--avoid') a.avoid.push(...take(i).split(',')), i++;
    else if (k === '--plan') a.plan = true;
    else if (k === '--json') a.json = true;
    else if (k === '--verbose') a.verbose = true;
    else if (k === '--modelsDir') a.modelsDir = take(i), i++;
    else if (k === '--repo') a.repo = take(i), i++;
    else { console.error(`unknown arg ${k}`); process.exit(2); }
  }
  a.tools = [...new Set(a.tools.map(s => s.trim()).filter(Boolean))].sort();
  a.prefer = [...new Set(a.prefer.map(s => s.trim()).filter(Boolean))];
  a.avoid = [...new Set(a.avoid.map(s => s.trim()).filter(Boolean))];
  a.bias = (a.prefer.length || a.avoid.length) ? { prefer: a.prefer, avoid: a.avoid } : null;
  if (a.difficulty != null) a.difficulty = normalizeDifficulty(a.difficulty) ?? a.difficulty;
  return a;
}

// --- selection.yaml-driven data -------------------------------------------------

function loadRules(modelsDir) {
  const file = path.join(modelsDir, 'selection.yaml');
  const doc = readYaml(file);
  if (!doc || doc.schema !== 'starci/module-model-selection@1')
    throw Error(`selection.yaml missing or wrong schema at ${file}`);
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

// --- gates (selection.yaml §4-5) -------------------------------------------------

const rank = (order, v) => order.indexOf(v);

function qualificationReasons(runtime, evidence, w, rules) {
  if (!evidence || evidence.schema !== 'starci/model-qualification@1')
    return ['model qualification evidence is missing'];
  const r = [];
  const selModel = runtime.model ?? runtime.target;
  if (!evidence.provider || !evidence.model || !evidence.version) r.push('model identity qualification is incomplete');
  if (evidence.provider !== runtime.provider || evidence.model !== selModel || !runtime.version || evidence.version !== runtime.version)
    r.push('qualification does not match selected runtime identity');
  if (!evidence.suite || !evidence.measuredAt || typeof evidence.outcomes !== 'object' || !evidence.outcomes)
    r.push('measurable qualification evidence is incomplete');
  if (evidence.verified !== true || evidence.receipt?.schema !== 'starci/model-evaluation-receipt@1' || !evidence.receipt?.artifact?.sha256)
    r.push('verified evaluator artifact receipt is missing');
  const measured = Date.parse(evidence.measuredAt), expires = Date.parse(evidence.expiresAt ?? '');
  if (!Number.isFinite(measured) || measured > Date.now()) r.push('qualification date is invalid');
  if ((evidence.expiresAt && !Number.isFinite(expires)) || (Number.isFinite(expires) && expires <= Date.now())) r.push('qualification is stale');
  if (!['independent-eval', 'verified-runtime-eval'].includes(evidence.source) || evidence.attestation === 'self-claimed')
    r.push('qualification provenance is not trusted');
  if (!rules.riskOrder.includes(w.risk)) r.push(`unknown workload risk ${w.risk || '(empty)'}`);
  if (!rules.floorOrder.includes(w.qualityFloor)) r.push(`unknown quality floor ${w.qualityFloor || '(empty)'}`);
  if (!(evidence.workloads ?? []).some(x => x === w.kind || x === '*')) r.push(`workload ${w.kind || '(unknown)'} is not qualified`);
  if (!(evidence.domains ?? []).some(x => x === w.domain || x === '*')) r.push(`domain ${w.domain} is not qualified`);
  for (const t of w.tools) if (!(evidence.tools ?? []).includes(t)) r.push(`required tool ${t} is not qualified`);
  if (w.contextTokens > Number(evidence.maxContextTokens ?? 0)) r.push('required context exceeds qualified context');
  if (rank(rules.floorOrder, evidence.qualityFloor) < rank(rules.floorOrder, w.qualityFloor)) r.push(`quality floor ${w.qualityFloor} is not met`);
  if (rank(rules.riskOrder, evidence.maxRisk) < rank(rules.riskOrder, w.risk)) r.push(`risk ${w.risk} is not qualified`);
  if (evidence.outcomes?.status !== 'pass' || Number(evidence.outcomes?.cases ?? 0) < 1
    || Number(evidence.outcomes?.passRate ?? 0) < Number(evidence.thresholds?.minPassRate ?? 1))
    r.push('qualification outcomes do not pass');
  return r;
}

function probationAdmissionReasons(w, rules) {
  // localProbationAllowed + probation recordGates as they apply to a freshly
  // created record (fresh scope: remainingAttempts 2, workloads [w.kind]).
  const r = [];
  if (w.approved !== true) r.push('probation requires an approved workflow');
  if (w.scope !== 'local') r.push('probation requires local scope');
  if (w.noExternalEffects !== true) r.push('probation forbids external effects');
  if (w.strictMachineGates !== true) r.push('probation requires declared machine gates');
  if (w.freshIndependentReview !== true) r.push('probation requires fresh independent review');
  if (rules.highKinds.has(w.kind) || ['high', 'critical'].includes(w.risk) || rules.probationFloorBan.includes(w.qualityFloor))
    r.push('probation cannot satisfy elevated quality or risk');
  if (!rules.riskOrder.includes(w.risk)) r.push(`unknown workload risk ${w.risk || '(empty)'}`);
  if (!rules.floorOrder.includes(w.qualityFloor)) r.push(`unknown quality floor ${w.qualityFloor || '(empty)'}`);
  if (!w.probationEligible) r.push('workload shape is not probation-eligible (needs machine checks + fresh review, or a kernel function)');
  return r;
}

// --- candidates ------------------------------------------------------------------

function loadCandidates(modelsDir) {
  const index = readYaml(path.join(modelsDir, 'index.yaml'));
  const pools = (index?.pools ?? []).filter(p => p.automaticChains !== false);
  const out = [];
  for (const pool of pools) {
    const profile = readYaml(path.join(modelsDir, pool.profile ?? `profiles/${pool.target}.yaml`));
    out.push({
      id: pool.target, target: profile?.target ?? pool.target,
      provider: profile?.provider ?? pool.provider,
      roles: profile?.capacity?.roles ?? pool.roles ?? [],
      profileMaxParallel: profile?.capacity?.maxParallel ?? null, // stale-prone copy — drift-checked vs runtimes.yaml
      profile: pool.profile ?? `profiles/${pool.target}.yaml`,
    });
  }
  return out;
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
// sort, then --prefer/--avoid bias applied (hoist/remove — never eligibility).
function planChain(runtimes, difficulty, role, bias) {
  const { chain, tierSource } = chainFor({ role, difficulty, runtimes });
  const biased = applyBias(chain, bias);
  const src = `${tierSource} ∩ allocation.preference.${role ?? '(none)'}` +
    (bias ? ' + bias' : '');
  return { chain: biased, source: src };
}

function planEvidenceNote(evidence, qr) {
  if (!evidence || evidence.schema !== 'starci/model-qualification@1')
    return 'no qualification evidence on disk';
  if (qr.includes('qualification is stale')) return 'qualification evidence on disk is stale';
  if (qr.includes('qualification date is invalid')) return 'qualification evidence on disk has an invalid date';
  return null;
}

function planCandidates(chain, runtimes, w, rules, evidenceByRuntime, difficulty, profileCap = {}) {
  const probationReasons = probationAdmissionReasons(w, rules);
  // A pool serves the kind when it serves its role or the order the kind walks
  // (owner routing 2026-09-26: the implement order's mechanical ops are
  // decide/plan/write-role kinds the hands take anyway) — the same gate
  // models.mjs::selectPool applies.
  const serveKey = orderKeyOf({ work: w.work, order: w.order }, w.role);
  return chain.map(id => {
    const rt = runtimes?.runtimes?.[id] ?? null;
    if (!rt) return { id, target: id, status: 'rejected', structural: true, reasons: ['no runtimes.yaml entry for this pool'] };
    // The launch model is the pool's per-difficulty pin (runtimes.yaml
    // models[difficulty]); a pool without that pin is structurally off this
    // chain, the same gate models.mjs::selectPool applies.
    const lm = resolveLaunchModel(id, difficulty, { runtimes });
    const model = lm.modelId ?? rt.target ?? id;
    const pf = preflightFor(rt);
    const base = { id, target: rt.target ?? id, provider: rt.provider ?? null, model, maxParallel: rt.maxParallel ?? null,
      effort: lm.effort ?? null,
      preflight: pf.probes, ...(pf.declared ? { preflightDeclared: pf.declared } : {}) };
    const pc = profileCap[id];
    if (pc != null && rt.maxParallel != null && Number(pc) !== Number(rt.maxParallel))
      base.capacityDrift = `profile pins maxParallel ${pc}; runtimes.yaml declares ${rt.maxParallel} (runtimes.yaml wins)`;
    if (w.role && rt.roles?.length && !rt.roles.includes(w.role) && !rt.roles.includes(serveKey))
      return { ...base, status: 'rejected', structural: true, reasons: [
        `pool does not serve role '${w.role}'${serveKey !== w.role ? ` or order '${serveKey}'` : ''}`] };
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

function runPlan(args, rules, runtimes, w, evidenceByRuntime, owner = {}, profileCap = {}) {
  const { chain, source } = planChain(runtimes, args.difficulty, orderKeyOf({ work: w.work, order: w.order }, w.role), args.bias);
  const evaluated = planCandidates(chain, runtimes, w, rules, evidenceByRuntime, args.difficulty, profileCap);
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
  const reasonFor = c => c.status === 'qualified'
    ? 'measured qualification evidence passes'
    : c.status === 'probation-only'
      ? (c.note ? `${c.note}; scoped probation would admit` : 'scoped probation would admit')
      : `what-if pick: ${c.note ?? 'no usable qualification evidence'} — launch still requires measured qualification (probation cannot satisfy this workload)`;
  const estimate = { difficulty: args.difficulty, coldMinutes: PLAN_COLD_MINUTES[args.difficulty] };

  const configLine = {
    file: owner.config ? path.relative(skillRoot, owner.file) : null,
    ...(owner.error ? { error: owner.error } : {}),
    ...(owner.configInvalid ? { configInvalid: owner.configInvalid } : {}),
    effort: owner.effort ?? null,
    preferredProvider: owner.preferredProvider ?? null,
    ...(w.modelFunction ? { kernelRole: owner.cfgRole ?? null, pool: owner.cfgPoolName ?? null, members: owner.cfgMembers ?? null } : {}),
  };
  if (args.json) {
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
        ...(c.capacityDrift ? { capacityDrift: c.capacityDrift } : {}),
        ...(c.note ? { evidence: c.note } : {}), ...(c.reasons?.length ? { reasons: c.reasons } : {}),
      })),
      ...(owner.drift?.length ? { capacityDrift: owner.drift } : {}),
      pick: primary
        ? { primary: { target: primary.target, model: primary.model, status: primary.status, ...(primary.effort ? { effort: primary.effort } : {}) }, reason: reasonFor(primary),
            fallbacks: fallbacks.map(c => ({ target: c.target, model: c.model, status: c.status })) }
        : null,
      estimate,
    }, null, 2));
  } else {
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
    evaluated.forEach((c, i) => {
      const spec = c.provider !== undefined
        ? `provider=${c.provider ?? '(none)'}  model=${c.model ?? '(none)'}  maxParallel=${c.maxParallel ?? '(none)'}  preflight=[${(c.preflight ?? []).join(',')}]`
        : '';
      console.log(`  ${i + 1}. ${c.target}  ${spec}  status=${c.status}` +
        (c.note ? `  (${c.note})` : ''));
      if (c.capacityDrift) console.log(`     capacity drift: ${c.capacityDrift}`);
      if (args.verbose && c.reasons?.length) console.log(`     reasons: ${c.reasons.join('; ')}`);
    });
    for (const d of owner.drift ?? [])
      console.log(`capacity drift: ${d.target} profile pins maxParallel ${d.profileMaxParallel}; runtimes.yaml declares ${d.runtimesMaxParallel} (runtimes.yaml wins)`);
    if (primary) {
      console.log(`primary: ${primary.target} (${reasonFor(primary)})`);
      console.log(`fallbacks: [${fallbacks.map(c => `${c.target} (${c.status})`).join(', ')}]`);
    } else {
      console.log(`primary: none — no pool on the ${args.difficulty} tier can preview this workload`);
      for (const c of evaluated.filter(c => c.reasons?.length)) console.log(`  ${c.target}: ${c.reasons.join('; ')}`);
    }
    console.log(`estimate: cold ~${estimate.coldMinutes}m for ${/^[aeiou]/i.test(args.difficulty) ? 'an' : 'a'} ${args.difficulty} operation`);
  }
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
  try { ({ probeQuota } = await import('../api/quota/index.mjs')); } catch { /* probe not installed */ }
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.kind) { console.error('--kind is required'); process.exit(2); }
  const modelsDir = path.resolve(args.modelsDir ?? path.join(skillRoot, 'modules', 'models'));
  const rules = loadRules(modelsDir);
  const kinds = readYaml(path.join(modelsDir, 'kinds.yaml'));
  const runtimes = readYaml(path.join(modelsDir, 'runtimes.yaml'));
  const registry = readYaml(path.join(modelsDir, 'registry.yaml'));
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

  // Owner config (config.yaml): models.nonOperation pools bind kernel-function
  // kinds to a configured pool, allocation.preferredProvider is a bounded owner
  // bias over order (never a fallback chain — it permutes, it does not shrink
  // eligibility), effort is surfaced for the caller. Absent file → no effect.
  const ownerFile = inspectOwnerConfig(ownerRoot);
  const ownerCfg = ownerFile.config;
  const cfgRole = KERNEL_FUNCTION_ROLE[args.kind] ?? null;
  const cfgPoolName = cfgRole ? ownerCfg?.models?.nonOperation?.[cfgRole] : null;
  const cfgPool = cfgPoolName ? ownerCfg?.models?.pools?.[cfgPoolName] : null;
  const cfgMembers = Array.isArray(cfgPool) ? cfgPool.filter(s => typeof s === 'string' && s.trim()) : null;
  const preferredProvider = typeof ownerCfg?.allocation?.preferredProvider === 'string'
    && ownerCfg.allocation.preferredProvider.trim() ? ownerCfg.allocation.preferredProvider.trim() : null;
  const effort = (w.modelFunction ? ownerCfg?.kernel?.effort ?? ownerCfg?.effort : ownerCfg?.effort) ?? null;
  const owner = { file: ownerFile.file, config: ownerCfg, error: ownerFile.error,
    configInvalid: ownerFile.invalid ?? null,
    cfgRole, cfgPoolName, cfgMembers, preferredProvider, effort };

  const candidates = loadCandidates(modelsDir);
  owner.drift = capacityDrift(candidates, runtimes);
  const profileCap = Object.fromEntries(candidates.map(c => [c.id, c.profileMaxParallel]));
  if (args.plan) {
    if (!PLAN_COLD_MINUTES[args.difficulty]) { console.error('--plan requires --difficulty <easy|medium|hard|insane>'); process.exit(2); }
    runPlan({ ...args, difficulty }, rules, runtimes, w, evidenceByRuntime, owner, profileCap);
    return;
  }

  // Kernel functions route inside the configured non-operation pool when the
  // owner config declares one (models.nonOperation.<role> → pools.<name>) —
  // the same binding engine/config.mjs resolves via nonOperationModels().
  const think = w.work === 'think';
  const frontier = runtimes?.allocation?.preference?.think ?? [];
  // The kernel's own calls walk the sol-think order (runtimes.yaml
  // allocation.preference.sol-think: Sol first, Opus as overflow — owner
  // routing 2026-09-26), falling back to the frontier think group when
  // sol-think is undeclared.
  const solThink = Array.isArray(runtimes?.allocation?.preference?.['sol-think'])
    ? runtimes.allocation.preference['sol-think'] : null;
  const kernelGroup = solThink ?? runtimes?.allocation?.frontier ?? frontier;
  const kernelGroupSource = solThink ? 'runtimes.yaml allocation.preference.sol-think' : 'runtimes.yaml allocation.frontier';
  // A think kind with its own order (review, ui, implement — the kind's declared
  // order) is held to that order; a kernel function to the sol-think order;
  // every other think kind to the think order.
  const thinkKey = think && route.order && !w.modelFunction && Array.isArray(runtimes?.allocation?.preference?.[route.order])
    ? route.order
    : w.modelFunction && solThink ? 'sol-think' : 'think';
  const thinkPools = thinkKey === 'think' ? frontier : runtimes.allocation.preference[thinkKey];
  const orderKey = orderKeyOf(route, w.role);
  let { order, source: orderSource } = candidateOrder(args.kind, orderKey, registry, runtimes);
  if (w.modelFunction && cfgMembers?.length) {
    order = cfgMembers;
    orderSource = `config.yaml models.nonOperation.${cfgRole} → pools.${cfgPoolName}`;
  } else if (w.modelFunction && !registry?.operators?.[args.kind]?.chain) {
    order = kernelGroup;
    orderSource = kernelGroupSource;
  }
  // --prefer/--avoid: the same bounded pool bias models.mjs::applyBias applies —
  // prefer hoists, avoid removes; eligibility gates below are untouched.
  const declaredOrder = order;
  if (args.bias) { order = applyBias(order, args.bias); orderSource += ' + bias(--prefer/--avoid)'; }
  const ordered = [...candidates].sort((a, b) => {
    const pa = preferredProvider && a.provider === preferredProvider ? 0 : 1;
    const pb = preferredProvider && b.provider === preferredProvider ? 0 : 1;
    const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
    return pa - pb || (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.id.localeCompare(b.id);
  });

  const chainDeclared = orderSource.startsWith('registry.yaml') || orderSource.startsWith('config.yaml') || orderSource.startsWith('runtimes.yaml allocation.');
  const availability = w.modelFunction ? await availabilityReader(args.repo) : null;
  const evaluated = ordered.map(c => {
    // Think work runs only on its think-class order - the frontier pools for
    // think, or the kind's own declared order (review, ui, implement) or the
    // kernel functions' sol-think order; neither a declared chain, a --prefer
    // nor preferredProvider can move it anywhere else.
    if (think && !thinkPools.includes(c.id))
      return { c, eligible: false, mode: null, reasons: [`think work runs only on runtimes.yaml allocation.preference.${thinkKey}`] };
    // A declared operator chain — or a configured non-operation pool — is a
    // closed set: pools absent from it are not on the launch path at all
    // (interface.draw → [codex-agent] only; kernelManager → its pool only).
    if (chainDeclared && !order.includes(c.id))
      return { c, eligible: false, mode: null, reasons: [
        args.bias?.avoid?.includes(c.id) && declaredOrder.includes(c.id)
          ? `pool removed by --avoid bias`
          : `pool is not on the declared chain for ${args.kind} (${orderSource})`] };
    // A pool serves the kind when it serves its role or the order the kind
    // walks (models.mjs::selectPool applies the same gate).
    if (w.role && c.roles.length && !c.roles.includes(w.role) && !c.roles.includes(orderKey))
      return { c, eligible: false, mode: null, reasons: [
        `pool does not serve role '${w.role}'${orderKey !== w.role ? ` or order '${orderKey}'` : ''}`] };
    const missingTools = missingHostTools({ pool: runtimes?.runtimes?.[c.id] ?? { provider: c.provider }, kind: args.kind });
    if (missingTools.length)
      return { c, eligible: false, mode: null, reasons: missingTools.map(tool => `pool agent '${c.provider}' lacks host tool '${tool}' required by kind '${args.kind}' (route.riskHints host-tool-required:${tool})`) };
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
  });
  availability?.close();

  // Quota-aware order among the eligible of one mode: available before limited,
  // declared order otherwise (a stable sort).
  const availabilityRank = e => (e.availability?.state === 'limited' ? 1 : 0);
  const byMode = mode => evaluated.filter(e => e.eligible && e.mode === mode)
    .map((e, i) => ({ e, i })).sort((a, b) => availabilityRank(a.e) - availabilityRank(b.e) || a.i - b.i).map(x => x.e);
  const qualified = byMode('qualified');
  const probationEligible = byMode('probation');
  const kernelFunctionEligible = byMode('kernel-function');
  // providerFilter: qualified set wins outright; else probation admits exactly
  // ONE target per durable job (non-kernel) — the declared chain is still the
  // fallback order — while kernel functions keep all eligible members.
  let pickedSet, rule;
  if (qualified.length) { pickedSet = qualified; rule = 'decisionFlow.qualified-first: measured qualification passed'; }
  else if (probationEligible.length) {
    pickedSet = probationEligible;
    rule = 'decisionFlow.probation-fallback: no qualification evidence; scoped probation admitted';
  } else if (kernelFunctionEligible.length) {
    pickedSet = kernelFunctionEligible;
    rule = 'decisionFlow.kernel-function: kernel function on the sol-think order; no qualification record required';
  } else { pickedSet = []; rule = 'decisionFlow.verdict: no eligible model'; }

  const pick = pickedSet[0] ?? null;
  const modelFor = c => resolveLaunchModel(c.id, difficulty, { runtimes }).modelId ?? c.target;
  const result = {
    workload: w,
    config: {
      file: ownerCfg ? path.relative(skillRoot, owner.file) : null,
      ...(owner.error ? { error: owner.error } : {}),
      ...(owner.configInvalid ? { configInvalid: owner.configInvalid } : {}),
      effort: effort ?? null,
      preferredProvider,
      ...(w.modelFunction ? { kernelRole: cfgRole, pool: cfgPoolName ?? null, members: cfgMembers ?? null } : {}),
    },
    ...(owner.drift.length ? { capacityDrift: owner.drift } : {}),
    assumptions: {
      approved: w.approved, scope: w.scope, noExternalEffects: w.noExternalEffects,
      strictMachineGates: w.strictMachineGates, freshIndependentReview: w.freshIndependentReview,
    },
    rules: path.relative(skillRoot, rules.file),
    pick: pick ? { target: pick.c.target, model: modelFor(pick.c), mode: pick.mode, profile: pick.c.profile } : null,
    rule,
    orderSource,
    ...(args.bias ? { bias: args.bias } : {}),
    fallbackChain: pickedSet.slice(1).map(e => ({ target: e.c.target, model: modelFor(e.c), mode: e.mode })),
    fallbackPolicy: rules.fallbackAdvanceWhen,
    rejected: evaluated.filter(e => !e.eligible).map(e => ({ target: e.c.target, reasons: e.reasons })),
    ...(availability ? { availability: Object.fromEntries(evaluated.filter(e => e.availability)
      .map(e => [e.c.target, { provider: e.availability.provider, state: e.availability.state, quota: e.availability.quota, reason: e.availability.reason }])) } : {}),
  };
  if (pick && !w.modelFunction && pick.mode === 'probation')
    result.note = 'probation admits exactly one target for one durable job; fallbackChain lists order, not parallel admission';

  if (args.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`workload: kind=${w.kind} role=${w.role ?? '(none)'} work=${w.work ?? '(unclassified)'} difficulty=${difficulty}` +
      (difficulty !== measured ? ` (raised from ${measured} to floor ${route.floor})` : '') + ` risk=${w.risk} floor=${w.qualityFloor} tools=[${w.tools}] ctx=${w.contextTokens}` +
      (w.elevated ? '  ELEVATED' : '') + (w.modelFunction ? '  KERNEL-FUNCTION' : ''));
    console.log(`assumed: approved=${w.approved} local noExternalEffects=${w.noExternalEffects} strictMachineGates=${w.strictMachineGates} freshIndependentReview=${w.freshIndependentReview}`);
    console.log(`config: ${result.config.file ?? 'absent'}` +
      (result.config.effort ? `  effort=${result.config.effort}` : '') +
      (preferredProvider ? `  preferredProvider=${preferredProvider} (bias, not a chain)` : '') +
      (result.config.pool ? `  ${result.config.kernelRole} pool '${result.config.pool}' -> [${(result.config.members ?? []).join(', ')}]` : '') +
      (owner.error ? `  (${owner.error})` : ''));
    for (const d of owner.drift)
      console.log(`capacity drift: ${d.target} profile pins maxParallel ${d.profileMaxParallel}; runtimes.yaml declares ${d.runtimesMaxParallel} (runtimes.yaml wins)`);
    if (pick) {
      console.log(`PICK ${pick.c.target}  model=${modelFor(pick.c)}  mode=${pick.mode}`);
      console.log(`  rule: ${rule}`);
      console.log(`  order: ${orderSource}`);
      if (result.availability) console.log(`  availability: ${Object.entries(result.availability).map(([t, a]) => `${t}=${a.state}`).join(' ')}`);
      if (args.bias) console.log(`  bias: prefer=[${args.bias.prefer}] avoid=[${args.bias.avoid}]`);
      if (result.fallbackChain.length) {
        console.log('fallback chain:');
        for (const f of result.fallbackChain) console.log(`  -> ${f.target} (${f.model}) [${f.mode}]`);
      }
      if (result.note) console.log(`  note: ${result.note}`);
      if (args.verbose) for (const r of result.rejected) console.log(`  rejected ${r.target}: ${r.reasons.join('; ')}`);
    } else {
      console.log(`REFUSAL — ${rule}`);
      for (const r of result.rejected) console.log(`  ${r.target}: ${r.reasons.join('; ')}`);
    }
  }
  if (!pick) process.exit(1);
}

await main();
