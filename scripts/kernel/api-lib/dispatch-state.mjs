// Evidence that a queued job crossed dispatch; used by release and reconciliation.
const DISPATCH_EVENT_KINDS = ['op-dispatched', 'dispatch-rejected', 'dispatch-reconciled', 'live-worker-reconciled',
  'report-filed', 'report-consumed', 'checks-recorded', 'op-settled', 'op-worker-nudged'];
export const dispatchEvidenceOf = (db, job, payload) => {
  const key = [job.workflow_id, job.op_id, job.attempt];
  const evidence = [];
  if (db.prepare('SELECT 1 FROM contracts WHERE workflow_id=? AND op_id=? AND attempt=?').get(...key)) evidence.push('contract');
  if (db.prepare('SELECT 1 FROM reports WHERE workflow_id=? AND op_id=? AND attempt=? LIMIT 1').get(...key)) evidence.push('report');
  if (db.prepare('SELECT 1 FROM checks WHERE workflow_id=? AND op_id=? AND attempt=?').get(...key)) evidence.push('checks');
  if (db.prepare('SELECT 1 FROM leases WHERE job_id=? LIMIT 1').get(job.job_id)) evidence.push('lease');
  if (job.worker_id) evidence.push('worker');
  if (payload.managed || payload.orca || payload.hierarchy?.runtime?.dispatchId || payload.hierarchy?.runtime?.terminalHandle
    || (Array.isArray(payload.rejectedDispatches) && payload.rejectedDispatches.length)) evidence.push('dispatch-binding');
  const events = db.prepare(`SELECT DISTINCT kind FROM events WHERE workflow_id=? AND entity_type='job' AND entity_id=?
    AND kind IN (${DISPATCH_EVENT_KINDS.map(() => '?').join(',')})`).all(job.workflow_id, job.job_id, ...DISPATCH_EVENT_KINDS);
  for (const { kind } of events) evidence.push(`event:${kind}`);
  return evidence;
};
