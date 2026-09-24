#!/usr/bin/env node
// draw-review.mjs — the owner's review of a drawing, and what its answer writes (mia inc-a4b5b1abdd90).
//
// Defect: brand.decide a7 could not crop the greenfield lockup. layout-tree.mjs crops only from the drawing of a
// ui record in state done ("the layout drawing is accepted before its lockup is taken"), interface.draw had drawn
// ui.learning.app-layout, and nothing ever wrote it done: with candidatesPerScreen 1 interface.draw parked no
// owner ask, work-layout reserves done for the final reconciliation, and review.verify runs after a7.
//
// Owner ruling: the owner reviews only the drawn PART images (*.content.png), light theme, desktop and mobile.
// So interface.draw parks ONE draw-review ask of those parts - whatever candidatesPerScreen says - for a record
// that gates another leg (the drawing of a planned visible layout: pages under it and the brand lockup wait on
// it; a record another record dependsOn), and the owner's answer settles it:
//
//   status   --ui <ui-record-dir>                          what the record owes: {gates, parts, acceptance, owed}
//   question --ui <ui-record-dir> [--lang en|vi]          the ask's question, verbatim for the op report: kind
//                                                         draw-review, the part images as question.assets (served on
//                                                         demand through the Telegram "Generate URL" flow), and
//                                                         question.review {record, parts [{path, sha256}]}, which
//                                                         serve-ask copies into the answer receipt
//   apply    --ui <ui-record-dir> --receipt <answer.json> [--write]
//                                                         the owner's answer: accept writes the record done with
//                                                         ui.review.owner (the receipt, its digest and the parts the
//                                                         owner saw); redraw writes nothing and prints the note, the
//                                                         brief of the redraw attempt
//
// The accept answer is the owner's own: a draw-review ask carries no recommended option and is never auto-accepted
// (scripts/kernel/ask-recommendation.mjs), and a delegate cannot accept it (serve-ask.mjs). An acceptance names the
// part digests it saw; a part redrawn since makes the drawing unaccepted again (direction-part.mjs
// drawingAcceptance, read by layout-tree.mjs for the lockup crop and the planned layout's settlement).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseYaml, stringifyYaml } from '../../engine/yaml.mjs';
import { nodesOf, readShellRecord } from './layout-tree.mjs';
import { REVIEW_BREAKPOINTS, REVIEW_THEMES, ownerAcceptanceOf, reviewPartsOf } from './direction-part.mjs';

export const DRAW_REVIEW_KIND = 'draw-review';
export const DRAW_REVIEW_SCHEMA = 'starci/draw-review@1';
export const DRAW_REVIEW_OP = 'interface.draw';
/** The contract change that made a gating drawing owe its owner review (modules/kernel/contract-changes.yaml). */
export const DRAW_REVIEW_CHANGE = 'interface-draw-owner-review';
/** The two answers, in this order: 0 accepts the drawn parts, 1 asks for a redraw (the note says what to change). */
export const DRAW_REVIEW_DECISIONS = Object.freeze(['accept', 'redraw']);
const OPTIONS = {
  en: ['Accept the drawn parts', 'Redraw - say in the note what to change'],
  vi: ['Chấp nhận các phần đã vẽ', 'Vẽ lại - ghi chú rõ cần đổi gì'],
};
const OWNER = 'owner';

const list = (v) => (Array.isArray(v) ? v : []);
const slash = (p) => String(p).replace(/\\/g, '/');
const sha256Of = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const readYaml = (file) => parseYaml(fs.readFileSync(file, 'utf8'));
const flag = (args, name) => { const i = args.indexOf(name); return i >= 0 && i + 1 < args.length ? args[i + 1] : null; };

/** The ui record at `uiDir`: {dir, file, record, workRoot, repoRoot}. Throws when it is not a work/ui-screen@1 record. */
export function loadDrawing(uiDir) {
  const dir = path.resolve(uiDir);
  const file = path.join(dir, 'index.yaml');
  if (!fs.existsSync(file)) throw new Error(`${slash(dir)} holds no index.yaml`);
  const record = readYaml(file);
  if (record?.schema !== 'work/ui-screen@1') throw new Error(`${slash(file)} is ${record?.schema ?? 'not a record'}, not work/ui-screen@1`);
  let workRoot = dir;
  while (path.basename(workRoot) !== '.starciwork') {
    const up = path.dirname(workRoot);
    if (up === workRoot) throw new Error(`${slash(dir)} is not under a .starciwork Work root`);
    workRoot = up;
  }
  return { dir, file, record, workRoot, repoRoot: path.dirname(workRoot) };
}

/** Every record under features/ that dependsOn `id` (a leg waiting on this drawing through the graph). */
function dependentsOf(workRoot, id) {
  const out = [];
  const walk = (dir, depth) => {
    if (depth > 9) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (!['assets', 'evidence', 'runs', 'node_modules'].includes(e.name)) walk(full, depth + 1); continue; }
      if (e.name !== 'index.yaml') continue;
      try {
        const doc = readYaml(full);
        if (list(doc?.dependsOn).some((d) => (typeof d === 'string' ? d : d?.id) === id)) out.push(doc.id ?? slash(full));
      } catch { /* an unreadable record gates nothing here; validate reports it */ }
    }
  };
  walk(path.join(workRoot, 'features'), 0);
  return out.sort();
}

/**
 * The legs that wait on this drawing being accepted: [{kind, detail}]. A planned visible layout drawn by this
 * record (its layout.design, or a surface-layout record at a planned node) - its pages and the greenfield lockup
 * wait on it; and every record that dependsOn it.
 */
export function gatesOf({ workRoot, record }) {
  const gates = [];
  const shell = readShellRecord(workRoot);
  const tree = shell && !shell.error ? shell.record : null;
  const node = nodesOf(tree).find((n) => n.layout?.design === record.id)
    ?? (record.surface === 'layout' ? nodesOf(tree).find((n) => n.id === record.route && n.origin === 'planned') : null);
  if (node && (node.origin === 'planned' || record.surface === 'layout') && node.layout?.chrome !== 'passthrough') {
    gates.push({ kind: 'planned-layout', node: node.id, detail: `draws the planned layout ${node.id}: the pages under it wait for its settlement, and on a greenfield product brand.decide crops the lockup from it` });
  }
  const dependents = dependentsOf(workRoot, record.id);
  if (dependents.length) gates.push({ kind: 'depends-on', records: dependents, detail: `${dependents.join(', ')} dependsOn it` });
  return gates;
}

/** The review cells a drawn state still lacks (desktop and mobile, light): ["<state> <bp>/<theme>"]. */
function missingCells(parts) {
  const states = [...new Set(parts.map((p) => p.state ?? 'default'))];
  const missing = [];
  for (const state of states.length ? states : ['default']) {
    for (const bp of REVIEW_BREAKPOINTS) for (const theme of REVIEW_THEMES) {
      if (!parts.some((p) => (p.state ?? 'default') === state && p.breakpoint === bp && p.theme === theme)) missing.push(`${state} ${bp}/${theme}`);
    }
  }
  return missing;
}

/**
 * What the record owes its owner review: {id, state, gates, parts, missing, acceptance, owed, why}. `owed` is true
 * when the record gates another leg, its review parts are complete and current on disk, and no current owner
 * acceptance names them (a record another path already wrote done, with no acceptance of its own, owes nothing).
 */
export function drawReviewStatus(uiDir) {
  const drawing = loadDrawing(uiDir);
  const { dir, record } = drawing;
  const parts = reviewPartsOf(record).map((p) => {
    const file = path.join(dir, p.path);
    const onDisk = fs.existsSync(file) ? sha256Of(file) : null;
    return { ...p, onDisk: onDisk !== null, current: onDisk !== null && (!p.sha256 || onDisk === p.sha256) };
  });
  const gates = gatesOf(drawing);
  const missing = missingCells(parts);
  const acceptance = ownerAcceptanceOf(record, dir);
  let owed = false, why;
  if (!gates.length) why = 'nothing waits on this drawing: its owner review rides the normal draw rules';
  else if (acceptance?.current) why = `accepted by ${acceptance.answeredBy} in ask ${acceptance.dispatchId} at ${acceptance.at}`;
  else if (record.state === 'done' && !acceptance) why = 'already done without a draw review (another path settled it)';
  else if (!parts.length) why = 'nothing is drawn yet: draw the parts first';
  else if (missing.length) why = `the draw is incomplete: no part at ${missing.join(', ')}`;
  else if (parts.some((p) => !p.current)) why = `a part is not on disk or no longer hashes to its record: ${parts.filter((p) => !p.current).map((p) => p.path).join(', ')}`;
  else { owed = true; why = acceptance ? `the owner-accepted drawing changed since (${acceptance.reasons.join('; ')}) - review it again` : 'the owner has not reviewed the drawn parts'; }
  return { id: record.id, state: record.state ?? null, dir: slash(dir), gates, parts, missing, acceptance, owed, why };
}

/**
 * The draw-review ask's question for the op report, verbatim: {kind, text, options, refs, assets, review}.
 * It carries no recommended option - the owner reviews a drawing (never auto-accepted). The text names each
 * part's digest prefix, so a redraw asks a new question rather than repeating an answered one.
 */
export function drawReviewQuestion(uiDir, { lang = 'en' } = {}) {
  const drawing = loadDrawing(uiDir);
  const { dir, record, repoRoot } = drawing;
  const parts = reviewPartsOf(record);
  if (!parts.length) throw new Error(`${record.id} declares no drawn part (role direction-content) at desktop or mobile light - draw the parts first`);
  const missing = missingCells(parts);
  if (missing.length) throw new Error(`${record.id} has no drawn part at ${missing.join(', ')}: the owner reviews every drawn state at desktop and mobile, light`);
  const reviewed = parts.map((p) => {
    const file = path.join(dir, p.path);
    if (!fs.existsSync(file)) throw new Error(`${p.path} is not on disk`);
    const sha256 = sha256Of(file);
    if (p.sha256 && p.sha256 !== sha256) throw new Error(`${p.path} no longer hashes to its recorded sha256 - record the part as drawn first`);
    return { path: p.path, sha256, breakpoint: p.breakpoint, theme: p.theme, state: p.state };
  });
  const vi = lang === 'vi';
  const digests = reviewed.map((p) => `${p.state} ${p.breakpoint} ${p.sha256.slice(0, 8)}`).join(', ');
  const title = String(record.title ?? record.id);
  const text = vi
    ? `Xin chủ dự án duyệt các phần đã vẽ của "${title}" (${record.id}): máy tính và điện thoại, giao diện sáng. Đây là hướng thiết kế đề xuất, chưa phải ảnh sản phẩm đang chạy. Chấp nhận, hoặc yêu cầu vẽ lại và ghi rõ cần đổi gì trong ghi chú. [${digests}]`
    : `Please review the drawn parts of "${title}" (${record.id}): desktop and mobile, light theme. They are a proposed design direction, not a running product. Accept them, or ask for a redraw and say in the note what to change. [${digests}]`;
  const label = (p) => `${p.state} - ${vi ? (p.breakpoint === 'desktop' ? 'máy tính' : 'điện thoại') : p.breakpoint}`;
  return {
    kind: DRAW_REVIEW_KIND,
    text,
    options: [...(OPTIONS[lang] ?? OPTIONS.en)],
    refs: [record.id],
    assets: reviewed.map((p) => ({ path: slash(path.relative(repoRoot, path.join(dir, p.path))), label: label(p) })),
    review: { schema: DRAW_REVIEW_SCHEMA, record: record.id, recordPath: slash(path.relative(repoRoot, path.join(dir, 'index.yaml'))), parts: reviewed },
  };
}

/**
 * Apply the owner's answer to a draw-review ask. `receiptFile` is the starci/ask-answer@1 receipt serve-ask wrote
 * (packet context.owner_answers names it). Returns {decision: 'accept'|'redraw', written, record, owner?, note?}
 * and throws for a receipt that does not answer this record's review of its current parts.
 */
export function applyDrawReview(uiDir, receiptFile, { write = false, now = () => new Date().toISOString() } = {}) {
  const drawing = loadDrawing(uiDir);
  const { dir, file, record, repoRoot } = drawing;
  const receiptAbs = path.resolve(receiptFile);
  let receipt;
  try { receipt = JSON.parse(fs.readFileSync(receiptAbs, 'utf8')); } catch (error) { throw new Error(`receipt ${slash(receiptFile)} is unreadable: ${error.message}`); }
  if (receipt?.schema !== 'starci/ask-answer@1') throw new Error(`${slash(receiptFile)} is ${receipt?.schema ?? 'not a receipt'}, not starci/ask-answer@1`);
  if (receipt.opId && receipt.opId !== DRAW_REVIEW_OP) throw new Error(`the receipt answers a ${receipt.opId} ask, not ${DRAW_REVIEW_OP}`);
  const review = receipt.review;
  if (review?.schema !== DRAW_REVIEW_SCHEMA) throw new Error(`the receipt of ask ${receipt.dispatchId ?? '?'} carries no draw review (question.review): it answered another question - park the draw-review ask (draw-review.mjs question) and apply its answer`);
  if (review.record !== record.id) throw new Error(`the receipt reviews ${review.record}, not ${record.id}`);
  const decision = DRAW_REVIEW_DECISIONS[Number(receipt.optionIndex)];
  if (!decision) throw new Error(`the receipt chose option ${receipt.optionIndex ?? '(none)'}; a draw review is answered 1 (accept) or 2 (redraw)`);
  const note = typeof receipt.note === 'string' && receipt.note.trim() ? receipt.note.trim() : null;
  if (decision === 'redraw') return { decision, written: false, record: record.id, dispatchId: receipt.dispatchId ?? null, note, brief: note ?? 'the owner asked for a redraw without a note: redraw against the review findings and ask again' };
  if (receipt.answeredBy !== OWNER) throw new Error(`the drawing was accepted by ${receipt.answeredBy ?? '(unknown)'}; only the owner accepts a drawing (owner ruling: the owner reviews the drawn parts) - park the ask for the owner`);
  // The owner accepted exactly the parts the question showed; they must still be the record's current parts.
  const current = new Map(reviewPartsOf(record).map((p) => [p.path, p]));
  const problems = [];
  for (const p of list(review.parts)) {
    const f = path.join(dir, p.path ?? '');
    if (!p.path || !fs.existsSync(f)) { problems.push(`${p.path ?? '(no path)'} is not on disk`); continue; }
    if (sha256Of(f) !== p.sha256) problems.push(`${p.path} was redrawn after the owner reviewed it`);
    if (!current.has(slash(p.path))) problems.push(`${p.path} is no longer a drawn part of ${record.id}`);
  }
  const seen = new Set(list(review.parts).map((p) => slash(p.path ?? '')));
  for (const p of current.values()) if (!seen.has(p.path)) problems.push(`${p.path} (${p.breakpoint}/${p.theme}) was not in the reviewed set`);
  // A ui record reaches done only with a generated asset and a coverage map naming every state it lists
  // (modules/schemas/work-layout.yaml ui rule).
  const assets = [...list(record.assets), ...list(record.ui?.assets)];
  if (!assets.some((a) => a?.generation)) problems.push(`${record.id} has no asset carrying generation (interface.draw's ImageGen record)`);
  const covered = new Set(list(record.ui?.coverage?.map).map((m) => m?.state).filter(Boolean));
  const unmapped = list(record.ui?.states).map((s) => (typeof s === 'string' ? s : s?.name)).filter((s) => s && !covered.has(s));
  if (unmapped.length) problems.push(`ui.coverage.map names no ${unmapped.join(', ')} of ui.states`);
  if (problems.length) throw new Error(`the owner's acceptance in ask ${receipt.dispatchId ?? '?'} cannot settle ${record.id}: ${problems.join('; ')} - review the current drawing again`);
  const receiptRel = slash(path.relative(repoRoot, receiptAbs));
  const owner = {
    decision: 'accepted', dispatchId: receipt.dispatchId ?? null, receipt: receiptRel, receiptSha256: sha256Of(receiptAbs),
    answeredBy: receipt.answeredBy, at: receipt.at ?? null, appliedAt: now(), ...(note ? { note } : {}),
    parts: list(review.parts).map((p) => ({ path: slash(p.path), sha256: p.sha256, breakpoint: p.breakpoint ?? null, theme: p.theme ?? null })),
  };
  const next = {
    ...record,
    state: 'done',
    verificationSource: 'authored-claim',
    because: `The owner accepted the drawn parts (desktop and mobile, light) in draw-review ask ${owner.dispatchId} at ${owner.at} (receipt ${receiptRel}): a design direction is accepted by its owner, not proved by a run. Implementation captures and browser UAT remain separate proof.`,
    ui: { ...record.ui, status: `Owner-accepted design direction (draw-review ask ${owner.dispatchId}, ${owner.at}); implementation and real-render review remain pending.`, review: { ...(record.ui?.review ?? {}), owner } },
    ...(Number.isInteger(record.change?.rev) ? { change: { rev: record.change.rev + 1, kind: 'clarifying', at: owner.appliedAt, reason: `The owner accepted the drawn parts in draw-review ask ${owner.dispatchId}; the record is done on that acceptance.` } } : {}),
  };
  if (write) fs.writeFileSync(file, stringifyYaml(next, { lineWidth: 110 }));
  return { decision, written: write, record: record.id, file: slash(file), owner };
}

export function drawReviewMain(argv = []) {
  const [command, ...args] = argv;
  const json = args.includes('--json');
  const ui = flag(args, '--ui');
  const usage = 'Usage: node scripts/work/draw-review.mjs <status|question|apply> --ui <ui-record-dir> [--lang en|vi] [--receipt <answer.json> --write] [--json]\n';
  if (!['status', 'question', 'apply'].includes(command) || !ui) return { exitCode: 2, text: usage };
  try {
    if (command === 'status') {
      const s = drawReviewStatus(ui);
      return { exitCode: 0, text: json ? `${JSON.stringify(s, null, 2)}\n` : `${s.id} (${s.state}): ${s.owed ? 'OWNER REVIEW OWED' : 'no owner review owed'} - ${s.why}${s.gates.length ? `\n  gates: ${s.gates.map((g) => g.detail).join(' | ')}` : ''}\n` };
    }
    if (command === 'question') {
      const q = drawReviewQuestion(ui, { lang: flag(args, '--lang') ?? 'en' });
      return { exitCode: 0, text: `${JSON.stringify(q, null, 2)}\n` };
    }
    const receipt = flag(args, '--receipt');
    if (!receipt) return { exitCode: 2, text: usage };
    const r = applyDrawReview(ui, receipt, { write: args.includes('--write') });
    const text = r.decision === 'redraw'
      ? `the owner asked for a redraw of ${r.record} (ask ${r.dispatchId}); nothing written. Redraw brief: ${r.brief}`
      : `${r.written ? 'wrote' : 'would write (dry run - pass --write)'} ${r.record} done: accepted by ${r.owner.answeredBy} in ask ${r.owner.dispatchId} (receipt ${r.owner.receipt})`;
    return { exitCode: 0, text: json ? `${JSON.stringify(r, null, 2)}\n` : `${text}\n` };
  } catch (error) {
    return { exitCode: 1, text: `draw-review: ${error.message}\n` };
  }
}

/**
 * The ui records a done interface.draw report wrote that still owe their owner review: [{id, dir, why, gates}].
 * `files` are the report's files (repo-relative paths or globs). Read-only; an unreadable record is skipped.
 */
export function drawReviewsOwed(repo, files) {
  const dirs = new Set();
  const add = (start) => {
    let dir = start;
    for (let i = 0; i < 8; i += 1) {
      const index = path.join(dir, 'index.yaml');
      if (fs.existsSync(index)) {
        try { if (readYaml(index)?.schema === 'work/ui-screen@1') { dirs.add(dir); return; } } catch { return; }
      }
      if (path.basename(dir) === '.starciwork') return;
      const up = path.dirname(dir);
      if (up === dir) return;
      dir = up;
    }
  };
  for (const spec of list(files)) {
    const rel = slash(spec);
    const staticPart = /[*{[?]/.test(rel) ? rel.slice(0, rel.search(/[*{[?]/)).replace(/\/[^/]*$/, '') : rel;
    if (!/(^|\/)ui(\/|$)/.test(staticPart)) continue;
    const abs = path.resolve(repo, staticPart);
    if (!fs.existsSync(abs)) continue;
    if (!fs.statSync(abs).isDirectory()) { add(path.dirname(abs)); continue; }
    // A directory (a glob's static prefix): the ui record it sits in, else every ui record below it.
    add(abs);
    const down = (dir, depth) => {
      if (depth > 5) return;
      let entries = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        if (!e.isDirectory() || ['assets', 'evidence', 'runs', 'node_modules'].includes(e.name)) continue;
        const sub = path.join(dir, e.name);
        const index = path.join(sub, 'index.yaml');
        try { if (fs.existsSync(index) && readYaml(index)?.schema === 'work/ui-screen@1') dirs.add(sub); } catch { /* validate reports it */ }
        down(sub, depth + 1);
      }
    };
    down(abs, 0);
  }
  const owed = [];
  for (const dir of dirs) {
    try { const s = drawReviewStatus(dir); if (s.owed) owed.push({ id: s.id, dir: slash(path.relative(repo, dir)), why: s.why, gates: s.gates.map((g) => g.kind) }); } catch { /* validate reports it */ }
  }
  return owed;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = drawReviewMain(process.argv.slice(2));
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
}
