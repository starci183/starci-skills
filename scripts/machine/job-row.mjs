// job-row.mjs - the ledger's job row projection: the SQL every reader of a jobs row selects, so a kernel verb and a
// machine-tier ledger read (owner-answers.mjs) see the same columns. Pure SQL text; nothing opens a ledger here.

/** SQL: the job result of the jobs row aliased `alias` (the same precedence as engine/db/ledger.mjs jobResult). */
export const jobResultSql = (alias = 'jobs') => `COALESCE((SELECT a.settle_json FROM op_attempts a WHERE a.job_id=${alias}.job_id ORDER BY a.attempt_id DESC LIMIT 1),`
  + `(SELECT e.payload_json FROM events e WHERE e.entity_type='job' AND e.entity_id=${alias}.job_id AND e.kind='job-result' ORDER BY e.seq DESC LIMIT 1))`;
/**
 * The job row projection every reader selects: the jobs columns, `attempt` = the try number (jobs.try_no) and
 * `result_json` = the job's settle result. `SELECT ${JOB_ROW} FROM jobs WHERE ...` (the table itself, not an alias).
 */
export const JOB_ROW = `jobs.*, jobs.try_no AS attempt, ${jobResultSql('jobs')} AS result_json`;

/** The workflow's newest kernel jobs row (updated_at order), or undefined. The handle is the caller's. */
export const latestKernelJobOf = (db, workflowId) =>
  db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE workflow_id=? AND kind='kernel' ORDER BY updated_at DESC LIMIT 1`).get(workflowId);

/**
 * The job's newest op_attempts row (`order` column, latest first — attempt_id the row order, dispatch_seq the
 * dispatch order), or null. `job` is the jobs row or its job_id; the handle is the caller's.
 */
export const latestAttemptOf = (db, job, { order = 'attempt_id' } = {}) =>
  db.prepare(`SELECT * FROM op_attempts WHERE job_id=? ORDER BY ${order} DESC LIMIT 1`).get(job && typeof job === 'object' ? job.job_id : job) ?? null;
