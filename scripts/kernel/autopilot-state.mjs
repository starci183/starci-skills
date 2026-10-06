// autopilot-state.mjs — the read side of autopilot-run.mjs: the ledger queries the run decisions are
// made from (pending asks, deferrals, provisional acceptances, the owner's checklist answer), the
// machine gates a draw/direction review is judged by, and the plan/commit stages of one autopilot
// pass. Extracted from autopilot-run.mjs, which kept the owner ruling and the orchestration.
import fs from 'node:fs';
import path from 'node:path';
import { allocationSettings } from '../../engine/config.mjs';
import { ownerLanguage, translator } from '../lib/i18n.mjs';
import { updateIncident } from '../../engine/db/ledger.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { parseJson, readJsonFile } from '../lib/json.mjs';
import { list } from '../lib/list.mjs';
import { loopFileOfRef, loopLabelOf, livePartsOf, LOOP_SCHEMA } from '../work/draw/draw-loop-coverage.mjs';
import { rationaleFileOf } from '../work/draw/draw-rationale.mjs';
import { stageReceipt } from '../machine/ask-receipts.mjs';
import { recommendationOf } from '../machine/ask-recommendation.mjs';
import { ownerAnswerProof } from '../machine/owner-claim.mjs';
import { isAwaitingOwner } from './failure-steps.mjs';
import { JOB_ROW } from '../machine/job-row.mjs';
import { custodyPresent, questionFields } from './ask-server.mjs';
import { checkDirection, defaultGrammarRoot, readBrandRecord } from '../work/brand/brand.mjs';
import { sha256File } from '../work/work-io.mjs';
import { AUTOPILOT_BY, AUTOPILOT_RULING, SUPERVISOR_GATE, openIncidents, kindOf, supervisorGatesOf, openSupervisorGate } from './autopilot-budget.mjs';

export const HANDOVER_CREDENTIALS_SUBJECT = 'handover-credentials';
export const PROVISIONAL_LABEL = 'self-accepted provisional';
export const AUTOPILOT_EVENTS = Object.freeze({
  configured: 'autopilot-configured',
  provisional: 'autopilot-provisional',
  redraw: 'autopilot-redraw',
  recommended: 'autopilot-recommended',
  deferred: 'autopilot-deferred',
  deferredToHandover: 'autopilot-deferred-to-handover',
  released: 'autopilot-deferral-released',
  supplied: 'autopilot-credentials-supplied',
  rerouted: 'autopilot-gate-rerouted',
  budget: 'autopilot-budget-exceeded',
  budgetExtended: 'autopilot-budget-extended',
  reopened: 'autopilot-provisional-reopened',
  decision: 'autopilot-decision',
});
export const DRAW_REVIEW_SCHEMA = 'starci/draw-review@1';
export const DRAW_REVIEW_KIND = 'draw-review';
export const DIRECTION_REVIEW_KIND = 'brand-direction-review';
const slash = (p) => String(p ?? '').split(path.sep).join('/');

export const latestEvent = (db, workflowId, kind) => db.prepare('SELECT seq,created_at,payload_json FROM events WHERE workflow_id=? AND kind=? ORDER BY seq DESC LIMIT 1').get(workflowId, kind) ?? null;
export const eventsOf = (db, workflowId, kind) => db.prepare('SELECT seq,created_at,entity_id,payload_json FROM events WHERE workflow_id=? AND kind=? ORDER BY seq').all(workflowId, kind)
  .map((row) => ({ seq: row.seq, at: row.created_at, entityId: row.entity_id, ...parseJson(row.payload_json) }));

/** The job an ask report was filed for: its `from`, else the reports row's own job_id (reports are keyed by attempt). */
export const jobOfAsk = (db, workflowId, report) => {
  const from = parseJson(report.report_json, {})?.from;
  const read = (id) => (id ? db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE job_id=? AND workflow_id=?`).get(id, workflowId) ?? null : null);
  return read(from) ?? read(report.job_id) ?? null;
};
/** The op of a reports row: its op_id when the caller joined it, else its attempt's (op_attempts). */
export const reportOpOf = (db, report) => report.op_id
  ?? (report.attempt_id != null ? db.prepare('SELECT op_id FROM op_attempts WHERE attempt_id=?').get(report.attempt_id)?.op_id : null)
  ?? (report.job_id ? db.prepare('SELECT op_id FROM jobs WHERE job_id=?').get(report.job_id)?.op_id : null) ?? null;
export const subjectOf = (job) => { const s = parseJson(job?.payload_json, {})?.params?.subject; return typeof s === 'string' && s.trim() ? s.trim() : null; };
export const askClosed = (db, workflowId, dispatchId) => db.prepare("SELECT kind FROM events WHERE workflow_id=? AND kind IN ('ask-answered','ask-superseded') AND json_extract(payload_json,'$.dispatchId')=? ORDER BY seq DESC LIMIT 1").get(workflowId, dispatchId)?.kind ?? null;
/** The deferral an ask carries now (a released one no longer defers): the event payload, or null. */
export function deferralOf(db, workflowId, dispatchId) {
  const deferred = db.prepare(`SELECT seq,payload_json FROM events WHERE workflow_id=? AND kind=? AND json_extract(payload_json,'$.dispatchId')=? ORDER BY seq DESC LIMIT 1`).get(workflowId, AUTOPILOT_EVENTS.deferredToHandover, dispatchId);
  if (!deferred) return null;
  const released = db.prepare(`SELECT seq FROM events WHERE workflow_id=? AND kind=? AND json_extract(payload_json,'$.dispatchId')=? ORDER BY seq DESC LIMIT 1`).get(workflowId, AUTOPILOT_EVENTS.released, dispatchId);
  if (released && released.seq > deferred.seq) return null;
  return { seq: deferred.seq, ...parseJson(deferred.payload_json) };
}
// A redraw whose only findings say the ask went stale (the record moved on after it was filed) spends no budget.
const STALE_CODES = new Set(['DIRECTION_REV_MOVED', 'REVIEW_PART_REDRAWN', 'GOLDEN_CHANGED']);
const redrawsOf = (db, workflowId, record) => db.prepare(`SELECT count(*) n FROM events WHERE workflow_id=? AND kind=? AND json_extract(payload_json,'$.record')=? AND COALESCE(json_extract(payload_json,'$.stale'),0)=0`).get(workflowId, AUTOPILOT_EVENTS.redraw, record)?.n ?? 0;

/** Asks of the workflow still pending: filed, their job settled awaiting the owner, neither answered nor superseded. */
export function pendingAsksOf(db, workflowId) {
  return db.prepare(`SELECT r.*, a.op_id, a.try_no AS attempt FROM reports r JOIN op_attempts a ON a.attempt_id=r.attempt_id WHERE r.workflow_id=? AND r.outcome='ask'
      AND NOT EXISTS (SELECT 1 FROM events e WHERE e.workflow_id=r.workflow_id AND e.kind IN ('ask-answered','ask-superseded') AND json_extract(e.payload_json,'$.dispatchId')=r.dispatch_id)
      ORDER BY r.report_id`).all(workflowId)
    .filter((report) => { const job = jobOfAsk(db, workflowId, report); return job && isAwaitingOwner(db, job); });
}

/** Open deferred-to-handover items: [{dispatchId?, jobId, opId, deferClass, classes, fields, stubPath, owed, ...}]. */
export function deferredToHandoverOf(db, workflowId) {
  const latest = new Map();
  for (const e of eventsOf(db, workflowId, AUTOPILOT_EVENTS.deferredToHandover)) latest.set(e.dispatchId ?? e.key ?? `seq-${e.seq}`, e);
  const released = new Map(eventsOf(db, workflowId, AUTOPILOT_EVENTS.released).map((e) => [e.dispatchId ?? e.key, e.seq]));
  return [...latest.entries()].filter(([key, e]) => !released.has(key) || released.get(key) <= e.seq)
    .filter(([, e]) => !e.dispatchId || (askClosed(db, workflowId, e.dispatchId) !== 'ask-answered' && askClosed(db, workflowId, e.dispatchId) !== 'ask-superseded'))
    .map(([key, e]) => ({ key, dispatchId: e.dispatchId ?? null, jobId: e.jobId ?? null, opId: e.opId ?? null, deferClass: e.deferClass, classes: e.classes ?? [], record: e.record ?? null,
      fields: e.fields ?? { files: [], vars: [] }, stubPath: e.stubPath ?? null, owed: e.owed ?? null, reason: e.reason ?? null, question: e.question ?? null, since: e.at }));
}

/** Legs autopilot deferred (supervisor budget spent, gate timed out): [{jobId, opId, reason, incidentId?, since}]. A later success clears one. */
export function deferredLegsOf(db, workflowId) {
  const out = new Map();
  for (const e of eventsOf(db, workflowId, AUTOPILOT_EVENTS.deferred)) {
    for (const jobId of list(e.jobIds ?? [e.jobId]).filter(Boolean)) out.set(jobId, { jobId, opId: e.opId ?? null, reason: e.reason ?? null, incidentId: e.incidentId ?? null, since: e.at });
  }
  return [...out.values()].filter((item) => {
    // A leg a timed-out supervisor-gate deferred comes back once the Supervisor resolves that gate (a lifted hold).
    if (item.incidentId && db.prepare('SELECT status FROM incidents WHERE incident_id=?').get(item.incidentId)?.status !== 'open') return false;
    const row = db.prepare('SELECT op_id,created_at,status,payload_json FROM jobs WHERE job_id=?').get(item.jobId);
    if (!row) return false;
    // A later job of the same op (created after it; try numbers are per unit) that succeeded.
    const later = db.prepare("SELECT 1 FROM jobs WHERE workflow_id=? AND op_id IS ? AND created_at>? AND job_id<>? AND status='succeeded' LIMIT 1").get(workflowId, row.op_id, row.created_at, item.jobId);
    return !later && row.status !== 'succeeded';
  });
}

/** Provisional acceptances not yet re-opened: [{dispatchId, opId, jobId, record, class, receiptPath, images[], at}]. */
export function provisionalOf(db, workflowId) {
  const reopened = new Set(eventsOf(db, workflowId, AUTOPILOT_EVENTS.reopened).map((e) => e.dispatchId));
  const recommended = eventsOf(db, workflowId, AUTOPILOT_EVENTS.recommended).map((e) => ({ ...e, class: 'recommended', record: null }));
  return [...eventsOf(db, workflowId, AUTOPILOT_EVENTS.provisional), ...recommended].filter((e) => !reopened.has(e.dispatchId))
    .map((e) => {
      const q = parseJson(db.prepare('SELECT report_json FROM reports WHERE workflow_id=? AND dispatch_id=?').get(workflowId, e.dispatchId)?.report_json, {})?.question ?? {};
      const images = list(q.review?.parts).map((p) => ({ path: p.path, sha256: p.sha256 ?? null, recordPath: q.review?.recordPath ?? null }))
        .concat(list(q.review?.golden).map((g) => ({ path: g.png, sha256: g.sha256 ?? null, recordPath: q.review?.recordPath ?? null })));
      return { dispatchId: e.dispatchId, opId: e.opId ?? null, jobId: e.jobId ?? null, class: e.class, record: e.record ?? null, receiptPath: e.receiptPath ?? null,
        option: e.option ?? null, images, label: translator(ownerLanguage())(PROVISIONAL_LABEL), at: e.at };
    });
}

/** The live-proof legs held for the handover credential checklist: true when a credential-class item is still deferred. */
export const credentialsOwed = (db, workflowId) => deferredToHandoverOf(db, workflowId).filter((item) => ['credential', 'real-money', 'shared-system'].includes(item.deferClass));

/** The owner's answer to the end-of-flow credential checklist ask, if any: {dispatchId, receipt}. Only an owner answer counts. */
function checklistAnswerOf(db, workflowId) {
  const rows = db.prepare("SELECT r.dispatch_id,r.report_json FROM reports r WHERE r.workflow_id=? AND r.outcome='ask' ORDER BY r.report_id DESC").all(workflowId);
  for (const row of rows) {
    const rj = parseJson(row.report_json, {}) ?? {};
    const job = rj.from ? db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(rj.from) : null;
    const subject = parseJson(job?.payload_json, {})?.params?.subject;
    if (subject !== HANDOVER_CREDENTIALS_SUBJECT && rj.question?.checklist !== HANDOVER_CREDENTIALS_SUBJECT) continue;
    const proof = ownerAnswerProof(db, row.dispatch_id);
    if (!proof.ok) continue;
    return { dispatchId: row.dispatch_id, receipt: readJsonFile(proof.receiptPath) ?? {} };
  }
  return null;
}

const raisedOf = (db, workflowId, incidentId) => {
  const row = db.prepare("SELECT created_at,payload_json FROM events WHERE workflow_id=? AND entity_type='incident' AND entity_id=? AND kind IN ('incident-raised',?) ORDER BY seq DESC LIMIT 1").get(workflowId, incidentId, AUTOPILOT_EVENTS.rerouted);
  return row ? { at: row.created_at, ...parseJson(row.payload_json) } : null;
};

/* ------------------------------------------------------------------ machine gates */

/** The newest live loop round ranked the draw-loop way (draw-loop.mjs bestRound). */
const bestOf = (rounds) => [...list(rounds)].sort((x, y) => (Number(y.allPass) - Number(x.allPass)) || (x.failures - y.failures)
  || ((Number.isFinite(y.beauty) ? y.beauty : -1) - (Number.isFinite(x.beauty) ? x.beauty : -1)) || (y.n - x.n))[0] ?? null;

// One live part's loop, metrics, critic score and rationale; the part row is pushed first so a part
// that fails every gate still appears in `parts`, then its findings are appended in the same order.
const gatePart = ({ dir, min, p, parts, findings }) => {
  const rel = slash(path.relative(dir, p.png));
  let sha = null;
  try { sha = sha256File(p.png); } catch { sha = null; }
  const ref = loopLabelOf(p.asset.generation?.loop);
  const loopFile = loopFileOfRef(p.asset.generation?.loop);
  const loop = loopFile ? readJsonFile(loopFile) : null;
  const best = loop?.schema === LOOP_SCHEMA ? bestOf(loop.rounds) : null;
  const rationale = rationaleFileOf(p.html ?? p.png.replace(/\.png$/i, '.html')) ?? (fs.existsSync(p.png.replace(/\.png$/i, '.rationale.json')) ? p.png.replace(/\.png$/i, '.rationale.json') : null);
  parts.push({ path: rel, sha256: sha, loop: ref ?? null, outcome: loop?.outcome ?? null, allPass: best?.allPass ?? null, beauty: best?.beauty ?? null, rationale: rationale ? slash(path.relative(dir, rationale)) : null });
  if (!ref || loop?.schema !== LOOP_SCHEMA) { findings.push({ code: 'DRAW_LOOP_MISSING', detail: `${rel} was not drawn through the draw loop (draw-loop.mjs round/finish)` }); return; }
  if (!list(loop.installed).some((i) => i.sha256 === sha)) findings.push({ code: 'DRAW_LOOP_MISSING', detail: `${rel} is not the part its loop installed` });
  const remaining = list(loop.remaining).length ? ` (${list(loop.remaining).slice(0, 6).map((r) => r.code).join(', ')})` : '';
  if (loop.outcome !== 'passed') findings.push({ code: 'DRAW_METRICS_FAILED', detail: `${rel}: loop ${loop.outcome ?? 'unfinished'}${remaining}` });
  if (!best?.allPass) findings.push({ code: 'DRAW_METRICS_FAILED', detail: `${rel}: the best round does not pass every machine metric (DNA included)` });
  if (!(Number.isFinite(best?.beauty) && best.beauty >= min)) findings.push({ code: 'DRAW_BEAUTY_BELOW', detail: `${rel}: the independent critic scored beauty ${best?.beauty ?? 'nothing'}, the bar is ${min}` });
  if (!rationale) findings.push({ code: 'DRAW_RATIONALE_MISSING', detail: `${rel}: no rationale.json beside the render source` });
};

/**
 * The machine gates of one drawn ui record (owner rulings 2026-09-27: draw loop metrics, the independent critic's
 * beauty at least beautyMin, rationale evidence, DNA - the loop's metrics include the DNA gate): {ok, record,
 * parts[], findings[], beautyMin}. `reviewed` are the parts the ask showed ({path, sha256}); a part redrawn since fails.
 */
export function drawGateEvidence({ repo, recordPath, reviewed = [], beautyMin = null }) {
  const findings = [];
  const file = path.resolve(repo, String(recordPath ?? ''));
  const dir = path.basename(file) === 'index.yaml' ? path.dirname(file) : file;
  let record = null;
  try { record = parseYaml(fs.readFileSync(path.join(dir, 'index.yaml'), 'utf8')); } catch (error) { return { ok: false, record: null, parts: [], findings: [{ code: 'RECORD_UNREADABLE', detail: `${slash(path.relative(repo, dir))}/index.yaml: ${error.message}` }], beautyMin }; }
  let min = beautyMin;
  if (min == null) { try { min = Number(allocationSettings().drawLoop?.beautyMin); } catch { min = 8; } }
  const parts = [];
  const live = livePartsOf(dir, record);
  if (!live.length) findings.push({ code: 'DRAW_LOOP_MISSING', detail: `${record.id ?? dir} has no live part drawn through draw-render` });
  for (const p of live) gatePart({ dir, min, p, parts, findings });
  for (const r of list(reviewed)) {
    const at = path.resolve(dir, String(r?.path ?? ''));
    let now = null;
    try { now = sha256File(at); } catch { now = null; }
    if (!now) findings.push({ code: 'REVIEW_PART_MISSING', detail: `${r?.path} (shown in the ask) is not on disk` });
    else if (r?.sha256 && now !== r.sha256) findings.push({ code: 'REVIEW_PART_REDRAWN', detail: `${r.path} was redrawn after the ask was filed` });
  }
  return { ok: findings.length === 0, record: record.id ?? null, recordPath: slash(path.relative(repo, path.join(dir, 'index.yaml'))), parts, findings, beautyMin: min };
}

// The golden renders the ask showed still on disk, byte-identical: {golden, findings[]}.
const goldenGate = (brandDir, review) => {
  const golden = [], findings = [];
  for (const g of list(review?.golden)) {
    const at = path.resolve(brandDir, String(g?.png ?? ''));
    let now = null;
    try { now = sha256File(at); } catch { now = null; }
    golden.push({ png: g?.png ?? null, sha256: now });
    if (!now) findings.push({ code: 'GOLDEN_MISSING', detail: `${g?.png} (shown in the ask) is not on disk` });
    else if (g?.sha256 && now !== g.sha256) findings.push({ code: 'GOLDEN_CHANGED', detail: `${g.png} changed after the ask was filed` });
  }
  if (!golden.length) findings.push({ code: 'GOLDEN_MISSING', detail: `the ask shows no golden render of ${review?.archetype}` });
  return { golden, findings };
};

/**
 * The machine gates of one brand.direction archetype under review: the direction checks (shape, DNA mapping of every
 * recipe, rubric, golden bytes) with only the owner-acceptance problems set aside, the archetype declared with every
 * field, and the golden the ask showed still on disk. {ok, archetype, rev, findings[], golden[]}.
 */
function directionGateEvidence({ repo, review }) {
  const findings = [];
  let brand;
  try { brand = readBrandRecord(repo); } catch (error) { return { ok: false, archetype: review?.archetype ?? null, findings: [{ code: 'BRAND_UNREADABLE', detail: error.message }] }; }
  const direction = brand.brand?.direction;
  if (!direction) return { ok: false, archetype: review?.archetype ?? null, findings: [{ code: 'DIRECTION_MISSING', detail: 'the brand record carries no brand.direction' }] };
  const archetype = review?.archetype ?? null;
  if (review?.directionRev !== direction.rev) findings.push({ code: 'DIRECTION_REV_MOVED', detail: `the ask reviewed rev ${review?.directionRev}, the record is rev ${direction.rev}` });
  if (!archetype || !direction.archetypes?.[archetype]) findings.push({ code: 'ARCHETYPE_MISSING', detail: `brand.direction declares no ${archetype ?? '(none)'} archetype` });
  let result = null;
  try { result = checkDirection({ brand: brand.brand, family: brand.family, grammarRoot: defaultGrammarRoot(), brandDir: brand.dir }); } catch (error) { findings.push({ code: 'DIRECTION_CHECK_ERROR', detail: error.message }); }
  const acceptanceOnly = /is accepted|accepted while|acceptance|owner has not seen|not the owner|no receipt answers|was answered by/;
  for (const problem of list(result?.evidence?.problems)) if (!acceptanceOnly.test(problem)) findings.push({ code: 'DIRECTION_CHECK', detail: problem });
  const { golden, findings: goldenFindings } = goldenGate(brand.dir, review);
  findings.push(...goldenFindings);
  return { ok: findings.length === 0, archetype, rev: direction.rev ?? null, findings, golden, checked: result?.status ?? null };
}

/* ------------------------------------------------------------------ answering one ask */

/** The default path the work proceeds on while an owner-only item waits for the end of the flow. */
const STUB_PATHS = Object.freeze({
  credential: 'build and unit/integration-test against the declared env var or custody key with a placeholder-<VAR> stand-in and the provider sandbox test stubs (credentialPending); the live-proof legs wait for the handover credential checklist',
  'real-money': 'provider sandbox / test mode only: prove the flow up to the provider hand-off and the unpaid branch; no real transfer is made; the paid-state proof is owed at handover',
  'shared-system': 'leave the shared external system untouched: a dev-only webhook/endpoint on the product\'s own dev channel (or a local stub receiver) proves the integration; the shared switch is owed at handover',
  'owner-decision': 'the asking leg waits for the owner at the end; every leg that does not depend on the decision proceeds',
});
const OWED_PROOFS = Object.freeze({
  credential: 'the live proof with the owner\'s real credentials (integration/e2e/uat legs re-run after the handover credential checklist)',
  'real-money': 'the paid-state proof with a real payment, after the owner approves the spend',
  'shared-system': 'the change on the shared external system, after the owner approves it',
  'owner-decision': 'the owner\'s decision, then the asking leg re-runs with it',
});

/** The owner-facing label of one ask option (a string option is its own label). */
export const optionLabel = (o) => (o == null ? null : (typeof o === 'string' ? o : o.label ?? null));

/**
 * Write one autopilot answer receipt (blob + decisions row, ask-receipts.mjs) and its ask-answered event; returns the receipt file. Never answeredBy owner.
 * Prepare the receipt blob before the acceptance transaction; its bytes are never written inside BEGIN IMMEDIATE.
 */
export function writeAnswer(ledger, { workflowId, report, question, optionIndex, note, extra = {}, now = Date.now() }) {
  const at = now;
  const option = optionIndex == null ? null : optionLabel(list(question?.options)[optionIndex]);
  const receipt = {
    schema: 'starci/ask-answer@1', workflowId, dispatchId: report.dispatch_id, opId: reportOpOf(ledger.db, report),
    option, optionIndex: optionIndex ?? null, picks: null, answeredBy: AUTOPILOT_BY, ruling: AUTOPILOT_RULING,
    custodyWritten: [], envWritten: [], pointersWritten: [], bridge: null, errors: [], note, at: new Date(at).toISOString(),
    ...extra, ...(question?.review ? { review: question.review } : {}),
  };
  const blob = stageReceipt(receipt);
  return { receipt, blob, at, receiptPath: blob.fileUri };

}

// Provisional-accept or redraw/revise plan of one draw-review / direction-review ask (machine gates decide).
export const planReview = ({ db, repo, workflowId, report, question, cls, base, settings, planAnswer, planEvent, now }) => {
  const isDraw = cls.class === 'draw-review';
  const review = question.review ?? {};
  const gates = isDraw
    ? drawGateEvidence({ repo, recordPath: review.recordPath ?? review.record, reviewed: review.parts })
    : directionGateEvidence({ repo, review });
  const record = isDraw ? (review.record ?? gates.record) : `brand.direction.${review.archetype ?? '?'}`;
  if (gates.ok) {
    const note = `autopilot provisional acceptance (owner ruling ${AUTOPILOT_RULING}): every machine gate passed; the owner reviews it once at handover. Never golden.`;
    const acceptance = { provisional: true, by: AUTOPILOT_BY, receipt: gates };
    const receiptPath = planAnswer({ repo, workflowId, report, question, optionIndex: 0, note, extra: { provisional: true, acceptance }, now });
    planEvent({ workflowId, entityType: 'report', entityId: report.dispatch_id, kind: AUTOPILOT_EVENTS.provisional,
      payload: { ...base, by: AUTOPILOT_BY, record, receiptPath, gates: { ok: true, parts: gates.parts ?? gates.golden, beautyMin: gates.beautyMin ?? null, rev: gates.rev ?? null } } });
    return { handled: true, action: 'provisional', ...base, record, receiptPath, gates };
  }
  const done = redrawsOf(db, workflowId, record);
  const stale = gates.findings.length > 0 && gates.findings.every((f) => STALE_CODES.has(f.code));
  if (!stale && done >= settings.redrawBudget) {
    planEvent({ workflowId, entityType: 'report', entityId: report.dispatch_id, kind: AUTOPILOT_EVENTS.deferredToHandover,
      payload: { ...base, by: AUTOPILOT_BY, record, deferClass: 'review', classes: ['review'], reason: `the machine gates still fail after ${done} autopilot redraw(s) (redrawBudget ${settings.redrawBudget}); the owner sees it in the final review`, findings: gates.findings.slice(0, 20), stubPath: 'the drawing waits for the final review; independent legs proceed', owed: 'the owner review of this drawing' } });
    return { handled: true, action: 'deferred-to-handover', ...base, record, findings: gates.findings };
  }
  const brief = gates.findings.map((f) => `- ${f.code}: ${f.detail}`).join('\n');
  const what = isDraw ? 'redraw' : 'revise';
  const scope = isDraw ? 'parts' : 'direction rev';
  const note = stale
    ? `autopilot ${what} (owner ruling ${AUTOPILOT_RULING}): this ask went stale - the record moved on after it was filed. File the review of the CURRENT ${scope} again; autopilot judges it then:\n${brief}`
    : `autopilot ${what} (owner ruling ${AUTOPILOT_RULING}): the machine gates fail, fix every finding through the draw loop (draw-loop.mjs round/finish: metrics with the DNA gate, the independent critic's beauty, rationale.json) before asking again:\n${brief}`;
  const receiptPath = planAnswer({ repo, workflowId, report, question, optionIndex: 1, note, extra: { gateFindings: gates.findings.slice(0, 50) }, now });
  planEvent({ workflowId, entityType: 'report', entityId: report.dispatch_id, kind: AUTOPILOT_EVENTS.redraw,
    payload: { ...base, by: AUTOPILOT_BY, record, receiptPath, round: stale ? done : done + 1, budget: settings.redrawBudget, ...(stale ? { stale: true } : {}), findings: gates.findings.slice(0, 20) } });
  return { handled: true, action: 'redraw', ...base, record, receiptPath, findings: gates.findings };
};

/** The recommended-option provisional answer plan. */
export const planRecommended = ({ repo, workflowId, report, question, base, planAnswer, planEvent, now }) => {
  const rec = recommendationOf(question);
  const because = rec.reason ? ` because ${rec.reason}` : '';
  const note = `autopilot took the recommended option ${rec.index + 1} provisionally (owner ruling ${AUTOPILOT_RULING})${because}; the owner reviews it at handover`;
  const receiptPath = planAnswer({ repo, workflowId, report, question, optionIndex: rec.index, note, extra: { provisional: true, acceptance: { provisional: true, by: AUTOPILOT_BY, receipt: { recommendation: rec } } }, now });
  planEvent({ workflowId, entityType: 'report', entityId: report.dispatch_id, kind: AUTOPILOT_EVENTS.recommended,
    payload: { ...base, by: AUTOPILOT_BY, optionIndex: rec.index, option: rec.label, reason: rec.reason, receiptPath } });
  return { handled: true, action: 'recommended', ...base, receiptPath };
};

/** The deferred-to-handover plan of an owner-only ask class (credential, real-money, shared-system, owner-decision). */
export const planDeferred = ({ workflowId, report, question, cls, base, job, planEvent }) => {
  const fields = questionFields(question);
  const payload = { ...base, by: AUTOPILOT_BY, deferClass: cls.class, classes: cls.classes, subject: subjectOf(job),
    fields: { files: fields.files, vars: fields.vars }, stubPath: STUB_PATHS[cls.class], owed: OWED_PROOFS[cls.class],
    question: String(question.text ?? '').slice(0, 600) };
  planEvent({ workflowId, entityType: 'report', entityId: report.dispatch_id, kind: AUTOPILOT_EVENTS.deferredToHandover, payload });
  return { handled: true, action: 'deferred-to-handover', ...payload };
};

/* ------------------------------------------------------------------ sweep stages */

// Re-route every open owner-gate to the Supervisor: under autopilot nothing but the handover waits on
// the owner, so a runtime/process gate is the Supervisor's. The raise payload the holds are read from
// stays; a mirror incident-raised records the new kind.
export const rerouteOwnerGates = ({ ledger, db, workflowId, out, now }) => {
  for (const row of openIncidents(db, workflowId)) {
    if (!['owner-gate', 'owner-gate-pending'].includes(kindOf(row.last_progress))) continue;
    const detail = String(row.last_progress ?? '').replace(/^\[[^\]]+\]\s*/, '');
    updateIncident(db, { incidentId: row.incident_id, lastProgress: `[${SUPERVISOR_GATE}] ${detail}`, owner: 'supervisor', at: now });
    const raised = raisedOf(db, workflowId, row.incident_id) ?? {};
    ledger.appendEvent({ workflowId, entityType: 'incident', entityId: row.incident_id, kind: AUTOPILOT_EVENTS.rerouted,
      payload: { from: kindOf(row.last_progress), to: SUPERVISOR_GATE, by: AUTOPILOT_BY, ruling: AUTOPILOT_RULING, holds: raised.holds ?? null, reason: 'under autopilot only the handover waits on the owner: a runtime/process gate is the Supervisor\'s' } });
    ledger.appendEvent({ workflowId, entityType: 'incident', entityId: row.incident_id, kind: 'incident-raised',
      payload: { kind: SUPERVISOR_GATE, detail, opId: row.op_id ?? null, ...(raised.holds ? { holds: raised.holds } : {}), ...(raised.until ? { until: raised.until } : {}), rerouted: true, by: AUTOPILOT_BY } });
    out.rerouted.push(row.incident_id);
  }
};

// A supervisor-gate older than supervisorGateTimeoutMs defers the jobs it holds; the gate stays open
// for the Supervisor and the rest of the graph no longer waits on it.
export const deferTimedOutGates = ({ ledger, db, workflowId, settings, out, now }) => {
  for (const gate of supervisorGatesOf(db, workflowId)) {
    if (now - Number(gate.since) < settings.supervisorGateTimeoutMs) continue;
    const already = new Set(deferredLegsOf(db, workflowId).map((item) => item.jobId));
    const jobIds = db.prepare("SELECT job_id,op_id FROM jobs WHERE workflow_id=? AND kind<>'kernel' AND status IN ('queued','failed')").all(workflowId)
      .filter((job) => gate.holds.includes(job.job_id) || (job.op_id && gate.holds.includes(job.op_id))).map((job) => job.job_id).filter((id) => !already.has(id));
    if (!jobIds.length) continue;
    ledger.appendEvent({ workflowId, entityType: 'incident', entityId: gate.incidentId, kind: AUTOPILOT_EVENTS.deferred,
      payload: { jobIds, opId: gate.opId, incidentId: gate.incidentId, by: AUTOPILOT_BY, reason: `supervisor-gate ${gate.incidentId} unresolved past ${Math.round(settings.supervisorGateTimeoutMs / 60000)} min` } });
    out.timedOut.push({ incidentId: gate.incidentId, jobIds });
  }
};

// A spent (or unverifiable) workflow budget opens one supervisor-gate holding new dispatch.
export const gateExceededBudget = ({ ledger, db, workflowId, budget }) => {
  if (!(budget.exceeded.length || budget.unverified.length)) return;
  if (supervisorGatesOf(db, workflowId).some((g) => g.holds.includes('*'))) return;
  const exceeded = budget.exceeded.map((k) => `${k} ${k === 'tokens' ? budget.measured.tokens : budget.used[k]} > ${budget.caps[k]}`);
  const unverified = budget.unverified.map((k) => `${k} unknown: ${budget.coverage.unknown} completed attempts lack usage`);
  const detail = `autopilot budget requires review (${[...exceeded, ...unverified].join(', ')}): Supervisor review - record missing usage or extend with starci kernel autopilot --extend-budget, then resolve --by supervisor`;
  const incidentId = openSupervisorGate(ledger, { workflowId, holds: ['*'], detail, evidence: budget });
  ledger.appendEvent({ workflowId, entityType: 'incident', entityId: incidentId, kind: AUTOPILOT_EVENTS.budget, payload: { ...budget, incidentId, by: AUTOPILOT_BY } });
};

// The checklist receipt lists writes as `field (how)`; the field name is what a deferred ask's fields match.
const writtenName = (w) => {
  const s = String(w);
  if (!s.endsWith(')')) return s;
  let lastLine = -1;
  for (let i = s.length - 1; i >= 0; i -= 1) { if ('\n\r\u2028\u2029'.includes(s[i])) { lastLine = i; break; } }
  const open = s.indexOf('(', lastLine + 1);
  if (open < 0) return s;
  let head = open;
  while (head > 0 && /\s/.test(s[head - 1])) head -= 1;
  return s.slice(0, head);
};

// The owner's checklist answer supplies credentials; each deferred credential ask it covers is superseded.
export const supersedeSupplied = ({ ledger, db, workflowId, repo, out }) => {
  const checklist = checklistAnswerOf(db, workflowId);
  if (!checklist) return;
  const written = new Set([...list(checklist.receipt.custodyWritten), ...list(checklist.receipt.envWritten)].map(writtenName));
  for (const item of deferredToHandoverOf(db, workflowId).filter((i) => i.deferClass === 'credential' && i.dispatchId)) {
    const need = [...list(item.fields?.files), ...list(item.fields?.vars)];
    const have = need.every((name) => written.has(name) || custodyPresent(repo, name));
    if (!need.length || !have) continue;
    ledger.appendEvent({ workflowId, entityType: 'report', entityId: item.dispatchId, kind: 'ask-superseded',
      payload: { dispatchId: item.dispatchId, by: checklist.dispatchId, opId: item.opId, reason: 'the owner supplied these credentials in the handover credential checklist' } });
    ledger.appendEvent({ workflowId, entityType: 'report', entityId: item.dispatchId, kind: AUTOPILOT_EVENTS.supplied,
      payload: { dispatchId: item.dispatchId, checklist: checklist.dispatchId, fields: need } });
    out.supplied.push(item.dispatchId);
  }
};
