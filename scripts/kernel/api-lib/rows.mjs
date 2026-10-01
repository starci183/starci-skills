// api-lib/rows.mjs — the ledger row reads every api verb shares (split out of api.mjs, lane slim-api).
// Pure projections: a db handle in, a row or a parsed field out; nothing writes and nothing
// opens a ledger of its own.
import { parseJson } from '../../lib/json.mjs';
import { projectBinding } from '../target-repo.mjs';

export const getWorkflow = (db, workflowId) => db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(workflowId);
export const latestGoal = (db, workflowId) => db.prepare('SELECT * FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1').get(workflowId);
export const goalJsonOf = (row) => parseJson(row?.json ?? '', {});
export const jobPayloadOf = (row) => parseJson(row?.payload_json ?? '', {});
export const jobOpOf = (job) => job.op_id ?? jobPayloadOf(job).opId ?? null;
export const ownedPathsOf = (payload) => (payload?.owned_paths ?? []).map((p) => (typeof p === 'string' ? p : p?.path)).filter(Boolean);
/**
 * The settle result of a job row read through JOB_ROW (its result_json column is the ledger's job result: the newest
 * attempt's settle_json, else the newest job-result event - engine/ledger-db.mjs jobResult).
 */
export const jobResultOf = (row) => parseJson(row?.result_json ?? '', {}) ?? {};
/** SQL: the job result of the jobs row aliased `alias` (the same precedence as engine/ledger-db.mjs jobResult). */
export const jobResultSql = (alias = 'jobs') => `COALESCE((SELECT a.settle_json FROM op_attempts a WHERE a.job_id=${alias}.job_id ORDER BY a.attempt_id DESC LIMIT 1),`
  + `(SELECT e.payload_json FROM events e WHERE e.entity_type='job' AND e.entity_id=${alias}.job_id AND e.kind='job-result' ORDER BY e.seq DESC LIMIT 1))`;
/**
 * The job row projection every reader selects: the jobs columns, `attempt` = the try number (jobs.try_no) and
 * `result_json` = the job's settle result. `SELECT ${JOB_ROW} FROM jobs WHERE ...` (the table itself, not an alias).
 */
export const JOB_ROW = `jobs.*, jobs.try_no AS attempt, ${jobResultSql('jobs')} AS result_json`;
/** The job row by id through JOB_ROW, or undefined. */
export const jobRowOf = (db, jobId) => db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE job_id=?`).get(jobId);
/** The newest op_attempts row of a job (its current or last dispatch), or null. */
export const latestAttemptOf = (db, jobId) => db.prepare('SELECT * FROM op_attempts WHERE job_id=? ORDER BY attempt_id DESC LIMIT 1').get(jobId) ?? null;
/** The contracts row of a job's newest attempt, or null. */
export const latestContractOf = (db, jobId) => db.prepare('SELECT c.*, a.dispatch_id FROM contracts c JOIN op_attempts a ON a.attempt_id=c.attempt_id WHERE a.job_id=? ORDER BY a.attempt_id DESC LIMIT 1').get(jobId) ?? null;
/** The reports row of a job's newest attempt, or null. */
export const latestReportOf = (db, jobId) => db.prepare('SELECT r.* FROM reports r JOIN op_attempts a ON a.attempt_id=r.attempt_id WHERE a.job_id=? ORDER BY a.attempt_id DESC LIMIT 1').get(jobId) ?? null;
export const csvList = (v) => (v == null ? [] : (Array.isArray(v) ? v : String(v).split(','))
  .map((s) => String(s).trim()).filter(Boolean));
// (api incident --kind peer-wait --until-foundation <name>), which the landing releases.
export const workflowRunning = (wf) => Boolean(wf && wf.phase === 'running' && wf.archived_at == null);
export const workDirOf = (repo) => { try { return projectBinding(repo)?.workDir ?? '.starciwork'; } catch { return '.starciwork'; } };
export const ARCHIVED_BY = ['owner', 'supervisor'];

export const operationTerminalHandleOf = (row, payload = jobPayloadOf(row)) => payload?.managed?.agentTerminalHandle
  ?? payload?.orca?.agentTerminalHandle
  ?? payload?.hierarchy?.runtime?.terminalHandle
  ?? (payload?.managed ? null : row?.worker_id)
  ?? null;

// The Orca Dispatch that holds an op's worker, whichever launch kind opened it: the id worker-show, worker-read
// and worker-release address (a worker is read by Dispatch, never by terminal handle; deep map T1). Null when the
// attempt never got a Dispatch.
export const operationDispatchOf = (payload) => payload?.managed?.dispatchId
  ?? payload?.orca?.dispatchId
  ?? payload?.hierarchy?.runtime?.dispatchId
  ?? null;

// The operation Task an op holds, whichever launch kind opened it, and the
// Run/kernel-terminal identity task-update needs to address it. Returns null
// when the attempt never got a Task — there is then nothing to close.
export const operationTaskOf = (payload) => {
  const taskId = payload?.orca?.taskId ?? payload?.managed?.taskId ?? payload?.hierarchy?.runtime?.taskId ?? null;
  if (!taskId) return null;
  return { taskId, runId: payload?.orca?.runId ?? payload?.managed?.runId ?? payload?.hierarchy?.runtime?.runId ?? null };
};

export const contractDispatchIdOf = (db, job) => latestContractOf(db, job.job_id)?.dispatch_id ?? null;
