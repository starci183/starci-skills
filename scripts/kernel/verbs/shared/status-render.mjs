// cmdStatus (verbs/status.mjs): the workflow projection phases in ledger order, each writing its slice of
// the status context `s`, ending in the emitted object and text.
import path from 'node:path';
import { runtimeProfile } from '../../../../engine/config.mjs';
import { planAncestorsOf } from '../../../route/plan-edges.mjs';
import { workGraphStatus } from '../../../work/work-graph-store.mjs';
import { JOB_ROW } from '../../../machine/job-row.mjs';
import { getWorkflow, goalJsonOf, jobPayloadOf, latestGoal } from './rows.mjs';
import { kernelSeatOf } from './kernel-seat.mjs';
import { drainWorkflowMessages, workerQuestionsOf } from './worker-messages.mjs';
import { blockingHeadsUp, leaseCanonOf, openPeerWaits, pendingPeerMessagesOf, releaseTypedWaits } from './peer-waits.mjs';
import { hostThrottle, throttleSummary } from '../../../machine/ram-throttle.mjs';
import { AUTOPILOT_RULING, autopilotSettings, autopilotSweep } from '../../autopilot-run.mjs';
import { wakeKernelForTransition } from '../../wake-delivery.mjs';
import { kernelRevState, revRootOf } from '../../runtime-rev.mjs';
import { ownerSpecs, deferredTestsOf, specsOff } from '../../../route/spec-deferral.mjs';
import { dependenciesOf, dependencyGraph } from '../../dependency-graph.mjs';
import { jobDisplayNameOf, opLabel, workflowDisplayName } from '../../../lib/display-names.mjs';
import { typedIncidents } from '../../gate-conditions.mjs';
import { blockingJobs, blockingOthersOf, orderQueuedByBlocking } from '../../waiter-priority.mjs';
import { opMetrics, stuckOf } from '../../../machine/op-metrics.mjs';
import { kernelNotesOf, whyOf } from '../../why.mjs';
import { asksPhase } from './status-asks.mjs';
import { settlePhase } from './status-settle.mjs';
import { driftPhase, handoverPhase } from './status-drift.mjs';
import { frontierOf, frontierStateOf } from './status-frontier.mjs';
import { cutPhase, decorPhase } from './status-decor.mjs';
import { statusText } from './status-lines.mjs';

const tryOr = (fn, fallback) => { try { return fn(); } catch { return fallback; } };

const preludePhase = (s) => {
  const { ledger, db, workflowId, wf, args, repo, now, ext, internals } = s;
  if (ext.status.length) internals.setStatusAsk({ ctx: { ledger, db, wf, workflowId, args, repo, now } });
  // Typed release conditions first (scripts/kernel/gate-conditions.mjs): a wait whose --until-*
  // conditions all hold is resolved here - on every status, so on every watchdog tick - before the
  // gates below are read, so what it held reads ready (actionable) in this same projection.
  s.typedWaits = wf.phase === 'finished' ? { resolved: [], open: [] } : releaseTypedWaits(ledger, { repo: path.resolve(args.repo ?? process.cwd()), workflowId });
  s.typedUnmeetable = s.typedWaits.open.filter((incident) => incident.unmeetable.length > 0);
  // Autopilot (scripts/kernel/autopilot-run.mjs, owner ruling 2026-09-28): on every status - so every watchdog tick -
  // pending asks are answered provisionally or deferred to handover, owner gates re-routed to the Supervisor, timed-out
  // supervisor gates deferred and budgets checked, before anything below is projected. Never fails the read.
  s.autopilotSettingsNow = autopilotSettings();
  s.autopilotSweepOut = null;
  if (wf.phase !== 'running' || wf.archived_at != null) return;
  try {
    s.autopilotSweepOut = autopilotSweep({ ledger, repo: path.resolve(args.repo ?? process.cwd()), workflowId, settings: s.autopilotSettingsNow,
      wake: (l, o) => wakeKernelForTransition(l, { workflowId: o.workflowId, transition: 'ask-answered', ids: { dispatchId: o.dispatchId }, lines: [
        `autopilot answered ask ${o.dispatchId} (answeredBy autopilot, owner ruling ${AUTOPILOT_RULING}); receipt ${o.receiptPath}.`,
        'Re-read canonical starci kernel status now and run nextActions: re-enqueue the asking op --retry-of its job so it applies the receipt.'] }) });
  } catch (error) { s.autopilotSweepOut = { on: true, errors: [{ error: String(error?.message ?? error).slice(0, 300) }], answered: [], deferred: [], rerouted: [], timedOut: [], supplied: [] }; }
};

const jobsPhase = (s) => {
  const { db, workflowId, internals } = s;
  const { FINAL_SETTLED, observeOperationWorker, recordWorkerOutageEvidence, renewLiveWorkerLeases, statusWorkerRowsOf } = internals;
  s.byStatus = {};
  for (const r of db.prepare('SELECT status,count(*) n FROM jobs WHERE workflow_id=? GROUP BY status ORDER BY status').all(workflowId)) s.byStatus[r.status] = r.n;
  s.inboxPending = db.prepare("SELECT count(*) n FROM inbox WHERE workflow_id=? AND status='pending'").get(workflowId).n;
  // Filed op reports — the kernel's exact "is it done and with what result"
  // signal. A report is keyed by its attempt (op_attempts), which names its job.
  s.reports = db.prepare(
    `SELECT r.dispatch_id, a.op_id, a.try_no AS attempt, r.outcome, r.consumed_at, r.created_at, r.job_id
     FROM reports r JOIN op_attempts a ON a.attempt_id=r.attempt_id
     WHERE r.workflow_id=? ORDER BY r.created_at`
  ).all(workflowId);
  // Report age alone is not worker liveness. Project the exact operation
  // terminal's host state and output freshness so the Kernel never labels a
  // live, thinking worker as wedged or attempts a duplicate same-job spawn.
  s.workers = statusWorkerRowsOf(db, workflowId).map((job) => observeOperationWorker(job, s.now, db));
  // A worker that is still running keeps its path leases: status renews them while its liveness is
  // not proven dead, so a long op no longer loses its fence at dispatchLeaseTtlMs and reads
  // leases=0 while a peer could be granted its paths (inc-2262f5eab354).
  renewLiveWorkerLeases(s.ledger, s.workers, s.now);
  // A worker whose screen shows its provider's outage row (quota spent, no capacity) opens that provider's
  // circuit, so route/dispatch skip the pool at once instead of after the worker goes quiet.
  s.outageCircuits = recordWorkerOutageEvidence(s.ledger, s.workers, s.now);
  s.leases = db.prepare('SELECT resource_key,job_id,expires_at FROM leases WHERE workflow_id=? AND expires_at>? ORDER BY resource_key').all(workflowId, s.now);
  // Operations the Kernel can move right now with no wait at all: a queued job
  // to route/dispatch, a fenced launch to reconcile. An 'engaged' frontier that
  // holds one of these is not a reason to yield.
  s.openOperations = db.prepare(`SELECT count(*) n FROM jobs WHERE workflow_id=? AND kind<>'kernel'
      AND status NOT IN (${FINAL_SETTLED.map(() => '?').join(',')})`).get(workflowId, ...FINAL_SETTLED).n;
  s.fencedOperations = db.prepare(`SELECT count(*) n FROM jobs WHERE workflow_id=? AND kind<>'kernel'
      AND status='effect_unknown'`).get(workflowId).n;
  // Why each queued job is not running. A queued row is the dispatch candidate;
  // without this the Kernel can only see that it did not move, not what to
  // clear. The causes and their order are QUEUED_BECAUSE above.
  s.workflowJobs = db.prepare("SELECT job_id,workflow_id,unit_id,op_id,status,try_no AS attempt,payload_json,created_at FROM jobs WHERE workflow_id=? AND kind<>'kernel' ORDER BY created_at,job_id").all(workflowId);
  s.jobsByOp = new Map();
  for (const row of s.workflowJobs) {
    if (!row.op_id) continue;
    if (!s.jobsByOp.has(row.op_id)) s.jobsByOp.set(row.op_id, []);
    s.jobsByOp.get(row.op_id).push(row);
  }
};

const queuedView = (db, row, queuedBecauseOf, ctx) => {
  const foundation = jobPayloadOf(row).foundation;
  return { jobId: row.job_id, opId: row.op_id ?? null, attempt: row.attempt,
    ...queuedBecauseOf(db, row, ctx),
    ...(foundation ? { foundation } : {}) };
};

const queuePhase = (s) => {
  const { db, workflowId, wf, args, internals } = s;
  const { QUEUED_BECAUSE, approvedLegOps, opSlotAdmission, poolLoadOf, openOwnerGates, queuedBecauseOf, recordDependencies } = internals;
  const repoRoot = path.resolve(args.repo ?? process.cwd());
  const goalJson = goalJsonOf(latestGoal(db, workflowId));
  s.legOps = approvedLegOps(goalJson);
  s.planAncestors = planAncestorsOf(goalJson ?? {});
  s.workGraph = wf.phase === 'finished' ? null : workGraphStatus(db, workflowId);
  const slots = opSlotAdmission(db, workflowId);
  const rtDoc = runtimeProfile();
  // Pool load worker-wide - the same count `starci kernel route` reasons with (poolLoadOf), so status and route agree.
  s.poolLoad = poolLoadOf(db, { now: s.now });
  s.ownerGates = openOwnerGates(db, workflowId);
  s.peerWaits = openPeerWaits(db, workflowId);
  const recordDeps = recordDependencies(repoRoot, s.workflowJobs);
  const typedGates = tryOr(() => typedIncidents(db, { workflowId }), []);
  const leaseCanon = leaseCanonOf(db, repoRoot);
  const queueCtx = { planAncestors: s.planAncestors, jobsByOp: s.jobsByOp, slots, rtDoc, poolLoad: s.poolLoad, ownerGates: s.ownerGates, peerWaits: s.peerWaits, recordDeps, canon: leaseCanon, workGraph: s.workGraph, typedGates, now: s.now };
  s.queued = s.workflowJobs.filter((row) => row.status === 'queued').map((row) => queuedView(db, row, queuedBecauseOf, queueCtx));
  // Foundation legs run first (driver-loop.yaml foundations): they lead the queued list the Kernel routes from.
  if (s.queued.some((item) => item.foundation)) s.queued.sort((a, b) => Number(Boolean(b.foundation)) - Number(Boolean(a.foundation)));
  // Waiter priority (scripts/kernel/waiter-priority.mjs): queued jobs other work waits on come first,
  // heaviest (most and oldest waiters) first; frontier.blockingOthers names this workflow's jobs
  // another workflow waits on. A queued one that has blocked a peer past BLOCKING_HEADS_UP_MS gets one
  // heads-up per newly waiting workflow in this inbox: the pending message makes the frontier
  // peer-message (actionable), so the watchdog wakes this Kernel to dispatch it.
  let blocking = new Map();
  try { blocking = blockingJobs(db, { now: s.now }); } catch { blocking = new Map(); }
  orderQueuedByBlocking(s.queued, blocking);
  s.blockingOthers = blockingOthersOf(blocking, workflowId, { now: s.now });
  if (wf.phase === 'running') blockingHeadsUp(s.ledger, { self: wf, blocking, now: s.now });
  // Queued jobs a peer-wait holds are the peer's to unblock: when they are all that is open, the
  // frontier is peer-wait rather than engaged. A wait whose peer is no longer running can never be
  // met by it, so it is the Kernel's move again.
  s.deadPeerWaits = wf.phase === 'finished' ? [] : s.peerWaits.filter((wait) => !wait.peerRunning);
  // Ready means the Kernel can move it now: a queued job nothing holds, or a
  // fenced launch to reconcile. A queued job waiting on a leg, a slot or a
  // circuit is not work the Kernel can do this turn.
  s.readyOperations = s.fencedOperations + s.queued.filter((item) => ['ready', 'dependency-failed'].includes(item.queuedBecause)).length;
  s.queuedCauses = Object.fromEntries(QUEUED_BECAUSE
    .map((cause) => [cause, s.queued.filter((item) => item.queuedBecause === cause).length])
    .filter(([, n]) => n > 0));
};

const workersPhase = (s) => {
  const { DEAD_WORKER_LIVENESS } = s.internals;
  // An allowlisted host dialog (worker.gateAutoAnswer) is nudge-ready too: starci kernel nudge answers it.
  s.nudgeReadyWorkers = s.workers.filter((worker) => (['turn-idle', 'live-idle', 'staged-input'].includes(worker.liveness)
      || (worker.liveness === 'interactive-gate' && worker.gateAutoAnswer && !worker.gateAutoAnswer.loop))
    && !s.reports.some((report) => report.job_id === worker.jobId));
  // A worker whose turn has run past WEDGE_MINUTES on one shell command that
  // still shows no output (terminal-liveness.mjs) is stuck, not busy.
  // A worker back at the same host dialog after the runtime answered it maxPerAttempt times (gate-loop)
  // recovers the same way.
  s.wedgedWorkers = s.workers.filter((worker) => worker.liveness === 'wedged' || worker.liveness === 'gate-loop');
  // A running job whose exact terminal is proven gone (disconnected, or a
  // handle a live Orca no longer knows - every terminal after a host reboot)
  // has no worker left to file its report. Without this it read 'engaged' and
  // nothing ever woke the Kernel. A filed report takes the transition/settle
  // states above instead; starci kernel reconcile --dead-worker recovers the rest.
  s.deadWorkers = s.workers.filter((worker) => DEAD_WORKER_LIVENESS.includes(worker.liveness)
    && ['running', 'answering', 'leased'].includes(worker.ledgerStatus)
    && !s.reports.some((report) => report.job_id === worker.jobId));
};

const messagesPhase = (s) => {
  const { db, ledger, workflowId, wf, internals } = s;
  // A worker that asked its coordinator through `orca orchestration ask` waits
  // on the Kernel until `starci kernel reply` answers (inc-b944cbaef24b). Every status
  // drains the workflow's Runs into the ledger first (orchestration check, then
  // the ledger write, then --ack: api-lib/messages.mjs), so the questions it
  // projects are the ledger's. A finished workflow has no worker left to ask.
  const drained = wf.phase === 'finished' ? { error: null } : drainWorkflowMessages(ledger, workflowId, { rebind: (runId) => internals.bindRunToKernel({ db, ledger, workflowId, runId, by: 'status' }) });
  s.workerAsks = { pending: workerQuestionsOf(db, workflowId).pending, error: drained.error };
  s.workerQuestions = s.workerAsks.pending.map(({ messageId, type, jobId, opId, attempt, question, options, askedAt }) => ({ messageId, type, jobId, opId, attempt, question, options, askedAt }));
  // A peer workflow's pending message (starci kernel notify, or the enqueue overlap
  // heads-up) waits on this Kernel until it reads starci kernel inbox and acks it. It
  // ranks below the reports, settles and blocked workers already in flight.
  s.peerMessages = wf.phase === 'finished' ? []
    : pendingPeerMessagesOf(db, workflowId).map(({ key, from, kind, subject, at }) => ({ key, from, kind, subject, at }));
};

const kernelRevOf = (db, workflowId) => tryOr(() => kernelRevState(db, workflowId, { root: revRootOf() }), null);

const peerMovable = (s, op) => !s.jobsByOp.has(op) && !s.peerHeldOps.has(op)
  && !(s.planAncestors.get(op) ?? []).some((up) => s.peerHeldOps.has(up) && !s.jobsByOp.get(up)?.some((row) => row.status === 'succeeded'));

const graphPhase = (s) => {
  const { db, workflowId, wf, internals } = s;
  const { ACTIONABLE_FRONTIER_STATES, NEXT_ACTION_MOVES, graphProjectionOf, opRevDriftOf, rereadActionOf, runningOpRevDriftOf } = internals;
  s.graph = graphProjectionOf(db, { wf, legOps: s.legOps, planAncestors: s.planAncestors, workflowJobs: s.workflowJobs, jobsByOp: s.jobsByOp, failedRows: s.failedRows, queued: s.queued, ownerGates: s.ownerGates, peerWaits: s.peerWaits, awaitingOwner: s.awaitingOwner, staleReady: s.staleReady, staleProofs: s.staleProofs, credentialWaitOps: s.credentialWaitOps, approvalWaitOps: s.approvalWaitOps, workGraph: s.workGraph, assetSlotsOwed: s.assetSlotsOwed, autopilot: s.autopilotView.graph });
  // The runtime rev the Kernel acked against the runtime's HEAD (runtime-rev.mjs): a stale Kernel re-reads the
  // changed kernel files and acks before anything else, and enqueue/dispatch of a leg whose op contract changed
  // is refused kernel-rev-stale until it does. op-rev-drift: settled legs whose op contract moved after dispatch.
  s.kernelRev = wf.phase === 'finished' ? null : kernelRevOf(db, workflowId);
  if (s.kernelRev?.stale) s.graph.nextActions.unshift(rereadActionOf(s.kernelRev, workflowId));
  s.opRevDriftWarnings = tryOr(() => opRevDriftOf(db, workflowId), []);
  s.runningRevDrift = tryOr(() => runningOpRevDriftOf(db, workflowId), []);
  // With nothing open, a step nextActions names is the Kernel's next move; orphaned-frontier is left for a
  // ledger that names none (a runtime defect, or a workflow with no plan yet).
  // A peer-wait holds only the ops it names (fe-hold-until-landed): an approved leg with no job yet, neither held nor
  // behind a held plan ancestor, is still the Kernel's to enqueue, so the frontier is its move, not the peer's.
  s.peerHeldOps = new Set(s.peerWaits.flatMap((wait) => wait.holds));
  s.peerWaitMovable = s.frontierState === 'peer-wait' ? s.legOps.filter((op) => peerMovable(s, op)) : [];
  if (s.peerWaitMovable.length) s.frontierState = 'orphaned-frontier';
  // A peer-wait holds only the ops it names: an unheld next step is still the Kernel's move (fe-hold-until-landed).
  if (['orphaned-frontier', 'supervisor-wait', 'peer-wait'].includes(s.frontierState) && s.graph.nextActions.some((action) => NEXT_ACTION_MOVES.includes(action.kind) && !action.heldBy)) s.frontierState = 'next-ready';
  s.actionable = ACTIONABLE_FRONTIER_STATES.includes(s.frontierState) || s.kernelRev?.stale === true || s.readyOperations > 0 || s.staleReady.length > 0 || s.askReserve.length > 0 || s.peerMessages.length > 0 || s.deadPeerWaits.length > 0;
};

const ramThrottleOf = (s) => {
  try {
    const t = hostThrottle({ env: process.env, repo: path.resolve(s.args.repo ?? process.cwd()), db: s.db, ledgerFile: s.ledger.path ?? null });
    return { ...throttleSummary(t), priority: t.priorities?.[s.workflowId] ?? { weight: 1, reserve: 0 } };
  } catch (error) { return { error: String(error?.message ?? error) }; }
};

// The cross-workflow dependency graph around this workflow and any Supervisor bridge it takes part in
// (scripts/kernel/dependency-graph.mjs; modules/supervisor/bridging.yaml). Only when it has any.
const dependenciesOfWorkflow = (s) => {
  try {
    const d = dependenciesOf(dependencyGraph(s.db, { repo: s.repo, light: true }), s.workflowId);
    return d.waitsOn.length || d.waitedBy.length || d.findings.length || d.bridges.length ? d : null;
  } catch { return null; }
};

const hostPhase = (s) => {
  const { db, workflowId, wf, now, internals } = s;
  const { foundationDutyOf } = internals;
  // What this workflow owns and needs of the ledger's shared foundations, and whether it still owes a declaration.
  s.foundations = tryOr(() => foundationDutyOf(db, wf), null);
  // The host's RAM-aware dispatch cap (scripts/machine/ram-throttle.mjs): what the next dispatch is admitted against
  // and why, so a Kernel reading a ready job that waits host-resources-low sees the cap, not just the wait.
  s.ramThrottle = ramThrottleOf(s);
  s.dependencies = dependenciesOfWorkflow(s);
  s.kernel = kernelSeatOf(db, workflowId);
  // The stuck SLA and op health (scripts/machine/op-metrics.mjs): every wait this workflow holds, aged against
  // runtimes.yaml allocation.opTelemetry.stuckSla with the owner of its next action, and this workflow's op health
  // over the telemetry window. Read-only; a failure reads as absent, never as a refusal of status.
  s.stuck = [];
  s.opHealth = null;
  if (wf.phase !== 'finished') {
    s.stuck = tryOr(() => stuckOf({ db, workflowId, now, ownerGates: s.ownerGates, peerWaits: s.peerWaits, queued: s.queued, heldSettle: s.heldSettle, settleReady: s.settleReady, awaitingOwner: s.awaitingOwner }), []);
  }
  try { const m = opMetrics(db, { now, workflowId }); s.opHealth = { windowMs: m.windowMs, totals: m.totals, ops: m.ops }; } catch { s.opHealth = null; }
  s.stuckPast = s.stuck.filter((item) => item.severity !== 'ok');
};

/** Attaches each non-green leg's attempt whys; returns the most recently ended one ({op, attemptId, ...why}) or null. */
const attachLegWhys = (db, workflowId, legs) => {
  let newestWhy = null;
  for (const leg of legs) {
    if (['green', 'green-provisional', 'deferred', 'external'].includes(leg.color)) continue;
    const rows = db.prepare('SELECT * FROM op_attempts WHERE workflow_id=? AND op_id=? AND dispatched_at IS NOT NULL ORDER BY attempt_id DESC LIMIT 6').all(workflowId, leg.op);
    const attempts = rows.map((a) => ({ attemptId: a.attempt_id, tryNo: a.try_no, verdict: a.verdict ?? null, endState: a.end_state ?? null, why: whyOf(db, a) })).filter((a) => a.why);
    if (!attempts.length) continue;
    leg.why = attempts[0].why;
    leg.attempts = attempts;
    if (!newestWhy || attempts[0].attemptId > newestWhy.attemptId) newestWhy = { op: leg.op, attemptId: attempts[0].attemptId, ...attempts[0].why };
  }
  return newestWhy;
};

// The names a person reads (scripts/lib/display-names.mjs): the workflow's display name as `title`, each
// leg's and next step's op label, and the op-job name of a step that names its job. Ids stay the keys.
const displayPhase = (s) => {
  const { db, workflowId, repo, internals } = s;
  const { skillRoot } = internals;
  s.title = workflowDisplayName(s.wf);
  const nameCache = new Map();
  // Autopilot keeps its own status word beside the op label (green-provisional: PROVISIONAL_LABEL; deferred).
  for (const leg of s.graph.legs) leg.label = leg.label ? `${opLabel(leg.op)} · ${leg.label}` : opLabel(leg.op);
  for (const action of s.graph.nextActions) {
    action.label = opLabel(action.op);
    if (!action.jobId) continue;
    const row = db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE job_id=?`).get(action.jobId);
    if (row) action.displayName = jobDisplayNameOf(db, row, { repo, workflowName: s.title, cache: nameCache });
  }
  // Why each leg that is not green stands where it does, in the owner's words (scripts/kernel/why.mjs, stored in
  // op_attempts.why_json): leg.why is the latest attempt's, leg.attempts every attempt of the op that needed one (newest
  // first, at most 6); frontier.why is the most recently ended one. Headline first.
  const newestWhy = attachLegWhys(db, workflowId, s.graph.legs);
  if (newestWhy) s.frontier.why = { headline: newestWhy.headline, op: newestWhy.op, state: newestWhy.state, next: newestWhy.next, owner: newestWhy.owner, attemptId: newestWhy.attemptId };
  s.kernelNotes = kernelNotesOf(db, workflowId);
  // The owner's "test later" list: every leg the config.yaml specs switches deferred (starci kernel run-deferred-tests runs them).
  const specs = ownerSpecs(skillRoot);
  s.testsDeferred = { off: specsOff(specs), jobs: deferredTestsOf(db, workflowId), planned: s.graph.legs.filter((leg) => leg.deferred && !leg.jobId).map((leg) => ({ op: leg.op, reason: leg.deferred })) };
};

const statusOut = (s) => ({
  ok: true, workflowId: s.workflowId, title: s.title, slug: s.wf.title ?? null, phase: s.wf.phase ?? null, archivedAt: s.wf.archived_at ?? null,
  frontier: s.frontier, nextActions: s.graph.nextActions, legs: s.graph.legs, testsDeferred: s.testsDeferred, autopilot: s.autopilotView.view,
  workGraph: s.workGraph ? { version: s.workGraph.version, event: s.workGraph.event, counts: s.workGraph.counts, frontier: s.workGraph.frontier.map(({ id, domain, slice, color, lastOp }) => ({ id, domain, slice, color, lastOp })) } : null,
  kernel: s.kernel, jobs: s.byStatus, failures: s.failures, awaitingOwner: s.awaitingOwner, activeLeases: s.leases,
  inboxPending: s.inboxPending, reports: s.reports, workers: s.workers, workerQuestions: s.workerQuestions, peerMessages: s.peerMessages,
  ...(s.workerAsks.error ? { workerQuestionsError: s.workerAsks.error } : {}),
  cutSets: s.cutSets, handover: s.handover, ...s.stale,
  ...(s.foundations ? { foundations: s.foundations } : {}),
  ...(s.outageCircuits.length ? { outageCircuits: s.outageCircuits } : {}),
  ...(s.grammarProposals.length ? { grammarProposals: s.grammarProposals } : {}),
  ...(s.drawReviews.length ? { drawReviews: s.drawReviews } : {}),
  ...(s.knowledgeChangeRequests.length ? { knowledgeChangeRequests: s.knowledgeChangeRequests } : {}),
  ...(s.logTypedMissing.length ? { logTypedMissing: s.logTypedMissing } : {}),
  ...(s.assetSlotsOwed.length ? { assetSlotsOwed: s.assetSlotsOwed } : {}),
  ...(s.kernelRev ? { kernelRev: s.kernelRev } : {}),
  ...(s.opRevDriftWarnings.length ? { opRevDrift: s.opRevDriftWarnings } : {}),
  ...(s.runningRevDrift.length ? { runningOpRevDrift: s.runningRevDrift } : {}),
});

export function cmdStatus(ledger, args, repo, { emit, internals, ext }) {
  const db = ledger.db, workflowId = args.workflow, now = Date.now();
  const wf = getWorkflow(db, workflowId);
  if (!wf) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  const s = { ledger, db, workflowId, args, repo, now, wf, ext, internals };
  preludePhase(s);
  jobsPhase(s);
  queuePhase(s);
  asksPhase(s);
  settlePhase(s);
  workersPhase(s);
  messagesPhase(s);
  handoverPhase(s);
  s.frontierState = frontierStateOf(s);
  driftPhase(s);
  graphPhase(s);
  s.frontier = frontierOf(s);
  decorPhase(s);
  cutPhase(s);
  hostPhase(s);
  displayPhase(s);
  const out = statusOut(s);
  out.opHealth = s.opHealth;
  out.kernelNotes = s.kernelNotes;
  out.stuck = s.stuck;
  out.ramThrottle = s.ramThrottle;
  out.poolLoad = { running: s.poolLoad.byModel, routeHoldMs: s.poolLoad.routeHoldMs };
  if (s.dependencies) out.dependencies = s.dependencies;
  emit(out, statusText(s, out), args.json);
}
