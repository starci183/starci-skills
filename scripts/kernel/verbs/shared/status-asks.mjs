// The owner-ask pipeline of `starci kernel status` (verbs/status.mjs): which settled asks still wait on the
// owner, which serve-ask forms are live, which are credential asks, and which approved legs the main line owes.
import { sameUnit } from '../../../../engine/admission.mjs';
import { isAwaitingOwner } from '../../failure-steps.mjs';
import { parseJson } from '../../../lib/json.mjs';
import { jobResultSql } from '../../../machine/job-row.mjs';
import { jobResultOf } from './rows.mjs';
import { askClassOf, isLiveProofOp } from '../../ask-server.mjs';
import { deferralOf } from '../../autopilot-run.mjs';
import { HANDOVER_OP } from '../../handover.mjs';

// The last lifecycle event wins; an ask parked again (served, or notified
// for on-demand serving) after a supersede is pending again until answered.
const askAnswersOf = (db, workflowId) => {
  const answers = new Map();
  for (const event of db.prepare("SELECT kind,payload_json FROM events WHERE workflow_id=? AND kind IN ('ask-answered','ask-superseded','ask-serving','ask-notified') ORDER BY seq").all(workflowId)) {
    const dispatchId = parseJson(event.payload_json, {})?.dispatchId;
    if (!dispatchId) continue;
    if (event.kind === 'ask-serving' || event.kind === 'ask-notified') {
      if (answers.get(dispatchId) === 'superseded') answers.delete(dispatchId);
      continue;
    }
    answers.set(dispatchId, event.kind === 'ask-answered' ? 'answered' : 'superseded');
  }
  return answers;
};

// One op may hold several owner waits at once - three provision.ask jobs,
// one per subject, or one ask per cut slice. A wait is replaced only by a
// later job of the same op with the same lineage (params.subject, else the
// cut id and ordinal); without either the op's latest attempt waits.
const subjectOfJob = (db, jobId) => {
  const payload = parseJson(db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(jobId)?.payload_json, {}) ?? {};
  const subject = payload.params?.subject;
  if (typeof subject === 'string' && subject.trim()) return `subject:${subject.trim()}`;
  if (payload.cut?.id != null && payload.cut?.ordinal != null) return `cut:${payload.cut.id}#${payload.cut.ordinal}`;
  return null;
};

const stillWaits = (db, workflowJobs, row) => {
  const subject = subjectOfJob(db, row.job_id);
  // Neither subject nor cut: the wait holds until a later job of the same op AND the same unit of
  // work unit exists (scripts/kernel/units.mjs) - an unrelated same-op job enqueued meanwhile
  // is not its successor (inc-2f7968ede59c: two served asks vanished from awaitingOwner).
  if (!subject) {
    const own = workflowJobs.find((j) => j.job_id === row.job_id) ?? row;
    // Try numbers count per unit: a later try of the same unit replaces it.
    return !workflowJobs.some((other) => other.op_id === row.op_id && sameUnit(other, own) && other.attempt > own.attempt && other.status !== 'cancelled'
      && !subjectOfJob(db, other.job_id));
  }
  // "Later" across units is by enqueue time (try numbers are per unit).
  return !workflowJobs.some((other) => other.op_id === row.op_id && other.job_id !== row.job_id && other.created_at > row.created_at && subjectOfJob(db, other.job_id) === subject);
};

const askDispatchOf = (db, row) => jobResultOf(row).askDispatchId
  ?? db.prepare("SELECT dispatch_id FROM reports WHERE job_id=? AND outcome='ask' ORDER BY created_at DESC LIMIT 1").get(row.job_id)?.dispatch_id
  ?? null;

// An ask nobody answered or retired still waits on the owner whatever its
// lineage: a later job of the same op without a shared subject or cut is not
// its replacement.
const pendingAskOf = (db, askAnswers, row) => {
  const dispatchId = askDispatchOf(db, row);
  return Boolean(dispatchId) && !askAnswers.has(dispatchId);
};

const awaitingOwnerOf = (db, s, ownerWaits, askAnswers) => ownerWaits
  .filter((row) => stillWaits(db, s.workflowJobs, row) || pendingAskOf(db, askAnswers, row))
  .map((row) => {
    const dispatchId = askDispatchOf(db, row);
    const answer = (dispatchId && askAnswers.get(dispatchId)) ?? 'pending';
    // A pending ask autopilot deferred to handover waits on nobody now (autopilot.deferredToHandover lists it).
    const deferral = answer === 'pending' && dispatchId ? deferralOf(db, s.workflowId, dispatchId) : null;
    const answered = answer === 'answered' ? parseJson(db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='ask-answered' AND json_extract(payload_json,'$.dispatchId')=? ORDER BY seq DESC LIMIT 1").get(s.workflowId, dispatchId)?.payload_json, {}) ?? {} : null;
    return { jobId: row.job_id, opId: row.op_id, attempt: row.attempt, dispatchId, answer: deferral ? 'deferred-to-handover' : answer,
      ...(answered?.answeredBy ? { answeredBy: answered.answeredBy } : {}), ...(answered?.provisional ? { provisional: true } : {}) };
  });

const lastLifecycle = (db, workflowId, dispatchId, kind) =>
  db.prepare("SELECT seq FROM events WHERE workflow_id=? AND kind=? AND json_extract(payload_json,'$.dispatchId')=? ORDER BY seq DESC LIMIT 1").get(workflowId, kind, dispatchId)?.seq ?? null;

// A pending ask is only answerable while its serve-ask form is up. The form
// expires (ask-serving-expired, --ttl) and then the owner's link is dead
// while the Kernel waits on them: a Modules tax ask sat unanswerable that
// way. Such an ask is the Kernel's to re-serve, so it is actionable.
// A form that died without expiring is dead too: a product's Modules Kernel
// served its scope ask as its own Claude Code background shell, Claude Code
// reaped it under memory pressure, and status kept calling the ask served,
// so nothing woke the Kernel while the owner's link returned nothing.
const formLive = (db, workflowId, askFormAlive, dispatchId) => {
  const served = lastLifecycle(db, workflowId, dispatchId, 'ask-serving');
  const expired = lastLifecycle(db, workflowId, dispatchId, 'ask-serving-expired');
  if (served == null || (expired != null && expired > served)) return false;
  const payload = parseJson(db.prepare('SELECT payload_json FROM events WHERE seq=?').get(served)?.payload_json, {}) ?? {};
  return askFormAlive(payload) !== false;
};

// Owner, 2026-09-24: a form is served only when the owner asks for it. An
// ask parkAsk told the owner about on Telegram (ask-notified) waits on the
// owner with no form at all - its link is generated from the chat's button
// (and regenerated after the form expires or dies) - so it is healthy
// (askOnDemandDispatches), never the Kernel's to re-serve.
const askHealthOf = (db, s, pendingOwner) => {
  const { askFormAlive } = s.internals;
  const askOnDemand = [], askReserve = [];
  for (const item of pendingOwner) {
    if (!item.dispatchId || formLive(db, s.workflowId, askFormAlive, item.dispatchId)) continue;
    (lastLifecycle(db, s.workflowId, item.dispatchId, 'ask-notified') != null ? askOnDemand : askReserve).push(item.dispatchId);
  }
  return { askOnDemand, askReserve };
};

const askReportOf = (db, workflowId, dispatchId) =>
  db.prepare("SELECT a.op_id, r.report_json FROM reports r JOIN op_attempts a ON a.attempt_id=r.attempt_id WHERE r.workflow_id=? AND r.dispatch_id=? AND r.outcome='ask' ORDER BY r.report_id DESC LIMIT 1").get(workflowId, dispatchId);

// A credential ask (serve-ask.mjs askClassOf) holds only the live-proof legs: it parks the frontier
// at awaiting-owner only when every approved leg still owed is a live proof; otherwise the main
// line reads as if the ask were not there (owner, 2026-09-25).
const credentialSplit = (db, s, pendingOwner) => {
  const credentialAsks = pendingOwner.filter((item) => {
    const row = item.dispatchId ? askReportOf(db, s.workflowId, item.dispatchId) : null;
    return row && askClassOf({ opId: row.op_id, question: parseJson(row.report_json, {})?.question }) === 'credential';
  }).map((item) => item.dispatchId);
  return { credentialAsks, approvalOwner: pendingOwner.filter((item) => !credentialAsks.includes(item.dispatchId)) };
};

// Owed: an approved leg the workflow reached (it has a job, or comes after the last leg that has
// one - a leg with no job before it is an intake leg the plan never enqueues) with no succeeded job.
const mainLineOwedOf = (s, awaitingOwner) => {
  const ownerWaitOps = new Set(awaitingOwner.map((item) => item.opId));
  const lastReached = s.legOps.reduce((last, op, index) => (s.jobsByOp.has(op) ? index : last), -1);
  return s.legOps.filter((op, index) => (s.jobsByOp.has(op) || index > lastReached)
    && op !== HANDOVER_OP && !isLiveProofOp(op) && !ownerWaitOps.has(op)
    && !(s.jobsByOp.get(op) ?? []).some((row) => row.status === 'succeeded'));
};

/** Settled asks are waits on the owner, projected apart from failures. Only an
 * op's latest attempt still waits: an older one was already re-enqueued.
 * Settled non-success rows: a failed try is a failure, an awaiting_owner try (report outcome ask) is a wait on the owner. */
export const asksPhase = (s) => {
  const { db, workflowId } = s;
  const unsuccessfulRows = db.prepare(`SELECT job_id,workflow_id,unit_id,op_id,status,try_no AS attempt,payload_json,created_at,${jobResultSql('jobs')} AS result_json FROM jobs WHERE workflow_id=? AND kind<>'kernel' AND status IN ('failed','awaiting_owner') ORDER BY created_at,job_id`).all(workflowId);
  const ownerWaits = unsuccessfulRows.filter((row) => isAwaitingOwner(db, row));
  s.failedRows = unsuccessfulRows.filter((row) => row.status === 'failed');
  const askAnswers = askAnswersOf(db, workflowId);
  s.awaitingOwner = awaitingOwnerOf(db, s, ownerWaits, askAnswers);
  s.pendingOwner = s.awaitingOwner.filter((item) => item.answer === 'pending');
  const { askOnDemand, askReserve } = askHealthOf(db, s, s.pendingOwner);
  s.askOnDemand = askOnDemand;
  s.askReserve = askReserve;
  const { credentialAsks, approvalOwner } = credentialSplit(db, s, s.pendingOwner);
  s.credentialAsks = credentialAsks;
  s.approvalOwner = approvalOwner;
  s.mainLineOwed = mainLineOwedOf(s, s.awaitingOwner);
  s.credentialWait = credentialAsks.length > 0 && s.mainLineOwed.length === 0;
  s.failures = { failed: s.failedRows.length, awaitingOwner: ownerWaits.length };
  s.credentialWaitOps = new Set(s.pendingOwner.filter((item) => credentialAsks.includes(item.dispatchId)).map((item) => item.opId));
  s.approvalWaitOps = new Set(s.approvalOwner.map((item) => item.opId));
};
