// starci kernel status: workflow projection, action frontier, and bounded host reads.
import path from 'node:path';
import { sameUnit } from '../../../engine/admission.mjs';
import { runtimeProfile } from '../../../engine/config.mjs';
import { ownerClaimAudit, ownerGatesNotOwnerWork } from '../../machine/owner-claim.mjs';
import { isAwaitingOwner } from '../failure-steps.mjs';
import { planAncestorsOf } from '../../route/plan-edges.mjs';
import { workGraphStatus } from '../../work/work-graph-store.mjs';
import { DRAW_REVIEW_OP } from '../../work/draw-review.mjs';
import { parseJson } from '../../lib/json.mjs';
import { JOB_ROW, jobResultSql } from '../../machine/job-row.mjs';
import { getWorkflow, goalJsonOf, jobPayloadOf, jobResultOf, latestGoal } from './shared/rows.mjs';
import { kernelSeatOf } from './shared/kernel-seat.mjs';
import { drainWorkflowMessages, workerQuestionsOf } from './shared/worker-messages.mjs';
import { PEER_WAIT, blockingHeadsUp, leaseCanonOf, openPeerWaits, pendingPeerMessagesOf, releaseTypedWaits } from './shared/peer-waits.mjs';
import { hostThrottle, throttleSummary } from '../../machine/ram-throttle.mjs';
import { askClassOf, isLiveProofOp } from '../ask-server.mjs';
import { AUTOPILOT_RULING, HANDOVER_CREDENTIALS_SUBJECT, SUPERVISOR_GATE, autopilotOn, autopilotProjection, autopilotSettings, autopilotSweep, credentialsOwed, deferralOf, deferredLegsOf, provisionalOps, reopenedOwed } from '../autopilot-run.mjs';
import { wakeKernelForTransition } from '../wake-delivery.mjs';
import { OP_REV_DRIFT, kernelRevState, revRootOf, shortRev } from '../runtime-rev.mjs';
import { ownerSpecs, deferredTestsOf, specsOff } from '../../route/spec-deferral.mjs';
import { HANDOVER_OP, handoverProjection, handoverReason } from '../handover.mjs';
import { peerDriftSummaryOf, sourceDriftSummaryOf, staleOperationsOf } from '../input-digests.mjs';
import { dependenciesOf, dependencyGraph, shortWorkflow } from '../dependency-graph.mjs';
import { jobDisplayNameOf, nameWithId, opLabel, workflowDisplayName } from '../../lib/display-names.mjs';
import { gateConditionView, typedIncidents } from '../gate-conditions.mjs';
import { blockingJobs, blockingOthersOf, orderQueuedByBlocking } from '../waiter-priority.mjs';
import { parkedBehindWaits, waitHeldOperations } from '../frontier-parked.mjs';
import { drawReviewBoard, openKnowledgeRequests } from '../../work/draw-feedback.mjs';
import { openGrammarProposals } from '../../work/grammar-proposal.mjs';
import { openAssetSlots } from '../../work/asset-slot.mjs';
import { staleProofsOf } from '../proof-integrity.mjs';
import { opMetrics, stuckLine, stuckOf } from '../../machine/op-metrics.mjs';
import { kernelNotesOf, whyOf } from '../why.mjs';

function cmdStatus(ledger, args, repo, { emit, internals, ext }) {
  const { ACTIONABLE_FRONTIER_STATES, CUT_SET_CLOSING_CHECK, DEAD_WORKER_LIVENESS, FINAL_SETTLED, LEG_IN_FLIGHT, NEXT_ACTION_MOVES, QUEUED_BECAUSE, approvedLegOps, askFormAlive, cutSeamViewOf, cutSetStateOf, foundationDutyOf, graphProjectionOf, heldSettleText, nextActionLabel, observeOperationWorker, opRevDriftOf, opSlotAdmission, openOwnerGates, ownerGateOf, peerDriftLines, poolLoadOf, queuedBecauseOf, recordDependencies, recordWorkerOutageEvidence, renewLiveWorkerLeases, rereadActionOf, runningOpRevDriftOf, seamActionsOf, skillRoot, sourceDriftLines, staleInputProjection, staleLabel, staleOperationLine, statusWorkerRowsOf, typedLogWarningsOf } = internals;
  const db = ledger.db, workflowId = args.workflow, now = Date.now();
  const wf = getWorkflow(db, workflowId);
  if (!wf) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  if (ext.status.length) internals.setStatusAsk({ ctx: { ledger, db, wf, workflowId, args, repo, now } });
  // Typed release conditions first (scripts/kernel/gate-conditions.mjs): a wait whose --until-*
  // conditions all hold is resolved here - on every status, so on every watchdog tick - before the
  // gates below are read, so what it held reads ready (actionable) in this same projection.
  const typedWaits = wf.phase === 'finished' ? { resolved: [], open: [] } : releaseTypedWaits(ledger, { repo: path.resolve(args.repo ?? process.cwd()), workflowId });
  // A typed condition that can no longer hold (the awaited job settled failed under :succeeded, a
  // named job or incident is gone) is the Kernel's to re-point: actionable, like a dead peer wait.
  const typedUnmeetable = typedWaits.open.filter((incident) => incident.unmeetable.length > 0);
  // Autopilot (scripts/kernel/autopilot-run.mjs, owner ruling 2026-09-28): on every status - so every watchdog tick -
  // pending asks are answered provisionally or deferred to handover, owner gates re-routed to the Supervisor, timed-out
  // supervisor gates deferred and budgets checked, before anything below is projected. Never fails the read.
  const autopilotSettingsNow = autopilotSettings();
  let autopilotSweepOut = null;
  if (wf.phase === 'running' && wf.archived_at == null) {
    try {
      autopilotSweepOut = autopilotSweep({ ledger, repo: path.resolve(args.repo ?? process.cwd()), workflowId, settings: autopilotSettingsNow,
        wake: (l, o) => wakeKernelForTransition(l, { workflowId: o.workflowId, transition: 'ask-answered', ids: { dispatchId: o.dispatchId }, lines: [
          `autopilot answered ask ${o.dispatchId} (answeredBy autopilot, owner ruling ${AUTOPILOT_RULING}); receipt ${o.receiptPath}.`,
          'Re-read canonical starci kernel status now and run nextActions: re-enqueue the asking op --retry-of its job so it applies the receipt.'] }) });
    } catch (error) { autopilotSweepOut = { on: true, errors: [{ error: String(error?.message ?? error).slice(0, 300) }], answered: [], deferred: [], rerouted: [], timedOut: [], supplied: [] }; }
  }
  const byStatus = {};
  for (const r of db.prepare('SELECT status,count(*) n FROM jobs WHERE workflow_id=? GROUP BY status ORDER BY status').all(workflowId)) byStatus[r.status] = r.n;
  const inboxPending = db.prepare("SELECT count(*) n FROM inbox WHERE workflow_id=? AND status='pending'").get(workflowId).n;
  // Filed op reports — the kernel's exact "is it done and with what result"
  // signal. A report is keyed by its attempt (op_attempts), which names its job.
  const reports = db.prepare(
    `SELECT r.dispatch_id, a.op_id, a.try_no AS attempt, r.outcome, r.consumed_at, r.created_at, r.job_id
     FROM reports r JOIN op_attempts a ON a.attempt_id=r.attempt_id
     WHERE r.workflow_id=? ORDER BY r.created_at`
  ).all(workflowId);
  // Report age alone is not worker liveness. Project the exact operation
  // terminal's host state and output freshness so the Kernel never labels a
  // live, thinking worker as wedged or attempts a duplicate same-job spawn.
  const workers = statusWorkerRowsOf(db, workflowId).map((job) => observeOperationWorker(job, now, db));
  // A worker that is still running keeps its path leases: status renews them while its liveness is
  // not proven dead, so a long op no longer loses its fence at dispatchLeaseTtlMs and reads
  // leases=0 while a peer could be granted its paths (inc-2262f5eab354).
  renewLiveWorkerLeases(ledger, workers, now);
  // A worker whose screen shows its provider's outage row (quota spent, no capacity) opens that provider's
  // circuit, so route/dispatch skip the pool at once instead of after the worker goes quiet.
  const outageCircuits = recordWorkerOutageEvidence(ledger, workers, now);
  const leases = db.prepare('SELECT resource_key,job_id,expires_at FROM leases WHERE workflow_id=? AND expires_at>? ORDER BY resource_key').all(workflowId, now);
  const openOperations = db.prepare(`SELECT count(*) n FROM jobs WHERE workflow_id=? AND kind<>'kernel'
      AND status NOT IN (${FINAL_SETTLED.map(() => '?').join(',')})`).get(workflowId, ...FINAL_SETTLED).n;
  // Operations the Kernel can move right now with no wait at all: a queued job
  // to route/dispatch, a fenced launch to reconcile. An 'engaged' frontier that
  // holds one of these is not a reason to yield.
  const fencedOperations = db.prepare(`SELECT count(*) n FROM jobs WHERE workflow_id=? AND kind<>'kernel'
      AND status='effect_unknown'`).get(workflowId).n;
  // Why each queued job is not running. A queued row is the dispatch candidate;
  // without this the Kernel can only see that it did not move, not what to
  // clear. The causes and their order are QUEUED_BECAUSE above.
  const workflowJobs = db.prepare("SELECT job_id,workflow_id,unit_id,op_id,status,try_no AS attempt,payload_json,created_at FROM jobs WHERE workflow_id=? AND kind<>'kernel' ORDER BY created_at,job_id").all(workflowId);
  const jobsByOp = new Map();
  for (const row of workflowJobs) {
    if (!row.op_id) continue;
    if (!jobsByOp.has(row.op_id)) jobsByOp.set(row.op_id, []);
    jobsByOp.get(row.op_id).push(row);
  }
  const goalJson = goalJsonOf(latestGoal(db, workflowId));
  const legOps = approvedLegOps(goalJson);
  const planAncestors = planAncestorsOf(goalJson ?? {});
  const workGraph = wf.phase === 'finished' ? null : workGraphStatus(db, workflowId);
  const slots = opSlotAdmission(db, workflowId);
  const rtDoc = runtimeProfile();
  // Pool load worker-wide - the same count `starci kernel route` reasons with (poolLoadOf), so status and route agree.
  const poolLoad = poolLoadOf(db, { now });
  const ownerGates = openOwnerGates(db, workflowId);
  const peerWaits = openPeerWaits(db, workflowId);
  const recordDeps = recordDependencies(path.resolve(args.repo ?? process.cwd()), workflowJobs);
  const typedGates = (() => { try { return typedIncidents(db, { workflowId }); } catch { return []; } })();
  const leaseCanon = leaseCanonOf(db, path.resolve(args.repo ?? process.cwd()));
  const queued = workflowJobs.filter((row) => row.status === 'queued').map((row) => ({
    jobId: row.job_id, opId: row.op_id ?? null, attempt: row.attempt,
    ...queuedBecauseOf(db, row, { planAncestors, jobsByOp, slots, rtDoc, poolLoad, ownerGates, peerWaits, recordDeps, canon: leaseCanon, workGraph, typedGates, now }),
    ...(jobPayloadOf(row).foundation ? { foundation: jobPayloadOf(row).foundation } : {}),
  }));
  // Foundation legs run first (driver-loop.yaml foundations): they lead the queued list the Kernel routes from.
  if (queued.some((item) => item.foundation)) queued.sort((a, b) => Number(Boolean(b.foundation)) - Number(Boolean(a.foundation)));
  // Waiter priority (scripts/kernel/waiter-priority.mjs): queued jobs other work waits on come first,
  // heaviest (most and oldest waiters) first; frontier.blockingOthers names this workflow's jobs
  // another workflow waits on. A queued one that has blocked a peer past BLOCKING_HEADS_UP_MS gets one
  // heads-up per newly waiting workflow in this inbox: the pending message makes the frontier
  // peer-message (actionable), so the watchdog wakes this Kernel to dispatch it.
  let blocking = new Map();
  try { blocking = blockingJobs(db, { now }); } catch { blocking = new Map(); }
  orderQueuedByBlocking(queued, blocking);
  const blockingOthers = blockingOthersOf(blocking, workflowId, { now });
  if (wf.phase === 'running') blockingHeadsUp(ledger, { self: wf, blocking, now });
  // Queued jobs a peer-wait holds are the peer's to unblock: when they are all that is open, the
  // frontier is peer-wait rather than engaged. A wait whose peer is no longer running can never be
  // met by it, so it is the Kernel's move again.
  const deadPeerWaits = wf.phase === 'finished' ? [] : peerWaits.filter((wait) => !wait.peerRunning);
  // Ready means the Kernel can move it now: a queued job nothing holds, or a
  // fenced launch to reconcile. A queued job waiting on a leg, a slot or a
  // circuit is not work the Kernel can do this turn.
  const readyOperations = fencedOperations + queued.filter((item) => ['ready', 'dependency-failed'].includes(item.queuedBecause)).length;
  const queuedCauses = Object.fromEntries(QUEUED_BECAUSE
    .map((cause) => [cause, queued.filter((item) => item.queuedBecause === cause).length])
    .filter(([, n]) => n > 0));

  // Settled asks are waits on the owner, projected apart from failures. Only an
  // op's latest attempt still waits: an older one was already re-enqueued.
  // Settled non-success rows: a failed try is a failure, an awaiting_owner try (report outcome ask) is a wait on the owner.
  const unsuccessfulRows = db.prepare(`SELECT job_id,workflow_id,unit_id,op_id,status,try_no AS attempt,payload_json,created_at,${jobResultSql('jobs')} AS result_json FROM jobs WHERE workflow_id=? AND kind<>'kernel' AND status IN ('failed','awaiting_owner') ORDER BY created_at,job_id`).all(workflowId);
  const ownerWaits = unsuccessfulRows.filter((row) => isAwaitingOwner(db, row));
  const failedRows = unsuccessfulRows.filter((row) => row.status === 'failed');
  const askAnswers = new Map();
  // The last lifecycle event wins; an ask parked again (served, or notified
  // for on-demand serving) after a supersede is pending again until answered.
  for (const event of db.prepare("SELECT kind,payload_json FROM events WHERE workflow_id=? AND kind IN ('ask-answered','ask-superseded','ask-serving','ask-notified') ORDER BY seq").all(workflowId)) {
    const dispatchId = parseJson(event.payload_json, {})?.dispatchId;
    if (!dispatchId) continue;
    if (event.kind === 'ask-serving' || event.kind === 'ask-notified') { if (askAnswers.get(dispatchId) === 'superseded') askAnswers.delete(dispatchId); continue; }
    askAnswers.set(dispatchId, event.kind === 'ask-answered' ? 'answered' : 'superseded');
  }
  // One op may hold several owner waits at once - three provision.ask jobs,
  // one per subject, or one ask per cut slice. A wait is replaced only by a
  // later job of the same op with the same lineage (params.subject, else the
  // cut id and ordinal); without either the op's latest attempt waits.
  const subjectOfJob = (jobId) => {
    const payload = parseJson(db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(jobId)?.payload_json, {}) ?? {};
    const subject = payload.params?.subject;
    if (typeof subject === 'string' && subject.trim()) return `subject:${subject.trim()}`;
    if (payload.cut?.id != null && payload.cut?.ordinal != null) return `cut:${payload.cut.id}#${payload.cut.ordinal}`;
    return null;
  };
  const stillWaits = (row) => {
    const subject = subjectOfJob(row.job_id);
    // Neither subject nor cut: the wait holds until a later job of the same op AND the same unit of
    // work unit exists (scripts/kernel/units.mjs) - an unrelated same-op job enqueued meanwhile
    // is not its successor (inc-2f7968ede59c: two served asks vanished from awaitingOwner).
    if (!subject) {
      const own = workflowJobs.find((j) => j.job_id === row.job_id) ?? row;
      // Try numbers count per unit: a later try of the same unit replaces it.
      return !workflowJobs.some((other) => other.op_id === row.op_id && sameUnit(other, own) && other.attempt > own.attempt && other.status !== 'cancelled'
        && !subjectOfJob(other.job_id));
    }
    // "Later" across units is by enqueue time (try numbers are per unit).
    return !workflowJobs.some((other) => other.op_id === row.op_id && other.job_id !== row.job_id && other.created_at > row.created_at && subjectOfJob(other.job_id) === subject);
  };
  const askDispatchOf = (row) => jobResultOf(row).askDispatchId
    ?? db.prepare("SELECT dispatch_id FROM reports WHERE job_id=? AND outcome='ask' ORDER BY created_at DESC LIMIT 1").get(row.job_id)?.dispatch_id
    ?? null;
  // An ask nobody answered or retired still waits on the owner whatever its
  // lineage: a later job of the same op without a shared subject or cut is not
  // its replacement.
  const pendingAsk = (row) => { const d = askDispatchOf(row); return Boolean(d) && !askAnswers.has(d); };
  const awaitingOwner = ownerWaits.filter((row) => stillWaits(row) || pendingAsk(row)).map((row) => {
    const dispatchId = askDispatchOf(row);
    const answer = (dispatchId && askAnswers.get(dispatchId)) ?? 'pending';
    // A pending ask autopilot deferred to handover waits on nobody now (autopilot.deferredToHandover lists it).
    const deferral = answer === 'pending' && dispatchId ? deferralOf(db, workflowId, dispatchId) : null;
    const answered = answer === 'answered' ? parseJson(db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='ask-answered' AND json_extract(payload_json,'$.dispatchId')=? ORDER BY seq DESC LIMIT 1").get(workflowId, dispatchId)?.payload_json, {}) ?? {} : null;
    return { jobId: row.job_id, opId: row.op_id, attempt: row.attempt, dispatchId, answer: deferral ? 'deferred-to-handover' : answer,
      ...(answered?.answeredBy ? { answeredBy: answered.answeredBy } : {}), ...(answered?.provisional ? { provisional: true } : {}) };
  });
  const pendingOwner = awaitingOwner.filter((item) => item.answer === 'pending');
  // A pending ask is only answerable while its serve-ask form is up. The form
  // expires (ask-serving-expired, --ttl) and then the owner's link is dead
  // while the Kernel waits on them: a Modules tax ask sat unanswerable that
  // way. Such an ask is the Kernel's to re-serve, so it is actionable.
  const lastLifecycle = (dispatchId, kind) => db.prepare("SELECT seq FROM events WHERE workflow_id=? AND kind=? AND json_extract(payload_json,'$.dispatchId')=? ORDER BY seq DESC LIMIT 1").get(workflowId, kind, dispatchId)?.seq ?? null;
  // A form that died without expiring is dead too: a product's Modules Kernel
  // served its scope ask as its own Claude Code background shell, Claude Code
  // reaped it under memory pressure, and status kept calling the ask served,
  // so nothing woke the Kernel while the owner's link returned nothing.
  const formLive = (dispatchId) => {
    const served = lastLifecycle(dispatchId, 'ask-serving');
    const expired = lastLifecycle(dispatchId, 'ask-serving-expired');
    if (served == null || (expired != null && expired > served)) return false;
    const payload = parseJson(db.prepare('SELECT payload_json FROM events WHERE seq=?').get(served)?.payload_json, {}) ?? {};
    return askFormAlive(payload) !== false;
  };
  // Owner, 2026-09-24: a form is served only when the owner asks for it. An
  // ask parkAsk told the owner about on Telegram (ask-notified) waits on the
  // owner with no form at all - its link is generated from the chat's button
  // (and regenerated after the form expires or dies) - so it is healthy
  // (askOnDemandDispatches), never the Kernel's to re-serve.
  const askOnDemand = [], askReserve = [];
  for (const item of pendingOwner) {
    if (!item.dispatchId || formLive(item.dispatchId)) continue;
    (lastLifecycle(item.dispatchId, 'ask-notified') != null ? askOnDemand : askReserve).push(item.dispatchId);
  }
  // A credential ask (serve-ask.mjs askClassOf) holds only the live-proof legs: it parks the frontier
  // at awaiting-owner only when every approved leg still owed is a live proof; otherwise the main
  // line reads as if the ask were not there (owner, 2026-09-25).
  const askReportOf = (dispatchId) => db.prepare("SELECT a.op_id, r.report_json FROM reports r JOIN op_attempts a ON a.attempt_id=r.attempt_id WHERE r.workflow_id=? AND r.dispatch_id=? AND r.outcome='ask' ORDER BY r.report_id DESC LIMIT 1").get(workflowId, dispatchId);
  const credentialAsks = pendingOwner.filter((item) => {
    const row = item.dispatchId ? askReportOf(item.dispatchId) : null;
    return row && askClassOf({ opId: row.op_id, question: parseJson(row.report_json, {})?.question }) === 'credential';
  }).map((item) => item.dispatchId);
  const approvalOwner = pendingOwner.filter((item) => !credentialAsks.includes(item.dispatchId));
  // Owed: an approved leg the workflow reached (it has a job, or comes after the last leg that has
  // one - a leg with no job before it is an intake leg the plan never enqueues) with no succeeded job.
  const ownerWaitOps = new Set(awaitingOwner.map((item) => item.opId));
  const lastReached = legOps.reduce((last, op, index) => (jobsByOp.has(op) ? index : last), -1);
  const mainLineOwed = legOps.filter((op, index) => (jobsByOp.has(op) || index > lastReached)
    && op !== HANDOVER_OP && !isLiveProofOp(op) && !ownerWaitOps.has(op)
    && !(jobsByOp.get(op) ?? []).some((row) => row.status === 'succeeded'));
  const credentialWait = credentialAsks.length > 0 && mainLineOwed.length === 0;
  const failures = { failed: failedRows.length, awaitingOwner: ownerWaits.length };

  const unconsumedReports = reports.filter((report) => !report.consumed_at).length;
  // A consumed report whose job is still open is a verdict the Kernel owes:
  // it read the report and yielded before check/settle (a WSPV kernel sat
  // idle on one, and nothing woke it because the frontier read engaged).
  const settleOwed = [...new Set(reports.filter((report) => report.consumed_at && report.job_id).filter((report) => {
    const row = db.prepare('SELECT status FROM jobs WHERE job_id=?').get(report.job_id);
    // A filed report moves its job to reported (starci kernel report); a job still running/answering has a
    // report filed on it by settle's fallback or an older path.
    return row && ['running', 'answering', 'reported'].includes(row.status);
  }).map((report) => report.job_id))];
  // A settle the Kernel deliberately defers behind a recorded wait is not work it can do: an open
  // owner-gate or peer-wait whose --holds (else --op) names the job holds its settle the way it
  // holds a queued job (wf-<product>-app-auth-mudqjob3: op-backend.implement-86ff31372a's cut-closing
  // settle waited on wf-<product>-workspace-provision-mudqjokb's commit under peer-wait inc-9f2e1e7ff1f6,
  // while status read settle-ready ACTIONABLE and the watchdog re-woke the Kernel every tick for
  // nothing). Resolving the wait (starci kernel incident --resolve, or the peer's message for --until-message)
  // makes it settle-ready again, which is actionable and wakes the Kernel.
  const settleReady = [], heldSettle = [];
  for (const jobId of settleOwed) {
    const row = workflowJobs.find((job) => job.job_id === jobId) ?? null;
    const gate = row ? ownerGateOf(ownerGates, row) : null;
    const wait = row && !gate ? ownerGateOf(peerWaits, row) : null;
    if (gate) {
      heldSettle.push({ jobId, opId: row.op_id ?? null, attempt: row.attempt, heldBecause: 'owner-gate', blockedBy: { incident: gate.incidentId },
        detail: `owner-gate incident ${gate.incidentId} holds its settle; the Kernel resolves it (starci kernel incident --resolve) once the owner's step lands, then checks and settles` });
    } else if (wait) {
      heldSettle.push({ jobId, opId: row.op_id ?? null, attempt: row.attempt, heldBecause: PEER_WAIT, blockedBy: { incident: wait.incidentId, peer: wait.peer },
        detail: `peer-wait incident ${wait.incidentId} holds its settle until peer ${wait.peer} lands what it waits on (${wait.detail.slice(0, 160)}); a peer message from ${wait.peer} wakes the Kernel${wait.untilMessage ? ' and resolves the wait' : ', which resolves it (starci kernel incident --resolve) once the proof holds'}, then checks and settles` });
    } else settleReady.push(jobId);
  }
  // A held settle's worker has nothing left to do: its report is consumed and only the wait holds the
  // job. Its terminal and path lease go back now (reconcile --release-worker; the watchdog runs it under
  // --repair), the job stays unsettled for the settle the wait releases (a product's op-integration.verify-
  // 25532858e7 sat leased with its terminal open through the whole peer-wait inc-8cce1cf1b330).
  for (const item of heldSettle) {
    const worker = workers.find((w) => w.jobId === item.jobId) ?? null;
    item.worker = worker?.liveness === 'released' ? 'released' : worker?.terminalHandle ? 'held' : 'none';
    if (worker?.terminalHandle) item.terminalHandle = worker.terminalHandle;
  }
  const heldWorkers = heldSettle.filter((item) => item.worker === 'held').map((item) => item.jobId);
  // A queued dependant whose chain ends in a job a recorded wait holds (queued, or its settle deferred) is
  // parked behind that wait, not engaged work (scripts/kernel/frontier-parked.mjs): it keeps
  // queuedBecause dependency and names the wait in parkedBehind.
  const parkedBehind = parkedBehindWaits(queued, heldSettle);
  for (const item of queued) {
    const root = parkedBehind.get(item.jobId);
    if (!root) continue;
    item.parkedBehind = root;
    item.detail = `${item.detail ?? ''}; parked behind ${root.heldBecause} ${root.incident} through ${root.via}${root.settle ? ' (its settle is deferred)' : ''}`;
  }
  const waitHeld = waitHeldOperations(queued, heldSettle, parkedBehind);
  const parkedDependants = queued.filter((item) => item.parkedBehind && (item.parkedBehind.settle || item.parkedBehind.heldBecause === PEER_WAIT));
  // An allowlisted host dialog (worker.gateAutoAnswer) is nudge-ready too: starci kernel nudge answers it.
  const nudgeReadyWorkers = workers.filter((worker) => (['turn-idle', 'live-idle', 'staged-input'].includes(worker.liveness)
      || (worker.liveness === 'interactive-gate' && worker.gateAutoAnswer && !worker.gateAutoAnswer.loop))
    && !reports.some((report) => report.job_id === worker.jobId));
  // A worker whose turn has run past WEDGE_MINUTES on one shell command that
  // still shows no output (terminal-liveness.mjs) is stuck, not busy.
  // A worker back at the same host dialog after the runtime answered it maxPerAttempt times (gate-loop)
  // recovers the same way.
  const wedgedWorkers = workers.filter((worker) => worker.liveness === 'wedged' || worker.liveness === 'gate-loop');
  // A running job whose exact terminal is proven gone (disconnected, or a
  // handle a live Orca no longer knows - every terminal after a host reboot)
  // has no worker left to file its report. Without this it read 'engaged' and
  // nothing ever woke the Kernel. A filed report takes the transition/settle
  // states above instead; starci kernel reconcile --dead-worker recovers the rest.
  const deadWorkers = workers.filter((worker) => DEAD_WORKER_LIVENESS.includes(worker.liveness)
    && ['running', 'answering', 'leased'].includes(worker.ledgerStatus)
    && !reports.some((report) => report.job_id === worker.jobId));
  // A worker that asked its coordinator through `orca orchestration ask` waits
  // on the Kernel until `starci kernel reply` answers (inc-b944cbaef24b). Every status
  // drains the workflow's Runs into the ledger first (orchestration check, then
  // the ledger write, then --ack: api-lib/messages.mjs), so the questions it
  // projects are the ledger's. A finished workflow has no worker left to ask.
  const drained = wf.phase === 'finished' ? { error: null } : drainWorkflowMessages(ledger, workflowId, { rebind: (runId) => internals.bindRunToKernel({ db, ledger, workflowId, runId, by: 'status' }) });
  const workerAsks = { pending: workerQuestionsOf(db, workflowId).pending, error: drained.error };
  const workerQuestions = workerAsks.pending.map(({ messageId, type, jobId, opId, attempt, question, options, askedAt }) => ({ messageId, type, jobId, opId, attempt, question, options, askedAt }));
  // A peer workflow's pending message (starci kernel notify, or the enqueue overlap
  // heads-up) waits on this Kernel until it reads starci kernel inbox and acks it. It
  // ranks below the reports, settles and blocked workers already in flight.
  const peerMessages = wf.phase === 'finished' ? []
    : pendingPeerMessagesOf(db, workflowId).map(({ key, from, kind, subject, at }) => ({ key, from, kind, subject, at }));
  // The owner handover (scripts/kernel/handover.mjs): an answered handover ask
  // is the Kernel's move, a current owner approval makes finish the next move,
  // and a chain whose every leg settled owes the handover leg.
  // Autopilot: a leg deferred to the final review counts as settled for the handover, and so does a provision.ask
  // leg when nothing is owed to the end-of-flow credential checklist.
  const autopilotSettled = (() => {
    try {
      if (!autopilotOn(db, workflowId, autopilotSettingsNow)) return [];
      const ops = deferredLegsOf(db, workflowId).map((item) => item.opId).filter(Boolean);
      if (!credentialsOwed(db, workflowId).length) ops.push('provision.ask');
      return [...new Set(ops)];
    } catch { return []; }
  })();
  const handover = handoverProjection(db, workflowId, { legOps, alsoSettled: autopilotSettled });
  let frontierState = wf.phase === 'finished' ? 'finished'
    : unconsumedReports > 0 ? 'transition-ready'
    : settleReady.length > 0 ? 'settle-ready'
    : deadWorkers.length > 0 ? 'worker-dead'
    : workerQuestions.length > 0 ? 'worker-question'
    : nudgeReadyWorkers.length > 0 ? 'worker-nudge-ready'
    : wedgedWorkers.length > 0 ? 'worker-wedged'
    : peerMessages.length > 0 ? 'peer-message'
    // A held settle's job is still open, but it is the wait's to release, like a held queued job - and
    // so is a queued dependant parked behind either (frontier-parked.mjs waitHeldOperations).
    : openOperations > waitHeld ? 'engaged'
    : wf.phase === 'running' && handover.state === 'answered' ? 'handover-answered'
    : wf.phase === 'running' && handover.state === 'approved' ? 'finish-ready'
    // Nothing open, but a question is with the owner: the workflow waits on
    // them, not on the Kernel, so nothing should wake it until the answer.
    : wf.phase === 'running' && askReserve.length > 0 ? 'ask-reserve'
    // An open owner-gate incident waits on the owner too, even with no job to
    // hold yet (a leg whose first job cannot be enqueued before the owner
    // decides - a frontend workflow waiting on a peer's brand leg).
    : wf.phase === 'running' && (approvalOwner.length > 0 || credentialWait || ownerGates.some((gate) => gate.kind !== SUPERVISOR_GATE)) ? 'awaiting-owner'
    // Autopilot: a supervisor-gate is the Supervisor's step; the Kernel has nothing to move until it resolves.
    : wf.phase === 'running' && ownerGates.length > 0 ? 'supervisor-wait'
    // A typed wait on a peer workflow (starci kernel incident --kind peer-wait): the next approved step cannot
    // pass its preflight until the peer lands something, so the peer's message, not the watchdog,
    // wakes the Kernel. Never orphaned-frontier: that re-woke the Kernel for nothing.
    : wf.phase === 'running' && peerWaits.length > 0 ? 'peer-wait'
    : wf.phase === 'running' && handover.due ? 'handover-due'
    : wf.phase === 'running' ? 'orphaned-frontier'
    : 'idle';
  // A settled result whose product Work inputs changed and owe work is work the Kernel owes now: an
  // owner-declared breaking change owes ONE follow-up leg (followUp), an unattributed edit of a record
  // the workflow owns a redo as a new attempt (driver-loop.yaml enqueue.cutExecution). A peer's change
  // the owner did not declare breaking is peerDrift, and a Source (knowledge/schemas) edit since
  // admission sourceDrift: both advisory, never owed work.
  const stale = staleInputProjection(db, wf, repo);
  const staleOperations = staleOperationsOf(stale.staleInput);
  const sourceDrift = sourceDriftSummaryOf(stale.sourceDrift);
  const peerDrift = peerDriftSummaryOf(stale.peerDrift);
  const staleReady = staleOperations.filter((item) => !item.heldBy);
  const staleRedo = staleReady.filter((item) => !item.followUp), staleFollowUp = staleReady.filter((item) => item.followUp);
  const credentialWaitOps = new Set(pendingOwner.filter((item) => credentialAsks.includes(item.dispatchId)).map((item) => item.opId));
  const approvalWaitOps = new Set(approvalOwner.map((item) => item.opId));
  // Indexed proofs whose dependencies moved (proof-integrity.mjs staleProofsOf); a projection error rides beside an empty list.
  let staleProofs = [], staleProofsError = null;
  if (wf.phase !== 'finished' && repo) { try { staleProofs = staleProofsOf(db, workflowId, { repo }); } catch (e) { staleProofsError = String(e?.message ?? e); } }
  // Artwork slots interface.draw declared that interface.asset has not filled (asset-slot-owed without -filled).
  const assetSlotsOwed = openAssetSlots(db, workflowId);
  const autopilotView = (() => {
    try {
      const view = autopilotProjection(db, workflowId, { settings: autopilotSettingsNow, sweep: autopilotSweepOut });
      if (!view.on) return { view, graph: null };
      const owed = credentialsOwed(db, workflowId);
      const deferredJobIds = new Set(view.deferred.map((item) => item.jobId));
      const checklistJob = workflowJobs.find((row) => row.op_id === 'provision.ask' && jobPayloadOf(row).params?.subject === HANDOVER_CREDENTIALS_SUBJECT && row.status !== 'cancelled') ?? null;
      const mainLineDone = legOps.filter((op) => op !== HANDOVER_OP && op !== 'provision.ask' && !isLiveProofOp(op))
        .every((op) => (jobsByOp.get(op) ?? []).some((row) => row.status === 'succeeded') || (jobsByOp.get(op) ?? []).some((row) => deferredJobIds.has(row.job_id)));
      const openElsewhere = workflowJobs.some((row) => row.status === 'queued' && !isLiveProofOp(row.op_id) || LEG_IN_FLIGHT.includes(row.status));
      const checklistDue = owed.length > 0 && !checklistJob && mainLineDone && !openElsewhere;
      return { view: { ...view, ...(owed.length ? { checklist: { due: checklistDue, jobId: checklistJob?.job_id ?? null, items: owed.length } } : {}) },
        graph: { on: true, deferred: view.deferred, provisionalOps: provisionalOps(db, workflowId), reopened: reopenedOwed(db, workflowId), credentialsOwed: owed.length > 0,
          checklistDue, checklistApprovals: owed.filter((item) => item.deferClass !== 'credential').map((item) => item.dispatchId).filter(Boolean) } };
    } catch (error) { return { view: { on: autopilotOn(db, workflowId, autopilotSettingsNow), error: String(error?.message ?? error).slice(0, 300) }, graph: null }; }
  })();
  const graph = graphProjectionOf(db, { wf, legOps, planAncestors, workflowJobs, jobsByOp, failedRows, queued, ownerGates, peerWaits, awaitingOwner, staleReady, staleProofs, credentialWaitOps, approvalWaitOps, workGraph, assetSlotsOwed, autopilot: autopilotView.graph });
  // The runtime rev the Kernel acked against the runtime's HEAD (runtime-rev.mjs): a stale Kernel re-reads the
  // changed kernel files and acks before anything else, and enqueue/dispatch of a leg whose op contract changed
  // is refused kernel-rev-stale until it does. op-rev-drift: settled legs whose op contract moved after dispatch.
  const kernelRev = wf.phase === 'finished' ? null : (() => { try { return kernelRevState(db, workflowId, { root: revRootOf() }); } catch { return null; } })();
  if (kernelRev?.stale) graph.nextActions.unshift(rereadActionOf(kernelRev, workflowId));
  const opRevDriftWarnings = (() => { try { return opRevDriftOf(db, workflowId); } catch { return []; } })();
  const runningRevDrift = (() => { try { return runningOpRevDriftOf(db, workflowId); } catch { return []; } })();
  // With nothing open, a step nextActions names is the Kernel's next move; orphaned-frontier is left for a
  // ledger that names none (a runtime defect, or a workflow with no plan yet).
  // A peer-wait holds only the ops it names (fe-hold-until-landed): an approved leg with no job yet, neither held nor
  // behind a held plan ancestor, is still the Kernel's to enqueue, so the frontier is its move, not the peer's.
  const peerHeldOps = new Set(peerWaits.flatMap((wait) => wait.holds));
  const peerWaitMovable = frontierState === 'peer-wait'
    ? legOps.filter((op) => !jobsByOp.has(op) && !peerHeldOps.has(op) && !(planAncestors.get(op) ?? []).some((up) => peerHeldOps.has(up) && !jobsByOp.get(up)?.some((row) => row.status === 'succeeded')))
    : [];
  if (peerWaitMovable.length) frontierState = 'orphaned-frontier';
  // A peer-wait holds only the ops it names: an unheld next step is still the Kernel's move (fe-hold-until-landed).
  if (['orphaned-frontier', 'supervisor-wait', 'peer-wait'].includes(frontierState) && graph.nextActions.some((action) => NEXT_ACTION_MOVES.includes(action.kind) && !action.heldBy)) frontierState = 'next-ready';
  const actionable = ACTIONABLE_FRONTIER_STATES.includes(frontierState) || kernelRev?.stale === true || readyOperations > 0 || staleReady.length > 0 || askReserve.length > 0 || peerMessages.length > 0 || deadPeerWaits.length > 0;
  const frontier = {
    state: frontierState,
    actionable,
    openOperations,
    readyOperations,
    staleOperations,
    unconsumedReports,
    nudgeReadyJobs: nudgeReadyWorkers.map((worker) => worker.jobId),
    workerQuestionJobs: [...new Set(workerQuestions.map((item) => item.jobId))],
    wedgedJobs: wedgedWorkers.map((worker) => worker.jobId),
    deadWorkerJobs: deadWorkers.map((worker) => worker.jobId),
    settleReadyJobs: settleReady,
    heldSettleJobs: heldSettle,
    heldWorkerJobs: heldWorkers,
    askReserveDispatches: askReserve,
    askOnDemandDispatches: askOnDemand,
    credentialAskDispatches: credentialAsks,
    peerMessageKeys: peerMessages.map((message) => message.key),
    peerWaits: peerWaits.map(({ incidentId, peer, peerPhase, holds, detail, untilMessage, refs, since, untilFoundation, untilLanded }) => ({ incidentId, peer, peerPhase, holds, detail, untilMessage, refs, since, ...(untilFoundation ? { untilFoundation } : {}), ...(untilLanded ? { untilLanded } : {}) })),
    ...(sourceDrift ? { sourceDrift } : {}),
    ...(peerDrift ? { peerDrift } : {}),
    ...(staleProofs.length ? { staleProofs } : {}),
    ...(staleProofsError ? { staleProofsError } : {}),
    peerWaitsDead: deadPeerWaits.map((wait) => wait.incidentId),
    queued,
    queuedCauses,
    reason: frontierState === 'ask-reserve' || (askReserve.length > 0 && !['transition-ready', 'settle-ready', 'worker-dead', 'worker-nudge-ready', 'worker-wedged', 'peer-message', 'handover-answered', 'finish-ready'].includes(frontierState))
      ? `unanswered ask(s) ${askReserve.join(', ')} never reached the owner (not notified on Telegram, and no live form: never served, or the serve-ask ttl expired); park each with starci kernel serve-ask --workflow <id> --dispatch <id> before yielding`
      : frontierState === 'worker-question'
      ? `${workerQuestions.map((item) => `${item.jobId} (${item.messageId})`).join(', ')} asked or escalated to the coordinator through Orca and wait for the answer; run starci kernel questions, then starci kernel reply --message <id> --body <answer> for a technical answer inside the job's authority, or --to-owner when it needs the owner (the worker then files outcome ask and serve-ask carries it)`
      : frontierState === 'settle-ready'
      ? `${settleReady.join(', ')} filed a report you consumed but never settled; run starci kernel record-checks and starci kernel settle for each before yielding`
      : frontierState === 'worker-dead'
      ? `${deadWorkers.map((worker) => `${worker.jobId} (${worker.liveness})`).join(', ')} read running but their worker can never file a report; run starci kernel reconcile --job <id> --dead-worker --settle-failed for each (the watchdog does it on its next tick)`
      : frontierState === 'worker-wedged'
      ? `${wedgedWorkers.map((worker) => (worker.liveness === 'gate-loop' ? `${worker.jobId} (gate-loop: host dialog ${worker.gateAutoAnswer?.gate ?? worker.gate} back after ${worker.gateAutoAnswer?.answers} answers)` : worker.jobId)).join(', ')} wedged (one silent command past the wedge threshold, or a host dialog back after its answers); nudge refuses them - run starci kernel reconcile --job <id> --dead-worker --settle-failed for each`
      : frontierState === 'peer-message'
      ? `${peerMessages.length} peer message(s) wait on you (${peerMessages.map((message) => `${message.key} ${message.kind} from ${message.from}`).join(', ')}); read starci kernel inbox --workflow <id>, act on each (a request in your scope becomes work, a heads-up adjusts your plan, answer with starci kernel notify --kind reply --reply-to <key>), then ack each with starci kernel inbox --ack <key> --disposition <what you did> before yielding`
      : ['handover-answered', 'finish-ready', 'handover-due'].includes(frontierState)
      ? handoverReason(handover, workflowId)
      : frontierState === 'awaiting-owner'
      ? `no operation is open and the owner holds ${[pendingOwner.length ? `${pendingOwner.length} unanswered ask(s) (${pendingOwner.map((item) => item.dispatchId).join(', ')})` : null, ownerGates.length ? `owner-gate incident(s) ${ownerGates.map((gate) => gate.incidentId).join(', ')}` : null].filter(Boolean).join(' and ')}${heldSettleText(heldSettle)}${askOnDemand.length ? `; ${askOnDemand.join(', ')} ${askOnDemand.length === 1 ? 'is' : 'are'} on Telegram behind a Generate URL button (an approval ask in the chat, a credential ask in the /creds list; the form is served when the owner presses it; nothing to re-serve)` : ''}; the answer or starci kernel incident --resolve wakes the Kernel`
      : frontierState === 'supervisor-wait'
      ? `no operation the Kernel can move: supervisor-gate(s) ${ownerGates.map((gate) => gate.incidentId).join(', ')} hold what is left (autopilot, owner ruling ${AUTOPILOT_RULING}); the Supervisor fixes or decides the retry and resolves --by supervisor, which wakes the Kernel - never ask the owner`
      : frontierState === 'peer-wait' || deadPeerWaits.length > 0
      ? (deadPeerWaits.length
        ? `peer-wait ${deadPeerWaits.map((wait) => `${wait.incidentId} on ${wait.peer} (${wait.peerPhase})`).join(', ')} can no longer be met: the peer is not running; re-check the prerequisite yourself, then resolve the wait (starci kernel incident --resolve) and continue, or raise what is still missing`
        : `no operation the Kernel can move: ${peerWaits.map((wait) => `peer-wait ${wait.incidentId} waits on ${wait.peer}${wait.holds.length ? ` (holds ${wait.holds.join(', ')})` : ''}: ${wait.detail.slice(0, 160)}`).join('; ')}${heldSettleText(heldSettle)}${parkedDependants.length ? `; queued behind the wait: ${parkedDependants.map((item) => `${item.jobId} (after ${item.parkedBehind.via})`).join(', ')}` : ''}; a peer message from the awaited peer (starci kernel notify) wakes the Kernel${peerWaits.every((wait) => wait.untilMessage) ? ' and resolves the wait' : '; resolve the wait (starci kernel incident --resolve) once its proof holds'}`)
      : frontierState === 'next-ready'
      ? `no operation is open and the ledger names the next steps: ${graph.nextActions.filter((action) => NEXT_ACTION_MOVES.includes(action.kind)).map(nextActionLabel).join('; ')}; run nextActions in order before yielding${credentialAsks.length ? `; credential ask(s) ${credentialAsks.join(', ')} hold only the live-proof legs: enqueue ${mainLineOwed.join(', ')} now with placeholder values (credentialPending)` : ''}`
      : frontierState === 'orphaned-frontier' && peerWaitMovable.length
      ? `peer-wait ${peerWaits.map((wait) => wait.incidentId).join(', ')} holds only ${[...peerHeldOps].join(', ')} (the runtime releases it itself; never resolve it by hand); the approved legs ${peerWaitMovable.join(', ')} are not held: enqueue and dispatch them now in plan order`
      : frontierState === 'orphaned-frontier'
      ? `workflow is running but has no open operation and no unconsumed report; Kernel must derive/repair the next approved transition or finish; a next step that waits on a peer workflow is recorded as starci kernel incident --kind peer-wait --peer <workflowId>, never left orphaned${credentialAsks.length ? `; credential ask(s) ${credentialAsks.join(', ')} hold only the live-proof legs: enqueue ${mainLineOwed.join(', ')} now with placeholder values (credentialPending)` : ''}`
      : frontierState === 'worker-nudge-ready'
        ? 'one or more exact running workers are at an idle provider prompt, hold an unsubmitted paste in their input row, or wait on a host dialog their agent card allowlists, without a report; Kernel must call starci kernel nudge for each listed job now (a staged paste gets one Enter, an allowlisted dialog gets its card answer)'
      : actionable && readyOperations > 0
        ? 'queued or fenced operations are waiting on the Kernel; route/dispatch or reconcile them before yielding'
      : staleReady.length > 0
        ? [staleRedo.length ? `settled ${staleRedo.map((item) => staleLabel(item)).join(', ')} read product records their own workflow owns that changed since they settled with no peer job writing them (not by their own workflow's later legs); re-dispatch each as a new attempt of the same op and cut ordinal (a cut seam-first) before yielding` : null,
          staleFollowUp.length ? `the owner of a record ${staleFollowUp.map((item) => staleLabel(item)).join(', ')} read declared its committed change breaking; enqueue ONE follow-up leg for each (a new attempt of that op and cut ordinal only - never a seam-first cascade, never a redo of other slices or peers) before yielding` : null].filter(Boolean).join('; ')
      : null,
  };
  // Owner-declared product follow-up legs ride on the frontier: they are enqueued, never waited for.

  // Typed release conditions still pending, what this status released, and the jobs of this workflow
  // other workflows wait on (gate-conditions.mjs, waiter-priority.mjs).
  // Each key is present only when non-empty, so a workflow that uses neither reads exactly as before.
  if (typedWaits.open.length) frontier.gateConditions = typedWaits.open.map(gateConditionView);
  if (typedWaits.resolved.length) frontier.autoResolved = typedWaits.resolved.map(({ incidentId, kind, holds, evidence }) => ({ incidentId, kind, holds, evidence }));
  if (blockingOthers.length) frontier.blockingOthers = blockingOthers;
  // Lints (scripts/machine/owner-claim.mjs), present only when non-empty: an open owner-gate whose own text
  // says it is runtime / not-owner work sits in the owner's queue by mistake; a resolution of this workflow
  // that claims an owner decision no owner answer backs is surfaced, never rewritten.
  const notOwnerGates = ownerGatesNotOwnerWork(db, workflowId);
  if (notOwnerGates.length) frontier.ownerGatesNotOwnerWork = notOwnerGates;
  // Grammar proposals interface.draw filed (grammar-proposal-filed) that no grammar lane resolved yet: the owner's to
  // decide, never accepted automatically.
  const grammarProposals = openGrammarProposals(db, workflowId);
  // The owner's image review board (scripts/work/draw-feedback.mjs): per ui record a draw-review ask showed, its
  // review rounds and per shape the open owner notes, addressed or not, and golden status. A redraw the owner asked
  // for and no interface.draw leg has taken up since is a next action - the runtime's, not the Kernel's choice.
  let drawReviews = [];
  try { drawReviews = repo ? drawReviewBoard(db, { workflowId, repo }) : []; } catch { drawReviews = []; }
  const knowledgeChangeRequests = openKnowledgeRequests(db, workflowId);
  for (const entry of drawReviews) {
    if (!entry.redrawOwed) continue;
    const answeredAt = Date.parse(entry.rounds[entry.rounds.length - 1]?.answeredAt ?? '') || 0;
    const takenUp = Number(db.prepare("SELECT MAX(created_at) AS at FROM jobs WHERE workflow_id=? AND op_id=?").get(workflowId, DRAW_REVIEW_OP)?.at ?? 0) > answeredAt;
    if (takenUp || graph.nextActions.some((a) => a.op === DRAW_REVIEW_OP && ['retry', 'dispatch'].includes(a.kind) && (!entry.redrawOwed.jobId || a.jobId === entry.redrawOwed.jobId))) continue;
    graph.nextActions.push({ kind: 'retry', op: DRAW_REVIEW_OP, jobId: entry.redrawOwed.jobId ?? null,
      reason: `the owner asked for a redraw of ${entry.record} in ask ${entry.redrawOwed.dispatchId} (${entry.redrawOwed.notes.length} note(s)): starci kernel enqueue --op ${DRAW_REVIEW_OP}${entry.redrawOwed.jobId ? ` --retry-of ${entry.redrawOwed.jobId}` : ''} - the packet carries the answer (context.owner_answers); the redraw must address every note (draw-feedback.mjs brief)` });
  }
  // LOG_TYPED_MISSING warnings (typed-logs.mjs typedLogGaps): op jobs that settled without the typed rows they owed.
  const logTypedMissing = typedLogWarningsOf(db, workflowId);
  const unprovenClaims = ownerClaimAudit(db, { workflowId });
  if (unprovenClaims.length) frontier.ownerClaimsUnproven = unprovenClaims.map(({ incidentId, kind, resolvedAt, by, claim, reason }) => ({ incidentId, kind, resolvedAt, by, claim, reason }));
  if (typedUnmeetable.length) {
    frontier.actionable = true;
    frontier.gateConditionsUnmeetable = typedUnmeetable.map((incident) => incident.incidentId);
    frontier.reason = [frontier.reason, `typed wait ${typedUnmeetable.map((incident) => `${incident.incidentId} (${incident.unmeetable.join('; ')})`).join(', ')} can no longer be met on its own; re-check the prerequisite, then re-point the wait (starci kernel incident --attach <id> --until-...) or resolve it (starci kernel incident --resolve) and continue`].filter(Boolean).join('; ');
  }
  // Open cut sets and which ordinal's pass closes each: that pass is the one
  // `starci kernel settle` holds to full-regression-final, so the Kernel runs the whole-set
  // integration gate before it (inc-751dd1ac4492). A set with one open ordinal
  // names it; ordinals settle out of order, so it need not be the highest.
  const cutSets = [];
  for (const row of workflowJobs) {
    const cut = jobPayloadOf(row).cut;
    if (!cut?.id || !row.op_id || cutSets.some((set) => set.op === row.op_id && set.id === String(cut.id))) continue;
    const set = cutSetStateOf(db, { workflowId, op: row.op_id, cut });
    if (!set.open.length) continue;
    // The seam's contract-first state (cut-seam.mjs): which siblings run on a stub, which owe a reconcile
    // against the real seam, and - once the seam slipped - the re-cut plan.
    const seamView = cutSeamViewOf(db, { workflowId, op: row.op_id, cutId: set.id, queued });
    cutSets.push({ op: row.op_id, id: set.id, total: set.total, passed: set.passed, open: set.open, jobs: set.jobs,
      ...(set.open.length === 1 ? { closingOrdinal: set.open[0], closingJob: set.jobs[set.open[0]]?.jobId ?? null, closingCheck: CUT_SET_CLOSING_CHECK } : {}),
      ...(seamView ? { seam: seamView } : {}) });
  }
  // Seam duties the Kernel moves now: a reconcile owed (or red) against a landed seam, a re-cut of a seam
  // that slipped. They ride before the waits in nextActions and make the frontier actionable.
  const seamActions = wf.phase === 'finished' ? [] : cutSets.flatMap((set) => seamActionsOf(set));
  if (seamActions.length) {
    const firstWait = graph.nextActions.findIndex((action) => ['owner-gate', 'wait'].includes(action.kind));
    graph.nextActions.splice(firstWait < 0 ? graph.nextActions.length : firstWait, 0, ...seamActions);
    frontier.actionable = true;
    frontier.seamDuties = seamActions.map(({ seamDuty, jobId, cutId }) => ({ duty: seamDuty, jobId, cutId }));
    frontier.reason = [frontier.reason, `cut seam duties: ${seamActions.map((action) => `${action.seamDuty} ${action.jobId ?? action.cutId}`).join(', ')} (nextActions)`].filter(Boolean).join('; ');
  }
  // What this workflow owns and needs of the ledger's shared foundations, and whether it still owes a declaration.
  const foundations = (() => { try { return foundationDutyOf(db, wf); } catch { return null; } })();
  // The host's RAM-aware dispatch cap (scripts/machine/ram-throttle.mjs): what the next dispatch is admitted against
  // and why, so a Kernel reading a ready job that waits host-resources-low sees the cap, not just the wait.
  const ramThrottle = (() => {
    try {
      const t = hostThrottle({ env: process.env, repo: path.resolve(args.repo ?? process.cwd()), db, ledgerFile: ledger.path ?? null });
      return { ...throttleSummary(t), priority: t.priorities?.[workflowId] ?? { weight: 1, reserve: 0 } };
    } catch (error) { return { error: String(error?.message ?? error) }; }
  })();
  // The cross-workflow dependency graph around this workflow and any Supervisor bridge it takes part in
  // (scripts/kernel/dependency-graph.mjs; modules/supervisor/bridging.yaml). Only when it has any.
  const dependencies = (() => {
    try {
      const d = dependenciesOf(dependencyGraph(db, { repo, light: true }), workflowId);
      return d.waitsOn.length || d.waitedBy.length || d.findings.length || d.bridges.length ? d : null;
    } catch { return null; }
  })();
  const kernel = kernelSeatOf(db, workflowId);
  // The stuck SLA and op health (scripts/machine/op-metrics.mjs): every wait this workflow holds, aged against
  // runtimes.yaml allocation.opTelemetry.stuckSla with the owner of its next action, and this workflow's op health
  // over the telemetry window. Read-only; a failure reads as absent, never as a refusal of status.
  let stuck = [], opHealth = null;
  if (wf.phase !== 'finished') {
    try { stuck = stuckOf({ db, workflowId, now, ownerGates, peerWaits, queued, heldSettle, settleReady, awaitingOwner }); } catch { stuck = []; }
  }
  try { const m = opMetrics(db, { now, workflowId }); opHealth = { windowMs: m.windowMs, totals: m.totals, ops: m.ops }; } catch { opHealth = null; }
  const stuckPast = stuck.filter((item) => item.severity !== 'ok');
  // The names a person reads (scripts/lib/display-names.mjs): the workflow's display name as `title`, each
  // leg's and next step's op label, and the op-job name of a step that names its job. Ids stay the keys.
  const title = workflowDisplayName(wf);
  const nameCache = new Map();
  // Autopilot keeps its own status word beside the op label (green-provisional: PROVISIONAL_LABEL; deferred).
  for (const leg of graph.legs) leg.label = leg.label ? `${opLabel(leg.op)} · ${leg.label}` : opLabel(leg.op);
  for (const action of graph.nextActions) {
    action.label = opLabel(action.op);
    if (action.jobId) { const row = db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE job_id=?`).get(action.jobId); if (row) action.displayName = jobDisplayNameOf(db, row, { repo, workflowName: title, cache: nameCache }); }
  }
  // Why each leg that is not green stands where it does, in the owner's words (scripts/kernel/why.mjs, stored in
  // op_attempts.why_json): leg.why is the latest attempt's, leg.attempts every attempt of the op that needed one (newest
  // first, at most 6); frontier.why is the most recently ended one. Headline first.
  let newestWhy = null;
  for (const leg of graph.legs) {
    if (['green', 'green-provisional', 'deferred'].includes(leg.color)) continue;
    const rows = db.prepare('SELECT * FROM op_attempts WHERE workflow_id=? AND op_id=? AND dispatched_at IS NOT NULL ORDER BY attempt_id DESC LIMIT 6').all(workflowId, leg.op);
    const attempts = rows.map((a) => ({ attemptId: a.attempt_id, tryNo: a.try_no, verdict: a.verdict ?? null, endState: a.end_state ?? null, why: whyOf(db, a) })).filter((a) => a.why);
    if (!attempts.length) continue;
    leg.why = attempts[0].why;
    leg.attempts = attempts;
    if (!newestWhy || attempts[0].attemptId > newestWhy.attemptId) newestWhy = { op: leg.op, attemptId: attempts[0].attemptId, ...attempts[0].why };
  }
  if (newestWhy) frontier.why = { headline: newestWhy.headline, op: newestWhy.op, state: newestWhy.state, next: newestWhy.next, owner: newestWhy.owner, attemptId: newestWhy.attemptId };
  const kernelNotes = kernelNotesOf(db, workflowId);
  // The owner's "test later" list: every leg the config.yaml specs switches deferred (starci kernel run-deferred-tests runs them).
  const specs = ownerSpecs(skillRoot);
  const testsDeferred = { off: specsOff(specs), jobs: deferredTestsOf(db, workflowId), planned: graph.legs.filter((leg) => leg.deferred && !leg.jobId).map((leg) => ({ op: leg.op, reason: leg.deferred })) };
  const out = { ok: true, workflowId, title, slug: wf.title ?? null, phase: wf.phase ?? null, archivedAt: wf.archived_at ?? null, frontier, nextActions: graph.nextActions, legs: graph.legs, testsDeferred, autopilot: autopilotView.view, workGraph: workGraph ? { version: workGraph.version, event: workGraph.event, counts: workGraph.counts, frontier: workGraph.frontier.map(({ id, domain, slice, color, lastOp }) => ({ id, domain, slice, color, lastOp })) } : null, kernel, jobs: byStatus, failures, awaitingOwner, activeLeases: leases, inboxPending, reports, workers, workerQuestions, peerMessages, ...(workerAsks.error ? { workerQuestionsError: workerAsks.error } : {}), cutSets, handover, ...stale, ...(foundations ? { foundations } : {}), ...(outageCircuits.length ? { outageCircuits } : {}), ...(grammarProposals.length ? { grammarProposals } : {}), ...(drawReviews.length ? { drawReviews } : {}), ...(knowledgeChangeRequests.length ? { knowledgeChangeRequests } : {}), ...(logTypedMissing.length ? { logTypedMissing } : {}), ...(assetSlotsOwed.length ? { assetSlotsOwed } : {}), ...(kernelRev ? { kernelRev } : {}), ...(opRevDriftWarnings.length ? { opRevDrift: opRevDriftWarnings } : {}), ...(runningRevDrift.length ? { runningOpRevDrift: runningRevDrift } : {}) };
  out.opHealth = opHealth;
  out.kernelNotes = kernelNotes;
  out.stuck = stuck;
  out.ramThrottle = ramThrottle;
  out.poolLoad = { running: poolLoad.byModel, routeHoldMs: poolLoad.routeHoldMs };
  if (dependencies) out.dependencies = dependencies;
  emit(out,
    [
      `${nameWithId(title, workflowId)} phase=${out.phase ?? '-'} frontier=${frontierState}${actionable ? ' ACTIONABLE' : ' (no actionable work)'} jobs{${Object.entries(byStatus).map(([s, n]) => `${s}:${n}`).join(',') || '-'}} failures{failed:${failures.failed},awaiting-owner:${failures.awaitingOwner}} leases=${leases.length} inbox-pending=${inboxPending} reports=${reports.length}(${unconsumedReports} unconsumed) workers=${workers.map((w) => `${w.jobId}:${w.liveness}`).join(',') || '-'}`,
      ...(ramThrottle?.line ? [`  ${ramThrottle.line}`] : []),
      ...(kernel ? [`  kernel: attempt ${kernel.attempt} on ${kernel.terminal ?? '-'} (${kernel.launch ?? '-'} by ${kernel.launchedBy ?? '-'}${kernel.launchedAt ? ` at ${kernel.launchedAt}` : ''})${kernel.you ? ' — this is your terminal' : ''}`] : []),
      ...(kernelRev ? [`  kernel rev: acked ${shortRev(kernelRev.acked) ?? 'none'} current ${shortRev(kernelRev.current) ?? '-'}${kernelRev.stale ? ` STALE (${kernelRev.full ? 're-read kernel-prompt.md and driver-loop.yaml in full' : `${kernelRev.fileCount} file(s)`})` : kernelRev.unacked ? ' (never acked)' : ''}`] : []),
      ...opRevDriftWarnings.map((w) => `  warn ${OP_REV_DRIFT}: ${w.jobId} (${w.op} a${w.attempt ?? '-'}) dispatched at ${shortRev(w.from)}, its op contract changed by ${shortRev(w.to)}: ${(w.files ?? []).slice(0, 5).join(', ')}`),
      ...runningRevDrift.map((w) => `  warn ${OP_REV_DRIFT} (running): ${w.jobId} (${w.op} a${w.attempt ?? '-'}) dispatched at ${shortRev(w.from)}, its op contract changed by ${shortRev(w.to)}: ${(w.files ?? []).slice(0, 5).join(', ')}; it is judged by its admission - starci kernel nudge --job ${w.jobId} carries the notice when its worker is idle`),
      ...outageCircuits.map((c) => `  outage-circuit: ${c.provider} (${c.failureKind}) opened from ${c.jobId}'s screen (${c.match}) until ${c.expiresAt ? new Date(c.expiresAt).toISOString() : 'explicit recovery'}`),
      ...awaitingOwner.map((item) => `  ${item.jobId} (${item.opId} a${item.attempt}) awaiting-owner — ask ${item.dispatchId ?? '-'} ${item.answer}`),
      `  handover: ${handover.state}${handover.ask ? ` ask ${handover.ask.dispatchId} ${handover.ask.state}${handover.ask.decision ? ` ${handover.ask.decision} by ${handover.ask.answeredBy ?? '-'}` : ''}` : ''}${handover.finishAllowed ? ' — finish allowed' : ' — finish refused until the owner approves'}`,
      ...(frontier.reason ? [`  reason: ${frontier.reason}`] : []),
      ...(frontier.why ? [`  why: ${frontier.why.headline} -> ${frontier.why.next}`] : []),
      ...graph.legs.filter((leg) => leg.why).map((leg) => `  why ${leg.op}: ${leg.why.headline}`),
      ...(kernelNotes.length ? [`  kernel notes: ${kernelNotes.slice(-3).map((n) => `${n.kind} ${n.id} [${n.status}] ${n.headline}`).join(' | ')}`] : []),
      ...(stuck.length ? [`  stuck: ${stuck.length} wait(s), ${stuckPast.length} past SLA (${stuckPast.filter((item) => item.severity === 'critical').length} critical)`] : []),
      ...stuckPast.slice(0, 8).map((item) => `    ${stuckLine(item)}`),
      ...(graph.legs.length ? [`  legs: ${graph.legs.map((leg) => `${leg.op}(${leg.label}):${leg.color}${leg.deferred ? '(deferred)' : ''}`).join(' ')}`] : []),
      ...(testsDeferred.jobs.length || testsDeferred.planned.length ? [`  tests deferred (${testsDeferred.off.length ? `owner config.yaml specs ${testsDeferred.off.map((kind) => `${kind}=false`).join(' ')}` : 'specs switches on'}; explicit-ask-only legs such as integration.verify wait for an ask): ${[...testsDeferred.jobs.map((item) => `${item.jobId} ${item.op} (${item.reason})`), ...testsDeferred.planned.map((item) => `${item.op} planned (${item.reason})`)].join('; ')} - starci kernel run-deferred-tests --workflow ${workflowId} [--kind unit|e2e|integration] runs them`] : []),
      ...(workGraph ? [`  work graph v${workGraph.version}: ${Object.entries(workGraph.counts).map(([color, n]) => `${color}:${n}`).join(' ')}; runnable ${workGraph.frontier.map((node) => node.id).join(', ') || '-'}`] : []),
      ...graph.nextActions.map((action, index) => `  next ${index + 1}: ${nextActionLabel(action)} — ${action.reason}`),
      ...(frontier.ownerGatesNotOwnerWork ?? []).map((g) => `  lint owner-gate-not-owner-work: ${g.incidentId} says "${g.marker}" - not the owner's step; a runtime defect goes to the supervisor as --kind source-runtime-defect (the gate only holds jobs), and it resolves --by kernel|supervisor`),
      ...logTypedMissing.slice(0, 5).map((w) => `  warn ${w.code}: ${w.jobId} (${w.op ?? "-"} a${w.attempt ?? "-"}) settled with ${w.opRows} op log row(s); missing ${w.missing.join(", ")}`),
      ...assetSlotsOwed.map((slot) => `  asset-slot-owed: ${slot.key} (${slot.opId ?? '-'} ${slot.jobId ?? '-'}, ${slot.html ?? '-'})${slot.requested ? '' : ' NO REQUEST'} - interface.asset fills it (src + data-asset-sha256)`),
      ...grammarProposals.map((p) => `  grammar-proposal: ${p.name} (${p.opId ?? '-'} ${p.jobId ?? '-'}, ${p.file ?? '-'}) proposed${p.complete ? '' : ' INCOMPLETE'} - the owner decides it through the draw-review ask; a grammar lane records grammar-proposal-resolved`),
      ...drawReviews.map((d) => `  draw-review: ${d.record} ${d.state} round ${d.rounds.length}${d.shapes.map((s) => ` | ${s.shape} ${s.golden}${s.openNotes.length ? ` notes ${s.addressed}/${s.openNotes.length} addressed` : ''}`).join('')}`),
      ...knowledgeChangeRequests.map((k) => `  knowledge-change-requested: ${k.noteId}${k.target ? ` (${k.target})` : ''} from ${k.record ?? '-'}: ${String(k.text).slice(0, 160)} - for the supervisor / runtime owner`),
      ...(frontier.ownerClaimsUnproven ?? []).map((c) => `  lint owner-claim-unproven: ${c.incidentId} (${c.kind ?? '-'}) resolved ${c.resolvedAt} claiming "${c.claim}" - ${c.reason}`),
      ...workerQuestions.map((item) => `  worker-question: ${item.messageId} ${item.jobId} (${item.opId} a${item.attempt}): ${item.question}${item.options?.length ? ` [${item.options.join(' | ')}]` : ''}`),
      ...peerMessages.map((message) => `  peer-message: ${message.key} from ${message.from} [${message.kind}] ${message.subject}`),
      ...peerWaits.map((wait) => `  peer-wait: ${wait.incidentId} on ${wait.peer} (${wait.peerPhase})${wait.holds.length ? ` holds ${wait.holds.join(', ')}` : ''}${wait.untilMessage ? ' until-message' : ''}${wait.untilLanded ? ` until-landed ${wait.untilLanded}` : ''} — ${wait.detail.slice(0, 160)}`),
      ...heldSettle.map((item) => `  held-settle: ${item.jobId} (${item.opId ?? '-'} a${item.attempt}) ${item.heldBecause} ${item.blockedBy.incident} — report consumed, settle deferred behind the wait; worker ${item.worker}${item.worker === 'held' ? ` (release it: starci kernel reconcile --job ${item.jobId} --release-worker)` : ''}`),
      ...askReserve.map((dispatchId) => `  ask-reserve: ${dispatchId} never reached the owner; park it: starci kernel serve-ask --repo <repo> --workflow ${workflowId} --dispatch ${dispatchId}`),
      ...askOnDemand.map((dispatchId) => `  ask-on-demand: ${dispatchId} is on Telegram; the owner generates its link (no form until then)`),
      ...typedWaits.resolved.map((item) => `  auto-resolved: ${item.incidentId} [${item.kind ?? '-'}] every typed condition holds — ${item.evidence.join('; ').slice(0, 240)}`),
      ...typedWaits.open.map((item) => `  gate-conditions: ${item.incidentId} [${item.kind ?? '-'}] ${item.results.map((r) => `${r.condition} ${r.met ? 'MET' : r.unmeetable ? `UNMEETABLE (${r.unmeetable})` : 'pending'}`).join(', ')}`),
      ...blockingOthers.map((item) => `  blocking-others: ${item.jobId} (${item.opId ?? '-'} ${item.status}) — ${item.workflows.length} workflow(s) wait on it for ${item.waitedMinutes}m (${item.workflows.join(', ')}); weight ${item.weight}`),
      ...(queued.length ? [`queued{${Object.entries(queuedCauses).map(([cause, n]) => `${cause}:${n}`).join(',')}}`] : []),
      ...queued.map((item) => `  ${item.jobId} (${item.opId ?? '-'}) ${item.queuedBecause}${item.detail ? ` — ${item.detail}` : ''}`),
      ...staleOperations.map((item) => `  ${staleOperationLine(item)}${item.heldBy ? ` (waits on seam ${item.heldBy})` : ''}`),
      ...sourceDriftLines(sourceDrift, '  '),
      ...peerDriftLines(peerDrift, '  '),
      ...(foundations && (foundations.owns.length || foundations.needs.length || foundations.detail) ? [`  foundations: owns ${foundations.owns.map((f) => `${f.name}:${f.state}`).join(', ') || '-'}; needs ${foundations.needs.map((f) => `${f.name}:${f.state}${f.owner ? ` (${f.owner})` : ''}`).join(', ') || '-'}${foundations.detail ? ` — ${foundations.detail}` : ''}`] : []),
      ...(dependencies ? [`  dependencies: waits on ${dependencies.waitsOn.map(shortWorkflow).join(', ') || '-'}; waited on by ${dependencies.waitedBy.map(shortWorkflow).join(', ') || '-'}`,
        ...dependencies.findings.map((f) => `    ${f.kind}: ${f.summary.slice(0, 200)} -> supervisor ${f.action ?? '-'}${f.clearCut ? ' (clear-cut)' : ''}`),
        ...dependencies.bridges.map((b) => `    bridge ${b.id} ${b.action} ${b.state ?? '-'}${b.provisional ? ' provisional' : ''}${b.workflowId ? ` by ${b.workflowId}` : ''}${b.foundation ? ` owning ${b.foundation}` : ''}: ${b.reason.slice(0, 160)}`)] : []),
      ...cutSets.map((set) => `  cut-set: ${set.op} ${set.id} passed ${set.passed.length}/${set.total}, open ${set.open.join(',')}${set.closingOrdinal ? ` — the pass of ordinal ${set.closingOrdinal}${set.closingJob ? ` (${set.closingJob})` : ''} closes it and records ${set.closingCheck}` : ''}`),
    ].join('\n'),
    args.json);

}

export default {
  verb: 'status',
  required: ['workflow'],
  usageInCore: true,
  async run({ ledger, args, repo, emit, internals, ext }) {
    const prefetched = await internals.prefetchStatusOrcaReads(ledger.db, args.workflow).catch(() => new Map());
    return internals.withStatusSpawnMemo(() => cmdStatus(ledger, args, repo, { emit, internals, ext }), { prefetched });
  },
};
