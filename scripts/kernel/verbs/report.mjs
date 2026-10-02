// api report: validate and durably file the worker's report (alpha.3, H10).
//
// The report file and every file it carries live under the attempt's STARCI_JOB_SCRATCH. The envelope is read once,
// validated, and stored ONLY in `reports` (fileReport: immutable, one per attempt); attachments and check outputs go
// to the blob store and job_artifacts / report_attachments / check_runs (api-lib/report-evidence.mjs). The job moves to
// 'reported' and the unit with it, in the same transaction, under api_requests idempotency: filing the same report
// again returns the stored result, a different one is refused. Then the scratch is deleted and the attempt's
// scrollback is kept as op_attempts.transcript_sha.
import fs from 'node:fs';
import { SCRATCH_LOG_FILE, ingestScratchLog, openLogs } from '../typed-logs.mjs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseJson } from '../../lib/json.mjs';
import { validateOpReport } from '../report-envelope.mjs';
import { jobPayloadOf, jobOpOf, operationDispatchOf } from './shared/rows.mjs';
import { HANDOVER_OP, handoverAskProblem } from '../handover.mjs';
import { autopilotOn, autopilotBundle } from '../autopilot-run.mjs';
import { DRAW_REVIEW_OP, DRAW_REVIEW_CHANGE, DRAW_OWNER_EVERY_CHANGE, DRAW_REVIEW_UNJUDGED_CHANGE, drawReviewsOwed } from '../../work/draw-review.mjs';
import { DRAW_FEEDBACK_CHANGE, reportFeedbackFindings } from '../../work/draw-feedback.mjs';
import { admittedContractOf, loadContractChanges, changeById, admittedBeforeChange } from '../../machine/contract-version.mjs';
import { ownerAskConflict } from '../../gates/starcistacks.mjs';
import { repeatedAnswerOf, ownerAnswersOf } from '../../machine/owner-answers.mjs';
import { renderReportBlock } from '../report-render.mjs';
import { startSettlerFor } from '../settle/job-settle.mjs';
import { appendEvent, fileReport, idempotent, setJobStatus, setUnitState, getUnit, updateJob } from '../../../engine/db/ledger.mjs';
import { requireReportAttempt } from './shared/report-binding.mjs';
import { attachedArgs, scratchOf, scratchFile, stageReportEvidence, storedReportOf, fileReportEvidence, removeScratch } from './shared/report-evidence.mjs';
import { finalizeAttemptTranscript } from '../transcripts.mjs';
import { send } from '../../api/orca/send.mjs';
import { isSpecRun } from '../../lib/env.mjs';

// orca-deep-map REPLACE #9: the op settles its own Orca Task and Dispatch. After the report row committed - and
// before the settler starts, which would otherwise race it - api report, running in the op's own pane, sends exactly
// one worker_done (an ask keeps its worker: no worker_done). A refile is a replay and sends nothing. The receipt is
// payload.workerDone; a failed send is recorded, never fatal: settle then reads the Dispatch not settled and fences it.
const WORKER_DONE_OUTCOME = { done: 'succeeded', partial: 'succeeded', failed: 'failed', blocked: 'failed' };
function sendOpWorkerDone(ledger, job, payload, report, reportPath, dispatchCapability) {
  const managed = payload?.managed;
  const outcome = WORKER_DONE_OUTCOME[report?.outcome];
  if (!outcome || !managed?.dispatchId || !managed?.taskId) return null;
  let sent;
  // Orca authenticates a worker_done with the Dispatch capability only the worker holds (its preamble: `--dispatch-capability dcap_...`;
  // live E3, 2026-10-02: dispatch_capability_invalid without it). The op passes it to api report; it is never stored.
  if (!dispatchCapability) sent = { ok: false, outcome: 'failed', errorCode: 'dispatch_capability_missing', error: 'api report was given no --dispatch-capability (the one in the op\'s Orca preamble)' };
  else try {
    sent = send({ taskId: managed.taskId, dispatchId: managed.dispatchId, from: managed.agentTerminalHandle ?? null,
      outcome, reportPath, subject: `${jobOpOf(job)} ${report.outcome}`, dispatchCapability });
  } catch (error) { sent = { ok: false, outcome: 'failed', error: String(error?.message ?? error) }; }
  const workerDone = { at: Date.now(), outcome, ok: sent.ok === true, ...(sent.ok ? {} : { code: 'worker-done-unsent', errorCode: sent.errorCode ?? null, error: String(sent.error ?? '').slice(0, 300) }) };
  try {
    ledger.transaction(() => {
      const stored = parseJson(ledger.db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(job.job_id)?.payload_json) ?? {};
      updateJob(ledger.db, { jobId: job.job_id, at: workerDone.at, payload: { ...stored, workerDone } });
      appendEvent(ledger.db, { workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id, kind: 'worker-done-sent', createdAt: workerDone.at,
        payload: { dispatchId: managed.dispatchId, taskId: managed.taskId, ...workerDone } });
    });
  } catch { /* the Orca message is the effect; settle reads the Dispatch state either way */ }
  return workerDone;
}

export default {
  verb: 'report',
  required: ['job', 'report'],
  jobOwnerOnly: true,
  usageInCore: true,
  validate(args, need) {
    if (args.outcome) need(['done', 'partial', 'failed', 'ask', 'blocked'].includes(args.outcome),
      `report --outcome must be done|partial|failed|ask|blocked, got '${args.outcome}'`);
  },
  async run({ ledger, args, repo, emit, internals }) {
    const { resolveJob, reportOwnedPaths, reportIdentityOf,
      handoverProofGate, skillRoot, reportFiledWake } = internals;
  const db = ledger.db, job = resolveJob(db, args.job);
  const jobPayload = jobPayloadOf(job);
  const attempt = requireReportAttempt(db, job);
  // The report is read from the attempt's scratch only: a Work path or any other file is refused (H10).
  let scratch, reportAbs;
  try { scratch = scratchOf(attempt); reportAbs = scratchFile(args.report, scratch, 'report file'); }
  catch (error) {
    // A filed attempt's scratch is gone: filing again answers with the stored row instead of a missing file.
    const prior = db.prepare('SELECT report_id,outcome FROM reports WHERE attempt_id=?').get(attempt.attempt_id);
    if (prior && ['report-scratch-missing', 'report-attachment-missing'].includes(error.code)) {
      emit({ ok: true, replayed: true, jobId: job.job_id, workflowId: job.workflow_id, dispatchId: attempt.dispatch_id, outcome: prior.outcome, reportId: prior.report_id },
        `report already filed for ${job.job_id} (dispatch ${attempt.dispatch_id}, report ${prior.report_id})`, args.json);
      return;
    }
    throw Object.assign(error, { code: error.code === 'report-attachment-missing' ? 'report-missing' : error.code === 'report-attachment-outside-scratch' ? 'report-outside-scratch' : error.code });
  }
  // One guarded read: the file that resolved but vanished before the read is a typed refusal,
  // not a raw throw mid-command (G26); everything below parses this same text.
  let reportRaw;
  try { reportRaw = fs.readFileSync(reportAbs, 'utf8'); }
  catch { throw Object.assign(new Error(`report file unreadable: ${reportAbs}`), { code: 'report-unreadable' }); }
  const parsed = parseJson(reportRaw);
  const valid = validateOpReport(parsed, { ownedPaths: reportOwnedPaths(db, job, repo), identity: reportIdentityOf(db, job) });
  if (!valid.ok) throw Object.assign(new Error(`report fails starci/op-report@1: ${valid.reasons.join('; ')}`), { code: 'report-invalid' });
  const report = valid.report;
  if (args.outcome && args.outcome !== report.outcome)
    throw Object.assign(new Error(`--outcome '${args.outcome}' contradicts the envelope's '${report.outcome}'`), { code: 'outcome-mismatch' });
  // The handover ask is the one ask whose answer the kernel routes: its three
  // options are closed and ordered (scripts/kernel/handover.mjs).
  const handoverProblem = jobOpOf(job) === HANDOVER_OP && report.outcome === 'ask' ? handoverAskProblem(report.question) : null;
  if (handoverProblem) throw Object.assign(new Error(`report fails the handover ask: ${handoverProblem}`), { code: 'report-invalid' });
  if (jobOpOf(job) === HANDOVER_OP && report.outcome === 'ask') handoverProofGate(db, job, repo);
  // Autopilot: the handover is the owner's one review, so its ask carries the owner review ledger bundle - every
  // provisional acceptance (with its images), deferred leg, deferred-to-handover proof and autopilot decision.
  if (jobOpOf(job) === HANDOVER_OP && report.outcome === 'ask' && autopilotOn(db, job.workflow_id)) {
    const bundle = autopilotBundle(db, job.workflow_id);
    const carried = report.question?.autopilot;
    const total = bundle.counts.provisional + bundle.counts.deferred + bundle.counts.deferredToHandover;
    if (total > 0 && (carried?.schema !== bundle.schema || ['provisional', 'deferred', 'deferredToHandover'].some((k) => Number(carried?.counts?.[k]) !== bundle.counts[k]))) {
      throw Object.assign(new Error(`report fails the handover ask: under autopilot it carries the final review bundle as question.autopilot, verbatim from the .autopilot block of \`node ${path.join(skillRoot, 'scripts', 'kernel', 'cli.mjs')} survey --repo <repo> --workflow ${job.workflow_id} --deliveries --json\` (now ${JSON.stringify(bundle.counts)}), and lists the provisional images in question.assets`), { code: 'report-invalid' });
    }
  }
  // A drawing another leg waits on (a planned layout's design record, a record another dependsOn) is done only once
  // the owner accepted its drawn parts (inc-a4b5b1abdd90): a done interface.draw report that leaves one
  // unreviewed is refused draw-review-owed, and the attempt files the draw-review ask instead
  // (scripts/work/draw-review.mjs). A ui record the guard cannot judge - one that does not parse, a layout tree or a
  // dependent record that does not, a guard that crashes - may owe the review, so the report is refused
  // draw-review-unjudged. A leg admitted before either change reports as it was admitted.
  if (jobOpOf(job) === DRAW_REVIEW_OP && report.outcome === 'done') {
    const admitted = admittedContractOf(db, job);
    const registry = loadContractChanges(skillRoot);
    const admittedBefore = (id) => { const change = changeById(registry, id); return Boolean(admittedBeforeChange(admitted, change)); };
    let owed = [];
    if (!admittedBefore(DRAW_REVIEW_CHANGE)) {
      let judged;
      try { judged = drawReviewsOwed(repo, report.files); } catch (error) { judged = { owed: [], unjudged: [{ path: 'draw-review.mjs drawReviewsOwed', error: String(error?.message ?? error) }] }; }
      // A leg admitted before draw-content-owner-gate owes the review only for a drawing another leg waits on.
      owed = admittedBefore(DRAW_OWNER_EVERY_CHANGE) ? judged.owed.filter((o) => o.owedBefore) : judged.owed;
      if (judged.unjudged.length) {
        const what = judged.unjudged.map((u) => `${u.path}: ${u.error}`).join('; ').slice(0, 800);
        if (admittedBefore(DRAW_REVIEW_UNJUDGED_CHANGE)) console.error(`api report WARNING: the draw review guard could not judge ${what}`);
        else throw Object.assign(new Error(`draw-review-unjudged: the owner-review guard could not judge ${what}. A record it cannot read may owe the owner review, so the done report is not filed: repair the record (starci validate names what is wrong) and file the report again`), { code: 'draw-review-unjudged', unjudged: judged.unjudged });
      }
    }
    if (owed.length) {
      throw Object.assign(new Error(`draw-review-owed: ${owed.map((o) => `${o.id} (${o.dir}) ${o.gates.length ? `gates another leg (${o.gates.join(', ')})` : 'is a drawing, and every drawing goes to the owner to accept'} and ${o.why}`).join('; ')}. File outcome ask with the question \`node ${path.join(skillRoot, 'scripts', 'work', 'draw-review.mjs')} question --ui <ui-record-dir>\` prints, verbatim (one ask, even with candidatesPerScreen 1); the owner's accept answer is applied by draw-review.mjs apply --receipt <receipt> --write on the re-enqueued attempt`), { code: 'draw-review-owed', owed });
    }
  }
  // The owner's feedback loop (scripts/work/draw-feedback.mjs): an interface.draw ask or done report whose ui record
  // carries an owner redraw answer not yet applied, or an owner note the redraw does not address (the rejected bytes,
  // a brief without the note id, a critic that does not pass it), is refused draw-feedback-unaddressed. A leg admitted
  // before contract change owner-draw-feedback-golden reports as it was admitted.
  if (jobOpOf(job) === DRAW_REVIEW_OP && ['ask', 'done'].includes(report.outcome)) {
    const change = changeById(loadContractChanges(skillRoot), DRAW_FEEDBACK_CHANGE);
    const admitted = admittedContractOf(db, job);
    const before = Boolean(admittedBeforeChange(admitted, change));
    if (!before) {
      let verdict;
      try { verdict = reportFeedbackFindings(db, { repo, report }); } catch (error) { verdict = { findings: [], error: String(error?.message ?? error) }; }
      if (verdict.error) console.error(`api report WARNING: the owner-feedback guard could not run: ${verdict.error.slice(0, 300)}`);
      if (verdict.findings.length) {
        throw Object.assign(new Error(`draw-feedback-unaddressed: ${verdict.findings.map((f) => f.detail).join(' | ').slice(0, 1600)}. The owner's notes ride in the redraw's brief (node ${path.join(skillRoot, 'scripts', 'work', 'draw-feedback.mjs')} brief --ui <dir>) and the critic gates each; redraw through draw-loop.mjs and check with draw-feedback.mjs check --ui <dir> before reporting`), { code: 'draw-feedback-unaddressed', findings: verdict.findings.slice(0, 50) });
      }
    }
  }
  // An ask for what the repository's stack declaration says the runtime already holds (a service declared
  // ownerAction none with its custody present: a Sonar token or host, a GitHub CI setting) never
  // reaches the owner (owner ruling 2026-09-24; scripts/gates/starcistacks.mjs ownerAskConflict).
  // The guard fails open: a declaration it cannot read never blocks a report.
  if (report.outcome === 'ask') {
    let declared = null;
    try { declared = ownerAskConflict({ repo, question: report.question }); } catch (error) { console.error(`api report WARNING: stack declaration ask guard unavailable: ${String(error?.message ?? error).slice(0, 200)}`); }
    if (declared) throw Object.assign(new Error(`ask-declared-in-stack: ${declared.message} File done|partial|failed|blocked using the declared custody instead; a custody or server gap is repaired in the stack, never asked of the owner.`), { code: 'ask-declared-in-stack', declared });
  }
  // An ask the job's retry lineage already had answered is never filed again (scripts/machine/owner-answers.mjs):
  // the answer rides in the packet as context.owner_answers. The one way past is a declared re-ask,
  // question.reasks {dispatchId: <the answered ask>, reason}, for an answer that could not take effect.
  let reask = null;
  if (report.outcome === 'ask') {
    const repeated = repeatedAnswerOf(report.question, ownerAnswersOf(db, job), { op: jobOpOf(job) });
    if (repeated) {
      const declared = report.question?.reasks;
      const reason = typeof declared?.reason === 'string' ? declared.reason.trim() : '';
      if (declared?.dispatchId !== repeated.dispatchId || !reason) {
        throw Object.assign(new Error(`ask-already-answered: this question repeats ask ${repeated.dispatchId} (attempt ${repeated.attempt}), which ${repeated.answeredBy} already answered ${repeated.chosen ? `with option ${repeated.chosen.index != null ? repeated.chosen.index + 1 : '?'}${repeated.chosen.label ? ` "${repeated.chosen.label}"` : ''}` : ''} at ${repeated.answeredAt}${repeated.receipt ? ` (receipt ${repeated.receipt})` : ''}. Apply that answer (packet context.owner_answers) and file done|partial|failed|blocked; ask only a question the answer left open. When the answer provably could not take effect, re-ask it with question.reasks {"dispatchId":"${repeated.dispatchId}","reason":"<why>"}`), {
          code: 'ask-already-answered', answered: repeated,
        });
      }
      reask = { dispatchId: repeated.dispatchId, reason };
    }
  }
  const dispatchId = report.dispatch, op = jobOpOf(job);
  const attach = attachedArgs();
  const repoRoots = [repo, attempt.worktree_path, attempt.repo_root].filter(Boolean);
  // Blobs are put before the transaction: a refused or rolled-back filing leaves only unreferenced blobs for GC.
  const staged = stageReportEvidence({ report, scratch, attach, opId: op, repoRoots });
  const stored = storedReportOf(report, staged);
  const fromTerminal = attempt.terminal_handle ?? jobPayload.managed?.agentTerminalHandle ?? jobPayload.orca?.agentTerminalHandle ?? job.worker_id ?? null;
  const requestArgs = { jobId: job.job_id, report: crypto.createHash('sha256').update(JSON.stringify(stored)).digest('hex'), attachments: staged.map((s) => [s.name, s.blob.sha]) };
  const filed = ledger.transaction((tx) => idempotent(tx, { verb: 'report', caller: `op:${attempt.attempt_id}`, workflowId: job.workflow_id, attemptId: attempt.attempt_id,
    dispatchId, args: requestArgs }, () => {
    const now = Date.now();
    const row = fileReport(tx, { attemptId: attempt.attempt_id, outcome: report.outcome, report: stored, fromTerminal, createdAt: now });
    if (row.replayed) throw Object.assign(new Error(`report-already-filed: attempt ${attempt.attempt_id} (dispatch ${dispatchId}) already filed report ${row.report_id}`), { code: 'report-already-filed' });
    const evidence = fileReportEvidence(tx, { attempt, reportId: row.report_id, report, staged, now });
    // H9: a reported job is never cancelled by an archive; the settler takes it from here (H1: v_settle_overdue).
    if (job.status === 'effect_unknown') setJobStatus(tx, { jobId: job.job_id, to: 'running', reason: 'report-filed', attemptId: attempt.attempt_id, at: now });
    setJobStatus(tx, { jobId: job.job_id, to: 'reported', reason: `report-filed:${report.outcome}`, attemptId: attempt.attempt_id, spanId: attempt.span_id, at: now });
    if (job.unit_id && getUnit(tx, job.workflow_id, job.unit_id)?.state === 'running')
      setUnitState(tx, { workflowId: job.workflow_id, unitId: job.unit_id, to: 'reported', reason: `report ${row.report_id}`, at: now });
    appendEvent(tx, { workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id, attemptId: attempt.attempt_id, spanId: attempt.span_id, kind: 'report-filed', createdAt: now,
      payload: { dispatchId, op, attemptId: attempt.attempt_id, tryNo: job.try_no, outcome: report.outcome, reportId: row.report_id,
        artifacts: evidence.artifacts.map((a) => ({ id: a.artifactId, name: a.name, sha256: a.sha256 })), checks: evidence.checks, ...(reask ? { reask } : {}) } });
    return { reportId: row.report_id, attachments: evidence.artifacts.length, checks: evidence.checks.length,
      artifacts: evidence.artifacts.map((a) => ({ id: a.artifactId, name: a.name, sha256: a.sha256 })), ...(evidence.audit ? { audit: evidence.audit } : {}) };
  }));
  const { reportId, attachments, artifacts = [], audit = null } = filed.result;
  // Typed rows the op kept in <scratch>/log.jsonl go to the ledger's logs table before the scratch is deleted.
  const scratchLog = path.join(scratch, SCRATCH_LOG_FILE);
  if (fs.existsSync(scratchLog)) {
    let logs = null;
    try { logs = openLogs(repo); ingestScratchLog(logs, { file: scratchLog, workflowId: job.workflow_id, jobId: job.job_id }); }
    catch (error) { console.error(`api report WARNING: the op's ${SCRATCH_LOG_FILE} was not ingested: ${String(error?.message ?? error).slice(0, 200)}`); }
    finally { try { logs?.close(); } catch { /* closing */ } }
  }
  removeScratch(scratch);
  if (filed.replayed) {
    emit({ ok: true, replayed: true, jobId: job.job_id, workflowId: job.workflow_id, dispatchId, outcome: report.outcome, reportId, attachments },
      `report already filed for ${job.job_id} (dispatch ${dispatchId}, report ${reportId})`, args.json);
    return;
  }
  // The worker's output up to this report, read by Dispatch; settle replaces it with the fuller one (after the
  // release, from Orca's archive, or before an unmanaged worker's terminal is closed).
  if (!isSpecRun()) finalizeAttemptTranscript(ledger, { attemptId: attempt.attempt_id, dispatch: operationDispatchOf(jobPayloadOf(job)), repoRoots });
  if (reask) console.error(`api report WARNING: ask ${dispatchId} re-asks ${reask.dispatchId}, which is already answered in this job's lineage; declared reason: ${reask.reason}`);
  const kernelWake = reportFiledWake(ledger, {
    workflowId: job.workflow_id,
    transition: `report-filed:${report.outcome}`,
    jobId: job.job_id,
    dispatchId,
  });
  const workerDone = sendOpWorkerDone(ledger, job, jobPayload, report, reportAbs, args['dispatch-capability'] ?? null);
  const out = { ok: true, jobId: job.job_id, workflowId: job.workflow_id, dispatchId, attemptId: attempt.attempt_id, outcome: report.outcome, reportId, attachments, artifacts, ...(audit ? { audit } : {}), kernelWake, ...(reask ? { reask } : {}), ...(workerDone ? { workerDone } : {}) };
  emit(out, `report filed for ${job.job_id} (dispatch ${dispatchId}, outcome ${report.outcome})${workerDone ? `; worker_done ${workerDone.outcome} ${workerDone.ok ? 'sent' : `NOT sent (${workerDone.errorCode})`}` : ''}`, args.json);
  // The op terminal gets the canonical human rendering of the filed row — the
  // reports row is the truth, this block is its projection.
  console.log(renderReportBlock(report));
  // SETTLE AS A RUNTIME SERVICE (owner ruling settle-runtime-service): the settler runs for this job right away,
  // detached and outside the op's identity, so a green done report settles without waiting for the Kernel's turn and
  // anything else is handed to the Kernel as needs-kernel-decision (scripts/kernel/settle/job-settle.mjs).
  if (!isSpecRun()) startSettlerFor(repo, { workflowId: job.workflow_id, jobId: job.job_id });

  },
};
