import { lineageJobsOf, ownerAnswersOf } from '../machine/owner-answers.mjs';
import { retryDisposition, sameUnit } from '../../engine/admission.mjs';
import { parseJsonOr, readJsonFile } from '../lib/json.mjs';

export const DRAW_REVIEW_KIND = 'draw-review';
export const DRAW_REVIEW_DECISIONS = Object.freeze(['accept', 'redraw']);
const OWNER = 'owner';
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

function chosenOptionOf(chosen) {
  if (chosen.index != null) { return chosen.index + 1; }
  return chosen.label;
}

function ownerAnswerRulingOf(db, row, answers) {
  for (const answer of answers.filter((item) => item.jobId === row.job_id).reverse()) {
    if (answer.answeredBy !== OWNER) { continue; }
    const plainAccept = askKindIn(db, row.workflow_id, answer.dispatchId) === DRAW_REVIEW_KIND && answer.chosen?.index === 0 && !answer.note;
    if (plainAccept) { return null; }
    const option = answer.chosen ? ', option ' + chosenOptionOf(answer.chosen) : '';
    return `the owner answered ask ${answer.dispatchId} of ${row.job_id}'s lineage (attempt ${answer.attempt}${option}${answer.note ? ', with a note' : ''})`;
  }
  return undefined;
}

function ownerRetryRulingOf(db, row, successor) {
  const waited = parseJsonOr(row.result_json).askDispatchId;
  const ownerAnswerRetry = successor && (parseJsonOr(successor.payload_json).retry?.retryClass === OWNER_ANSWER_RETRY || retryDisposition(row).retryClass === OWNER_ANSWER_RETRY);
  if (!ownerAnswerRetry || !waited) { return undefined; }
  const closed = closingOf(db, row.workflow_id, waited);
  const how = parseJsonOr(closed?.payload_json);
  if (!closed) { return `${successor.job_id} is an owner-answer retry of ${row.job_id}, whose ask ${waited} still waits on the owner`; }
  if (closed.kind === 'ask-superseded' && how.retired) { return `${successor.job_id} is an owner-answer retry of ${row.job_id}, whose ask ${waited} was retired for it`; }
  return undefined;
}

function jobOwnerRulingOf(db, job) {
  const chain = [job, ...lineageJobsOf(db, job)].filter((row) => row === job || sameUnit(row, job));
  const answers = ownerAnswersOf(db, job);
  for (let index = 0; index < chain.length; index += 1) {
    const row = chain[index], payload = parseJsonOr(row.payload_json);
    const rulings = payload.params?.ownerRulings;
    if (typeof rulings === 'string' && rulings.trim()) { return `job ${row.job_id} carries the owner's rulings (params.ownerRulings)`; }
    const answerRuling = ownerAnswerRulingOf(db, row, answers);
    if (answerRuling !== undefined) { return answerRuling; }
    const retryRuling = ownerRetryRulingOf(db, row, chain[index - 1]);
    if (retryRuling !== undefined) { return retryRuling; }
  }
  return undefined;
}

function recordOwnerRulingOf(db, record, beforeReportId) {
  const earlier = db.prepare(
    `SELECT r.workflow_id, r.dispatch_id, e.payload_json FROM reports r
       JOIN events e ON e.workflow_id=r.workflow_id AND e.kind='ask-answered' AND json_extract(e.payload_json,'$.dispatchId')=r.dispatch_id
      WHERE r.outcome='ask' AND (? IS NULL OR r.report_id < ?) AND json_extract(r.report_json,'$.question.kind')=?
        AND json_extract(r.report_json,'$.question.review.record')=?
      ORDER BY r.report_id DESC`,
  ).all(beforeReportId, beforeReportId, DRAW_REVIEW_KIND, record);
  for (const row of earlier) {
    const answer = parseJsonOr(row.payload_json);
    if ((answer.answeredBy ?? OWNER) !== OWNER) { continue; }
    const note = noteOf(answer);
    const redraw = DRAW_REVIEW_DECISIONS[Number(answer.optionIndex)] === 'redraw';
    if (!redraw && !note) { return null; }
    return `the owner ${redraw ? 'asked for a redraw of' : 'left feedback on'} ${record} in draw-review ask ${row.dispatch_id} (${row.workflow_id})`;
  }
  return null;
}

export function drawOwnerRulingOf(db, { job = null, record = null, beforeReportId = null } = {}) {
  if (job) {
    const jobRuling = jobOwnerRulingOf(db, job);
    if (jobRuling !== undefined) { return jobRuling; }
  }
  if (!record) { return null; }
  return recordOwnerRulingOf(db, record, beforeReportId);
}
