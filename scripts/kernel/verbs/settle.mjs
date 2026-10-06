// starci kernel settle: prove the filed report and independent checks before recording a verdict.
import fs from 'node:fs';
import path from 'node:path';
import { getUnit, jobResult, markReportConsumed, recordJobResult, setInboxStatus, setJobStatus, setUnitState, updateAttempt, updateJob } from '../../../engine/db/ledger.mjs';
import { AWAITING_OWNER, AWAITING_OWNER_STATUS } from '../../../engine/admission.mjs';
import { settleCheckpoint } from '../workflow-settle.mjs';
import { withWorkflowLock } from '../workflow-checkpoint.mjs';
import { appendEffectEvent, preparedSettlementOf } from '../workflow-checkpoint-state.mjs';
import { requireWorkflowPlacement, workflowAppRepo } from '../workflow-worktree.mjs';
import { parseJson } from '../../lib/json.mjs';
import { workRecordFilesOf } from './shared/work-record-files.mjs';
import { jobOpOf, jobPayloadOf, jobRowOf } from './shared/rows.mjs';
import { independentChecksOf } from './shared/check-evidence.mjs';
import { WORKER_QUESTION } from './shared/worker-messages.mjs';
import { releaseTypedWaits } from './shared/peer-waits.mjs';
import { queueTail as queueSettleTail, startTail as startSettleTail } from '../settle/job-settle.mjs';
import { OP_REV_DRIFT, shortRev } from '../runtime-rev.mjs';
import { HANDOVER_APPROVED, HANDOVER_OP, handoverApprovalOf } from '../handover.mjs';
import { unbindGuardTerminal } from '../../guards/hook-install.mjs';
import { SEAM_RECONCILED_EVENT } from '../seam-policy.mjs';
import { settlePreflight } from './shared/settle-preflight.mjs';
import { requireObservationFresh } from '../mechanism-observation.mjs';
import { isMeasurementLeg, measurementSplit } from '../verify-failure.mjs';
import { citeRecords } from '../../work/validate/work-citations.mjs';
import { finalizeAttemptTranscript } from '../transcripts.mjs';
import { landShellFoundationIfSettled } from '../shell-foundation.mjs';
import { parseYaml } from '../../../engine/yaml.mjs';
import { recordWhy } from '../why-record.mjs';
import { isSpecRun, readEnv } from '../../lib/env.mjs';

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


export default {
  verb: 'settle',
  required: ['job', 'verdict'],
  kernelOnly: true,
  usageInCore: true,
  validate(args, need) {
    need(['pass', 'fail', 'blocked'].includes(args.verdict),
      `settle --verdict must be pass|fail|blocked, got '${args.verdict}'`);
  },
  async run({ ledger, args, repo, emit, internals }) {
    const { runSettleTail, SETTLED, reportDispatchIdOf, skillRoot, requireDispatchedReportBinding, buildOpsOf, markMeasured, isPeerBlockedCheck, summarizeCheckEvidence, CUT_SET_CLOSING_CHECK, cutSetStateOf, releaseManagedWorker, heldDispatchOf, CUT_SLICE_CHECKS, VERDICT_OUTCOMES, canonSettleFollowUp, enqueueNextStep, failureClassOf, failureShapeOf, recordOpRevDrift, recordSettledAssetSlots, recordSettledGrammarProposals, releasedWhileHeldOf, seamSettleReconciles, settleOpProofs, widenCanonWire } = internals;

  const db = ledger.db, jobId = args.job, verdict = args.verdict;
  const initialJob = jobRowOf(db, jobId);
  if (!initialJob) throw Object.assign(new Error(`unknown job ${jobId}`), { code: 'job-unknown' });
  if (SETTLED.includes(initialJob.status) && initialJob.status !== 'effect_unknown') {
    throw Object.assign(new Error(`job ${jobId} is already settled (${initialJob.status})`), { code: 'job-settled' });
  }
  const dispatchId = reportDispatchIdOf(db, initialJob);
  const replayAttempt = dispatchId ? db.prepare('SELECT a.attempt_id, a.worktree_path, c.context_json FROM op_attempts a LEFT JOIN contracts c ON c.attempt_id=a.attempt_id WHERE a.workflow_id=? AND a.dispatch_id=?').get(initialJob.workflow_id, dispatchId) : null;
  const preparedDecision = () => preparedSettlementOf({ db }, { workflowId: initialJob.workflow_id, opId: jobId, attemptId: replayAttempt?.attempt_id ?? null });
  let replay = preparedDecision();
  if (replay && (replay.verdict !== verdict || replay.job.status !== initialJob.status)) {
    throw Object.assign(new Error(`settle ${jobId} must recover its prepared ${replay.verdict} decision without changing dispatch or status`), { code: 'workflow-checkpoint-recovery-conflict' });
  }
  // A report lives only in the reports table (starci kernel report files it from the job scratch):
  // settle judges the filed row and never reads a report file. A --report path is ignored.
  if (args.report) console.error(`starci kernel settle WARN: --report ${args.report} is ignored; settle reads the report the job filed (starci kernel report)`);
  {
    const settling = db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId);
    if (settling && ['queued', 'ready', 'leased'].includes(settling.status)) {
      // a dispatch killed mid-launch leaves a leased job whose payload.launchTerminal (or an op_attempts
      // row) names what it created — that IS dispatched; settle must close the orphaned terminal.
      const dispatched = db.prepare('SELECT 1 FROM op_attempts WHERE job_id=? LIMIT 1').get(jobId) != null
        || db.prepare("SELECT json_extract(payload_json,'$.launchTerminal.handle') h FROM jobs WHERE job_id=?").get(jobId)?.h != null;
      if (!dispatched) {
        throw Object.assign(new Error(`job ${jobId} is ${settling.status}: it was never dispatched, so there is no attempt to settle; drop it with starci kernel reconcile --job ${jobId} --drop`), { code: 'job-not-dispatched', status: settling.status });
      }
    }
  }

  const { proofs } = await settlePreflight({ ledger, args, repo, emit, internals, replay, verdict, jobId });

  let checkpoint = null;
  let released = 0, job, reportsConsumed = false, reportFiled = false, reportOutcome = null, settledAttemptId = null, filedReport = null, citations = null;
  let checkEvidence = { observed: 0, passed: 0, failed: 0, green: false }, claimOverruled = false;
  let awaitingOwner = false, cutSet = null, handoverApproval = null, peerBlocked = null, nextStep = null;
  const wfCtx = { db, ledger, repo, env: process.env };
  withWorkflowLock(wfCtx, { workflowId: initialJob.workflow_id }, (locked) => {
  const lockedJob = jobRowOf(db, jobId);
  if (SETTLED.includes(lockedJob.status) && lockedJob.status !== 'effect_unknown') throw Object.assign(new Error(`job ${jobId} is already settled (${lockedJob.status})`), { code: 'job-settled' });
  if (reportDispatchIdOf(db, lockedJob) !== dispatchId) throw Object.assign(new Error(`job ${jobId} changed dispatch while waiting to settle`), { code: 'workflow-checkpoint-recovery-conflict' });
  replay = preparedDecision();
  if (replay && (replay.verdict !== verdict || replay.job.status !== lockedJob.status)) throw Object.assign(new Error(`settle ${jobId} must recover its prepared ${replay.verdict} decision without changing dispatch or status`), { code: 'workflow-checkpoint-recovery-conflict' });
  let accepted;
  if (replay) {
    job = replay.job;
    accepted = replay.accepted;
    ({ reportFiled, reportOutcome, settledAttemptId, filedReport, checkEvidence, claimOverruled, awaitingOwner, cutSet, handoverApproval, peerBlocked } = replay.state);
  } else {
  if (proofs?.nativeCheckIds) {
    const fresh = settleOpProofs(db, jobId, repo);
    if (fresh?.judged.status !== 'pass' || JSON.stringify(fresh.nativeCheckIds) !== JSON.stringify(proofs.nativeCheckIds))
      throw Object.assign(new Error('native mechanism proofs changed while waiting to settle; rerun the qualified checks'), { code: 'op-gate-tool-failed' });
    requireObservationFresh(fresh.bindings);
  }
  ledger.transaction(() => {
    job = jobRowOf(db, jobId);
    if (!job) throw Object.assign(new Error(`unknown job ${jobId}`), { code: 'job-unknown' });
    if (SETTLED.includes(job.status) && job.status !== 'effect_unknown') {
      throw Object.assign(new Error(`job ${jobId} is already settled (${job.status})`), { code: 'job-settled' });
    }
    if (verdict === 'pass') requireDispatchedReportBinding(db, job);
    const payload = jobPayloadOf(job);
    payload.verdict = verdict;
    payload.settledAt = Date.now();
    let status = verdict === 'pass' ? 'succeeded' : 'failed';
    // The independent checks of the attempt (check_runs of the kernel/settler/parity runners; H8: raw exits).
    const checksEnvelope = independentChecksOf(db, { jobId });
    // A measurement leg (review.verify lint before any build: verify-failure.mjs isMeasurementLeg)
    // completes when its checkers ran: findings they measured are its result, never its failure.
    const measurementLeg = isMeasurementLeg(db, job, { buildOps: buildOpsOf() });
    const recordedChecks = (Array.isArray(checksEnvelope?.checks) ? checksEnvelope.checks : []).map((check) => (measurementLeg || (proofs?.inspectionCheckIds?.includes(check.checkId) && check.exitCode === 1) ? markMeasured(check) : check));
    checkEvidence = summarizeCheckEvidence(Array.isArray(checksEnvelope?.checks) ? { ...checksEnvelope, checks: recordedChecks } : checksEnvelope);
    const result = { verdict, report: null, at: payload.settledAt, checkEvidence, ...(checkpoint ? { checkpoint } : {}) };
    // Every red check was a peer's change (starci kernel record-checks peerBlocked): the attempt is the peer's to
    // unblock, not this op's failure - retry accounting spends no business attempt on it
    // (engine/admission.mjs retryDisposition) and the routes hand it to the peer.
    const peerChecks = recordedChecks.filter((check) => isPeerBlockedCheck(check));
    if (peerChecks.length && checkEvidence.failed === 0) {
      result.peerBlocked = { checks: peerChecks.map((check) => check.name), peers: peerChecks.flatMap((check) => check.peerBlocked.peers ?? []),
        routes: [...new Set(peerChecks.flatMap((check) => check.peerBlocked.routes ?? []))] };
    }
    // The worker's claim is the reports row of its attempt (starci kernel report filed it). No row
    // (a dead worker, nothing salvaged) settles on the kernel's verdict alone.
    const dispatchId = reportDispatchIdOf(db, job);
    const attempt = dispatchId ? db.prepare('SELECT * FROM op_attempts WHERE workflow_id=? AND dispatch_id=?').get(job.workflow_id, dispatchId) ?? null : null;
    settledAttemptId = attempt?.attempt_id ?? null;
    const row = attempt ? db.prepare('SELECT * FROM reports WHERE attempt_id=?').get(attempt.attempt_id) : null;
    let envelope = null;
    if (row) { envelope = parseJson(row.report_json); filedReport = { reportId: row.report_id, dispatchId: row.dispatch_id }; }
    result.report = filedReport;
    if (envelope?.outcome) {
      reportOutcome = envelope.outcome;
      reportFiled = true;
      const measuredSplit = measurementLeg ? measurementSplit([...recordedChecks, ...(Array.isArray(envelope.checks) ? envelope.checks : [])]) : null;
      if (measurementLeg && verdict === 'fail' && envelope.outcome === 'failed' && !measuredSplit.errors.length && !args['tool-error']) {
        throw Object.assign(new Error(`${jobId} is a measurement leg (${jobOpOf(job)} mode ${payload.params?.mode}, no build settled before it): its checkers ran and measured ${measuredSplit.findings.length} red check(s) of findings (${[...new Set(measuredSplit.findings.map((c) => c.name))].join(', ') || 'none'}) - that IS the measurement, not a failure. Settle --verdict pass (the report's findings become the input of the legs after it), or --tool-error when a checker did not actually run`), {
          code: 'measurement-findings-are-the-result', findings: measuredSplit.findings.map((c) => ({ name: c.name, exitCode: c.exitCode })) });
      }
      if (!VERDICT_OUTCOMES[verdict].includes(envelope.outcome)) {
        if (verdict === 'fail' && envelope.outcome === 'done' && checkEvidence.failed > 0) {
          claimOverruled = true;
          result.claimOverruled = true;
        } else if (verdict === 'pass' && measurementLeg && envelope.outcome === 'failed' && !measuredSplit.errors.length) {
          // A measurement filed as `failed` only because it found findings (a fe-canon review.verify, a1-a4).
          result.measurement = { leg: 'measurement', reportOutcome: 'failed', readAs: 'done', findings: measuredSplit.findings.map((c) => c.name) };
        } else {
          throw Object.assign(new Error(`verdict '${verdict}' cannot settle a report of outcome '${envelope.outcome}'`), { code: 'verdict-outcome-mismatch' });
        }
      }
    }
    // An ask is a wait on the owner, not a failed attempt: the row settles awaiting_owner
    // (never failed: the worker is released and the next attempt is a new job that
    // follows it), and it spends neither a business retry (engine/admission.mjs
    // retryDisposition) nor a try of its unit's budget (spentTries).
    if (verdict === 'blocked' && reportOutcome === 'ask') {
      awaitingOwner = true;
      status = AWAITING_OWNER_STATUS;
      Object.assign(result, { verdict: AWAITING_OWNER, kernelVerdict: verdict, askDispatchId: dispatchId });
    }
    if (verdict === 'pass') {
      if (reportOutcome !== 'done' && !result.measurement) {
        throw Object.assign(new Error(`pass requires a filed done report for ${jobId}`), { code: 'pass-report-missing' });
      }
      if (!checkEvidence.green) {
        throw Object.assign(new Error(`pass requires independently recorded green checks for ${jobId}`), { code: 'checks-not-green' });
      }
      if (payload.cut) {
        // Every slice pass records its scoped postcondition and the unchanged
        // inventory. The pass that CLOSES the set - every other ordinal's
        // latest job already settled succeeded, whichever ordinal settles last
        // - additionally records full-regression-final: the unchanged full
        // gates run once over the whole cut set before it counts done
        // (inc-751dd1ac4492; verdict-contract.yaml cutSetAuthority).
        cutSet = cutSetStateOf(db, { workflowId: job.workflow_id, op: jobOpOf(job), cut: payload.cut, ownJobId: jobId });
        const closesSet = cutSet.open.length === 0;
        const requiredNames = closesSet ? [...CUT_SLICE_CHECKS, CUT_SET_CLOSING_CHECK] : CUT_SLICE_CHECKS;
        const missing = requiredNames.filter((name) => !recordedChecks.some((check) => check?.name === name && check.exitCode === 0));
        if (missing.length) {
          const why = closesSet
            ? `this pass closes cut set ${cutSet.id} (every other ordinal of ${cutSet.total} settled succeeded), so the unchanged full gates run over the whole set and record ${CUT_SET_CLOSING_CHECK}`
            : `ordinal(s) ${cutSet.open.join(',')} of cut set ${cutSet.id} are still open, so this slice records its scoped checks and the set's last pass records ${CUT_SET_CLOSING_CHECK}`;
          throw Object.assign(new Error(`cut pass for ${jobId} missing required green checks: ${missing.join(', ')} — ${why}`), {
            code: 'cut-checks-missing', cut: payload.cut, missing,
          });
        }
        result.cutSet = { id: cutSet.id, total: cutSet.total, closesSet, open: cutSet.open };
      }
    }
    // A handover.review pass is the owner's approval turned into a ledger fact:
    // it settles only on the owner's approve receipt for the latest handover
    // ask with no business settle after it (scripts/kernel/handover.mjs). A
    // delegated answer never approves.
    if (verdict === 'pass' && jobOpOf(job) === HANDOVER_OP) {
      internals.handoverProofGate(db, job, repo);
      const approval = handoverApprovalOf(db, job.workflow_id, { attempt: job.attempt });
      if (!approval.approved) {
        throw Object.assign(new Error(`handover.review ${jobId} cannot settle pass: ${approval.reason}`), { code: 'handover-not-approved' });
      }
      handoverApproval = approval;
      result.handoverApproval = { dispatchId: approval.ask.dispatchId, answeredBy: approval.ask.answeredBy, receiptPath: approval.ask.receiptPath };
    }
    peerBlocked = result.peerBlocked ?? null;
    // The job moves along job_transitions to its settled status; a terminal status drops its leases
    // (jobs_release_leases trigger), counted here first.
    const settlePath = settlePathOf(job.status, status, reportFiled);
    if (!settlePath) throw Object.assign(new Error(`job ${jobId} is ${job.status}: no job_transitions path settles it ${status}`), { code: 'job-not-settleable', status: job.status });
    accepted = { payload, result, row, envelope, status, settlePath, recordedChecks };
  });
  }
  const current = jobRowOf(db, jobId);
  if (SETTLED.includes(current.status) && current.status !== 'effect_unknown') throw Object.assign(new Error(`job ${jobId} is already settled (${current.status})`), { code: 'job-settled' });
  if (reportDispatchIdOf(db, current) !== dispatchId || current.status !== job.status) throw Object.assign(new Error(`job ${jobId} changed while accepting its settle`), { code: 'workflow-checkpoint-recovery-conflict' });
  locked.settlement = { verdict, job, accepted, state: { reportFiled, reportOutcome, settledAttemptId, filedReport, checkEvidence, claimOverruled, awaitingOwner, cutSet, handoverApproval, peerBlocked } };
  // Every acceptance refusal has passed under the same workflow lock as the effect and settlement.
  if (job.kind === 'op') {
    const context = parseJson(replayAttempt?.context_json) ?? {};
    const placements = [replayAttempt?.worktree_path, context.worktree, context.packet?.context?.workflow_worktree?.path].filter((dir) => typeof dir === 'string' && dir);
    const tree = requireWorkflowPlacement(locked, { workflowId: job.workflow_id, placements: placements.map((dir) => path.resolve(repo, dir)),
      required: Boolean(context.packet?.context?.workflow_worktree || replay || workflowAppRepo(repo) || placements.some((dir) => workflowAppRepo(path.resolve(repo, dir)))) });
    if (tree) {
      try {
        checkpoint = settleCheckpoint(locked, { workflowId: job.workflow_id, opId: jobId, pass: verdict === 'pass' });
      } catch (error) {
        const reason = error?.code ?? 'workflow-checkpoint-failed';
        emit({ ok: false, jobId, reason, code: reason, detail: String(error?.message ?? error) },
          `settle REFUSED for ${jobId}: ${reason} - ${String(error?.message ?? error)}; main is untouched. A prepared checkpoint may need recovery; retry the same dispatch after fixing the workflow worktree`, args.json);
        throw error;
      }
    }
  }
  ledger.transaction(() => {
    const { payload, result, row, envelope, status, settlePath, recordedChecks } = accepted;
    if (checkpoint) {
      result.checkpoint = checkpoint;
      appendEffectEvent(locked, { workflowId: job.workflow_id, entityType: 'job', entityId: jobId, attemptId: settledAttemptId, kind: checkpoint.kind, payload: checkpoint });
    }
    released = db.prepare('SELECT count(*) n FROM leases WHERE job_id=?').get(jobId).n;
    const at = payload.settledAt;
    for (const to of settlePath) {
      setJobStatus(db, { jobId, to, reason: `settle-${verdict}`, at, attemptId: settledAttemptId,
        ...(to === status ? { payload, leaseToken: null, deadline: null } : {}) });
    }
    recordJobResult(db, { jobId, result, at });
    if (settledAttemptId != null) {
      updateAttempt(db, { attemptId: settledAttemptId, settledAt: at, verdict, endState: 'settled',
        settledBy: readEnv('STARCI_CALLER') === 'runtime-settler' ? 'settler' : 'kernel', ...(reportOutcome ? { reportOutcome } : {}), at });
    }
    // Integrating the verdict consumes the attempt's reports row - the durable
    // worker->kernel signal is spent exactly once.
    reportsConsumed = row ? markReportConsumed(db, { attemptId: row.attempt_id, at }) : false;
    // The unit of work the job tried: done on pass, failed on fail/blocked (a retry's enqueue queues it again).
    // A unit a later try already took over, or one another try passed, is left as it is.
    const unit = job.unit_id ? getUnit(db, job.workflow_id, job.unit_id) : null;
    if (unit && unit.state !== 'done' && (unit.current_job_id == null || unit.current_job_id === jobId)) {
      setUnitState(db, { workflowId: job.workflow_id, unitId: job.unit_id, to: verdict === 'pass' ? 'done' : awaitingOwner ? 'deciding' : 'failed', reason: `${jobId} settled ${verdict}`, at });
    }
    // A question the settled worker asked through Orca has no one left to answer.
    for (const q of db.prepare(`SELECT inbox_id FROM inbox WHERE workflow_id=? AND kind=? AND status='pending'
        AND (json_extract(payload_json,'$.jobId')=? OR attempt_id IN (SELECT attempt_id FROM op_attempts WHERE job_id=?))`).all(job.workflow_id, WORKER_QUESTION, jobId, jobId)) {
      setInboxStatus(db, { inboxId: q.inbox_id, status: 'done', disposition: { reason: 'job-settled' }, at });
    }
    // The Work records the job wrote cite their evidence by artifact id + sha256: work_citations pins those blobs.
    const workFiles = workRecordFilesOf(repo, payload, envelope);
    if (workFiles.length) citations = citeRecords(db, { repo, files: workFiles, recordRev: typeof envelope?.head === 'string' ? envelope.head : null, now: at });
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId, attemptId: settledAttemptId,
      kind: 'op-settled', payload: { verdict, status, report: filedReport, reportFiled, reportOutcome, checkEvidence, claimOverruled, awaitingOwner, leasesReleased: released, reportsConsumed,
        ...(citations ? { citations: { cited: citations.cited, unresolved: citations.unresolved.length } } : {}), ...(result.cutSet ? { cutSet: result.cutSet } : {}), ...(result.peerBlocked ? { peerBlocked: result.peerBlocked } : {}) },
    });
    // A failed attempt never leaves the frontier without its next step (enqueueNextStep).
    if (verdict === 'fail' && !peerBlocked) {
      const failure = reportFiled && !claimOverruled ? failureClassOf(db, job, envelope, recordedChecks) : null;
      if (failure) result.failureClass = failure;
      nextStep = enqueueNextStep(ledger, { ...job, payload_json: JSON.stringify(payload) },
        { shape: failureShapeOf({ reportFiled, reportOutcome, claimOverruled, failureClass: failure?.class ?? null, op: jobOpOf(job) }), envelope, repo, failure });
      if (failure) recordJobResult(db, { jobId, result: { ...(jobResult(db, jobId) ?? result), failureClass: failure }, at: payload.settledAt });
      if (nextStep?.kind === 'peer-blocked') peerBlocked = jobResult(db, jobId)?.peerBlocked ?? null;
    }
    // A passed canon slice's owedToWire findings are the canon-wire leg's to land (verdict-contract owedToWire).
    if (verdict === 'pass' && payload.cut && String(payload.params?.canonFamilies ?? '').trim() && payload.params?.canonWire !== true && Array.isArray(envelope?.owedToWire) && envelope.owedToWire.length) {
      try {
        const prefix = String((payload.owned_paths ?? []).find((p) => typeof p === 'string' && /^[^/]+\/(?:apps|packages)\//.test(p)) ?? '').replace(/^([^/]+\/).*$/, '$1');
        const owed = [...new Set(envelope.owedToWire.map((o) => String(o.path).replaceAll(/\\/g, '/').replace(/\/+$/, '')).map((p) => (prefix && !p.startsWith(prefix) ? `${prefix}${p}` : p)))];
        const wire = widenCanonWire(ledger, { ...job, payload_json: JSON.stringify(payload) }, payload, owed, []);
        if (wire) recordJobResult(db, { jobId, result: { ...(jobResult(db, jobId) ?? result), owedToWire: { paths: owed, wireJob: wire.jobId } }, at: payload.settledAt });
      } catch (error) {
        ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: jobId, kind: 'canon-follow-up-failed', payload: { error: String(error?.message ?? error).slice(0, 400) } });
      }
    }
    // A canon slice that settled blocked with a filed report is never a dead end (canonSettleFollowUp):
    // its committed part continues, its relocation grants widen, its shared/config/public-entry needs go to the wire.
    if (verdict === 'blocked' && reportFiled && !claimOverruled && payload.cut && !nextStep) {
      try { nextStep = canonSettleFollowUp(ledger, { ...job, payload_json: JSON.stringify(payload) }, payload, envelope) ?? null; } catch (error) {
        ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: jobId, kind: 'canon-follow-up-failed', payload: { error: String(error?.message ?? error).slice(0, 400) } });
      }
    }
    // Why the attempt ended as it did, in the owner's words (scripts/kernel/why.mjs), stored with the settle.
    if (settledAttemptId != null) {
      const why = recordWhy(db, settledAttemptId, { at });
      if (why?.error) ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: jobId, attemptId: settledAttemptId, kind: 'why-failed', payload: { error: why.error } });
    }
    // The owner's approval, recorded after the settle it rides on so it is
    // newer than every business settle (starci kernel finish reads it: handoverGateOf).
    if (handoverApproval) {
      ledger.appendEvent({
        workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
        kind: HANDOVER_APPROVED, payload: {
          jobId, dispatchId: handoverApproval.ask.dispatchId, answeredBy: handoverApproval.ask.answeredBy,
          at: handoverApproval.ask.answeredAt, askJobId: handoverApproval.ask.jobId, receiptPath: handoverApproval.ask.receiptPath,
          lastBusinessSettleSeq: handoverApproval.lastBusinessSettleSeq,
        },
      });
    }
    // The set is done only here: its last pass recorded the whole-set gate.
    if (result.cutSet?.closesSet) {
      ledger.appendEvent({
        workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
        kind: 'cut-set-closed', payload: { op: jobOpOf(job), cut: payload.cut, closedBy: jobId, ordinal: payload.cut.ordinal, check: CUT_SET_CLOSING_CHECK },
      });
    }
    // A stub-built sibling is reconciled with the real seam without a redo (cut-seam.mjs): by its own settle
    // checks when it settles after the seam passed, and every one still owed by the closing pass's
    // full-regression-final, which ran the unchanged full gates over the whole set on the real seam.
    if (verdict === 'pass' && payload.cut) {
      for (const item of seamSettleReconciles(db, { job, jobId, payload, closesSet: Boolean(result.cutSet?.closesSet) })) {
        ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: item.jobId, kind: SEAM_RECONCILED_EVENT,
          payload: { op: jobOpOf(job), cutId: String(payload.cut.id), exitCode: 0, via: item.via, seamJobId: item.seamJobId, by: jobId } });
      }
    }
  });
  });

  // The settled op's Orca terminal is released with its leases — worker_id is
  // the handle. Runs after the settled state is written; a close failure
  // never un-settles.
  // Managed jobs hold a Dispatch id in worker_id, not a terminal handle — they
  // take the worker-stop/-release path below, never terminal close.
  const settledPayload = jobPayloadOf(job);
  const managed = heldDispatchOf(settledPayload);
  // A worker released while this settle was held (reconcile --release-worker) is already gone: its
  // recorded proof is the release, and nothing is quit, closed or released again.
  const releasedEarlier = releasedWhileHeldOf(settledPayload);
  // Managed settle — calls.yaml settle-dispatch: releaseManagedWorker below.
  const managedWorker = !managed?.dispatchId ? null
    : releasedEarlier ? { ...(settledPayload.managedWorker ?? { dispatchId: managed.dispatchId }), releasedWhileHeld: true,
      custody: { state: 'released', proof: 'released-while-held', at: releasedEarlier.at ?? null } }
    : releaseManagedWorker(settledPayload);
  // A released worker's output stays readable from Orca's archive: the fullest read becomes op_attempts.transcript_sha.
  if (managedWorker && !releasedEarlier && settledAttemptId != null) finalizeAttemptTranscript(ledger, { attemptId: settledAttemptId, dispatch: managed.dispatchId });
  // The worker's terminal guard binding (<guards root>/terminals/<handle>.json) dies with its
  // terminal: unbind it at settle too, not only inside the close, so a worker released while held,
  // a close that predated binding cleanup, or a failed close that still left the terminal gone never
  // leaves the binding to the seven-day prune. Removing a missing file is a no-op.
  const guardUnbound = [];
  for (const handle of [managed ? managed.agentTerminalHandle : job.worker_id].filter(Boolean)) {
    try { if (unbindGuardTerminal({ skillRoot, handle })) guardUnbound.push(handle); } catch { /* pruned by age later */ }
  }
  // The worker receipt is kept on the job (with the Dispatch state releaseManagedWorker read): settle's
  // stdout is the only other place it lived, and an orphaned op terminal left no trace. The op's Orca Task
  // is not closed here: the op's worker_done settled it with the Dispatch (orca-deep-map REPLACE #9).
  if (managedWorker) {
    const stored = parseJson(db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(jobId)?.payload_json) ?? {};
    ledger.transaction(() => updateJob(db, { jobId, payload: { ...stored, ...(managedWorker ? { managedWorker } : {}), } }));
  }

  // LIGHT SETTLE, HEAVY WORK ASYNC (owner ruling settle-runtime-service): everything above is the settle's
  // synchronous core (verdict, leases, worker release, next-step enqueue, ledger events). The tail - session
  // retention, the Telegram media, the input re-baseline, artifact indexing with its evidence copy and typed logs -
  // runs in a detached `starci kernel settle-tail` (scripts/kernel/verbs/settle-tail.mjs) queued under the ledger's
  // settle-tail/ dir: it can neither block nor fail the settle, and a failed run is logged and retried by the
  // settler (scripts/kernel/settle/job-settle.mjs retryDueTails). Under the test runner, or with --sync-tail, it runs inline.
  let tail, sessionReleased = null, artifacts = null;
  if (isSpecRun() || args['sync-tail']) {
    tail = await runSettleTail(ledger, jobRowOf(db, jobId) ?? job, repo, { verdict });
    ({ sessionReleased, artifacts } = tail);
    tail = { mode: 'sync', ok: tail.ok };
  } else {
    let queued = null, pid = null;
    try { queued = queueSettleTail(repo, jobId); pid = startSettleTail(repo, jobId); } catch (error) { queued = { error: String(error?.message ?? error) }; }
    tail = { mode: 'async', queued: typeof queued === 'string' ? queued : null, pid, ...(queued?.error ? { error: queued.error } : {}) };
  }

  // A passed interface.draw of the workflow that owns foundation `shell` lands it once the tree is settled: every
  // dependent draw waiting on the shell (foundation-wait) is released. Best effort - a stalled owner is the Supervisor's.
  let shellLanded = null;
  if (verdict === 'pass' && jobOpOf(job) === 'interface.draw') {
    try {
      const brief = parseYaml(fs.readFileSync(path.join(skillRoot, 'modules', 'ops', 'ops', 'interface.draw.yaml'), 'utf8'));
      shellLanded = landShellFoundationIfSettled(ledger, { job, brief, payload: jobPayloadOf(jobRowOf(db, jobId) ?? job), repo });
    } catch { shellLanded = null; }
  }
  const grammarProposals = recordSettledGrammarProposals(ledger, job, repo);
  const assetSlots = recordSettledAssetSlots(ledger, job, repo);
  const revDrift = recordOpRevDrift(ledger, job);
  const status = verdict === 'pass' ? 'succeeded' : awaitingOwner ? AWAITING_OWNER_STATUS : 'failed';
  const out = { ok: true, jobId, verdict, status, awaitingOwner, artifacts, ...(shellLanded ? { shellFoundation: shellLanded } : {}), ...(grammarProposals.length ? { grammarProposals: grammarProposals.map(({ name, file, complete }) => ({ name, file, complete })) } : {}), ...(assetSlots.owed.length ? { assetSlotsOwed: assetSlots.owed.map(({ key, html, requested }) => ({ key, html, requested })) } : {}), ...(assetSlots.filled.length ? { assetSlotsFilled: assetSlots.filled.map(({ key, sha256 }) => ({ key, sha256 })) } : {}), report: filedReport, reportFiled, reportOutcome, checkEvidence, claimOverruled, ...(peerBlocked ? { peerBlocked } : {}), ...(nextStep ? { nextStep } : {}), ...(handoverApproval ? { handoverApproved: { dispatchId: handoverApproval.ask.dispatchId, answeredBy: handoverApproval.ask.answeredBy } } : {}), ...(cutSet ? { cutSet: { id: cutSet.id, total: cutSet.total, closesSet: cutSet.open.length === 0, open: cutSet.open } } : {}), leasesReleased: released, reportsConsumed, ...(citations ? { citations } : {}), ...(guardUnbound.length ? { guardUnbound } : {}), ...(managedWorker ? { managedWorker } : {}), ...(sessionReleased ? { sessionReleased } : {}), ...(checkpoint ? { checkpoint } : {}), ...(revDrift ? { opRevDrift: revDrift } : {}), tail };
  if (revDrift) console.error(`starci kernel settle WARN ${OP_REV_DRIFT}: ${jobId} (${revDrift.op}) was dispatched under runtime rev ${shortRev(revDrift.from)}; its op contract changed on main by ${shortRev(revDrift.to)}: ${revDrift.files.join(', ')} - judged as admitted, never refused`);
  // A typed --until-job wait on this job, in any workflow of the ledger, may hold now: release it and
  // wake that Kernel instead of leaving it to the next watchdog tick (gate-conditions.mjs).
  const typedReleased = releaseTypedWaits(ledger, { repo, wake: true, self: job.workflow_id }).resolved;
  if (typedReleased.length) out.autoResolved = typedReleased.map(({ incidentId, workflowId: waiter, evidence, wake }) => ({ incidentId, workflowId: waiter, evidence, ...(wake ? { wake } : {}) }));
  emit(out, `settled ${jobId} verdict=${verdict}${awaitingOwner ? ` (${AWAITING_OWNER}: no business attempt spent)` : ''}${peerBlocked ? ` (peer-blocked ${peerBlocked.checks.join(', ')}${verdict === 'pass' ? '' : ': no business attempt spent'}; hand it to the peer: ${peerBlocked.routes.join(' ; ')})` : ''} status=${status}${nextStep ? ` next=${nextStep.kind}${nextStep.jobs?.length ? ` ${nextStep.jobs.join(',')}` : ''}${nextStep.incidentId ? ` ${nextStep.incidentId}` : ''} (${nextStep.reason})` : ''} (leases released: ${released}${reportsConsumed ? ', report consumed' : ''}${managedWorker ? `, worker ${managedWorker.dispatchId} dispatch=${managedWorker.dispatch?.state ?? '?'} stop=${managedWorker.stop?.ok ?? '-'} release=${managedWorker.release?.ok ?? '-'} custody=${managedWorker.custody?.state ?? 'unknown'}${managedWorker.custody?.proof ? ` (${managedWorker.custody.proof})` : ''}` : ''}${sessionReleased ? `, session ${sessionReleased.released ? `archived ${sessionReleased.files?.length ?? 0} file(s)` : `release skipped (${sessionReleased.reason})`}` : ''}${out.cutSet ? `, cut ${out.cutSet.id} ${out.cutSet.closesSet ? 'CLOSED' : `open ${out.cutSet.open.join(',')}`}` : ''})`, args.json);

  },
};
