// owner-answers.mjs — the owner answers a job's retry lineage already holds.
//
// Defect: ordinal 1 of a business.decide asked the owner; config.yaml
// asks.autoAcceptRecommended answered it (answeredBy auto-recommended), and the
// owner-answer retry (attempt 12) filed the SAME
// question again. Its packet carried no record of the
// answered ask: "re-enqueue with the answer bound" was left to the Kernel's free
// text. The same shape hit another product's architecture.decide.
//
// Now dispatch binds the answers into the packet (context.owner_answers) and the
// op prompt, and `starci kernel report` refuses an ask that repeats one of them
// (modules/kernel/api.yaml commands.dispatch ownerAnswers, commands.report
// refuses ask-already-answered; modules/kernel/dispatch.yaml packet).
//
// An answer binds to the work unit it answers (H4; scripts/kernel/units.mjs): every ask report of an
// earlier try of the SAME unit that holds an `ask-answered` event is an answer - never one of another
// unit, however the retry chain was spelled. Ledger reads plus the answer receipt file; never writes.
import { KERNEL_ONLY_OPS } from './reported-jobs.mjs';
import { parseJsonOr, readJsonFile } from '../lib/json.mjs';
import { normalizeText } from '../lib/normalize.mjs';
import { JOB_ROW } from './job-row.mjs';

const parse = parseJsonOr;
const labelOf = (option) => (typeof option === 'string' ? option : option?.label ?? option?.id ?? '');
const LINEAGE_LIMIT = 64;

/**
 * The earlier jobs of `job`'s retry lineage, newest first, following the jobs.retry_of | resume_of columns. Rows are
 * JOB_ROW projections (`attempt` = try_no, `result_json` = the settle result). A `job` without those columns (a partial
 * object) is read back by its id first.
 */
export function lineageJobsOf(db, job) {
  const out = [], seen = new Set([job?.job_id]);
  let start = null;
  if (job && ('retry_of' in job || 'resume_of' in job)) start = job;
  else if (job?.job_id) start = db.prepare('SELECT retry_of, resume_of FROM jobs WHERE job_id=?').get(job.job_id);
  let id = start?.retry_of ?? start?.resume_of ?? null;
  while (id && !seen.has(id) && out.length < LINEAGE_LIMIT) {
    seen.add(id);
    const row = db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE job_id=? AND workflow_id=?`).get(id, job.workflow_id);
    if (!row) break;
    out.push(row);
    id = row.retry_of ?? row.resume_of ?? null;
  }
  return out;
}

const readReceipt = readJsonFile;

/**
 * The answered asks of `job`'s work unit (its earlier tries), oldest first:
 * [{dispatchId, jobId, attempt, question, options[], chosen:{index,label}|null, picks, note,
 *   answeredBy, answeredAt, receipt}]. `question`/`options` are the ask report's; `chosen` comes from
 * the ask-answered event, else its starci/ask-answer@1 receipt. An unanswered or superseded ask is
 * not an answer. A first try (no earlier try of its unit) has none.
 */
export function ownerAnswersOf(db, job) {
  const answers = [];
  const unitId = job?.unit_id ?? null;
  const tries = unitId ? db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE workflow_id=? AND job_id<>? AND unit_id=? ORDER BY try_no`).all(job.workflow_id, job.job_id, unitId) : [];
  for (const row of tries) {
    const reports = db.prepare("SELECT dispatch_id, report_json, created_at FROM reports WHERE job_id=? AND outcome='ask' ORDER BY report_id")
      .all(row.job_id)
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

const norm = (text) => normalizeText(text, { form: 'NFKC', punct: true });

/**
 * The answered ask `question` repeats, or null. It repeats one when its text is the same (case,
 * spacing and trailing punctuation aside) or when it offers the same two or more options. A
 * handover.review ask (reported-jobs.mjs KERNEL_ONLY_OPS) never repeats: each round asks the owner
 * to approve a new package with the same three options (handover.mjs), so its earlier answers ride
 * in the packet only.
 */
export function repeatedAnswerOf(question, answers, { op = null } = {}) {
  if (!question || !Array.isArray(answers) || !answers.length || KERNEL_ONLY_OPS.includes(op)) return null;
  const text = norm(question.text);
  // A draw review always offers the same two options (accept, redraw) and names the part digests in its text:
  // a redrawn drawing is a new question, so only the same text repeats one (scripts/work/draw-review.mjs).
  // A brand-direction review is the same shape: its text names the rev and the golden digests (brand-direction.mjs).
  if (question.kind === 'draw-review' || question.kind === 'brand-direction-review') return answers.find((answer) => text && norm(answer.question) === text) ?? null;
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
