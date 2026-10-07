// The frontier's state word and reason text (verbs/status.mjs): the first state of the Kernel's priority
// order that holds, then the prose that says what the Kernel does next.
import path from 'node:path';
import { launchRefusalViewOf } from './launch-refusal-step.mjs';
import { runtimeProfile } from '../../../../engine/config.mjs';
import { AUTOPILOT_RULING, SUPERVISOR_GATE } from '../../autopilot-run.mjs';
import { typedIncidents } from '../../gate-conditions.mjs';
import { handoverReason } from '../../handover.mjs';
import { hostHoldOf } from '../../host-hold.mjs';
import { parkedBehindWaits, waitHeldOperations, noteParkedBehind } from '../../frontier-parked.mjs';
import { blockingJobs, blockingOthersOf, orderQueuedByBlocking } from '../../waiter-priority.mjs';
import { PEER_WAIT, leaseCanonOf } from './peer-waits.mjs';
import { jobPayloadOf } from './rows.mjs';

const tryOr = (fn, fallback) => { try { return fn(); } catch { return fallback; } };

const STATE_ORDER = [
  { when: (s) => s.wf.phase === 'finished', state: 'finished' },
  { when: (s) => s.unconsumedReports > 0, state: 'transition-ready' },
  { when: (s) => s.settleReady.length > 0, state: 'settle-ready' },
  { when: (s) => s.deadWorkers.length > 0, state: 'worker-dead' },
  { when: (s) => s.workerQuestions.length > 0, state: 'worker-question' },
  { when: (s) => s.nudgeReadyWorkers.length > 0, state: 'worker-nudge-ready' },
  { when: (s) => s.wedgedWorkers.length > 0, state: 'worker-wedged' },
  { when: (s) => s.peerMessages.length > 0, state: 'peer-message' },
  // A held settle's job is still open, but it is the wait's to release, like a held queued job - and
  // so is a queued dependant parked behind either (frontier-parked.mjs waitHeldOperations).
  { when: (s) => s.openOperations > s.waitHeld, state: 'engaged' },
  { when: (s) => s.wf.phase === 'running' && s.handover.state === 'answered', state: 'handover-answered' },
  { when: (s) => s.wf.phase === 'running' && s.handover.state === 'approved', state: 'finish-ready' },
  // Nothing open, but a question is with the owner: the workflow waits on
  // them, not on the Kernel, so nothing should wake it until the answer.
  { when: (s) => s.wf.phase === 'running' && s.askReserve.length > 0, state: 'ask-reserve' },
  // An open owner-gate incident waits on the owner too, even with no job to
  // hold yet (a leg whose first job cannot be enqueued before the owner
  // decides - a frontend workflow waiting on a peer's brand leg).
  { when: (s) => s.wf.phase === 'running' && (s.approvalOwner.length > 0 || s.credentialWait || s.ownerGates.some((gate) => gate.kind !== SUPERVISOR_GATE)), state: 'awaiting-owner' },
  // Autopilot: a supervisor-gate is the Supervisor's step; the Kernel has nothing to move until it resolves.
  { when: (s) => s.wf.phase === 'running' && s.ownerGates.length > 0, state: 'supervisor-wait' },
  // A typed wait on a peer workflow (starci kernel incident --kind peer-wait): the next approved step cannot
  // pass its preflight until the peer lands something, so the peer's message, not the watchdog,
  // wakes the Kernel. Never orphaned-frontier: that re-woke the Kernel for nothing.
  { when: (s) => s.wf.phase === 'running' && s.peerWaits.length > 0, state: 'peer-wait' },
  { when: (s) => s.wf.phase === 'running' && s.handover.due, state: 'handover-due' },
  { when: (s) => s.wf.phase === 'running', state: 'orphaned-frontier' },
];

// A dispatch rejection with no effect returns its job to jobs.status 'ready' — the same launch candidate
// 'queued' is (dispatch-gates.mjs loadQueuedJob admits both). The queue projection took 'queued' rows
// alone, so a reusable job vanished from frontier.queued and nextActions while its row sat ready:
// engaged, actionable false, readyOperations 0, and no wake when the wait holding it lapsed
// (kprop-8d86bcc70b). Each ready row merges into the queue here — after the settle projection, before
// the graph and the actionable count read it — through the SAME admission verdict a queued row gets
// (queuedBecauseOf: the gates, dependencies, slots, provider circuit, leases, pool load and host probe
// dispatch-gates.mjs refuses on), so a job held only by host resources or an open provider circuit
// reads its typed machine wait with the measured value or the expiry, never `ready` and actionable
// (kprop-c0abd30d86), and reads ready the next status call after the machine wait clears.
const admitReadyJobs = (s) => {
  const { db, workflowId, wf, internals } = s;
  const { QUEUED_BECAUSE, queuedBecauseOf, opSlotAdmission, recordDependencies } = internals ?? {};
  if (!Array.isArray(s.workflowJobs) || !Array.isArray(s.queued) || !queuedBecauseOf || !opSlotAdmission) return;
  const projected = new Set(s.queued.map((item) => item.jobId));
  const ready = s.workflowJobs.filter((row) => row.status === 'ready' && !projected.has(row.job_id));
  if (!ready.length) return;
  const repoRoot = path.resolve(s.args?.repo ?? process.cwd());
  let hostHold = null;
  const hostHoldFor = (op) => {
    hostHold ??= hostHoldOf({ env: process.env, repo: repoRoot, workflowId, db, ledgerFile: s.ledger?.path ?? null });
    return hostHold(op);
  };
  const queueCtx = {
    planAncestors: s.planAncestors, jobsByOp: s.jobsByOp, slots: opSlotAdmission(db, workflowId),
    rtDoc: runtimeProfile(), poolLoad: s.poolLoad, ownerGates: s.ownerGates, peerWaits: s.peerWaits,
    recordDeps: recordDependencies ? tryOr(() => recordDependencies(repoRoot, s.workflowJobs), new Map()) : new Map(),
    canon: tryOr(() => leaseCanonOf(db, repoRoot), null), workGraph: s.workGraph,
    typedGates: tryOr(() => typedIncidents(db, { workflowId }), []), now: s.now,
    // hostResourcesFor shares the one probe a status call takes (host-resources.mjs HOST_SAMPLE_MS), so
    // judging the merged rows against the floor dispatch refuses on costs no extra sample.
    hostHold: wf?.phase === 'finished' ? null : hostHoldFor,
  };
  for (const row of ready) {
    const foundation = jobPayloadOf(row).foundation;
    s.queued.push({ jobId: row.job_id, opId: row.op_id ?? null, attempt: row.attempt,
      ...queuedBecauseOf(db, row, queueCtx), ...launchRefusalViewOf(db, row), ...(foundation ? { foundation } : {}) });
  }
  // The ordering and counts the queue projection settled over the shorter list answer for the merged
  // rows too: waiters' weight first, then the parked-behind notes and the engaged test's wait-held count
  // (a ready dependant of a wait-held job is parked, not engaged work).
  try {
    const blocking = blockingJobs(db, { now: s.now });
    orderQueuedByBlocking(s.queued, blocking);
    s.blockingOthers = blockingOthersOf(blocking, workflowId, { now: s.now });
  } catch { /* ordering only */ }
  s.readyOperations = (s.fencedOperations ?? 0) + s.queued.filter((item) => ['ready', 'dependency-failed'].includes(item.queuedBecause)).length;
  s.queuedCauses = Object.fromEntries((QUEUED_BECAUSE ?? [])
    .map((cause) => [cause, s.queued.filter((item) => item.queuedBecause === cause).length])
    .filter(([, n]) => n > 0));
  s.parkedBehind = parkedBehindWaits(s.queued, s.heldSettle ?? []);
  for (const item of s.queued) { if (!item.parkedBehind) noteParkedBehind(item, s.parkedBehind.get(item.jobId)); }
  s.waitHeld = waitHeldOperations(s.queued, s.heldSettle ?? [], s.parkedBehind);
  s.parkedDependants = s.queued.filter((item) => item.parkedBehind && (item.parkedBehind.settle || item.parkedBehind.heldBecause === PEER_WAIT));
};

/** The frontier state word: the first state of the Kernel's priority order that holds. */
export const frontierStateOf = (s) => {
  admitReadyJobs(s);
  for (const { when, state } of STATE_ORDER) {
    if (when(s)) return state;
  }
  return 'idle';
};

// An unanswered ask never reaches the owner (reserve), but a louder state already in flight still wins.
const ASK_RESERVE_QUIET = new Set(['transition-ready', 'settle-ready', 'worker-dead', 'worker-nudge-ready', 'worker-wedged', 'peer-message', 'handover-answered', 'finish-ready']);

const reserveReason = (s) => `unanswered ask(s) ${s.askReserve.join(', ')} never reached the owner (not notified on Telegram, and no live form: never served, or the serve-ask ttl expired); park each with starci kernel serve-ask --workflow <id> --dispatch <id> before yielding`;

const questionReason = (s) => {
  const asked = s.workerQuestions.map((item) => `${item.jobId} (${item.messageId})`).join(', ');
  return `${asked} asked or escalated to the coordinator through Orca and wait for the answer; run starci kernel questions, then starci kernel reply --message <id> --body <answer> for a technical answer inside the job's authority, or --to-owner when it needs the owner (the worker then files outcome ask and serve-ask carries it)`;
};

const settleReason = (s) => `${s.settleReady.join(', ')} filed a report you consumed but never settled; run starci kernel record-checks and starci kernel settle for each before yielding`;

const deadReason = (s) => {
  const dead = s.deadWorkers.map((worker) => `${worker.jobId} (${worker.liveness})`).join(', ');
  return `${dead} read running but their worker can never file a report; run starci kernel reconcile --job <id> --dead-worker --settle-failed for each (the watchdog does it on its next tick)`;
};

const wedgedReason = (s) => {
  const wedged = s.wedgedWorkers.map((worker) => {
    if (worker.liveness !== 'gate-loop') return worker.jobId;
    const gate = worker.gateAutoAnswer?.gate ?? worker.gate;
    return `${worker.jobId} (gate-loop: host dialog ${gate} back after ${worker.gateAutoAnswer?.answers} answers)`;
  }).join(', ');
  return `${wedged} wedged (one silent command past the wedge threshold, or a host dialog back after its answers); nudge refuses them - run starci kernel reconcile --job <id> --dead-worker --settle-failed for each`;
};

const peerMessageReason = (s) => {
  const messages = s.peerMessages.map((message) => `${message.key} ${message.kind} from ${message.from}`).join(', ');
  return `${s.peerMessages.length} peer message(s) wait on you (${messages}); read starci kernel inbox --workflow <id>, act on each (a request in your scope becomes work, a heads-up adjusts your plan, answer with starci kernel notify --kind reply --reply-to <key>), then ack each with starci kernel inbox --ack <key> --disposition <what you did> before yielding`;
};

const parkedDependantText = (item) => `${item.jobId} (after ${item.parkedBehind.via})`;
const parkedDependantsText = (items) => items.map(parkedDependantText).join(', ');

const awaitingOwnerReason = (s) => {
  const { heldSettleText } = s.internals;
  const pending = s.pendingOwner.length ? `${s.pendingOwner.length} unanswered ask(s) (${s.pendingOwner.map((item) => item.dispatchId).join(', ')})` : null;
  const gates = s.ownerGates.length ? `owner-gate incident(s) ${s.ownerGates.map((gate) => gate.incidentId).join(', ')}` : null;
  const holds = [pending, gates].filter(Boolean).join(' and ');
  const onDemand = s.askOnDemand.length ? `; ${s.askOnDemand.join(', ')} ${askOnDemandVerb(s.askOnDemand)} on Telegram behind a Generate URL button (an approval ask in the chat, a credential ask in the /creds list; the form is served when the owner presses it; nothing to re-serve)` : '';
  return `no operation is open and the owner holds ${holds}${heldSettleText(s.heldSettle)}${onDemand}; the answer or starci kernel incident --resolve wakes the Kernel`;
};

const askOnDemandVerb = (items) => items.length === 1 ? 'is' : 'are';

const supervisorReason = (s) => {
  const gates = s.ownerGates.map((gate) => gate.incidentId).join(', ');
  return `no operation the Kernel can move: supervisor-gate(s) ${gates} hold what is left (autopilot, owner ruling ${AUTOPILOT_RULING}); the Supervisor fixes or decides the retry and resolves --by supervisor, which wakes the Kernel - never ask the owner`;
};

const peerWaitReason = (s) => {
  const { heldSettleText } = s.internals;
  if (s.deadPeerWaits.length) {
    const dead = s.deadPeerWaits.map((wait) => `${wait.incidentId} on ${wait.peer} (${wait.peerPhase})`).join(', ');
    return `peer-wait ${dead} can no longer be met: the peer is not running; re-check the prerequisite yourself, then resolve the wait (starci kernel incident --resolve) and continue, or raise what is still missing`;
  }
  const waits = s.peerWaits.map((wait) => {
    const holds = wait.holds.length ? ` (holds ${wait.holds.join(', ')})` : '';
    return `peer-wait ${wait.incidentId} waits on ${wait.peer}${holds}: ${wait.detail.slice(0, 160)}`;
  }).join('; ');
  const parked = s.parkedDependants.length ? `; queued behind the wait: ${parkedDependantsText(s.parkedDependants)}` : '';
  const resolution = s.peerWaits.every((wait) => wait.untilMessage) ? ' and resolves the wait' : '; resolve the wait (starci kernel incident --resolve) once its proof holds';
  return `no operation the Kernel can move: ${waits}${heldSettleText(s.heldSettle)}${parked}; a peer message from the awaited peer (starci kernel notify) wakes the Kernel${resolution}`;
};

const nextReadyReason = (s) => {
  const { NEXT_ACTION_MOVES, nextActionLabel } = s.internals;
  const steps = s.graph.nextActions.filter((action) => NEXT_ACTION_MOVES.includes(action.kind)).map(nextActionLabel).join('; ');
  return `no operation is open and the ledger names the next steps: ${steps}; run nextActions in order before yielding${credentialSuffix(s)}`;
};

const credentialSuffix = (s) => (s.credentialAsks.length ? `; credential ask(s) ${s.credentialAsks.join(', ')} hold only the live-proof legs: enqueue ${s.mainLineOwed.join(', ')} now with placeholder values (credentialPending)` : '');

const peerMovableReason = (s) => {
  const waits = s.peerWaits.map((wait) => wait.incidentId).join(', ');
  const held = [...s.peerHeldOps].join(', ');
  const movable = s.peerWaitMovable.join(', ');
  return `peer-wait ${waits} holds only ${held} (the runtime releases it itself; never resolve it by hand); the approved legs ${movable} are not held: enqueue and dispatch them now in plan order`;
};

const orphanedReason = (s) => `workflow is running but has no open operation and no unconsumed report; Kernel must derive/repair the next approved transition or finish; a next step that waits on a peer workflow is recorded as starci kernel incident --kind peer-wait --peer <workflowId>, never left orphaned${credentialSuffix(s)}`;

const NUDGE_READY_REASON = 'one or more exact running workers are at an idle provider prompt, hold an unsubmitted paste in their input row, or wait on a host dialog their agent card allowlists, without a report; Kernel must call starci kernel nudge for each listed job now (a staged paste gets one Enter, an allowlisted dialog gets its card answer)';

const staleReason = (s) => {
  const { staleLabel } = s.internals;
  const redo = s.staleRedo.length ? `settled ${s.staleRedo.map((item) => staleLabel(item)).join(', ')} read product records their own workflow owns that changed since they settled with no peer job writing them (not by their own workflow's later legs); re-dispatch each as a new attempt of the same op and cut ordinal (a cut seam-first) before yielding` : null;
  const followUp = s.staleFollowUp.length ? `the owner of a record ${s.staleFollowUp.map((item) => staleLabel(item)).join(', ')} read declared its committed change breaking; enqueue ONE follow-up leg for each (a new attempt of that op and cut ordinal only - never a seam-first cascade, never a redo of other slices or peers) before yielding` : null;
  return [redo, followUp].filter(Boolean).join('; ');
};

const readyReason = (s) => {
  const steps = s.queued.filter((item) => item.policy).map((item) => `${item.jobId} ${item.policy}`);
  return ['queued or fenced operations are waiting on the Kernel; route/dispatch or reconcile them before yielding', ...steps].join('; ');
};

const REASON_ORDER = [
  [(s) => s.frontierState === 'ask-reserve' || (s.askReserve.length > 0 && !ASK_RESERVE_QUIET.has(s.frontierState)), reserveReason],
  [(s) => s.frontierState === 'worker-question', questionReason],
  [(s) => s.frontierState === 'settle-ready', settleReason],
  [(s) => s.frontierState === 'worker-dead', deadReason],
  [(s) => s.frontierState === 'worker-wedged', wedgedReason],
  [(s) => s.frontierState === 'peer-message', peerMessageReason],
  [(s) => ['handover-answered', 'finish-ready', 'handover-due'].includes(s.frontierState), (s) => handoverReason(s.handover, s.workflowId)],
  [(s) => s.frontierState === 'awaiting-owner', awaitingOwnerReason],
  [(s) => s.frontierState === 'supervisor-wait', supervisorReason],
  [(s) => s.frontierState === 'peer-wait' || s.deadPeerWaits.length > 0, peerWaitReason],
  [(s) => s.frontierState === 'next-ready', nextReadyReason],
  [(s) => s.frontierState === 'orphaned-frontier' && s.peerWaitMovable.length, peerMovableReason],
  [(s) => s.frontierState === 'orphaned-frontier', orphanedReason],
  [(s) => s.frontierState === 'worker-nudge-ready', () => NUDGE_READY_REASON],
  [(s) => s.actionable && s.readyOperations > 0, readyReason],
  [(s) => s.staleReady.length > 0, staleReason],
];

/** The frontier's reason text: the first case in the Kernel's priority order that holds, else null. */
const frontierReasonOf = (s) => {
  for (const [when, text] of REASON_ORDER) {
    if (when(s)) return text(s);
  }
  return null;
};

const peerWaitView = ({ incidentId, peer, peerPhase, holds, detail, untilMessage, refs, since, untilFoundation, untilLanded }) => ({
  incidentId, peer, peerPhase, holds, detail, untilMessage, refs, since,
  ...(untilFoundation ? { untilFoundation } : {}), ...(untilLanded ? { untilLanded } : {}),
});

/** The frontier object the status projection emits. */
export const frontierOf = (s) => ({
  state: s.frontierState,
  actionable: s.actionable,
  openOperations: s.openOperations,
  readyOperations: s.readyOperations,
  staleOperations: s.staleOperations,
  unconsumedReports: s.unconsumedReports,
  nudgeReadyJobs: s.nudgeReadyWorkers.map((worker) => worker.jobId),
  workerQuestionJobs: [...new Set(s.workerQuestions.map((item) => item.jobId))],
  wedgedJobs: s.wedgedWorkers.map((worker) => worker.jobId),
  deadWorkerJobs: s.deadWorkers.map((worker) => worker.jobId),
  settleReadyJobs: s.settleReady,
  heldSettleJobs: s.heldSettle,
  heldWorkerJobs: s.heldWorkers,
  askReserveDispatches: s.askReserve,
  askOnDemandDispatches: s.askOnDemand,
  credentialAskDispatches: s.credentialAsks,
  peerMessageKeys: s.peerMessages.map((message) => message.key),
  peerWaits: s.peerWaits.map(peerWaitView),
  ...(s.sourceDrift ? { sourceDrift: s.sourceDrift } : {}),
  ...(s.peerDrift ? { peerDrift: s.peerDrift } : {}),
  ...(s.staleProofs.length ? { staleProofs: s.staleProofs } : {}),
  ...(s.staleProofsError ? { staleProofsError: s.staleProofsError } : {}),
  peerWaitsDead: s.deadPeerWaits.map((wait) => wait.incidentId),
  queued: s.queued,
  queuedCauses: s.queuedCauses,
  reason: frontierReasonOf(s),
});
