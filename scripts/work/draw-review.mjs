#!/usr/bin/env node
// draw-review.mjs — the owner's review of a drawing, and what its answer writes (inc-a4b5b1abdd90).
//
// Defect: brand.decide a7 could not crop the greenfield lockup. layout-tree.mjs crops only from the drawing of a
// ui record in state done ("the layout drawing is accepted before its lockup is taken"), interface.draw had drawn
// ui.learning.app-layout, and nothing ever wrote it done: with candidatesPerScreen 1 interface.draw parked no
// owner ask, work-layout reserves done for the final reconciliation, and review.verify runs after a7.
//
// Owner ruling: the owner reviews only shapes - one per XBase#state (ui.shapes, else every drawn state that is not a
// data status) - as their drawn PART images (*.content.png), light theme, desktop and mobile. Data-status images
// (loading, empty, error, forbidden, skeleton, 401/403/404) are never put to the owner: they are listed as retired.
// So interface.draw parks ONE draw-review ask of those parts - whatever candidatesPerScreen says - for a record
// that gates another leg (the drawing of a planned visible layout: pages under it and the brand lockup wait on
// it; a record another record dependsOn), and the owner's answer settles it:
//
//   status   --ui <ui-record-dir>                          what the record owes: {gates, shapes, parts, retired,
//                                                         acceptance, owed}
//   question --ui <ui-record-dir> [--lang en|vi] [--owner-requested] [--job <op-job-id>]
//                                                         the ask's question, verbatim for the op report: kind
//                                                         draw-review, the shape part images as question.assets
//                                                         (served on demand through the Telegram "Generate URL"
//                                                         flow), and question.review {record, parts [{path, sha256,
//                                                         shape}]}, which serve-ask copies into the answer receipt;
//                                                         ownerRequested when the job (--job, else the op running it)
//                                                         draws on the owner's request (drawOwnerRulingOf)
//   apply    --ui <ui-record-dir> --receipt <answer.json> [--write]
//                                                         the owner's answer: accept writes the record done with
//                                                         ui.review.owner (the receipt, its digest and the parts the
//                                                         owner saw) and, for the owner's own accept, promotes the
//                                                         drawing into brand.direction.golden when its archetype has
//                                                         none or the owner marked it golden; redraw leaves the state
//                                                         and writes the owner's notes as rulings in
//                                                         ui.review.feedback (draw-feedback.mjs) - the brief of the
//                                                         redraw attempt, which question refuses to ask again until
//                                                         every note is addressed (DRAW_FEEDBACK_UNADDRESSED); a
//                                                         product-direction note is learned into
//                                                         brand.direction.learned (proposed)
//
// Owner ruling 2026-09-26: a drawing the owner did not ask to review is accepted without the owner. serve-ask.mjs
// autoAcceptAsk answers such an ask with its accept option (answeredBy auto-recommended, an ask-auto-accepted audit
// event; config.yaml asks.excludes [draw-review] opts out), and apply settles the record from that receipt exactly as
// from the owner's. A drawing the owner asked for (drawOwnerRulingOf, from ledger facts of the asking job's retry
// lineage and the record; serve-ask.mjs drawOwnerRequestOf adds the owner opening its form and question.ownerRequested)
// stays the owner's; a delegate never accepts.
// An acceptance names the part digests it saw; a part redrawn since makes the drawing unaccepted again
// (direction-part.mjs drawingAcceptance, read by layout-tree.mjs for the lockup crop and the planned layout's settlement).
import { opContextOf } from '../guards/op-context.mjs';
import fs from 'node:fs';
import { readAnswerReceipt } from '../machine/ask-receipts.mjs';
import path from 'node:path';
import { isMain } from '../lib/is-main.mjs';
import { stringifyYaml } from '../../engine/yaml.mjs';
import { allNodesOf, appOfUi, nodesOf, readShellRecord } from './layout-tree.mjs';
import { REQUIRED_BREAKPOINTS, REQUIRED_THEMES, ownerAcceptanceOf, partAssetsOf, reviewPartsOf } from './direction-part.mjs';
import { dataStatusOf, recipeRenderedOf } from './ui/ui-shapes.mjs';
import { assetsOf, flag, indexFilesUnder, list, readYaml, reviewMain, sha256File, slash, stateKey, workRootOf, writeRecordFile } from './work-io.mjs';
import { AUTO_ACCEPTED_BY } from '../machine/ask-recommendation.mjs';
import { lineageJobsOf, ownerAnswersOf } from '../machine/owner-answers.mjs';
import { retryDisposition, sameUnit } from '../../engine/admission.mjs';
import { inspectLedger, ledgerFileFor } from '../../engine/db/ledger.mjs';
import { parseJsonOr, readJsonFile } from '../lib/json.mjs';
import { ownerLanguage, translator } from '../lib/i18n.mjs';
import { proposalFilesUnder, proposalImageOf, readProposals } from './grammar-proposal.mjs';
import { rationaleFileOf, rationaleSummary } from './draw/draw-rationale.mjs';
import { DRAW_FEEDBACK_UNADDRESSED, dnaNamesFor, feedbackFindings, feedbackOf, goldenMarkOf, notesOfReceipt, openNotesOf, withFeedbackRound } from './draw-feedback.mjs';
import { learnIntoDirection, promoteGolden } from './brand-direction.mjs';
import { DIRECTION_EXEMPT, archetypeOf } from './ui-archetype.mjs';
import { readBrandRecord } from './brand/brand.mjs'; import { byCodeUnit } from '../lib/list.mjs';

export const DRAW_REVIEW_KIND = 'draw-review';
export const DRAW_REVIEW_SCHEMA = 'starci/draw-review@1';
export const DRAW_REVIEW_OP = 'interface.draw';
/** The two answers, in this order: 0 accepts the drawn parts, 1 asks for a redraw (the note says what to change). */
export const DRAW_REVIEW_DECISIONS = Object.freeze(['accept', 'redraw']);
const OPTIONS = ['Accept the drawn parts', 'Redraw - say in the note what to change'];
const OWNER = 'owner';
/** Autopilot (scripts/kernel/autopilot-run.mjs AUTOPILOT_BY; owner ruling 2026-09-28 autopilot-run-to-finish): a PROVISIONAL accept. */
export const AUTOPILOT_BY = 'autopilot';
/** Who may accept a drawing: the owner, the runtime for a drawing the owner did not ask for (auto-accept), or autopilot provisionally. */
const ACCEPTORS = Object.freeze([OWNER, AUTO_ACCEPTED_BY, AUTOPILOT_BY]);
/** Whether an acceptance block is autopilot's provisional one (machine gates passed; the owner reviews it at handover). */
const isProvisionalAcceptance = (acceptance) => Boolean(acceptance?.answeredBy === AUTOPILOT_BY && acceptance?.provisional === true);

/** The ui record at `uiDir`: {dir, file, record, workRoot, repoRoot}. Throws when it is not a work/ui-screen@1 record. */
function loadDrawing(uiDir) {
  const dir = path.resolve(uiDir);
  const file = path.join(dir, 'index.yaml');
  if (!fs.existsSync(file)) throw new Error(`${slash(dir)} holds no index.yaml`);
  const record = readYaml(file);
  if (record?.schema !== 'work/ui-screen@1') throw new Error(`${slash(file)} is ${record?.schema ?? 'not a record'}, not work/ui-screen@1`);
  const workRoot = workRootOf(dir);
  if (!workRoot) throw new Error(`${slash(dir)} is not under a .starciwork Work root`);
  return { dir, file, record, workRoot, repoRoot: path.dirname(workRoot) };
}

/**
 * Every record under features/ that dependsOn `id` (a leg waiting on this drawing through the graph): {records,
 * unreadable} - an index.yaml that does not parse may be one that waits on this drawing.
 */
function dependentsOf(workRoot, id) {
  const records = [], unreadable = [];
  for (const file of indexFilesUnder(path.join(workRoot, 'features'))) {
    let doc;
    try { doc = readYaml(file); } catch (error) { unreadable.push(`${slash(path.relative(workRoot, file))} (${error.message})`); continue; }
    if (list(doc?.dependsOn).some((d) => (typeof d === 'string' ? d : d?.id) === id)) records.push(doc.id ?? slash(file));
  }
  return { records: records.toSorted(byCodeUnit), unreadable };
}

/**
 * The legs that wait on this drawing being accepted: [{kind, detail}]. A visible layout this record draws (its
 * layout.design, or a surface-layout record at a planned node) - the pages under it wait on it, and on a planned
 * layout the greenfield lockup too; and every record that dependsOn it. Throws when it cannot tell: the layout tree
 * does not parse, or no gate is found while a record under features/ does not parse.
 */
export function gatesOf({ workRoot, record }) {
  const gates = [];
  const shell = readShellRecord(workRoot);
  if (shell?.error) throw new Error(`${slash(shell.file)} ${shell.error}: cannot tell whether a layout waits on ${record.id}`);
  const tree = shell?.record ?? null;
  const ownApp = tree ? appOfUi(tree, record).tree : null;
  const node = allNodesOf(tree).find((n) => n.layout?.design === record.id)
    ?? (record.surface === 'layout' && ownApp ? nodesOf(ownApp).find((n) => n.id === record.route && n.origin === 'planned') : null);
  if (node && (node.origin === 'planned' || record.surface === 'layout') && node.layout?.chrome !== 'passthrough') {
    gates.push(node.origin === 'planned'
      ? { kind: 'planned-layout', node: node.id, detail: `draws the planned layout ${node.id}: the pages under it wait for its settlement, and on a greenfield product brand.decide crops the lockup from it` }
      : { kind: 'layout-design', node: node.id, detail: `draws the layout ${node.id}: the pages under it wait for its settlement` });
  }
  const { records, unreadable } = dependentsOf(workRoot, record.id);
  if (records.length) gates.push({ kind: 'depends-on', records, detail: `${records.join(', ')} dependsOn it` });
  if (!gates.length && unreadable.length) throw new Error(`cannot tell what waits on ${record.id}: ${unreadable.join(', ')} does not parse`);
  return gates;
}

/**
 * The owner reviews shapes only, one per XBase#state: {shapes: [{shape, state}], parts, retired}. `shapes` are
 * ui.shapes {base, state} when the record declares them, else every drawn state that is not a data status
 * (scripts/work/ui/ui-shapes.mjs dataStatusOf). `parts` are the live review parts (desktop and mobile, light) of a
 * shape, each with its `shape`; `retired` are the live review parts of anything else and every part the record
 * retired (asset `retired`): listed, never put to the owner.
 */
export function reviewShapesOf(record) {
  const all = reviewPartsOf(record);
  const declared = record?.ui?.shapes;
  const shapes = Array.isArray(declared)
    ? declared.filter((x) => typeof x?.state === 'string').map((x) => ({ shape: `${x.base}#${x.state}`, state: stateKey(x.state) }))
    : [...new Set(all.map((p) => stateKey(p.state)))].filter((s) => !dataStatusOf(s)).map((state) => ({ shape: state, state }));
  const byState = new Map(shapes.map((x) => [x.state, x.shape]));
  const parts = [], retired = [];
  for (const p of all) {
    const shape = byState.get(stateKey(p.state));
    if (shape) parts.push({ ...p, shape }); else retired.push(p);
  }
  return { shapes, parts, retired, retiredAssets: partAssetsOf(record, { retired: true }) };
}

/** The review cells a shape still lacks (desktop and mobile, light): ["<shape> <bp>/<theme>"]. */
function missingCells({ shapes, parts }) {
  const missing = [];
  for (const { shape, state } of shapes) {
    for (const bp of REQUIRED_BREAKPOINTS) for (const theme of REQUIRED_THEMES) {
      if (!parts.some((p) => stateKey(p.state) === state && p.breakpoint === bp && p.theme === theme)) missing.push(`${shape} ${bp}/${theme}`);
    }
  }
  return missing;
}
const retiredStates = ({ retired, retiredAssets }) => [...new Set([...retired, ...retiredAssets].map((p) => p.state ?? 'default'))];

/**
 * What the record owes its owner review: {id, state, gates, shapes, parts, retired, missing, acceptance, owed, why}.
 * `owed` is true for a complete drawing with current parts and no current owner or declared provisional acceptance.
 * Recipe-rendered records and incomplete drawings owe no review.
 */
export function drawReviewStatus(uiDir) {
  const drawing = loadDrawing(uiDir);
  const { dir, record } = drawing;
  const split = reviewShapesOf(record);
  const recipe = recipeRenderedOf(record);
  if (recipe) {
    return { id: record.id, state: record.state ?? null, dir: slash(dir), gates: [], shapes: [], parts: [], retired: [...split.retired, ...split.retiredAssets], missing: [], acceptance: null, owed: false, recipe,
      why: `rendered by recipe (${recipe.recipes.join(', ')}): ${recipe.why}; it settles done with no drawing and no owner review` };
  }
  const parts = split.parts.map((p) => {
    const file = path.join(dir, p.path);
    const onDisk = fs.existsSync(file) ? sha256File(file) : null;
    return { ...p, onDisk: onDisk !== null, current: onDisk !== null && (!p.sha256 || onDisk === p.sha256) };
  });
  // Every complete drawing is accepted by its owner; provisional acceptance belongs to the declared handover policy.
  const gates = gatesOf(drawing);
  const missing = missingCells(split);
  const acceptance = ownerAcceptanceOf(record, dir);
  let owed = false, why;
  let provisional = false;
  if (acceptance?.current && acceptance.answeredBy === OWNER) why = `accepted by ${acceptance.answeredBy} in ask ${acceptance.dispatchId} at ${acceptance.at}`;
  // Autopilot: a current provisional acceptance owes nothing now - the owner reviews it once, at handover.
  else if (acceptance?.current && isProvisionalAcceptance(acceptance)) { provisional = true; why = `provisionally accepted by autopilot in ask ${acceptance.dispatchId} at ${acceptance.at}: every machine gate passed; the owner reviews it at handover`; }
  else if (!split.shapes.length) why = 'no shape is drawn yet' + (retiredStates(split).length ? ' (retired: ' + retiredStates(split).join(', ') + ')' : '') + ': draw the shapes first';
  else if (missing.length) why = `the draw is incomplete: no part at ${missing.join(', ')}`;
  else if (parts.some((p) => !p.current)) why = `a part is not on disk or no longer hashes to its record: ${parts.filter((p) => !p.current).map((p) => p.path).join(', ')}`;
  else if (acceptance?.current) { owed = true; why = `accepted by ${acceptance.answeredBy} in ask ${acceptance.dispatchId}, not by the owner: every drawing is the owner's to accept`; }
  else {
    owed = true;
    why = acceptance ? `the owner-accepted drawing changed since (${acceptance.reasons.join('; ')}) - review it again` : `the owner has not reviewed the drawn parts${gates.length ? '' : ' (nothing else waits on it, but every drawing goes to the owner)'}`;
  }
  return { id: record.id, state: record.state ?? null, dir: slash(dir), gates, shapes: split.shapes.map((s) => s.shape), parts, retired: [...split.retired, ...split.retiredAssets], missing, acceptance, owed, ...(provisional ? { provisional: true, owedAtHandover: true } : {}), why };
}

const OWNER_ANSWER_RETRY = 'owner-answer';
const closingOf = (db, workflowId, dispatchId) => db.prepare(
  `SELECT kind, payload_json FROM events WHERE workflow_id=? AND kind IN ('ask-answered','ask-superseded') AND json_extract(payload_json,'$.dispatchId')=? ORDER BY seq DESC LIMIT 1`,
).get(workflowId, dispatchId);
const askKindIn = (db, workflowId, dispatchId) => db.prepare(
  `SELECT json_extract(report_json,'$.question.kind') AS kind FROM reports WHERE workflow_id=? AND dispatch_id=?`,
).get(workflowId, dispatchId)?.kind ?? null;
const noteOf = (answer) => {
  const note = typeof answer.note === 'string' ? answer.note : readJsonFile(answer.receiptPath)?.note;
  return typeof note === 'string' && note.trim() ? note.trim() : null;
};

/**
 * Why the owner asked for the drawing `job` (an interface.draw jobs row) draws for `record`, from ledger facts only -
 * or null. The newest owner act decides: an owner accept of a draw review with no note settles every request before
 * it. The owner asked when
 *   - `job` or its retry lineage carries params.ownerRulings;
 *   - an ask of the lineage was answered by the owner (not auto-recommended) with anything but a plain accept;
 *   - the lineage continued as an owner-answer retry (retryClass owner-answer) past an ask that was retired or is
 *     still open, never past one auto-accepted;
 *   - an earlier draw-review ask of `record` (any workflow of this ledger, before report `beforeReportId`) was
 *     answered by the owner with a redraw or a feedback note.
 */
export function drawOwnerRulingOf(db, { job = null, record = null, beforeReportId = null } = {}) {
  if (job) {
    const chain = [job, ...lineageJobsOf(db, job)].filter((row) => row === job || sameUnit(row, job));
    const answers = ownerAnswersOf(db, job);
    for (let i = 0; i < chain.length; i += 1) {
      const row = chain[i], payload = parseJsonOr(row.payload_json);
      const rulings = payload.params?.ownerRulings;
      if (typeof rulings === 'string' && rulings.trim()) return `job ${row.job_id} carries the owner's rulings (params.ownerRulings)`;
      for (const a of answers.filter((x) => x.jobId === row.job_id).reverse()) {
        if (a.answeredBy !== OWNER) continue;
        const plainAccept = askKindIn(db, row.workflow_id, a.dispatchId) === DRAW_REVIEW_KIND && a.chosen?.index === 0 && !a.note;
        if (plainAccept) return null;
        const option = a.chosen ? ', option ' + (() => { if (a.chosen.index != null) return a.chosen.index + 1; return a.chosen.label; })() : ''; return `the owner answered ask ${a.dispatchId} of ${row.job_id}'s lineage (attempt ${a.attempt}${option}${a.note ? ', with a note' : ''})`;
      }
      const successor = chain[i - 1];
      const waited = parseJsonOr(row.result_json).askDispatchId;
      const ownerAnswerRetry = successor && (parseJsonOr(successor.payload_json).retry?.retryClass === OWNER_ANSWER_RETRY || retryDisposition(row).retryClass === OWNER_ANSWER_RETRY);
      if (ownerAnswerRetry && waited) {
        const closed = closingOf(db, row.workflow_id, waited);
        const how = parseJsonOr(closed?.payload_json);
        if (!closed) return `${successor.job_id} is an owner-answer retry of ${row.job_id}, whose ask ${waited} still waits on the owner`;
        if (closed.kind === 'ask-superseded' && how.retired) return `${successor.job_id} is an owner-answer retry of ${row.job_id}, whose ask ${waited} was retired for it`;
      }
    }
  }
  if (!record) return null;
  const earlier = db.prepare(
    `SELECT r.workflow_id, r.dispatch_id, e.payload_json FROM reports r
       JOIN events e ON e.workflow_id=r.workflow_id AND e.kind='ask-answered' AND json_extract(e.payload_json,'$.dispatchId')=r.dispatch_id
      WHERE r.outcome='ask' AND (? IS NULL OR r.report_id < ?) AND json_extract(r.report_json,'$.question.kind')=?
        AND json_extract(r.report_json,'$.question.review.record')=?
      ORDER BY r.report_id DESC`,
  ).all(beforeReportId, beforeReportId, DRAW_REVIEW_KIND, record);
  for (const row of earlier) {
    const answer = parseJsonOr(row.payload_json);
    if ((answer.answeredBy ?? OWNER) !== OWNER) continue;
    const note = noteOf(answer);
    const redraw = DRAW_REVIEW_DECISIONS[Number(answer.optionIndex)] === 'redraw';
    if (!redraw && !note) return null;
    return `the owner ${redraw ? 'asked for a redraw of' : 'left feedback on'} ${record} in draw-review ask ${row.dispatch_id} (${row.workflow_id})`;
  }
  return null;
}

/** drawOwnerRulingOf read from the repository's ledger for op job `jobId` (read-only). Throws when it cannot read it. */
function drawOwnerRulingInRepo(repoRoot, { jobId, record }) {
  const file = ledgerFileFor(repoRoot);
  if (!fs.existsSync(file)) throw new Error(`job ${jobId} is named but ${slash(file)} does not exist: cannot read whether the owner asked for this drawing`);
  const ledger = inspectLedger({ file });
  try {
    const job = ledger.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
    if (!job) throw new Error(`job ${jobId} is not in ${slash(file)}: cannot read whether the owner asked for this drawing`);
    return drawOwnerRulingOf(ledger.db, { job, record });
  } finally { ledger.close(); }
}

/**
 * The draw-review ask's question for the op report, verbatim: {kind, text, options, refs, assets, review,
 * ownerRequested?}. Its accept option is the implicit recommendation (auto-accepted unless the owner asked for the
 * drawing); `ownerRequested` marks a drawing the owner asked for, which then reaches the owner. The text names each
 * part's digest prefix, so a redraw asks a new question rather than repeating an answered one.
 */
export function drawReviewQuestion(uiDir, { lang = ownerLanguage(), ownerRequested = false, jobId = null } = {}) {
  const drawing = loadDrawing(uiDir);
  const { dir, record, repoRoot } = drawing;
  const requested = ownerRequested || Boolean(jobId && drawOwnerRulingInRepo(repoRoot, { jobId, record: record.id }));
  const recipe = recipeRenderedOf(record);
  if (recipe) throw new Error(`${record.id} is rendered by recipe (${recipe.recipes.join(', ')}): ${recipe.why}; it has no drawing and no owner review`);
  const split = reviewShapesOf(record);
  if (!split.parts.length) throw new Error(`${record.id} draws no shape (role direction-content) at desktop or mobile light` + (retiredStates(split).length ? '; retired images (' + retiredStates(split).join(', ') + ') are never put to the owner' : '') + ' - draw the shapes first');
  const missing = missingCells(split);
  if (missing.length) throw new Error(`${record.id} has no drawn part at ${missing.join(', ')}: the owner reviews every shape at desktop and mobile, light`);
  const reviewed = split.parts.map((p) => {
    const file = path.join(dir, p.path);
    if (!fs.existsSync(file)) throw new Error(`${p.path} is not on disk`);
    const sha256 = sha256File(file);
    if (p.sha256 && p.sha256 !== sha256) throw new Error(`${p.path} no longer hashes to its recorded sha256 - record the part as drawn first`);
    return { path: p.path, sha256, breakpoint: p.breakpoint, theme: p.theme, state: p.state, shape: p.shape };
  });
  // A redraw answers the owner's notes before it is asked again (draw-feedback.mjs): every open note is addressed -
  // the part redrawn, the note id in its brief, the critic's gate check for it passed.
  const unaddressed = feedbackFindings(dir, record);
  if (unaddressed.length) throw Object.assign(new Error(`${DRAW_FEEDBACK_UNADDRESSED}: ${unaddressed.map((f) => f.detail).join(' | ')} - redraw through draw-loop.mjs with the brief carrying \`draw-feedback.mjs brief --ui <dir>\` and ask again`), { code: DRAW_FEEDBACK_UNADDRESSED, findings: unaddressed });
  const priorRounds = feedbackOf(record).rounds;
  const answered = openNotesOf(record);
  const tr = translator(lang);
  const bpLabel = (bp) => (bp === 'desktop' ? tr('desktop') : tr('mobile'));
  const digests = reviewed.map((p) => `${p.shape} ${p.breakpoint} ${p.sha256.slice(0, 8)}`).join(', ');
  const roundLine = !priorRounds.length ? '' : tr(' Round {n}; this redraw addresses your notes: {notes}.',
    { n: priorRounds.length + 1, notes: answered.map((n) => `[${n.id}] ${n.text}`).join(' | ') || tr('(none)') });
  const title = String(record.title ?? record.id);
  const retired = retiredStates(split);
  const retiredLine = !retired.length ? '' : tr(' Data-status images ({states}) are retired and not for review.', { states: retired.join(', ') });
  const text = tr('Please review the drawn shapes of "{title}" ({id}): desktop and mobile, light theme. They are a proposed design direction, not a running product. Accept them, or ask for a redraw and say in the note what to change.{retiredLine} [{digests}]',
    { title, id: record.id, retiredLine, digests });
  const label = (p) => `${p.shape} - ${bpLabel(p.breakpoint)}`;
  // What the drawing needed that the Grammar's DNA lacks (grammar-proposal.mjs): the owner is asked, never the runtime.
  const proposals = readProposals(proposalFilesUnder(dir));
  const proposalLine = !proposals.length ? '' : tr(' Grammar proposals (yours to decide, never auto-accepted): {names}.', { names: proposals.map((p) => p.name).join(', ') });
  // The evidence the owner critiques from (owner ruling 2026-09-27 draw-rationale-evidence): each part's annotated
  // redline render (<part>.redline.png) and its rationale.json - every decision with its value, rule ids and reason.
  const redlines = reviewed.map((p) => ({ part: p.path, abs: path.join(dir, p.path.replace(/.png$/i, '.redline.png')), shape: p.shape, breakpoint: p.breakpoint }))
    .filter((r) => fs.existsSync(r.abs)).map((r) => ({ part: r.part, path: slash(path.relative(dir, r.abs)), repoPath: slash(path.relative(repoRoot, r.abs)), shape: r.shape, breakpoint: r.breakpoint }));
  const rationale = [...new Map(reviewed.map((p) => {
    const file = rationaleFileOf(path.join(dir, p.path.replace(/.png$/i, '.html')));
    return file ? [file, { shape: p.shape, file: slash(path.relative(repoRoot, file)), ...rationaleSummary(file) }] : null;
  }).filter(Boolean)).values()];
  const whyLine = !rationale.length ? '' : tr(' Evidence for every decision: the redline images (spacing, rule ids) and {list}.',
    { list: rationale.map((r) => `${r.file} ${tr('({n} decisions)', { n: r.decisions })}`).join(', ') });
  return {
    kind: DRAW_REVIEW_KIND,
    text: `${text}${roundLine}${proposalLine}${whyLine}`,
    options: OPTIONS.map((o) => tr(o)),
    refs: [record.id],
    assets: [...reviewed.map((p) => ({ path: slash(path.relative(repoRoot, path.join(dir, p.path))), label: label(p) })),
      ...redlines.map((r) => ({ path: r.repoPath, label: `${r.shape} - redline ${bpLabel(r.breakpoint)}` })),
      ...proposals.map((p) => [p, proposalImageOf(p)]).filter(([, img]) => img).map(([p, img]) => ({ path: slash(path.relative(repoRoot, img)), label: `${tr('proposal')} ${p.name}` }))],
    ...(rationale.length ? { rationale } : {}),
    ...(proposals.length ? { grammarProposals: proposals.map((p) => ({ name: p.name, file: slash(path.relative(repoRoot, p.file)), gap: p.gap, claims: p.claims, complete: p.complete, status: p.status })) } : {}),
    review: { schema: DRAW_REVIEW_SCHEMA, record: record.id, recordPath: slash(path.relative(repoRoot, path.join(dir, 'index.yaml'))), parts: reviewed,
      ...(redlines.length ? { redlines: redlines.map((r) => ({ path: r.path, part: r.part })) } : {}),
      ...(priorRounds.length ? { round: priorRounds.length + 1, addresses: answered.map((n) => n.id) } : {}) },
    ...(requested ? { ownerRequested: true } : {}),
  };
}

/**
 * Apply the owner's answer to a draw-review ask. `receiptFile` is the starci/ask-answer@1 receipt serve-ask wrote
 * under the repository (packet context.owner_answers names it). Returns {decision: 'accept'|'redraw', written,
 * record, owner?, note?} and throws for a receipt that does not answer this record's review of its current parts.
 */
export function applyDrawReview(uiDir, receiptFile, { write = false, now = () => new Date().toISOString() } = {}) {
  const drawing = loadDrawing(uiDir);
  const { dir, file, record, repoRoot } = drawing;
  const { receipt, receiptAbs, receiptRel } = readAnswerReceipt(receiptFile, { repoRoot });
  if (receipt.opId && receipt.opId !== DRAW_REVIEW_OP) throw new Error(`the receipt answers a ${receipt.opId} ask, not ${DRAW_REVIEW_OP}`);
  const review = receipt.review;
  if (review?.schema !== DRAW_REVIEW_SCHEMA) throw new Error(`the receipt of ask ${receipt.dispatchId ?? '?'} carries no draw review (question.review): it answered another question - park the draw-review ask (draw-review.mjs question) and apply its answer`);
  if (review.record !== record.id) throw new Error(`the receipt reviews ${review.record}, not ${record.id}`);
  const decision = DRAW_REVIEW_DECISIONS[Number(receipt.optionIndex)];
  if (!decision) throw new Error(`the receipt chose option ${receipt.optionIndex ?? '(none)'}; a draw review is answered 1 (accept) or 2 (redraw)`);
  const note = typeof receipt.note === 'string' && receipt.note.trim() ? receipt.note.trim() : null;
  // Every note of the answer is an owner ruling bound to its shape and the digests the owner saw (draw-feedback.mjs):
  // recorded in ui.review.feedback, and a product-direction note is learned into brand.direction.learned (proposed).
  const workRoot = drawing.workRoot;
  const notes = notesOfReceipt({ ...receipt, review }, { dnaNames: dnaNamesFor(workRoot) });
  const feedbackRound = { dispatchId: receipt.dispatchId ?? null, receipt: receiptRel, receiptSha256: sha256File(receiptAbs), at: receipt.at ?? null, answeredBy: receipt.answeredBy ?? null,
    decision, golden: decision === 'accept' && receipt.answeredBy === OWNER && goldenMarkOf(receipt),
    parts: list(review.parts).map((p) => ({ path: slash(p.path ?? ''), sha256: p.sha256 ?? null, ...(p.shape ? { shape: p.shape } : {}), ...(p.breakpoint ? { breakpoint: p.breakpoint } : {}) })), notes };
  const learn = () => learnIntoDirection(workRoot, notes, { record: record.id, receipt: receiptRel, write });
  if (decision === 'redraw') {
    const withNotes = withFeedbackRound(record, feedbackRound);
    if (write) writeRecordFile(file, stringifyYaml(withNotes, { lineWidth: 110 }));
    const learned = learn();
    // The owner's words; the ids the redraw's brief must carry are in feedback.notes (draw-feedback.mjs brief).
    const brief = note ?? (notes.length ? notes.map((n) => n.text).join('\n') : 'the owner asked for a redraw without a note: redraw against the review findings and ask again');
    return { decision, written: false, record: record.id, dispatchId: receipt.dispatchId ?? null, note, brief,
      feedback: { written: write, round: feedbackOf(withNotes).rounds.find((r) => r.dispatchId === feedbackRound.dispatchId)?.round ?? null, notes: notes.map(({ id, text, shape, class: cls }) => ({ id, text, shape, class: cls })) },
      learned: learned.added.map((l) => l.id), ...(learned.skipped ? { learnSkipped: learned.skipped } : {}) };
  }
  if (!ACCEPTORS.includes(receipt.answeredBy)) throw new Error(`the drawing was accepted by ${receipt.answeredBy ?? '(unknown)'}; only the owner, or config.yaml asks.autoAcceptRecommended for a drawing the owner did not ask for (answeredBy ${AUTO_ACCEPTED_BY}), accepts a drawing - park the ask`);
  if (receipt.answeredBy === AUTOPILOT_BY && receipt.provisional !== true) throw new Error(`an autopilot answer accepts a drawing only provisionally (receipt provisional:true with its gate evidence); ${receipt.dispatchId ?? '?'} is not one`);
  const pilot = receipt.answeredBy === AUTOPILOT_BY;
  const auto = receipt.answeredBy === AUTO_ACCEPTED_BY || pilot;
  // The acceptance names exactly the parts the question showed; they must still be the record's current parts.
  const current = new Map(reviewPartsOf(record).map((p) => [p.path, p]));
  const { parts: shapeParts, retired } = reviewShapesOf(record);
  const problems = [];
  for (const p of list(review.parts)) {
    const f = path.join(dir, p.path ?? '');
    if (!p.path || !fs.existsSync(f)) { problems.push(`${p.path ?? '(no path)'} is not on disk`); continue; }
    if (typeof p.sha256 !== 'string' || !p.sha256) problems.push(`the receipt names ${p.path} without the sha256 the owner saw`);
    else if (sha256File(f) !== p.sha256) problems.push(`${p.path} was redrawn after the owner reviewed it`);
    if (!current.has(slash(p.path))) problems.push(`${p.path} is no longer a drawn part of ${record.id}`);
  }
  const seen = new Set(list(review.parts).map((p) => slash(p.path ?? '')));
  for (const p of shapeParts) if (!seen.has(p.path)) problems.push(`${p.path} (${p.shape} ${p.breakpoint}/${p.theme}) was not in the reviewed set`);
  // A ui record reaches done only with a generated asset and a coverage map naming every state it lists
  // (modules/schemas/work-layout.yaml ui rule).
  if (!assetsOf(record).some((a) => a.generation)) problems.push(`${record.id} has no asset carrying generation (interface.draw's ImageGen record)`);
  const covered = new Set(list(record.ui?.coverage?.map).map((m) => m?.state).filter(Boolean));
  const unmapped = list(record.ui?.states).map((s) => (typeof s === 'string' ? s : s?.name)).filter((s) => s && !covered.has(s));
  if (unmapped.length) problems.push(`ui.coverage.map names no ${unmapped.join(', ')} of ui.states`);
  if (problems.length) throw new Error(`the ${auto ? 'auto-accepted' : "owner's"} acceptance in ask ${receipt.dispatchId ?? '?'} cannot settle ${record.id}: ${problems.join('; ')} - review the current drawing again`);
  const owner = {
    decision: 'accepted', dispatchId: receipt.dispatchId ?? null, receipt: receiptRel, receiptSha256: sha256File(receiptAbs),
    answeredBy: receipt.answeredBy, at: receipt.at ?? null, appliedAt: now(), ...(note ? { note } : {}),
    ...(pilot ? { provisional: true, by: AUTOPILOT_BY, gates: { ok: receipt.acceptance?.receipt?.ok === true, beautyMin: receipt.acceptance?.receipt?.beautyMin ?? null, parts: (receipt.acceptance?.receipt?.parts ?? []).map((p) => ({ path: p.path, beauty: p.beauty ?? null, outcome: p.outcome ?? null })) } } : {}),
    // A retired data-status part is named, never shown: no digest binds it to the acceptance.
    parts: [
      ...list(review.parts).map((p) => ({ path: slash(p.path), sha256: p.sha256, breakpoint: p.breakpoint ?? null, theme: p.theme ?? null, ...(p.shape ? { shape: p.shape } : {}) })),
      ...retired.filter((p) => !seen.has(p.path)).map((p) => ({ path: p.path, sha256: null, breakpoint: p.breakpoint, theme: p.theme, retired: true })),
    ],
  };
  // Golden (owner mission 2026-09-27): the owner's own accept of a drawing whose archetype has no golden yet, or one
  // the owner marks golden, is promoted into brand.direction.golden - never an automatic accept.
  let golden = null;
  if (!auto) {
    try { golden = goldenPromotionOf({ drawing, record, receipt, receiptAbs, review, write }); } catch (error) { golden = { promoted: false, why: `golden promotion refused: ${error.message}` }; }
  }
  const next = {
    ...withFeedbackRound(record, feedbackRound),
    state: 'done',
    verificationSource: 'authored-claim',
    because: pilot
      ? `The drawn parts (desktop and mobile, light) were accepted PROVISIONALLY by autopilot in draw-review ask ${owner.dispatchId} at ${owner.at} (receipt ${receiptRel}, answeredBy ${AUTOPILOT_BY}): every machine gate passed - the draw loop metrics with the DNA gate, the independent critic's beauty, the rationale (owner ruling 2026-09-28 autopilot-run-to-finish). The owner reviews it once at handover; it is never golden until then. Implementation captures and browser UAT remain separate proof.`
      : auto
      ? `The drawn parts (desktop and mobile, light) were accepted without the owner in draw-review ask ${owner.dispatchId} at ${owner.at} (receipt ${receiptRel}, answeredBy ${AUTO_ACCEPTED_BY}): config.yaml asks.autoAcceptRecommended accepts a drawing the owner did not ask to review (owner ruling 2026-09-26). A design direction is accepted, not proved by a run. Implementation captures and browser UAT remain separate proof.`
      : `The owner accepted the drawn parts (desktop and mobile, light) in draw-review ask ${owner.dispatchId} at ${owner.at} (receipt ${receiptRel}): a design direction is accepted by its owner, not proved by a run. Implementation captures and browser UAT remain separate proof.`,
    ui: { ...record.ui, status: `${pilot ? 'Provisionally accepted by autopilot (provisional; owner review at handover)' : auto ? 'Auto-accepted (unrequested by the owner)' : 'Owner-accepted'} design direction (draw-review ask ${owner.dispatchId}, ${owner.at}); implementation and real-render review remain pending.`,
      review: { ...withFeedbackRound(record, feedbackRound).ui?.review, owner, ...(golden?.promoted ? { golden: { archetype: golden.archetype, shapes: golden.shapes, dispatchId: owner.dispatchId, promotedAt: owner.appliedAt, archetypeAccepted: golden.archetypeAccepted } } : {}) } },
    ...(Number.isInteger(record.change?.rev) ? { change: { rev: record.change.rev + 1, kind: 'clarifying', at: owner.appliedAt, reason: `${pilot ? 'The drawn parts were accepted provisionally by autopilot' : auto ? 'The drawn parts were auto-accepted' : 'The owner accepted the drawn parts'} in draw-review ask ${owner.dispatchId}; the record is done on that acceptance.` } } : {}),
  };
  if (write) writeRecordFile(file, stringifyYaml(next, { lineWidth: 110 }));
  const learned = learn();
  return { decision, written: write, record: record.id, file: slash(file), owner, learned: learned.added.map((l) => l.id), ...(golden ? { golden } : {}) };
}

/**
 * Whether an owner accept promotes the drawing into brand.direction.golden, and the promotion: {promoted, archetype,
 * shapes, why, ...}. Promoted when the record's archetype (ui-archetype.mjs) is declared by brand.direction and has no
 * golden yet, or the owner marked the accept golden. A layout record owes no archetype and is never promoted.
 */
function goldenPromotionOf({ drawing, record, receipt, receiptAbs, review, write }) {
  const { archetype } = archetypeOf(record);
  if (DIRECTION_EXEMPT.includes(archetype)) return { promoted: false, archetype, why: `a ${archetype} record owes no direction archetype` };
  let brand;
  try { brand = readBrandRecord(drawing.workRoot); } catch (error) { return { promoted: false, archetype, why: `no brand record (${error.message})` }; }
  const direction = brand.brand?.direction;
  if (!direction) return { promoted: false, archetype, why: 'the brand record carries no brand.direction' };
  const has = list(direction.golden).some((g) => g?.archetype === archetype);
  const marked = goldenMarkOf(receipt);
  if (has && !marked) return { promoted: false, archetype, why: `the ${archetype} archetype already has a golden and the owner did not mark this one golden` };
  const parts = list(review.parts).filter((p) => p?.path && REQUIRED_THEMES.includes(p.theme ?? 'light'));
  const htmlOf = (p) => {
    const asset = assetsOf(record).find((a) => a?.role === 'render-source' && slash(a.path ?? '').replace(/\.html?$/i, '') === slash(p.path).replace(/\.png$/i, ''));
    return path.resolve(drawing.dir, asset?.path ?? slash(p.path).replace(/\.png$/i, '.html'));
  };
  const r = promoteGolden(drawing.workRoot, { uiDir: drawing.dir, archetype, parts, receiptFile: receiptAbs, htmlOf, write });
  return { ...r, shapes: [...new Set(parts.map((p) => p.shape).filter(Boolean))], marked };
}

export function drawReviewMain(argv = []) {
  const usage = 'Usage: starci work draw-review <status|question|apply> --ui <ui-record-dir> [--lang en|vi] [--owner-requested] [--job <op-job-id>] [--receipt <answer.json> --write] [--json]\n';
  return reviewMain(argv, {
    targetFlag: '--ui', usage, tag: 'draw-review',
    status: (ui) => {
      const s = drawReviewStatus(ui);
      return { result: s, text: `${s.id} (${s.state}): ${s.owed ? 'OWNER REVIEW OWED' : 'no owner review owed'} - ${s.why}${s.gates.length ? '\n  gates: ' + s.gates.map((g) => g.detail).join(' | ') : ''}\n` };
    },
    question: (ui, args) => ({ result: drawReviewQuestion(ui, { lang: flag(args, '--lang') ?? ownerLanguage(), ownerRequested: args.includes('--owner-requested'), jobId: flag(args, '--job') ?? opContextOf()?.jobId ?? null }) }),
    apply: (ui, receipt, args) => {
      const r = applyDrawReview(ui, receipt, { write: args.includes('--write') });
      const text = r.decision === 'redraw'
        ? `the owner asked for a redraw of ${r.record} (ask ${r.dispatchId}); nothing written. Redraw brief: ${r.brief}`
        : `${r.written ? 'wrote' : 'would write (dry run - pass --write)'} ${r.record} done: accepted by ${r.owner.answeredBy} in ask ${r.owner.dispatchId} (receipt ${r.owner.receipt})`;
      return { result: r, text: `${text}\n` };
    },
  });
}

/**
 * The ui records a done interface.draw report wrote, judged for their owner review: {owed: [{id, dir, why, gates}],
 * unjudged: [{path, error}]}. `files` are the report's files (repo-relative paths or globs). Read-only. A record the
 * judgement cannot read (an index.yaml that does not parse, a layout tree or a dependent record that does not) is
 * unjudged, never skipped: it may be one that owes the review.
 */
export function drawReviewsOwed(repo, files) {
  const dirs = new Set();
  const unjudged = [];
  const shown = (p) => slash(path.relative(repo, p));
  // The ui record a report file sits in: the nearest index.yaml above it, up to the Work root.
  const recordAbove = (start) => {
    for (let dir = start; ; dir = path.dirname(dir)) {
      const index = path.join(dir, 'index.yaml');
      if (fs.existsSync(index)) {
        let doc;
        try { doc = readYaml(index); } catch (error) { unjudged.push({ path: shown(index), error: error.message }); return; }
        if (doc?.schema === 'work/ui-screen@1') { dirs.add(dir); return; }
      }
      if (path.basename(dir) === '.starciwork' || path.dirname(dir) === dir) return;
    }
  };
  for (const spec of list(files)) {
    const rel = slash(spec);
    const staticPart = /[*{[?]/.test(rel) ? rel.slice(0, rel.search(/[*{[?]/)).replace(/\/[^/]*$/, '') : rel;
    if (!/(^|\/)\.starciwork\//.test(staticPart) || !/(^|\/)ui(\/|$)/.test(staticPart)) continue;
    const abs = path.resolve(repo, staticPart);
    if (!fs.existsSync(abs)) continue;
    if (!fs.statSync(abs).isDirectory()) { recordAbove(path.dirname(abs)); continue; }
    // A directory (a glob's static prefix): the ui record it sits in, and every ui record below it.
    recordAbove(abs);
    for (const index of indexFilesUnder(abs)) {
      let doc;
      try { doc = readYaml(index); } catch (error) { unjudged.push({ path: shown(index), error: error.message }); continue; }
      if (doc?.schema === 'work/ui-screen@1') dirs.add(path.dirname(index));
    }
  }
  const owed = [];
  for (const dir of dirs) {
    let s;
    try { s = drawReviewStatus(dir); } catch (error) { unjudged.push({ path: shown(dir), error: error.message }); continue; }
    if (s.owed) owed.push({ id: s.id, dir: shown(dir), why: s.why, gates: s.gates.map((g) => g.kind) });
  }
  const seen = new Set();
  return { owed, unjudged: unjudged.filter((u) => !seen.has(u.path) && seen.add(u.path)) };
}

if (isMain(import.meta.url)) {
  const result = drawReviewMain(process.argv.slice(2));
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
}
