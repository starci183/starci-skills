// The menu phase of `starci kernel status`: the Kernel's decision points (scripts/kernel/kernel-menu.mjs) read from the ledger and the
// projection built so far. The menu is the only actionable section of the status text and the one reason the watchdog wakes a Kernel:
// an empty menu is a wait, whatever the frontier state says. Everything mechanical is the runtime's (the controllers).
import { listDecisions } from '../../../machine/decisions.mjs';
import { JOB_KINDS, liveFor, pendingJobsOf, resolutionOf } from '../../../machine/decision-resolution.mjs';
import { buildMenu, menuCatalog, snoozeMs } from '../../kernel-menu.mjs';
import { feedbackOfHandover } from '../../handover-slices.mjs';
import { decisionsOf } from '../../progress-rca.mjs';
import { failureFactsOf } from '../../failure-class.mjs';

const LIVE_KERNEL = new Set(['open', 'claimed']);
// Kinds with their own menu kind (or a notice): the generic decision-item kind never repeats them.
const OWN_KIND = new Set(['worker-question', 'rev-ack', 'unread-peer', 'supervisor-ruling', ...JOB_KINDS]);

/** The resolution with the class its evidence decides (scripts/kernel/failure-class.mjs): the menu reads it to withhold the escape from a work failure. */
const withFailure = (db, resolution) => (resolution.jobId ? { ...resolution, failure: failureFactsOf(db, resolution.jobId) } : resolution);

/** The job items waiting on the Kernel: [{di, resolution}] for each reported job the settler handed over and each live retry-decision. */
function jobDecisionsOf(s, kernelDis) {
  const { db, workflowId, now, repo } = s;
  const handed = [...(pendingJobsOf(db, workflowId, now)?.values() ?? [])];
  const byJob = new Map(kernelDis.filter((di) => JOB_KINDS.has(di.kind) && di.entity?.type === 'job').map((di) => [di.entity.id, di]));
  const virtual = handed.filter((item) => !byJob.has(item.jobId))
    .map((item) => ({ kind: 'settle-nongreen', workflowId, entity: { type: 'job', id: item.jobId }, summary: `${item.op} ${item.jobId} reported ${item.outcome}: the runtime did not settle it (${item.reason})`, evidence: [] }));
  return [...byJob.values(), ...virtual].map((di) => ({ di, resolution: withFailure(db, resolutionOf(db, di, { repo, now })) }));
}

/** The waits that can no longer end on their own: a peer-wait whose peer is not running and a typed wait with an unmeetable condition. */
const deadWaitsOf = (s) => [
  ...s.deadPeerWaits.map((wait) => ({ incidentId: wait.incidentId, situation: `peer-wait ${wait.incidentId} on ${wait.peer} can no longer be met: the peer is ${wait.peerPhase ?? 'not running'}` })),
  ...s.typedUnmeetable.map((wait) => ({ incidentId: wait.incidentId, situation: `typed wait ${wait.incidentId} can no longer be met: ${wait.unmeetable.join('; ')}` })),
];

/** The item ids a chosen wait still holds back. */
function snoozedOf(s) {
  const since = s.now - snoozeMs();
  return new Set(decisionsOf(s.db, s.workflowId).filter((d) => d.menu?.choice === 'keep-waiting' && d.at > since).map((d) => d.menu.item));
}

/** The defect the owner reported on the handover ({title, slices}); null unless the answer is feedback. */
const feedbackOf = (s) => (s.handover?.ask?.decision === 'feedback' && s.handover.state === 'answered'
  ? feedbackOfHandover(s.workflowJobs, s.handover.ask, { max: menuCatalog().kinds.find((kind) => kind.id === 'handover-step').feedback.maxSlices })
  : null);

/** s.menu: the ordered open decision points, and the frontier's `actionable` follows it. */
export const menuPhase = (s) => {
  const { db, workflowId, wf, now } = s;
  if (wf.phase === 'finished' || wf.archived_at != null) { s.menu = []; return; }
  const kernelDis = listDecisions(db, { workflowId, decider: 'kernel', now }).filter((di) => LIVE_KERNEL.has(di.status));
  const pending = pendingJobsOf(db, workflowId, now);
  const live = kernelDis.filter((di) => liveFor(di, pending, db));
  s.menu = buildMenu({
    workflow: workflowId, rev: s.kernelRev, jobDecisions: jobDecisionsOf(s, live),
    questions: s.workerQuestions, peers: s.peerMessages, wedged: s.wedgedWorkers.map((w) => ({ jobId: w.jobId, opId: s.workflowJobs.find((row) => row.job_id === w.jobId)?.op_id ?? null })),
    deadWaits: deadWaitsOf(s), decisions: live.filter((di) => !OWN_KIND.has(di.kind)), nextActions: s.graph.nextActions, handover: s.handover, feedback: feedbackOf(s), snoozed: snoozedOf(s),
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
