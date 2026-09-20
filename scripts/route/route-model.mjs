#!/usr/bin/env node
// route-model.mjs — resolve which model target may take a workload, by EXECUTING
// the declarative rules in modules/models/selection.yaml (the source of truth;
// a port of kernel/model-policy.mjs). Ordering facts come from the files
// selection.yaml cites: modules/models/runtimes.yaml (preference/tiers) and
// modules/models/qualifications.yaml (the shipped evidence store — empty means
// no measured qualification, so eligible routes are probation or refusal).
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
//       [--difficulty <easy|medium|hard>]   (with --plan) which allocation tier to preview
//       [--plan]                what-if view: walk the runtimes.yaml difficulty tier
//                               instead of the declared operator chain; missing or
//                               stale qualification evidence is ANNOTATED, not fatal
//       [--json] [--modelsDir <dir>] [--verbose]
//
// Prints: picked target (+model for the role), the rule that fired, the ordered
// fallback chain, and per-candidate rejection reasons. Exit 1 on refusal
// ('no eligible model' — a typed exclusion, never a silent swap).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../core/yaml.mjs';

const skillRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const readYaml = p => (fs.existsSync(p) ? parseYaml(fs.readFileSync(p, 'utf8')) : null);

function parseArgs(argv) {
  const a = { tools: [] };
  const take = i => {
    const v = argv[i + 1];
    if (v === undefined) { console.error(`missing value for ${argv[i]}`); process.exit(2); }
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
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
    else if (k === '--plan') a.plan = true;
    else if (k === '--json') a.json = true;
    else if (k === '--verbose') a.verbose = true;
    else if (k === '--modelsDir') a.modelsDir = take(i), i++;
    else { console.error(`unknown arg ${k}`); process.exit(2); }
  }
  a.tools = [...new Set(a.tools.map(s => s.trim()).filter(Boolean))].sort();
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
    roles: doc.closedSets.roles,
    probationFloorBan: ['high', 'critical'],   // selection.yaml probation.recordGates
    probationRiskMax: 'medium',                // workload.risk <= medium
    fallbackAdvanceWhen: doc.fallback?.advanceOnlyWhen ?? [],
    decisionFlow: doc.decisionFlow ?? {},
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
      models: profile?.capacity?.models ?? {},
      profile: pool.profile ?? `profiles/${pool.target}.yaml`,
    });
  }
  return out;
}

// Candidate order sources, in precedence order:
//   1. registry.yaml operators[kind].chain — the declared per-op launch chain
//      ("choosing the first ready runtime/profile", registry.yaml selection).
//   2. runtimes.yaml allocation.preference[role] — within-family suitability,
//      used for kinds with no declared chain (kernel functions, unknown kinds).
// selection.yaml allocationFacts.note: tiers/preference are NOT a workflow
// provider fallback chain; the declared operator chains decide in a workflow.
function candidateOrder(kind, role, registry, runtimes) {
  const chain = registry?.operators?.[kind]?.chain;
  if (Array.isArray(chain) && chain.length) return { order: chain, source: `registry.yaml operators.${kind}.chain` };
  const pref = (role && runtimes?.allocation?.preference?.[role]) || runtimes?.allocation?.preference?.implement || [];
  return { order: pref, source: `runtimes.yaml allocation.preference[${role ?? 'implement'}]` };
}

// --- plan mode: what-if tier preview ---------------------------------------------
//
// --plan previews allocation for goal planning: instead of the declared operator
// chain it walks the runtimes.yaml difficulty tier (allocation.tiers.<difficulty>,
// role-keyed where the tier is a map) and evaluates each runtime entry with the
// same qualification/probation gates — except a missing or stale evidence file is
// annotated rather than allowed to fail the pick. Nothing is admitted, launched or
// written; this is a view, not a route.

const PLAN_COLD_MINUTES = { easy: 15, medium: 45, hard: 90 };
// Failures that mean "no usable evidence" rather than "evidence proved unfit":
// a pick may still be previewed past these, annotated.
const PLAN_EVIDENCE_ABSENT = new Set([
  'model qualification evidence is missing',
  'qualification is stale',
  'qualification date is invalid',
]);

function planChain(runtimes, difficulty, role) {
  const tier = runtimes?.allocation?.tiers?.[difficulty];
  const at = `runtimes.yaml allocation.tiers.${difficulty}`;
  if (!tier) return { chain: [], source: `${at} (missing)` };
  if (Array.isArray(tier)) return { chain: tier, source: at };
  if (role && Array.isArray(tier[role])) return { chain: tier[role], source: `${at}.${role}` };
  return { chain: tier.default ?? [], source: `${at}.default` };
}

function planEvidenceNote(evidence, qr) {
  if (!evidence || evidence.schema !== 'starci/model-qualification@1')
    return 'no qualification evidence on disk';
  if (qr.includes('qualification is stale')) return 'qualification evidence on disk is stale';
  if (qr.includes('qualification date is invalid')) return 'qualification evidence on disk has an invalid date';
  return null;
}

function planCandidates(chain, runtimes, w, rules, evidenceByRuntime) {
  const probationReasons = probationAdmissionReasons(w, rules);
  return chain.map(id => {
    const rt = runtimes?.runtimes?.[id] ?? null;
    if (!rt) return { id, target: id, status: 'rejected', structural: true, reasons: ['no runtimes.yaml entry for this pool'] };
    const model = (w.role && rt.models?.[w.role]) || rt.target || id;
    const base = { id, target: rt.target ?? id, provider: rt.provider ?? null, model, maxParallel: rt.maxParallel ?? null };
    if (w.role && rt.roles?.length && !rt.roles.includes(w.role))
      return { ...base, status: 'rejected', structural: true, reasons: [`pool does not serve role '${w.role}'`] };
    const evidence = evidenceByRuntime[id];
    const qr = qualificationReasons({ provider: rt.provider, model, target: rt.target ?? id, version: null }, evidence, w, rules);
    const note = planEvidenceNote(evidence, qr);
    if (!qr.length) return { ...base, status: 'qualified', structural: false, reasons: [], note, qr };
    if (!probationReasons.length) return { ...base, status: 'probation-only', structural: false, reasons: [], note, qr };
    return { ...base, status: 'rejected', structural: false, reasons: [...qr, ...probationReasons], note, qr };
  });
}

function runPlan(args, rules, runtimes, w, evidenceByRuntime) {
  const { chain, source } = planChain(runtimes, args.difficulty, w.role);
  const evaluated = planCandidates(chain, runtimes, w, rules, evidenceByRuntime);
  // Pickable = not structurally off the chain, and any rejection rests only on
  // absent/stale evidence (annotation, not a real disqualification) — the point
  // of plan mode is "who takes this once qualification exists". Probation
  // reasons are workload-level and never disqualify a pool in this preview.
  const pickable = evaluated.filter(c => !c.structural
    && (c.status !== 'rejected' || c.qr.every(r => PLAN_EVIDENCE_ABSENT.has(r))));
  const statusRank = { qualified: 0, 'probation-only': 1, rejected: 2 };
  const ordered = [...pickable].sort((a, b) => statusRank[a.status] - statusRank[b.status] || chain.indexOf(a.id) - chain.indexOf(b.id));
  const primary = ordered[0] ?? null;
  const fallbacks = ordered.slice(1);
  const reasonFor = c => c.status === 'qualified'
    ? 'measured qualification evidence passes'
    : c.status === 'probation-only'
      ? (c.note ? `${c.note}; scoped probation would admit` : 'scoped probation would admit')
      : `what-if pick: ${c.note ?? 'no usable qualification evidence'} — launch still requires measured qualification (probation cannot satisfy this workload)`;
  const estimate = { difficulty: args.difficulty, coldMinutes: PLAN_COLD_MINUTES[args.difficulty] };

  if (args.json) {
    console.log(JSON.stringify({
      plan: true,
      difficulty: args.difficulty,
      workload: w,
      tier: { source, chain },
      candidates: evaluated.map(c => ({
        target: c.target, provider: c.provider, model: c.model,
        maxParallel: c.maxParallel, status: c.status,
        ...(c.note ? { evidence: c.note } : {}), ...(c.reasons?.length ? { reasons: c.reasons } : {}),
      })),
      pick: primary
        ? { primary: { target: primary.target, model: primary.model, status: primary.status }, reason: reasonFor(primary),
            fallbacks: fallbacks.map(c => ({ target: c.target, model: c.model, status: c.status })) }
        : null,
      estimate,
    }, null, 2));
  } else {
    console.log(`plan what-if: kind=${w.kind} role=${w.role ?? '(none)'} difficulty=${args.difficulty}`);
    console.log(`workload: risk=${w.risk} floor=${w.qualityFloor} tools=[${w.tools}] ctx=${w.contextTokens}` +
      (w.elevated ? '  ELEVATED' : '') + (w.modelFunction ? '  KERNEL-FUNCTION' : ''));
    console.log(`chain: ${source}  ->  [${chain.join(', ') || '(empty)'}]`);
    console.log('candidates:');
    evaluated.forEach((c, i) => {
      const spec = c.provider !== undefined
        ? `provider=${c.provider ?? '(none)'}  model=${c.model ?? '(none)'}  maxParallel=${c.maxParallel ?? '(none)'}`
        : '';
      console.log(`  ${i + 1}. ${c.target}  ${spec}  status=${c.status}` +
        (c.note ? `  (${c.note})` : ''));
      if (args.verbose && c.reasons?.length) console.log(`     reasons: ${c.reasons.join('; ')}`);
    });
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

// --- main -------------------------------------------------------------------------

function main() {
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
  const w = args.plan
    // Plan mode derives the role from runtimes.yaml roleOfKind (the allocator's
    // own kind→role map), falling back to kinds.yaml like the live path.
    ? deriveWorkload({ ...args, role: args.role ?? runtimes?.roleOfKind?.[args.kind] ?? kindEntry?.role }, rules, kindEntry, declaredChecks)
    : deriveWorkload(args, rules, kindEntry, declaredChecks);
  if (args.plan) {
    if (!PLAN_COLD_MINUTES[args.difficulty]) { console.error('--plan requires --difficulty <easy|medium|hard>'); process.exit(2); }
    runPlan(args, rules, runtimes, w, evidenceByRuntime);
    return;
  }
  const candidates = loadCandidates(modelsDir);
  const { order, source: orderSource } = candidateOrder(args.kind, w.role, registry, runtimes);
  const ordered = [...candidates].sort((a, b) => {
    const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.id.localeCompare(b.id);
  });

  const chainDeclared = orderSource.startsWith('registry.yaml');
  const evaluated = ordered.map(c => {
    // A declared operator chain is a closed set: pools absent from it are not
    // on the op's launch path at all (interface.draw → [codex-agent] only).
    if (chainDeclared && !order.includes(c.id))
      return { c, eligible: false, mode: null, reasons: [`pool is not on the declared chain for ${args.kind}`] };
    if (w.role && c.roles.length && !c.roles.includes(w.role))
      return { c, eligible: false, mode: null, reasons: [`pool does not serve role '${w.role}'`] };
    const qr = qualificationReasons({ provider: c.provider, model: c.models[w.role] ?? c.target, target: c.target, version: null }, evidenceByRuntime[c.id], w, rules);
    if (!qr.length) return { c, eligible: true, mode: 'qualified', reasons: [] };
    const pr = probationAdmissionReasons(w, rules);
    if (!pr.length) return { c, eligible: true, mode: 'probation', reasons: [], qualifiedFailed: qr };
    return { c, eligible: false, mode: null, reasons: [...qr, ...pr] };
  });

  const qualified = evaluated.filter(e => e.eligible && e.mode === 'qualified');
  const probationEligible = evaluated.filter(e => e.eligible && e.mode === 'probation');
  // providerFilter: qualified set wins outright; else probation admits exactly
  // ONE target per durable job (non-kernel) — the declared chain is still the
  // fallback order — while kernel functions keep all eligible members.
  let pickedSet, rule;
  if (qualified.length) { pickedSet = qualified; rule = 'decisionFlow.qualified-first: measured qualification passed'; }
  else if (probationEligible.length) {
    pickedSet = probationEligible;
    rule = 'decisionFlow.probation-fallback: no qualification evidence; scoped probation admitted';
  } else { pickedSet = []; rule = 'decisionFlow.verdict: no eligible model'; }

  const pick = pickedSet[0] ?? null;
  const modelFor = c => (w.role && c.models[w.role]) || c.target;
  const result = {
    workload: w,
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
    rejected: evaluated.filter(e => !e.eligible).map(e => ({ target: e.c.target, reasons: e.reasons })),
  };
  if (pick && !w.modelFunction && pick.mode === 'probation')
    result.note = 'probation admits exactly one target for one durable job; fallbackChain lists order, not parallel admission';

  if (args.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`workload: kind=${w.kind} role=${w.role ?? '(none)'} risk=${w.risk} floor=${w.qualityFloor} tools=[${w.tools}] ctx=${w.contextTokens}` +
      (w.elevated ? '  ELEVATED' : '') + (w.modelFunction ? '  KERNEL-FUNCTION' : ''));
    console.log(`assumed: approved=${w.approved} local noExternalEffects=${w.noExternalEffects} strictMachineGates=${w.strictMachineGates} freshIndependentReview=${w.freshIndependentReview}`);
    if (pick) {
      console.log(`PICK ${pick.c.target}  model=${modelFor(pick.c)}  mode=${pick.mode}`);
      console.log(`  rule: ${rule}`);
      console.log(`  order: ${orderSource}`);
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

main();
