// api archive: stop a workflow while preserving its history.
import { machineFileFor, openMachine } from '../../../engine/machine-db.mjs';
import { parseJson } from '../../lib/json.mjs';
import { ARCHIVED_BY, getWorkflow, jobOpOf, jobPayloadOf } from '../api-lib/rows.mjs';
import { kernelCustodyOf } from '../api-lib/kernel-seat.mjs';
import { retireAsk } from '../api-lib/asks.mjs';
import { reportedJobs } from '../../reconcile/job-settle.mjs';

const WORKFLOW_ARCHIVED = 'workflow-archived';

export default {
  verb: 'archive',
  required: ['workflow', 'reason'],
  kernelOnly: true,
  usageInCore: true,
  async run({ ledger, args, repo, emit, internals }) {
    const { FINAL_SETTLED, releaseKernelSeat, closeHeldTasks, retainAfterEnd, closeKernelTerminal,
      openAskDispatchesOf, releaseDroppedWorker, indexSettledArtifacts } = internals;
  const db = ledger.db, workflowId = args.workflow;
  const wf = getWorkflow(db, workflowId);
  if (!wf) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  const reason = String(args.reason ?? '').trim();
  if (!reason) throw Object.assign(new Error('archive needs --reason <text>: an archived workflow keeps why it was stopped'), { code: 'archive-needs-reason' });
  const by = args.by ?? 'owner';
  if (!ARCHIVED_BY.includes(by)) throw Object.assign(new Error(`archive --by must be ${ARCHIVED_BY.join('|')}, got '${by}'`), { code: 'archive-bad-by' });
  const alreadyArchived = (archivedAt) => emit({ ok: true, workflowId, archived: false, alreadyArchived: true, archivedAt },
    `workflow ${workflowId} was already archived at ${new Date(archivedAt).toISOString()}; nothing changed`, args.json);
  if (wf.archived_at != null) return alreadyArchived(wf.archived_at);
  // H9: a job whose worker filed a report is settled, never dropped - its work would be thrown away unjudged
  // (DBTREE job_transitions has no reported -> cancelled). The settler (or api settle) settles it first.
  const unsettled = reportedJobs(db, { workflowId });
  if (unsettled.length) {
    throw Object.assign(new Error(`archive refused: ${unsettled.length} job(s) of ${workflowId} filed a report that is not settled yet (${unsettled.slice(0, 8).map((it) => `${it.jobId} ${it.outcome}`).join(', ')}); settle them first (node scripts/reconcile/job-settle.mjs --repo <repo> --workflow ${workflowId}, or api settle), then archive`),
      { code: 'archive-unsettled-reports', jobs: unsettled.map((it) => ({ jobId: it.jobId, outcome: it.outcome, dispatchId: it.dispatchId })) });
  }

  const asksRetired = [];
  for (const dispatchId of openAskDispatchesOf(db, workflowId)) {
    const retired = await retireAsk(ledger, { workflowId, dispatchId, reason: WORKFLOW_ARCHIVED, repo });
    if (retired.retired) asksRetired.push(dispatchId);
  }

  const now = Date.now(), archived = { at: now, reason, by };
  const seat = kernelCustodyOf(db, workflowId), kernelTerminal = seat.terminal;
  const dropped = [], machineRefs = [];
  let inboxClosed = 0, incidentsClosed = 0, kernelSignalsReleased = 0, kernelJobsSettled = 0, racedAt = null;
  ledger.transaction(() => {
    racedAt = db.prepare('SELECT archived_at FROM workflows WHERE workflow_id=?').get(workflowId)?.archived_at ?? null;
    if (racedAt != null) return;
    db.prepare('UPDATE workflows SET archived_at=?, updated_at=? WHERE workflow_id=?').run(now, now, workflowId);
    inboxClosed = db.prepare("UPDATE inbox SET status='done', disposition_json=?, applied_at=? WHERE workflow_id=? AND status NOT IN ('done','applied')")
      .run(JSON.stringify({ reason: WORKFLOW_ARCHIVED }), now, workflowId).changes;
    const open = db.prepare(`SELECT * FROM jobs WHERE workflow_id=? AND kind<>'kernel' AND status NOT IN (${FINAL_SETTLED.map(() => '?').join(',')}) ORDER BY created_at,job_id`)
      .all(workflowId, ...FINAL_SETTLED);
    for (const job of open) {
      machineRefs.push(...db.prepare('SELECT machine_ref FROM leases WHERE job_id=? AND machine_ref IS NOT NULL').all(job.job_id).map((r) => r.machine_ref));
      const leasesReleased = db.prepare('DELETE FROM leases WHERE job_id=?').run(job.job_id).changes;
      db.prepare("UPDATE jobs SET status='cancelled', lease_token=NULL, deadline=NULL, result_json=?, updated_at=? WHERE job_id=?")
        .run(JSON.stringify({ verdict: 'dropped', reason: WORKFLOW_ARCHIVED, priorStatus: job.status, at: now }), now, job.job_id);
      ledger.appendEvent({ workflowId, entityType: 'job', entityId: job.job_id, kind: 'job-dropped',
        payload: { op: jobOpOf(job), attempt: job.attempt, reason: WORKFLOW_ARCHIVED, priorStatus: job.status, leasesReleased } });
      dropped.push({ job, leasesReleased });
    }
    // H12: an archived workflow keeps no open incident; each closes through its owner with the reason.
    incidentsClosed = db.prepare("UPDATE incidents SET status='resolved', last_progress=COALESCE(last_progress,'')||?, updated_at=? WHERE workflow_id=? AND status='open'")
      .run(` [resolved: ${WORKFLOW_ARCHIVED}]`, now, workflowId).changes;
    ({ kernelSignalsReleased, kernelJobsSettled } = releaseKernelSeat(db, workflowId, seat,
      { status: 'cancelled', result: { reason: WORKFLOW_ARCHIVED, at: now }, stamp: { archivedAt: now }, now }));
    ledger.appendEvent({ workflowId, entityType: 'workflow', entityId: workflowId, kind: WORKFLOW_ARCHIVED,
      payload: { archived, inboxClosed, incidentsClosed, jobsDropped: dropped.map((d) => d.job.job_id), asksRetired, kernelSignalsReleased, kernelJobsSettled, kernelTerminal } });
  });
  if (racedAt != null) return alreadyArchived(racedAt);
  if (machineRefs.length) {
    try { const machine = openMachine({ file: machineFileFor() }); try { machine.release(machineRefs); } finally { machine.close(); } }
    catch { /* ledger rows are the record; machine TTLs expire on their own */ }
  }
  // After the durable record: each dropped operation's worker is released, then the Run's Tasks close.
  const jobsDropped = dropped.map(({ job, leasesReleased }) => {
    const worker = releaseDroppedWorker(db, job, jobPayloadOf(job), repo);
    if (worker.managedWorker || worker.terminalClosed) {
      const stored = parseJson(db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(job.job_id)?.payload_json) ?? {};
      db.prepare('UPDATE jobs SET payload_json=?, updated_at=? WHERE job_id=?').run(JSON.stringify({ ...stored, ...worker }), Date.now(), job.job_id);
    }
    // A dropped job that ran keeps what it produced, like a settled one.
    const artifacts = job.status === 'queued' ? null : indexSettledArtifacts(ledger, job, repo);
    return { jobId: job.job_id, priorStatus: job.status, leasesReleased, ...worker, ...(artifacts ? { artifacts } : {}) };
  });
  const tasksClosed = closeHeldTasks(db, workflowId, kernelTerminal, now);
  const retention = retainAfterEnd(db, now);
  const out = { ok: true, workflowId, archived: true, archivedAt: now, reason, by, inboxClosed, incidentsClosed, jobsDropped, asksRetired,
    kernelSignalsReleased, kernelJobsSettled, kernelTerminal, kernelTerminalCloseRequested: Boolean(kernelTerminal), tasksClosed, retention };
  emit(out, `workflow ${workflowId} archived by ${by}: ${reason} — inbox rows closed: ${inboxClosed}; jobs dropped: ${jobsDropped.length}${asksRetired.length ? `; asks retired: ${asksRetired.length}` : ''}; kernel signal released=${kernelSignalsReleased}, kernel job settled=${kernelJobsSettled}${tasksClosed.length ? `, ${tasksClosed.length} open Task(s) closed` : ''}${kernelTerminal ? `, terminal ${kernelTerminal} close requested` : ''}; history preserved`, args.json);
  closeKernelTerminal(kernelTerminal, { owner: `kernel:${workflowId}:archive` });

  },
};
