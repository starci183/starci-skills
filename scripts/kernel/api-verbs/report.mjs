// api report: validate and durably file the worker's report.
import fs from 'node:fs';
import path from 'node:path';
import { parseJson } from '../../lib/json.mjs';
import { validateOpReport } from '../report-envelope.mjs';
import { jobPayloadOf, jobOpOf } from '../api-lib/rows.mjs';
import { HANDOVER_OP, handoverAskProblem } from '../handover.mjs';
import { autopilotOn, autopilotBundle } from '../autopilot.mjs';
import { DRAW_REVIEW_OP, DRAW_REVIEW_CHANGE, DRAW_OWNER_EVERY_CHANGE, DRAW_REVIEW_UNJUDGED_CHANGE, drawReviewsOwed } from '../../work/draw-review.mjs';
import { DRAW_FEEDBACK_CHANGE, reportFeedbackFindings } from '../../work/draw-feedback.mjs';
import { admittedContractOf, loadContractChanges, changeById, admittedBeforeChange } from '../contract-version.mjs';
import { ownerAskConflict } from '../../checks/check-starcistacks.mjs';
import { repeatedAnswerOf, ownerAnswersOf } from '../owner-answers.mjs';
import { foreignReportOwner, relocateForeignReport } from '../report-owner.mjs';
import { renderReportBlock } from '../report-render.mjs';
import { startSettlerFor } from '../../reconcile/job-settle.mjs';

export default {
  verb: 'report',
  required: ['job', 'report'],
  jobOwnerOnly: true,
  usageInCore: true,
  validate(args, need) {
    if (args.outcome) need(['done', 'partial', 'failed', 'ask', 'blocked'].includes(args.outcome),
      `report --outcome must be done|partial|failed|ask|blocked, got '${args.outcome}'`);
  },
  run({ ledger, args, repo, emit, internals }) {
    const { resolveJob, requireDispatchedReportBinding, reportOwnedPaths, reportIdentityOf,
      jobCommitPolicy, handoverProofGate, skillRoot, reportFiledWake, releaseWorkerOnReport } = internals;
  const db = ledger.db, job = resolveJob(db, args.job);
  const jobPayload = jobPayloadOf(job);
  requireDispatchedReportBinding(db, job);
  const reportAbs = [path.resolve(args.report), path.resolve(repo, args.report)].find((p) => fs.existsSync(p));
  if (!reportAbs) throw Object.assign(new Error(`report file missing: ${args.report}`), { code: 'report-missing' });
  // One guarded read: the file that resolved but vanished before the read is a typed refusal,
  // not a raw throw mid-command (G26); everything below parses this same text.
  let reportRaw;
  try { reportRaw = fs.readFileSync(reportAbs, 'utf8'); }
  catch { throw Object.assign(new Error(`report file unreadable: ${reportAbs}`), { code: 'report-unreadable' }); }
  const parsed = parseJson(reportRaw);
  const valid = validateOpReport(parsed, { ownedPaths: reportOwnedPaths(db, job, repo), identity: reportIdentityOf(db, job), commitPolicy: jobCommitPolicy(db, job) });
  if (!valid.ok) throw Object.assign(new Error(`report fails starci/op-report@1: ${valid.reasons.join('; ')}`), { code: 'report-invalid' });
  const report = valid.report;
  if (args.outcome && args.outcome !== report.outcome)
    throw Object.assign(new Error(`--outcome '${args.outcome}' contradicts the envelope's '${report.outcome}'`), { code: 'outcome-mismatch' });
  // The handover ask is the one ask whose answer the kernel routes: its three
  // options are closed and ordered (scripts/kernel/handover.mjs).
  const handoverProblem = jobOpOf(job) === HANDOVER_OP && report.outcome === 'ask' ? handoverAskProblem(report.question) : null;
  if (handoverProblem) throw Object.assign(new Error(`report fails the handover ask: ${handoverProblem}`), { code: 'report-invalid' });
  if (jobOpOf(job) === HANDOVER_OP && report.outcome === 'ask') handoverProofGate(db, job, repo);
  // Autopilot: the handover is the owner's one review, so its ask carries the "sổ chờ thầy xem lại" bundle - every
  // provisional acceptance (with its images), deferred leg, deferred-to-handover proof and autopilot decision.
  if (jobOpOf(job) === HANDOVER_OP && report.outcome === 'ask' && autopilotOn(db, job.workflow_id)) {
    const bundle = autopilotBundle(db, job.workflow_id);
    const carried = report.question?.autopilot;
    const total = bundle.counts.provisional + bundle.counts.deferred + bundle.counts.deferredToHandover;
    if (total > 0 && (carried?.schema !== bundle.schema || ['provisional', 'deferred', 'deferredToHandover'].some((k) => Number(carried?.counts?.[k]) !== bundle.counts[k]))) {
      throw Object.assign(new Error(`report fails the handover ask: under autopilot it carries the final review bundle as question.autopilot, verbatim from the .autopilot block of \`node ${path.join(skillRoot, 'scripts', 'kernel', 'api.mjs')} survey --repo <repo> --workflow ${job.workflow_id} --deliveries --json\` (now ${JSON.stringify(bundle.counts)}), and lists the provisional images in question.assets`), { code: 'report-invalid' });
    }
  }
  // A drawing another leg waits on (a planned layout's design record, a record another dependsOn) is done only once
  // the owner accepted its drawn parts (mia inc-a4b5b1abdd90): a done interface.draw report that leaves one
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
  // ownerAction none with its custody present: a Sonar token or host, a Codecov or GitHub CI setting) never
  // reaches the owner (owner ruling 2026-09-24; scripts/checks/check-starcistacks.mjs ownerAskConflict).
  // The guard fails open: a declaration it cannot read never blocks a report.
  if (report.outcome === 'ask') {
    let declared = null;
    try { declared = ownerAskConflict({ repo, question: report.question }); } catch (error) { console.error(`api report WARNING: stack declaration ask guard unavailable: ${String(error?.message ?? error).slice(0, 200)}`); }
    if (declared) throw Object.assign(new Error(`ask-declared-in-stack: ${declared.message} File done|partial|failed|blocked using the declared custody instead; a custody or server gap is repaired in the stack, never asked of the owner.`), { code: 'ask-declared-in-stack', declared });
  }
  // An ask the job's retry lineage already had answered is never filed again (scripts/kernel/owner-answers.mjs):
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
  // A report path another op's lineage filed first stays that op's verdict: this job's report is filed at
  // report.<jobId>.json beside it and the owner's report is put back (scripts/kernel/report-owner.mjs).
  const foreignOwner = foreignReportOwner(db, reportAbs, op);
  const relocated = foreignOwner ? relocateForeignReport(db, { reportAbs, raw: reportRaw, jobId: job.job_id, owner: foreignOwner }) : null;
  const filedAt = relocated?.report ?? reportAbs;
  const relocation = relocated ? { relocatedFrom: relocated.relocatedFrom, owner: relocated.owner, restored: relocated.restored } : null;
  ledger.transaction(() => {
    const now = Date.now();
    db.prepare('INSERT OR REPLACE INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,from_terminal,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?,NULL,?)')
      .run(job.workflow_id, dispatchId, op, job.attempt, job.generation, report.outcome, JSON.stringify(report),
        jobPayload.managed?.agentTerminalHandle ?? jobPayload.orca?.agentTerminalHandle ?? job.worker_id ?? null, now);
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id,
      kind: 'report-filed', payload: { dispatchId, op, attempt: job.attempt, outcome: report.outcome, report: filedAt, ...(reask ? { reask } : {}), ...(relocation ?? {}) },
    });
  });
  if (reask) console.error(`api report WARNING: ask ${dispatchId} re-asks ${reask.dispatchId}, which is already answered in this job's lineage; declared reason: ${reask.reason}`);
  if (relocation) console.error(`api report WARNING: ${reportAbs} is the report of ${relocation.owner.op} (${relocation.owner.jobId}); this report is filed at ${filedAt}${relocation.restored ? ' and the owner report is back at the path' : ''}. Write your report as report.${job.job_id}.json next time`);
  const kernelWake = reportFiledWake(ledger, {
    workflowId: job.workflow_id,
    transition: `report-filed:${report.outcome}`,
    jobId: job.job_id,
    dispatchId,
  });
  const out = { ok: true, jobId: job.job_id, workflowId: job.workflow_id, dispatchId, outcome: report.outcome, report: filedAt, kernelWake, ...(reask ? { reask } : {}), ...(relocation ?? {}) };
  emit(out, `report filed for ${job.job_id} (dispatch ${dispatchId}, outcome ${report.outcome})`, args.json);
  // The op terminal gets the canonical human rendering of the filed row — the
  // reports row is the truth, this block is its projection.
  console.log(renderReportBlock(report));
  // SETTLE AS A RUNTIME SERVICE (owner ruling settle-runtime-service): the settler runs for this job right away,
  // detached and outside the op's identity, so a green done report settles without waiting for the Kernel's turn and
  // anything else is handed to the Kernel as needs-kernel-decision (scripts/reconcile/job-settle.mjs).
  if (!process.env.NODE_TEST_CONTEXT) startSettlerFor(repo, { workflowId: job.workflow_id, jobId: job.job_id });
  releaseWorkerOnReport(ledger, job, jobPayload, report);

  },
};
