// scripts/reconciler/job-keys.mjs — the names the Job controller (controllers/job.mjs) and its worker-health pass
// (job-health.mjs) share: the Supervisor ledger id, the opener stamped on their Decision Items, and the job key.
export const SUPERVISOR_LEDGER = 'supervisor';
export const OPENED_BY = 'job-controller';
export const jobKey = (ledgerId, jobId) => `job:${ledgerId}:${jobId}`;
