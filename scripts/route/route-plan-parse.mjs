// route-plan-parse.mjs — the PARSE step of route-plan.mjs: the goal text (archetype signal table) or explicit variables read into S*, the
// target-state variables the plan must reach.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { asList } from '../lib/list.mjs';
import { normalizeText } from '../lib/normalize.mjs';
import { phraseHits } from './phrase-match.mjs';
import { asksFor } from './explicit-ask.mjs';

const VAR_NAME = '[A-Za-z][A-Za-z0-9.]*';
export const VAR_STATE_LINE = new RegExp('^(' + VAR_NAME + String.raw`)\s*:\s*(\S.*|(?![\n\r\u2028\u2029])\s)$`);
const QUALIFIER_CONTENT = '[^)]*';
// The text before the qualifier: it runs to the last `)` that precedes the qualifier's own `(`, then to its last non-space character, and holds no line terminator.
const BEFORE_QUALIFIER = String.raw`(?:.*\))?(?:[^()\n\r\u2028\u2029]*[^()\s])?`;
export const STATE_QUALIFIER = new RegExp('^(' + BEFORE_QUALIFIER + String.raw`)\s*\((` + QUALIFIER_CONTENT + String.raw`)\)\s*$`);

// The intent->S* table for the archetypes in modules/goal/archetypes.yaml. The
// signals (which prompt phrases select an archetype, in which order, which
// archetypes a match supersedes) are data in that file's signalMatching and
// per-archetype signals; this table holds only what a match contributes: target
// state variables plus chain hints the backward chainer consumes (producer
// preference, custody pre-mark, diagnostic-first). Archetypes COMPOSE: union
// of matched vars.
const ARCHETYPE_STAR = {
  'workspace-canonicalization': {
    vars: () => [
      { family: 'impl', suffix: 'workspace-path-consumers', state: 'done' },
      { family: 'workspace', suffix: '', state: 'managed' },
    ],
    hints: {
      preferProducer: 'code.refactor',
      needsCoverage: true,
      workspaceCanonicalization: true,
      scopeKind: 'workspace-canonicalization',
    },
  },
  // Specification only: canonical Work from its source, SRS, SDS, stacks. The
  // workspace.manage setup entry on the catalog is the scope and the reconstructed roots are
  // the delivery review.verify reads. A brand-intent prompt adds brand.decide
  // (archetypes.yaml conditionalLegs); a settled brand record drops it again.
  'spec-foundation': {
    vars: (a, arch, text) => [
      { family: 'workspace', suffix: '', state: 'managed' },
      { family: 'business', suffix: 'X', state: 'decided' },
      { family: 'sds', suffix: 'X', state: 'decided' },
      ...arch.conditional.filter(c => c.when.some(p => phraseHits(text, p))).map(c => ({ ...c.var })),
    ],
    hints: {
      specFoundation: true,
      scopeProducer: 'workspace.manage',
      deliveryOps: ['workspace.manage'],
      scopeKind: 'spec-foundation',
    },
  },
  // Source setup: one scaffold leg per named surface (archetypes.yaml
  // greenfield-scaffold surfaces/surfaceRule); no decide leg precedes it.
  'greenfield-scaffold': {
    vars: (a, arch, text) => {
      const surfaces = arch.extra?.surfaces ?? {};
      const hit = key => asList(surfaces[key]).some(p => phraseHits(text, p));
      const named = ['backend', 'frontend', 'package'].filter(hit);
      const picked = named.length ? named : ['backend', 'frontend'];
      return picked.map(q => ({ family: 'impl', suffix: q, state: 'scaffolded', _qual: q, strictQualifier: true }));
    },
    hints: { scopeKind: 'greenfield-scaffold' },
  },
  // One feature through both lanes: the backend slice is a delivery of its
  // own (strict qualifier, so the frontend build cannot stand in for it) and
  // lands before the interface that consumes it.
  'feature-build-fullstack': {
    vars: a => [
      { family: 'impl', suffix: 'X', state: 'done', _qual: 'backend', strictQualifier: true },
      { family: 'ui', suffix: a.surfaceName, state: 'verified' },
      { family: 'api', suffix: a.surfaceName, state: 'verified' },
    ],
    hints: { fullstack: true, implQualifier: 'frontend', scopeKind: 'feature-build-fullstack' },
  },
  'investigate-first': {
    vars: () => [{ family: 'perf', suffix: 'X', state: 'verified' }],
    hints: { diagnosticFirst: true },
  },
  refactor: {
    vars: a => [{ family: 'impl', suffix: a.surfaceName, state: 'done' }],
    hints: { preferProducer: 'code.refactor', needsCoverage: true, scopeProvided: true },
  },
  'external-integration': {
    vars: a => [{ family: 'integration', suffix: a.surfaceName, state: 'verified' }],
    hints: { custody: true, implQualifier: 'backend' },
  },
  'assisted-uat-prepare': {
    vars: a => [{ family: 'uat', suffix: a.surfaceName, state: 'assisted-ready' }],
    hints: { assistedUat: true, assistedMode: 'prepare' },
  },
  'assisted-uat-verify': {
    vars: a => [{ family: 'uat', suffix: a.surfaceName, state: 'assisted-verified' }],
    hints: { assistedUat: true, assistedMode: 'verify' },
  },
  // Only on an explicit ask (modules/goal/archetypes.yaml unit-verify phrases): the full unit run is never a default leg.
  'unit-verify': {
    vars: () => [{ family: 'unit', suffix: 'X', state: 'verified' }],
    hints: {},
  },
  'verify-only': {
    vars: a => [{ family: 'slice', suffix: a.surfaceName, state: 'reviewed' }],
    hints: {},
  },
  'feature-build-with-ui': {
    vars: a => [{ family: 'ui', suffix: a.surfaceName, state: 'verified' }],
    hints: { implQualifier: 'frontend' },
  },
  'feature-build-backend': {
    vars: a => [{ family: 'api', suffix: a.surfaceName, state: 'verified' }],
    hints: { implQualifier: 'backend' },
  },
};

function alternativeMatches(text, alt) {
  const phrases = asList(alt?.phrases);
  if (!phrases.length || !phrases.some(p => phraseHits(text, p))) return false;
  if (!asList(alt.requires).every(group => asList(group).some(p => phraseHits(text, p)))) return false;
  return !asList(alt.excludes).some(p => phraseHits(text, p));
}

/** Load archetypes.yaml signalMatching into ordered matchers. Every sequenced
 *  id must carry phrase signals here and an S* entry in ARCHETYPE_STAR. */
export function loadArchetypeSignals(goalDir) {
  const file = path.join(goalDir, 'archetypes.yaml');
  const doc = parseYaml(fs.readFileSync(file, 'utf8'));
  const sets = doc?.signalMatching?.phraseSets ?? {};
  const expand = list => asList(list).flatMap(p => {
    if (typeof p !== 'string' || !p.startsWith('$')) return [p];
    const set = sets[p.slice(1)];
    if (!Array.isArray(set)) throw new Error(`${file}: phrase set '${p}' is not declared in signalMatching.phraseSets`);
    return set;
  });
  const expandAlt = alt => (alt && typeof alt === 'object' ? {
    ...alt,
    phrases: expand(alt.phrases),
    requires: asList(alt.requires).map(expand),
    excludes: expand(alt.excludes),
  } : alt);
  // conditionalLegs.entries: a leg's variable joins S* only when a `when`
  // phrase hits the prompt ("brand: settled" -> {family:'brand', state:'settled'}).
  const conditionalOf = entry => asList(entry?.conditionalLegs?.entries).map(c => {
    const m = /^([A-Za-z][A-Za-z0-9.]*)\s*:\s*(\S+)$/.exec(String(c?.var ?? '').trim());
    if (!m) throw new Error(`${file}: archetype '${entry.id}' conditionalLegs entry for '${c?.op}' has no parseable var`);
    const dot = m[1].indexOf('.');
    return { op: String(c.op), when: expand(c.when), var: { family: dot < 0 ? m[1] : m[1].slice(0, dot), suffix: dot < 0 ? '' : m[1].slice(dot + 1), state: m[2] } };
  });
  const byId = new Map();
  for (const arch of asList(doc?.archetypes)) {
    for (const entry of arch?.variants ? asList(arch.variants) : [arch]) {
      byId.set(String(entry.id), { id: String(entry.id), signals: asList(entry.signals).map(expandAlt), supersedes: asList(entry.supersedes ?? arch.supersedes), conditional: conditionalOf(entry), extra: entry });
    }
  }
  const sequence = asList(doc?.signalMatching?.sequence).map(String);
  if (!sequence.length) throw new Error(`${file}: signalMatching.sequence is empty`);
  const matchers = sequence.map(id => {
    const entry = byId.get(id);
    if (!entry) throw new Error(`${file}: signalMatching.sequence names '${id}', which no archetype or variant declares`);
    if (!entry.signals.some(alt => asList(alt?.phrases).length)) throw new Error(`${file}: archetype '${id}' is sequenced but has no signal phrases`);
    if (!ARCHETYPE_STAR[id]) throw new Error(`${file}: archetype '${id}' has no S* entry in scripts/route/route-plan.mjs`);
    return { ...entry, ...ARCHETYPE_STAR[id] };
  });
  // A refactor whose prompt hits $canonIntent is a canon-conformance cleanup (code.refactor params.canonFamilies).
  return Object.assign(matchers, { canonIntent: expand(['$canonIntent']), e2eIntent: expand(['$e2eIntent']), uatIntent: expand(['$uatIntent']), proofNegation: expand(['$proofNegation']), proofStateCue: expand(['$proofStateCue']), integrationIntent: expand(['$integrationIntent']) });
}

function matchArchetypes(rawText, archetypes) {
  const text = normalizeText(rawText);
  const hits = archetypes.filter(arch => arch.signals.some(alt => alternativeMatches(text, alt)));
  const superseded = new Set(hits.flatMap(arch => arch.supersedes));
  return hits.filter(arch => !superseded.has(arch.id));
}

const PROOF_SCOPES = new Set(['feature-build-fullstack', 'feature-build-with-ui', 'feature-build-backend', 'verify-only']);
// Live integration verification (integration.verify) is the same kind of manual-only proof (owner ruling 2026-09-29): it can
// join an external-integration scope or any build scope, and only on an explicit ask.
const INTEGRATION_SCOPES = new Set([...PROOF_SCOPES, 'external-integration']);

/** E2E runs manually only (owner ruling 2026-09-29): the e2e/UAT proof legs are explicit asks, never defaults. */
function explicitProofAsk(text, archetypes) {
  const { proofNegation: negation, proofStateCue: state } = archetypes;
  const asks = intent => asksFor(text, { intent, negation, state });
  return { e2e: asks(archetypes.e2eIntent), uat: asks(archetypes.uatIntent), integration: asks(archetypes.integrationIntent) };
}

/** Without an explicit ask a backend build ends at impl done (backend) and an interface build at ui audited;
 *  with one, the proof variable (api / ui verified) joins whatever archetype matched. */
function applyProofRule(vars, proof, a) {
  const out = [];
  for (const v of vars) {
    if (v.family === 'api' && v.state === 'verified' && !proof.e2e) {
      out.push({ family: 'impl', suffix: v.suffix, state: 'done', _qual: 'backend', strictQualifier: true });
    } else if (v.family === 'ui' && v.state === 'verified' && !proof.uat) {
      out.push({ family: 'ui', suffix: v.suffix, state: 'audited' });
    } else if (v.family === 'integration' && v.state === 'verified' && !proof.integration) {
      out.push({ family: 'impl', suffix: v.suffix, state: 'done', _qual: 'backend', strictQualifier: true });
    } else out.push(v);
  }
  if (proof.e2e && !out.some(v => v.family === 'api' && v.state === 'verified')) out.push({ family: 'api', suffix: a.surfaceName, state: 'verified' });
  if (proof.uat && !out.some(v => v.family === 'ui' && v.state === 'verified')) out.push({ family: 'ui', suffix: a.surfaceName, state: 'verified' });
  if (proof.integration && !out.some(v => v.family === 'integration' && v.state === 'verified')) out.push({ family: 'integration', suffix: a.surfaceName, state: 'verified' });
  return out;
}

// Words that fill the surface slot of the prompt pattern without naming a unit ("the backend API", "the existing feature").
const GENERIC_SURFACE_WORDS = new Set(['backend', 'back-end', 'frontend', 'front-end', 'existing', 'new', 'whole', 'entire', 'full', 'main', 'current', 'api', 'app', 'ui']);

export function intentToStar(text, args, archetypes) {
  const a = { surfaceName: 'X' };
  const sm = /\b(?:the|for|of)\s+([a-z][a-z0-9-]{2,})\s+(?:screen|page|api|endpoint|service|feature|module)/i.exec(text);
  if (sm && !GENERIC_SURFACE_WORDS.has(sm[1].toLowerCase())) a.surfaceName = sm[1];
  const matched = matchArchetypes(text, archetypes);
  if (!matched.length) return null;
  const vars = [];
  const hints = { archetypes: matched.map(m => m.id), surfaceName: a.surfaceName };
  for (const arch of matched) {
    vars.push(...arch.vars(a, arch, normalizeText(text)));
    Object.assign(hints, arch.hints);
  }
  if (hints.archetypes.includes('refactor') && asList(archetypes.canonIntent).some(p => phraseHits(normalizeText(text), p))) {
    Object.assign(hints, { canonConformance: true, scopeKind: 'canon-conformance' });
  }
  // Only a build or verify scope can carry a proof leg; a specification, scaffold, canonicalization or assisted
  // UAT prompt may name e2e/UAT as subject matter without asking for the leg.
  const proofScope = hints.archetypes.some(id => PROOF_SCOPES.has(id));
  const asked = explicitProofAsk(text, archetypes);
  const integrationScope = hints.archetypes.some(id => INTEGRATION_SCOPES.has(id));
  const proof = { e2e: proofScope && asked.e2e, uat: proofScope && asked.uat, integration: integrationScope && asked.integration };
  Object.assign(hints, { e2eAsked: proof.e2e, uatAsked: proof.uat, integrationAsked: proof.integration });
  const starVars = applyProofRule(vars, proof, a);
  // fanout: two or more disjoint verify surfaces in one prompt.
  const surfaces = new Set(starVars.map(v => v.family));
  if (surfaces.size >= 2) hints.fanout = true;
  return { vars: dedupeVars(starVars), hints };
}

export const varKey = v => `${v.family}${v.suffix ? '.' + v.suffix : ''}`;

export function dedupeVars(vars) {
  const seen = new Map();
  for (const v of vars) {
    const k = `${varKey(v)}:${v.state}`;
    if (!seen.has(k)) seen.set(k, v);
  }
  return [...seen.values()];
}

const PROOF_FAMILIES = new Set(['ui', 'api', 'integration', 'perf', 'security', 'unit']);

// The variable one state word of a target spec asks for.
function varOfState(st, { family, suffix, dot, surface, spec }) {
  if (st === 'exists' || st === 'built' || st === 'implemented') return { family: 'impl', suffix, state: 'done', raw: spec };
  if (st === 'proven' || st === 'verified') return { family: PROOF_FAMILIES.has(family) ? family : surface, suffix, state: 'verified', raw: spec };
  if (family === 'feature') return { family: 'impl', suffix, state: st, raw: spec };
  return { family, suffix: dot < 0 ? '' : suffix, state: st, raw: spec };
}

/** "feature.A: exists proven" -> [{impl.A: done}, {api.A: verified}].
 *  Explicit target vars normalize into the producesVocabulary state space. */
export function normalizeTargetVar(spec, args) {
  const m = VAR_STATE_LINE.exec(String(spec).trim());
  if (!m) return { error: `cannot parse target var '${spec}' — expected "<family>.<suffix>: <state>"` };
  const varPart = m[1];
  const states = m[2].trim().toLowerCase().split(/\s+/);
  const dot = varPart.indexOf('.');
  const family = dot < 0 ? varPart : varPart.slice(0, dot);
  const suffix = (dot < 0 ? '' : varPart.slice(dot + 1)) || 'X';
  const out = [];
  const surface = args.surface ?? (family === 'ui' ? 'ui' : 'api');
  for (const st of states) out.push(varOfState(st, { family, suffix, dot, surface, spec }));
  return { vars: dedupeVars(out) };
}