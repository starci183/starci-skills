// autopilot.mjs — run every workflow to the finish without stopping for the owner (owner ruling 2026-09-28,
// modules/kernel/owner-rulings.yaml autopilot-run-to-finish; modules/models/runtimes.yaml allocation.autopilot).
//
// "Run to the finish in one go. Don't stop to ask the owner — not even UX/UI review. When everything is done, the
// owner reviews once; ugly UX/UI gets re-run and fixed in one batch instead of piecemeal." Under autopilot:
//
//   provisional         a draw-review (interface.draw) or brand-direction-review (brand.decide) ask whose machine
//                       gates pass is answered by the runtime: a starci/ask-answer@1 receipt with answeredBy `autopilot`, provisional:true and acceptance {provisional, by, receipt: <gate evidence>}.
//                       The retried op applies it (draw-review.mjs / brand-direction.mjs apply) as a PROVISIONAL
//                       acceptance: the node turns green-provisional (PROVISIONAL_LABEL), downstream proceeds, it is
//                       never promoted golden and never counts as an owner answer (owner-claim.mjs ownerAnswerProof
//                       and brand.mjs findOwnerReceipt read answeredBy owner only). Failing gates answer redraw or
//                       revise with the findings as the brief, at most redrawBudget times per record; past it the
//                       leg is deferred to the final review.
//   deferred-to-handover
//                       a credential, real-money, shared-external-system or owner-only ask is neither sent nor
//                       waited on: an `autopilot-deferred-to-handover` event names the sandbox/stub path the work
//                       proceeds on and the real proof owed at handover. Credential values are never invented or
//                       entered by an agent. The live-proof legs (integration/e2e/uat) that need the value wait
//                       (queuedBecause deferred-to-handover) until the ONE end-of-flow credential checklist
//                       (provision.ask, params.subject handover-credentials) is answered by the owner, then resume.
//   supervisor-gate     a retry cap, a needUser environment blocker or an owner-gate that is a runtime/process issue
//                       is a `supervisor-gate` incident with its evidence (scripts/supervisor/poll.mjs picks it up);
//                       the Supervisor fixes (lands to .claude) or decides the retry and resolves it --by supervisor.
//                       supervisorExtraBudget gates per node group, then the leg is `deferred`; a gate older than
//                       supervisorGateTimeoutMs defers what it holds. Deferred legs never block independent work.
//   budgets             per workflow (attempts, tokens, wall time): past one, a supervisor-gate holds new dispatch.
//   handover            handover.review stays the one owner gate: its ask carries the owner review ledger bundle
//                       (autopilotBundle) - every provisional acceptance with its images, every deferred leg, every
//                       deferred-to-handover proof, the autopilot decision log. An owner note on a provisional item
//                       re-opens only that item (api autopilot --reopen, the owner's words from the verified
//                       handover receipt) and the existing draw-feedback loop redraws it.
//
// Every runtime decision is an `autopilot-*` event `by: autopilot`; nothing here ever writes answeredBy owner.
import fs from 'node:fs';
import { loopFileOfRef, loopLabelOf } from '../work/draw/draw-loop-coverage.mjs';
import { fileAskReceipt, stageReceipt } from '../machine/ask-receipts.mjs';
import path from 'node:path';
import { allocationSettings } from '../../engine/config.mjs';
import { ownerLanguage, translator } from '../lib/i18n.mjs';
import { openIncident, updateIncident } from '../../engine/db/ledger.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { parseJson, readJsonFile } from '../lib/json.mjs';
import { list } from '../lib/list.mjs';
import { HANDOVER_OP, OWNER, handoverAsks } from './handover.mjs';
import { CREDENTIAL_ASK_KINDS, askKindOf, recommendationOf } from '../machine/ask-recommendation.mjs';
import { foldText, ownerAnswerProof } from '../machine/owner-claim.mjs';
import { isAwaitingOwner } from './failure-steps.mjs';
import { JOB_ROW } from '../machine/job-row.mjs';
import { askClassOf, custodyPresent, isLiveProofOp, questionFields } from './ask-server.mjs';
import { livePartsOf, LOOP_SCHEMA } from '../work/draw/draw-loop-coverage.mjs';
import { rationaleFileOf } from '../work/draw/draw-rationale.mjs';
import { DIRECTION_REVIEW_SCHEMA, checkDirection, defaultGrammarRoot, readBrandRecord } from '../work/brand/brand.mjs';
import { sha256File } from '../work/work-io.mjs';

export const AUTOPILOT_BY = 'autopilot';
export const AUTOPILOT_RULING = 'autopilot-run-to-finish';
export const SUPERVISOR_GATE = 'supervisor-gate';
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
/** The classes of an ask the owner alone can settle; under autopilot they wait for the end of the flow. */
export const DEFERRED_CLASSES = Object.freeze(['credential', 'real-money', 'shared-system', 'owner-decision']);
const DRAW_REVIEW_SCHEMA = 'starci/draw-review@1';
const DRAW_REVIEW_KIND = 'draw-review';
const DIRECTION_REVIEW_KIND = 'brand-direction-review';
const DAY = 86_400_000;

const num = (value, fallback) => (Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : fallback);
const slash = (p) => String(p ?? '').split(path.sep).join('/');

/* ------------------------------------------------------------------ settings */

/** modules/models/runtimes.yaml allocation.autopilot with its defaults. */
export function autopilotSettings(source = null) {
  let raw = {};
  try { raw = (source ?? allocationSettings())?.autopilot ?? {}; } catch { raw = {}; }
  const budgets = raw.budgets ?? {};
  // STARCI_AUTOPILOT=on|off overrides the runtimes.yaml default for this process (a spec exercising the owner flow).
  const env = String(process.env.STARCI_AUTOPILOT ?? '').trim().toLowerCase();
  return {
    enabled: env === 'on' ? true : env === 'off' ? false : raw.enabled !== false,
    workflows: raw.workflows && typeof raw.workflows === 'object' ? raw.workflows : {},
    redrawBudget: num(raw.redrawBudget, 2),
    supervisorExtraBudget: num(raw.supervisorExtraBudget, 2),
    supervisorGateTimeoutMs: num(raw.supervisorGateTimeoutMs, 6 * 3_600_000),
    budgets: { attempts: num(budgets.attempts, 600), tokens: num(budgets.tokens, 400_000_000), wallMs: num(budgets.wallMs, 14 * DAY) },
  };
}

const latestEvent = (db, workflowId, kind) => db.prepare('SELECT seq,created_at,payload_json FROM events WHERE workflow_id=? AND kind=? ORDER BY seq DESC LIMIT 1').get(workflowId, kind) ?? null;
const eventsOf = (db, workflowId, kind) => db.prepare('SELECT seq,created_at,entity_id,payload_json FROM events WHERE workflow_id=? AND kind=? ORDER BY seq').all(workflowId, kind)
  .map((row) => ({ seq: row.seq, at: row.created_at, entityId: row.entity_id, ...(parseJson(row.payload_json, {}) ?? {}) }));

/** Whether autopilot drives this workflow: {on, source}. A ledger override (api autopilot --set) wins, then runtimes.yaml workflows.<id>, then enabled. */
export function autopilotOf(db, workflowId, settings = autopilotSettings()) {
  const override = latestEvent(db, workflowId, AUTOPILOT_EVENTS.configured);
  if (override) {
    const payload = parseJson(override.payload_json, {}) ?? {};
    if (typeof payload.on === 'boolean') return { on: payload.on, source: 'ledger', at: override.created_at };
  }
  const own = settings.workflows?.[workflowId];
  if (own && typeof own.enabled === 'boolean') return { on: own.enabled, source: `runtimes.yaml allocation.autopilot.workflows.${workflowId}` };
  return { on: settings.enabled, source: 'runtimes.yaml allocation.autopilot.enabled' };
}
export const autopilotOn = (db, workflowId, settings) => { try { return autopilotOf(db, workflowId, settings).on; } catch { return false; } };

/* ------------------------------------------------------------------ ask classes */

const MONEY = /\b(?:real (?:money|payment|transfer|charge|transaction)|live (?:payment|transaction|charge)|production payment|giao dich that|chuyen khoan that|khoan chi that|thanh toan that)\b/;
const SHARED = /\b(?:shared (?:webhook|channel|account|system|merchant)|dung chung|cua academy)\b/;
const NOT_BEFORE = /\b(?:chua|khong|no|not|without|never)\s*$/;
const hits = (re, text) => {
  const m = re.exec(text);
  return Boolean(m) && !NOT_BEFORE.test(text.slice(Math.max(0, m.index - 12), m.index));
};
const askTextOf = (question) => foldText(`${question?.text ?? ''} ${list(question?.options).map((o) => (typeof o === 'string' ? o : o?.label ?? '')).join(' ')}`);

/**
 * What autopilot does with one ask: owner-handover (the handover itself, or the end-of-flow credential checklist -
 * the owner's), draw-review / direction-review (provisional when the gates pass), credential / real-money /
 * shared-system / owner-decision (deferred-to-handover), recommended (a business choice carrying its recommendation,
 * taken provisionally). `classes` lists every owner-only class the text touches.
 */
export function autopilotAskClass({ opId = null, question = null, subject = null } = {}) {
  if (opId === HANDOVER_OP) return { class: 'owner-handover', classes: [] };
  if (subject === HANDOVER_CREDENTIALS_SUBJECT || question?.checklist === HANDOVER_CREDENTIALS_SUBJECT) return { class: 'owner-handover', classes: ['credential'] };
  const kind = askKindOf(question);
  if (kind === DRAW_REVIEW_KIND || question?.review?.schema === DRAW_REVIEW_SCHEMA) return { class: 'draw-review', classes: [] };
  if (kind === DIRECTION_REVIEW_KIND || question?.review?.schema === DIRECTION_REVIEW_SCHEMA) return { class: 'direction-review', classes: [] };
  const text = askTextOf(question);
  const classes = [];
  if (CREDENTIAL_ASK_KINDS.includes(kind) || askClassOf({ opId, question }) === 'credential') classes.push('credential');
  if (!CREDENTIAL_ASK_KINDS.includes(kind)) {
    if (hits(MONEY, text)) classes.push('real-money');
    if (hits(SHARED, text)) classes.push('shared-system');
  }
  if (kind === 'irreversible-confirmation' && !classes.some((c) => c !== 'credential')) classes.push('owner-decision');
  if (['authority', 'identity', 'intent'].includes(kind)) classes.push('owner-decision');
  const primary = ['real-money', 'shared-system', 'credential', 'owner-decision'].find((c) => classes.includes(c));
  if (primary) return { class: primary, classes: [...new Set(classes)] };
  if (recommendationOf(question)) return { class: 'recommended', classes: [] };
  return { class: 'owner-decision', classes: ['owner-decision'] };
}

/** The default path the work proceeds on while an owner-only item waits for the end of the flow. */
export const STUB_PATHS = Object.freeze({
  credential: 'build and unit/integration-test against the declared env var or custody key with a placeholder-<VAR> stand-in and the provider sandbox test stubs (credentialPending); the live-proof legs wait for the handover credential checklist',
  'real-money': 'provider sandbox / test mode only: prove the flow up to the provider hand-off and the unpaid branch; no real transfer is made; the paid-state proof is owed at handover',
  'shared-system': 'leave the shared external system untouched: a dev-only webhook/endpoint on the product\'s own dev channel (or a local stub receiver) proves the integration; the shared switch is owed at handover',
  'owner-decision': 'the asking leg waits for the owner at the end; every leg that does not depend on the decision proceeds',
});
export const OWED_PROOFS = Object.freeze({
  credential: 'the live proof with the owner\'s real credentials (integration/e2e/uat legs re-run after the handover credential checklist)',
  'real-money': 'the paid-state proof with a real payment, after the owner approves the spend',
  'shared-system': 'the change on the shared external system, after the owner approves it',
  'owner-decision': 'the owner\'s decision, then the asking leg re-runs with it',
});

/* ------------------------------------------------------------------ machine gates */

/** The newest live loop round ranked the draw-loop way (draw-loop.mjs bestRound). */
const bestOf = (rounds) => [...list(rounds)].sort((x, y) => (Number(y.allPass) - Number(x.allPass)) || (x.failures - y.failures)
  || ((Number.isFinite(y.beauty) ? y.beauty : -1) - (Number.isFinite(x.beauty) ? x.beauty : -1)) || (y.n - x.n))[0] ?? null;

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
  for (const p of live) {
    const rel = slash(path.relative(dir, p.png));
    let sha = null;
    try { sha = sha256File(p.png); } catch { sha = null; }
    const ref = loopLabelOf(p.asset.generation?.loop);
    const loopFile = loopFileOfRef(p.asset.generation?.loop);
    const loop = loopFile ? readJsonFile(loopFile) : null;
    const best = loop?.schema === LOOP_SCHEMA ? bestOf(loop.rounds) : null;
    const rationale = rationaleFileOf(p.html ?? p.png.replace(/\.png$/i, '.html')) ?? (fs.existsSync(p.png.replace(/\.png$/i, '.rationale.json')) ? p.png.replace(/\.png$/i, '.rationale.json') : null);
    const part = { path: rel, sha256: sha, loop: ref ?? null, outcome: loop?.outcome ?? null, allPass: best?.allPass ?? null, beauty: best?.beauty ?? null, rationale: rationale ? slash(path.relative(dir, rationale)) : null };
    parts.push(part);
    if (!ref || loop?.schema !== LOOP_SCHEMA) { findings.push({ code: 'DRAW_LOOP_MISSING', detail: `${rel} was not drawn through the draw loop (draw-loop.mjs round/finish)` }); continue; }
    if (!list(loop.installed).some((i) => i.sha256 === sha)) findings.push({ code: 'DRAW_LOOP_MISSING', detail: `${rel} is not the part its loop installed` });
    if (loop.outcome !== 'passed') findings.push({ code: 'DRAW_METRICS_FAILED', detail: `${rel}: loop ${loop.outcome ?? 'unfinished'}${list(loop.remaining).length ? ` (${list(loop.remaining).slice(0, 6).map((r) => r.code).join(', ')})` : ''}` });
    if (!best?.allPass) findings.push({ code: 'DRAW_METRICS_FAILED', detail: `${rel}: the best round does not pass every machine metric (DNA included)` });
    if (!(Number.isFinite(best?.beauty) && best.beauty >= min)) findings.push({ code: 'DRAW_BEAUTY_BELOW', detail: `${rel}: the independent critic scored beauty ${best?.beauty ?? 'nothing'}, the bar is ${min}` });
    if (!rationale) findings.push({ code: 'DRAW_RATIONALE_MISSING', detail: `${rel}: no rationale.json beside the render source` });
  }
  for (const r of list(reviewed)) {
    const at = path.resolve(dir, String(r?.path ?? ''));
    let now = null;
    try { now = sha256File(at); } catch { now = null; }
    if (!now) findings.push({ code: 'REVIEW_PART_MISSING', detail: `${r?.path} (shown in the ask) is not on disk` });
    else if (r?.sha256 && now !== r.sha256) findings.push({ code: 'REVIEW_PART_REDRAWN', detail: `${r.path} was redrawn after the ask was filed` });
  }
  return { ok: findings.length === 0, record: record.id ?? null, recordPath: slash(path.relative(repo, path.join(dir, 'index.yaml'))), parts, findings, beautyMin: min };
}

/**
 * The machine gates of one brand.direction archetype under review: the direction checks (shape, DNA mapping of every
 * recipe, rubric, golden bytes) with only the owner-acceptance problems set aside, the archetype declared with every
 * field, and the golden the ask showed still on disk. {ok, archetype, rev, findings[], golden[]}.
 */
export function directionGateEvidence({ repo, review }) {
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
  const golden = [];
  for (const g of list(review?.golden)) {
    const at = path.resolve(brand.dir, String(g?.png ?? ''));
    let now = null;
    try { now = sha256File(at); } catch { now = null; }
    golden.push({ png: g?.png ?? null, sha256: now });
    if (!now) findings.push({ code: 'GOLDEN_MISSING', detail: `${g?.png} (shown in the ask) is not on disk` });
    else if (g?.sha256 && now !== g.sha256) findings.push({ code: 'GOLDEN_CHANGED', detail: `${g.png} changed after the ask was filed` });
  }
  if (!golden.length) findings.push({ code: 'GOLDEN_MISSING', detail: `the ask shows no golden render of ${archetype}` });
  return { ok: findings.length === 0, archetype, rev: direction.rev ?? null, findings, golden, checked: result?.status ?? null };
}

/* ------------------------------------------------------------------ answering one ask */

/** The job an ask report was filed for: its `from`, else the reports row's own job_id (reports are keyed by attempt). */
const jobOfAsk = (db, workflowId, report) => {
  const from = (parseJson(report.report_json, {}) ?? {}).from;
  const read = (id) => (id ? db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE job_id=? AND workflow_id=?`).get(id, workflowId) ?? null : null);
  return read(from) ?? read(report.job_id) ?? null;
};
/** The op of a reports row: its op_id when the caller joined it, else its attempt's (op_attempts). */
const reportOpOf = (db, report) => report.op_id
  ?? (report.attempt_id != null ? db.prepare('SELECT op_id FROM op_attempts WHERE attempt_id=?').get(report.attempt_id)?.op_id : null)
  ?? (report.job_id ? db.prepare('SELECT op_id FROM jobs WHERE job_id=?').get(report.job_id)?.op_id : null) ?? null;
const subjectOf = (job) => { const s = parseJson(job?.payload_json, {})?.params?.subject; return typeof s === 'string' && s.trim() ? s.trim() : null; };
const askClosed = (db, workflowId, dispatchId) => db.prepare("SELECT kind FROM events WHERE workflow_id=? AND kind IN ('ask-answered','ask-superseded') AND json_extract(payload_json,'$.dispatchId')=? ORDER BY seq DESC LIMIT 1").get(workflowId, dispatchId)?.kind ?? null;
/** The deferral an ask carries now (a released one no longer defers): the event payload, or null. */
export function deferralOf(db, workflowId, dispatchId) {
  const deferred = db.prepare(`SELECT seq,payload_json FROM events WHERE workflow_id=? AND kind=? AND json_extract(payload_json,'$.dispatchId')=? ORDER BY seq DESC LIMIT 1`).get(workflowId, AUTOPILOT_EVENTS.deferredToHandover, dispatchId);
  if (!deferred) return null;
  const released = db.prepare(`SELECT seq FROM events WHERE workflow_id=? AND kind=? AND json_extract(payload_json,'$.dispatchId')=? ORDER BY seq DESC LIMIT 1`).get(workflowId, AUTOPILOT_EVENTS.released, dispatchId);
  if (released && released.seq > deferred.seq) return null;
  return { seq: deferred.seq, ...(parseJson(deferred.payload_json, {}) ?? {}) };
}
// A redraw whose only findings say the ask went stale (the record moved on after it was filed) spends no budget.
const STALE_CODES = new Set(['DIRECTION_REV_MOVED', 'REVIEW_PART_REDRAWN', 'GOLDEN_CHANGED']);
const redrawsOf = (db, workflowId, record) => db.prepare(`SELECT count(*) n FROM events WHERE workflow_id=? AND kind=? AND json_extract(payload_json,'$.record')=? AND COALESCE(json_extract(payload_json,'$.stale'),0)=0`).get(workflowId, AUTOPILOT_EVENTS.redraw, record)?.n ?? 0;

/**
 * Write one autopilot answer receipt (blob + decisions row, ask-receipts.mjs) and its ask-answered event; returns the receipt file. Never answeredBy owner.
 * Runs INSIDE the caller's ledger transaction (autopilotAnswerAsk), so it indexes the receipt with fileAskReceipt on that
 * transaction's db - writeAskReceipt opens a transaction of its own and threw ledger-nested-transaction here.
 */
function writeAnswer(ledger, { workflowId, report, question, optionIndex, note, extra = {}, now = Date.now() }) {
  const at = now;
  const option = optionIndex == null ? null : (() => { const o = list(question?.options)[optionIndex]; return o == null ? null : (typeof o === 'string' ? o : o.label ?? null); })();
  const receipt = {
    schema: 'starci/ask-answer@1', workflowId, dispatchId: report.dispatch_id, opId: reportOpOf(ledger.db, report),
    option, optionIndex: optionIndex ?? null, picks: null, answeredBy: AUTOPILOT_BY, ruling: AUTOPILOT_RULING,
    custodyWritten: [], envWritten: [], pointersWritten: [], bridge: null, errors: [], note, at: new Date(at).toISOString(),
    ...extra, ...(question?.review ? { review: question.review } : {}),
  };
  const { receiptPath, receiptSha, decisionId } = fileAskReceipt(ledger.db, { workflowId, dispatchId: report.dispatch_id, receipt, blob: stageReceipt(receipt), at });
  ledger.appendEvent({ workflowId, entityType: 'report', entityId: report.dispatch_id, kind: 'ask-answered',
    payload: { dispatchId: report.dispatch_id, receiptPath, receiptSha, decisionId, answeredBy: AUTOPILOT_BY, optionIndex: optionIndex ?? null, option, note, custodyWritten: [], envWritten: [], pointersWritten: [], errors: [], ...(extra.provisional ? { provisional: true } : {}) } });
  return receiptPath;
}

/**
 * Answer (or defer) one filed, unanswered ask under autopilot. Returns {handled:false, why} when autopilot is off or
 * the ask is the owner's (handover, the end-of-flow checklist), else {handled:true, action, dispatchId, ...}.
 * `wake` (injectable) wakes the Kernel after an answer.
 */
export function autopilotAnswerAsk({ ledger, repo, workflowId, report, settings = autopilotSettings(), wake = null, now = Date.now() }) {
  const db = ledger.db;
  if (!autopilotOn(db, workflowId, settings)) return { handled: false, why: 'autopilot-off' };
  if (askClosed(db, workflowId, report.dispatch_id)) return { handled: false, why: 'already-closed' };
  if (deferralOf(db, workflowId, report.dispatch_id)) return { handled: false, why: 'already-deferred' };
  const rj = parseJson(report.report_json, {}) ?? {};
  const question = rj.question ?? { text: rj.summary ?? '', options: [] };
  const job = jobOfAsk(db, workflowId, report);
  const opId = reportOpOf(db, report);
  const cls = autopilotAskClass({ opId, question, subject: subjectOf(job) });
  const base = { dispatchId: report.dispatch_id, opId, jobId: job?.job_id ?? null, class: cls.class };
  if (cls.class === 'owner-handover') return { handled: false, why: 'owner-handover', ...base };
  let out;
  ledger.transaction(() => {
    if (cls.class === 'draw-review' || cls.class === 'direction-review') {
      const review = question.review ?? {};
      const gates = cls.class === 'draw-review'
        ? drawGateEvidence({ repo, recordPath: review.recordPath ?? review.record, reviewed: review.parts })
        : directionGateEvidence({ repo, review });
      const record = cls.class === 'draw-review' ? (review.record ?? gates.record) : `brand.direction.${review.archetype ?? '?'}`;
      if (gates.ok) {
        const note = `autopilot provisional acceptance (owner ruling ${AUTOPILOT_RULING}): every machine gate passed; the owner reviews it once at handover. Never golden.`;
        const acceptance = { provisional: true, by: AUTOPILOT_BY, receipt: gates };
        const receiptPath = writeAnswer(ledger, { repo, workflowId, report, question, optionIndex: 0, note, extra: { provisional: true, acceptance }, now });
        ledger.appendEvent({ workflowId, entityType: 'report', entityId: report.dispatch_id, kind: AUTOPILOT_EVENTS.provisional,
          payload: { ...base, by: AUTOPILOT_BY, record, receiptPath, gates: { ok: true, parts: gates.parts ?? gates.golden, beautyMin: gates.beautyMin ?? null, rev: gates.rev ?? null } } });
        out = { handled: true, action: 'provisional', ...base, record, receiptPath, gates };
        return;
      }
      const done = redrawsOf(db, workflowId, record);
      const stale = gates.findings.length > 0 && gates.findings.every((f) => STALE_CODES.has(f.code));
      if (!stale && done >= settings.redrawBudget) {
        ledger.appendEvent({ workflowId, entityType: 'report', entityId: report.dispatch_id, kind: AUTOPILOT_EVENTS.deferredToHandover,
          payload: { ...base, by: AUTOPILOT_BY, record, deferClass: 'review', classes: ['review'], reason: `the machine gates still fail after ${done} autopilot redraw(s) (redrawBudget ${settings.redrawBudget}); the owner sees it in the final review`, findings: gates.findings.slice(0, 20), stubPath: 'the drawing waits for the final review; independent legs proceed', owed: 'the owner review of this drawing' } });
        out = { handled: true, action: 'deferred-to-handover', ...base, record, findings: gates.findings };
        return;
      }
      const brief = gates.findings.map((f) => `- ${f.code}: ${f.detail}`).join('\n');
      const what = cls.class === 'draw-review' ? 'redraw' : 'revise';
      const note = stale
        ? `autopilot ${what} (owner ruling ${AUTOPILOT_RULING}): this ask went stale - the record moved on after it was filed. File the review of the CURRENT ${cls.class === 'draw-review' ? 'parts' : 'direction rev'} again; autopilot judges it then:\n${brief}`
        : `autopilot ${what} (owner ruling ${AUTOPILOT_RULING}): the machine gates fail, fix every finding through the draw loop (draw-loop.mjs round/finish: metrics with the DNA gate, the independent critic's beauty, rationale.json) before asking again:\n${brief}`;
      const receiptPath = writeAnswer(ledger, { repo, workflowId, report, question, optionIndex: 1, note, extra: { gateFindings: gates.findings.slice(0, 50) }, now });
      ledger.appendEvent({ workflowId, entityType: 'report', entityId: report.dispatch_id, kind: AUTOPILOT_EVENTS.redraw,
        payload: { ...base, by: AUTOPILOT_BY, record, receiptPath, round: stale ? done : done + 1, budget: settings.redrawBudget, ...(stale ? { stale: true } : {}), findings: gates.findings.slice(0, 20) } });
      out = { handled: true, action: 'redraw', ...base, record, receiptPath, findings: gates.findings };
      return;
    }
    if (cls.class === 'recommended') {
      const rec = recommendationOf(question);
      const note = `autopilot took the recommended option ${rec.index + 1} provisionally (owner ruling ${AUTOPILOT_RULING})${rec.reason ? ` because ${rec.reason}` : ''}; the owner reviews it at handover`;
      const receiptPath = writeAnswer(ledger, { repo, workflowId, report, question, optionIndex: rec.index, note, extra: { provisional: true, acceptance: { provisional: true, by: AUTOPILOT_BY, receipt: { recommendation: rec } } }, now });
      ledger.appendEvent({ workflowId, entityType: 'report', entityId: report.dispatch_id, kind: AUTOPILOT_EVENTS.recommended,
        payload: { ...base, by: AUTOPILOT_BY, optionIndex: rec.index, option: rec.label, reason: rec.reason, receiptPath } });
      out = { handled: true, action: 'recommended', ...base, receiptPath };
      return;
    }
    const fields = questionFields(question);
    const payload = { ...base, by: AUTOPILOT_BY, deferClass: cls.class, classes: cls.classes, subject: subjectOf(job),
      fields: { files: fields.files, vars: fields.vars }, stubPath: STUB_PATHS[cls.class], owed: OWED_PROOFS[cls.class],
      question: String(question.text ?? '').slice(0, 600) };
    ledger.appendEvent({ workflowId, entityType: 'report', entityId: report.dispatch_id, kind: AUTOPILOT_EVENTS.deferredToHandover, payload });
    out = { handled: true, action: 'deferred-to-handover', ...payload };
  });
  if (out?.receiptPath && typeof wake === 'function') {
    try { out.wake = wake(ledger, { workflowId, dispatchId: report.dispatch_id, receiptPath: out.receiptPath, answeredBy: AUTOPILOT_BY })?.action ?? null; } catch { out.wake = null; }
  }
  return out;
}

/* ------------------------------------------------------------------ deferral, gates, budgets */

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
  return [...latest.entries()].filter(([key, e]) => !(released.get(key) > e.seq))
    .filter(([, e]) => !e.dispatchId || askClosed(db, workflowId, e.dispatchId) !== 'ask-answered' && askClosed(db, workflowId, e.dispatchId) !== 'ask-superseded')
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

/** Why a queued job is deferred under autopilot, or null: {queuedBecause, blockedBy, detail}. */
export function deferredQueueCause(db, job, { settings = autopilotSettings() } = {}) {
  const workflowId = job.workflow_id ?? db.prepare('SELECT workflow_id FROM jobs WHERE job_id=?').get(job.job_id)?.workflow_id ?? null;
  if (!workflowId || !autopilotOn(db, workflowId, settings)) return null;
  const opId = job.op_id ?? null;
  const leg = deferredLegsOf(db, workflowId).find((item) => item.jobId === job.job_id);
  if (leg) return { queuedBecause: 'deferred', blockedBy: { deferred: leg.jobId }, detail: `autopilot deferred it (${leg.reason ?? 'supervisor budget spent'}); it is listed for the final review and blocks nothing else` };
  if (isLiveProofOp(opId)) {
    const owed = credentialsOwed(db, workflowId);
    if (owed.length) return { queuedBecause: 'deferred-to-handover', blockedBy: { deferredToHandover: owed.map((item) => item.dispatchId ?? item.key) },
      detail: `the live proof waits for the handover credential checklist (${owed.map((item) => `${item.opId ?? '-'} ${item.deferClass}`).join(', ')}); every other leg proceeds on the sandbox/stub path` };
  }
  return null;
}

/** Route-cap step under autopilot (cli.mjs enqueueNextStep): 'supervisor-gate' within the extra budget, else 'deferred'. */
export function routeCapUnderAutopilot(db, job, { lineage, routeId, settings = autopilotSettings() }) {
  if (!autopilotOn(db, job.workflow_id, settings)) return null;
  let gates = 0;
  for (const row of lineage) {
    const step = parseJson(row.result_json, {})?.nextStep;
    if (step?.route === routeId && step.kind === SUPERVISOR_GATE) gates += 1;
  }
  return gates >= settings.supervisorExtraBudget ? { kind: 'deferred', gates, budget: settings.supervisorExtraBudget } : { kind: SUPERVISOR_GATE, gates, budget: settings.supervisorExtraBudget };
}

const openIncidents = (db, workflowId) => db.prepare("SELECT incident_id,op_id,last_progress,updated_at FROM incidents WHERE workflow_id=? AND status='open' ORDER BY updated_at").all(workflowId);
const kindOf = (lastProgress) => /^\[([^\]]+)\]/.exec(String(lastProgress ?? ''))?.[1] ?? null;
const raisedOf = (db, workflowId, incidentId) => {
  const row = db.prepare("SELECT created_at,payload_json FROM events WHERE workflow_id=? AND entity_type='incident' AND entity_id=? AND kind IN ('incident-raised',?) ORDER BY seq DESC LIMIT 1").get(workflowId, incidentId, AUTOPILOT_EVENTS.rerouted);
  return row ? { at: row.created_at, ...(parseJson(row.payload_json, {}) ?? {}) } : null;
};

/** Open supervisor-gate incidents: [{incidentId, opId, holds[], detail, since}]. */
export function supervisorGatesOf(db, workflowId) {
  return openIncidents(db, workflowId).filter((row) => kindOf(row.last_progress) === SUPERVISOR_GATE).map((row) => {
    const raised = db.prepare("SELECT created_at,payload_json FROM events WHERE workflow_id=? AND entity_type='incident' AND entity_id=? AND kind='incident-raised' ORDER BY seq DESC LIMIT 1").get(workflowId, row.incident_id);
    const payload = parseJson(raised?.payload_json, {}) ?? {};
    return { incidentId: row.incident_id, opId: row.op_id ?? null, holds: list(payload.holds).length ? payload.holds : [row.op_id].filter(Boolean),
      detail: String(row.last_progress ?? '').replace(/^\[[^\]]+\]\s*/, ''), since: raised?.created_at ?? row.updated_at };
  });
}

/** Budget use of one workflow against allocation.autopilot.budgets: {used, caps, exceeded[]}. */
export function budgetOf(db, workflowId, settings = autopilotSettings()) {
  const extended = eventsOf(db, workflowId, AUTOPILOT_EVENTS.budgetExtended).reduce((acc, e) => {
    for (const k of ['attempts', 'tokens', 'wallMs']) acc[k] += num(e[k], 0);
    return acc;
  }, { attempts: 0, tokens: 0, wallMs: 0 });
  const caps = { attempts: settings.budgets.attempts + extended.attempts, tokens: settings.budgets.tokens + extended.tokens, wallMs: settings.budgets.wallMs + extended.wallMs };
  const attempts = db.prepare("SELECT count(*) n FROM jobs WHERE workflow_id=? AND kind<>'kernel'").get(workflowId)?.n ?? 0;
  const tokens = db.prepare("SELECT COALESCE(SUM(CAST(json_extract(payload_json,'$.usage.totalTokens') AS INTEGER)),0) t FROM jobs WHERE workflow_id=?").get(workflowId)?.t ?? 0;
  const started = db.prepare('SELECT MIN(created_at) at FROM events WHERE workflow_id=?').get(workflowId)?.at ?? Date.now();
  const used = { attempts, tokens: Number(tokens) || 0, wallMs: Date.now() - Number(started) };
  const exceeded = Object.keys(caps).filter((k) => caps[k] > 0 && used[k] > caps[k]);
  return { used, caps, exceeded };
}

const newIncidentId = () => `inc-${Math.random().toString(16).slice(2, 8)}${Date.now().toString(16).slice(-6)}`;
/** Open one supervisor-gate incident (inside the caller's transaction). */
export function openSupervisorGate(ledger, { workflowId, opId = null, holds = [], detail, evidence = null, route = null, auto = true }) {
  const incidentId = newIncidentId();
  openIncident(ledger.db, { incidentId, workflowId, kind: SUPERVISOR_GATE, opId, lastProgress: `[${SUPERVISOR_GATE}] ${detail}`, detail });
  ledger.appendEvent({ workflowId, entityType: 'incident', entityId: incidentId, kind: 'incident-raised',
    payload: { kind: SUPERVISOR_GATE, detail, opId, holds, auto, by: AUTOPILOT_BY, ruling: AUTOPILOT_RULING, ...(route ? { route } : {}), ...(evidence ? { evidence } : {}) } });
  return incidentId;
}

/**
 * One autopilot pass over a workflow (api status runs it on every read, so every watchdog tick; api autopilot
 * --sweep runs it on demand). Idempotent. Returns {on, answered[], deferred[], rerouted[], timedOut[], budget, supplied[]}.
 *   1. every pending ask is answered or deferred (autopilotAnswerAsk);
 *   2. every open owner-gate - under autopilot nothing but the handover waits on the owner - is re-routed to the
 *      Supervisor as a supervisor-gate (its text and holds kept);
 *   3. a supervisor-gate older than supervisorGateTimeoutMs defers the jobs it holds (the gate stays open for the
 *      Supervisor; the rest of the graph no longer waits on it);
 *   4. a spent budget opens one supervisor-gate holding new dispatch;
 *   5. an owner-answered handover credential checklist supersedes the deferred credential asks it supplied.
 */
export function autopilotSweep({ ledger, repo, workflowId, settings = autopilotSettings(), wake = null, now = Date.now() }) {
  const db = ledger.db;
  const state = autopilotOf(db, workflowId, settings);
  const out = { on: state.on, answered: [], deferred: [], rerouted: [], timedOut: [], supplied: [], budget: null, errors: [] };
  if (!state.on) return out;
  const wf = db.prepare('SELECT phase,archived_at FROM workflows WHERE workflow_id=?').get(workflowId);
  if (!wf || wf.phase === 'finished' || wf.archived_at != null) return out;
  for (const report of pendingAsksOf(db, workflowId)) {
    try {
      const r = autopilotAnswerAsk({ ledger, repo, workflowId, report, settings, wake, now });
      if (r.handled) (r.action === 'deferred-to-handover' ? out.deferred : out.answered).push({ dispatchId: r.dispatchId, action: r.action, class: r.class });
    } catch (error) { out.errors.push({ dispatchId: report.dispatch_id, error: String(error?.message ?? error).slice(0, 300) }); }
  }
  ledger.transaction(() => {
    for (const row of openIncidents(db, workflowId)) {
      if (!['owner-gate', 'owner-gate-pending'].includes(kindOf(row.last_progress))) continue;
      const detail = String(row.last_progress ?? '').replace(/^\[[^\]]+\]\s*/, '');
      updateIncident(db, { incidentId: row.incident_id, lastProgress: `[${SUPERVISOR_GATE}] ${detail}`, owner: 'supervisor', at: now });
      const raised = raisedOf(db, workflowId, row.incident_id) ?? {};
      ledger.appendEvent({ workflowId, entityType: 'incident', entityId: row.incident_id, kind: AUTOPILOT_EVENTS.rerouted,
        payload: { from: kindOf(row.last_progress), to: SUPERVISOR_GATE, by: AUTOPILOT_BY, ruling: AUTOPILOT_RULING, holds: raised.holds ?? null, reason: 'under autopilot only the handover waits on the owner: a runtime/process gate is the Supervisor\'s' } });
      // The raise payload the holds are read from stays; a mirror incident-raised records the new kind.
      ledger.appendEvent({ workflowId, entityType: 'incident', entityId: row.incident_id, kind: 'incident-raised',
        payload: { kind: SUPERVISOR_GATE, detail, opId: row.op_id ?? null, ...(raised.holds ? { holds: raised.holds } : {}), ...(raised.until ? { until: raised.until } : {}), rerouted: true, by: AUTOPILOT_BY } });
      out.rerouted.push(row.incident_id);
    }
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
    const budget = budgetOf(db, workflowId, settings);
    out.budget = budget;
    if (budget.exceeded.length && !supervisorGatesOf(db, workflowId).some((g) => g.holds.includes('*'))) {
      const detail = `autopilot budget spent (${budget.exceeded.map((k) => `${k} ${budget.used[k]} > ${budget.caps[k]}`).join(', ')}): Supervisor review - extend with api autopilot --extend-budget, then resolve --by supervisor`;
      const incidentId = openSupervisorGate(ledger, { workflowId, holds: ['*'], detail, evidence: budget });
      ledger.appendEvent({ workflowId, entityType: 'incident', entityId: incidentId, kind: AUTOPILOT_EVENTS.budget, payload: { ...budget, incidentId, by: AUTOPILOT_BY } });
    }
    // 5. The owner's checklist answer supplies credentials; each deferred credential ask it covers is superseded.
    const checklist = checklistAnswerOf(db, workflowId);
    if (checklist) {
      const written = new Set([...list(checklist.receipt.custodyWritten), ...list(checklist.receipt.envWritten)].map((w) => String(w).replace(/\s*\(.*\)$/, '')));
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
    }
  });
  return out;
}

/** The owner's answer to the end-of-flow credential checklist ask, if any: {dispatchId, receipt}. Only an owner answer counts. */
export function checklistAnswerOf(db, workflowId) {
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

/** The ONE end-of-flow owner step: the credential checklist question provision.ask files verbatim (subject handover-credentials). */
export function credentialChecklist(db, workflowId, { lang = 'vi' } = {}) {
  const items = deferredToHandoverOf(db, workflowId).filter((item) => DEFERRED_CLASSES.includes(item.deferClass));
  const creds = items.filter((item) => item.deferClass === 'credential');
  const approvals = items.filter((item) => item.deferClass !== 'credential');
  const files = [...new Set(creds.flatMap((item) => list(item.fields?.files)))];
  const vars = [...new Set(creds.flatMap((item) => list(item.fields?.vars)))];
  const tr = translator(lang);
  const lines = [
    tr('Supply credentials - the one owner step before the deferred live proofs (UAT/e2e) resume automatically:'),
    ...creds.map((item, i) => `${i + 1}. ${item.opId ?? 'provision.ask'} (${item.dispatchId ?? '-'}): ${[...list(item.fields?.files), ...list(item.fields?.vars)].join(', ')} — ${String(item.question ?? '').split('\n')[0].slice(0, 200)}`),
    ...(approvals.length ? [tr('Also waiting on the owner (re-opened at the same time, one question each):'),
      ...approvals.map((item) => `- ${item.deferClass}: ${item.opId ?? '-'} (${item.dispatchId ?? '-'}) — ${String(item.question ?? item.reason ?? '').split('\n')[0].slice(0, 200)}`)] : []),
    tr('Values go into this form only and are sealed into custody; they never appear in chat, logs or documents.'),
    ...files.map((f) => `- ${f}`), ...vars.map((v) => `- ${v}`),
  ];
  return { items: items.length, credentials: creds.length, approvals: approvals.map((item) => item.dispatchId).filter(Boolean),
    question: { kind: 'credential', checklist: HANDOVER_CREDENTIALS_SUBJECT, text: lines.join('\n'), options: [], refs: creds.map((item) => item.dispatchId).filter(Boolean) },
    fields: { files, vars } };
}

/** The final review bundle (the owner review ledger) the handover ask carries. */
export function autopilotBundle(db, workflowId) {
  const decisions = [AUTOPILOT_EVENTS.provisional, AUTOPILOT_EVENTS.recommended, AUTOPILOT_EVENTS.redraw, AUTOPILOT_EVENTS.deferred, AUTOPILOT_EVENTS.deferredToHandover, AUTOPILOT_EVENTS.rerouted, AUTOPILOT_EVENTS.supplied, AUTOPILOT_EVENTS.budget, AUTOPILOT_EVENTS.decision]
    .flatMap((kind) => eventsOf(db, workflowId, kind).map((e) => ({ kind, seq: e.seq, at: new Date(Number(e.at)).toISOString(), by: e.by ?? AUTOPILOT_BY,
      subject: e.record ?? e.dispatchId ?? e.incidentId ?? e.entityId ?? null, detail: e.reason ?? e.option ?? e.deferClass ?? null })))
    .sort((a, b) => a.seq - b.seq);
  const provisional = provisionalOf(db, workflowId);
  const deferred = deferredLegsOf(db, workflowId);
  const deferredToHandover = deferredToHandoverOf(db, workflowId);
  return { schema: 'starci/autopilot-bundle@1', title: translator(ownerLanguage())('the owner review ledger'), workflowId, ruling: AUTOPILOT_RULING,
    provisional, deferred, deferredToHandover, decisions, counts: { provisional: provisional.length, deferred: deferred.length, deferredToHandover: deferredToHandover.length, decisions: decisions.length } };
}

/** api status `autopilot` block. */
export function autopilotProjection(db, workflowId, { settings = autopilotSettings(), sweep = null } = {}) {
  const state = autopilotOf(db, workflowId, settings);
  if (!state.on) return { on: false, source: state.source, provisional: [], deferred: [], deferredToHandover: [] };
  const deferredToHandover = deferredToHandoverOf(db, workflowId);
  const budget = budgetOf(db, workflowId, settings);
  return {
    on: true, source: state.source, ruling: AUTOPILOT_RULING,
    provisional: provisionalOf(db, workflowId).map(({ dispatchId, opId, jobId, class: cls, record, receiptPath, label, at }) => ({ dispatchId, opId, jobId, class: cls, record, receiptPath, label, at })),
    deferred: deferredLegsOf(db, workflowId),
    deferredToHandover: deferredToHandover.map(({ key, dispatchId, jobId, opId, deferClass, classes, fields, stubPath, owed, record, reason }) => ({ key, dispatchId, jobId, opId, deferClass, classes, fields, stubPath, owed, record, reason })),
    supervisorGates: supervisorGatesOf(db, workflowId).map(({ incidentId, opId, holds, since }) => ({ incidentId, opId, holds, since })),
    budget,
    ...(sweep && (sweep.answered.length || sweep.deferred.length || sweep.rerouted.length || sweep.timedOut.length || sweep.supplied.length || sweep.errors.length) ? { sweep } : {}),
  };
}

/** The ops whose latest succeeded job rests on a provisional acceptance: the leg reads green-provisional. */
export function provisionalOps(db, workflowId) {
  return new Set(provisionalOf(db, workflowId).map((item) => item.opId).filter(Boolean));
}

/**
 * Re-open one provisional acceptance from the owner's handover answer (api autopilot --reopen): the handover ask
 * must be answered BY THE OWNER (owner-claim.mjs ownerAnswerProof - a fake owner claim is refused), and the owner's
 * note is copied from that verified receipt, never from the caller. Returns the event payload.
 */
export function reopenProvisional(ledger, { workflowId, dispatchId, handoverDispatchId, note = null }) {
  const db = ledger.db;
  const item = provisionalOf(db, workflowId).find((p) => p.dispatchId === dispatchId);
  if (!item) throw Object.assign(new Error(`${dispatchId} is no open provisional acceptance of ${workflowId}`), { code: 'provisional-unknown' });
  const proof = ownerAnswerProof(db, handoverDispatchId);
  if (!proof.ok) throw Object.assign(new Error(`the handover answer ${handoverDispatchId} is not a verified owner answer: ${proof.reason}`), { code: 'owner-claim-unproven' });
  const handover = handoverAsks(db, workflowId).find((ask) => ask.dispatchId === handoverDispatchId);
  if (!handover) throw Object.assign(new Error(`${handoverDispatchId} is no handover ask of ${workflowId}`), { code: 'handover-unknown' });
  const receipt = readJsonFile(proof.receiptPath) ?? {};
  const ownerNote = typeof receipt.note === 'string' && receipt.note.trim() ? receipt.note.trim() : null;
  const payload = { dispatchId, opId: item.opId, jobId: item.jobId, record: item.record, handoverDispatchId, receiptPath: proof.receiptPath,
    ownerNote, focus: typeof note === 'string' && note.trim() ? note.trim().slice(0, 400) : null, answeredBy: OWNER };
  ledger.transaction(() => ledger.appendEvent({ workflowId, entityType: 'report', entityId: dispatchId, kind: AUTOPILOT_EVENTS.reopened, payload }));
  return payload;
}

/** Re-opened provisional items the owner's handover feedback owes a re-run of: nextActions reads them. */
export function reopenedOwed(db, workflowId) {
  return eventsOf(db, workflowId, AUTOPILOT_EVENTS.reopened).filter((e) => {
    const job = e.jobId ? db.prepare('SELECT op_id,created_at FROM jobs WHERE job_id=?').get(e.jobId) : null;
    if (!job) return true;
    return !db.prepare("SELECT 1 FROM jobs WHERE workflow_id=? AND op_id=? AND created_at>? LIMIT 1").get(workflowId, job.op_id, Number(e.at));
  });
}

/** True when an enqueue of provision.ask is a mid-flow owner ask autopilot refuses (only the end-of-flow checklist is planned). */
export function provisionAskMidFlow(db, workflowId, { params = {}, settings = autopilotSettings() } = {}) {
  if (!autopilotOn(db, workflowId, settings)) return false;
  return params?.subject !== HANDOVER_CREDENTIALS_SUBJECT;
}
