// Evidence that a queued job crossed dispatch; used by release and reconciliation.
const DISPATCH_EVENT_KINDS = ['op-dispatched', 'dispatch-rejected', 'dispatch-reconciled', 'live-worker-reconciled',
  'report-filed', 'report-consumed', 'checks-recorded', 'op-settled', 'op-worker-nudged'];
export const dispatchEvidenceOf = (db, job, payload) => {
  // Contracts, reports and check runs hang off the job's attempts (op_attempts), any dispatch of it.
  const evidence = [];
  if (db.prepare('SELECT 1 FROM contracts WHERE job_id=? LIMIT 1').get(job.job_id)) evidence.push('contract');
  if (db.prepare('SELECT 1 FROM reports WHERE job_id=? LIMIT 1').get(job.job_id)) evidence.push('report');
  if (db.prepare('SELECT 1 FROM check_runs WHERE job_id=? LIMIT 1').get(job.job_id)) evidence.push('checks');
  if (db.prepare('SELECT 1 FROM leases WHERE job_id=? LIMIT 1').get(job.job_id)) evidence.push('lease');
  if (job.worker_id) evidence.push('worker');
  if (payload.managed || payload.orca || payload.hierarchy?.runtime?.dispatchId || payload.hierarchy?.runtime?.terminalHandle
    || (Array.isArray(payload.rejectedDispatches) && payload.rejectedDispatches.length)) evidence.push('dispatch-binding');
  const events = db.prepare(`SELECT DISTINCT kind FROM events WHERE workflow_id=? AND entity_type='job' AND entity_id=?
    AND kind IN (${DISPATCH_EVENT_KINDS.map(() => '?').join(',')})`).all(job.workflow_id, job.job_id, ...DISPATCH_EVENT_KINDS);
  for (const { kind } of events) evidence.push(`event:${kind}`);
  return evidence;
};
