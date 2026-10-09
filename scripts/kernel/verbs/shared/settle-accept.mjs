// The lock-held half of `starci kernel settle`: the acceptance of a verdict (every refusal, under the workflow lock) and the
// settlement writes that follow it. The verb (verbs/settle.mjs) builds one context and one mutable state, the steps below
// fill the state, and the verb reads it back for the worker release, the tail and the output.
import path from 'node:path';
import { getUnit, jobResult, markReportConsumed, recordJobResult, setInboxStatus, setJobStatus, setUnitState, updateAttempt } from '../../../../engine/db/ledger.mjs';
import { AWAITING_OWNER, AWAITING_OWNER_STATUS } from '../../../../engine/admission.mjs';
import { settleCheckpoint } from '../../workflow-settle.mjs';
import { appendEffectEvent } from '../../workflow-checkpoint-state.mjs';
import { requireWorkflowPlacement, workflowAppRepo } from '../../workflow-worktree.mjs';
import { supersedeDirs } from '../../../machine/placement-rebound.mjs';
import { refuse } from '../../../../engine/refuse.mjs';
import { parseJson } from '../../../lib/json.mjs';
import { workRecordFilesOf } from './work-record-files.mjs';
import { jobOpOf, jobPayloadOf, jobRowOf } from './rows.mjs';
import { independentChecksOf } from './check-evidence.mjs';
import { WORKER_QUESTION } from './worker-messages.mjs';
import { HANDOVER_APPROVED, HANDOVER_OP, handoverApprovalOf } from '../../handover.mjs';
import { SEAM_RECONCILED_EVENT } from '../../seam-policy.mjs';
import { requireObservationFresh } from '../../mechanism-observation.mjs';
import { isMeasurementLeg, measurementSplit } from '../../verify-failure.mjs';
import { citeRecords } from '../../../work/validate/work-citations.mjs';
import { recordWhy } from '../../why-record.mjs';
import { checkedInOf } from './settle-checked-in.mjs';
import { readEnv } from '../../../lib/env.mjs';
import { rejudgedVerdictOf } from '../../critic-hold.mjs';
import { runtimeCriticRunOf } from '../../settle/critic-run.mjs';
import { requireBrandProduct } from '../../brand-product.mjs';

// The job_transitions walk from the job's current status to its settled one. A pass settles only a job whose worker
// filed a report (running/answering/effect_unknown go through reported); a fail or blocked with a filed report goes
// through reported too, one without goes straight to failed where the table allows it. A job never dispatched
// (queued/ready/leased) has nothing to settle: starci kernel reconcile --drop cancels it.
const SETTLE_PATH = {
  reported: { succeeded: [], failed: [], [AWAITING_OWNER_STATUS]: [] },
  deciding: { succeeded: [], failed: [], [AWAITING_OWNER_STATUS]: [] },
  running: { succeeded: ['reported'], failed: ['reported'], [AWAITING_OWNER_STATUS]: ['reported'], unreported: [] },
  answering: { succeeded: ['reported'], failed: ['reported'], [AWAITING_OWNER_STATUS]: ['reported'], unreported: ['running'] },
  effect_unknown: { succeeded: ['running', 'reported'], failed: ['running', 'reported'], [AWAITING_OWNER_STATUS]: ['running', 'reported'], unreported: [] },
  // leased reaches here only when the killed dispatch already created its terminal/attempt — settle fails it
  // straight, never reported: nothing ran far enough to file a report.
  leased: { failed: [], unreported: [] },
};
const settlePathOf = (status, to, reportFiled) => {
  const from = SETTLE_PATH[status];
  if (!from) return null;
  const via = to === 'failed' && !reportFiled ? from.unreported : from[to];
  return via ? [...via, to] : null;
};

const owedPathOf = (value) => {
  let normalized = String(value).replaceAll('\\', '/');
  while (normalized.endsWith('/')) normalized = normalized.slice(0, -1);
  return normalized;
};

/** The state one settle fills while it accepts and writes the verdict (the verb reads it back for the rest of the settle). */
export const newSettleState = () => ({
  released: 0, job: undefined, reportsConsumed: false, reportFiled: false, reportOutcome: null, settledAttemptId: null,
  filedReport: null, citations: null, checkpoint: null, checkEvidence: { observed: 0, passed: 0, failed: 0, green: false },
  claimOverruled: false, awaitingOwner: false, cutSet: null, handoverApproval: null, peerBlocked: null, nextStep: null,
});

/** The part of the state a prepared settlement records, so a recovery replays the same acceptance. */
const settlementStateOf = (st) => ({
  reportFiled: st.reportFiled, reportOutcome: st.reportOutcome, settledAttemptId: st.settledAttemptId, filedReport: st.filedReport,
  checkEvidence: st.checkEvidence, claimOverruled: st.claimOverruled, awaitingOwner: st.awaitingOwner, cutSet: st.cutSet,
  handoverApproval: st.handoverApproval, peerBlocked: st.peerBlocked,
});

const restoreSettlementState = (st, state) => {
  ({ reportFiled: st.reportFiled, reportOutcome: st.reportOutcome, settledAttemptId: st.settledAttemptId, filedReport: st.filedReport,
    checkEvidence: st.checkEvidence, claimOverruled: st.claimOverruled, awaitingOwner: st.awaitingOwner, cutSet: st.cutSet,
    handoverApproval: st.handoverApproval, peerBlocked: st.peerBlocked } = state);
};

const alreadySettled = (SETTLED, job) => SETTLED.includes(job.status) && job.status !== 'effect_unknown';

/** The independent checks of the attempt (check_runs of the kernel/settler/parity runners; H8: raw exits), measurement checks marked. */
function recordChecksOf(ctx, job, payload) {
  const { db, st, jobId, verdict, proofs, internals } = ctx;
  const checksEnvelope = independentChecksOf(db, { jobId });
  // A measurement leg (review.verify lint before any build: verify-failure.mjs isMeasurementLeg)
  // completes when its checkers ran: findings they measured are its result, never its failure.
  const measurementLeg = isMeasurementLeg(db, job, { buildOps: internals.buildOpsOf() });
  const measured = (check) => measurementLeg || (proofs?.inspectionCheckIds?.includes(check.checkId) && check.exitCode === 1);
  const recordedChecks = (Array.isArray(checksEnvelope?.checks) ? checksEnvelope.checks : []).map((check) => (measured(check) ? internals.markMeasured(check) : check));
  st.checkEvidence = internals.summarizeCheckEvidence(Array.isArray(checksEnvelope?.checks) ? { ...checksEnvelope, checks: recordedChecks } : checksEnvelope);
  const result = { verdict, report: null, at: payload.settledAt, checkEvidence: st.checkEvidence, ...(st.checkpoint ? { checkpoint: st.checkpoint } : {}) };
  // Every red check was a peer's change (starci kernel record-checks peerBlocked): the attempt is the peer's to
  // unblock, not this op's failure - retry accounting spends no business attempt on it
  // (engine/admission.mjs retryDisposition) and the routes hand it to the peer.
  const peerChecks = recordedChecks.filter((check) => internals.isPeerBlockedCheck(check));
  if (peerChecks.length && st.checkEvidence.failed === 0) {
    result.peerBlocked = { checks: peerChecks.map((check) => check.name), peers: peerChecks.flatMap((check) => check.peerBlocked.peers ?? []),
      routes: [...new Set(peerChecks.flatMap((check) => check.peerBlocked.routes ?? []))] };
  }
  return { measurementLeg, recordedChecks, result };
}

/** The worker's claim is the reports row of its attempt; no row (a dead worker, nothing salvaged) settles on the kernel's verdict alone. */
function filedReportOf(ctx, job, result) {
  const { db, st, internals } = ctx;
  const dispatchId = internals.reportDispatchIdOf(db, job);
  const attempt = dispatchId ? db.prepare('SELECT * FROM op_attempts WHERE workflow_id=? AND dispatch_id=?').get(job.workflow_id, dispatchId) ?? null : null;
  st.settledAttemptId = attempt?.attempt_id ?? null;
  const row = attempt ? db.prepare('SELECT * FROM reports WHERE attempt_id=?').get(attempt.attempt_id) : null;
  let envelope = null;
  if (row) { envelope = parseJson(row.report_json); st.filedReport = { reportId: row.report_id, dispatchId: row.dispatch_id }; }
  result.report = st.filedReport;
  return { dispatchId, row, envelope };
}

/** A measurement leg that filed `failed` only because its checkers found findings: settling it fail is refused, the findings are its result. */
function refuseMeasuredFindings({ jobId, job, payload, measuredSplit }) {
  throw refuse(`${jobId} is a measurement leg (${jobOpOf(job)} mode ${payload.params?.mode}, no build settled before it): its checkers ran and measured ${measuredSplit.findings.length} red check(s) of findings (${[...new Set(measuredSplit.findings.map((c) => c.name))].join(', ') || 'none'}) - that IS the measurement, not a failure. Settle --verdict pass (the report's findings become the input of the legs after it), or --tool-error when a checker did not actually run`,
    'measurement-findings-are-the-result', { findings: measuredSplit.findings.map((c) => ({ name: c.name, exitCode: c.exitCode })) });
}

/** The filed envelope's outcome against the verdict: a mismatch is refused unless the evidence overrules the claim or the leg measured. */
function judgeFiledOutcome(ctx, { job, payload, envelope, measurementLeg, recordedChecks, result }) {
  const { st, jobId, verdict, args, internals } = ctx;
  st.reportOutcome = envelope.outcome;
  st.reportFiled = true;
  const measuredSplit = measurementLeg ? measurementSplit([...recordedChecks, ...(Array.isArray(envelope.checks) ? envelope.checks : [])]) : null;
  if (measurementLeg && verdict === 'fail' && envelope.outcome === 'failed' && !measuredSplit.errors.length && !args['tool-error']) {
    refuseMeasuredFindings({ jobId, job, payload, measuredSplit });
  }
  if (internals.VERDICT_OUTCOMES[verdict].includes(envelope.outcome)) return;
  // A report blocked on a Critic hold, judged by the runtime's own Critic: that verdict settles it (critic-hold.mjs).
  if (rejudgedVerdictOf(ctx.db, envelope, jobId, runtimeCriticRunOf) === verdict) { result.rejudged = { by: 'runtime-critic' }; return; }
  if (verdict === 'fail' && envelope.outcome === 'done' && st.checkEvidence.failed > 0) {
    st.claimOverruled = true;
    result.claimOverruled = true;
  } else if (verdict === 'pass' && measurementLeg && envelope.outcome === 'failed' && !measuredSplit.errors.length) {
    // A measurement filed as `failed` only because it found findings (a fe-canon review.verify, a1-a4).
    result.measurement = { leg: 'measurement', reportOutcome: 'failed', readAs: 'done', findings: measuredSplit.findings.map((c) => c.name) };
  } else {
    throw refuse(`verdict '${verdict}' cannot settle a report of outcome '${envelope.outcome}'`, 'verdict-outcome-mismatch');
  }
}

/** Every slice pass records its scoped postcondition and the unchanged inventory; the pass that closes the set also records the whole-set gate. */
function recordCutSet(ctx, { job, payload, recordedChecks, result }) {
  const { db, st, jobId, internals } = ctx;
  const { CUT_SLICE_CHECKS, CUT_SET_CLOSING_CHECK } = internals;
  // Every slice pass records its scoped postcondition and the unchanged
  // inventory. The pass that CLOSES the set - every other ordinal's
  // latest job already settled succeeded, whichever ordinal settles last
  // - additionally records full-regression-final: the unchanged full
  // gates run once over the whole cut set before it counts done
  // (inc-751dd1ac4492; verdict-contract.yaml cutSetAuthority).
  st.cutSet = internals.cutSetStateOf(db, { workflowId: job.workflow_id, op: jobOpOf(job), cut: payload.cut, ownJobId: jobId });
  const closesSet = st.cutSet.open.length === 0;
  const requiredNames = closesSet ? [...CUT_SLICE_CHECKS, CUT_SET_CLOSING_CHECK] : CUT_SLICE_CHECKS;
  const missing = requiredNames.filter((name) => !recordedChecks.some((check) => check?.name === name && check.exitCode === 0));
  if (missing.length) {
    const why = closesSet
      ? `this pass closes cut set ${st.cutSet.id} (every other ordinal of ${st.cutSet.total} settled succeeded), so the unchanged full gates run over the whole set and record ${CUT_SET_CLOSING_CHECK}`
      : `ordinal(s) ${st.cutSet.open.join(',')} of cut set ${st.cutSet.id} are still open, so this slice records its scoped checks and the set's last pass records ${CUT_SET_CLOSING_CHECK}`;
    throw refuse(`cut pass for ${jobId} missing required green checks: ${missing.join(', ')} — ${why}`, 'cut-checks-missing', { cut: payload.cut, missing });
  }
  result.cutSet = { id: st.cutSet.id, total: st.cutSet.total, closesSet, open: st.cutSet.open };
}

/** A pass needs a filed done report (or a measured one) and independently recorded green checks; a cut slice also its cut checks. */
function requirePassEvidence(ctx, { job, payload, recordedChecks, result }) {
  const { st, jobId } = ctx;
  if (st.reportOutcome !== 'done' && !result.measurement && !result.rejudged) throw refuse(`pass requires a filed done report for ${jobId}`, 'pass-report-missing');
  if (!st.checkEvidence.green) throw refuse(`pass requires independently recorded green checks for ${jobId}`, 'checks-not-green');
  if (payload.cut) recordCutSet(ctx, { job, payload, recordedChecks, result });
}

/**
 * A handover.review pass is the owner's approval turned into a ledger fact: it settles only on the owner's approve
 * receipt for the latest handover ask with no business settle after it (scripts/kernel/handover.mjs). A delegated
 * answer never approves.
 */
function requireHandoverApproval(ctx, job, result) {
  const { db, st, jobId, repo, internals } = ctx;
  internals.handoverProofGate(db, job, repo);
  const approval = handoverApprovalOf(db, job.workflow_id, { attempt: job.attempt });
  if (!approval.approved) throw refuse(`handover.review ${jobId} cannot settle pass: ${approval.reason}`, 'handover-not-approved');
  st.handoverApproval = approval;
  result.handoverApproval = { dispatchId: approval.ask.dispatchId, answeredBy: approval.ask.answeredBy, receiptPath: approval.ask.receiptPath };
}

/** The acceptance transaction: judges the verdict against the filed report and the recorded checks; every refusal is thrown here. */
function acceptSettle(ctx) {
  const { db, ledger, st, jobId, verdict, internals } = ctx;
  return ledger.transaction(() => {
    const job = jobRowOf(db, jobId);
    st.job = job;
    if (!job) throw refuse(`unknown job ${jobId}`, 'job-unknown');
    if (alreadySettled(internals.SETTLED, job)) throw refuse(`job ${jobId} is already settled (${job.status})`, 'job-settled');
    if (verdict === 'pass') internals.requireDispatchedReportBinding(db, job);
    const payload = jobPayloadOf(job);
    payload.verdict = verdict;
    payload.settledAt = Date.now();
    const { measurementLeg, recordedChecks, result } = recordChecksOf(ctx, job, payload);
    const { dispatchId, row, envelope } = filedReportOf(ctx, job, result);
    if (envelope?.outcome) judgeFiledOutcome(ctx, { job, payload, envelope, measurementLeg, recordedChecks, result });
    // An ask is a wait on the owner, not a failed attempt: the row settles awaiting_owner
    // (never failed: the worker is released and the next attempt is a new job that
    // follows it), and it spends neither a business retry (engine/admission.mjs
    // retryDisposition) nor a try of its unit's budget (spentTries).
    const asked = verdict === 'blocked' && st.reportOutcome === 'ask';
    if (asked) {
      st.awaitingOwner = true;
      Object.assign(result, { verdict: AWAITING_OWNER, kernelVerdict: verdict, askDispatchId: dispatchId });
    }
    if (verdict === 'pass') requirePassEvidence(ctx, { job, payload, recordedChecks, result });
    if (verdict === 'pass' && jobOpOf(job) === HANDOVER_OP) requireHandoverApproval(ctx, job, result);
    st.peerBlocked = result.peerBlocked ?? null;
    const businessStatus = verdict === 'pass' ? 'succeeded' : 'failed';
    const status = asked ? AWAITING_OWNER_STATUS : businessStatus;
    // The job moves along job_transitions to its settled status; a terminal status drops its leases
    // (jobs_release_leases trigger), counted here first.
    const settlePath = settlePathOf(job.status, status, st.reportFiled);
    if (!settlePath) throw refuse(`job ${jobId} is ${job.status}: no job_transitions path settles it ${status}`, 'job-not-settleable', { status: job.status });
    return { payload, result, row, envelope, status, settlePath, recordedChecks };
  });
}

/** The acceptance a fresh settle makes: the native mechanism proofs still hold, then the acceptance transaction. */
function freshAcceptance(ctx) {
  const { db, jobId, repo, proofs, internals } = ctx;
  if (ctx.verdict === 'pass') requireBrandProduct(db, jobId, { repo });
  if (proofs?.nativeCheckIds) {
    const fresh = internals.settleOpProofs(db, jobId, repo);
    if (fresh?.judged.status !== 'pass' || JSON.stringify(fresh.nativeCheckIds) !== JSON.stringify(proofs.nativeCheckIds))
      throw refuse('native mechanism proofs changed while waiting to settle; rerun the qualified checks', 'op-gate-tool-failed');
    requireObservationFresh(fresh.bindings);
  }
  return acceptSettle(ctx);
}

/** The checkpoint of the workflow worktree an op settles into; a refused checkpoint is emitted and rethrown (main is untouched). */
function settleWorkflowCheckpoint(ctx, locked, replay) {
  const { st, jobId, verdict, repo, emit, args } = ctx;
  const job = st.job;
  const context = parseJson(ctx.replayAttempt?.context_json) ?? {};
  const placements = supersedeDirs(ctx.db, ctx.replayAttempt?.attempt_id ?? null, [ctx.replayAttempt?.worktree_path, context.worktree, context.packet?.context?.workflow_worktree?.path].filter((dir) => typeof dir === 'string' && dir).map((dir) => path.resolve(repo, dir)));
  const tree = requireWorkflowPlacement(locked, { workflowId: job.workflow_id, placements: placements.map((dir) => path.resolve(repo, dir)),
    required: Boolean(context.packet?.context?.workflow_worktree || replay || workflowAppRepo(repo) || placements.some((dir) => workflowAppRepo(path.resolve(repo, dir)))) });
  if (!tree) return;
  try {
    st.checkpoint = settleCheckpoint(locked, { workflowId: job.workflow_id, opId: jobId, pass: verdict === 'pass' });
  } catch (error) {
    const reason = error?.code ?? 'workflow-checkpoint-failed';
    emit({ ok: false, jobId, reason, code: reason, detail: String(error?.message ?? error) },
      `settle REFUSED for ${jobId}: ${reason} - ${String(error?.message ?? error)}; main is untouched. A prepared checkpoint may need recovery; retry the same dispatch after fixing the workflow worktree`, args.json);
    throw error;
  }
}

/** The job's status walk, result, attempt, report consumption and unit state - the settle itself. */
function writeSettledRows(ctx, locked, accepted) {
  const { db, st, jobId, verdict } = ctx;
  const { payload, result, row, status, settlePath } = accepted;
  const job = st.job;
  if (st.checkpoint) {
    result.checkpoint = st.checkpoint;
    appendEffectEvent(locked, { workflowId: job.workflow_id, entityType: 'job', entityId: jobId, attemptId: st.settledAttemptId, kind: st.checkpoint.kind, payload: st.checkpoint });
  }
  st.released = db.prepare('SELECT count(*) n FROM leases WHERE job_id=?').get(jobId).n;
  const at = payload.settledAt;
  for (const to of settlePath) {
    setJobStatus(db, { jobId, to, reason: `settle-${verdict}`, at, attemptId: st.settledAttemptId,
      ...(to === status ? { payload, leaseToken: null, deadline: null } : {}) });
  }
  recordJobResult(db, { jobId, result, at });
  if (st.settledAttemptId != null) {
    updateAttempt(db, { attemptId: st.settledAttemptId, settledAt: at, verdict, endState: 'settled',
      settledBy: readEnv('STARCI_CALLER') === 'runtime-settler' ? 'settler' : 'kernel', ...(st.reportOutcome ? { reportOutcome: st.reportOutcome } : {}), at });
  }
  // Integrating the verdict consumes the attempt's reports row - the durable
  // worker->kernel signal is spent exactly once.
  st.reportsConsumed = row ? markReportConsumed(db, { attemptId: row.attempt_id, at }) : false;
}

const unitStateOf = (verdict, awaitingOwner) => {
  if (verdict === 'pass') return 'done';
  return awaitingOwner ? 'deciding' : 'failed';
};

/** The unit of work the job tried, and the questions its worker left unanswered. */
function closeSettledWork(ctx, accepted) {
  const { db, st, jobId, verdict, repo } = ctx;
  const { payload, envelope } = accepted;
  const job = st.job;
  const at = payload.settledAt;
  // The unit of work the job tried: done on pass, failed on fail/blocked (a retry's enqueue queues it again).
  // A unit a later try already took over, or one another try passed, is left as it is.
  const unit = job.unit_id ? getUnit(db, job.workflow_id, job.unit_id) : null;
  if (unit && unit.state !== 'done' && (unit.current_job_id == null || unit.current_job_id === jobId)) {
    setUnitState(db, { workflowId: job.workflow_id, unitId: job.unit_id, to: unitStateOf(verdict, st.awaitingOwner), reason: `${jobId} settled ${verdict}`, at });
  }
  // A question the settled worker asked through Orca has no one left to answer.
  for (const q of db.prepare(`SELECT inbox_id FROM inbox WHERE workflow_id=? AND kind=? AND status='pending'
      AND (json_extract(payload_json,'$.jobId')=? OR attempt_id IN (SELECT attempt_id FROM op_attempts WHERE job_id=?))`).all(job.workflow_id, WORKER_QUESTION, jobId, jobId)) {
    setInboxStatus(db, { inboxId: q.inbox_id, status: 'done', disposition: { reason: 'job-settled' }, at });
  }
  // The Work records the job wrote cite their evidence by artifact id + sha256: work_citations pins those blobs.
  const workFiles = workRecordFilesOf(repo, payload, envelope);
  if (workFiles.length) st.citations = citeRecords(db, { repo, files: workFiles, recordRev: typeof envelope?.head === 'string' ? envelope.head : null, now: at });
}

const canonFollowUpFailed = (ctx, error) => ctx.ledger.appendEvent({ workflowId: ctx.st.job.workflow_id, entityType: 'job', entityId: ctx.jobId, kind: 'canon-follow-up-failed', payload: { error: String(error?.message ?? error).slice(0, 400) } });

/** A failed attempt never leaves the frontier without its next step (enqueueNextStep). */
function enqueueFailedNextStep(ctx, accepted) {
  const { db, ledger, st, jobId, repo, internals } = ctx;
  const { payload, result, envelope, recordedChecks } = accepted;
  const job = st.job;
  const failureOf = st.reportFiled && !st.claimOverruled ? internals.failureClassOf(db, job, envelope, recordedChecks) : null;
  if (failureOf) result.failureClass = failureOf;
  st.nextStep = internals.enqueueNextStep(ledger, { ...job, payload_json: JSON.stringify(payload) },
    { shape: internals.failureShapeOf({ reportFiled: st.reportFiled, reportOutcome: st.reportOutcome, claimOverruled: st.claimOverruled, failureClass: failureOf?.class ?? null, op: jobOpOf(job) }), envelope, repo, failure: failureOf });
  if (failureOf) recordJobResult(db, { jobId, result: { ...(jobResult(db, jobId) ?? result), failureClass: failureOf }, at: payload.settledAt });
  if (st.nextStep?.kind === 'peer-blocked') st.peerBlocked = jobResult(db, jobId)?.peerBlocked ?? null;
}

/** A passed canon slice's owedToWire findings are the canon-wire leg's to land (verdict-contract owedToWire). */
function widenOwedToWire(ctx, accepted) {
  const { db, ledger, st, jobId, internals } = ctx;
  const { payload, result, envelope } = accepted;
  const job = st.job;
  try {
    const prefix = String((payload.owned_paths ?? []).find((p) => typeof p === 'string' && /^[^/]+\/(?:apps|packages)\//.test(p)) ?? '').replace(/^([^/]+\/).*$/, '$1');
    const owed = [...new Set(envelope.owedToWire.map((o) => owedPathOf(o.path)).map((p) => (prefix && !p.startsWith(prefix) ? `${prefix}${p}` : p)))];
    const wire = internals.widenCanonWire(ledger, { ...job, payload_json: JSON.stringify(payload) }, payload, owed, []);
    if (wire) recordJobResult(db, { jobId, result: { ...(jobResult(db, jobId) ?? result), owedToWire: { paths: owed, wireJob: wire.jobId } }, at: payload.settledAt });
  } catch (error) {
    canonFollowUpFailed(ctx, error);
  }
}

const owesCanonWire = (verdict, payload, envelope) => verdict === 'pass' && payload.cut && String(payload.params?.canonFamilies ?? '').trim() && payload.params?.canonWire !== true && Array.isArray(envelope?.owedToWire) && envelope.owedToWire.length;

/** The follow-ups a settled verdict owes: the failed attempt's next step, canon wiring, and a blocked canon slice's continuation. */
function followUpAfterSettle(ctx, accepted) {
  const { ledger, st, verdict, internals } = ctx;
  const { payload, envelope } = accepted;
  if (verdict === 'fail' && !st.peerBlocked) enqueueFailedNextStep(ctx, accepted);
  if (owesCanonWire(verdict, payload, envelope)) widenOwedToWire(ctx, accepted);
  // A canon slice that settled blocked with a filed report is never a dead end (canonSettleFollowUp):
  // its committed part continues, its relocation grants widen, its shared/config/public-entry needs go to the wire.
  if (verdict === 'blocked' && st.reportFiled && !st.claimOverruled && payload.cut && !st.nextStep) {
    try { st.nextStep = internals.canonSettleFollowUp(ledger, { ...st.job, payload_json: JSON.stringify(payload) }, payload, envelope) ?? null; } catch (error) {
      canonFollowUpFailed(ctx, error);
    }
  }
}

/** The owner's approval, recorded after the settle it rides on so it is newer than every business settle (starci kernel finish reads it: handoverGateOf). */
function recordHandoverApproved(ctx) {
  const { ledger, st, jobId } = ctx;
  const approval = st.handoverApproval;
  if (!approval) return;
  ledger.appendEvent({
    workflowId: st.job.workflow_id, entityType: 'job', entityId: jobId,
    kind: HANDOVER_APPROVED, payload: {
      jobId, dispatchId: approval.ask.dispatchId, answeredBy: approval.ask.answeredBy,
      at: approval.ask.answeredAt, askJobId: approval.ask.jobId, receiptPath: approval.ask.receiptPath,
      lastBusinessSettleSeq: approval.lastBusinessSettleSeq,
    },
  });
}

/** The cut set's closing event, and the stub-built siblings reconciled with the real seam without a redo (cut-seam.mjs). */
function recordCutEvents(ctx, accepted) {
  const { db, ledger, st, jobId, verdict, internals } = ctx;
  const { payload, result } = accepted;
  const job = st.job;
  // The set is done only here: its last pass recorded the whole-set gate.
  if (result.cutSet?.closesSet) {
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'cut-set-closed', payload: { op: jobOpOf(job), cut: payload.cut, closedBy: jobId, ordinal: payload.cut.ordinal, check: internals.CUT_SET_CLOSING_CHECK },
    });
  }
  // A stub-built sibling is reconciled with the real seam without a redo (cut-seam.mjs): by its own settle
  // checks when it settles after the seam passed, and every one still owed by the closing pass's
  // full-regression-final, which ran the unchanged full gates over the whole set on the real seam.
  if (verdict === 'pass' && payload.cut) {
    for (const item of internals.seamSettleReconciles(db, { job, jobId, payload, closesSet: Boolean(result.cutSet?.closesSet) })) {
      ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: item.jobId, kind: SEAM_RECONCILED_EVENT,
        payload: { op: jobOpOf(job), cutId: String(payload.cut.id), exitCode: 0, via: item.via, seamJobId: item.seamJobId, by: jobId } });
    }
  }
}

/** The settlement transaction: rows, the `op-settled` event, follow-ups, why, the owner's approval and the cut events. */
function writeSettle(ctx, locked, accepted) {
  const { db, ledger, st, jobId, verdict } = ctx;
  const checkedIn = checkedInOf(db, st.settledAttemptId);
  ledger.transaction(() => {
    const { payload, result, status } = accepted;
    const job = st.job;
    writeSettledRows(ctx, locked, accepted);
    closeSettledWork(ctx, accepted);
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId, attemptId: st.settledAttemptId,
      kind: 'op-settled', payload: { verdict, status, report: st.filedReport, reportFiled: st.reportFiled, reportOutcome: st.reportOutcome, checkEvidence: st.checkEvidence, claimOverruled: st.claimOverruled, awaitingOwner: st.awaitingOwner, leasesReleased: st.released, reportsConsumed: st.reportsConsumed, ...(checkedIn ? { checkedIn } : {}),
        ...(st.citations ? { citations: { cited: st.citations.cited, unresolved: st.citations.unresolved.length } } : {}), ...(result.cutSet ? { cutSet: result.cutSet } : {}), ...(result.peerBlocked ? { peerBlocked: result.peerBlocked } : {}) },
    });
    followUpAfterSettle(ctx, accepted);
    // Why the attempt ended as it did, in the owner's words (scripts/kernel/why.mjs), stored with the settle.
    if (st.settledAttemptId != null) {
      const why = recordWhy(db, st.settledAttemptId, { at: payload.settledAt });
      if (why?.error) ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: jobId, attemptId: st.settledAttemptId, kind: 'why-failed', payload: { error: why.error } });
    }
    recordHandoverApproved(ctx);
    recordCutEvents(ctx, accepted);
  });
}

/**
 * The body of the workflow lock a settle runs under: re-reads the job and any prepared settlement, accepts the verdict (or
 * replays the prepared acceptance), takes the workflow checkpoint of an op, and writes the settlement. The context carries
 * { st, db, ledger, repo, emit, args, internals, jobId, verdict, dispatchId, proofs, replayAttempt, preparedDecision }.
 */
export function settleUnderLock(ctx, locked) {
  const { db, st, jobId, verdict, dispatchId, internals, preparedDecision } = ctx;
  const { SETTLED, reportDispatchIdOf } = internals;
  const lockedJob = jobRowOf(db, jobId);
  if (alreadySettled(SETTLED, lockedJob)) throw refuse(`job ${jobId} is already settled (${lockedJob.status})`, 'job-settled');
  if (reportDispatchIdOf(db, lockedJob) !== dispatchId) throw refuse(`job ${jobId} changed dispatch while waiting to settle`, 'workflow-checkpoint-recovery-conflict');
  const replay = preparedDecision();
  if (replay && (replay.verdict !== verdict || replay.job.status !== lockedJob.status)) throw refuse(`settle ${jobId} must recover its prepared ${replay.verdict} decision without changing dispatch or status`, 'workflow-checkpoint-recovery-conflict');
  let accepted;
  if (replay) {
    st.job = replay.job;
    accepted = replay.accepted;
    restoreSettlementState(st, replay.state);
  } else accepted = freshAcceptance(ctx);
  const current = jobRowOf(db, jobId);
  if (alreadySettled(SETTLED, current)) throw refuse(`job ${jobId} is already settled (${current.status})`, 'job-settled');
  if (reportDispatchIdOf(db, current) !== dispatchId || current.status !== st.job.status) throw refuse(`job ${jobId} changed while accepting its settle`, 'workflow-checkpoint-recovery-conflict');
  locked.settlement = { verdict, job: st.job, accepted, state: settlementStateOf(st) };
  // Every acceptance refusal has passed under the same workflow lock as the effect and settlement.
  if (st.job.kind === 'op') settleWorkflowCheckpoint(ctx, locked, replay);
  writeSettle(ctx, locked, accepted);
}
