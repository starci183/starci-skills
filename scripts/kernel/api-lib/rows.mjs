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
export const jobResultOf = (row) => parseJson(row?.result_json ?? '', {}) ?? {};
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

export const contractDispatchIdOf = (db, job) => db
  .prepare('SELECT dispatch_id FROM contracts WHERE workflow_id=? AND op_id=? AND attempt=?')
  .get(job.workflow_id, jobOpOf(job), job.attempt)?.dispatch_id ?? null;
