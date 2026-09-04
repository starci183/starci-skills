// interface.audit's own law over one branch, on top of the shared step check: every matrix entry in
// the verdicts has both a capture and a screenshot; every judged node was measured in that entry's
// capture and judged on a rule it actually claimed; a Grammar-owned node never routes a failure into
// the resolve loop and an application-owned failure always does; the surface class is the one the
// direction decision's coverage declared, never one chosen here; and the receipt reads what the
// verdicts carry.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { tableUnder, userRouted } from '../../scripts/validate-response.mjs';
import { loadErrorsRegistry } from '../../scripts/errors-registry.mjs';
import { sessionRootOf, missingStack } from '../../scripts/validate-request.mjs';
import { validateAgainst } from '../../scripts/json-schema.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const empty = (v) => v === undefined || v === null || v === '' || v === '—';
const list = (v) => (Array.isArray(v) ? v : empty(v) ? [] : [v]);

// knowledge/ui/proof/taste.md: TASTE-1..TASTE-12 are the scored criteria and TASTE-13 is the
// arithmetic over them. `ship` needs no failure on the five criteria a reader registers before
// reading a word, and a mean of at least 4; anything else is `fix-first`.
export const TASTE_RULES = Array.from({ length: 12 }, (_, i) => `TASTE-${i + 1}`);
// Each proof topic closes itself. A rule identifier belongs to exactly one topic, and the topic's own
// closing rule turns its results into one verdict; nothing here recomputes a threshold.
export const TOPIC_OF_PREFIX = {
  GAP: 'presentation', PADDING: 'presentation', MARGIN: 'presentation', MEASURE: 'presentation',
  RADIUS: 'presentation', SURFACE: 'presentation', TONE: 'presentation', FONT: 'presentation',
  BOUNDARY: 'presentation', OVERFLOW: 'presentation', FLOW: 'presentation',
  HIERARCHY: 'composition', CTA: 'composition', ACCENT: 'composition', ACTION: 'composition',
  LAYOUT: 'composition', STATE: 'composition', FEEDBACK: 'composition', COVERAGE: 'composition',
  RESPONSIVE: 'responsive',
  MOTION: 'motion',
  A11Y: 'accessibility', FOCUS: 'accessibility',
  COLOR: 'contrast',
  TRUTH: 'render-truth',
  TASTE: 'taste',
};
export const AUDIT_TOPICS = ['presentation', 'composition', 'responsive', 'motion', 'accessibility', 'contrast', 'render-truth', 'taste'];
const topicOf = (rule) => TOPIC_OF_PREFIX[String(rule).replace(/-\d+$/, '')] ?? null;
// STATE-* and FEEDBACK-* (composition), FOCUS-* (accessibility), and the taste lens (TASTE-13
// already scores it whole) are each only ever true of one particular coverage state, an absent
// branch, or a focused target. A matrix narrowed against the direction's declared states can judge
// every node these rules claim and still never exercise the state the rule is about, which is a
// silent gap rather than a passing measurement. These topics may only close `pass`, `fail` or
// `fix-first` when the matrix judged covers every state the direction's coverage declares
// (operator.md, the matrix paragraph; TASTE-13 Case 8); short of that they are `blocked`, the same
// value a topic with no evidence at all already carries.
export const STATE_READING_TOPICS = new Set(['composition', 'accessibility', 'taste']);
const TASTE_GATES = new Set(['TASTE-1', 'TASTE-2', 'TASTE-5', 'TASTE-8', 'TASTE-12']);
// TASTE-9 Case 5 and 6: the density criterion depends on data volume and is measured at the flow's
// representative seeded volume. Measured below it, its row reads `below-volume`, the lens is blocked
// and routes to seed — the operator that owns the data — never to direction and never to a person.
// Re-measured at volume and still failing, it reads `data-bound` and TASTE-13 Case 6 keeps it out of
// the arithmetic, so it blocks neither quality nor UAT. Only the density criterion carries a marker.
const VOLUME_RULE = 'TASTE-9';
const BELOW_VOLUME = 'below-volume';
const DATA_BOUND = 'data-bound';
// TASTE-13 Case 7: a criterion the person accepted from the printed sheet — the approved decision's
// scores showed it failing for the candidate they chose — reads `person-accepted` with the branch
// of that decision, and is kept out of the arithmetic: the rubric never overturns a decision the
// person took on its own evidence in the same session.
const PERSON_ACCEPTED = 'person-accepted';
const BRANCH = /step-\d+\/parallel-\d+/;
const measuredText = (row) => (Array.isArray(row.measured) ? row.measured : [row.measured]).map(String).join(' ');
export const isBelowVolume = (row) => measuredText(row).includes(BELOW_VOLUME);
export const isDataBound = (row) => measuredText(row).includes(DATA_BOUND);
export const isPersonAccepted = (row) => measuredText(row).includes(PERSON_ACCEPTED);
export function tasteVerdict(rows) {
  const scored = rows.filter((r) => r.verdict !== 'deferred' && !isDataBound(r) && !isBelowVolume(r) && !isPersonAccepted(r));
  const mean = scored.length ? scored.reduce((sum, r) => sum + Number(r.score), 0) / scored.length : 0;
  if (rows.some(isBelowVolume)) return { mean, verdict: 'blocked', routeTo: 'seed' };
  const gated = scored.some((r) => r.verdict === 'fail' && TASTE_GATES.has(r.rule));
  const verdict = !gated && mean >= 4 ? 'ship' : 'fix-first';
  return { mean, verdict, routeTo: verdict === 'ship' ? 'none' : 'direction' };
}
// TASTE-13 Case 9: the calibration set. The anchors, their bands and the tolerance are read from
// the file that publishes them; this gate carries no copy of a band. A scored lens whose receipt
// carries no anchor, or an anchor further outside its band than the tolerance, is CALIBRATION_OFF.
export const CALIBRATION_FILE = path.join('knowledge', 'ui', 'proof', 'calibration', 'calibration.json');
export async function loadCalibration(root = ROOT) {
  const file = path.join(root, CALIBRATION_FILE);
  if (!existsSync(file)) return null;
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return null; }
}
export const bandText = (lens, band) => `${lens} ${band[0]}–${band[1]}`;
export function calibrationErrors({ at, calibration, scored, lenses }) {
  const errors = [];
  if (!lenses.size) return errors;
  if (!calibration) { errors.push(`${CALIBRATION_FILE}: missing or unreadable, so a scored lens has no scale to be proved on (CALIBRATION_OFF)`); return errors; }
  const tolerance = Number(calibration.tolerance ?? 0);
  const anchors = new Map((calibration.anchors ?? []).map((a) => [a.id, a]));
  const rows = Array.isArray(scored) ? scored : [];
  for (const row of rows) if (!anchors.has(row.anchor)) errors.push(`${at}: calibration names ${row.anchor}, which the calibration set does not carry`);
  for (const lens of lenses) {
    const mine = rows.filter((r) => r.lens === lens);
    if (!mine.length) { errors.push(`${at}: the ${lens} lens is scored and no anchor of the calibration set is scored for it in the same round; a scale nobody proved makes no score comparable (CALIBRATION_OFF, TASTE-13 Case 9)`); continue; }
    for (const [id, anchor] of anchors) {
      const band = anchor.bands?.[lens];
      if (!band) continue;
      const hits = mine.filter((r) => r.anchor === id);
      if (!hits.length) { errors.push(`${at}: ${id} is not scored for the ${lens} lens; all three anchors are scored by the same auditor in the same round (CALIBRATION_OFF)`); continue; }
      if (hits.length > 1) errors.push(`${at}: ${id} is scored ${hits.length} times for the ${lens} lens`);
      const score = Number(hits[0].score);
      if (score < band[0] - tolerance || score > band[1] + tolerance) errors.push(`${at}: ${id} scored ${score} on the ${lens} lens, outside its band ${band[0]}–${band[1]} by more than the tolerance ${tolerance}; the round's scale is unproved (CALIBRATION_OFF, TASTE-13 Case 9)`);
    }
  }
  return errors;
}
const sectionText = (text, heading) => {
  const lines = text.split(/\r?\n/);
  const from = lines.findIndex((l) => l.trimEnd() === heading);
  if (from === -1) return '';
  const rest = lines.slice(from + 1);
  const next = rest.findIndex((l) => l.startsWith('## '));
  return (next === -1 ? rest : rest.slice(0, next)).join('\n');
};

export async function validateAuditStep(branchDir, root = ROOT) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { response, requirements = {}, present = new Set() } = base;
  if (!response || response.operatorId !== 'interface.audit') return { errors };
  const has = (f) => existsSync(path.join(branchDir, f));
  const read = (f) => readFile(path.join(branchDir, f), 'utf8');

  // An env names a stack of this installation; the vocabulary is the folder, not a list kept here.
  const missing = missingStack(root, requirements.env);
  if (missing) errors.push(`request.json: env ${requirements.env} names ${missing}, which this installation does not have`);

  let verdicts = null;
  if (present.has('verdicts') && has('response/data/verdicts.json')) {
    try { verdicts = JSON.parse(await read('response/data/verdicts.json')); } catch { verdicts = null; }
  }
  if (!verdicts) {
    if (response.status === 'done') errors.push('response/data/verdicts.json: a done branch needs the verdicts');
    return { errors };
  }
  const at = 'response/data/verdicts.json';
  const scopeSchema = JSON.parse(await readFile(path.join(root, 'templates/kinds/audit-scope.schema.json'), 'utf8'));
  const selection = requirements.auditScope;
  const selectionErrors = validateAgainst({ ...scopeSchema, ...scopeSchema.$defs.selection }, selection, 'request.auditScope');
  errors.push(...selectionErrors);
  const recordedScopeErrors = validateAgainst(scopeSchema, verdicts.auditScope, `${at}.auditScope`);
  errors.push(...recordedScopeErrors);
  if (selectionErrors.length || recordedScopeErrors.length) return { errors };
  const scopeMode = selection?.mode ?? scopeSchema.$defs.mode.default;
  const surfaceInventory = Array.isArray(selection?.surfaces) ? selection.surfaces : [];
  const selectedSurfaces = surfaceInventory.filter((surface) => surface.priority !== 'deferred');
  const selectedIds = selectedSurfaces.flatMap((surface) => surface.matrixIds ?? []);
  if (!selectedSurfaces.length) errors.push(`${at}: an audit must select at least one primary surface`);
  if (new Set(surfaceInventory.map((surface) => surface.id)).size !== surfaceInventory.length) errors.push(`${at}: selected surface ids must be unique`);
  for (const surface of surfaceInventory) {
    if (surface.priority === 'deferred' && (surface.matrixIds.length || scopeMode === 'exhaustive')) errors.push(`${at}: deferred surfaces carry no captured matrix and are unavailable in exhaustive mode`);
    if (surface.priority !== 'deferred' && !surface.matrixIds.length) errors.push(`${at}: each selected surface must declare its required matrix entries`);
  }
  if (new Set(selectedIds).size !== selectedIds.length) errors.push(`${at}: one matrix entry must belong to exactly one selected surface`);
  if (verdicts.auditScope?.mode !== scopeMode || JSON.stringify(verdicts.auditScope?.surfaces) !== JSON.stringify(surfaceInventory)) errors.push(`${at}: audit scope must preserve the request's selected surfaces and mode`);

  const captureRefs = new Set(list(response.fields?.capture));
  const shotRefs = new Set(list(response.fields?.screenshot));
  const narrowed = list(requirements.matrix);

  const captures = new Map();
  for (const ref of captureRefs) {
    if (!has(ref)) continue;
    let doc = null;
    try { doc = JSON.parse(await read(ref)); } catch { doc = null; }
    if (doc) captures.set(doc.matrixId, { doc, ref });
  }

  const ids = new Set();
  for (const entry of verdicts.entries) {
    if (ids.has(entry.matrixId)) errors.push(`${at}: matrix entry ${entry.matrixId} is judged twice`);
    ids.add(entry.matrixId);
    const capture = captures.get(entry.matrixId);
    if (!capture) { errors.push(`${at}: matrix entry ${entry.matrixId} has verdicts and no capture (EVIDENCE_MISSING)`); continue; }
    if (capture.ref !== `response/data/captures/${entry.matrixId}.json`) errors.push(`${capture.ref}: the capture of ${entry.matrixId} is not the file its id names`);
    if (!shotRefs.has(`response/artifacts/${entry.matrixId}.png`)) errors.push(`${at}: matrix entry ${entry.matrixId} has verdicts and no screenshot (EVIDENCE_MISSING)`);
    if (narrowed.length && !narrowed.some((m) => (typeof m === 'string' ? m : m.matrixId) === entry.matrixId)) {
      errors.push(`${at}: matrix entry ${entry.matrixId} was judged but the request narrowed the matrix without it`);
    }

    const nodes = new Map(capture.doc.nodes.map((n) => [n.path, n]));
    for (const result of entry.results) {
      const node = nodes.get(result.path);
      if (!node) { errors.push(`${at}: ${result.path} is judged under ${entry.matrixId} and was never measured there`); continue; }
      if (node.owner !== result.owner) errors.push(`${at}: ${result.path} is ${result.owner} here and ${node.owner} in the capture`);
      if (!node.claims.includes(result.rule)) errors.push(`${at}: ${result.path} is judged on ${result.rule}, which that node never claimed`);
      const measured = Object.values(node.measured);
      if (!measured.includes(result.measured)) errors.push(`${at}: ${result.path} is judged against ${result.measured}, which the capture did not measure`);
      if (result.verdict === 'pass' && result.routeTo !== 'none') errors.push(`${at}: ${result.path} passes and still routes to ${result.routeTo}`);
      if (result.verdict === 'fail') {
        if (result.owner === 'grammar' && result.routeTo === 'resolve') errors.push(`${at}: ${result.path} is a Grammar component's own render; a failure there is a grammar-gap, never a resolve loop`);
        if (result.owner === 'grammar' && !['grammar-gap', 'direction'].includes(result.routeTo)) errors.push(`${at}: ${result.path} is Grammar-owned; existing behavior routes to grammar-gap and a new presentation direction routes to direction`);
        if (result.owner === 'app' && result.routeTo !== 'resolve') errors.push(`${at}: ${result.path} is application-owned and its failure must route to resolve`);
        if (result.routeTo === 'none') errors.push(`${at}: ${result.path} fails and routes nowhere`);
      }
    }
    // Every claim a node carries is judged, or the claim is unaudited.
    for (const node of capture.doc.nodes) {
      for (const claim of node.claims) {
        if (!entry.results.some((r) => r.path === node.path && r.rule === claim)) errors.push(`${at}: ${node.path} claims ${claim} under ${entry.matrixId} and no verdict judges it`);
      }
    }
  }
  for (const [matrixId] of captures) if (!ids.has(matrixId)) errors.push(`${at}: ${matrixId} was captured and never judged`);
  const missingSelected = selectedIds.filter((id) => !ids.has(id) || !captures.has(id));
  for (const id of missingSelected) errors.push(`${at}: selected surface entry ${id} was not fully audited (EVIDENCE_MISSING)`);
  for (const id of ids) if (!selectedIds.includes(id)) errors.push(`${at}: ${id} is outside the frozen selected surfaces`);

  // The states a state-reading topic must see before it may close: the direction's coverage names
  // them (COVERAGE-1 Case 1 and Case 5, `coverage.actions[].states` and `coverage.states[].meaning`),
  // and every surface also carries its own baseline `loaded` state. Anything declared and never
  // captured in this branch is a gap the matrix left, not a gap the surface has. Read once, ahead of
  // the taste rollup, so a blocked lens is blocked in both the ## Taste line and the ## Verdict row.
  const decisionRef = base.request?.inputs?.['frontend-direction-decision'];
  const sessionRoot = sessionRootOf(branchDir);
  let coverageDoc = null;
  let missingStates = new Set();
  let deferredStates = [];
  if (decisionRef && sessionRoot && response.status === 'done') {
    const coverageFile = path.join(sessionRoot, path.dirname(String(decisionRef)), 'data', 'coverage.json');
    if (existsSync(coverageFile)) {
      try { coverageDoc = JSON.parse(await readFile(coverageFile, 'utf8')); } catch { coverageDoc = null; }
    }
    if (coverageDoc) {
      const declaredStates = new Set(['loaded', ...(coverageDoc.states ?? []).map((s) => s.meaning), ...(coverageDoc.actions ?? []).flatMap((a) => a.states ?? [])]);
      const capturedStates = new Set([...captures.values()].map((c) => c.doc.state));
      const absent = [...declaredStates].filter((s) => !capturedStates.has(s));
      if (scopeMode === 'exhaustive') missingStates = new Set(absent);
      else deferredStates = absent;
    }
  }
  const coverageClaim = missingSelected.length || missingStates.size ? 'incomplete' : scopeMode === 'exhaustive' ? 'full-state-matrix' : 'selected-surfaces';
  if (JSON.stringify([...(verdicts.auditScope?.deferredStates ?? [])].sort()) !== JSON.stringify(deferredStates.sort())) errors.push(`${at}: deferred states must name exactly the declared secondary states not captured in this primary-surface audit`);
  if (verdicts.auditScope?.coverageClaim !== coverageClaim) errors.push(`${at}: coverage claim must be ${coverageClaim}; selected surfaces cannot claim full UI state coverage`);

  // The taste lens. A done audit publishes it for every entry it judged: all twelve scored criteria,
  // each failure routed to direction because no value swap repairs a composition (TASTE-13 Case 4),
  // and the entry's own mean and verdict computed by TASTE-13 Case 2 rather than asserted.
  const rolled = new Map(); // rule -> { score, verdict, measured[] }
  const personAccepted = []; // { matrixId, rule, branch }, checked against the decision below
  for (const entry of verdicts.entries) {
    const lens = entry.taste;
    if (!lens) {
      if (response.status === 'done') errors.push(`${at}: ${entry.matrixId} carries no taste block; a done audit publishes both lenses, canon and taste`);
      continue;
    }
    const seen = new Map();
    for (const row of lens.entries) {
      if (seen.has(row.rule)) errors.push(`${at}: ${entry.matrixId} scores ${row.rule} twice`);
      seen.set(row.rule, row);
      if (!TASTE_RULES.includes(row.rule)) errors.push(`${at}: ${entry.matrixId} scores ${row.rule}, which is not one of the twelve scored criteria (TASTE-13 is the arithmetic and is not itself scored)`);
      const deferable = scopeSchema.$defs.deferredTasteRule.enum.includes(row.rule);
      if (row.verdict === 'deferred') {
        if (scopeMode !== 'primary-surfaces' || !deferredStates.length || !deferable || row.score !== null || row.routeTo !== 'none' || !deferredStates.every((state) => row.measured.includes(state))) errors.push(`${at}: deferred criterion must name its deferred states, carry no score and belong to the primary-surface scope`);
      } else {
        if (row.score === null) errors.push(`${at}: a judged criterion must carry its measured score`);
        if (deferable && scopeMode === 'primary-surfaces' && deferredStates.length) errors.push(`${at}: state-comparison criterion must be deferred when its declared secondary states were not captured`);
      }
      const marker = isBelowVolume(row) ? BELOW_VOLUME : isDataBound(row) ? DATA_BOUND : isPersonAccepted(row) ? PERSON_ACCEPTED : null;
      if ((marker === BELOW_VOLUME || marker === DATA_BOUND) && row.rule !== VOLUME_RULE) errors.push(`${at}: ${entry.matrixId} marks ${row.rule} ${marker}; only the density criterion ${VOLUME_RULE} depends on data volume (TASTE-9 Case 5)`);
      if (marker === PERSON_ACCEPTED) {
        if (row.routeTo !== 'none' || row.verdict !== 'fail') errors.push(`${at}: ${entry.matrixId} records ${row.rule} person-accepted; the row keeps its fail and routes nowhere, the choice closed it (TASTE-13 Case 7)`);
        const branch = BRANCH.exec(measuredText(row))?.[0] ?? null;
        if (!branch) errors.push(`${at}: ${entry.matrixId} records ${row.rule} person-accepted and names no decision branch; the acceptance is the person's approval of one decision, named as step-N/parallel-M (TASTE-13 Case 7)`);
        else personAccepted.push({ matrixId: entry.matrixId, rule: row.rule, branch });
      }
      if (marker === BELOW_VOLUME && row.routeTo !== 'seed') errors.push(`${at}: ${entry.matrixId} measures ${row.rule} below the representative seeded volume and routes to ${row.routeTo}; it routes to seed, the operator that owns the data, never to direction and never to a person (TASTE-9 Case 5)`);
      if (marker === DATA_BOUND && row.routeTo !== 'none') errors.push(`${at}: ${entry.matrixId} records ${row.rule} data-bound at representative volume and routes to ${row.routeTo}; a data-bound criterion is left out of the verdict and routes nowhere (TASTE-13 Case 6)`);
      if (!marker && row.verdict === 'fail' && row.routeTo !== 'direction') errors.push(`${at}: ${entry.matrixId} fails ${row.rule} and routes to ${row.routeTo}; a taste failure routes to direction, never to resolve`);
      if (!marker && row.verdict === 'pass' && row.routeTo !== 'none') errors.push(`${at}: ${entry.matrixId} passes ${row.rule} and still routes to ${row.routeTo}`);
    }
    for (const rule of TASTE_RULES) if (!seen.has(rule)) errors.push(`${at}: ${entry.matrixId} leaves ${rule} unscored; the lens is incomplete until every criterion carries a measurement`);
    const complete = TASTE_RULES.every((r) => seen.has(r)) && seen.size === TASTE_RULES.length;
    if (complete) {
      const rows = TASTE_RULES.map((r) => seen.get(r));
      const computed = tasteVerdict(rows);
      if (Math.abs(Number(lens.mean) - computed.mean) > 0.005) errors.push(`${at}: ${entry.matrixId} records a mean of ${lens.mean}; the twelve scores average ${computed.mean.toFixed(2)}`);
      if (lens.verdict !== computed.verdict) errors.push(`${at}: ${entry.matrixId} records ${lens.verdict}; TASTE-13 makes it ${computed.verdict}`);
      for (const row of rows) {
        const prior = rolled.get(row.rule);
        if (!prior) rolled.set(row.rule, { score: row.score, verdict: row.verdict, measured: [row.measured] });
        else {
          const verdict = prior.verdict === 'fail' || row.verdict === 'fail' ? 'fail' : prior.verdict === 'deferred' || row.verdict === 'deferred' ? 'deferred' : 'pass';
          rolled.set(row.rule, { score: verdict === 'deferred' ? null : Math.min(prior.score ?? Infinity, row.score ?? Infinity), verdict, measured: [...prior.measured, row.measured] });
        }
      }
    }
  }
  // The surface is only as good as its worst captured viewport, so the receipt publishes the lens
  // rolled up across the entries: the lowest score and the failing verdict win.
  const lensRows = TASTE_RULES.filter((r) => rolled.has(r)).map((r) => ({ rule: r, ...rolled.get(r) }));
  const surface = lensRows.length === TASTE_RULES.length ? tasteVerdict(lensRows) : null;
  // The matrix left out a declared state: the lens is blocked over it (TASTE-13 Case 8), the same as
  // it is blocked by evidence that never arrived at all, whatever the twelve scored criteria would
  // otherwise have made it. A below-volume row already routes to seed; that takes precedence.
  if (surface && missingStates.size && surface.routeTo !== 'seed') { surface.verdict = 'blocked'; surface.routeTo = 'none'; }
  // A blocked branch routes by its stop, not by next; the hand-offs below are read on a done one.
  if (surface && response.status === 'done') {
    const next = response.next ?? [];
    if (surface.verdict === 'fix-first') {
      if (!next.includes('interface.generate')) errors.push('response/response.json: the taste lens is fix-first, so next names interface.generate');
      if (next.includes('quality.verify')) errors.push('response/response.json: the taste lens is fix-first, so the checkout\'s own gates do not run yet; quality.verify follows a ship');
    }
    if (surface.verdict === 'blocked' && surface.routeTo === 'seed') {
      if (!next.includes('data.seed')) errors.push('response/response.json: the density criterion was measured below the flow\'s representative seeded volume, so next names data.seed, the operator that seeds; the entry is captured again at volume (TASTE-9 Case 5)');
      if (next.includes('interface.generate')) errors.push('response/response.json: a density measured below representative volume is a data gap, not a composition finding; next does not name interface.generate');
      if (next.includes('quality.verify')) errors.push('response/response.json: the taste lens is blocked until the entry is captured at representative volume; quality.verify follows a ship');
    }
    // A lens blocked because the matrix left out a declared state routes the same way every other
    // state-reading topic does; the shared check below the topic rows covers quality.verify and
    // interface.generate for all of them at once.
  }

  // The scale the taste lens was scored on: the three anchors, scored in this round, inside their
  // bands (TASTE-13 Case 9). Read on any branch that carries a taste block, done or not, because a
  // blocked branch that scored the surface on an unproved scale has still recorded scores nobody can
  // compare; a branch that scored nothing owes no anchor.
  const calibration = await loadCalibration(root);
  const lenses = new Set(verdicts.entries.some((e) => e.taste) ? ['taste'] : []);
  errors.push(...calibrationErrors({ at, calibration, scored: verdicts.calibration, lenses }));

  // One surface, one class: every entry carries the class the coverage declared, and they agree.
  const classes = new Set(verdicts.entries.map((e) => e.surfaceClass));
  if (classes.size > 1) errors.push(`${at}: the entries declare ${[...classes].join(' and ')}; one surface has one class, and every banded rule reads its threshold from it`);

  // The class is not this operator's to choose: it is read from the direction decision this audit
  // was given, whose coverage declared it (COVERAGE-1 Case 7). A decision that carries none — an
  // older one, written before the coverage declared a class — is SURFACE_CLASS_MISSING, and the
  // audit stops rather than banding a surface by taste. `coverageDoc` was already read above, ahead
  // of the taste rollup, for the state-coverage check.
  if (decisionRef && sessionRoot && response.status === 'done') {
    const declared = coverageDoc?.surfaceClass ?? null;
    if (empty(declared)) errors.push(`${at}: the frontend-direction-decision this audit reads declares no surface class, so every banded rule is left without a threshold (SURFACE_CLASS_MISSING)`);
    else for (const cls of classes) if (cls !== declared) errors.push(`${at}: the entries carry ${cls} and the direction's coverage declares ${declared}; the class is read from the decision, never chosen here`);
  }
  // A person-accepted criterion is checked against the decision it names: that decision is the one
  // this audit reads, the person approved it, and its scores showed the criterion failing for the
  // candidate they chose. Anything else is a fail dressed as an acceptance.
  if (personAccepted.length && decisionRef && sessionRoot) {
    const decisionBranch = BRANCH.exec(String(decisionRef))?.[0] ?? null;
    const decisionFile = path.join(sessionRoot, String(decisionRef));
    let decisionText = '';
    if (existsSync(decisionFile)) decisionText = await readFile(decisionFile, 'utf8');
    const decision = Object.fromEntries((tableUnder(decisionText, '## Decision') ?? []).map(([k, v]) => [k, v]));
    const shownFailing = new Set((tableUnder(decisionText, '## Scores') ?? []).filter(([candidate, , , , verdict]) => candidate === decision['Selected candidate'] && verdict === 'fail').map(([, , criterion]) => criterion));
    for (const { matrixId, rule, branch } of personAccepted) {
      if (branch !== decisionBranch) { errors.push(`${at}: ${matrixId} records ${rule} person-accepted by ${branch}, which is not the decision this audit reads (${decisionBranch})`); continue; }
      if (decision['Selection policy'] !== 'approval-required') errors.push(`${at}: ${matrixId} records ${rule} person-accepted by ${branch}, a decision the operator took by itself; only a choice the person took closes a criterion (TASTE-13 Case 7)`);
      if (!shownFailing.has(rule)) errors.push(`${at}: ${matrixId} records ${rule} person-accepted, but the chosen candidate was not shown failing ${rule} in the scores of ${branch}; a choice closes only what the sheet showed (TASTE-13 Case 7)`);
    }
  }

  // Each topic's row is the verdict its own closing rule produced over the results of that topic.
  const topicRows = new Map();
  for (const entry of verdicts.entries) {
    for (const result of entry.results) {
      const topic = topicOf(result.rule);
      if (!topic) { errors.push(`${at}: ${result.rule} belongs to no published proof topic`); continue; }
      const prior = topicRows.get(topic) ?? { verdict: 'pass', routeTo: 'none' };
      if (result.verdict === 'fail') topicRows.set(topic, { verdict: 'fail', routeTo: prior.verdict === 'fail' ? prior.routeTo : result.routeTo });
      else if (!topicRows.has(topic)) topicRows.set(topic, prior);
    }
  }
  if (surface) topicRows.set('taste', { verdict: surface.verdict, routeTo: surface.routeTo });
  // The matrix left out a state the direction declared: every state-reading topic is blocked over
  // it, whatever the results it did judge would otherwise have made it, because none of them prove
  // the topic's state-reading rules ever ran (operator.md, the matrix paragraph; TASTE-13 Case 8).
  if (missingStates.size) for (const topic of STATE_READING_TOPICS) topicRows.set(topic, { verdict: 'blocked', routeTo: 'none' });
  const topicVerdict = (topic) => topicRows.get(topic) ?? { verdict: 'blocked', routeTo: 'none' };

  if (missingStates.size && response.status === 'done') {
    const next = response.next ?? [];
    if (next.includes('quality.verify')) errors.push(`${at}: a state-reading topic is blocked because the matrix leaves out ${[...missingStates].join(', ')}, a state the direction's coverage declares; quality.verify follows only once every topic ships or passes`);
    if (next.includes('interface.generate')) errors.push(`${at}: a matrix gap is not a composition finding; next does not name interface.generate for it`);
  }

  const failing = verdicts.entries.flatMap((e) => e.results.filter((r) => r.verdict === 'fail'));
  if (response.status === 'done' && failing.some((r) => r.routeTo === 'resolve') && !(response.next ?? []).includes('interface.fix')) {
    errors.push('response/response.json: a claim fails on an application-owned node, so next names interface.fix');
  }
  const libraryRepairs = failing.filter((r) => r.owner === 'grammar' && r.routeTo === 'grammar-gap');
  if (libraryRepairs.length) {
    if (response.status === 'done' && !(response.next ?? []).includes('workspace.bind')) errors.push('response/response.json: an existing library grammar-gap first routes to workspace.bind for the owner checkout, then library.update under its repair authority');
    if ((response.next ?? []).some((next) => ['interface.audit', 'quality.verify', 'library.update'].includes(next))) errors.push('response/response.json: a grammar-gap cannot self-loop, pass quality, or skip the owner workspace binding');
    if (await userRouted(root, await loadErrorsRegistry(root), 'interface.audit', response)) errors.push('response/response.json: an already-authorized library repair is not handed to a person to publish; bind its owner checkout');
  }
  if (response.status === 'done' && failing.some((r) => r.owner === 'grammar' && r.routeTo === 'direction') && !(response.next ?? []).includes('interface.generate')) errors.push('response/response.json: a new Grammar presentation direction or tier routes to interface.generate, preserving the user choice');

  // A composition or taste verdict is never closed by asking. An open one routes to direction,
  // which scores the rendered candidates and decides or proves the tie; a density measured below
  // representative volume routes to seed. Either way the answer is computable from the tree, and a
  // question whose answer is computable is not put to a person.
  const open = ['composition', 'taste'].filter((topic) => ['fail', 'fix-first'].includes(topicVerdict(topic).verdict) || topicVerdict(topic).routeTo === 'seed');
  if (open.length > 0 && await userRouted(root, await loadErrorsRegistry(root), 'interface.audit', response)) {
    errors.push(`response/response.json: the ${open.join(' and ')} verdict is open and the branch hands to a person; a composition or taste finding routes to direction, which scores the rendered candidates and decides or proves the tie, and a density below representative volume routes to seed; this audit asks nobody`);
  }

  if (present.has('frontend-surface-audit') && has('response/response.md')) {
    const text = await read('response/response.md');
    const rel = 'response/response.md';
    const scopeRows = Object.fromEntries(tableUnder(text, '## Audit scope') ?? []);
    const expectedScopeRows = { Mode: scopeMode, 'Selected surfaces': selectedSurfaces.map((surface) => surface.id).join(', '), 'Coverage claim': coverageClaim, 'Deferred states': deferredStates.join(', ') || '—' };
    for (const [field, expected] of Object.entries(expectedScopeRows)) if (scopeRows[field] !== expected) errors.push(`${rel}: Audit scope ${field} must preserve ${expected}`);
    // One integration branch carries several sessions' work, so the audit states which head it
    // measured and how its own commit is inside it. Ancestry a reader cannot see is a claim, and a
    // browser profile nobody recorded is how one session's sign-in becomes another session's evidence.
    const servedRows = Object.fromEntries((tableUnder(text, '## Served surface') ?? []).map(([k, v]) => [k, v]));
    const bare = (v) => String(v ?? '').replace(/^`|`$/g, '').trim();
    for (const field of ['Applied commit', 'Served head']) {
      if (!/^[0-9a-f]{40}$/.test(bare(servedRows[field]))) errors.push(`${rel}: Served surface must name the ${field.toLowerCase()} as a full commit, and it names ${servedRows[field] ?? '—'}`);
    }
    if (bare(servedRows['Contains applied commit']) !== 'yes') errors.push(`${rel}: the served head must contain the applied commit; a surface that does not is SOURCE_DRIFT with nothing captured`);
    if (empty(bare(servedRows['Browser profile']))) errors.push(`${rel}: Served surface names the browser profile this session drove, so a sign-in state from another session is visible rather than suspected`);
    // Clean source ancestry proves nothing about the family a served head renders: main can carry a
    // dependency the session never resolved against forward on its own, and a presentation verdict
    // that flips over that has nothing to do with the source this session wrote. Both versions are
    // always named here, and when they differ, named again wherever a verdict's own measured evidence
    // could have been the one the drift, rather than the source, actually flipped.
    const FAMILY_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.]+)?$/;
    for (const field of ['Family version observed', 'Family version resolved against']) {
      if (!FAMILY_VERSION.test(bare(servedRows[field]))) errors.push(`${rel}: Served surface must name the ${field.toLowerCase()} as a family version, and it names ${servedRows[field] ?? '—'}`);
    }
    const familyObserved = bare(servedRows['Family version observed']);
    const familyResolved = bare(servedRows['Family version resolved against']);
    if (FAMILY_VERSION.test(familyObserved) && FAMILY_VERSION.test(familyResolved) && familyObserved !== familyResolved) {
      const namesBoth = (measured) => String(measured ?? '').includes(familyObserved) && String(measured ?? '').includes(familyResolved);
      const ownerMeasured = (tableUnder(text, '## Verdicts by owner') ?? []).map((row) => row[4]);
      const regressionMeasured = (tableUnder(text, '## Regressions') ?? []).map((row) => row[3]);
      if (![...ownerMeasured, ...regressionMeasured].some(namesBoth)) errors.push(`${rel}: the served head renders family ${familyObserved} and this delivery resolved against ${familyResolved}; a version drift the receipt does not name in a verdict's own measured evidence is a presentation flip nobody can trace to its real cause`);
    }
    const matrixRows = tableUnder(text, '## Matrix') ?? [];
    if (matrixRows.length !== verdicts.entries.length) errors.push(`${rel}: Matrix has ${matrixRows.length} rows, the verdicts carry ${verdicts.entries.length} entries`);
    for (const [id, viewport, scheme, state] of matrixRows) {
      const capture = captures.get(id);
      if (!capture) { errors.push(`${rel}: Matrix names ${id}, which has no capture`); continue; }
      if (`${capture.doc.viewport[0]}x${capture.doc.viewport[1]}` !== viewport) errors.push(`${rel}: ${id} is ${viewport} here and ${capture.doc.viewport.join('x')} in the capture`);
      if (capture.doc.scheme !== scheme || capture.doc.state !== state) errors.push(`${rel}: ${id} scheme or state differs from the capture`);
    }
    const rows = tableUnder(text, '## Verdicts by owner') ?? [];
    const all = verdicts.entries.flatMap((e) => e.results);
    if (rows.length !== all.length) errors.push(`${rel}: Verdicts by owner has ${rows.length} rows, the verdicts carry ${all.length} results`);
    for (const [matrixId, owner, node, rule, , verdict] of rows) {
      const entry = verdicts.entries.find((e) => e.matrixId === matrixId);
      const result = entry?.results.find((r) => r.path === node && r.rule === rule);
      if (!result) { errors.push(`${rel}: Verdicts by owner names ${rule} on ${node} under ${matrixId}, which the verdicts do not carry`); continue; }
      if (result.owner !== owner) errors.push(`${rel}: ${node} is ${owner} here and ${result.owner} in the verdicts`);
      if (result.verdict !== verdict) errors.push(`${rel}: ${rule} on ${node} is ${verdict} here and ${result.verdict} in the verdicts`);
    }
    // ## Taste reads what the taste blocks carry, rolled up across the entries, and closes with the
    // mean and the verdict TASTE-13 computes from those very rows.
    if (surface) {
      const tasteRows = tableUnder(text, '## Taste') ?? [];
      if (tasteRows.length !== TASTE_RULES.length) errors.push(`${rel}: Taste has ${tasteRows.length} rows, the lens scores ${TASTE_RULES.length} criteria`);
      for (const [rule, measured, score, verdict] of tasteRows) {
        const row = rolled.get(rule);
        if (!row) { errors.push(`${rel}: Taste names ${rule}, which the verdicts do not score`); continue; }
        if ((row.score === null ? score !== '—' : Number(score) !== row.score)) errors.push(`${rel}: ${rule} scores ${score} here and ${row.score} in the verdicts`);
        if (verdict !== row.verdict) errors.push(`${rel}: ${rule} is ${verdict} here and ${row.verdict} in the verdicts`);
        if (!row.measured.includes(measured)) errors.push(`${rel}: ${rule} is scored on "${measured}", which no capture measured`);
      }
      const section = sectionText(text, '## Taste');
      const mean = /^- Mean: (\d+(?:\.\d+)?)$/m.exec(section);
      const verdictLine = /^- Verdict: (ship|fix-first|blocked)$/m.exec(section);
      if (!mean) errors.push(`${rel}: Taste closes with no "- Mean: <number>" line`);
      else if (Math.abs(Number(mean[1]) - surface.mean) > 0.005) errors.push(`${rel}: Taste records a mean of ${mean[1]}; the scored rows average ${surface.mean.toFixed(2)}`);
      if (!verdictLine) errors.push(`${rel}: Taste closes with no "- Verdict: ship|fix-first|blocked" line`);
      else if (verdictLine[1] !== surface.verdict) errors.push(`${rel}: Taste records ${verdictLine[1]}; TASTE-13 makes the surface ${surface.verdict}`);
    }

    // ## Calibration reads what verdicts.calibration carries — one row per anchor and lens, the band
    // the set publishes and the score this round took — and ## Ranked against names the sheets the
    // taste lens was placed among: every other selected surface of the scope when there is more than
    // one, never a sheet outside it. A table missing while a lens is scored is the same absence the
    // data check names above.
    if (lenses.size) {
      const calRows = tableUnder(text, '## Calibration') ?? [];
      const scored = Array.isArray(verdicts.calibration) ? verdicts.calibration : [];
      if (!calRows.length) errors.push(`${rel}: ## Calibration carries no row while the ${[...lenses].join(' and ')} lens is scored; the three anchors are scored in the same round and recorded here (CALIBRATION_OFF)`);
      if (calRows.length !== scored.length) errors.push(`${rel}: Calibration has ${calRows.length} rows, the verdicts carry ${scored.length} anchor scores`);
      for (const [anchor, expected, score] of calRows) {
        const m = /^(taste|ux) ([1-5])–([1-5])$/.exec(expected ?? '');
        const entry = scored.find((s) => s.anchor === anchor && s.lens === m?.[1]);
        if (!m || !entry) { errors.push(`${rel}: Calibration names ${anchor} for ${expected}, which the verdicts do not score`); continue; }
        const band = calibration?.anchors?.find((a) => a.id === anchor)?.bands?.[m[1]];
        if (band && bandText(m[1], band) !== expected) errors.push(`${rel}: ${anchor} is expected at ${expected} here and the calibration set publishes ${bandText(m[1], band)}`);
        if (Number(score) !== entry.score) errors.push(`${rel}: ${anchor} scores ${score} here and ${entry.score} in the verdicts`);
      }
      const ranked = (tableUnder(text, '## Ranked against') ?? []).map(([sheet]) => sheet);
      const selectedNames = selectedSurfaces.map((s) => s.id);
      for (const sheet of ranked) if (!selectedNames.includes(sheet)) errors.push(`${rel}: Ranked against names ${sheet}, which is not a selected surface of this scope; the taste lens is ranked across the sheets of the feature it was scored with and nothing else`);
      if (selectedNames.length > 1) for (const id of selectedNames) if (!ranked.includes(id)) errors.push(`${rel}: Ranked against omits ${id}; a taste lens scored over several surfaces says which sheets it placed each one among`);
    }

    // ## Surface class carries the one the coverage declared, and ## Verdict carries one row per
    // topic, each copied from the topic that computed it rather than recomputed here.
    const classRows = tableUnder(text, '## Surface class') ?? [];
    const declared = classRows[0]?.[0]?.replaceAll('`', '');
    if (declared && classes.size === 1 && declared !== [...classes][0]) errors.push(`${rel}: Surface class reads ${declared} and the verdicts carry ${[...classes][0]}`);
    const verdictRows = tableUnder(text, '## Verdict') ?? [];
    if (verdictRows.length !== AUDIT_TOPICS.length) errors.push(`${rel}: Verdict has ${verdictRows.length} rows, this operator closes ${AUDIT_TOPICS.length} topics`);
    for (const [topicCell, verdict, route] of verdictRows) {
      const topic = topicCell.replaceAll('`', '');
      if (!AUDIT_TOPICS.includes(topic)) { errors.push(`${rel}: Verdict names ${topic}, which is not a topic this operator closes`); continue; }
      const computed = topicVerdict(topic);
      if (verdict !== computed.verdict) errors.push(`${rel}: Verdict records ${verdict} for ${topic}; its own rule made it ${computed.verdict}`);
      if (route !== computed.routeTo) errors.push(`${rel}: Verdict routes ${topic} to ${route}; its own rule routes it to ${computed.routeTo}`);
    }

    // A narrowed matrix that left out a declared state is not a quiet omission: ## Coverage gaps
    // names exactly which state-reading topic is blocked over exactly which missing state, one row
    // per pair, and no row when the matrix covered everything the direction declared.
    const gapRows = tableUnder(text, '## Coverage gaps') ?? [];
    const gapKey = (topic, state) => JSON.stringify([topic, state]);
    const expectedGaps = new Set();
    if (missingStates.size) for (const topic of STATE_READING_TOPICS) for (const s of missingStates) expectedGaps.add(gapKey(topic, s));
    const seenGaps = new Set();
    for (const [topicCell, state] of gapRows) {
      const topic = topicCell.replaceAll('`', '');
      const key = gapKey(topic, state);
      if (!expectedGaps.has(key)) errors.push(`${rel}: Coverage gaps names ${topic} missing ${state}, which this branch's coverage and captures do not bear out`);
      seenGaps.add(key);
    }
    for (const key of expectedGaps) if (!seenGaps.has(key)) { const [topic, state] = JSON.parse(key); errors.push(`${rel}: Coverage gaps omits ${topic} missing ${state}; the matrix left that state out and the topic is blocked over it`); }

    // Serving is not telling: the sheet reaches the person at the moment the verdict is recorded, and
    // ## Printed is where the receipt says what was handed over. An audit that filed its sheet and
    // said nothing leaves a verdict nobody read.
    const printed = (tableUnder(text, '## Printed') ?? []).map(([artifact]) => artifact);
    if (response.status === 'done' && !printed.some((p) => /host\.json$/.test(p) || /^https?:\/\//.test(p))) {
      errors.push(`${rel}: ## Printed names no served sheet; the audit hands the person the sheet's URL when the verdict is recorded and records here what it handed over`);
    }

    const regressions = tableUnder(text, '## Regressions') ?? [];
    if (regressions.length !== failing.length) errors.push(`${rel}: Regressions has ${regressions.length} rows, the verdicts carry ${failing.length} failures`);
    for (const [matrixId, node, rule, , routeTo] of regressions) {
      const entry = verdicts.entries.find((e) => e.matrixId === matrixId);
      const result = entry?.results.find((r) => r.path === node && r.rule === rule && r.verdict === 'fail');
      if (!result) { errors.push(`${rel}: Regressions names ${rule} on ${node}, which no verdict fails`); continue; }
      if (result.routeTo !== routeTo) errors.push(`${rel}: ${rule} on ${node} routes to ${routeTo} here and ${result.routeTo} in the verdicts`);
    }
    const familyGaps = tableUnder(text, '## Grammar gaps') ?? [];
    for (const repair of libraryRepairs) if (!familyGaps.some(([component, rule, evidence]) => component === repair.path && rule === repair.rule && !empty(evidence))) errors.push(`${rel}: Grammar gaps must preserve ${repair.rule} on ${repair.path} for the owner repair handoff`);
  }
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node validate.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  const { errors } = await validateAuditStep(path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('valid interface.audit branch\n');
}
