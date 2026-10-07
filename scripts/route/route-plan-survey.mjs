// route-plan-survey.mjs — the SURVEY step of route-plan.mjs: the .starciwork records read into S0 (the state of each variable), what a
// survey satisfies, and the impact of a goal text on a surveyed feature.
import fs from 'node:fs';
import path from 'node:path';
import { loadRecords, readWorkspace } from '../work/record-ownership.mjs';
import { phraseHits } from './phrase-match.mjs';
import { normalizeText } from '../lib/normalize.mjs';
import { walkFiles } from '../lib/walk.mjs';

// record schema -> state-variable family (producesVocabulary families).
const SCHEMA_FAMILY = {
  'work/business-rule@1': 'business', 'work/functional-requirement@1': 'business',
  'work/non-functional-requirement@1': 'business', 'work/policy-decision@1': 'business',
  'work/customer-journey@1': 'business', 'work/feature@1': 'business',
  'work/sds-component@1': 'sds', 'work/contract@1': 'sds', 'work/data@1': 'sds', 'work/event@1': 'sds',
  'work/implementation@1': 'impl',
  'work/ui-screen@1': 'ui', 'work/uat-flow@1': 'ui',
  'work/integration@1': 'integration',
  'work/brand@1': 'brand', 'work/scope@1': 'scope',
  'work/gap@1': 'gap',
};
const SETTLED = new Set(['done']);           // a record whose proof stands

const walk = dir => (fs.existsSync(dir) ? walkFiles(dir) : []);

/** features/<feature>/... -> <feature>; null for a record outside a feature folder. */
function featureOf(dir, stateDir) {
  const parts = path.relative(stateDir, dir).split(path.sep);
  return parts[0] === 'features' && parts[1] ? parts[1] : null;
}

/** An implementation record's lane: the workspace role of its repository (fe -> frontend), else backend. */
export function implQualifier(data, workspaceDoc) {
  const repos = Array.isArray(workspaceDoc?.repositories) ? workspaceDoc.repositories : [];
  return repos.find(r => r?.name === data?.repository)?.role === 'fe' ? 'frontend' : 'backend';
}

// Schemas whose records are backend-owned material: a goal whose feature holds one touches the backend.
const BACKEND_RECORD_SCHEMAS = new Set(['work/sds-component@1', 'work/contract@1', 'work/data@1', 'work/event@1', 'work/business-rule@1']);
const isBackendRecord = ent => (ent.family === 'impl' ? ent.qualifier === 'backend' : BACKEND_RECORD_SCHEMAS.has(ent.schema));

export function surveyS0(stateDir) {
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
    const entry = { id, schema: rec.schema, family, state, dir: rec.dir, feature: featureOf(rec.dir, stateDir),
      qualifier: family === 'impl' ? implQualifier(rec.data, workspaceDoc) : null };
    s0.records.push(entry);
    if (family === 'gap') { s0.gaps.push({ id, state }); continue; }
    if (!family) continue;
    // var key: family + record id tail (fr.audit.log.read -> business.audit.log.read)
    const suffix = id.split('.').slice(1).join('.');
    s0.vars.set(`${family}.${suffix}`, { recordId: id, state, settled: SETTLED.has(state), schema: rec.schema, feature: entry.feature, qualifier: entry.qualifier });
  }
  return s0;
}

// Whether one surveyed variable can stand for `v`: the same family and lane, and (when v names a suffix) the suffix, else the feature scope.
function s0VarMatches(key, ent, v, { wantSuffix, scope }) {
  const fam = key.split('.')[0];
  if (fam !== v.family) return false;
  if (v.family === 'impl' && v._qual && ent.qualifier !== v._qual) return false;
  if (wantSuffix && !key.slice(fam.length + 1).replaceAll('.', '-').includes(wantSuffix) && !key.includes(wantSuffix)) return false;
  return wantSuffix || !scope || scope.has(ent.feature);
}

/** Does S0 satisfy var {family,suffix,state}? A NAMED suffix needs a settled record whose id
 *  contains it. An unnamed one (X / '' / absent) is a family-level wildcard: it never settles a GOAL
 *  variable (the goal names no unit, so nothing on disk proves it done: settling it would drop the
 *  whole chain, backend.implement included, the moment any impl record was done), and for a prerequisite
 *  it counts only records of the goal's own features when the survey matched some, and never for the families
 *  an EXTEND changes (s0.extendFamilies: impl, ui). An impl variable
 *  carrying a lane (_qual) is satisfied only by a record of that lane: a done frontend record never
 *  stands in for the backend. An extend variable (the goal changes a unit that exists) is never satisfied.
 *  Returns {by, recordId?, recordState?}. */
export function satisfiedByS0(v, s0, { goal = false } = {}) {
  if (!s0 || v.extend) return null;
  const wantSuffix = v.suffix && v.suffix !== 'X' ? v.suffix : null;
  if (!wantSuffix && (goal || s0.wildcardOff || s0.extendFamilies?.has(v.family))) return null;
  const scope = s0.scopeFeatures?.size ? s0.scopeFeatures : null;
  let fallback = null;
  for (const [key, ent] of s0.vars) {
    if (!s0VarMatches(key, ent, v, { wantSuffix, scope })) continue;
    if (ent.settled) return { by: 's0', recordId: ent.recordId, recordState: ent.state };
    fallback ??= { by: 's0-unsettled', recordId: ent.recordId, recordState: ent.state };
  }
  return fallback; // record exists but not done -> still in delta, flagged
}

/** IMPACT ANALYSIS (modules/goal/existing.yaml survey): which features of S0 the goal text names, what
 *  exists there and in which state. A goal whose text names a surveyed feature EXTENDS it - its variables
 *  are delta even where a done record exists (the unit changes), and a feature that holds backend records
 *  or code brings the backend lane into a build scope that named only the interface. */
export function impactOf(text, s0, archetypeIds) {
  if (!s0?.records?.length) return null;
  const norm = normalizeText(text);
  const features = [...new Set(s0.records.map(r => r.feature).filter(Boolean))]
    .filter(f => phraseHits(norm, f) || phraseHits(norm, f.replaceAll('-', ' ')));
  const inScope = s0.records.filter(r => r.family && r.family !== 'gap' && features.includes(r.feature));
  const build = archetypeIds.some(id => BUILD_SCOPES.has(id));
  const shape = (build && (features.length ? 'EXTEND' : 'BUILD')) || 'REFERENCE';
  return {
    shape, features,
    settledOutOfScope: s0.records.filter(r => r.family && r.state === 'done' && !features.includes(r.feature)).length,
    reusedDone: inScope.filter(r => SETTLED.has(r.state)).map(r => r.id),
    open: inScope.filter(r => !SETTLED.has(r.state)).map(r => ({ id: r.id, state: r.state })),
    backendRecords: inScope.filter(isBackendRecord).map(r => r.id),
    frontendRecords: inScope.filter(r => r.family === 'impl' && r.qualifier === 'frontend').map(r => r.id),
  };
}

const BUILD_SCOPES = new Set(['feature-build-fullstack', 'feature-build-with-ui', 'feature-build-backend']);

/** An EXTEND goal: every S* variable of the touched features is delta, and a build scope whose features hold
 *  backend records or code plans the backend lane even when the prompt named only the interface. */
export function applyExtend(vars, impact, a) {
  if (impact?.shape !== 'EXTEND') return vars;
  const out = vars.map(v => ({ ...v, extend: true }));
  const hasBackend = out.some(v => v.family === 'impl' && v._qual === 'backend');
  if (impact.backendRecords.length && !hasBackend) {
    out.push({ family: 'impl', suffix: a.surfaceName, state: 'done', _qual: 'backend', strictQualifier: true, extend: true });
  }
  return out;
}