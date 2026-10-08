// starci kernel settle: prove the filed report and independent checks before recording a verdict.
import fs from 'node:fs';
import path from 'node:path';
import { updateJob } from '../../../engine/db/ledger.mjs';
import { AWAITING_OWNER, AWAITING_OWNER_STATUS } from '../../../engine/admission.mjs';
import { withWorkflowLock } from '../workflow-checkpoint.mjs';
import { preparedSettlementOf } from '../workflow-checkpoint-state.mjs';
import { parseJson } from '../../lib/json.mjs';
import { jobOpOf, jobPayloadOf, jobRowOf } from './shared/rows.mjs';
import { releaseTypedWaits } from './shared/peer-waits.mjs';
import { queueTail as queueSettleTail, startTail as startSettleTail } from '../settle/job-settle.mjs';
import { OP_REV_DRIFT, shortRev } from '../runtime-rev.mjs';
import { unbindGuardTerminal } from '../../guards/hook-install.mjs';
import { settlePreflight } from './shared/settle-preflight.mjs';
import { newSettleState, settleUnderLock } from './shared/settle-accept.mjs';
import { finalizeAttemptTranscript } from '../transcripts.mjs';
import { landShellFoundationIfSettled } from '../shell-foundation.mjs';
import { parseYaml } from '../../../engine/yaml.mjs';
import { recordSettledCriticRuns } from '../../work/critic-run-record.mjs';
import { isSpecRun } from '../../lib/env.mjs';

const peerNoteOf = (peerBlocked, verdict) => {
  if (!peerBlocked) return '';
  const attemptNote = verdict === 'pass' ? '' : ': no business attempt spent';
  return ` (peer-blocked ${peerBlocked.checks.join(', ')}${attemptNote}; hand it to the peer: ${peerBlocked.routes.join(' ; ')})`;
};

const nextNoteOf = (nextStep) => {
  if (!nextStep) return '';
  const jobsNote = nextStep.jobs?.length ? ` ${nextStep.jobs.join(',')}` : '';
  const incidentNote = nextStep.incidentId ? ` ${nextStep.incidentId}` : '';
  return ` next=${nextStep.kind}${jobsNote}${incidentNote} (${nextStep.reason})`;
};

const workerNoteOf = (managedWorker) => {
  if (!managedWorker) return '';
  const dispatchState = managedWorker.dispatch?.state ?? '?';
  const stopped = managedWorker.stop?.ok ?? '-';
  const releasedState = managedWorker.release?.ok ?? '-';
  const custodyState = managedWorker.custody?.state ?? 'unknown';
  const proofNote = managedWorker.custody?.proof ? ` (${managedWorker.custody.proof})` : '';
  return `, worker ${managedWorker.dispatchId} dispatch=${dispatchState} stop=${stopped} release=${releasedState} custody=${custodyState}${proofNote}`;
};

const sessionNoteOf = (sessionReleased) => {
  if (!sessionReleased) return '';
  let outcome;
  if (sessionReleased.released) outcome = `archived ${sessionReleased.files?.length ?? 0} file(s)`;
  else outcome = `release skipped (${sessionReleased.reason})`;
  return `, session ${outcome}`;
};

const cutNoteOf = (cutSet) => {
  if (!cutSet) return '';
  const state = cutSet.closesSet ? 'CLOSED' : `open ${cutSet.open.join(',')}`;
  return `, cut ${cutSet.id} ${state}`;
};

function settleSummaryOf({ jobId, verdict, awaitingOwner, peerBlocked, status, nextStep, released, reportsConsumed, managedWorker, sessionReleased, cutSet }) {
  const awaitingNote = awaitingOwner ? ` (${AWAITING_OWNER}: no business attempt spent)` : '';
  const consumedNote = reportsConsumed ? ', report consumed' : '';
  const workerNote = workerNoteOf(managedWorker);
  const sessionNote = sessionNoteOf(sessionReleased);
  return `settled ${jobId} verdict=${verdict}${awaitingNote}${peerNoteOf(peerBlocked, verdict)} status=${status}${nextNoteOf(nextStep)} (leases released: ${released}${consumedNote}${workerNote}${sessionNote}${cutNoteOf(cutSet)})`;
}

/** The job row of a settle call; an unknown or already settled job refuses with its code. */
function unsettledJobOrThrow(db, jobId, SETTLED) {
  const initialJob = jobRowOf(db, jobId);
  if (!initialJob) throw Object.assign(new Error(`unknown job ${jobId}`), { code: 'job-unknown' });
  if (SETTLED.includes(initialJob.status) && initialJob.status !== 'effect_unknown') {
    throw Object.assign(new Error(`job ${jobId} is already settled (${initialJob.status})`), { code: 'job-settled' });
  }
  return initialJob;
}

/** A job that never reached a dispatch has no attempt to settle; its drop is `reconcile --drop`. */
function refuseUndispatched(db, jobId) {
  const settling = db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId);
  if (!settling || !['queued', 'ready', 'leased'].includes(settling.status)) return;
  // a dispatch killed mid-launch leaves a leased job whose payload.launchTerminal (or an op_attempts
  // row) names what it created — that IS dispatched; settle must close the orphaned terminal.
  const dispatched = db.prepare('SELECT 1 FROM op_attempts WHERE job_id=? LIMIT 1').get(jobId) != null
    || db.prepare("SELECT json_extract(payload_json,'$.launchTerminal.handle') h FROM jobs WHERE job_id=?").get(jobId)?.h != null;
  if (!dispatched) {
    throw Object.assign(new Error(`job ${jobId} is ${settling.status}: it was never dispatched, so there is no attempt to settle; drop it with starci kernel reconcile --job ${jobId} --drop`), { code: 'job-not-dispatched', status: settling.status });
  }
}

/**
 * The worker's terminal guard binding (<guards root>/terminals/<handle>.json) dies with its
 * terminal: unbind it at settle too, not only inside the close, so a worker released while held,
 * a close that predated binding cleanup, or a failed close that still left the terminal gone never
 * leaves the binding to the seven-day prune. Removing a missing file is a no-op.
 */
function unbindWorkerGuards(skillRoot, handles) {
  const guardUnbound = [];
  for (const handle of handles.filter(Boolean)) {
    try { if (unbindGuardTerminal({ skillRoot, handle })) guardUnbound.push(handle); } catch { /* pruned by age later */ }
  }
  return guardUnbound;
}

/** The managed worker's release: its Dispatch stop/release proof, or the proof of a release made while the settle was held. */
function managedWorkerOf(settledPayload, managed, releasedEarlier, internals) {
  if (!managed?.dispatchId) return null;
  if (!releasedEarlier) return internals.releaseManagedWorker(settledPayload);
  return { ...(settledPayload.managedWorker ?? { dispatchId: managed.dispatchId }), releasedWhileHeld: true,
    custody: { state: 'released', proof: 'released-while-held', at: releasedEarlier.at ?? null } };
}

/**
 * The settled op's Orca terminal is released with its leases — worker_id is the handle. Runs after the settled state is
 * written; a close failure never un-settles. Managed jobs hold a Dispatch id in worker_id, not a terminal handle — they
 * take the worker-stop/-release path, never terminal close.
 */
function releaseSettledWorker({ ledger, db, jobId, st, internals }) {
  const job = st.job;
  const settledPayload = jobPayloadOf(job);
  const managed = internals.heldDispatchOf(settledPayload);
  // A worker released while this settle was held (reconcile --release-worker) is already gone: its
  // recorded proof is the release, and nothing is quit, closed or released again.
  const releasedEarlier = internals.releasedWhileHeldOf(settledPayload);
  // Managed settle — calls.yaml settle-dispatch: releaseManagedWorker.
  const managedWorker = managedWorkerOf(settledPayload, managed, releasedEarlier, internals);
  // A released worker's output stays readable from Orca's archive: the fullest read becomes op_attempts.transcript_sha.
  if (managedWorker && !releasedEarlier && st.settledAttemptId != null) finalizeAttemptTranscript(ledger, { attemptId: st.settledAttemptId, dispatch: managed.dispatchId });
  const guardUnbound = unbindWorkerGuards(internals.skillRoot, [managed ? managed.agentTerminalHandle : job.worker_id]);
  // The worker receipt is kept on the job (with the Dispatch state releaseManagedWorker read): settle's
  // stdout is the only other place it lived, and an orphaned op terminal left no trace. The op's Orca Task
  // is not closed here: the op's worker_done settled it with the Dispatch (orca-deep-map REPLACE #9).
  if (managedWorker) {
    const stored = parseJson(db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(jobId)?.payload_json) ?? {};
    ledger.transaction(() => updateJob(db, { jobId, payload: { ...stored, managedWorker } }));
  }
  return { managedWorker, guardUnbound };
}

/**
 * LIGHT SETTLE, HEAVY WORK ASYNC (owner ruling settle-runtime-service): everything before the tail is the settle's
 * synchronous core (verdict, leases, worker release, next-step enqueue, ledger events). The tail - session
 * retention, the Telegram media, the input re-baseline, artifact indexing with its evidence copy and typed logs -
 * runs in a detached `starci kernel settle-tail` (scripts/kernel/verbs/settle-tail.mjs) queued under the ledger's
 * settle-tail/ dir: it can neither block nor fail the settle, and a failed run is logged and retried by the
 * settler (scripts/kernel/settle/job-settle.mjs retryDueTails). Under the test runner, or with --sync-tail, it runs inline.
 */
async function settleTailOf({ ledger, db, jobId, job, repo, verdict, args, internals }) {
  if (isSpecRun() || args['sync-tail']) {
    const ran = await internals.runSettleTail(ledger, jobRowOf(db, jobId) ?? job, repo, { verdict });
    return { tail: { mode: 'sync', ok: ran.ok }, sessionReleased: ran.sessionReleased, artifacts: ran.artifacts };
  }
  let queued = null, pid = null;
  try { queued = queueSettleTail(repo, jobId); pid = startSettleTail(repo, jobId); } catch (error) { queued = { error: String(error?.message ?? error) }; }
  return { tail: { mode: 'async', queued: typeof queued === 'string' ? queued : null, pid, ...(queued?.error ? { error: queued.error } : {}) }, sessionReleased: null, artifacts: null };
}

/**
 * A passed interface.draw of the workflow that owns foundation `shell` lands it once the tree is settled: every
 * dependent draw waiting on the shell (foundation-wait) is released. Best effort - a stalled owner is the Supervisor's.
 */
function landInterfaceShell({ ledger, db, jobId, job, repo, verdict, internals }) {
  if (verdict !== 'pass' || jobOpOf(job) !== 'interface.draw') return null;
  try {
    const brief = parseYaml(fs.readFileSync(path.join(internals.skillRoot, 'modules', 'ops', 'ops', 'interface.draw.yaml'), 'utf8'));
    return landShellFoundationIfSettled(ledger, { job, brief, payload: jobPayloadOf(jobRowOf(db, jobId) ?? job), repo });
  } catch { return null; }
}

/** The result object's leading part: the verdict, its status and what the settle recorded about the job's artifacts and slots. */
function settleOutHeadOf({ jobId, verdict, status, awaitingOwner, artifacts, shellLanded, grammarProposals, assetSlots }) {
  return {
    ok: true, jobId, verdict, status, awaitingOwner, artifacts,
    ...(shellLanded ? { shellFoundation: shellLanded } : {}),
    ...(grammarProposals.length ? { grammarProposals: grammarProposals.map(({ name, file, complete }) => ({ name, file, complete })) } : {}),
    ...(assetSlots.owed.length ? { assetSlotsOwed: assetSlots.owed.map(({ key, html, requested }) => ({ key, html, requested })) } : {}),
    ...(assetSlots.filled.length ? { assetSlotsFilled: assetSlots.filled.map(({ key, sha256 }) => ({ key, sha256 })) } : {}),
  };
}

/** The result object's middle part: the filed report, the evidence and the state the acceptance recorded. */
function settleOutBodyOf(st) {
  const { peerBlocked, nextStep, handoverApproval, cutSet, citations } = st;
  return {
    report: st.filedReport, reportFiled: st.reportFiled, reportOutcome: st.reportOutcome, checkEvidence: st.checkEvidence, claimOverruled: st.claimOverruled,
    ...(peerBlocked ? { peerBlocked } : {}),
    ...(nextStep ? { nextStep } : {}),
    ...(handoverApproval ? { handoverApproved: { dispatchId: handoverApproval.ask.dispatchId, answeredBy: handoverApproval.ask.answeredBy } } : {}),
    ...(cutSet ? { cutSet: { id: cutSet.id, total: cutSet.total, closesSet: cutSet.open.length === 0, open: cutSet.open } } : {}),
    leasesReleased: st.released, reportsConsumed: st.reportsConsumed,
    ...(citations ? { citations } : {}),
  };
}

/** The result object's trailing part: the worker release, the session, the checkpoint and the runtime drift. */
function settleOutTailOf({ guardUnbound, managedWorker, sessionReleased, checkpoint, revDrift, tail }) {
  return {
    ...(guardUnbound.length ? { guardUnbound } : {}),
    ...(managedWorker ? { managedWorker } : {}),
    ...(sessionReleased ? { sessionReleased } : {}),
    ...(checkpoint ? { checkpoint } : {}),
    ...(revDrift ? { opRevDrift: revDrift } : {}),
    tail,
  };
}

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
    const { SETTLED, reportDispatchIdOf, recordOpRevDrift, recordSettledAssetSlots, recordSettledGrammarProposals } = internals;

    const db = ledger.db, jobId = args.job, verdict = args.verdict;
    const initialJob = unsettledJobOrThrow(db, jobId, SETTLED);
    const dispatchId = reportDispatchIdOf(db, initialJob);
    const replayAttempt = dispatchId ? db.prepare('SELECT a.attempt_id, a.worktree_path, c.context_json FROM op_attempts a LEFT JOIN contracts c ON c.attempt_id=a.attempt_id WHERE a.workflow_id=? AND a.dispatch_id=?').get(initialJob.workflow_id, dispatchId) : null;
    const preparedDecision = () => preparedSettlementOf({ db }, { workflowId: initialJob.workflow_id, opId: jobId, attemptId: replayAttempt?.attempt_id ?? null });
    const replay = preparedDecision();
    if (replay && (replay.verdict !== verdict || replay.job.status !== initialJob.status)) {
      throw Object.assign(new Error(`settle ${jobId} must recover its prepared ${replay.verdict} decision without changing dispatch or status`), { code: 'workflow-checkpoint-recovery-conflict' });
    }
    // A report lives only in the reports table (starci kernel report files it from the job scratch):
    // settle judges the filed row and never reads a report file. A --report path is ignored.
    if (args.report) console.error(`starci kernel settle WARN: --report ${args.report} is ignored; settle reads the report the job filed (starci kernel report)`);
    refuseUndispatched(db, jobId);

    const { proofs } = await settlePreflight({ ledger, args, repo, emit, internals, replay, verdict, jobId });

    const st = newSettleState();
    const ctx = { st, db, ledger, repo, emit, args, internals, jobId, verdict, dispatchId, proofs, replayAttempt, preparedDecision };
    withWorkflowLock({ db, ledger, repo, env: process.env }, { workflowId: initialJob.workflow_id }, (locked) => settleUnderLock(ctx, locked));
    const job = st.job;

    const { managedWorker, guardUnbound } = releaseSettledWorker({ ledger, db, jobId, st, internals });
    const { tail, sessionReleased, artifacts } = await settleTailOf({ ledger, db, jobId, job, repo, verdict, args, internals });
    const shellLanded = landInterfaceShell({ ledger, db, jobId, job, repo, verdict, internals });
    const grammarProposals = recordSettledGrammarProposals(ledger, job, repo);
    recordSettledCriticRuns(ledger, job, repo);
    const assetSlots = recordSettledAssetSlots(ledger, job, repo);
    const revDrift = recordOpRevDrift(ledger, job);
    let status = 'failed';
    if (verdict === 'pass') status = 'succeeded';
    else if (st.awaitingOwner) status = AWAITING_OWNER_STATUS;
    const out = { ...settleOutHeadOf({ jobId, verdict, status, awaitingOwner: st.awaitingOwner, artifacts, shellLanded, grammarProposals, assetSlots }),
      ...settleOutBodyOf(st), ...settleOutTailOf({ guardUnbound, managedWorker, sessionReleased, checkpoint: st.checkpoint, revDrift, tail }) };
    if (revDrift) console.error(`starci kernel settle WARN ${OP_REV_DRIFT}: ${jobId} (${revDrift.op}) was dispatched under runtime rev ${shortRev(revDrift.from)}; its op contract changed on main by ${shortRev(revDrift.to)}: ${revDrift.files.join(', ')} - judged as admitted, never refused`);
    // A typed --until-job wait on this job, in any workflow of the ledger, may hold now: release it and
    // wake that Kernel instead of leaving it to the next watchdog tick (gate-conditions.mjs).
    const typedReleased = releaseTypedWaits(ledger, { repo, wake: true, self: job.workflow_id }).resolved;
    if (typedReleased.length) out.autoResolved = typedReleased.map(({ incidentId, workflowId: waiter, evidence, wake }) => ({ incidentId, workflowId: waiter, evidence, ...(wake ? { wake } : {}) }));
    emit(out, settleSummaryOf({ jobId, verdict, awaitingOwner: st.awaitingOwner, peerBlocked: st.peerBlocked, status, nextStep: st.nextStep, released: st.released, reportsConsumed: st.reportsConsumed, managedWorker, sessionReleased, cutSet: out.cutSet }), args.json);
  },
};
