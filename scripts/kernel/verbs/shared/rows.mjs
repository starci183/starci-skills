// api-lib/rows.mjs — the ledger row reads every api verb shares (split out of cli.mjs, lane slim-api).
// Pure projections: a db handle in, a row or a parsed field out; nothing writes and nothing
// opens a ledger of its own.
import { parseJson } from '../../../lib/json.mjs';
import { latestContractOf } from '../../../machine/contract-version.mjs';
import { projectBinding } from '../../target-repo.mjs';
import { JOB_ROW } from '../../../machine/job-row.mjs';

export const getWorkflow = (db, workflowId) => db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(workflowId);
export const latestGoal = (db, workflowId) => db.prepare('SELECT * FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1').get(workflowId);
export const goalJsonOf = (row) => parseJson(row?.json ?? '', {});
export const jobPayloadOf = (row) => parseJson(row?.payload_json ?? '', {});
export const jobOpOf = (job) => job.op_id ?? jobPayloadOf(job).opId ?? null;
export const ownedPathsOf = (payload) => (payload?.owned_paths ?? []).map((p) => (typeof p === 'string' ? p : p?.path)).filter(Boolean);
/** The .starciwork record directories a job owns: where a read-only verify of its node writes its evidence. */
export const recordPathsOf = (payload, norm = (p) => p) => (payload?.owned_paths ?? [])
  .map((p) => norm(typeof p === 'string' ? p : p?.path))
  .filter((p) => typeof p === 'string' && p.startsWith('.starciwork/'));
/**
 * The settle result of a job row read through JOB_ROW (machine/job-row.mjs): its result_json column is the ledger's job
 * result, the newest attempt's settle_json, else the newest job-result event (engine/db/ledger.mjs jobResult).
 */
export const jobResultOf = (row) => parseJson(row?.result_json ?? '', {}) ?? {};
/** The job row by id through JOB_ROW, or undefined. */
export const jobRowOf = (db, jobId) => db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE job_id=?`).get(jobId);

/** The reports row of a job's newest attempt, or null. */
export const latestReportOf = (db, jobId) => db.prepare('SELECT r.* FROM reports r JOIN op_attempts a ON a.attempt_id=r.attempt_id WHERE a.job_id=? ORDER BY a.attempt_id DESC LIMIT 1').get(jobId) ?? null;
export const csvList = (v) => {
  const items = v == null ? [] : csvItems(v);
  return items.map((s) => String(s).trim()).filter(Boolean);
};
const csvItems = (v) => (Array.isArray(v) ? v : String(v).split(','));
// (starci kernel incident --kind peer-wait --until-foundation <name>), which the landing releases.
export const workflowRunning = (wf) => Boolean(wf?.phase === 'running' && wf?.archived_at == null);
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

export const contractDispatchIdOf = (db, job) => latestContractOf(db, job.job_id)?.dispatch_id ?? null;

/**
 * The { db, workflowId, workflow } prelude a workflow-scoped api verb opens with: the workflow of args.workflow,
 * or a workflow-unknown throw.
 */
export function verbWorkflow(ledger, args) {
  const db = ledger.db, workflowId = args.workflow;
  const workflow = getWorkflow(db, workflowId);
  if (!workflow) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  return { db, workflowId, workflow };
}

/**
 * The `export default` a workflow-scoped api verb shares: { verb, required: ['workflow'], kernelOnly, usageInCore,
 * run }. `run(ctx)` is the verb's body; `traits` adds spec fields (`reads`, `reacts`).
 */
export const workflowVerb = (verb, run, traits = {}) => ({ verb, required: ['workflow'], kernelOnly: true, usageInCore: true, ...traits, run });
