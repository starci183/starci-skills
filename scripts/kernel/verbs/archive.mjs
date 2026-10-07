// starci kernel archive: stop a workflow while preserving its history.
import { changeWorkflowPhase, getUnit, recordJobResult, resolveIncident, setInboxStatus, setJobStatus, setUnitState, updateAttempt, updateIncident, updateJob } from '../../../engine/db/ledger.mjs';
import { recordWhy } from '../why-record.mjs';
import { parseJson } from '../../lib/json.mjs';
import { JOB_ROW, latestAttemptOf } from '../../machine/job-row.mjs';
import { ARCHIVED_BY, getWorkflow, jobOpOf, jobPayloadOf } from './shared/rows.mjs';
import { kernelCustodyOf } from './shared/kernel-seat.mjs';
import { openAskDispatchesOf, retireAsk } from './shared/asks.mjs';
import { closeKernelTerminal, releaseDroppedWorker, releaseKernelSeat, retainAfterEnd } from './shared/workflow-end.mjs';
import { reportedJobs } from '../../machine/reported-jobs.mjs';
import { closeWorkflowDecisions } from '../../machine/decisions.mjs';

const WORKFLOW_ARCHIVED = 'workflow-archived';
// How an open job leaves at archive (job_transitions): straight to cancelled where the table allows it, an answering
// worker through running, a fenced launch (effect_unknown) to failed - its only terminal exit. 'reported' is never
// here: archive refuses unsettled reports first (H9).
const DROP_PATH = { queued: ['cancelled'], ready: ['cancelled'], leased: ['cancelled'], running: ['cancelled'], deciding: ['cancelled'],
  answering: ['running', 'cancelled'], effect_unknown: ['failed'] };
// workflow_transitions: only stopped or finished reach archived; any other live phase is stopped first.
const STOP_FIRST = new Set(['awaiting-approval', 'queued', 'running', 'paused']);

async function retireWorkflowAsks(ledger, workflowId, reason, repo) {
  const retired = [];
  for (const dispatchId of openAskDispatchesOf(ledger.db, workflowId)) {
    const result = await retireAsk(ledger, { workflowId, dispatchId, reason, repo });
    if (result.retired) retired.push(dispatchId);
  }
  return retired;
}

function dropOpenWorkflowJob(db, ledger, workflowId, now, job) {
  const path = DROP_PATH[job.status];
  if (!path) throw Object.assign(new Error(`archive refused: job ${job.job_id} is ${job.status} and cannot be dropped (job_transitions)`), { code: 'archive-job-not-droppable', jobId: job.job_id, status: job.status });
  const leasesReleased = db.prepare('SELECT count(*) n FROM leases WHERE job_id=?').get(job.job_id).n;
  for (const to of path) setJobStatus(db, { jobId: job.job_id, to, reason: WORKFLOW_ARCHIVED, at: now, ...(to === path.at(-1) ? { leaseToken: null, deadline: null } : {}) });
  recordJobResult(db, { jobId: job.job_id, result: { verdict: 'dropped', reason: WORKFLOW_ARCHIVED, priorStatus: job.status, at: now }, at: now });
  const attempt = latestAttemptOf(db, job.job_id);
  if (attempt && attempt.end_state == null && attempt.settled_at == null) { updateAttempt(db, { attemptId: attempt.attempt_id, endState: 'cancelled', at: now }); recordWhy(db, attempt.attempt_id, { at: now }); }
  const unit = job.unit_id ? getUnit(db, workflowId, job.unit_id) : null;
  if (unit && !['done', 'dropped'].includes(unit.state) && (unit.current_job_id == null || unit.current_job_id === job.job_id)) {
    setUnitState(db, { workflowId, unitId: job.unit_id, to: 'dropped', reason: WORKFLOW_ARCHIVED, at: now });
  }
  ledger.appendEvent({ workflowId, entityType: 'job', entityId: job.job_id, kind: 'job-dropped',
    payload: { op: jobOpOf(job), attempt: job.attempt, reason: WORKFLOW_ARCHIVED, priorStatus: job.status, leasesReleased } });
  return { job, leasesReleased };
}

function dropOpenWorkflowJobs(db, ledger, { workflowId, now, finalSettled }) {
  const open = db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE workflow_id=? AND kind<>'kernel' AND status NOT IN (${finalSettled.map(() => '?').join(',')}) ORDER BY created_at,job_id`)
    .all(workflowId, ...finalSettled);
  const dropped = [];
  for (const job of open) dropped.push(dropOpenWorkflowJob(db, ledger, workflowId, now, job));
  return dropped;
}

export default {
  verb: 'archive',
  required: ['workflow', 'reason'],
  kernelOnly: true,
  usageInCore: true,
  async run({ ledger, args, repo, emit, internals }) {
    const { FINAL_SETTLED, indexSettledArtifacts } = internals;
  const db = ledger.db, workflowId = args.workflow;
  const wf = getWorkflow(db, workflowId);
  if (!wf) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  const reason = String(args.reason ?? '').trim();
  if (!reason) throw Object.assign(new Error('archive needs --reason <text>: an archived workflow keeps why it was stopped'), { code: 'archive-needs-reason' });
  const by = args.by ?? 'owner';
  if (!ARCHIVED_BY.includes(by)) throw Object.assign(new Error(`archive --by must be ${ARCHIVED_BY.join('|')}, got '${by}'`), { code: 'archive-bad-by' });
  const alreadyArchived = (archivedAt) => emit({ ok: true, workflowId, archived: false, alreadyArchived: true, archivedAt },
    `workflow ${workflowId} was already archived at ${new Date(archivedAt).toISOString()}; nothing changed`, args.json);
  if (wf.phase === 'archived') return alreadyArchived(wf.archived_at);
  // H9: a job whose worker filed a report is settled, never dropped - its work would be thrown away unjudged
  // (DBTREE job_transitions has no reported -> cancelled). The settler (or starci kernel settle) settles it first.
  const unsettled = reportedJobs(db, { workflowId });
  if (unsettled.length) {
    const examples = unsettled.slice(0, 8).map((it) => `${it.jobId} ${it.outcome}`).join(', ');
    throw Object.assign(new Error(`archive refused: ${unsettled.length} job(s) of ${workflowId} filed a report that is not settled yet (${examples}); wait for the reconciler-managed settler or use starci kernel settle for each job, then archive`),
      { code: 'archive-unsettled-reports', jobs: unsettled.map((it) => ({ jobId: it.jobId, outcome: it.outcome, dispatchId: it.dispatchId })) });
  }

  const asksRetired = await retireWorkflowAsks(ledger, workflowId, WORKFLOW_ARCHIVED, repo);

  const now = Date.now(), archived = { at: now, reason, by };
  const seat = kernelCustodyOf(db, workflowId), kernelTerminal = seat.terminal;
  const dropped = [];
  let inboxClosed = 0, incidentsClosed = 0, kernelSignalsReleased = 0, kernelJobsSettled = 0, racedAt = null, decisionsClosed = [];
  ledger.transaction(() => {
    const phase = db.prepare('SELECT phase, archived_at FROM workflows WHERE workflow_id=?').get(workflowId);
    if (phase?.phase === 'archived') { racedAt = phase.archived_at ?? now; return; }
    // Every write that appends an event runs before the phase moves to archived: an archived workflow takes no
    // further events (events_refuse_archived).
    for (const row of db.prepare("SELECT inbox_id FROM inbox WHERE workflow_id=? AND status NOT IN ('done','applied') ORDER BY inbox_id").all(workflowId)) {
      if (setInboxStatus(db, { inboxId: row.inbox_id, status: 'done', disposition: { reason: WORKFLOW_ARCHIVED }, at: now })) inboxClosed++;
    }
    dropped.push(...dropOpenWorkflowJobs(db, ledger, { workflowId, now, finalSettled: FINAL_SETTLED }));
    // H12: an archived workflow keeps no open incident; each closes through its owner with the reason
    // (incidents.resolved_reason enum: workflow-ended; the trail keeps workflow-archived).
    for (const row of db.prepare("SELECT incident_id, last_progress FROM incidents WHERE workflow_id=? AND status='open'").all(workflowId)) {
      updateIncident(db, { incidentId: row.incident_id, lastProgress: `${row.last_progress ?? ''} [resolved: ${WORKFLOW_ARCHIVED}]`, at: now });
      if (resolveIncident(db, { incidentId: row.incident_id, reason: 'workflow-ended', at: now })) incidentsClosed++;
    }
    // An archived workflow keeps no live Decision Item: each resolves by runtime (verb workflow-archived) BEFORE
    // the phase flips — after it no decision write is possible (events_refuse_archived) and the item would keep
    // being counted, escalated and digested forever.
    decisionsClosed = closeWorkflowDecisions(ledger, workflowId, { verb: WORKFLOW_ARCHIVED, now });
    ({ kernelSignalsReleased, kernelJobsSettled } = releaseKernelSeat(db, workflowId, seat,
      { status: 'cancelled', result: { reason: WORKFLOW_ARCHIVED, at: now }, stamp: { archivedAt: now }, now }));
    ledger.appendEvent({ workflowId, entityType: 'workflow', entityId: workflowId, kind: WORKFLOW_ARCHIVED,
      payload: { archived, inboxClosed, incidentsClosed, decisionsClosed, jobsDropped: dropped.map((d) => d.job.job_id), asksRetired, kernelSignalsReleased, kernelJobsSettled, kernelTerminal } });
    if (STOP_FIRST.has(phase.phase)) changeWorkflowPhase(db, { workflowId, to: 'stopped', by, reason, at: now });
    changeWorkflowPhase(db, { workflowId, to: 'archived', by, reason, at: now });
  });
  if (racedAt != null) return alreadyArchived(racedAt);
  // After the durable record: each dropped operation's worker is released, then the Run's Tasks close.
  const jobsDropped = dropped.map(({ job, leasesReleased }) => {
    const worker = releaseDroppedWorker(jobPayloadOf(job), internals);
    if (worker.managedWorker) {
      const stored = parseJson(db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(job.job_id)?.payload_json) ?? {};
      updateJob(db, { jobId: job.job_id, payload: { ...stored, ...worker } });
    }
    // A dropped job that ran keeps what it produced, like a settled one.
    const artifacts = job.status === 'queued' ? null : indexSettledArtifacts(ledger, job, repo);
    return { jobId: job.job_id, priorStatus: job.status, leasesReleased, ...worker, ...(artifacts ? { artifacts } : {}) };
  });
  const retention = retainAfterEnd(db, now);
  const out = { ok: true, workflowId, archived: true, archivedAt: now, reason, by, inboxClosed, incidentsClosed, decisionsClosed, jobsDropped, asksRetired,
    kernelSignalsReleased, kernelJobsSettled, kernelTerminal, kernelTerminalCloseRequested: Boolean(kernelTerminal), retention };
  const askNote = asksRetired.length ? `; asks retired: ${asksRetired.length}` : '';
  const terminalNote = kernelTerminal ? `, terminal ${kernelTerminal} close requested` : '';
  emit(out, `workflow ${workflowId} archived by ${by}: ${reason} — inbox rows closed: ${inboxClosed}; decisions closed: ${decisionsClosed.length}; jobs dropped: ${jobsDropped.length}${askNote}; kernel signal released=${kernelSignalsReleased}, kernel job settled=${kernelJobsSettled}${terminalNote}; history preserved`, args.json);
  closeKernelTerminal(kernelTerminal, { owner: `kernel:${workflowId}:archive` });

  },
};
