#!/usr/bin/env node
// draw-feedback.mjs — the owner's feedback -> redraw -> golden loop of interface.draw (owner mission 2026-09-27:
// "the owner checks the images; any image that is wrong gets feedback -> redraw -> until golden").
//
// The runtime, never the Kernel's free choice, turns an owner draw-review answer into work:
//   1. Every note of the answer - the general note (one ruling per line; a line "<XBase#state>: ..." or "<state>: ..."
//      binds that shape) and each per-image note (receipt.partNotes, from the draw-review form) - is an OWNER RULING
//      bound to its shape and the part digests the owner saw, with the receipt. serve-ask records one
//      `draw-owner-ruling` ledger event per note when the owner submits (recordDrawAnswer), and `draw-redraw-owed`
//      for a redraw answer; draw-review.mjs apply copies the rulings into the ui record (ui.review.feedback).
//   2. A redraw answer makes the same interface.draw leg owe a redraw that addresses EVERY open note: the notes ride
//      in the next loop's brief (`brief`, which the brief .prompt.txt carries verbatim, each note by its id) and in the
//      independent critic's rubric as gate checks for that shape (draw-critic.mjs rubricFor). A redraw that does not
//      address a note is DRAW_FEEDBACK_UNADDRESSED: its parts are the bytes the owner rejected, its brief does not carry
//      the note, or its loop's critic did not pass the note's check. draw-review.mjs question refuses to ask again,
//      api report refuses the ask/done report, api settle refuses the pass. The cycle repeats until the owner accepts.
//   3. Learning: each note is classified (by structure here; the Kernel or the critic may reclassify with `classify`,
//      which structure confirms) as product-direction (appended to the product's brand.direction.learned, status
//      proposed until the owner next accepts the direction; every later draw of the product reads it in the brief and
//      as a critic gate check), grammar (a grammar-proposal-filed record, status proposed), knowledge (a
//      knowledge-change-requested record for the supervisor / runtime owner) or one-off (that shape only).
//   4. Golden: an owner accept of a drawing whose archetype has no golden yet, or one the owner marks golden, is
//      promoted into brand.direction.golden through brand-direction.mjs promoteGolden (owner receipt only, never an
//      automatic answer).
//
//   brief    --ui <ui-record-dir> [--shape <XBase#state>] [--json]   the owner rulings a redraw's brief must carry
//   status   --ui <ui-record-dir> [--json]                           rounds, open notes, addressed or not, golden
//   check    --ui <ui-record-dir> [--json]                           exit 1 on DRAW_FEEDBACK_UNADDRESSED
//   classify --ui <ui-record-dir> --note <id> --class <class> [--target <x>] [--as antiPattern|vocabulary|rubric]
//            [--by kernel|critic] [--write]                          reclassify one note; structure must confirm it
import fs from 'node:fs';
import { loopFileOfRef, loopLabelOf } from './draw/draw-loop-coverage.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from '../../engine/digest.mjs';
import { stringifyYaml } from '../../engine/yaml.mjs';
import { assetsOf, flag, list, readYaml, sha256File, slash, stateKey, workRootOf, writeRecordFile } from './work-io.mjs';
import { readJsonFile } from '../lib/json.mjs';
import { DRAW_REVIEW_DECISIONS, DRAW_REVIEW_KIND, reviewShapesOf } from './draw-review.mjs';
import { defaultGrammarRoot, grammarComponentNames, readBrandRecord } from './brand/brand.mjs';
import { text } from '../lib/stack-declaration.mjs'; import { isMain } from '../lib/is-main.mjs'; import { altOf } from '../lib/source-phrases.mjs';

const DRAW_FEEDBACK_SCHEMA = 'starci/draw-feedback@1';
/** The contract change that made owner feedback a runtime loop (modules/kernel/contract-changes/). */
export const DRAW_FEEDBACK_CHANGE = 'owner-draw-feedback-golden';
export const DRAW_FEEDBACK_UNADDRESSED = 'DRAW_FEEDBACK_UNADDRESSED';
/** Ledger events (payloads are names, ids and digests; the note text is the owner's own words). */
export const DRAW_OWNER_RULING = 'draw-owner-ruling';
const DRAW_OWNER_RULING_CLASSIFIED = 'draw-owner-ruling-classified';
export const DRAW_REDRAW_OWED = 'draw-redraw-owed';
export const KNOWLEDGE_CHANGE_REQUESTED = 'knowledge-change-requested';
const KNOWLEDGE_CHANGE_RESOLVED = 'knowledge-change-resolved';
export const GRAMMAR_PROPOSAL_FILED = 'grammar-proposal-filed';
const NOTE_CLASSES = Object.freeze(['product-direction', 'grammar', 'knowledge', 'one-off']);
const LEARNED_KINDS = Object.freeze(['antiPattern', 'vocabulary', 'rubric']);
/** Rubric check groups the critic gets from the owner. */
const OWNER_NOTE_GROUP = 'owner-note';
const OWNER_LEARNED_GROUP = 'owner-learned';
/** The owner marks an accepted drawing golden in the note (or the form's golden box: receipt.golden). The Vietnamese alternatives of every word class below are lexicon data (modules/goal/source-phrases.yaml drawNote). */
const GOLDEN_WORDS = new RegExp(`\\bgolden\\b|${altOf('drawNote.golden')}`, 'i');
const RULE_ID = /\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d+\b/;
const PRODUCT_WORDS = new RegExp(`\\b(always|never|every|everywhere|all (pages|screens|cards)|from now on|brand|colou?rs?|palette|accent|tones?|fonts?|typography|style|spacing|density|radius|shadow|icons?)\\b|${altOf('drawNote.product')}`, 'i');
const GRAMMAR_WORDS = new RegExp(`\\b(grammar|DNA|variant|new component|missing component|anatomy|slot)\\b|${altOf('drawNote.grammar')}`, 'i');
const KNOWLEDGE_WORDS = new RegExp(`\\bknowledge\\b|\\bguideline\\b|${altOf('drawNote.knowledge')}`, 'i');
const OWNER = 'owner';


/** A note's stable id: the ask it answered, its place and its words. A rubric check id and a brief anchor. */
export const noteIdOf = (dispatchId, index, words) => `ON-${sha256(`${dispatchId ?? '-'}|${index}|${words}`).slice(0, 10)}`;

/** The DNA component names of the product's grammar family (for classification), [] when unknown. */
export function dnaNamesFor(workRoot, { grammarRoot = defaultGrammarRoot() } = {}) {
  let family = 'starci';
  try { family = readBrandRecord(workRoot).family ?? family; } catch { /* no brand record: the default family */ }
  return grammarComponentNames({ family, grammarRoot }).names;
}

/**
 * The class of one owner note, read from its structure: {class, target, as, why}. knowledge when it cites a
 * knowledge rule id or speaks of knowledge; grammar when it asks for a component, variant or anatomy DNA lacks;
 * product-direction when it is a product-wide rule (always/never, colour, type, spacing, brand); else one-off.
 */
export function classifyNote(words, { dnaNames = [] } = {}) {
  const s = String(words ?? '');
  const rule = RULE_ID.exec(s)?.[0] ?? null;
  if (rule || KNOWLEDGE_WORDS.test(s)) return { class: 'knowledge', target: rule, as: null, why: rule ? `cites the knowledge rule ${rule}` : 'speaks of a knowledge rule' };
  const component = [...dnaNames].sort((a, b) => b.length - a.length).find((n) => new RegExp(`\\b${n}\\b`).test(s)) ?? null;
  if (GRAMMAR_WORDS.test(s)) return { class: 'grammar', target: component, as: null, why: component ? `asks for a grammar change to ${component}` : 'asks for a component or variant the grammar lacks' };
  if (PRODUCT_WORDS.test(s)) return { class: 'product-direction', target: null, as: 'antiPattern', why: 'a product-wide rule (brand, colour, type, spacing, always/never)' };
  return { class: 'one-off', target: null, as: null, why: 'about this drawing only' };
}

/**
 * Whether structure confirms a (re)classification: {ok, why}. grammar names a DNA component (or Component.variant);
 * knowledge names a knowledge rule id or an existing knowledge/ path; product-direction says which learned kind.
 */
function confirmClass({ cls, target = null, as = null, dnaNames = [], knowledgeRoot = null }) {
  if (!NOTE_CLASSES.includes(cls)) return { ok: false, why: `class must be one of ${NOTE_CLASSES.join(', ')}` };
  if (cls === 'grammar') {
    const root = /^([A-Z][A-Za-z0-9]*)(?:\.[\w-]+)?$/.exec(String(target ?? ''))?.[1];
    if (!root) return { ok: false, why: 'a grammar ruling names the DNA component it changes (--target Component or Component.variant)' };
    if (dnaNames.length && !dnaNames.includes(root)) return { ok: false, why: `${root} is not a component the grammar DNA renders; a new component is proposed against the closest DNA one` };
  }
  if (cls === 'knowledge') {
    const t = String(target ?? '');
    const isPath = knowledgeRoot && /^knowledge\//.test(t) && fs.existsSync(path.join(knowledgeRoot, t));
    if (!RULE_ID.test(t) && !isPath) return { ok: false, why: 'a knowledge ruling names the rule id (e.g. ACCENT-6) or the knowledge/ file it changes (--target)' };
  }
  if (cls === 'product-direction' && !LEARNED_KINDS.includes(as ?? 'antiPattern')) return { ok: false, why: `--as must be one of ${LEARNED_KINDS.join(', ')}` };
  return { ok: true, why: null };
}

/**
 * The notes of one starci/ask-answer@1 receipt of a draw-review ask: [{id, text, shape, part, parts, dispatchId,
 * workflowId, at, answeredBy, decision, owed, class, target, as, classifiedBy, why}]. `owed` is true for a redraw
 * answer: the next drawing must address the note. The golden mark alone is no note.
 */
export function notesOfReceipt(receipt, { dnaNames = [] } = {}) {
  const review = receipt?.review;
  if (!review || !Array.isArray(review.parts)) return [];
  const parts = review.parts.filter((p) => p && typeof p.path === 'string');
  const shapes = [...new Set(parts.map((p) => p.shape).filter(Boolean))];
  const decision = DRAW_REVIEW_DECISIONS[Number(receipt.optionIndex)] ?? null;
  const seen = (shape) => parts.filter((p) => !shape || p.shape === shape).map((p) => ({ path: slash(p.path), sha256: p.sha256 ?? null, breakpoint: p.breakpoint ?? null, shape: p.shape ?? null }));
  const shapeNamed = (label) => {
    const k = stateKey(label);
    return shapes.find((s) => stateKey(s) === k) ?? shapes.find((s) => stateKey(String(s).split('#').pop()) === k) ?? null;
  };
  const raw = [];
  // Auto-accepted receipts carry the runtime's own note, never the owner's words.
  if (receipt.answeredBy === OWNER) {
    for (const line of String(receipt.note ?? '').split(/\r?\n/)) {
      const cleaned = line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim();
      if (!cleaned || (GOLDEN_WORDS.test(cleaned) && cleaned.replace(GOLDEN_WORDS, '').replace(/[\s.,!:;-]/g, '').length < 3)) continue;
      const bound = /^([A-Za-z][\w-]*(?:#[\w-]+)?)\s*:\s*(.+)$/.exec(cleaned);
      const shape = bound ? shapeNamed(bound[1]) : null;
      raw.push({ words: shape ? bound[2].trim() : cleaned, shape, part: null });
    }
    for (const pn of list(receipt.partNotes)) {
      const words = text(pn?.note);
      const part = parts.find((p) => slash(p.path) === slash(String(pn?.path ?? '')));
      if (words && part) raw.push({ words, shape: part.shape ?? null, part: slash(part.path) });
    }
  }
  return raw.map((r, i) => {
    const c = classifyNote(r.words, { dnaNames });
    return {
      id: noteIdOf(receipt.dispatchId, i, r.words), text: r.words, shape: r.shape, part: r.part,
      parts: r.part ? seen(r.shape).filter((p) => p.path === r.part) : seen(r.shape),
      dispatchId: receipt.dispatchId ?? null, workflowId: receipt.workflowId ?? null, at: receipt.at ?? null, answeredBy: receipt.answeredBy ?? null,
      decision, owed: decision === 'redraw', class: c.class, target: c.target, as: c.as, classifiedBy: 'structure', why: c.why,
    };
  });
}

/** Whether a receipt accepts the drawing AND marks it golden (the form's golden box, or the golden word in the note). */
export const goldenMarkOf = (receipt) => receipt?.golden === true || GOLDEN_WORDS.test(String(receipt?.note ?? ''));

// ---------------------------------------------------------------------------------------------------------
// The ui record's copy: ui.review.feedback
// ---------------------------------------------------------------------------------------------------------

export const feedbackOf = (record) => {
  const f = record?.ui?.review?.feedback;
  return f && typeof f === 'object' && Array.isArray(f.rounds) ? f : { schema: DRAW_FEEDBACK_SCHEMA, rounds: [] };
};

/**
 * The record with one answered round merged into ui.review.feedback (idempotent by dispatchId; a note keeps a
 * reclassification already recorded). `round` {dispatchId, receipt, receiptSha256, at, answeredBy, decision, golden,
 * parts, notes}.
 */
export function withFeedbackRound(record, round) {
  const feedback = feedbackOf(record);
  const prior = feedback.rounds.find((r) => r.dispatchId === round.dispatchId);
  const keep = new Map(list(prior?.notes).map((n) => [n.id, n]));
  const notes = round.notes.map((n) => {
    const had = keep.get(n.id);
    const base = { id: n.id, text: n.text, shape: n.shape ?? null, part: n.part ?? null, owed: n.owed, class: n.class, classifiedBy: n.classifiedBy, ...(n.target ? { target: n.target } : {}), ...(n.as ? { as: n.as } : {}) };
    return had && had.classifiedBy !== 'structure' ? { ...base, class: had.class, classifiedBy: had.classifiedBy, ...(had.target ? { target: had.target } : {}), ...(had.as ? { as: had.as } : {}) } : base;
  });
  const others = feedback.rounds.filter((r) => r.dispatchId !== round.dispatchId);
  const entry = { round: prior?.round ?? others.length + 1, dispatchId: round.dispatchId, receipt: round.receipt, receiptSha256: round.receiptSha256, at: round.at,
    answeredBy: round.answeredBy, decision: round.decision, ...(round.golden ? { golden: true } : {}), parts: round.parts, notes };
  const rounds = [...others, entry].sort((a, b) => a.round - b.round);
  return { ...record, ui: { ...record.ui, review: { ...(record.ui?.review ?? {}), feedback: { schema: DRAW_FEEDBACK_SCHEMA, rounds } } } };
}

/**
 * The notes still owed a redraw: every note of an owner redraw round after the owner's last accept round, with
 * the round it came from. A note whose shape is gone from ui.shapes is still owed (it names what to change).
 */
export function openNotesOf(record) {
  const rounds = feedbackOf(record).rounds;
  const lastAccept = Math.max(0, ...rounds.filter((r) => r.decision === 'accept' && r.answeredBy === OWNER).map((r) => r.round));
  return rounds.filter((r) => r.round > lastAccept && r.decision === 'redraw')
    .flatMap((r) => list(r.notes).filter((n) => n.owed !== false).map((n) => ({ ...n, round: r.round, dispatchId: r.dispatchId, seen: list(r.parts), at: r.at })));
}

/** The product's learned owner rulings (brand.direction.learned), [] without a brand record or direction. */
export function learnedOf(workRoot) {
  try { return list(readBrandRecord(workRoot).brand?.direction?.learned); } catch { return []; }
}

/**
 * The rubric checks the owner adds for one shape: every open note bound to it (or to no shape), and every learned
 * product ruling. Each is a gate check: a render that fails it is capped (gateCap) and the note stays unaddressed.
 */
export function ownerRubricChecks({ record = null, workRoot = null, shape = null } = {}) {
  const checks = [];
  for (const n of record ? openNotesOf(record) : []) {
    if (shape && n.shape && stateKey(n.shape) !== stateKey(shape) && stateKey(String(n.shape).split('#').pop()) !== stateKey(shape)) continue;
    checks.push({ id: n.id, group: OWNER_NOTE_GROUP, gate: true, cites: [`owner draw-review ask ${n.dispatchId} (round ${n.round})`],
      test: `The owner rejected the previous drawing${n.shape ? ` of ${n.shape}` : ''}${n.part ? ` (${path.basename(n.part)})` : ''} and asked: "${n.text}". Pass only when this render visibly does what the owner asked; fail when it still shows what the owner rejected.` });
  }
  for (const l of workRoot ? learnedOf(workRoot) : []) {
    if (!l?.id || !l.text) continue;
    checks.push({ id: l.id, group: OWNER_LEARNED_GROUP, gate: true, cites: [`owner ruling ${l.source?.dispatchId ?? '?'} (${l.status ?? 'proposed'})`],
      test: `Product ruling from the owner (${l.kind ?? 'antiPattern'}, ${l.status ?? 'proposed'}): "${l.text}". Fail when the render repeats the mistake the owner named.` });
  }
  return checks;
}

// ---------------------------------------------------------------------------------------------------------
// Addressed or not (DRAW_FEEDBACK_UNADDRESSED)
// ---------------------------------------------------------------------------------------------------------

/** The best round's critique of a loop (loop.json), or null. */
function bestCritiqueOf(loopFile) {
  const loop = readJsonFile(loopFile);
  if (!loop || !Array.isArray(loop.rounds)) return null;
  const best = loop.rounds.find((r) => r.n === loop.best) ?? loop.rounds[loop.rounds.length - 1];
  return best ? readJsonFile(path.join(path.dirname(loopFile), best.dir ?? `round-${best.n}`, 'critique.json')) : null;
}

/**
 * Whether one open note is addressed by the record's current drawing: {addressed, reasons}. Every current review
 * part of the note's shape (every shape, for a note bound to none) must be redrawn (not a digest the owner saw), its
 * brief (generation.promptPath) must carry the note id, and its draw loop's best round critique must pass the
 * note's check.
 */
function noteAddressed(dir, record, note) {
  const reasons = [];
  const { parts } = reviewShapesOf(record);
  const want = note.shape ? parts.filter((p) => stateKey(p.shape) === stateKey(note.shape)) : parts;
  if (!want.length) return { addressed: false, reasons: [`no current part draws ${note.shape ?? 'any shape'}`] };
  const rejected = new Set(list(note.seen ?? note.parts).map((p) => p.sha256).filter(Boolean));
  const assets = new Map(assetsOf(record).map((a) => [slash(a.path ?? ''), a]));
  for (const p of want) {
    const file = path.join(dir, p.path);
    const now = fs.existsSync(file) ? sha256File(file) : null;
    if (!now) { reasons.push(`${p.path} is not on disk`); continue; }
    if (rejected.has(now)) { reasons.push(`${p.path} is still the image the owner rejected (not redrawn)`); continue; }
    const asset = assets.get(p.path) ?? {};
    const prompt = asset.generation?.promptPath ? path.resolve(dir, asset.generation.promptPath) : null;
    const brief = prompt && fs.existsSync(prompt) ? fs.readFileSync(prompt, 'utf8') : null;
    if (brief == null) reasons.push(`${p.path} has no brief on disk (generation.promptPath) to carry ${note.id}`);
    else if (!brief.includes(note.id)) reasons.push(`the brief of ${p.path} does not carry ${note.id} (draw-feedback.mjs brief prints it)`);
    const loopRef = loopLabelOf(asset.generation?.loop);
    const loopFile = loopFileOfRef(asset.generation?.loop);
    const critique = loopFile ? bestCritiqueOf(loopFile) : null;
    const check = list(critique?.verdict?.checks).find((c) => c.id === note.id);
    if (!critique?.verdict) reasons.push(`${p.path} has no draw-loop critique${loopRef ? ` (${loopRef})` : ''} to judge ${note.id}`);
    else if (!check) reasons.push(`the critic of ${p.path} did not judge ${note.id} (the rubric lacked the owner's note)`);
    else if (check.pass !== true) reasons.push(`the critic fails ${note.id} on ${p.path}: ${String(check.evidence ?? '').slice(0, 200)}`);
  }
  return { addressed: reasons.length === 0, reasons: [...new Set(reasons)] };
}

/** DRAW_FEEDBACK_UNADDRESSED findings of a ui record: [{code, record, path, note, round, detail}]. */
export function feedbackFindings(dir, record = null) {
  const rec = record ?? readYaml(path.join(dir, 'index.yaml'));
  const findings = [];
  for (const n of openNotesOf(rec)) {
    const r = noteAddressed(dir, rec, n);
    if (!r.addressed) findings.push({ code: DRAW_FEEDBACK_UNADDRESSED, record: rec.id, path: slash(dir), note: n.id, round: n.round, shape: n.shape ?? null,
      detail: `${rec.id}: owner note ${n.id} (round ${n.round}${n.shape ? `, ${n.shape}` : ''}) "${String(n.text).slice(0, 160)}" is not addressed - ${r.reasons.join('; ')}` });
  }
  return findings;
}

/** The feedback state of a ui record: {id, rounds, open: [{..., addressed, reasons}], golden, awaitingOwner}. */
function feedbackStatus(dir) {
  const record = readYaml(path.join(dir, 'index.yaml'));
  const rounds = feedbackOf(record).rounds;
  const open = openNotesOf(record).map((n) => ({ ...n, ...noteAddressed(dir, record, n) }));
  return { id: record.id, rounds: rounds.map((r) => ({ round: r.round, dispatchId: r.dispatchId, decision: r.decision, answeredBy: r.answeredBy, at: r.at, golden: Boolean(r.golden), notes: list(r.notes).length })),
    open, addressed: open.filter((n) => n.addressed).length, unaddressed: open.filter((n) => !n.addressed).length, golden: record.ui?.review?.golden ?? null };
}

/** The brief block a redraw carries verbatim: every open owner note of the shape (by id) and every learned ruling. */
export function briefBlock(dir, { shape = null } = {}) {
  const record = readYaml(path.join(dir, 'index.yaml'));
  const workRoot = workRootOf(dir);
  const notes = openNotesOf(record).filter((n) => !shape || !n.shape || stateKey(n.shape) === stateKey(shape) || stateKey(String(n.shape).split('#').pop()) === stateKey(shape));
  const learned = workRoot ? learnedOf(workRoot) : [];
  const lines = [];
  if (notes.length) {
    lines.push('OWNER NOTES - the owner rejected the previous drawing; this redraw must address EVERY note (the critic gates each by its id):');
    for (const n of notes) lines.push(`- [${n.id}] round ${n.round}${n.shape ? ` ${n.shape}` : ''}${n.part ? ` (${path.basename(n.part)})` : ''}: ${n.text}`);
  }
  if (learned.length) {
    lines.push('OWNER PRODUCT RULINGS - never repeat these mistakes on any page of this product:');
    for (const l of learned) lines.push(`- [${l.id}] (${l.kind ?? 'antiPattern'}, ${l.status ?? 'proposed'}): ${l.text}`);
  }
  return { notes, learned, text: lines.join('\n') };
}

// ---------------------------------------------------------------------------------------------------------
// The ledger side (serve-ask, api status)
// ---------------------------------------------------------------------------------------------------------

const eventExists = (db, workflowId, kind, key, value) => Boolean(db.prepare(
  `SELECT 1 FROM events WHERE workflow_id=? AND kind=? AND json_extract(payload_json,'$.${key}')=? LIMIT 1`,
).get(workflowId, kind, value));

/**
 * Record an answered draw-review ask as owner rulings (serve-ask on submit; idempotent): one `draw-owner-ruling` per
 * note, a `grammar-proposal-filed` (status proposed) per grammar note, a `knowledge-change-requested` per knowledge
 * note, and `draw-redraw-owed` for a redraw answer. Returns {rulings, redrawOwed}. `report` is the ask's reports row.
 */
export function recordDrawAnswer(ledger, { workflowId, report, receipt, receiptPath, repo, now = Date.now() }) {
  const rj = (() => { try { return JSON.parse(report?.report_json ?? '{}') ?? {}; } catch { return {}; } })();
  if (rj.question?.kind !== DRAW_REVIEW_KIND || !receipt?.review) return { rulings: [], redrawOwed: null };
  const db = ledger.db;
  const workRoot = repo ? path.join(repo, '.starciwork') : null;
  const dnaNames = workRoot && fs.existsSync(workRoot) ? dnaNamesFor(workRoot) : [];
  const notes = notesOfReceipt(receipt, { dnaNames });
  const record = receipt.review.record;
  const jobId = rj.from ?? db.prepare(`SELECT job_id FROM jobs WHERE workflow_id=? AND json_extract(payload_json,'$.orca.dispatchId')=? ORDER BY created_at DESC LIMIT 1`).get(workflowId, report.dispatch_id)?.job_id ?? null;
  const receiptRel = receiptPath && repo ? slash(path.relative(repo, receiptPath)) : receiptPath ?? null;
  let receiptSha256 = null;
  try { receiptSha256 = receiptPath ? sha256File(receiptPath) : null; } catch { receiptSha256 = null; }
  const rulings = [];
  let redrawOwed = null;
  ledger.transaction(() => {
    for (const n of notes) {
      if (eventExists(db, workflowId, DRAW_OWNER_RULING, 'noteId', n.id)) continue;
      const payload = { noteId: n.id, record, recordPath: receipt.review.recordPath ?? null, shape: n.shape, part: n.part, parts: n.parts, text: n.text,
        class: n.class, target: n.target, as: n.as, classifiedBy: n.classifiedBy, decision: n.decision, owed: n.owed, dispatchId: n.dispatchId, jobId, receipt: receiptRel, receiptSha256 };
      ledger.appendEvent({ workflowId, entityType: 'report', entityId: report.dispatch_id, kind: DRAW_OWNER_RULING, createdAt: now, payload });
      rulings.push(payload);
      if (n.class === 'grammar') {
        const name = n.target ? `${n.target} (owner note ${n.id})` : `owner note ${n.id}`;
        ledger.appendEvent({ workflowId, entityType: 'report', entityId: report.dispatch_id, kind: GRAMMAR_PROPOSAL_FILED, createdAt: now,
          payload: { name, file: null, sha256: null, jobId, opId: 'interface.draw', status: 'proposed', complete: false, missing: ['anatomy', 'tokens', 'claims', 'render'], gap: n.text, claims: [], render: null, source: 'owner-draw-note', noteId: n.id, record } });
      }
      if (n.class === 'knowledge') {
        ledger.appendEvent({ workflowId, entityType: 'report', entityId: report.dispatch_id, kind: KNOWLEDGE_CHANGE_REQUESTED, createdAt: now,
          payload: { noteId: n.id, target: n.target, text: n.text, record, shape: n.shape, dispatchId: n.dispatchId, receipt: receiptRel, status: 'open', for: 'supervisor' } });
      }
    }
    const decision = DRAW_REVIEW_DECISIONS[Number(receipt.optionIndex)];
    if (decision === 'redraw' && !eventExists(db, workflowId, DRAW_REDRAW_OWED, 'dispatchId', report.dispatch_id)) {
      redrawOwed = { record, recordPath: receipt.review.recordPath ?? null, jobId, dispatchId: report.dispatch_id, shapes: [...new Set(list(receipt.review.parts).map((p) => p.shape).filter(Boolean))],
        noteIds: notes.map((n) => n.id), receipt: receiptRel };
      ledger.appendEvent({ workflowId, entityType: 'report', entityId: report.dispatch_id, kind: DRAW_REDRAW_OWED, createdAt: now, payload: redrawOwed });
    }
  });
  return { rulings, redrawOwed };
}

/** Reclassifications recorded in the ledger (draw-owner-ruling-classified), newest last: Map(noteId -> payload). */
function classificationsOf(db, workflowId) {
  const out = new Map();
  try {
    for (const row of db.prepare('SELECT payload_json FROM events WHERE workflow_id=? AND kind=? ORDER BY seq').all(workflowId, DRAW_OWNER_RULING_CLASSIFIED)) {
      const p = JSON.parse(row.payload_json ?? '{}');
      if (p?.noteId) out.set(p.noteId, p);
    }
  } catch { /* no events table */ }
  return out;
}

/** The workflow's open knowledge change requests (requested, not resolved). */
export function openKnowledgeRequests(db, workflowId) {
  const open = new Map();
  try {
    for (const row of db.prepare('SELECT kind,payload_json,created_at FROM events WHERE workflow_id=? AND kind IN (?,?) ORDER BY seq').all(workflowId, KNOWLEDGE_CHANGE_REQUESTED, KNOWLEDGE_CHANGE_RESOLVED)) {
      const p = JSON.parse(row.payload_json ?? '{}') ?? {};
      if (!p.noteId) continue;
      if (row.kind === KNOWLEDGE_CHANGE_RESOLVED) open.delete(p.noteId);
      else open.set(p.noteId, { noteId: p.noteId, target: p.target ?? null, text: p.text ?? '', record: p.record ?? null, requestedAt: row.created_at, status: 'open' });
    }
  } catch { return []; }
  return [...open.values()];
}

/**
 * The owner's image review board of one workflow (api status drawReviews): one entry per ui record a draw-review
 * ask of this workflow showed - {record, recordPath, awaitingOwner, rounds: [{round, dispatchId, jobId, askedAt,
 * state, decision, answeredBy, answeredAt, golden, parts, notes}], shapes: [{shape, round, parts, openNotes,
 * addressed, unaddressed, golden}], redrawOwed}. Read-only.
 */
export function drawReviewBoard(db, { workflowId, repo }) {
  let rows = [];
  try {
    rows = db.prepare(`SELECT report_id, dispatch_id, report_json, created_at FROM reports WHERE workflow_id=? AND outcome='ask'
      AND json_extract(report_json,'$.question.kind')=? ORDER BY report_id`).all(workflowId, DRAW_REVIEW_KIND);
  } catch { return []; }
  const classified = classificationsOf(db, workflowId);
  const byRecord = new Map();
  for (const row of rows) {
    let rj = {};
    try { rj = JSON.parse(row.report_json ?? '{}') ?? {}; } catch { rj = {}; }
    const review = rj.question?.review;
    if (!review?.record) continue;
    const closed = db.prepare(`SELECT kind, payload_json, created_at FROM events WHERE workflow_id=? AND kind IN ('ask-answered','ask-superseded')
      AND json_extract(payload_json,'$.dispatchId')=? ORDER BY seq DESC LIMIT 1`).get(workflowId, row.dispatch_id);
    let answer = null;
    if (closed?.kind === 'ask-answered') {
      const payload = (() => { try { return JSON.parse(closed.payload_json ?? '{}'); } catch { return {}; } })();
      answer = (payload.receiptPath ? readJsonFile(path.isAbsolute(payload.receiptPath) ? payload.receiptPath : path.resolve(repo ?? '.', payload.receiptPath)) : null) ?? { ...payload, review };
      answer.review ??= review;
      answer.at ??= new Date(Number(closed.created_at)).toISOString();
    }
    const entry = byRecord.get(review.record) ?? { record: review.record, recordPath: review.recordPath ?? null, rounds: [] };
    const notes = answer ? notesOfReceipt(answer).map((n) => {
      const c = classified.get(n.id);
      return { id: n.id, text: n.text, shape: n.shape, part: n.part, owed: n.owed, class: c?.class ?? n.class, target: c?.target ?? n.target, classifiedBy: c?.by ?? n.classifiedBy };
    }) : [];
    entry.rounds.push({ round: entry.rounds.length + 1, dispatchId: row.dispatch_id, jobId: rj.from ?? null, askedAt: row.created_at,
      state: closed ? (closed.kind === 'ask-answered' ? 'answered' : 'superseded') : 'open',
      decision: answer ? DRAW_REVIEW_DECISIONS[Number(answer.optionIndex)] ?? null : null, answeredBy: answer?.answeredBy ?? null, answeredAt: answer?.at ?? null,
      golden: Boolean(answer && goldenMarkOf(answer)), parts: list(review.parts).map((p) => ({ path: slash(p.path), sha256: p.sha256 ?? null, shape: p.shape ?? null, breakpoint: p.breakpoint ?? null })), notes });
    byRecord.set(review.record, entry);
  }
  const out = [];
  for (const entry of byRecord.values()) {
    const dir = entry.recordPath && repo ? path.dirname(path.resolve(repo, entry.recordPath)) : null;
    let record = null;
    try { record = dir ? readYaml(path.join(dir, 'index.yaml')) : null; } catch { record = null; }
    const lastAccept = Math.max(0, ...entry.rounds.filter((r) => r.decision === 'accept' && r.answeredBy === OWNER).map((r) => r.round));
    const open = entry.rounds.filter((r) => r.round > lastAccept && r.decision === 'redraw').flatMap((r) => r.notes.filter((n) => n.owed).map((n) => ({ ...n, round: r.round, dispatchId: r.dispatchId, seen: r.parts })));
    const judged = open.map((n) => ({ ...n, ...(record && dir ? noteAddressed(dir, record, n) : { addressed: false, reasons: ['the ui record is not readable'] }) }));
    const latest = entry.rounds[entry.rounds.length - 1];
    const shapeNames = [...new Set([...(record ? reviewShapesOf(record).shapes.map((s) => s.shape) : []), ...entry.rounds.flatMap((r) => r.parts.map((p) => p.shape)).filter(Boolean)])];
    const goldenMark = record?.ui?.review?.golden ?? null;
    entry.shapes = shapeNames.map((shape) => {
      const mine = judged.filter((n) => !n.shape || stateKey(n.shape) === stateKey(shape));
      const lastRound = [...entry.rounds].reverse().find((r) => r.parts.some((p) => p.shape === shape));
      return { shape, round: lastRound?.round ?? null, parts: lastRound?.parts.filter((p) => p.shape === shape) ?? [],
        openNotes: mine.map(({ id, text: t, round, class: cls, addressed, reasons }) => ({ id, text: t, round, class: cls, addressed, reasons })),
        addressed: mine.filter((n) => n.addressed).length, unaddressed: mine.filter((n) => !n.addressed).length,
        golden: goldenMark && list(goldenMark.shapes).includes(shape) ? 'golden' : lastAccept ? 'accepted' : 'none' };
    });
    entry.awaitingOwner = latest?.state === 'open';
    entry.redrawOwed = latest?.state === 'answered' && latest.decision === 'redraw' ? { dispatchId: latest.dispatchId, jobId: latest.jobId, notes: latest.notes.map((n) => n.id) } : null;
    entry.state = entry.awaitingOwner ? 'awaiting-owner' : entry.redrawOwed ? 'redraw-owed' : lastAccept && lastAccept === latest?.round ? 'accepted' : 'idle';
    out.push(entry);
  }
  return out;
}

/** The ui record directories (work/ui-screen@1) a report's files sit in (the nearest index.yaml above each). */
function uiRecordDirsOf(repo, files) {
  const dirs = new Set();
  for (const spec of list(files)) {
    const rel = slash(String(spec ?? ''));
    const staticPart = /[*{[?]/.test(rel) ? rel.slice(0, rel.search(/[*{[?]/)).replace(/\/[^/]*$/, '') : rel;
    if (!/(^|\/)\.starciwork\//.test(staticPart) || !/(^|\/)ui(\/|$)/.test(staticPart)) continue;
    let dir = path.resolve(repo, staticPart);
    if (fs.existsSync(dir) && !fs.statSync(dir).isDirectory()) dir = path.dirname(dir);
    for (; dir.startsWith(path.resolve(repo)) && path.basename(dir) !== '.starciwork'; dir = path.dirname(dir)) {
      const index = path.join(dir, 'index.yaml');
      if (!fs.existsSync(index)) continue;
      try { if (readYaml(index)?.schema === 'work/ui-screen@1') dirs.add(dir); } catch { /* the owner-review guard names it */ }
      break;
    }
  }
  return [...dirs];
}

/**
 * What an interface.draw report owes the owner's feedback (api report): {findings}. For every ui record the report
 * reaches (an ask's question.review record, a done report's files): the newest owner redraw answer the ledger holds
 * for it (draw-redraw-owed, any workflow of this ledger) must be applied to the record (ui.review.feedback, by
 * draw-review.mjs apply), and every open note addressed (feedbackFindings). Read-only.
 */
export function reportFeedbackFindings(db, { repo, report }) {
  const dirs = new Set(uiRecordDirsOf(repo, report?.files));
  const recordPath = report?.question?.review?.recordPath;
  if (recordPath) dirs.add(path.dirname(path.resolve(repo, recordPath)));
  const findings = [];
  for (const dir of dirs) {
    let record;
    try { record = readYaml(path.join(dir, 'index.yaml')); } catch { continue; }
    if (record?.schema !== 'work/ui-screen@1') continue;
    let owed = null;
    try {
      owed = db.prepare(`SELECT payload_json FROM events WHERE kind=? AND json_extract(payload_json,'$.record')=? ORDER BY seq DESC LIMIT 1`).get(DRAW_REDRAW_OWED, record.id);
    } catch { owed = null; }
    const p = owed ? (() => { try { return JSON.parse(owed.payload_json); } catch { return null; } })() : null;
    const rounds = feedbackOf(record).rounds;
    if (p?.dispatchId && !rounds.some((r) => r.dispatchId === p.dispatchId)) {
      findings.push({ code: DRAW_FEEDBACK_UNADDRESSED, record: record.id, path: slash(path.relative(repo, dir)), note: null,
        detail: `${record.id}: the owner's redraw answer to ask ${p.dispatchId} is not applied - run draw-review.mjs apply --ui ${slash(path.relative(repo, dir))} --receipt ${p.receipt ?? '<its receipt>'} --write, then redraw against draw-feedback.mjs brief` });
      continue;
    }
    findings.push(...feedbackFindings(dir, record).map((f) => ({ ...f, path: slash(path.relative(repo, dir)) })));
  }
  return { findings };
}

// ---------------------------------------------------------------------------------------------------------
// classify (the Kernel or the critic reclassifies; structure confirms)
// ---------------------------------------------------------------------------------------------------------

export function classifyNoteInRecord(dir, { noteId, cls, target = null, as = null, by = 'kernel', write = false, knowledgeRoot = null }) {
  const file = path.join(dir, 'index.yaml');
  const record = readYaml(file);
  const workRoot = workRootOf(dir);
  const confirm = confirmClass({ cls, target, as, dnaNames: workRoot ? dnaNamesFor(workRoot) : [], knowledgeRoot });
  if (!confirm.ok) throw new Error(`${noteId}: structure does not confirm ${cls}: ${confirm.why}`);
  if (!['kernel', 'critic'].includes(by)) throw new Error('--by must be kernel or critic');
  const feedback = feedbackOf(record);
  let found = null;
  const rounds = feedback.rounds.map((r) => ({ ...r, notes: list(r.notes).map((n) => {
    if (n.id !== noteId) return n;
    found = { ...n, class: cls, classifiedBy: by, ...(target ? { target } : {}), ...(cls === 'product-direction' ? { as: as ?? 'antiPattern' } : {}) };
    if (cls !== 'product-direction') delete found.as;
    return found;
  }) }));
  if (!found) throw new Error(`${record.id} records no owner note ${noteId} (draw-review.mjs apply writes ui.review.feedback)`);
  const next = { ...record, ui: { ...record.ui, review: { ...record.ui.review, feedback: { ...feedback, rounds } } } };
  if (write) writeRecordFile(file, stringifyYaml(next, { lineWidth: 110 }));
  return { note: found, written: write };
}

function drawFeedbackMain(argv = []) {
  const [command, ...args] = argv;
  const json = args.includes('--json');
  const ui = flag(args, '--ui');
  const usage = 'Usage: node scripts/work/draw-feedback.mjs <brief|status|check|classify> --ui <ui-record-dir> [--shape <XBase#state>] [--note <id> --class <class> [--target <x>] [--as <kind>] [--by kernel|critic] --write] [--json]\n';
  if (!['brief', 'status', 'check', 'classify'].includes(command) || !ui) return { exitCode: 2, text: usage };
  try {
    const dir = path.resolve(ui);
    if (command === 'brief') {
      const b = briefBlock(dir, { shape: flag(args, '--shape') });
      return { exitCode: 0, text: json ? `${JSON.stringify(b, null, 2)}\n` : `${b.text || '(no owner notes or product rulings)'}\n` };
    }
    if (command === 'status') {
      const s = feedbackStatus(dir);
      return { exitCode: 0, text: json ? `${JSON.stringify(s, null, 2)}\n` : `${s.id}: ${s.rounds.length} review round(s); ${s.open.length} open note(s), ${s.unaddressed} unaddressed${s.golden ? '; golden' : ''}\n${s.open.map((n) => `  [${n.id}] ${n.addressed ? 'addressed' : 'UNADDRESSED'}: ${n.text}${n.addressed ? '' : ` - ${n.reasons.join('; ')}`}`).join('\n')}\n` };
    }
    if (command === 'check') {
      const f = feedbackFindings(dir);
      return { exitCode: f.length ? 1 : 0, text: json ? `${JSON.stringify({ ok: !f.length, findings: f }, null, 2)}\n` : `${f.length ? f.map((x) => `[${x.code}] ${x.detail}`).join('\n') : 'every owner note is addressed'}\n` };
    }
    const noteId = flag(args, '--note'), cls = flag(args, '--class');
    if (!noteId || !cls) return { exitCode: 2, text: usage };
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
    const r = classifyNoteInRecord(dir, { noteId, cls, target: flag(args, '--target'), as: flag(args, '--as'), by: flag(args, '--by') ?? 'kernel', write: args.includes('--write'), knowledgeRoot: root });
    return { exitCode: 0, text: json ? `${JSON.stringify(r, null, 2)}\n` : `${r.written ? 'wrote' : 'would write (pass --write)'} ${noteId} as ${r.note.class} (${r.note.classifiedBy})\n` };
  } catch (error) {
    return { exitCode: 1, text: `draw-feedback: ${error.message}\n` };
  }
}

if (isMain(import.meta.url)) {
  const result = drawFeedbackMain(process.argv.slice(2));
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
}
