#!/usr/bin/env node
// brand-direction.mjs — the owner's review of one archetype of brand.direction, and what its answer writes.
//
// Owner ruling 2026-09-27: a drawing must be beautiful at enterprise level, not merely correct, so the product's
// composition taste lives in its brand record as `brand.direction` (work/brand@1 $defs.direction), written by
// brand.decide in its direction mode (param directionArchetype) and accepted by the owner ONE archetype at a time,
// the way a drawing is accepted (scripts/work/draw-review.mjs) - but never automatically: the question carries
// `question.review`, which ask-recommendation.mjs autoAcceptDecision never answers, and apply refuses any answer
// the owner did not give.
//
//   status   --work <tree>                              {rev, status, archetypes: {<name>: status}, ready, missing}
//   question --work <tree> --archetype <name> [--lang en|vi]
//                                                       the ask's question, verbatim for the op report: kind
//                                                       brand-direction-review, the archetype's golden PNGs as
//                                                       question.assets, and question.review {schema, record,
//                                                       recordPath, directionRev, archetype, golden [{png, sha256}]},
//                                                       which serve-ask copies into the answer receipt
//   apply    --work <tree> --receipt <answer.json> [--write]
//                                                       accept writes archetypes.<name>.status accepted with its
//                                                       acceptance {acceptedBy, receipt, acceptedAt, rev} (and the
//                                                       direction itself when it was still proposed); revise writes
//                                                       nothing and prints the owner's note as the brief
//
// Lane contract (interface.draw reads it; do not rename): the direction is `brand.direction` in
// .starciwork/brand/index.yaml; `brand.direction.archetypes.<name>.status: accepted` means the archetype is ready;
// the rubric is `brand.direction.rubric.checks`; the reference renders are `brand.direction.golden`.
// scripts/checks/brand.mjs `direction` re-checks every acceptance against the owner receipt on disk.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringifyYaml } from '../../engine/yaml.mjs';
import {
  DIRECTION_ARCHETYPES, DIRECTION_DECISIONS, DIRECTION_REVIEW_KIND, DIRECTION_REVIEW_SCHEMA, OWNER_ANSWER_SCHEMA, readBrandRecord,
} from '../checks/brand.mjs';
import { flag, sha256File, slash, writeRecordFile } from './work-io.mjs';

const OWNER = 'owner';
const OPTIONS = {
  en: ['Accept this archetype of the direction', 'Revise - say in the note what to change'],
  vi: ['Chấp nhận hướng thiết kế cho loại trang này', 'Sửa lại - ghi chú rõ cần đổi gì'],
};

/** The brand record with its direction, and the repository root receipt paths are relative to. */
function loadDirection(work) {
  const brand = readBrandRecord(work);
  const direction = brand.brand.direction;
  if (!direction || typeof direction !== 'object') throw new Error(`${slash(brand.file)} carries no brand.direction - run brand.decide in its direction mode first`);
  const workRoot = path.dirname(brand.dir);
  const repoRoot = path.basename(workRoot) === '.starciwork' ? path.dirname(workRoot) : workRoot;
  return { ...brand, direction, repoRoot };
}

const archetypesOf = (direction) => (direction.archetypes && typeof direction.archetypes === 'object' ? direction.archetypes : {});
const goldenOf = (direction, name) => (Array.isArray(direction.golden) ? direction.golden : []).filter((g) => g?.archetype === name);

/** What the direction holds and which archetypes interface.draw may draw from. */
export function directionStatus(work) {
  const { direction } = loadDirection(work);
  const archetypes = Object.fromEntries(Object.entries(archetypesOf(direction)).map(([name, a]) => [name, a?.status ?? null]));
  const ready = Object.entries(archetypes).filter(([, status]) => status === 'accepted').map(([name]) => name);
  return { rev: direction.rev ?? null, status: direction.status ?? null, archetypes, ready, missing: DIRECTION_ARCHETYPES.filter((name) => !(name in archetypes)) };
}

/** The golden renders of one archetype, re-hashed: each must still be the bytes the record declares. */
function reviewedGolden(loaded, name) {
  const golden = goldenOf(loaded.direction, name);
  if (!golden.length) throw new Error(`archetype ${name} has no golden render in brand.direction.golden - render it before asking the owner`);
  return golden.map((g) => {
    const file = path.resolve(loaded.dir, String(g.png ?? ''));
    if (!g.png || !fs.existsSync(file)) throw new Error(`golden ${g.png ?? '(none)'} is not on disk`);
    const sha256 = sha256File(file);
    if (g.sha256 !== sha256) throw new Error(`golden ${g.png} no longer hashes to its recorded sha256 - record it as rendered first`);
    return { png: slash(g.png), sha256, ...(g.html ? { html: slash(g.html) } : {}), ...(g.breakpoint ? { breakpoint: g.breakpoint } : {}) };
  });
}

/**
 * The brand-direction-review ask for one archetype: {kind, text, options, refs, assets, review}. It carries no
 * recommended option and carries question.review, so it is never answered automatically.
 */
export function directionReviewQuestion(work, { archetype, lang = 'en' } = {}) {
  const loaded = loadDirection(work);
  const { direction, repoRoot } = loaded;
  if (!DIRECTION_ARCHETYPES.includes(archetype)) throw new Error(`--archetype must be one of ${DIRECTION_ARCHETYPES.join(', ')}`);
  const entry = archetypesOf(direction)[archetype];
  if (!entry) throw new Error(`brand.direction declares no ${archetype} archetype - brand.decide writes it (directionArchetype ${archetype}) before the owner is asked`);
  const golden = reviewedGolden(loaded, archetype);
  const vi = lang === 'vi';
  const digests = golden.map((g) => `${g.breakpoint ?? path.basename(g.png)} ${g.sha256.slice(0, 8)}`).join(', ');
  const pending = (Array.isArray(direction.pendingRulings) ? direction.pendingRulings : []).filter((r) => r?.status !== 'ruled').map((r) => r.question);
  const pendingLine = !pending.length ? '' : vi ? ` Câu hỏi còn mở (chưa áp dụng): ${pending.join(' | ')}.` : ` Open owner questions (not applied): ${pending.join(' | ')}.`;
  const text = vi
    ? `Xin chủ dự án duyệt hướng thiết kế (brand.direction rev ${direction.rev}) cho loại trang "${archetype}": thứ tự vùng, lưới, điểm nhấn, vị trí hành động chính và các ảnh tham chiếu. Chấp nhận, hoặc yêu cầu sửa và ghi rõ cần đổi gì.${pendingLine} [${digests}]`
    : `Please review the design direction (brand.direction rev ${direction.rev}) for the "${archetype}" page archetype: region order, grids, emphasis, primary-action placement and the reference renders. Accept it, or ask for a revision and say in the note what to change.${pendingLine} [${digests}]`;
  return {
    kind: DIRECTION_REVIEW_KIND,
    text,
    options: [...(OPTIONS[lang] ?? OPTIONS.en)],
    refs: ['brand'],
    assets: golden.map((g) => ({ path: slash(path.relative(repoRoot, path.resolve(loaded.dir, g.png))), label: `${archetype}${g.breakpoint ? ` - ${g.breakpoint}` : ''}` })),
    review: { schema: DIRECTION_REVIEW_SCHEMA, record: 'brand', recordPath: slash(path.relative(repoRoot, loaded.file)), directionRev: direction.rev, archetype, golden },
  };
}

/**
 * Apply the owner's answer to a brand-direction-review ask. Returns {decision, written, archetype, acceptance?, note?}
 * and throws for a receipt that is not the owner's answer to this direction rev and these golden bytes.
 */
export function applyDirectionReview(work, receiptFile, { write = false } = {}) {
  const loaded = loadDirection(work);
  const { direction, repoRoot, record, file } = loaded;
  const receiptAbs = path.resolve(receiptFile);
  const receiptRel = slash(path.relative(repoRoot, receiptAbs));
  if (receiptRel.startsWith('../') || path.isAbsolute(receiptRel)) throw new Error(`receipt ${slash(receiptFile)} is outside the repository ${slash(repoRoot)}; apply the receipt serve-ask wrote under .starciwork/kernel-evidence`);
  let receipt;
  try { receipt = JSON.parse(fs.readFileSync(receiptAbs, 'utf8')); } catch (error) { throw new Error(`receipt ${slash(receiptFile)} is unreadable: ${error.message}`); }
  if (receipt?.schema !== OWNER_ANSWER_SCHEMA) throw new Error(`${slash(receiptFile)} is ${receipt?.schema ?? 'not a receipt'}, not ${OWNER_ANSWER_SCHEMA}`);
  const review = receipt.review;
  if (review?.schema !== DIRECTION_REVIEW_SCHEMA) throw new Error(`the receipt of ask ${receipt.dispatchId ?? '?'} carries no direction review (question.review): park the brand-direction-review ask (brand-direction.mjs question) and apply its answer`);
  const archetype = review.archetype;
  const entry = archetypesOf(direction)[archetype];
  if (!entry) throw new Error(`the receipt reviews archetype ${archetype ?? '(none)'}, which brand.direction does not declare`);
  if (review.directionRev !== direction.rev) throw new Error(`the owner reviewed direction rev ${review.directionRev}, the record is rev ${direction.rev} - ask again`);
  const decision = DIRECTION_DECISIONS[Number(receipt.optionIndex)];
  if (!decision) throw new Error(`the receipt chose option ${receipt.optionIndex ?? '(none)'}; a direction review is answered 1 (accept) or 2 (revise)`);
  const note = typeof receipt.note === 'string' && receipt.note.trim() ? receipt.note.trim() : null;
  if (decision === 'revise') return { decision, written: false, archetype, dispatchId: receipt.dispatchId ?? null, note, brief: note ?? 'the owner asked for a revision without a note: revise against the rubric and ask again' };
  if (receipt.answeredBy !== OWNER) throw new Error(`the direction was accepted by ${receipt.answeredBy ?? '(unknown)'}; only the owner accepts a brand direction - never an auto-recommended answer or a delegate`);
  const current = new Map(reviewedGolden(loaded, archetype).map((g) => [g.png, g.sha256]));
  const seen = new Map((Array.isArray(review.golden) ? review.golden : []).map((g) => [slash(String(g?.png ?? '')), g?.sha256]));
  const problems = [...current].filter(([png, sha]) => seen.get(png) !== sha).map(([png]) => `${png} changed or was not shown to the owner`);
  if (problems.length) throw new Error(`the owner's acceptance in ask ${receipt.dispatchId ?? '?'} cannot settle ${archetype}: ${problems.join('; ')} - ask again`);
  const acceptedAt = typeof receipt.at === 'string' && /Z$/.test(receipt.at) ? receipt.at : new Date().toISOString();
  const acceptance = { acceptedBy: receipt.dispatchId, receipt: receiptRel, acceptedAt, rev: direction.rev };
  const nextDirection = {
    ...direction,
    ...(direction.status === 'accepted' && direction.acceptance?.rev === direction.rev ? {} : { status: 'accepted', acceptance }),
    archetypes: { ...archetypesOf(direction), [archetype]: { ...entry, status: 'accepted', acceptance } },
  };
  const next = { ...record, brand: { ...record.brand, direction: nextDirection } };
  if (write) writeRecordFile(file, stringifyYaml(next, { lineWidth: 110 }));
  return { decision, written: write, archetype, file: slash(file), acceptance };
}

export function brandDirectionMain(argv = []) {
  const [command, ...args] = argv;
  const json = args.includes('--json');
  const work = flag(args, '--work');
  const usage = 'Usage: node scripts/work/brand-direction.mjs <status|question|apply> --work <tree> [--archetype <name>] [--lang en|vi] [--receipt <answer.json> --write] [--json]\n';
  if (!['status', 'question', 'apply'].includes(command) || !work) return { exitCode: 2, text: usage };
  try {
    if (command === 'status') {
      const s = directionStatus(work);
      return { exitCode: 0, text: json ? `${JSON.stringify(s, null, 2)}\n` : `brand.direction rev ${s.rev} (${s.status}): ready ${s.ready.join(', ') || 'none'}; missing ${s.missing.join(', ') || 'none'}\n` };
    }
    if (command === 'question') {
      const archetype = flag(args, '--archetype');
      if (!archetype) return { exitCode: 2, text: usage };
      return { exitCode: 0, text: `${JSON.stringify(directionReviewQuestion(work, { archetype, lang: flag(args, '--lang') ?? 'en' }), null, 2)}\n` };
    }
    const receipt = flag(args, '--receipt');
    if (!receipt) return { exitCode: 2, text: usage };
    const r = applyDirectionReview(work, receipt, { write: args.includes('--write') });
    const text = r.decision === 'revise'
      ? `the owner asked for a revision of ${r.archetype} (ask ${r.dispatchId}); nothing written. Brief: ${r.brief}`
      : `${r.written ? 'wrote' : 'would write (dry run - pass --write)'} brand.direction.archetypes.${r.archetype} accepted in ask ${r.acceptance.acceptedBy} (receipt ${r.acceptance.receipt})`;
    return { exitCode: 0, text: json ? `${JSON.stringify(r, null, 2)}\n` : `${text}\n` };
  } catch (error) {
    return { exitCode: 1, text: `brand-direction: ${error.message}\n` };
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { exitCode, text } = brandDirectionMain(process.argv.slice(2));
  (exitCode ? process.stderr : process.stdout).write(text);
  process.exitCode = exitCode;
}
