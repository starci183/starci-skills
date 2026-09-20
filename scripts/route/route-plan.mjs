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
//           route: blocks carry prerequisites but no machine-readable produces;
//           business.produces prose is the fallback citation, marked inferred)
//   VALIDATE topo-sort by needs/prerequisites; cycles -> infeasible; forward
//           edges, split rules and the INTENT/SCOPE/ORDER ambiguity ladder from
//           legality.yaml (INTENT -> a provision.ask leg, never a guess)
//
// CLI:
//   node scripts/route/route-plan.mjs --target "feature.A: exists proven" [--state <.starciwork dir>] [--surface ui|api]
//   node scripts/route/route-plan.mjs --simulate --target-json '{"sds.X":"decided","ui.X":"verified"}'
//   node scripts/route/route-plan.mjs --text "build the enrolment screen" [--state <dir>]
//   [--opsDir <dir>] [--goalDir <dir>] [--json]
//
// Output: ordered legs, each {op, producesCovered, needsSatisfiedBy, extends?,
// assumed?, conditions?}; plus an `infeasible` report when no chain exists.
// Exit 1 on infeasible.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import {
  loadRecords, readWorkspace, resolveOwnedDirs,
} from '../example/example-ownership.mjs';

const skillRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

// ---------------------------------------------------------------- args -----

function usage(code) {
  console.error(`use: node scripts/route/route-plan.mjs
    (--target "<var>: <state>" [--target ...] | --target-json '<json>' | --text "<prompt>")
    [--state <.starciwork dir>] [--simulate] [--surface ui|api]
    [--opsDir <dir>] [--goalDir <dir>] [--json]`);
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
    else if (k === '--json') a.json = true;
    else if (k === '--help' || k === '-h') usage(0);
    else usage(2);
  }
  return a;
}

const asList = v => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v])
  .map(s => String(s).trim()).filter(Boolean);

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
      route: {
        nodeKinds: asList(route.nodeKinds),
        phase: asList(route.phase),
        intent: asList(route.intent),
        prerequisites: asList(route.prerequisites),
        riskHints: asList(route.riskHints),
      },
      // business.produces is PROSE — cited when the
      // producesVocabulary table has no entry for this op.
      producesProse: asList(doc?.business?.produces),
    });
  }
  return ops;
}

/** Parse legality.yaml producesVocabulary.opProduces into structured entries.
 *  Entry form: "impl.X: done (frontend)" -> {family:'impl', suffix:'X',
 *  state:'done', qualifier:'frontend', op, raw}. */
function loadProducesTable(goalDir) {
  const file = path.join(goalDir, 'legality.yaml');
  const doc = parseYaml(fs.readFileSync(file, 'utf8'));
  const table = doc?.producesVocabulary?.opProduces;
  if (!table || typeof table !== 'object') throw Error(`no producesVocabulary.opProduces in ${file}`);
  const byVar = []; // [{family, suffix, state, qualifier, op, raw}]
  for (const [op, vars] of Object.entries(table)) {
    for (const raw of asList(vars)) {
      const m = /^([A-Za-z][A-Za-z0-9.]*)\s*:\s*(.+)$/.exec(String(raw).trim());
      if (!m) continue;
      const varPart = m[1];
      let state = m[2].trim();
      let qualifier = null;
      const q = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(state);
      if (q) { state = q[1].trim(); qualifier = q[2].trim(); }
      const dot = varPart.indexOf('.');
      byVar.push({
        family: dot < 0 ? varPart : varPart.slice(0, dot),
        suffix: dot < 0 ? '' : varPart.slice(dot + 1),
        state, qualifier, op, raw: String(raw),
      });
    }
  }
  return { byVar, file: path.relative(skillRoot, file) };
}

// ------------------------------------------------------------ PARSE -> S* --

// The small intent->S* table for the 7 archetypes in modules/goal/archetypes.yaml.
// Signals are regexes over the owner prompt; each hit contributes target state
// variables plus chain hints the backward chainer consumes (producer
// preference, custody pre-mark, diagnostic-first). Archetypes COMPOSE: union
// of matched vars (archetypes.yaml composition.unionNotOverride).
const ARCHETYPES = [
  {
    id: 'investigate-first',
    signals: [/\b(lag|laggy|slow|sluggish|feels broken|takes forever|chậm|hơi lag)\b/i],
    vars: () => [{ family: 'perf', suffix: 'X', state: 'verified' }],
    hints: { diagnosticFirst: true },
  },
  {
    id: 'refactor',
    signals: [/\b(refactor|clean[ -]?up|restructure|rename|split .* into .* module)\b/i],
    vars: a => [{ family: 'impl', suffix: a.surfaceName, state: 'done' }],
    hints: { preferProducer: 'code.refactor', needsCoverage: true, scopeProvided: true },
  },
  {
    id: 'external-integration',
    signals: [/\b(integrat|connect to|wire up|vnpay|stripe|paypal|momo|sso|oauth|payment|sms|email provider)\w*/i],
    vars: a => [{ family: 'integration', suffix: a.surfaceName, state: 'verified' }],
    hints: { custody: true, implQualifier: 'backend' },
  },
  {
    id: 'verify-only',
    signals: [/\b(lint|verify|review|audit|check( the)? repo|inspect)\b/i],
    // a build/refactor verb anywhere means the audit word names the target
    // ("refactor the audit module"), not the request
    excludes: [/\b(build|implement|add|create|code|làm|integrate|refactor|clean[ -]?up|restructure|rename|fix)\b/i],
    vars: a => [{ family: 'slice', suffix: a.surfaceName, state: 'reviewed' }],
    hints: {},
  },
  {
    id: 'feature-build-with-ui',
    signals: [/\b(code fe|frontend|front-end|ui|screen|page|dashboard|giao diện|màn hình)\b/i],
    vars: a => [{ family: 'ui', suffix: a.surfaceName, state: 'verified' }],
    hints: { implQualifier: 'frontend' },
  },
  {
    id: 'feature-build-backend',
    signals: [/\b(api|endpoint|backend|back-end|service|worker|job|code be|webhook)\b/i],
    vars: a => [{ family: 'api', suffix: a.surfaceName, state: 'verified' }],
    hints: { implQualifier: 'backend' },
  },
];

function intentToStar(text, args) {
  const a = { surfaceName: 'X' };
  const sm = /\b(?:the|for|of)\s+([a-z][a-z0-9-]{2,})\s+(?:screen|page|api|endpoint|service|feature|module)/i.exec(text);
  if (sm) a.surfaceName = sm[1];
  const matched = [];
  for (const arch of ARCHETYPES) {
    if (!arch.signals.some(s => s.test(text))) continue;
    if (arch.excludes?.some(s => s.test(text))) continue;
    matched.push(arch);
  }
  if (!matched.length) return null;
  const vars = [];
  const hints = { archetypes: matched.map(m => m.id) };
  for (const arch of matched) {
    vars.push(...arch.vars(a));
    Object.assign(hints, arch.hints);
  }
  // fanout: two or more disjoint verify surfaces in one prompt.
  const surfaces = new Set(vars.map(v => v.family));
  if (surfaces.size >= 2) hints.fanout = true;
  return { vars: dedupeVars(vars), hints };
}

const varKey = v => `${v.family}${v.suffix ? '.' + v.suffix : ''}`;

function dedupeVars(vars) {
  const seen = new Map();
  for (const v of vars) {
    const k = `${varKey(v)}:${v.state}`;
    if (!seen.has(k)) seen.set(k, v);
  }
  return [...seen.values()];
}

/** "feature.A: exists proven" -> [{impl.A: done}, {api.A: verified}].
 *  Explicit target vars normalize into the producesVocabulary state space. */
function normalizeTargetVar(spec, args) {
  const m = /^([A-Za-z][A-Za-z0-9.]*)\s*:\s*(.+)$/.exec(String(spec).trim());
  if (!m) return { error: `cannot parse target var '${spec}' — expected "<family>.<suffix>: <state>"` };
  const varPart = m[1];
  const states = m[2].trim().toLowerCase().split(/\s+/);
  const dot = varPart.indexOf('.');
  const family = dot < 0 ? varPart : varPart.slice(0, dot);
  const suffix = (dot < 0 ? '' : varPart.slice(dot + 1)) || 'X';
  const out = [];
  const surface = args.surface ?? (family === 'ui' ? 'ui' : 'api');
  for (const st of states) {
    if (st === 'exists' || st === 'built' || st === 'implemented') {
      out.push({ family: 'impl', suffix, state: 'done', raw: spec });
    } else if (st === 'proven' || st === 'verified') {
      const fam = ['ui', 'api', 'integration', 'perf', 'security'].includes(family) ? family : surface;
      out.push({ family: fam, suffix, state: 'verified', raw: spec });
    } else if (family === 'feature') {
      out.push({ family: 'impl', suffix, state: st, raw: spec });
    } else {
      out.push({ family, suffix: dot < 0 ? '' : suffix, state: st, raw: spec });
    }
  }
  return { vars: dedupeVars(out) };
}

// ------------------------------------------------------------- SURVEY S0 ---

// record schema -> state-variable family (producesVocabulary families).
const SCHEMA_FAMILY = {
  'work/business-rule': 'business', 'work/functional-requirement': 'business',
  'work/non-functional-requirement': 'business', 'work/policy-decision': 'business',
  'work/customer-journey': 'business', 'work/feature': 'business',
  'work/sds-component': 'sds', 'work/contract': 'sds', 'work/data': 'sds', 'work/event': 'sds',
  'work/implementation': 'impl',
  'work/ui-screen': 'ui', 'work/uat-flow': 'ui',
  'work/integration': 'integration',
  'work/brand': 'brand', 'work/scope': 'scope',
  'work/gap': 'gap',
};
const SETTLED = new Set(['done']);           // a record whose proof stands
const UNSETTLED = new Set(['todo', 'inprogress', 'proposed', 'blocked']);

const walk = dir => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]) : []);

function surveyS0(stateDir) {
  const s0 = {
    root: stateDir, records: [], vars: new Map(), gaps: [], // vars: key -> {recordId, state, settled}
    recordsById: null, workspaceDoc: null,
  };
  if (!fs.existsSync(stateDir)) { s0.note = `state dir missing: ${stateDir}`; return s0; }
  const recordsById = loadRecords(stateDir, walk);
  const workspaceDoc = readWorkspace(stateDir);
  s0.recordsById = recordsById; s0.workspaceDoc = workspaceDoc;
  for (const [id, rec] of recordsById) {
    const family = SCHEMA_FAMILY[rec.schema] ?? null;
    const state = String(rec.data?.state ?? 'unknown');
    const entry = { id, schema: rec.schema, family, state, dir: rec.dir };
    s0.records.push(entry);
    if (family === 'gap') { s0.gaps.push({ id, state }); continue; }
    if (!family) continue;
    // var key: family + record id tail (fr.audit.log.read -> business.audit.log.read)
    const suffix = id.split('.').slice(1).join('.');
    s0.vars.set(`${family}.${suffix}`, { recordId: id, state, settled: SETTLED.has(state) });
  }
  return s0;
}

/** Does S0 satisfy var {family,suffix,state}? Suffix 'X'/''/absent = family-level
 *  wildcard ("any settled record of this family"). Otherwise the record id must
 *  contain the suffix tokens. Returns {by, recordId?, recordState?}. */
function satisfiedByS0(v, s0) {
  if (!s0) return null;
  const wantSuffix = v.suffix && v.suffix !== 'X' ? v.suffix : null;
  let fallback = null;
  for (const [key, ent] of s0.vars) {
    const fam = key.split('.')[0];
    if (fam !== v.family) continue;
    if (wantSuffix && !key.slice(fam.length + 1).replaceAll('.', '-').includes(wantSuffix)
      && !key.includes(wantSuffix)) continue;
    if (ent.settled) return { by: 's0', recordId: ent.recordId, recordState: ent.state };
    fallback ??= { by: 's0-unsettled', recordId: ent.recordId, recordState: ent.state };
  }
  return fallback; // record exists but not done -> still in delta, flagged
}

// ------------------------------------------------------------- CHAIN -------

const STAGE_RANK = { intake: 0, scope: 1, decide: 2, direct: 3, implement: 4, verify: 5, release: 6, operate: 7 };
const stageRankOf = op => {
  const p = op?.route?.phase?.[0] ?? 'operate';
  return STAGE_RANK[p] ?? 7;
};

const EXTERNAL_OPS = new Set(['request.analyze']); // model/kinds.yaml external: true

// Prerequisite phrase -> requirement. route.prerequisites are English; this is
// the fixed phrase table mapping each declared prerequisite to a chain edge, a
// state-variable need, or a non-chain condition (recorded on the leg).
function parsePrerequisite(text, ops) {
  const t = String(text).trim();
  // "<op.id> done ..." — an explicit op dependency
  const opRef = /^([a-z]+\.[a-z]+)\b/i.exec(t);
  if (opRef && ops.has(opRef[1])) {
    return { kind: 'op', op: opRef[1], note: t };
  }
  const table = [
    [/^scope defined/i, { kind: 'var', family: 'scope', state: 'defined' }],
    [/^request analyzed/i, { kind: 'op', op: 'request.analyze', note: t }],
    [/^implementation done$/i, { kind: 'var', family: 'impl', state: 'done' }],
    [/^implementation \+ verification evidence/i, { kind: 'compound', needs: [{ family: 'impl', state: 'done' }, { anyPhase: 'verify' }] }],
    [/^decided records\/behavior exist/i, { kind: 'anyPhase', phase: 'decide' }],
    [/^(a delivery to inspect|a delivered slice)/i, { kind: 'anyPhase', phase: 'implement', soft: true }],
    [/^verified served build/i, { kind: 'condition', note: 'served build assumed — runtime.operate leg if the stack is not already up' }],
    [/^delivered code \+ existing regression coverage/i, { kind: 'compound', needs: [{ family: 'impl', state: 'done', soft: true, conditional: 'delivered code is pre-existing — the refactor target, not a chain leg' }, { family: 'tests', state: 'authored', conditional: 'only when coverage is missing (test-gap route -> test.author)' }] }],
    [/^a decidable question/i, { kind: 'condition' }],
    [/^an owner-only input/i, { kind: 'condition', owner: true }],
    [/^no preset workflow matched/i, { kind: 'condition' }],
    [/^evidence challenging a rule/i, { kind: 'condition' }],
    [/^a recorded failed composition/i, { kind: 'condition' }],
    [/^test-gap blocker or code under test/i, { kind: 'condition', note: 'code under test is pre-existing delivered code (S0), not a chain leg' }],
    [/^an approved goal exists/i, { kind: 'condition', owner: true }],
    [/^the scope exists/i, { kind: 'condition' }],
    [/^a declared stack\/environment/i, { kind: 'condition' }],
  ];
  for (const [re, req] of table) if (re.test(t)) return { ...req, note: req.note ?? t };
  return { kind: 'condition', note: `unparsed prerequisite treated as a condition: '${t}'` };
}

function planChain({ sstar, s0, ops, prodTable, hints }) {
  const legs = new Map();  // legId -> leg
  const edges = [];        // [fromLegId, toLegId]  (from must run first)
  const gaps = [];         // unproducible vars
  const assumptions = [];
  let seqCounter = 0;

  const producersFor = v => prodTable.byVar.filter(p =>
    p.state === v.state && p.family === v.family
    && (p.suffix === 'X' || p.suffix === '' || p.suffix === v.suffix || v.suffix === 'X' || v.suffix === ''));

  function pickProducer(v) {
    let cands = producersFor(v);
    if (!cands.length) return { pick: null, cands };
    if (cands.length === 1) return { pick: cands[0], cands };
    // disambiguation: explicit hint, then impl qualifier, then suffix match
    if (hints.preferProducer) {
      const h = cands.find(c => c.op === hints.preferProducer);
      if (h) return { pick: h, cands };
    }
    if (v.family === 'impl' && (v._qual ?? hints.implQualifier)) {
      const h = cands.find(c => c.qualifier === (v._qual ?? hints.implQualifier));
      if (h) return { pick: h, cands };
    }
    const exact = cands.filter(c => c.suffix === v.suffix && c.suffix !== 'X');
    if (exact.length === 1) return { pick: exact[0], cands };
    // ORDER-tier ambiguity: the agent chooses; record the assumption.
    // Default preference: unqualified, then the backend impl qualifier (the
    // generic build lane), else first table entry.
    const pick = cands.find(c => !c.qualifier) ?? cands.find(c => c.qualifier === 'backend') ?? cands[0];
    assumptions.push(`producer for ${varKey(v)}: ${v.state} is ambiguous — picked ${pick.op}; alternatives: ${cands.map(c => c.op).join(', ')}`);
    return { pick, cands, assumed: true };
  }

  function legIdFor(opId, instance) { return instance ? `${opId}#${instance}` : opId; }

  function ensureLeg(opId, { forVar = null, instance = null, injected = null } = {}) {
    const lid = legIdFor(opId, instance);
    if (legs.has(lid)) { if (forVar) legs.get(lid).producesCovered.push(varKey(forVar) + ': ' + forVar.state); return legs.get(lid); }
    const op = ops.get(opId);
    const leg = {
      legId: lid, op: opId, instance,
      producesCovered: forVar ? [`${varKey(forVar)}: ${forVar.state}`] : [],
      needsSatisfiedBy: [], conditions: [], assumed: [], extends: null,
      external: EXTERNAL_OPS.has(opId) || undefined,
      injected: injected ?? undefined,
      yaml: op?.file ?? null,
      missingOp: !op || !!op.error || undefined,
    };
    legs.set(lid, leg);
    leg._seq = seqCounter++;
    expandPrerequisites(leg, op);
    return leg;
  }

  function satisfyVar(v, consumerLeg, { soft = false, conditional = null } = {}) {
    // 1. already produced by an existing leg?
    for (const leg of legs.values()) {
      if (leg === consumerLeg) continue;
      for (const pv of prodTable.byVar.filter(p => p.op === leg.op)) {
        const sameFam = pv.family === v.family;
        const sameState = pv.state === v.state;
        const suffixOk = !v.suffix || v.suffix === 'X' || pv.suffix === 'X' || pv.suffix === '' || pv.suffix === v.suffix;
        if (sameFam && sameState && suffixOk) {
          consumerLeg.needsSatisfiedBy.push(`${leg.legId} produces ${pv.raw}`);
          edges.push([leg.legId, consumerLeg.legId]);
          return true;
        }
      }
    }
    // 2. satisfied by S0?
    const s0hit = satisfiedByS0(v, s0);
    if (s0hit?.by === 's0') {
      consumerLeg.needsSatisfiedBy.push(`S0:${s0hit.recordId} (${s0hit.recordState})`);
      return true;
    }
    // 2b. soft needs are satisfiable out-of-band (e.g. "delivered code" for a
    // refactor is the pre-existing target, not a chain leg); a named-target
    // request IS its own scope (archetypes.yaml refactor excludes scope.define).
    if (hints.scopeProvided && v.family === 'scope') {
      consumerLeg.needsSatisfiedBy.push('named target IS the scope — scope.define excluded per archetype');
      return true;
    }
    if (soft) {
      consumerLeg.assumed.push(`needs ${varKey(v)}: ${v.state} — satisfied out-of-band (no chain leg)${conditional ? '; ' + conditional : ''}`);
      return true;
    }
    // 3. backward-chain: produce it
    const { pick, cands, assumed } = pickProducer(v);
    if (!pick) {
      if (soft) { consumerLeg.assumed.push(`needs ${varKey(v)}: ${v.state} — satisfied out-of-band (no chain leg)`); return true; }
      // fallback inference: route.prerequisites + goal prose (brief: marked)
      const fb = [...ops.values()].find(o => !o.error && o.route.intent.includes(v.family));
      if (fb) {
        const leg = ensureLeg(fb.id, { forVar: v });
        leg.assumed.push(`produces-inferred: no producesVocabulary entry for ${varKey(v)} — matched by route.intent/goal (marked per brief)`);
        edges.push([leg.legId, consumerLeg.legId]);
        consumerLeg.needsSatisfiedBy.push(`${leg.legId} (produces-inferred)`);
        return true;
      }
      gaps.push({ var: `${varKey(v)}: ${v.state}`, neededBy: consumerLeg.op, candidates: cands.map(c => c.op) });
      return false;
    }
    const leg = ensureLeg(pick.op, { forVar: v });
    if (assumed) leg.assumed.push(`producer ambiguity for ${varKey(v)} — chose ${pick.op} over [${cands.map(c => c.op).join(', ')}]`);
    if (conditional) leg.conditions.push(conditional);
    edges.push([leg.legId, consumerLeg.legId]);
    consumerLeg.needsSatisfiedBy.push(`${leg.legId} produces ${pick.raw}`);
    // extends: S0 has a not-settled/related record for this var
    if (s0hit?.by === 's0-unsettled') leg.extends = s0hit.recordId;
    return true;
  }

  function satisfyPhase(phase, consumerLeg, { soft = false } = {}) {
    const hit = [...legs.values()].find(l => l !== consumerLeg && (ops.get(l.op)?.route.phase ?? []).includes(phase));
    if (hit) {
      consumerLeg.needsSatisfiedBy.push(`${hit.legId} (${phase} leg)`);
      edges.push([hit.legId, consumerLeg.legId]);
      return true;
    }
    if (phase === 'decide') return satisfyVar({ family: 'business', suffix: 'X', state: 'decided' }, consumerLeg);
    if (phase === 'implement') {
      // pick implement op by consumer surface: uat->frontend, e2e/integration->backend
      const qual = /uat/.test(consumerLeg.op) ? 'frontend' : 'backend';
      return satisfyVar({ family: 'impl', suffix: 'X', state: 'done', _qual: qual }, consumerLeg, { soft });
    }
    if (soft) { consumerLeg.assumed.push(`needs a ${phase} leg — satisfied out-of-band`); return true; }
    gaps.push({ var: `<${phase} leg>`, neededBy: consumerLeg.op, candidates: [] });
    return false;
  }

  function expandPrerequisites(leg, op) {
    for (const pre of op?.route?.prerequisites ?? []) {
      const req = parsePrerequisite(pre, ops);
      if (req.kind === 'op') {
        // satisfied by S0? else ensure the leg exists
        const prodEntries = prodTable.byVar.filter(p => p.op === req.op);
        const s0ok = prodEntries.length && prodEntries.every(pe => satisfiedByS0({ family: pe.family, suffix: pe.suffix, state: pe.state }, s0)?.by === 's0');
        if (s0ok) { leg.needsSatisfiedBy.push(`S0 (${req.note})`); continue; }
        const dep = ensureLeg(req.op);
        edges.push([dep.legId, leg.legId]);
        leg.needsSatisfiedBy.push(`${dep.legId} (${req.note})`);
      } else if (req.kind === 'var') {
        // which impl qualifier does this consumer want? uat proofs read the
        // frontend slice; api/integration/perf proofs read the backend one.
        const qual = req.family === 'impl'
          ? (/uat/.test(leg.op) ? 'frontend' : 'backend') : undefined;
        satisfyVar({ family: req.family, suffix: 'X', state: req.state, _qual: qual }, leg);
      } else if (req.kind === 'compound') {
        for (const n of req.needs) {
          if (n.anyPhase) satisfyPhase(n.anyPhase, leg, { soft: n.soft });
          else satisfyVar({ family: n.family, suffix: 'X', state: n.state }, leg, { conditional: n.conditional ?? null, soft: !!n.soft });
        }
      } else if (req.kind === 'anyPhase') {
        satisfyPhase(req.phase, leg, { soft: req.soft });
      } else {
        leg.conditions.push(req.note);
      }
    }
  }

  // ---- drive the chain from delta vars ----
  for (const v of sstar) {
    if (satisfiedByS0(v, s0)?.by === 's0') continue; // already true — delta excludes it
    // when the produced leg extends a done-but-touched surface, the reverify
    // rule (done-record-reverify) is applied in the legality pass below.
    satisfyVar(v, { op: '(goal)', legId: '(goal)', needsSatisfiedBy: [], conditions: [], assumed: [] });
  }

  // ---- injected legs (business rules that needs/produces alone miss) ----
  const has = pred => [...legs.values()].some(pred);
  // investigate-first: a baseline perf.verify BEFORE scoping, then the closing
  // one after the build (archetypes.yaml #6 orderingIsThePoint).
  if (hints.diagnosticFirst) {
    const close = legs.get('perf.verify');
    if (close) {
      const baseline = { ...close, legId: 'perf.verify#baseline', instance: 'baseline', producesCovered: ['perf.X: baseline (diagnostic measurement)'], needsSatisfiedBy: [], conditions: ['diagnostic leg — measures before scoping; its finding IS the scope input'], assumed: ['baseline runs against the existing product — no implementation leg precedes it'], extends: null, injected: 'investigate-first: evidence before boundary', _seq: -1 };
      legs.set('perf.verify#baseline', baseline);
      // closing verify now depends on baseline
      edges.push(['perf.verify#baseline', 'perf.verify']);
      close.needsSatisfiedBy.push('perf.verify#baseline (baseline measurement)');
      // scope.define (if present) depends on the baseline finding
      if (legs.has('scope.define')) {
        edges.push(['perf.verify#baseline', 'scope.define']);
        legs.get('scope.define').needsSatisfiedBy.push('perf.verify#baseline (finding is the scope input)');
      }
    }
  }
  // integration custody: provision.ask is pre-marked before integration.verify
  // (legality.yaml integration-after-custody).
  if (hints.custody || legs.has('integration.verify')) {
    if (legs.has('integration.verify')) {
      const ask = ensureLeg('provision.ask', { injected: 'integration-after-custody: owner credential/account custody before the live proof' });
      edges.push([ask.legId, 'integration.verify']);
      legs.get('integration.verify').needsSatisfiedBy.push('provision.ask (custody)');
    }
  }
  // work.author, two distinct roles (archetypes.yaml workAuthor leg):
  //  a) on a scoped feature chain the lanes read authored Work records —
  //     work.author runs BEFORE the implement legs (route prereq "scope defined");
  //  b) after code.refactor it REMAPS the implementation record's source
  //     mapping to the moved code (legality.yaml remap-after-refactor).
  if (legs.has('scope.define') && has(l => stageRankOf(ops.get(l.op)) === 4 && l.op !== 'code.refactor')) {
    const wa = ensureLeg('work.author', { injected: 'lane reads authored Work records — scope.define produced the scope' });
    for (const l of legs.values()) {
      if (stageRankOf(ops.get(l.op)) === 4 && l.op !== 'code.refactor') {
        edges.push([wa.legId, l.legId]);
        l.needsSatisfiedBy.push('work.author (records authored)');
      }
    }
  }
  if (legs.has('code.refactor')) {
    const wa = ensureLeg('work.author', { injected: 'remap-after-refactor: evidence pins sourceIdentity — a move without a remap invalidates it' });
    edges.push(['code.refactor', wa.legId]);
    wa.needsSatisfiedBy.push('code.refactor (moved code to remap)');
  }
  // review.verify: the kernel-planned module-tier read closing every build
  // chain (archetypes.yaml — "review.verify is not a lane step; it is
  // kernel-planned at the module tier"). Delta alone never produces it.
  if (has(l => stageRankOf(ops.get(l.op)) === 4) && !legs.has('review.verify')) {
    const rv = ensureLeg('review.verify', { injected: 'kernel-planned module-tier proof after the build legs (archetypes.yaml)' });
    for (const l of legs.values()) {
      if (stageRankOf(ops.get(l.op)) === 4) {
        edges.push([l.legId, rv.legId]);
        rv.needsSatisfiedBy.push(`${l.legId} (a delivery to inspect)`);
      }
    }
  }

  return { legs, edges, gaps, assumptions };
}

// ------------------------------------------------------------- VALIDATE ----

function topoSort(legs, edges) {
  const indeg = new Map([...legs.keys()].map(k => [k, 0]));
  const adj = new Map([...legs.keys()].map(k => [k, []]));
  for (const [f, t] of edges) {
    if (!legs.has(f) || !legs.has(t) || f === t) continue;
    if (!adj.get(f).includes(t)) { adj.get(f).push(t); indeg.set(t, indeg.get(t) + 1); }
  }
  const ready = () => [...legs.values()]
    .filter(l => indeg.get(l.legId) === 0)
    .sort((a, b) => (a._seq - b._seq) || a.legId.localeCompare(b.legId));
  // stable pick: earliest insertion (delta order) wins; stage rank is a
  // legality check afterwards, not a sort key — wrong order is a finding.
  const order = [];
  const seen = new Set();
  const queue = [...ready()];
  while (queue.length) {
    const l = queue.shift();
    if (seen.has(l.legId)) continue;
    seen.add(l.legId);
    order.push(l);
    for (const t of adj.get(l.legId)) {
      indeg.set(t, indeg.get(t) - 1);
      if (indeg.get(t) === 0) {
        const nl = legs.get(t);
        queue.push(nl);
        queue.sort((a, b) => (a._seq - b._seq) || a.legId.localeCompare(b.legId));
      }
    }
  }
  if (order.length !== legs.size) {
    const remaining = [...legs.keys()].filter(k => !seen.has(k));
    // find a cycle for the report
    const cycle = [];
    const dfs = (n, stack) => {
      if (stack.includes(n)) { cycle.push(...stack.slice(stack.indexOf(n)), n); return true; }
      for (const t of adj.get(n) ?? []) if (remaining.includes(t) && dfs(t, [...stack, n])) return true;
      return false;
    };
    for (const r of remaining) if (dfs(r, [])) break;
    return { order: null, cycle: cycle.length ? cycle : remaining };
  }
  return { order, cycle: null };
}

function legalityCheck(order, legs, ops, s0) {
  const findings = [];
  const pos = new Map(order.map((l, i) => [l.legId, i]));
  // forward edge: verify-after-implement — a verify leg with no implement leg
  // before it AND no S0/out-of-band satisfaction is illegal.
  for (const leg of order) {
    const phase = ops.get(leg.op)?.route.phase?.[0];
    if (phase !== 'verify') continue;
    const hasImplBefore = order.slice(0, pos.get(leg.legId))
      .some(l => stageRankOf(ops.get(l.op)) === 4);
    const s0ok = leg.needsSatisfiedBy.some(n => n.startsWith('S0:')) || leg.assumed.length;
    if (!hasImplBefore && !s0ok && !legs.get(leg.legId)?.instance) {
      findings.push({ rule: 'verify-after-implement', leg: leg.legId, note: 'proof leg with no delivered slice before it' });
    }
  }
  // forward edge: designGate — interface.implement requires interface.draw before it.
  const impl = order.find(l => l.op === 'interface.implement');
  if (impl) {
    const drawPos = pos.get('interface.draw');
    if (drawPos === undefined || drawPos > pos.get(impl.legId)) {
      const s0ok = impl.needsSatisfiedBy.some(n => /S0.*draw|interface\.draw/.test(n));
      if (!s0ok) findings.push({ rule: 'draw-before-ui-build', leg: impl.legId, note: 'interface.implement without interface.draw (designGate)' });
    }
  }
  // stage-order sanity: no decide/direct leg AFTER an implement leg it does not
  // explicitly follow (registry coarse order — a warning-tier finding).
  // Injected legs (work.author remap, kernel-planned review.verify) carry their
  // own ordering rationale and are exempt.
  for (const leg of order) {
    if (leg.injected) continue;
    const r = stageRankOf(ops.get(leg.op));
    if (r < 4 && order.slice(0, pos.get(leg.legId)).some(l => stageRankOf(ops.get(l.op)) === 4)) {
      findings.push({ rule: 'decide-before-build-general', leg: leg.legId, note: 'pre-implementation leg ordered after a build leg' });
    }
  }
  // split rules: >=2 implement legs — disjointness needs allowlist data from S0.
  const implLegs = order.filter(l => stageRankOf(ops.get(l.op)) === 4);
  if (implLegs.length >= 2) {
    for (const l of implLegs) {
      const dirs = ownedDirsForLeg(l, s0, ops);
      l.parallel = dirs === null ? 'undetermined — no owned-path data to prove disjointness; serial until proven disjoint (legality.yaml serialFallback)'
        : dirs;
    }
  }
  return findings;
}

/** Owned dirs for an implement leg, resolved from S0 records matching the leg's
 *  produced surface. null when no record/ownership data exists. */
function ownedDirsForLeg(leg, s0, ops) {
  if (!s0?.recordsById) return null;
  const dirs = [];
  for (const rec of s0.records) {
    if (rec.schema !== 'work/implementation') continue;
    for (const d of resolveOwnedDirs(rec.id, { data: s0.recordsById.get(rec.id).data }, s0.recordsById, s0.workspaceDoc, s0.root)) {
      dirs.push(d.rel);
    }
  }
  return dirs.length ? { ownedDirs: [...new Set(dirs)], note: 'disjointness check requires per-leg allowlists — listed dirs are the surfaces touched' } : null;
}

// ---------------------------------------------------------------- main -----

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.targets.length && !args.targetJson && !args.text) usage(2);
  const opsDir = path.resolve(args.opsDir ?? path.join(skillRoot, 'modules', 'ops'));
  const goalDir = path.resolve(args.goalDir ?? path.join(skillRoot, 'modules', 'goal'));
  const ops = loadOps(opsDir);
  const prodTable = loadProducesTable(goalDir);

  // PARSE -> S*
  let sstar = [], hints = {}, parseNotes = [];
  if (args.targetJson) {
    let obj; try { obj = JSON.parse(args.targetJson); } catch (e) { console.error(`--target-json: ${e.message}`); process.exit(2); }
    for (const [k, v] of Object.entries(obj)) {
      const r = normalizeTargetVar(`${k}: ${v}`, args);
      if (r.error) { console.error(r.error); process.exit(2); }
      sstar.push(...r.vars);
    }
    parseNotes.push('explicit --target-json vars');
  }
  for (const t of args.targets) {
    const r = normalizeTargetVar(t, args);
    if (r.error) { console.error(r.error); process.exit(2); }
    sstar.push(...r.vars);
  }
  if (args.targets.length) parseNotes.push('explicit --target vars');
  if (!sstar.length && args.text) {
    const hit = intentToStar(args.text, args);
    if (hit) { sstar = hit.vars; hints = hit.hints; parseNotes.push(`intent->S* via archetypes [${hints.archetypes.join(', ')}]`); }
  }
  sstar = dedupeVars(sstar);

  // SURVEY -> S0
  const s0 = args.simulate ? { records: [], vars: new Map(), gaps: [], note: 'simulated: S0 = empty' }
    : args.state ? surveyS0(path.resolve(args.state))
    : null;

  // INTENT-tier ambiguity: S* cannot be formed -> provision.ask, never guess.
  if (!sstar.length) {
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
    return; // legal chain exists (the ask); exit 0
  }

  // GAP -> delta
  const delta = [];
  const alreadySatisfied = [];
  for (const v of sstar) {
    const s0hit = satisfiedByS0(v, s0);
    if (s0hit?.by === 's0') alreadySatisfied.push({ var: `${varKey(v)}: ${v.state}`, by: s0hit.recordId });
    else delta.push({ ...v, partial: s0hit?.by === 's0-unsettled' ? s0hit : undefined });
  }

  // CHAIN
  const { legs, edges, gaps, assumptions } = planChain({ sstar: delta, s0, ops, prodTable, hints });

  // done-record-reverify: a producing leg whose S0 counterpart record is done
  // but touched gets extends + the chain keeps a verify leg over the surface.
  for (const leg of legs.values()) {
    for (const cov of leg.producesCovered) {
      const [vk] = cov.split(':');
      const fam = vk.split('.')[0];
      const suffix = vk.split('.').slice(1).join('.');
      for (const [key, ent] of (s0?.vars ?? new Map())) {
        if (!key.startsWith(fam + '.')) continue;
        if (suffix && suffix !== 'X' && !key.includes(suffix)) continue;
        if (ent.settled && !leg.extends) {
          leg.extends = ent.recordId;
          leg.assumed.push(`extends ${ent.recordId} — re-verification of the touched surface required (done-record-reverify)`);
        }
      }
    }
  }

  // VALIDATE
  const { order, cycle } = topoSort(legs, edges);
  if (!order) {
    const result = { status: 'infeasible', reason: 'cycle in needs/prerequisites', cycle, sstar: sstar.map(v => `${varKey(v)}: ${v.state}`) };
    if (args.json) console.log(JSON.stringify(result, null, 2));
    else { console.log('INFEASIBLE — dependency cycle:'); console.log('  ' + cycle.join(' -> ')); }
    process.exit(1);
  }
  if (gaps.length) {
    const result = {
      status: 'infeasible', reason: 'no producer for required state variables', gaps,
      sstar: sstar.map(v => `${varKey(v)}: ${v.state}`),
      legs: order.map((l, i) => ({ seq: i + 1, ...l, _seq: undefined })),
    };
    if (args.json) console.log(JSON.stringify(result, null, 2));
    else {
      console.log('INFEASIBLE — no chain produces:');
      for (const g of gaps) console.log(`  ${g.var}  (needed by ${g.neededBy})`);
    }
    process.exit(1);
  }
  const findings = legalityCheck(order, legs, ops, s0);

  const result = {
    status: findings.some(f => f.rule === 'verify-after-implement') ? 'illegal' : 'ok',
    input: { text: args.text ?? null, targets: args.targets, targetJson: args.targetJson ?? null },
    sstar: sstar.map(v => `${varKey(v)}: ${v.state}`),
    s0: s0 ? {
      root: args.state, records: s0.records.length,
      settled: [...s0.vars.values()].filter(v => v.settled).length,
      openGaps: s0.gaps.map(g => g.id),
    } : 'not surveyed (no --state; use --simulate to pin S0=empty explicitly)',
    alreadySatisfied, delta: delta.map(v => `${varKey(v)}: ${v.state}`),
    legs: order.map((l, i) => ({
      seq: i + 1, op: l.op, instance: l.instance ?? undefined, external: l.external,
      producesCovered: [...new Set(l.producesCovered)],
      needsSatisfiedBy: [...new Set(l.needsSatisfiedBy)],
      extends: l.extends ?? undefined, assumed: l.assumed.length ? [...new Set(l.assumed)] : undefined,
      conditions: l.conditions.length ? [...new Set(l.conditions)] : undefined,
      injected: l.injected, parallel: l.parallel, yaml: l.yaml, missingOp: l.missingOp,
    })),
    legalityFindings: findings.length ? findings : undefined,
    assumptions: assumptions.length ? assumptions : undefined,
    parseNotes,
  };

  if (args.json) { console.log(JSON.stringify(result, null, 2)); }
  else {
    console.log(`S*: ${result.sstar.join('  |  ')}`);
    console.log(`S0: ${typeof result.s0 === 'string' ? result.s0 : `${result.s0.records} records (${result.s0.settled} settled, ${result.s0.openGaps.length} open gaps)`}`);
    if (alreadySatisfied.length) for (const s of alreadySatisfied) console.log(`  already true: ${s.var} (via ${s.by})`);
    console.log(`delta: ${result.delta.join('  |  ') || '(none)'}`);
    console.log('chain:');
    for (const l of result.legs) {
      const flags = [l.external && 'external', l.injected && 'injected', l.extends && `extends:${l.extends}`, l.missingOp && 'MISSING-OP'].filter(Boolean).join(' ');
      console.log(`  ${l.seq}. ${l.op}${l.instance ? '#' + l.instance : ''}${flags ? '  [' + flags + ']' : ''}`);
      for (const p of l.producesCovered) console.log(`       produces: ${p}`);
      for (const n of l.needsSatisfiedBy) console.log(`       needs <- ${n}`);
      for (const a of l.assumed ?? []) console.log(`       assumed: ${a}`);
      for (const c of l.conditions ?? []) console.log(`       condition: ${c}`);
      if (l.parallel) console.log(`       parallel: ${typeof l.parallel === 'string' ? l.parallel : JSON.stringify(l.parallel)}`);
    }
    if (findings.length) { console.log('legality findings:'); for (const f of findings) console.log(`  ! ${f.rule} @ ${f.leg}: ${f.note}`); }
    if (assumptions.length) { console.log('assumptions (ORDER-tier, recorded for revision):'); for (const a of assumptions) console.log(`  ~ ${a}`); }
    if (parseNotes.length) console.log(`parse: ${parseNotes.join('; ')}`);
  }
  if (result.status === 'illegal') process.exit(1);
}

main();
