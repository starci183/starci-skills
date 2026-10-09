// The menu phase of `starci kernel status`: the Kernel's decision points (scripts/kernel/kernel-menu.mjs) read from the ledger and the
// projection built so far. The menu is the only actionable section of the status text and the one reason the watchdog wakes a Kernel:
// an empty menu is a wait, whatever the frontier state says. Everything mechanical is the runtime's (the controllers).
import { listDecisions } from '../../../machine/decisions.mjs';
import { JOB_KINDS, liveFor, pendingJobsOf, resolutionOf } from '../../../machine/decision-resolution.mjs';
import { buildMenu, menuCatalog, snoozeMs } from '../../kernel-menu.mjs';
import { feedbackOfHandover } from '../../handover-slices.mjs';
import { decisionsOf } from '../../progress-rca.mjs';
import { keptOpenOf } from '../../settle/prepared-recovery.mjs';
import { currentRuntimeRev, revRootOf } from '../../runtime-rev.mjs';
import { kernelReadManifest, unreadFiles } from '../../required-read.mjs';
import { kernelAuthorityOf, kernelCustodyOf } from './kernel-seat.mjs';
import { failureFactsOf } from '../../failure-class.mjs';
import { failedShapesOf, jobRow, shapeOf } from '../../kernel-authority.mjs';

const LIVE_KERNEL = new Set(['open', 'claimed']);
// Kinds with their own menu kind (or a notice): the generic decision-item kind never repeats them.
const OWN_KIND = new Set(['worker-question', 'rev-ack', 'unread-peer', 'supervisor-ruling', ...JOB_KINDS]);

/** The resolution with the class its evidence decides (scripts/kernel/failure-class.mjs): the menu reads it to withhold the escape from a work failure. */
const withFailure = (db, resolution) => (resolution.jobId ? { ...resolution, failure: failureFactsOf(db, resolution.jobId) } : resolution);

const RUNTIME_OWED_CODES = new Set(['gate-newer-than-admission', 'op-critic-verdict-missing']);
// A prepared fail decision never applied (workflow-checkpoint-recovery-conflict) is the settler's to withdraw when void; once it kept the receipt, finishing the apply is the Kernel's.
const RECOVERY_CONFLICT = 'workflow-checkpoint-recovery-conflict';
/** Whether the settle of a handed-over job is the runtime's to finish. */
const codesOf = (item) => [item.code, ...(item.detail ?? [])].filter(Boolean);
const runtimeOwned = (db, item) => codesOf(item).some((code) => RUNTIME_OWED_CODES.has(code))
  || (codesOf(item).includes(RECOVERY_CONFLICT) && !keptOpenOf(db, item.jobId))
  || db.prepare("SELECT 1 FROM events WHERE entity_id=? AND kind='job-settle-check-unavailable' AND seq>(SELECT COALESCE(MAX(seq),0) FROM events WHERE entity_id=? AND kind='job-settle-needs-kernel') LIMIT 1").get(item.jobId, item.jobId) != null;

/**
 * The job items waiting on the Kernel: [{di, resolution}] for each reported job the settler handed over and each live retry-decision. A job whose settle an
 * open gate or wait holds (frontier.heldSettleJobs) is that wait's to release, as a held move is (kernel-menu.mjs actionItemOf): the Kernel is offered no choice there.
 */
function jobDecisionsOf(s, kernelDis) {
  const { db, workflowId, now, repo } = s;
  const handed = [...(pendingJobsOf(db, workflowId, now)?.values() ?? [])];
  // A settle the runtime owes is not the Kernel's: a refusal for the Critic verdict (the settler runs the Critic itself; gate-newer-than-admission names the same state), and a job whose
  // settler is holding it for a checker that could not run since the handover (job-settle-check-unavailable): no choice of the Kernel's can cure either.
  const held = new Set([...(s.heldSettle ?? []).map((item) => item.jobId), ...handed.filter((item) => runtimeOwned(db, item)).map((item) => item.jobId)]);
  const byJob = new Map(kernelDis.filter((di) => JOB_KINDS.has(di.kind) && di.entity?.type === 'job').map((di) => [di.entity.id, di]));
  const virtual = handed.filter((item) => !byJob.has(item.jobId))
    .map((item) => ({ kind: 'settle-nongreen', workflowId, entity: { type: 'job', id: item.jobId }, summary: `${item.op} ${item.jobId} reported ${item.outcome}: the runtime did not settle it (${item.reason})`, evidence: [] }));
  return [...byJob.values(), ...virtual].filter((di) => !held.has(di.entity.id)).map((di) => ({ di, resolution: withFailure(db, resolutionOf(db, di, { repo, now })) }));
}

/**
 * The ready jobs the dispatch push refuses for their shape (dispatch-ready: the same op, owned paths and params as a failed job of the unit, for a cause of the shape):
 * [{jobId, op, failedJobId, situation}]. Dispatching them again repeats the failure, so the Kernel changes the shape or says none-fits; until then nothing runs.
 */
function shapeRefusedOf(s) {
  const { db, workflowId } = s;
  return (s.queued ?? []).filter((item) => item.queuedBecause === 'ready').map((item) => item.jobId).flatMap((jobId) => {
    const job = jobRow(db, jobId);
    const failed = job ? failedShapesOf(db, workflowId, job).get(shapeOf(job.op_id, job.payload)) : null;
    return failed ? [{ jobId, op: job.op_id, failedJobId: failed.jobId, situation: `${job.op_id} ${jobId} is ready but has the shape of ${failed.jobId}, which failed (${failed.causes.join(', ')}): the push does not dispatch it again; widen its grant or change its shape` }] : [];
  });
}

/** The waits that can no longer end on their own: a peer-wait whose peer is not running and a typed wait with an unmeetable condition. */
const deadWaitsOf = (s) => [
  ...s.deadPeerWaits.map((wait) => ({ incidentId: wait.incidentId, situation: `peer-wait ${wait.incidentId} on ${wait.peer} can no longer be met: the peer is ${wait.peerPhase ?? 'not running'}` })),
  ...s.typedUnmeetable.map((wait) => ({ incidentId: wait.incidentId, situation: `typed wait ${wait.incidentId} can no longer be met: ${wait.unmeetable.join('; ')}` })),
];

/**
 * The answers that still hold their item back: inside the snooze and given at the runtime revision that is live now. A new revision may cure
 * what the answer waited on or what its step failed on (a failed step is the runtime's, not the item's), so the item is offered again once.
 */
function standingAnswersOf(s) {
  const since = s.now - snoozeMs();
  const rev = currentRuntimeRev() ?? null;
  return decisionsOf(s.db, s.workflowId).filter((d) => d.menu?.item && d.at > since && (d.menu.rev ?? null) === rev);
}

/** The item ids a chosen wait still holds back. */
const snoozedOf = (s) => new Set(standingAnswersOf(s).filter((d) => ['keep-waiting', 'none-fits'].includes(d.menu.choice)).map((d) => d.menu.item));

/** The items whose latest answer failed a step, by id, with the facts the item had then: asked again only when the item's facts change. */
function answeredOf(s) {
  const latest = new Map();
  for (const d of standingAnswersOf(s)) latest.set(d.menu.item, d);
  return new Map([...latest].filter(([, d]) => d.status === 'revert' && d.menu.facts).map(([id, d]) => [id, d.menu.facts]));
}

/** The defect the owner reported on the handover ({title, slices}); null unless the answer is feedback. */
const feedbackOf = (s) => (s.handover?.ask?.decision === 'feedback' && s.handover.state === 'answered'
  ? feedbackOfHandover(s.workflowJobs, s.handover.ask, { max: menuCatalog().kinds.find((kind) => kind.id === 'handover-step').feedback.maxSlices })
  : null);

/**
 * The sentence an approved leg carries when this Kernel life has not attested the files that leg needs read: enqueue is refused kernel-read-unverified until it has, and
 * nothing else on the menu says so (the status line shows the last attestation of an earlier life). Empty when the READ is complete or cannot be planned.
 */
function attestNoteOf(s, action) {
  if (action.origin !== 'approved-leg-open' || !action.op) return '';
  try {
    const authority = kernelAuthorityOf(s.db, s.workflowId, kernelCustodyOf(s.db, s.workflowId).terminal);
    const required = kernelReadManifest(s.db, s.workflowId, { root: revRootOf(), authority, ops: [action.op] });
    const unread = unreadFiles(s.db, s.workflowId, required);
    return unread.length ? `This Kernel life has not attested its READ for ${action.op} (${unread.length} file(s)): enqueue is refused kernel-read-unverified until it does; run starci kernel kernel-ack-rev --plan --op ${action.op}, read the files it lists, then attest with --rev and --read-manifest.` : '';
  } catch { return ''; }
}

/** s.menu: the ordered open decision points, and the frontier's `actionable` follows it. */
export const menuPhase = (s) => {
  const { db, workflowId, wf, now } = s;
  if (wf.phase === 'finished' || wf.archived_at != null) { s.menu = []; return; }
  const kernelDis = listDecisions(db, { workflowId, decider: 'kernel', now }).filter((di) => LIVE_KERNEL.has(di.status));
  const pending = pendingJobsOf(db, workflowId, now);
  const live = kernelDis.filter((di) => liveFor(di, pending, db));
  s.menu = buildMenu({
    workflow: workflowId, rev: s.kernelRev, jobDecisions: jobDecisionsOf(s, live), shapeRefused: shapeRefusedOf(s),
    questions: s.workerQuestions, peers: s.peerMessages, wedged: s.wedgedWorkers.map((w) => ({ jobId: w.jobId, opId: s.workflowJobs.find((row) => row.job_id === w.jobId)?.op_id ?? null })),
    deadWaits: deadWaitsOf(s), decisions: live.filter((di) => !OWN_KIND.has(di.kind)), nextActions: s.graph.nextActions.map((action) => ({ ...action, attest: attestNoteOf(s, action) })), handover: s.handover, feedback: feedbackOf(s), snoozed: snoozedOf(s), answered: answeredOf(s),
  });
  s.actionable = s.menu.length > 0;
  s.frontier.actionable = s.actionable;
};

const optionLine = (option, index) => {
  const input = option.text ? ` [--text ${option.text}]` : '';
  return `      ${String.fromCodePoint(97 + index)}) ${option.choice} — ${option.effect}${input}`;
};

const itemLines = (item, index) => {
  const due = item.deadline ? `; due ${new Date(item.deadline).toISOString().slice(0, 16)}Z` : '';
  return [`  [${index + 1}] ${item.id} (${item.mode}; ${item.step}${due}): ${item.question}`, ...item.options.map((option, at) => optionLine(option, at))];
};

/** The Decide section of the status text: one block per open item, the options lettered, one line to answer with. */
export const menuLines = (s) => {
  if (!s.menu?.length) return [];
  return [`Decide (${s.menu.length}) — answer each item with: starci kernel decide --workflow ${s.workflowId} --item <id> --choice <choice> --reason <why> [--text <input>]`,
    ...s.menu.flatMap((item, index) => itemLines(item, index))];
};
