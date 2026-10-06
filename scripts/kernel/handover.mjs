// handover.mjs — the owner handover gate (modules/ops/ops/handover.review.yaml).
//
// A workflow is done only when the owner approves its handover. The last leg of
// every chain, handover.review, files one `ask` whose three options are, in
// order, approve / feedback / question (HANDOVER_DECISIONS). serve-ask records
// the answer receipt; this module reads it back:
//
//   handoverAskProblem  the ask a handover.review report must carry (starci kernel report)
//   handoverApprovalOf  whether the latest handover ask was approved by the owner
//                       and still covers every business settle (starci kernel settle pass)
//   handoverGateOf      whether `starci kernel finish` may close the workflow
//   handoverProjection  the `handover` block of starci kernel status and its frontier state
//   deliveriesOf        what the handover package is assembled from (starci kernel survey
//                       --deliveries, readable from an op terminal)
//
// A receipt whose answeredBy is not the owner never approves: owner delegation
// (config.yaml delegation) answers feedback and questions, never the handover.
// Reads only; every write stays in cli.mjs.
import { JOB_STATUSES } from '../../engine/db/ledger.mjs';
import { parseJson, readJsonFile } from '../lib/json.mjs';
import { jobResultSql } from '../machine/job-row.mjs';
import { latestReportOf } from './verbs/shared/rows.mjs';

export const HANDOVER_OP = 'handover.review';
export const HANDOVER_DECISIONS = Object.freeze(['approve', 'feedback', 'question']);
export const HANDOVER_APPROVED = 'handover-approved';
export const OWNER = 'owner';

const SETTLED = new Set(JOB_STATUSES.settled);
const optionLabel = (option) => (typeof option === 'string' ? option : option?.label ?? null);

/** Why a handover ask is malformed, or null. Exactly three distinct options in
 *  the order approve, feedback, question; no pick groups beside them. */
export function handoverAskProblem(question) {
  if (!question || typeof question !== 'object') return 'a handover ask needs question {text, options}';
  const options = Array.isArray(question.options) ? question.options : null;
  if (options?.length !== HANDOVER_DECISIONS.length) {
    return `a handover ask carries exactly ${HANDOVER_DECISIONS.length} options, in the order ${HANDOVER_DECISIONS.join(', ')}; got ${options ? options.length : 'none'}`;
  }
  const labels = options.map((option) => String(optionLabel(option) ?? '').trim());
  if (labels.some((label) => !label)) return 'every handover option needs a non-empty label';
  if (new Set(labels).size !== labels.length) return 'handover option labels must be distinct';
  if (Array.isArray(question.picks) && question.picks.length) return 'a handover ask declares no picks: its three options are the whole answer schema';
  return null;
}

/** approve | feedback | question for one answer receipt, else null. The
 *  receipt's optionIndex decides. */
export function decisionOf(receipt) {
  if (!receipt || typeof receipt !== 'object') return null;
  return HANDOVER_DECISIONS[Number.isInteger(receipt.optionIndex) ? receipt.optionIndex : -1] ?? null;
}

/** The newest op-settled event of a job that is neither the Kernel nor a
 *  handover.review attempt: the last moment the delivered product changed. */
export function lastBusinessSettleSeq(db, workflowId) {
  return db.prepare(`SELECT MAX(e.seq) AS seq FROM events e JOIN jobs j ON j.job_id=e.entity_id
    WHERE e.workflow_id=? AND e.kind='op-settled' AND j.kind<>'kernel' AND COALESCE(j.op_id,'')<>?`)
    .get(workflowId, HANDOVER_OP)?.seq ?? null;
}

/** The latest accepted goal revision invalidates an older handover package even without another business settle. */
function latestGoalRevisionSeq(db, workflowId) {
  return db.prepare("SELECT MAX(seq) AS seq FROM events WHERE workflow_id=? AND kind='goal-revised'").get(workflowId)?.seq ?? null;
}

const readReceipt = readJsonFile;

/** Every handover ask of the workflow, oldest first, with its answer. */
export function handoverAsks(db, workflowId) {
  const rows = db.prepare(`SELECT r.report_id,r.dispatch_id,r.job_id,a.try_no AS attempt,r.report_json FROM reports r JOIN op_attempts a ON a.attempt_id=r.attempt_id
    WHERE r.workflow_id=? AND a.op_id=? AND r.outcome='ask' ORDER BY r.report_id`)
    .all(workflowId, HANDOVER_OP);
  return rows.map((row) => {
    const report = parseJson(row.report_json, {}) ?? {};
    const question = report.question ?? null;
    const dispatchId = row.dispatch_id;
    const lifecycle = (kind) => db.prepare("SELECT seq,payload_json FROM events WHERE workflow_id=? AND kind=? AND json_extract(payload_json,'$.dispatchId')=? ORDER BY seq DESC LIMIT 1")
      .get(workflowId, kind, dispatchId) ?? null;
    const job = row.job_id ? { job_id: row.job_id } : null;
    // When the package was handed over: the report-filed event, else the settle
    // that parked the ask (a report settle filed on the job's behalf).
    const filedSeq = lifecycle('report-filed')?.seq
      ?? (job ? db.prepare("SELECT seq FROM events WHERE workflow_id=? AND kind='op-settled' AND entity_id=? ORDER BY seq DESC LIMIT 1").get(workflowId, job.job_id)?.seq : null)
      ?? null;
    const answered = lifecycle('ask-answered');
    const superseded = lifecycle('ask-superseded');
    // Parked again after a supersede - served, or notified for on-demand serving - reopens it.
    const reserved = [lifecycle('ask-serving'), lifecycle('ask-notified')].filter(Boolean).sort((a, b) => b.seq - a.seq)[0] ?? null;
    let state = 'pending';
    if (answered) state = 'answered';
    else if (superseded && !(reserved?.seq > superseded.seq)) state = 'superseded';
    const event = parseJson(answered?.payload_json, {}) ?? {};
    const receipt = answered ? readReceipt(event.receiptPath) : null;
    const receiptBound = Boolean(receipt) && receipt.dispatchId === dispatchId && receipt.workflowId === workflowId;
    const answeredBy = receipt?.answeredBy ?? event.answeredBy ?? null;
    return {
      dispatchId, attempt: row.attempt, jobId: job?.job_id ?? null, question, filedSeq, state,
      answeredSeq: answered?.seq ?? null,
      receiptPath: event.receiptPath ?? null,
      receiptBound,
      answeredBy,
      // Both the receipt and the ledger event must name the owner.
      byOwner: receiptBound && receipt.answeredBy === OWNER && event.answeredBy === OWNER,
      decision: receiptBound ? decisionOf(receipt) : null,
      note: receiptBound ? receipt.note ?? null : null,
      answeredAt: receiptBound ? receipt.at ?? null : null,
    };
  });
}

/**
 * Whether a handover.review attempt may settle pass: the latest handover ask
 * filed before `attempt` was answered approve, by the owner, with a receipt
 * bound to that ask, and neither a business settle nor an accepted goal revision followed the package.
 */
export function handoverApprovalOf(db, workflowId, { attempt = Number.POSITIVE_INFINITY } = {}) {
  const asks = handoverAsks(db, workflowId).filter((ask) => Number(ask.attempt) < attempt);
  const ask = asks.at(-1) ?? null;
  const lastBusiness = lastBusinessSettleSeq(db, workflowId);
  const refuse = (reason) => ({ approved: false, reason, ask, lastBusinessSettleSeq: lastBusiness });
  if (!ask) return refuse('no handover ask was filed before this attempt; the owner has not been handed anything to approve');
  const revisionSeq = latestGoalRevisionSeq(db, workflowId);
  if (revisionSeq != null && (ask.filedSeq == null || ask.filedSeq < revisionSeq))
    return refuse(`the goal was revised (event ${revisionSeq}) after handover ask ${ask.dispatchId}; hand the current revision over again`);
  if (ask.state !== 'answered') return refuse(`the latest handover ask ${ask.dispatchId} is ${ask.state}, not answered`);
  if (!ask.receiptBound) return refuse(`the answer receipt of handover ask ${ask.dispatchId} is missing or names another ask`);
  if (ask.decision !== 'approve') return refuse(`the owner answered handover ask ${ask.dispatchId} with ${ask.decision ?? 'no recognised option'}, not approve`);
  if (!ask.byOwner) return refuse(`handover ask ${ask.dispatchId} was answered by ${ask.answeredBy ?? 'nobody named'}; only the owner approves a handover, a delegated answer never does`);
  if (lastBusiness != null && (ask.filedSeq == null || ask.filedSeq < lastBusiness)) {
    return refuse(`a business job settled (event ${lastBusiness}) after handover ask ${ask.dispatchId} was filed (event ${ask.filedSeq ?? 'unknown'}); the approved package no longer covers the product`);
  }
  return { approved: true, reason: null, ask, lastBusinessSettleSeq: lastBusiness };
}

/**
 * Whether `starci kernel finish` may close the workflow: a handover-approved event newer
 * than the last business settle and accepted goal revision. A workflow whose record the owner archived
 * (workflows.archived_at) is the one existing way out and needs no approval.
 */
export function handoverGateOf(db, workflowId) {
  const workflow = db.prepare('SELECT archived_at FROM workflows WHERE workflow_id=?').get(workflowId) ?? null;
  const lastBusiness = lastBusinessSettleSeq(db, workflowId);
  if (workflow?.archived_at != null) return { ok: true, via: 'archived', archivedAt: workflow.archived_at, lastBusinessSettleSeq: lastBusiness };
  const approved = db.prepare('SELECT seq,payload_json FROM events WHERE workflow_id=? AND kind=? ORDER BY seq DESC LIMIT 1').get(workflowId, HANDOVER_APPROVED) ?? null;
  if (!approved) {
    return { ok: false, reason: 'the owner has not approved a handover of this workflow (no handover-approved event)', approvedSeq: null, lastBusinessSettleSeq: lastBusiness };
  }
  const approval = parseJson(approved.payload_json, {}) ?? {};
  const revisionSeq = latestGoalRevisionSeq(db, workflowId);
  if (revisionSeq != null && approved.seq < revisionSeq)
    return { ok: false, reason: `the handover approval predates the accepted goal revision (event ${revisionSeq}); hand the workflow over again`, approvedSeq: approved.seq, approval, lastBusinessSettleSeq: lastBusiness };
  if (lastBusiness != null && approved.seq < lastBusiness) {
    return { ok: false, reason: `the last handover approval (event ${approved.seq}) predates the last business settle (event ${lastBusiness}); hand the workflow over again`, approvedSeq: approved.seq, approval, lastBusinessSettleSeq: lastBusiness };
  }
  return { ok: true, via: HANDOVER_APPROVED, approvedSeq: approved.seq, approval, lastBusinessSettleSeq: lastBusiness };
}

/**
 * The handover block of starci kernel status. state:
 *   approved        a current owner approval exists — the workflow may finish
 *   running         a handover.review job is open
 *   awaiting-owner  the latest handover ask waits on the owner
 *   answered        the owner answered and the Kernel has not acted on it yet
 *   retired         the latest handover ask was superseded without an answer
 *   due             a handover is owed: none ran, it failed, the answer was
 *                   acted on (a fix settled after it) or the approval went stale
 *   not-started     no handover.review job exists yet
 * `due` (boolean) additionally requires every approved leg other than the
 * handover to hold a succeeded job and no other answered ask left to re-enqueue.
 */
// The projection's state word for the gate, open jobs and the latest ask.
const handoverStateOf = ({ gate, open, askIsLatest, latestAsk, latestJob, lastBusinessPass }) => {
  if (gate.ok && gate.via === HANDOVER_APPROVED) return 'approved';
  if (open.length) return 'running';
  if (askIsLatest && latestAsk.state === 'pending') return 'awaiting-owner';
  if (askIsLatest && latestAsk.state === 'answered') return lastBusinessPass != null && lastBusinessPass > latestAsk.answeredSeq ? 'due' : 'answered';
  if (askIsLatest && latestAsk.state === 'superseded') return 'retired';
  if (latestJob) return 'due';
  return 'not-started';
};

export function handoverProjection(db, workflowId, { legOps = [], alsoSettled = [] } = {}) {
  const gate = handoverGateOf(db, workflowId);
  const jobs = db.prepare("SELECT job_id,status,try_no AS attempt FROM jobs WHERE workflow_id=? AND op_id=? AND kind<>'kernel' ORDER BY created_at,job_id")
    .all(workflowId, HANDOVER_OP);
  const open = jobs.filter((job) => !SETTLED.has(job.status));
  const latestJob = jobs.at(-1) ?? null;
  const asks = handoverAsks(db, workflowId);
  const latestAsk = asks.at(-1) ?? null;
  const lastBusiness = gate.lastBusinessSettleSeq ?? null;
  // An answer is acted on once a business job passed after it (the fix a
  // feedback note routed to); a failed fix leaves the answer still owed.
  const lastBusinessPass = db.prepare(`SELECT MAX(e.seq) AS seq FROM events e JOIN jobs j ON j.job_id=e.entity_id
    WHERE e.workflow_id=? AND e.kind='op-settled' AND json_extract(e.payload_json,'$.verdict')='pass' AND j.kind<>'kernel' AND COALESCE(j.op_id,'')<>?`)
    .get(workflowId, HANDOVER_OP)?.seq ?? null;
  const askIsLatest = Boolean(latestAsk && latestJob && latestAsk.jobId === latestJob.job_id);

  const state = handoverStateOf({ gate, open, askIsLatest, latestAsk, latestJob, lastBusinessPass });

  const succeededOps = new Set(db.prepare("SELECT DISTINCT op_id FROM jobs WHERE workflow_id=? AND kind<>'kernel' AND status='succeeded' AND op_id IS NOT NULL")
    .all(workflowId).map((row) => row.op_id));
  const businessLegs = legOps.filter((op) => op !== HANDOVER_OP);
  // alsoSettled: legs autopilot deferred to the final review (scripts/kernel/autopilot-run.mjs) - the handover lists them.
  const settledOps = new Set([...succeededOps, ...alsoSettled]);
  const legsSettled = businessLegs.length > 0 && businessLegs.every((op) => settledOps.has(op));
  // An owner answer to another op's ask that no later enqueue acted on is the
  // Kernel's next move, not the handover.
  const lastOtherAnswer = db.prepare(`SELECT MAX(e.seq) AS seq FROM events e JOIN reports r
      ON r.workflow_id=e.workflow_id AND r.dispatch_id=json_extract(e.payload_json,'$.dispatchId')
      JOIN op_attempts a ON a.attempt_id=r.attempt_id
    WHERE e.workflow_id=? AND e.kind='ask-answered' AND COALESCE(a.op_id,'')<>?`).get(workflowId, HANDOVER_OP)?.seq ?? null;
  const lastOtherEnqueue = db.prepare("SELECT MAX(seq) AS seq FROM events WHERE workflow_id=? AND kind='job-enqueued' AND COALESCE(json_extract(payload_json,'$.opId'),'')<>?")
    .get(workflowId, HANDOVER_OP)?.seq ?? null;
  const answerPending = lastOtherAnswer != null && (lastOtherEnqueue == null || lastOtherAnswer > lastOtherEnqueue);
  const due = ['due', 'not-started', 'retired'].includes(state) && legsSettled && !answerPending;

  return {
    op: HANDOVER_OP,
    state,
    due,
    inApprovedChain: legOps.includes(HANDOVER_OP),
    jobId: latestJob?.job_id ?? null,
    ask: latestAsk ? {
      dispatchId: latestAsk.dispatchId, jobId: latestAsk.jobId, attempt: latestAsk.attempt, state: latestAsk.state,
      decision: latestAsk.decision, answeredBy: latestAsk.answeredBy, byOwner: latestAsk.byOwner,
      note: latestAsk.note, receiptPath: latestAsk.receiptPath,
    } : null,
    approvedSeq: gate.approvedSeq ?? null,
    lastBusinessSettleSeq: lastBusiness,
    finishAllowed: gate.ok,
    ...(gate.ok ? {} : { finishRefusal: gate.reason }),
  };
}

/** The frontier reason for a handover state the Kernel owes a move on. */
export function handoverReason(handover, workflowId) {
  const ask = handover?.ask;
  if (handover?.state === 'approved') {
    return `the owner approved the handover (handover-approved event ${handover.approvedSeq}, after the last business settle); retire any leftover ask with starci kernel retire-ask, then run starci kernel finish --workflow ${workflowId}`;
  }
  if (handover?.state === 'answered' && ask) {
    if (ask.decision === 'approve' && ask.byOwner) {
      return `the owner approved handover ask ${ask.dispatchId}; enqueue handover.review again (it reads the approval through starci kernel survey --deliveries and files done), then starci kernel record-checks and starci kernel settle --verdict pass record handover-approved; then starci kernel finish`;
    }
    if (ask.decision === 'approve') {
      return `handover ask ${ask.dispatchId} was answered approve by ${ask.answeredBy ?? 'a delegate'}, and only the owner approves a handover; enqueue handover.review again so the owner is asked`;
    }
    if (ask.decision === 'feedback') {
      return `the owner reported a defect on handover ask ${ask.dispatchId}; route the note to the fix op of the slice it names (modules/models/kinds.yaml route handover-feedback-repairs-the-build), and once that fix settles run handover.review again`;
    }
    if (ask.decision === 'question') {
      return `the owner asked a question on handover ask ${ask.dispatchId}; enqueue handover.review again — the attempt answers it in the package and hands over again`;
    }
    return `handover ask ${ask.dispatchId} was answered with no recognised option; enqueue handover.review again`;
  }
  if (handover?.due) {
    return `every approved leg settled and no current owner approval exists; enqueue handover.review as the final leg (--paths .starciwork/evidence/${workflowId}.handover) — starci kernel finish refuses handover-not-approved until the owner approves`;
  }
  return null;
}

/** What a handover package is assembled from: every settled business job with
 *  its filed report fields, and the history of earlier handover answers. */
export function deliveriesOf(db, workflowId) {
  const jobs = db.prepare(`SELECT job_id,op_id,try_no AS attempt,status,${jobResultSql('jobs')} AS result_json,payload_json FROM jobs WHERE workflow_id=? AND kind<>'kernel' AND status IN ('succeeded','failed','awaiting_owner') ORDER BY created_at,job_id`)
    .all(workflowId).filter((job) => job.op_id !== HANDOVER_OP);
  const deliveries = jobs.map((job) => {
    const result = parseJson(job.result_json, {}) ?? {};
    const payload = parseJson(job.payload_json, {}) ?? {};
    const row = latestReportOf(db, job.job_id);
    const report = parseJson(row?.report_json, null);
    return {
      jobId: job.job_id, op: job.op_id, attempt: job.attempt, status: job.status, verdict: result.verdict ?? null,
      repository: payload.repository ?? null,
      ownedPaths: (payload.owned_paths ?? []).map((p) => (typeof p === 'string' ? p : p?.path)).filter(Boolean),
      reportFile: result.report ?? null,
      ...(report ? {
        outcome: report.outcome ?? null, summary: report.summary ?? null, files: report.files ?? [],
        head: report.head ?? null, credentialPending: report.credentialPending ?? [],
        open: report.open ?? [], blocker: report.blocker ?? null,
        checks: (report.checks ?? []).map((check) => ({ name: check?.name ?? null, command: check?.command ?? null, exitCode: check?.exitCode ?? null })),
      } : { reportFiled: false }),
    };
  });
  const history = handoverAsks(db, workflowId).map((ask) => ({
    dispatchId: ask.dispatchId, attempt: ask.attempt, state: ask.state, decision: ask.decision,
    answeredBy: ask.answeredBy, byOwner: ask.byOwner, note: ask.note, answeredAt: ask.answeredAt, receiptPath: ask.receiptPath,
  }));
  const credentialPending = [...new Set(deliveries.flatMap((delivery) => delivery.credentialPending ?? []))];
  return { deliveries, credentialPending, handoverHistory: history };
}
