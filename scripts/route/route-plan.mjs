#!/usr/bin/env node
// route-plan.mjs — the chain builder. route-op.mjs picks ONE op;
// this planner chains MANY: S0 survey + S* target -> backward-chain via
// needs/produces -> topo order -> legality check.
//
// Algorithm per modules/goal/anatomy.yaml `decomposition` + legality.yaml:
//   PARSE   input text (archetype signal table) or explicit vars -> S*
//   SURVEY  .starciwork records -> S0 (state per variable, gaps, owned dirs)
//   GAP     delta = S* - S0 (a stale/not-done variable counts as missing)
//   CHAIN   each missing var -> op whose produces: covers it (vocabulary:
//           modules/goal/legality.yaml producesVocabulary.opProduces — the ops'
//           route: blocks carry prerequisites but no machine-readable produces,
//           so an unlisted op is matched by route.intent/goal and marked inferred)
//   VALIDATE topo-sort by needs/prerequisites; cycles -> infeasible; forward
//           edges, split rules and the INTENT/SCOPE/ORDER ambiguity ladder from
//           legality.yaml (INTENT -> a provision.ask leg, never a guess)
//
// Internal entry: spawned by scripts/goal/define-goal.mjs; not invoked directly.
// Args: --target "feature.A: exists proven" [--state <.starciwork dir>] [--surface ui|api]
//       --simulate --target-json '{"sds.X":"decided","ui.X":"verified"}'
//       --text "build the enrolment screen" [--state <dir>]
//       [--work <.starciwork dir>] [--opsDir <dir>] [--goalDir <dir>] [--json]
//   --state is the impact-analysis SURVEY (define-goal always passes it): a goal naming a surveyed feature is an EXTEND, plans only the
//   delta and keeps its backend lane; the plan carries an `impact` block. --work reads only the records legality.yaml settledOutOfBand names (a
//   settled brand record drops brand.decide); --state is the full SURVEY.
//
// Output: ordered legs, each {op, producesCovered, needsSatisfiedBy, extends?,
// assumed?, conditions?}; `edges` [[fromLeg, toLeg], ...] over leg labels
// (`op` or `op#instance`), from must settle first; plus an `infeasible` report
// when no chain exists.
// Exit 1 on infeasible.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { routeFields, stringItems } from './route-fields.mjs';
import { asList } from '../lib/list.mjs';
import { ownerSpecs, planLegDeferral } from './spec-deferral.mjs';
import { applyExtend, impactOf, satisfiedByS0, surveyS0 } from './route-plan-survey.mjs';
import { STATE_QUALIFIER, VAR_STATE_LINE, dedupeVars, intentToStar, loadArchetypeSignals, normalizeTargetVar, varKey } from './route-plan-parse.mjs';
import { planChain } from './route-plan-chain.mjs';
import { legalityCheck, topoSort } from './route-plan-validate.mjs';

const skillRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

// ---------------------------------------------------------------- args -----

function usage(code) {
  console.error(`Internal entry: spawned by scripts/goal/define-goal.mjs; not invoked directly.
args: (--target "<var>: <state>" [--target ...] | --target-json '<json>' | --text "<prompt>")
    [--state <.starciwork dir>] [--simulate] [--surface ui|api]
    [--work <.starciwork dir>] [--opsDir <dir>] [--goalDir <dir>] [--json]`);
  process.exit(code);
}

function parseArgs(argv) {
  const a = { targets: [] };
  const take = () => {
    const v = argv[++parseArgs.i];
    if (v === undefined) usage(2);
    return v;
  };
  for (parseArgs.i = 0; parseArgs.i < argv.length; parseArgs.i++) {
    const k = argv[parseArgs.i];
    if (k === '--target') a.targets.push(take());
    else if (k === '--target-json') a.targetJson = take();
    else if (k === '--text') a.text = take();
    else if (k === '--state') a.state = take();
    else if (k === '--simulate') a.simulate = true;
    else if (k === '--surface') a.surface = take();
    else if (k === '--opsDir') a.opsDir = take();
    else if (k === '--goalDir') a.goalDir = take();
    else if (k === '--work') a.work = take();
    else if (k === '--json') a.json = true;
    else if (k === '--help' || k === '-h') usage(0);
    else usage(2);
  }
  return a;
}

// ------------------------------------------------------- catalog loading ---

function loadOps(opsDir) {
  const root = path.join(opsDir, 'ops');
  const files = fs.existsSync(root) ? fs.readdirSync(root) : [];
  const ops = new Map();
  for (const file of files.filter(f => f.endsWith('.yaml')).sort()) {
    let doc;
    try { doc = parseYaml(fs.readFileSync(path.join(root, file), 'utf8')); }
    catch (e) { ops.set(file, { id: file, error: `unparseable: ${e.message}` }); continue; }
    const id = String(doc?.id ?? file.replace(/\.yaml$/, ''));
    const route = doc?.route ?? {};
    ops.set(id, {
      id,
      file: path.relative(skillRoot, path.join(root, file)),
      goal: typeof doc?.goal === 'string' ? doc.goal : (doc?.goal?.en ?? null),
      route: routeFields(route),
    });
  }
  return ops;
}

// One opProduces entry as a structured variable, or null when it does not parse.
function producesEntryOf(op, raw) {
  const m = VAR_STATE_LINE.exec(String(raw).trim());
  if (!m) return null;
  const varPart = m[1];
  let state = m[2].trim();
  let qualifier = null;
  const q = STATE_QUALIFIER.exec(state);
  if (q) { state = q[1].trim(); qualifier = q[2].trim(); }
  const dot = varPart.indexOf('.');
  return {
    family: dot < 0 ? varPart : varPart.slice(0, dot),
    suffix: dot < 0 ? '' : varPart.slice(dot + 1),
    state, qualifier, op, raw: String(raw),
  };
}

/** Parse legality.yaml producesVocabulary.opProduces into structured entries.
 *  Entry form: "impl.X: done (frontend)" -> {family:'impl', suffix:'X',
 *  state:'done', qualifier:'frontend', op, raw}. */
function loadProducesTable(goalDir) {
  const file = path.join(goalDir, 'legality.yaml');
  const doc = parseYaml(fs.readFileSync(file, 'utf8'));
  const table = doc?.producesVocabulary?.opProduces;
  if (!table || typeof table !== 'object') throw new Error(`no producesVocabulary.opProduces in ${file}`);
  const byVar = []; // [{family, suffix, state, qualifier, op, raw}]
  for (const [op, vars] of Object.entries(table)) {
    for (const raw of stringItems(vars)) {
      const entry = producesEntryOf(op, raw);
      if (entry) byVar.push(entry);
    }
  }
  return { byVar, file: path.relative(skillRoot, file) };
}

/** legality.yaml producesVocabulary.settledOutOfBand, evaluated against one
 *  Work root: each entry whose record exists with the named state yields the
 *  variable it settles. The record's `state` field is read as YAML data. */
function loadSettledOutOfBand(goalDir, workRoot) {
  const doc = parseYaml(fs.readFileSync(path.join(goalDir, 'legality.yaml'), 'utf8'));
  const out = [];
  for (const entry of asList(doc?.producesVocabulary?.settledOutOfBand)) {
    const m = /^([A-Za-z][A-Za-z0-9.]*)\s*:\s*(\S+)$/.exec(String(entry?.var ?? '').trim());
    if (!m || !entry.record) continue;
    let recordState;
    try { recordState = String(parseYaml(fs.readFileSync(path.join(workRoot, entry.record), 'utf8'))?.state ?? ''); } catch { continue; }
    if (recordState !== String(entry.state)) continue;
    const dot = m[1].indexOf('.');
    out.push({
      family: dot < 0 ? m[1] : m[1].slice(0, dot), state: m[2], record: entry.record, recordState,
      note: `${m[1]}: ${m[2]} record ${entry.record} state ${recordState} — satisfied out-of-band, no chain leg`,
    });
  }
  return out;
}

// ---------------------------------------------------------------- main -----

// PARSE -> S*: the explicit targets, else the goal text read through the archetype table; a malformed target ends the run.
function parseStar(args, goalDir) {
  let sstar = [], hints = {};
  const parseNotes = [];
  const addTarget = (spec) => {
    const r = normalizeTargetVar(spec, args);
    if (r.error) { console.error(r.error); process.exit(2); }
    sstar.push(...r.vars);
  };
  if (args.targetJson) {
    let obj; try { obj = JSON.parse(args.targetJson); } catch (e) { console.error(`--target-json: ${e.message}`); process.exit(2); }
    for (const [k, v] of Object.entries(obj)) addTarget(`${k}: ${v}`);
    parseNotes.push('explicit --target-json vars');
  }
  for (const t of args.targets) addTarget(t);
  if (args.targets.length) parseNotes.push('explicit --target vars');
  if (!sstar.length && args.text) {
    const hit = intentToStar(args.text, args, loadArchetypeSignals(goalDir));
    if (hit) { sstar = hit.vars; hints = hit.hints; parseNotes.push(`intent->S* via archetypes [${hints.archetypes.join(', ')}]`); }
  }
  return { sstar: dedupeVars(sstar), hints, parseNotes };
}

// SURVEY -> S0
function surveyState(args) {
  if (args.simulate) return { records: [], vars: new Map(), gaps: [], note: 'simulated: S0 = empty' };
  return args.state ? surveyS0(path.resolve(args.state)) : null;
}

// IMPACT ANALYSIS before planning (existing.yaml survey): a goal that names a surveyed feature EXTENDS it.
function applyImpact(args, s0, hints, sstar) {
  const impact = args.text && !args.targets.length && !args.targetJson ? impactOf(args.text, s0, hints.archetypes ?? []) : null;
  if (!impact) return { impact, sstar };
  s0.scopeFeatures = new Set(impact.features);
  // The units an EXTEND changes are never "already delivered": their prerequisites (implement, draw) stay planned.
  // A BUILD names no surveyed feature: nothing existing settles its prerequisites (never-treat-absent-as-clean).
  if (impact.shape === 'BUILD') s0.wildcardOff = true;
  if (impact.shape === 'EXTEND') s0.extendFamilies = new Set(['impl', 'ui']);
  hints.extend = impact.shape === 'EXTEND' ? impact : undefined;
  return { impact, sstar: dedupeVars(applyExtend(sstar, impact, { surfaceName: hints.surfaceName ?? 'X' })) };
}

// INTENT-tier ambiguity: S* cannot be formed -> provision.ask, never guess.
function printIntentAmbiguity({ args, ops, s0, parseNotes }) {
  const result = {
    status: 'needs-owner',
    ambiguity: { tier: 'INTENT', note: 'S* cannot be formed from the input — legality.yaml ambiguity ladder: provision.ask, never guess intent' },
    legs: [{ seq: 1, op: 'provision.ask', producesCovered: ['provision.intent: provided'], needsSatisfiedBy: [], assumed: [], conditions: ['owner question: what is the goal — build vs verify, which feature, which boundary'], yaml: ops.get('provision.ask')?.file ?? null }],
    parseNotes, s0: s0 ? s0.records.length + ' records surveyed' : 'no state surveyed',
  };
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log('INTENT ambiguity — S* cannot be formed. Legal chain: ask the owner.');
    console.log('  1. provision.ask — what is the goal? (never guess intent; a wrong identity voids all downstream evidence)');
  }
}

// GAP -> delta: what S0 already settles and what the plan still owes.
function splitDelta(sstar, s0) {
  const delta = [];
  const alreadySatisfied = [];
  for (const v of sstar) {
    const s0hit = satisfiedByS0(v, s0, { goal: true });
    if (s0hit?.by === 's0') alreadySatisfied.push({ var: `${varKey(v)}: ${v.state}`, by: s0hit.recordId });
    else delta.push({ ...v, partial: s0hit?.by === 's0-unsettled' ? s0hit : undefined });
  }
  return { delta, alreadySatisfied };
}

const LEG_QUALIFIER = { 'backend.implement': 'backend', 'interface.implement': 'frontend' };

// The S0 variables a produced variable of one leg stands for: its family, the leg's lane, and the named unit or the goal's own features.
function counterpartsOf(leg, vk, s0) {
  const fam = vk.split('.')[0];
  const suffix = vk.split('.').slice(1).join('.');
  const scope = s0?.scopeFeatures?.size ? s0.scopeFeatures : null;
  return [...(s0?.vars ?? new Map())].filter(([key, ent]) => {
    if (!key.startsWith(fam + '.')) return false;
    if (fam === 'impl' && LEG_QUALIFIER[leg.op] && ent.qualifier !== LEG_QUALIFIER[leg.op]) return false;
    if (suffix && suffix !== 'X') return key.includes(suffix);
    return scope ? scope.has(ent.feature) : false;
  }).map(([, ent]) => ent);
}

// done-record-reverify: a producing leg whose S0 counterpart record exists gets extends; a settled counterpart
// also keeps the re-verification of the touched surface. The counterpart is the record of the leg's own lane
// (impl) and, for an unnamed unit, of the goal's own features - never any record of the family.
function markReverification(legs, s0) {
  for (const leg of legs.values()) {
    for (const cov of leg.producesCovered) {
      const hits = counterpartsOf(leg, cov.split(':')[0], s0);
      const pick = hits.find(e => e.settled) ?? hits[0];
      if (pick && !leg.extends) {
        leg.extends = pick.recordId;
        leg.assumed.push(pick.settled
          ? `extends ${pick.recordId} — re-verification of the touched surface required (done-record-reverify)`
          : `extends ${pick.recordId} (${pick.state}) — the unit exists and is not done`);
      }
    }
  }
}

// VALIDATE: a cycle or a gap ends the run as infeasible; the legs come back in order.
function orderedLegs({ args, legs, edges, gaps, sstar }) {
  const { order, cycle } = topoSort(legs, edges);
  const starText = () => sstar.map(v => `${varKey(v)}: ${v.state}`);
  if (!order) {
    const result = { status: 'infeasible', reason: 'cycle in needs/prerequisites', cycle, sstar: starText() };
    if (args.json) console.log(JSON.stringify(result, null, 2));
    else { console.log('INFEASIBLE — dependency cycle:'); console.log('  ' + cycle.join(' -> ')); }
    process.exit(1);
  }
  if (gaps.length) {
    const result = {
      status: 'infeasible', reason: 'no producer for required state variables', gaps,
      sstar: starText(),
      legs: order.map((l, i) => ({ seq: i + 1, ...l, _seq: undefined })),
    };
    if (args.json) console.log(JSON.stringify(result, null, 2));
    else {
      console.log('INFEASIBLE — no chain produces:');
      for (const g of gaps) console.log(`  ${g.var}  (needed by ${g.neededBy})`);
    }
    process.exit(1);
  }
  return order;
}

// The plan's edges between its legs: each once, in leg order.
function planEdgesOf(order, edges) {
  const pos = new Map(order.map((l, i) => [l.legId, i]));
  return [...new Map(edges
    .filter(([f, t]) => f !== t && pos.has(f) && pos.has(t))
    .map(([f, t]) => [`${f}\u0000${t}`, [f, t]])).values()]
    .sort((a, b) => (pos.get(a[0]) - pos.get(b[0])) || (pos.get(a[1]) - pos.get(b[1])));
}

const legRow = (l, i, { skillRoot, specs, args }) => ({
  seq: i + 1, op: l.op, instance: l.instance ?? undefined, params: l.params, kernelParams: l.kernelParams, external: l.external,
  producesCovered: [...new Set(l.producesCovered)],
  needsSatisfiedBy: [...new Set(l.needsSatisfiedBy)],
  extends: l.extends ?? undefined, assumed: l.assumed.length ? [...new Set(l.assumed)] : undefined,
  conditions: l.conditions.length ? [...new Set(l.conditions)] : undefined,
  injected: l.injected, parallel: l.parallel, yaml: l.yaml, missingOp: l.missingOp,
  deferred: planLegDeferral({ skillRoot, op: l.op, settings: specs, goalText: args.text ?? null })?.reason,
});

function planResult({ args, hints, parseNotes, sstar, s0, impact, alreadySatisfied, delta, order, edges, findings, goalAssumed, assumptions }) {
  // The owner's config.yaml specs switches, read on every plan (no restart): a leg whose op only tests a class
  // that is off stays in the chain - so `starci kernel run-deferred-tests` can run it later - but is marked deferred.
  const specs = ownerSpecs(skillRoot);
  return {
    status: findings.some(f => f.rule === 'verify-after-implement') ? 'illegal' : 'ok',
    input: { text: args.text ?? null, targets: args.targets, targetJson: args.targetJson ?? null },
    sstar: sstar.map(v => `${varKey(v)}: ${v.state}`),
    s0: s0 ? {
      root: args.state, records: s0.records.length,
      settled: [...s0.vars.values()].filter(v => v.settled).length,
      openGaps: s0.gaps.map(g => g.id),
    } : 'not surveyed (no --state; use --simulate to pin S0=empty explicitly)',
    impact: impact ?? undefined,
    alreadySatisfied, delta: delta.map(v => `${varKey(v)}: ${v.state}`),
    legs: order.map((l, i) => legRow(l, i, { skillRoot, specs, args })),
    edges: planEdgesOf(order, edges),
    legalityFindings: findings.length ? findings : undefined,
    assumed: goalAssumed.length ? goalAssumed : undefined,
    assumptions: assumptions.length ? assumptions : undefined,
    parseNotes,
    scopeKind: hints.scopeKind ?? hints.archetypes?.[0] ?? null,
  };
}

function printPlanLeg(l) {
  const flags = [l.external && 'external', l.injected && 'injected', l.extends && `extends:${l.extends}`, l.missingOp && 'MISSING-OP', l.deferred && `deferred:${l.deferred}`].filter(Boolean).join(' ');
  console.log(`  ${l.seq}. ${l.op}${l.instance ? '#' + l.instance : ''}${flags ? '  [' + flags + ']' : ''}`);
  for (const p of l.producesCovered) console.log(`       produces: ${p}`);
  for (const n of l.needsSatisfiedBy) console.log(`       needs <- ${n}`);
  for (const a of l.assumed ?? []) console.log(`       assumed: ${a}`);
  for (const c of l.conditions ?? []) console.log(`       condition: ${c}`);
  if (l.parallel) console.log(`       parallel: ${typeof l.parallel === 'string' ? l.parallel : JSON.stringify(l.parallel)}`);
}

function printPlanText({ result, alreadySatisfied, goalAssumed, findings, assumptions, parseNotes }) {
  console.log(`S*: ${result.sstar.join('  |  ')}`);
  console.log('S0: ' + (typeof result.s0 === 'string' ? result.s0 : String(result.s0.records) + ' records (' + String(result.s0.settled) + ' settled, ' + String(result.s0.openGaps.length) + ' open gaps)'));
  if (alreadySatisfied.length) for (const s of alreadySatisfied) console.log(`  already true: ${s.var} (via ${s.by})`);
  console.log(`delta: ${result.delta.join('  |  ') || '(none)'}`);
  console.log('chain:');
  for (const l of result.legs) printPlanLeg(l);
  for (const a of goalAssumed) console.log(`  assumed (goal): ${a}`);
  if (findings.length) { console.log('legality findings:'); for (const f of findings) console.log(`  ! ${f.rule} @ ${f.leg}: ${f.note}`); }
  if (assumptions.length) { console.log('assumptions (ORDER-tier, recorded for revision):'); for (const a of assumptions) console.log(`  ~ ${a}`); }
  if (parseNotes.length) console.log(`parse: ${parseNotes.join('; ')}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.targets.length && !args.targetJson && !args.text) usage(2);
  const opsDir = path.resolve(args.opsDir ?? path.join(skillRoot, 'modules', 'ops'));
  const goalDir = path.resolve(args.goalDir ?? path.join(skillRoot, 'modules', 'goal'));
  const ops = loadOps(opsDir);
  const prodTable = loadProducesTable(goalDir);
  const outOfBand = args.work ? loadSettledOutOfBand(goalDir, path.resolve(args.work)) : [];
  const parsed = parseStar(args, goalDir);
  const { hints, parseNotes } = parsed;
  const s0 = surveyState(args);
  const { impact, sstar } = applyImpact(args, s0, hints, parsed.sstar);
  if (!sstar.length) { printIntentAmbiguity({ args, ops, s0, parseNotes }); return; } // legal chain exists (the ask); exit 0
  const { delta, alreadySatisfied } = splitDelta(sstar, s0);
  const { legs, edges, gaps, assumptions, goalAssumed } = planChain({ sstar: delta, s0, ops, prodTable, hints, outOfBand });
  markReverification(legs, s0);
  const order = orderedLegs({ args, legs, edges, gaps, sstar });
  const findings = legalityCheck(order, legs, ops, s0);
  const result = planResult({ args, hints, parseNotes, sstar, s0, impact, alreadySatisfied, delta, order, edges, findings, goalAssumed, assumptions });
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else printPlanText({ result, alreadySatisfied, goalAssumed, findings, assumptions, parseNotes });
  if (result.status === 'illegal') process.exit(1);
}

main();
