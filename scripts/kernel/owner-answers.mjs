// owner-answers.mjs — the owner answers a job's retry lineage already holds.
//
// Defect (starci-next wf-starci-next-work-and-stacks-mud4qamv): ordinal 1 of
// business.decide asked the owner (ctx_3074731253e3); config.yaml
// asks.autoAcceptRecommended answered it (answeredBy auto-recommended), and the
// owner-answer retry (attempt 12, op-business.decide-7f71843aaa) filed the SAME
// question again (ctx_cc73a111de44). Its packet carried no record of the
// answered ask: "re-enqueue with the answer bound" was left to the Kernel's free
// text. The same shape hit mia-mia architecture.decide (inc-614950d297bb).
//
// Now dispatch binds the answers into the packet (context.owner_answers) and the
// op prompt, and `api report` refuses an ask that repeats one of them
// (modules/kernel/api.yaml commands.dispatch ownerAnswers, commands.report
// refuses ask-already-answered; modules/kernel/dispatch.yaml packet).
//
// The lineage is the chain payload.retry.retryOf (or resumeOf) that enqueue
// writes (engine/admission.mjs deriveRetryLineage; for a cut, its own ordinal
// only). Every ask report of a lineage attempt that holds an `ask-answered`
// event is an answer. Ledger reads plus the answer receipt file; never writes.
import fs from 'node:fs';
import { HANDOVER_OP } from './handover.mjs';
import { sameWorkLineage } from '../../engine/admission.mjs';
import { parseJson } from '../lib/json.mjs';

const parse = (text, fallback = {}) => parseJson(text) ?? fallback;
const payloadOf = (row) => parse(row?.payload_json ?? '{}');
const labelOf = (option) => (typeof option === 'string' ? option : option?.label ?? option?.id ?? '');
const LINEAGE_LIMIT = 64;

/** The earlier jobs of `job`'s retry lineage, newest first, following payload.retry.retryOf|resumeOf. */
export function lineageJobsOf(db, job) {
  const out = [], seen = new Set([job?.job_id]);
  let id = payloadOf(job).retry?.retryOf ?? payloadOf(job).retry?.resumeOf ?? null;
  while (id && !seen.has(id) && out.length < LINEAGE_LIMIT) {
    seen.add(id);
    const row = db.prepare('SELECT * FROM jobs WHERE job_id=? AND workflow_id=?').get(id, job.workflow_id);
    if (!row) break;
    out.push(row);
    const retry = payloadOf(row).retry;
    id = retry?.retryOf ?? retry?.resumeOf ?? null;
  }
  return out;
}

const readReceipt = (file) => {
  if (typeof file !== 'string' || !file) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
};

/**
 * The answered asks of `job`'s retry lineage, oldest first:
 * [{dispatchId, jobId, attempt, question, options[], chosen:{index,label}|null, picks, note,
 *   answeredBy, answeredAt, receipt}]. `question`/`options` are the ask report's; `chosen` comes from
 * the ask-answered event, else its starci/ask-answer@1 receipt. An unanswered or superseded ask is
 * not an answer, and an attempt about another params.subject is not this job's. A job with no
 * lineage (a first attempt) has none.
 */
export function ownerAnswersOf(db, job) {
  const answers = [];
  // One op may ask about several subjects at once (provision.ask params.subject, serve-ask.mjs
  // askSubjectOf): an uncut lineage chains to the op's latest attempt, which can be another subject's.
  const subjectOf = (row) => { const s = payloadOf(row).params?.subject; return typeof s === 'string' && s.trim() ? s.trim() : null; };
  const subject = subjectOf(job);
  const uncut = !payloadOf(job).cut;
  for (const row of lineageJobsOf(db, job).reverse()) {
    if (subject && subjectOf(row) && subjectOf(row) !== subject) continue;
    // A lineage row of another unit of work (a chain an older enqueue mislinked) holds none of this
    // job's answers (mia inc-bca4d2034f8c: 8 answers of unrelated records rode a new record's packet).
    if (uncut && !sameWorkLineage(row, job)) continue;
    const op = row.op_id ?? payloadOf(row).opId ?? null;
    const reports = db.prepare("SELECT dispatch_id, report_json, created_at FROM reports WHERE workflow_id=? AND op_id IS ? AND attempt=? AND outcome='ask' ORDER BY report_id")
      .all(row.workflow_id, op, row.attempt)
      .filter((report) => { const from = parse(report.report_json).from; return !from || from === row.job_id; });
    for (const report of reports) {
      if (answers.some((a) => a.dispatchId === report.dispatch_id)) continue;
      const event = db.prepare("SELECT payload_json, created_at FROM events WHERE workflow_id=? AND kind='ask-answered' AND json_extract(payload_json,'$.dispatchId')=? ORDER BY seq DESC LIMIT 1")
        .get(row.workflow_id, report.dispatch_id);
      if (!event) continue;
      const answered = parse(event.payload_json);
      const receipt = readReceipt(answered.receiptPath);
      const question = parse(report.report_json).question ?? {};
      const options = (Array.isArray(question.options) ? question.options : []).map(labelOf).map(String);
      const rawIndex = answered.optionIndex ?? receipt?.optionIndex ?? null;
      const index = Number.isInteger(Number(rawIndex)) && rawIndex !== null && rawIndex !== '' ? Number(rawIndex) : null;
      const label = answered.option ?? receipt?.option ?? (index != null ? options[index] ?? null : null);
      answers.push({
        dispatchId: report.dispatch_id, jobId: row.job_id, attempt: row.attempt,
        question: String(question.text ?? ''), options,
        chosen: index != null || label != null ? { index, label: label ?? null } : null,
        ...(receipt?.picks ? { picks: receipt.picks } : {}),
        ...(answered.note ?? receipt?.note ? { note: answered.note ?? receipt.note } : {}),
        answeredBy: answered.answeredBy ?? receipt?.answeredBy ?? 'owner',
        answeredAt: receipt?.at ?? new Date(event.created_at).toISOString(),
        receipt: answered.receiptPath ?? null,
      });
    }
  }
  return answers;
}

const norm = (text) => String(text ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').replace(/[\s.?!:;,]+$/, '').trim();

/**
 * The answered ask `question` repeats, or null. It repeats one when its text is the same (case,
 * spacing and trailing punctuation aside) or when it offers the same two or more options. A
 * handover.review ask never repeats: each round asks the owner to approve a new package with the
 * same three options (handover.mjs), so its earlier answers ride in the packet only.
 */
export function repeatedAnswerOf(question, answers, { op = null } = {}) {
  if (!question || !Array.isArray(answers) || !answers.length || op === HANDOVER_OP) return null;
  const text = norm(question.text);
  // A draw review always offers the same two options (accept, redraw) and names the part digests in its text:
  // a redrawn drawing is a new question, so only the same text repeats one (scripts/work/draw-review.mjs).
  if (question.kind === 'draw-review') return answers.find((answer) => text && norm(answer.question) === text) ?? null;
  const options = (Array.isArray(question.options) ? question.options : []).map((o) => norm(labelOf(o))).filter(Boolean).sort();
  return answers.find((answer) => {
    if (text && norm(answer.question) === text) return true;
    if (options.length < 2) return false;
    const prior = answer.options.map(norm).filter(Boolean).sort();
    return prior.length === options.length && prior.every((o, i) => o === options[i]);
  }) ?? null;
}

/** One prompt line per answer: what was asked, what was chosen, by whom, and where the receipt is. */
export const ownerAnswerLine = (a) => `  - [${a.dispatchId}, attempt ${a.attempt}] "${a.question.replace(/\s+/g, ' ').slice(0, 300)}"`
  + ` -> ${a.chosen ? `option ${a.chosen.index != null ? a.chosen.index + 1 : '?'}${a.chosen.label ? ` "${String(a.chosen.label).replace(/\s+/g, ' ').slice(0, 200)}"` : ''}` : 'answered (see receipt)'}`
  + `${a.picks ? ` picks ${JSON.stringify(a.picks)}` : ''}${a.note ? ` note "${String(a.note).replace(/\s+/g, ' ').slice(0, 200)}"` : ''}`
  + ` (answeredBy ${a.answeredBy} at ${a.answeredAt}${a.receipt ? `; receipt ${a.receipt}` : ''})`;
