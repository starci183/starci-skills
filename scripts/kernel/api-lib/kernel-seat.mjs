// api-lib/kernel-seat.mjs — the live Kernel job of a workflow and the terminal its seat names
// (split out of api.mjs, lane slim-api). Read projections only.
import { parseJson } from '../../lib/json.mjs';
import { jobPayloadOf } from './rows.mjs';

export const KERNEL_LAUNCH_EVENTS = ['kernel-booted', 'kernel-restarted', 'kernel-adopted'];

export function kernelSeatOf(db, workflowId, env = process.env) {
  const job = db.prepare("SELECT attempt,status,worker_id FROM jobs WHERE job_id=? AND kind='kernel'").get(`kernel-${workflowId}`);
  if (!job) return null;
  const launch = db.prepare(`SELECT kind,created_at,payload_json FROM events WHERE workflow_id=? AND kind IN (${KERNEL_LAUNCH_EVENTS.map(() => '?').join(',')}) ORDER BY seq DESC LIMIT 1`)
    .get(workflowId, ...KERNEL_LAUNCH_EVENTS);
  const payload = parseJson(launch?.payload_json, {}) ?? {};
  const terminal = job.worker_id ?? payload.terminal ?? null;
  return { attempt: job.attempt, status: job.status, terminal, launch: launch?.kind ?? null,
    launchedAt: launch ? new Date(launch.created_at).toISOString() : null, launchedBy: payload.launchedBy ?? null,
    you: Boolean(terminal && env.ORCA_TERMINAL_HANDLE && env.ORCA_TERMINAL_HANDLE === terminal) };
}

// The live Kernel custody of a workflow: its newest Kernel job and the exact terminal the seat names
// (the singleton signal, then the job's worker, then the hierarchy's runtime handle).
export const kernelCustodyOf = (db, workflowId) => {
  const signal = db.prepare("SELECT token,value_json FROM signals WHERE scope='kernel' AND key=?").get(workflowId) ?? null;
  const job = db.prepare("SELECT * FROM jobs WHERE workflow_id=? AND kind='kernel' ORDER BY created_at DESC LIMIT 1").get(workflowId) ?? null;
  const payload = job ? jobPayloadOf(job) : null;
  const terminal = parseJson(signal?.value_json)?.terminal ?? job?.worker_id ?? payload?.hierarchy?.runtime?.terminalHandle ?? null;
  return { job, payload, terminal };
};
